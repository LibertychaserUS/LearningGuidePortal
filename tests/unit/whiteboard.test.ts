import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_BOARD, parseStroke, receiveOp, replay, WhiteboardError, WHITEBOARD_LIMITS, type BoardOp } from "../../modules/whiteboard/domain";
import { createLiveKitWhiteboardBroadcaster } from "../../modules/whiteboard/liveKitBroadcaster";
import { createMemoryWhiteboardStore, createWhiteboardService } from "../../modules/whiteboard/service";
import { encodeBoardOp, encodeInk, parseBoardOp, parseInk, whiteboardPacket, WHITEBOARD_INK_TOPIC, WHITEBOARD_TOPIC } from "../../modules/whiteboard/wire";
import { parseRoomDataMessage } from "../../modules/group-study/roomData";

const session = "s1";
const stroke = (id: string, extra: Record<string, unknown> = {}) => ({ id, color: "#2563eb", width: 12, points: [[100, 100], [200, 220], [300, 260]], ...extra });

function harness() {
  const sent: BoardOp[] = [];
  const roles: Record<string, "host" | "member"> = { prof: "host", amy: "member", ben: "member" };
  const service = createWhiteboardService({
    store: createMemoryWhiteboardStore(),
    membership: async (_sessionId, userId) => roles[userId] ?? null,
    broadcast: async ({ op }) => { sent.push(op); }
  });
  return { service, sent };
}

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof WhiteboardError ? error.code : "unexpected";
  }
  return "resolved";
}

test("a stroke is stored with the next sequence, then broadcast; replay rebuilds the board", async () => {
  const { service, sent } = harness();
  const first = await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("stroke-0001") });
  const second = await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("stroke-0002") });
  assert.deepEqual([first.seq, second.seq], [1, 2]);
  assert.deepEqual(sent.map((op) => op.seq), [1, 2]);
  const { ops } = await service.ops({ actorUserId: "amy", sessionId: session, after: 0 });
  assert.deepEqual(replay(ops).strokes.map((item) => item.id), ["stroke-0001", "stroke-0002"]);
  assert.equal(replay(ops).strokes[0].authorId, "prof", "the author is the signed-in actor");
});

test("a retried stroke is stored and broadcast once", async () => {
  const { service, sent } = harness();
  await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("stroke-0001") });
  const again = await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("stroke-0001") });
  assert.equal(again.seq, 1);
  assert.equal(sent.length, 1);
});

test("members draw only after the host opens the board to everyone", async () => {
  const { service } = harness();
  assert.equal(await code(service.draw({ actorUserId: "amy", sessionId: session, stroke: stroke("amy-00001") })), "forbidden");
  assert.equal(await code(service.setMode({ actorUserId: "amy", sessionId: session, mode: "everyone" })), "forbidden");
  await service.setMode({ actorUserId: "prof", sessionId: session, mode: "everyone" });
  assert.equal((await service.draw({ actorUserId: "amy", sessionId: session, stroke: stroke("amy-00001") })).kind, "stroke");
  assert.equal(await code(service.draw({ actorUserId: "eve", sessionId: session, stroke: stroke("eve-00001") })), "forbidden");
  assert.equal(await service.setMode({ actorUserId: "prof", sessionId: session, mode: "everyone" }), null, "a repeated mode is a no-op");
});

test("members erase only their own strokes; the host erases any and clears", async () => {
  const { service } = harness();
  await service.setMode({ actorUserId: "prof", sessionId: session, mode: "everyone" });
  await service.draw({ actorUserId: "amy", sessionId: session, stroke: stroke("amy-00001") });
  await service.draw({ actorUserId: "ben", sessionId: session, stroke: stroke("ben-00001") });
  assert.equal(await code(service.erase({ actorUserId: "amy", sessionId: session, strokeId: "ben-00001" })), "forbidden");
  await service.erase({ actorUserId: "amy", sessionId: session, strokeId: "amy-00001" });
  await service.erase({ actorUserId: "prof", sessionId: session, strokeId: "ben-00001" });
  assert.equal(await code(service.erase({ actorUserId: "prof", sessionId: session, strokeId: "ben-00001" })), "not_found");
  await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("prof-0001") });
  assert.equal(await code(service.clear({ actorUserId: "amy", sessionId: session })), "forbidden");
  await service.clear({ actorUserId: "prof", sessionId: session });
  assert.equal(await service.clear({ actorUserId: "prof", sessionId: session }), null, "clearing an empty board is a no-op");
  assert.equal(replay((await service.ops({ actorUserId: "amy", sessionId: session, after: 0 })).ops).strokes.length, 0);
});

test("the validation layer rejects bad strokes and keeps one op inside a LiveKit packet", () => {
  assert.throws(() => parseStroke(stroke("short"), "prof"), WhiteboardError, "id too short");
  assert.throws(() => parseStroke(stroke("stroke-0001", { color: "red" }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { width: 999 }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: [[1.5, 2]] }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: [[20000, 2]] }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: Array.from({ length: WHITEBOARD_LIMITS.maxPoints + 1 }, () => [1, 1]) }), "prof"), WhiteboardError);
  const biggest = parseStroke(stroke("stroke-0001", { points: Array.from({ length: WHITEBOARD_LIMITS.maxPoints }, () => [10000, 6250]) }), "prof");
  assert.ok(encodeBoardOp({ seq: 99999, kind: "stroke", stroke: biggest }).length < 15 * 1024);
  assert.equal(parseStroke({ ...stroke("stroke-0001"), authorId: "someone-else" }, "prof").authorId, "prof");
});

test("a browser applies ops in order, drops duplicates and reports gaps", () => {
  const op = (seq: number): BoardOp => ({ seq, kind: "stroke", stroke: { id: `s-${seq}-xxxxx`, authorId: "prof", color: "#1f2937", width: 8, points: [[1, 1]] } });
  let board = EMPTY_BOARD;
  ({ board } = receiveOp(board, op(1)));
  assert.equal(board.seq, 1);
  assert.deepEqual(receiveOp(board, op(1)), { board, gap: false });
  const gap = receiveOp(board, op(3));
  assert.equal(gap.gap, true);
  assert.equal(gap.board.seq, 1, "an op after a gap is not applied");
});

test("only server ops are trusted; ink is accepted from members as preview only", () => {
  const op: BoardOp = { seq: 1, kind: "clear", byId: "prof" };
  const fromServer = whiteboardPacket({ participantIdentity: "", value: { case: "user", value: { payload: encodeBoardOp(op), topic: WHITEBOARD_TOPIC } } });
  assert.deepEqual(parseBoardOp(fromServer!.payload, fromServer!.senderIdentity), op);
  const forged = whiteboardPacket({ participantIdentity: "amy", value: { case: "user", value: { payload: encodeBoardOp(op), topic: WHITEBOARD_TOPIC } } });
  assert.equal(parseBoardOp(forged!.payload, forged!.senderIdentity), null);
  const ink = encodeInk({ strokeId: "amy-1", color: "#dc2626", width: 10, points: [[-5, 99999], [10, 10]] });
  assert.deepEqual(parseInk(ink, "amy")?.points, [[0, 6250], [10, 10]]);
  assert.equal(parseInk(ink, ""), null);
  assert.equal(whiteboardPacket({ value: { case: "user", value: { payload: ink, topic: "" } } }), null);
  assert.equal(whiteboardPacket({ value: { case: "user", value: { payload: ink, topic: WHITEBOARD_INK_TOPIC } } })?.topic, WHITEBOARD_INK_TOPIC);
  assert.equal(parseRoomDataMessage(encodeBoardOp(op), true), null, "the chat parser ignores whiteboard packets");
});

test("a broadcast failure does not fail the write", async () => {
  const service = createWhiteboardService({ store: createMemoryWhiteboardStore(), membership: async () => "host", broadcast: async () => { throw new Error("livekit down"); } });
  assert.equal((await service.draw({ actorUserId: "prof", sessionId: session, stroke: stroke("stroke-0001") })).seq, 1);
});

test("the LiveKit broadcaster sends the op on the whiteboard topic", async () => {
  const calls: Array<{ room: string; topic: string; body: unknown }> = [];
  const broadcast = createLiveKitWhiteboardBroadcaster({
    roomFor: async (id) => `room-${id}`,
    sendData: async (room, data, options) => { calls.push({ room, topic: options.topic, body: JSON.parse(new TextDecoder().decode(data)) }); }
  });
  await broadcast({ sessionId: session, op: { seq: 4, kind: "mode", mode: "everyone" } });
  assert.deepEqual(calls, [{ room: "room-s1", topic: WHITEBOARD_TOPIC, body: { seq: 4, kind: "mode", mode: "everyone" } }]);
});
