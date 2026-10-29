// Shared whiteboard for a Live Session (prototype, 2026-10-29).
//
// The board is a log of operations owned by the server. A finished stroke,
// an erase or a clear is a command: validated here, appended with the next
// sequence number, stored, and only then broadcast over LiveKit. The browser
// rebuilds the board by replaying the log, so a late joiner or a lost packet
// is repaired by reading the ops after the last sequence it has.
//
// Ink that is still being drawn is not part of the board. It travels as a
// lossy member-to-member preview (wire.ts) and is thrown away; only the
// finished stroke, sent to the server, becomes durable.
//
// This file is pure: no I/O, no clock, no LiveKit.

// Coordinates are integers on a fixed 10000 x 6250 board (16:10), so every
// screen size draws the same picture.
export const BOARD = { width: 10_000, height: 6_250 } as const;

export const WHITEBOARD_LIMITS = {
  maxPoints: 600,
  minWidth: 4,
  maxWidth: 120,
  // A reliable LiveKit data packet should stay under 15 KiB; one op must fit.
  maxOpBytes: 12_000,
  maxStrokes: 5_000
} as const;

export const WHITEBOARD_COLORS = ["#1f2937", "#dc2626", "#2563eb", "#16a34a", "#f59e0b"] as const;

export type BoardPoint = readonly [number, number];

export type Stroke = Readonly<{
  id: string;
  authorId: string;
  color: (typeof WHITEBOARD_COLORS)[number];
  width: number;
  points: ReadonlyArray<BoardPoint>;
}>;

// Who may draw. The host always may; "everyone" lets members draw too.
export type DrawMode = "host" | "everyone";

export type BoardOp = Readonly<
  | { seq: number; kind: "stroke"; stroke: Stroke }
  | { seq: number; kind: "erase"; strokeId: string; byId: string }
  | { seq: number; kind: "clear"; byId: string }
  | { seq: number; kind: "mode"; mode: DrawMode }
>;

export type BoardOpInput =
  | { kind: "stroke"; stroke: Stroke }
  | { kind: "erase"; strokeId: string; byId: string }
  | { kind: "clear"; byId: string }
  | { kind: "mode"; mode: DrawMode };

export type Board = Readonly<{ seq: number; mode: DrawMode; strokes: ReadonlyArray<Stroke> }>;

export type WhiteboardErrorCode = "invalid_stroke" | "forbidden" | "not_found" | "board_full" | "conflict";

export class WhiteboardError extends Error {
  readonly code: WhiteboardErrorCode;

  constructor(code: WhiteboardErrorCode) {
    super(code);
    this.name = "WhiteboardError";
    this.code = code;
  }
}

export const EMPTY_BOARD: Board = { seq: 0, mode: "host", strokes: [] };

const ID = /^[A-Za-z0-9_-]{8,64}$/;

// The one validation layer for a stroke from the browser. The shape is
// rebuilt field by field; the author is the signed-in actor, never the body.
export function parseStroke(raw: unknown, authorId: string): Stroke {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WhiteboardError("invalid_stroke");
  const input = raw as Record<string, unknown>;
  const id = typeof input.id === "string" && ID.test(input.id) ? input.id : null;
  const color = WHITEBOARD_COLORS.find((item) => item === input.color);
  const width = Number.isInteger(input.width) && (input.width as number) >= WHITEBOARD_LIMITS.minWidth && (input.width as number) <= WHITEBOARD_LIMITS.maxWidth ? (input.width as number) : null;
  if (!id || !color || !width || !Array.isArray(input.points)) throw new WhiteboardError("invalid_stroke");
  if (input.points.length < 1 || input.points.length > WHITEBOARD_LIMITS.maxPoints) throw new WhiteboardError("invalid_stroke");
  const points = input.points.map((point: unknown): BoardPoint => {
    if (!Array.isArray(point) || point.length !== 2) throw new WhiteboardError("invalid_stroke");
    const [x, y] = point as unknown[];
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new WhiteboardError("invalid_stroke");
    if ((x as number) < 0 || (x as number) > BOARD.width || (y as number) < 0 || (y as number) > BOARD.height) throw new WhiteboardError("invalid_stroke");
    return [x as number, y as number];
  });
  const stroke: Stroke = { id, authorId, color, width, points };
  if (new TextEncoder().encode(JSON.stringify({ seq: 0, kind: "stroke", stroke })).length > WHITEBOARD_LIMITS.maxOpBytes) throw new WhiteboardError("invalid_stroke");
  return stroke;
}

export function canDraw(board: Board, role: "host" | "member") {
  return role === "host" || board.mode === "everyone";
}

// Applies one op to a board. The caller guarantees order (seq = board.seq + 1);
// replaying the same log always yields the same board.
export function applyOp(board: Board, op: BoardOp): Board {
  switch (op.kind) {
    case "stroke":
      return { ...board, seq: op.seq, strokes: [...board.strokes, op.stroke] };
    case "erase":
      return { ...board, seq: op.seq, strokes: board.strokes.filter((stroke) => stroke.id !== op.strokeId) };
    case "clear":
      return { ...board, seq: op.seq, strokes: [] };
    case "mode":
      return { ...board, seq: op.seq, mode: op.mode };
  }
}

export function replay(ops: ReadonlyArray<BoardOp>, from: Board = EMPTY_BOARD): Board {
  return ops.reduce(applyOp, from);
}

// A browser's view of the log. Ops arrive by broadcast in any order and with
// gaps; an op is applied only when it is the next one. An older op is a
// duplicate and is dropped; a newer one means something was missed, so the
// caller reads the missing range from the server ("gap").
export function receiveOp(board: Board, op: BoardOp): { board: Board; gap: boolean } {
  if (op.seq <= board.seq) return { board, gap: false };
  if (op.seq !== board.seq + 1) return { board, gap: true };
  return { board: applyOp(board, op), gap: false };
}
