"use client";

// Prototype playground for the shared whiteboard (2026-10-29). One page runs
// the real whiteboard service with the in-memory store, plus a stand-in for
// the LiveKit room that delivers the same packet shape the SFU forwards: an
// empty sender stamp for RoomService.SendData (committed ops), the member's
// identity for member publishes (ink preview). Each pane is one browser.
// Not a product screen: DEV only, no Figma, copy not localised.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOARD, EMPTY_BOARD, receiveOp, WHITEBOARD_COLORS, type Board, type BoardOp, type Stroke } from "@/modules/whiteboard/domain";
import { createLiveKitWhiteboardBroadcaster } from "@/modules/whiteboard/liveKitBroadcaster";
import { createMemoryWhiteboardStore, createWhiteboardService, type WhiteboardService } from "@/modules/whiteboard/service";
import { encodeInk, parseBoardOp, parseInk, whiteboardPacket, WHITEBOARD_INK_TOPIC, type InkPreview } from "@/modules/whiteboard/wire";

type Packet = Parameters<typeof whiteboardPacket>[0];
type Listener = { identity: string; deliver: (packet: Packet) => void };
type Color = (typeof WHITEBOARD_COLORS)[number];

const SESSION = "demo-session";
const ROLES: Record<string, "host" | "member"> = { professor: "host", amy: "member", ben: "member" };
const CANVAS_W = 800;
const SCALE = CANVAS_W / BOARD.width;
const CANVAS_H = Math.round(BOARD.height * SCALE);

function createDemoRoom(lossRef: { current: number }) {
  const listeners = new Set<Listener>();
  const deliver = (packet: Packet, to: (listener: Listener) => boolean, lossy: boolean) => {
    for (const listener of listeners) {
      if (!to(listener)) continue;
      if (lossy && Math.random() < lossRef.current) continue;
      setTimeout(() => listener.deliver(packet), 20 + Math.random() * 80);
    }
  };
  return {
    join(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    // RoomService.SendData: no sender stamp. The loss switch drops these too,
    // to show that a browser repairs a missed op from the server's log.
    async sendData(_room: string, data: Uint8Array, options: { topic: string }) {
      deliver({ participantIdentity: "", value: { case: "user", value: { payload: data.slice(), topic: options.topic } } }, () => true, true);
    },
    // localParticipant.publishData({ reliable: false, topic }): stamped with the
    // sender, not delivered back to it.
    publish(identity: string, data: Uint8Array, topic: string) {
      deliver({ participantIdentity: identity, value: { case: "user", value: { payload: data, topic } } }, (listener) => listener.identity !== identity, true);
    }
  };
}

type DemoRoom = ReturnType<typeof createDemoRoom>;

function drawStroke(context: CanvasRenderingContext2D, stroke: { color: string; width: number; points: ReadonlyArray<readonly [number, number]> }, alpha = 1) {
  if (!stroke.points.length) return;
  context.globalAlpha = alpha;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = Math.max(1, stroke.width * SCALE);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  const [x0, y0] = stroke.points[0];
  context.moveTo(x0 * SCALE, y0 * SCALE);
  if (stroke.points.length === 1) context.lineTo(x0 * SCALE + 0.1, y0 * SCALE);
  for (const [x, y] of stroke.points.slice(1)) context.lineTo(x * SCALE, y * SCALE);
  context.stroke();
  context.globalAlpha = 1;
}

function distanceToStroke(stroke: Stroke, [px, py]: readonly [number, number]) {
  return Math.min(...stroke.points.map(([x, y]) => Math.hypot(x - px, y - py)));
}

function Pane({ identity, room, service, onNote }: { identity: string; room: DemoRoom; service: WhiteboardService; onNote: (line: string) => void }) {
  const host = ROLES[identity] === "host";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<Board>(EMPTY_BOARD);
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [joined, setJoined] = useState(true);
  const [color, setColor] = useState<Color>(host ? WHITEBOARD_COLORS[0] : WHITEBOARD_COLORS[2]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [repairs, setRepairs] = useState(0);
  const pending = useRef(new Map<string, Stroke>());
  const ink = useRef(new Map<string, InkPreview & { at: number }>());
  const drawing = useRef<{ stroke: Stroke & { points: Array<[number, number]> }; sent: number; lastInk: number } | null>(null);
  const syncing = useRef(false);
  const counter = useRef(0);
  const note = useCallback((line: string) => onNote(`${identity}：${line}`), [identity, onNote]);

  const render = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, CANVAS_W, CANVAS_H);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const stroke of boardRef.current.strokes) drawStroke(context, stroke);
    for (const stroke of pending.current.values()) drawStroke(context, stroke, 0.6);
    if (drawing.current) drawStroke(context, drawing.current.stroke, 0.6);
    const now = Date.now();
    for (const [id, preview] of ink.current) {
      if (now - preview.at > 3_000) { ink.current.delete(id); continue; }
      drawStroke(context, preview, 0.35);
    }
  }, []);

  const commitBoard = useCallback((next: Board) => {
    boardRef.current = next;
    for (const stroke of next.strokes) pending.current.delete(stroke.id);
    setBoard(next);
    render();
  }, [render]);

  // Reads every op after the sequence this browser has and applies them in
  // order. Used on join, on a detected gap, and on reconnect.
  const resync = useCallback(async (reason: string) => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const { ops } = await service.ops({ actorUserId: identity, sessionId: SESSION, after: boardRef.current.seq });
      let next = boardRef.current;
      for (const op of ops) next = receiveOp(next, op).board;
      if (reason === "gap") setRepairs((count) => count + 1);
      note(`${reason === "join" ? "进房" : "补齐缺口"}，读到 ${ops.length} 条操作，现在 #${next.seq}`);
      commitBoard(next);
    } finally {
      syncing.current = false;
    }
  }, [commitBoard, identity, note, service]);

  useEffect(() => {
    if (!joined) return;
    let alive = true;
    const leave = room.join({
      identity,
      deliver: (packet) => {
        if (!alive) return;
        const data = whiteboardPacket(packet);
        if (!data) return;
        if (data.topic === WHITEBOARD_INK_TOPIC) {
          const preview = parseInk(data.payload, data.senderIdentity);
          if (!preview) return;
          const key = `${data.senderIdentity}/${preview.strokeId}`;
          const previous = ink.current.get(key);
          ink.current.set(key, { ...preview, points: [...(previous?.points ?? []), ...preview.points], at: Date.now() });
          render();
          return;
        }
        const op: BoardOp | null = parseBoardOp(data.payload, data.senderIdentity);
        if (!op) return;
        if (op.kind === "stroke") ink.current.delete(`${op.stroke.authorId}/${op.stroke.id}`);
        const result = receiveOp(boardRef.current, op);
        if (result.gap) { void resync("gap"); return; }
        if (result.board !== boardRef.current) commitBoard(result.board);
      }
    });
    // Subscribe first, then read the log: nothing between the two is lost,
    // and receiveOp drops whichever copy arrives second.
    void resync("join");
    const fade = setInterval(render, 500);
    return () => { alive = false; leave(); clearInterval(fade); };
  }, [commitBoard, identity, joined, render, resync, room]);

  const toBoard = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * BOARD.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * BOARD.height);
    return [Math.min(BOARD.width, Math.max(0, x)), Math.min(BOARD.height, Math.max(0, y))];
  };

  const allowed = joined && (host || board.mode === "everyone");

  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!allowed) return;
    const point = toBoard(event);
    if (tool === "eraser") {
      const candidates = boardRef.current.strokes.filter((stroke) => host || stroke.authorId === identity);
      const hit = candidates.map((stroke) => ({ stroke, d: distanceToStroke(stroke, point) })).filter((item) => item.d < item.stroke.width + 80).sort((a, b) => a.d - b.d)[0];
      if (hit) void service.erase({ actorUserId: identity, sessionId: SESSION, strokeId: hit.stroke.id }).catch((error: Error) => note(`擦除被拒绝：${error.message}`));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    counter.current += 1;
    drawing.current = { stroke: { id: `${identity}-${Date.now().toString(36)}-${counter.current}`, authorId: identity, color, width: 24, points: [point] }, sent: 0, lastInk: 0 };
    render();
  };

  const sendInk = (done: boolean) => {
    const current = drawing.current;
    if (!current) return;
    const fresh = current.stroke.points.slice(current.sent);
    if (!fresh.length && !done) return;
    room.publish(identity, encodeInk({ strokeId: current.stroke.id, color: current.stroke.color, width: current.stroke.width, points: fresh, ...(done ? { done: true } : {}) }), WHITEBOARD_INK_TOPIC);
    current.sent = current.stroke.points.length;
    current.lastInk = Date.now();
  };

  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawing.current;
    if (!current) return;
    const point = toBoard(event);
    const [lx, ly] = current.stroke.points[current.stroke.points.length - 1];
    if (Math.hypot(point[0] - lx, point[1] - ly) < 25 || current.stroke.points.length >= 600) return;
    current.stroke.points.push(point);
    if (Date.now() - current.lastInk > 50) sendInk(false);
    render();
  };

  const onUp = () => {
    const current = drawing.current;
    if (!current) return;
    sendInk(true);
    drawing.current = null;
    pending.current.set(current.stroke.id, current.stroke);
    render();
    void service.draw({ actorUserId: identity, sessionId: SESSION, stroke: { ...current.stroke } }).catch((error: Error) => {
      pending.current.delete(current.stroke.id);
      render();
      note(`笔画被拒绝：${error.message}`);
    });
  };

  return (
    <section style={paneStyle} data-testid={`pane-${identity}`}>
      <div style={bar}>
        <strong>{host ? "教授（Host）" : `学生 ${identity}`}</strong>
        <span style={{ fontSize: 12, color: "#666" }} data-testid={`seq-${identity}`}>#{board.seq} · {board.strokes.length} 笔 · 补齐 {repairs} 次</span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        data-testid={`canvas-${identity}`}
        style={{ width: "100%", aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, border: "1px solid #ccc", borderRadius: 8, touchAction: "none", cursor: allowed ? (tool === "eraser" ? "cell" : "crosshair") : "not-allowed", opacity: joined ? 1 : 0.4 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div style={bar}>
        <div style={{ display: "flex", gap: 6 }}>
          {WHITEBOARD_COLORS.map((item) => <button key={item} type="button" aria-label={`颜色 ${item}`} onClick={() => { setColor(item); setTool("pen"); }} style={{ width: 22, height: 22, borderRadius: 11, background: item, border: color === item && tool === "pen" ? "3px solid #999" : "1px solid #ccc" }} />)}
          <button type="button" onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")} aria-pressed={tool === "eraser"}>{tool === "eraser" ? "橡皮（开）" : "橡皮"}</button>
        </div>
        {host ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => void service.setMode({ actorUserId: identity, sessionId: SESSION, mode: board.mode === "everyone" ? "host" : "everyone" })}>{board.mode === "everyone" ? "收回画笔" : "允许全员画"}</button>
            <button type="button" onClick={() => void service.clear({ actorUserId: identity, sessionId: SESSION })}>清空</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: allowed ? "#16a34a" : "#999" }}>{allowed ? "可以画" : "只看"}</span>
            <button type="button" onClick={() => {
              if (joined) { setJoined(false); boardRef.current = EMPTY_BOARD; pending.current.clear(); ink.current.clear(); setBoard(EMPTY_BOARD); render(); note("断线"); } else setJoined(true);
            }}>{joined ? "断线" : "重新进房"}</button>
          </div>
        )}
      </div>
    </section>
  );
}

const paneStyle = { border: "1px solid #ddd", borderRadius: 12, padding: 12, flex: "1 1 380px", minWidth: 300, display: "flex", flexDirection: "column", gap: 8 } as const;
const bar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" } as const;

export default function WhiteboardDemo() {
  const lossRef = useRef(0);
  const [loss, setLoss] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const room = useMemo(() => createDemoRoom(lossRef), []);
  const service = useMemo(() => createWhiteboardService({
    store: createMemoryWhiteboardStore(),
    membership: async (_sessionId, userId) => ROLES[userId] ?? null,
    broadcast: createLiveKitWhiteboardBroadcaster({ roomFor: async (id) => `study-session-${id}`, sendData: room.sendData })
  }), [room]);
  const onNote = useCallback((line: string) => setLog((lines) => [line, ...lines].slice(0, 8)), []);
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>共享白板原型（DEV）</h1>
      <p style={{ color: "#666", maxWidth: 900, margin: "0 0 12px" }}>每个面板相当于一个浏览器。画完的笔画先交给服务器存档并编号，再由服务器经 LiveKit 数据通道（此处为同形状的本地替身）广播；正在画的笔迹走成员之间的低延迟预览，不存档。进房、断线重连、丢包时，浏览器按编号向服务器补齐。</p>
      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 12, whiteSpace: "nowrap", width: "auto" }}>
        <input type="checkbox" style={{ width: "auto" }} checked={loss} data-testid="loss" onChange={(event) => { lossRef.current = event.target.checked ? 0.3 : 0; setLoss(event.target.checked); }} />
        模拟 30% 丢包
      </label>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Pane identity="professor" room={room} service={service} onNote={onNote} />
        <Pane identity="amy" room={room} service={service} onNote={onNote} />
        <Pane identity="ben" room={room} service={service} onNote={onNote} />
      </div>
      <ol style={{ fontSize: 12, color: "#666" }} data-testid="log">{log.map((line, index) => <li key={index}>{line}</li>)}</ol>
    </main>
  );
}
