import { BOARD, WHITEBOARD_COLORS, type BoardOp } from "./domain";

// Two LiveKit data topics. The room's chat, hands and AI Tutor stay on the
// default topic, so none of the parsers ever sees another's packets.
//  - lg.whiteboard: committed ops, sent by the server only (reliable).
//  - lg.whiteboard.ink: ink still being drawn, sent member to member
//    (lossy). Shown as a fading preview, never stored, never trusted as board.
export const WHITEBOARD_TOPIC = "lg.whiteboard";
export const WHITEBOARD_INK_TOPIC = "lg.whiteboard.ink";

export type InkPreview = { strokeId: string; color: string; width: number; points: ReadonlyArray<readonly [number, number]>; done?: boolean };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeBoardOp(op: BoardOp) {
  return encoder.encode(JSON.stringify(op));
}

export function encodeInk(ink: InkPreview) {
  return encoder.encode(JSON.stringify(ink));
}

function json(raw: Uint8Array): Record<string, unknown> | null {
  try {
    const value = JSON.parse(decoder.decode(raw));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Picks whiteboard packets out of the raw engine stream the room already
// watches (group-study/roomData.ts roomDataPacket). The sender stamp is empty
// only for RoomService.SendData, i.e. the server.
export function whiteboardPacket(packet: { participantIdentity?: string; value?: { case?: string; value?: unknown } }): { topic: string; payload: Uint8Array; senderIdentity: string } | null {
  if (packet.value?.case !== "user") return null;
  const user = packet.value.value as { payload?: unknown; topic?: unknown } | undefined;
  if ((user?.topic !== WHITEBOARD_TOPIC && user?.topic !== WHITEBOARD_INK_TOPIC) || !(user.payload instanceof Uint8Array)) return null;
  return { topic: user.topic, payload: user.payload, senderIdentity: typeof packet.participantIdentity === "string" ? packet.participantIdentity : "" };
}

// Trust boundary: a committed op is accepted from the server only. Any member
// can publish on any topic, so an op with a sender identity is a forgery.
export function parseBoardOp(raw: Uint8Array, senderIdentity: string): BoardOp | null {
  if (senderIdentity) return null;
  const op = json(raw);
  if (!op || !Number.isInteger(op.seq) || (op.seq as number) < 1) return null;
  if (op.kind === "stroke" && op.stroke && typeof op.stroke === "object") return op as unknown as BoardOp;
  if (op.kind === "erase" && typeof op.strokeId === "string") return op as unknown as BoardOp;
  if (op.kind === "clear") return op as unknown as BoardOp;
  if (op.kind === "mode" && (op.mode === "host" || op.mode === "everyone")) return op as unknown as BoardOp;
  return null;
}

// Ink comes from a member and is only ever drawn as a preview, so it is
// clamped to the board and the palette and nothing more.
export function parseInk(raw: Uint8Array, senderIdentity: string): InkPreview | null {
  if (!senderIdentity) return null;
  const ink = json(raw);
  if (!ink || typeof ink.strokeId !== "string" || !Array.isArray(ink.points)) return null;
  const color = WHITEBOARD_COLORS.find((item) => item === ink.color);
  if (!color || !Number.isInteger(ink.width)) return null;
  const points = ink.points.slice(0, 200).filter((point): point is [number, number] => Array.isArray(point) && Number.isInteger(point[0]) && Number.isInteger(point[1]))
    .map(([x, y]) => [Math.min(BOARD.width, Math.max(0, x)), Math.min(BOARD.height, Math.max(0, y))] as [number, number]);
  return { strokeId: ink.strokeId.slice(0, 64), color, width: Math.min(120, Math.max(1, ink.width as number)), points, ...(ink.done === true ? { done: true } : {}) };
}
