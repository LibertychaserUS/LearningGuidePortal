"use client";

// One board: the courseware page underneath, a canvas on top. It draws the
// committed strokes, this browser's strokes still on their way to the server,
// and other people's ink previews. It owns only the stroke being drawn right
// now; everything else comes in through props.

import { useEffect, useRef } from "react";
import { BOARD, WHITEBOARD_COLORS, type Board, type Stroke } from "@/modules/whiteboard/domain";
import type { InkPreview } from "@/modules/whiteboard/wire";
import { Courseware } from "./Courseware";
import styles from "./whiteboard.module.css";

export type Tool = { kind: "pen" | "eraser"; color: (typeof WHITEBOARD_COLORS)[number]; width: number };

const RES_W = 1600;
const RES_H = 1000;
const SCALE = RES_W / BOARD.width;

type Line = { color: string; width: number; points: ReadonlyArray<readonly [number, number]> };

function paint(context: CanvasRenderingContext2D, line: Line, alpha: number) {
  if (!line.points.length) return;
  context.globalAlpha = alpha;
  context.strokeStyle = line.color;
  context.lineWidth = Math.max(1.5, line.width * SCALE);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  const [x0, y0] = line.points[0];
  context.moveTo(x0 * SCALE, y0 * SCALE);
  if (line.points.length === 1) context.lineTo(x0 * SCALE + 0.1, y0 * SCALE);
  // Midpoint smoothing so a decimated stroke still reads as handwriting.
  for (let index = 1; index < line.points.length - 1; index += 1) {
    const [x, y] = line.points[index];
    const [nx, ny] = line.points[index + 1];
    context.quadraticCurveTo(x * SCALE, y * SCALE, ((x + nx) / 2) * SCALE, ((y + ny) / 2) * SCALE);
  }
  if (line.points.length > 1) {
    const [lx, ly] = line.points[line.points.length - 1];
    context.lineTo(lx * SCALE, ly * SCALE);
  }
  context.stroke();
  context.globalAlpha = 1;
}

function distanceToStroke(stroke: Stroke, [px, py]: readonly [number, number]) {
  return Math.min(...stroke.points.map(([x, y]) => Math.hypot(x - px, y - py)));
}

export function BoardCanvas(props: {
  boardKey: string;
  page: number;
  board: Board | undefined;
  pending?: ReadonlyArray<Stroke>;
  inks?: ReadonlyArray<InkPreview>;
  editable?: boolean;
  active?: boolean;
  tool?: Tool;
  actorId?: string;
  canEraseAny?: boolean;
  testId?: string;
  onStroke?: (stroke: Stroke) => void;
  onInk?: (ink: InkPreview) => void;
  onErase?: (strokeId: string) => void;
}) {
  const { board, pending, inks, editable, tool, actorId } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<{ stroke: Stroke & { points: Array<[number, number]> }; sent: number; at: number } | null>(null);
  const counter = useRef(0);

  const render = () => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, RES_W, RES_H);
    for (const stroke of board?.strokes ?? []) paint(context, stroke, 1);
    for (const stroke of pending ?? []) paint(context, stroke, 0.55);
    for (const ink of inks ?? []) paint(context, ink, 0.4);
    if (drawing.current) paint(context, drawing.current.stroke, 0.8);
  };

  useEffect(render);

  const toBoard = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * BOARD.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * BOARD.height);
    return [Math.min(BOARD.width, Math.max(0, x)), Math.min(BOARD.height, Math.max(0, y))];
  };

  const sendInk = (done: boolean) => {
    const current = drawing.current;
    if (!current || !props.onInk) return;
    const fresh = current.stroke.points.slice(current.sent);
    if (!fresh.length && !done) return;
    props.onInk({ board: props.boardKey, strokeId: current.stroke.id, color: current.stroke.color, width: current.stroke.width, points: fresh, ...(done ? { done: true } : {}) });
    current.sent = current.stroke.points.length;
    current.at = Date.now();
  };

  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!editable || !tool || !actorId) return;
    const point = toBoard(event);
    if (tool.kind === "eraser") {
      const hit = (board?.strokes ?? [])
        .filter((stroke) => props.canEraseAny || stroke.authorId === actorId)
        .map((stroke) => ({ stroke, distance: distanceToStroke(stroke, point) }))
        .filter((item) => item.distance < item.stroke.width + 90)
        .sort((a, b) => a.distance - b.distance)[0];
      if (hit) props.onErase?.(hit.stroke.id);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    counter.current += 1;
    drawing.current = { stroke: { id: `${actorId.replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now().toString(36)}-${counter.current}`, authorId: actorId, color: tool.color, width: tool.width, points: [point] }, sent: 0, at: 0 };
    render();
  };

  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawing.current;
    if (!current) return;
    const point = toBoard(event);
    const [lx, ly] = current.stroke.points[current.stroke.points.length - 1];
    if (Math.hypot(point[0] - lx, point[1] - ly) < 20 || current.stroke.points.length >= 600) return;
    current.stroke.points.push(point);
    if (Date.now() - current.at > 50) sendInk(false);
    render();
  };

  const onUp = () => {
    const current = drawing.current;
    if (!current) return;
    sendInk(true);
    drawing.current = null;
    props.onStroke?.({ ...current.stroke, points: [...current.stroke.points] });
  };

  return (
    <div className={styles.board} data-editable={editable ? "true" : "false"} data-tool={tool?.kind} data-active={props.active ? "true" : "false"} data-testid={props.testId} data-board={props.boardKey} data-seq={board?.seq ?? -1}>
      <Courseware page={props.page} />
      <canvas ref={canvasRef} width={RES_W} height={RES_H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
    </div>
  );
}
