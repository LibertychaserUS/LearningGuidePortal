import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_BOARD, parseStroke, receiveOp, replay, WhiteboardError, WHITEBOARD_LIMITS, type BoardOp } from "../../modules/whiteboard/domain";
import { createLiveKitWhiteboardBroadcaster } from "../../modules/whiteboard/liveKitBroadcaster";
import { createMemoryWhiteboardStore, createWhiteboardService } from "../../modules/whiteboard/service";
import { audience, canSee, initialStage, parseBoardKey, parseStageCommand } from "../../modules/whiteboard/stage";
import { encodeInk, encodeWhiteboardMessage, parseInk, parseWhiteboardMessage, whiteboardPacket, WHITEBOARD_INK_TOPIC, WHITEBOARD_TOPIC, type WhiteboardMessage } from "../../modules/whiteboard/wire";
import { parseRoomDataMessage } from "../../modules/group-study/roomData";

const session = "s1";
const stroke = (id: string, extra: Record<string, unknown> = {}) => ({ id, color: "#1d6bff", width: 24, points: [[100, 100], [200, 220], [300, 260]], ...extra });
type Sent = { message: WhiteboardMessage; to?: string[] };

async function harness() {
  const sent: Sent[] = [];
  const service = createWhiteboardService({
    store: createMemoryWhiteboardStore(),
    roster: async () => ({ hostIds: ["prof"], memberIds: ["amy", "ben"] }),
    broadcast: async ({ message, destinationIdentities }) => { sent.push({ message, ...(destinationIdentities ? { to: destinationIdentities } : {}) }); }
  });
  await service.open({ actorUserId: "prof", sessionId: session, pageCount: 4 });
  const host = (command: unknown) => service.command({ actorUserId: "prof", sessionId: session, command });
  return { service, sent, host };
}

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof WhiteboardError ? error.code : `unexpected ${String(error)}`;
  }
  return "resolved";
}

test("a stroke on the main board is stored with the next sequence, then sent to the whole room", async () => {
  const { service, sent } = await harness();
  const first = await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("stroke-0001") });
  const second = await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("stroke-0002") });
  assert.deepEqual([first.seq, second.seq], [1, 2]);
  const ops = sent.filter((item) => item.message.kind === "op");
  assert.equal(ops.length, 2);
  assert.ok(ops.every((item) => !item.to), "main board ops go to everyone");
  const board = replay(await service.ops({ actorUserId: "amy", sessionId: session, board: "main/0", after: 0 }));
  assert.deepEqual(board.strokes.map((item) => [item.id, item.authorId]), [["stroke-0001", "prof"], ["stroke-0002", "prof"]]);
});

test("a retried stroke is stored and sent once; pages have separate logs", async () => {
  const { service, sent } = await harness();
  await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("stroke-0001") });
  assert.equal((await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("stroke-0001") })).seq, 1);
  assert.equal((await service.draw({ actorUserId: "prof", sessionId: session, board: "main/1", stroke: stroke("stroke-0001") })).seq, 1);
  assert.equal(sent.filter((item) => item.message.kind === "op").length, 2);
});

test("the pen: a member draws on the main board only while holding it, on the current page, unlocked", async () => {
  const { service, host } = await harness();
  const draw = (id: string, board = "main/0") => service.draw({ actorUserId: "amy", sessionId: session, board, stroke: stroke(id) });
  assert.equal(await code(draw("amy-00001")), "forbidden");
  await host({ type: "grant_pen", userId: "amy" });
  assert.equal(await code(draw("amy-00001")), "resolved");
  assert.equal(await code(draw("amy-00002", "main/1")), "forbidden", "not the current page");
  await host({ type: "lock", on: true });
  assert.equal(await code(draw("amy-00003")), "forbidden", "locked");
  await host({ type: "lock", on: false });
  await host({ type: "revoke_pen", userId: "amy" });
  assert.equal(await code(draw("amy-00004")), "forbidden");
  assert.equal(await code(service.draw({ actorUserId: "eve", sessionId: session, board: "main/0", stroke: stroke("eve-00001") })), "forbidden");
  assert.equal(await code(host({ type: "grant_pen", userId: "eve" })), "not_found", "the pen goes to someone in the session only");
});

test("only the host runs the stage; repeated commands change nothing", async () => {
  const { service, sent, host } = await harness();
  assert.equal(await code(service.command({ actorUserId: "amy", sessionId: session, command: { type: "work", on: true } })), "forbidden");
  const before = sent.length;
  const moved = await host({ type: "goto", page: 2 });
  assert.equal(moved.page, 2);
  assert.equal((await host({ type: "goto", page: 2 })).version, moved.version);
  assert.equal(sent.length, before + 1);
  assert.equal(await code(host({ type: "goto", page: 4 })), "invalid_command");
  assert.equal(await code(host({ type: "drop_table" })), "invalid_command");
});

test("work mode: each student's board reaches only that student and the host until it is spotlighted", async () => {
  const { service, sent, host } = await harness();
  assert.equal(await code(service.draw({ actorUserId: "amy", sessionId: session, board: "student:amy/0", stroke: stroke("amy-00001") })), "forbidden", "not in work mode");
  await host({ type: "work", on: true });
  await service.draw({ actorUserId: "amy", sessionId: session, board: "student:amy/0", stroke: stroke("amy-00001") });
  assert.deepEqual(sent.at(-1)!.to, ["amy", "prof"]);
  assert.equal(await code(service.draw({ actorUserId: "ben", sessionId: session, board: "student:amy/0", stroke: stroke("ben-00001") })), "forbidden", "not your board");
  assert.equal(await code(service.ops({ actorUserId: "ben", sessionId: session, board: "student:amy/0", after: 0 })), "forbidden", "classmates cannot read it");
  assert.equal((await service.ops({ actorUserId: "prof", sessionId: session, board: "student:amy/0", after: 0 })).length, 1);
  // The host enlarges amy's board for everyone, annotates it, then ends it.
  await host({ type: "spotlight", userId: "amy", size: "full" });
  assert.equal((await service.ops({ actorUserId: "ben", sessionId: session, board: "student:amy/0", after: 0 })).length, 1);
  await service.draw({ actorUserId: "prof", sessionId: session, board: "student:amy/0", stroke: stroke("prof-00001") });
  assert.equal(sent.at(-1)!.to, undefined, "a spotlighted board goes to everyone");
  await host({ type: "spotlight", userId: "amy", size: "split" });
  await host({ type: "end_spotlight" });
  assert.equal(await code(service.ops({ actorUserId: "ben", sessionId: session, board: "student:amy/0", after: 0 })), "forbidden");
  assert.equal(await code(host({ type: "spotlight", userId: "eve", size: "full" })), "not_found");
});

test("erase and clear: members only their own work, the host anything", async () => {
  const { service, host } = await harness();
  await host({ type: "work", on: true });
  await host({ type: "grant_pen", userId: "amy" });
  await service.draw({ actorUserId: "amy", sessionId: session, board: "main/0", stroke: stroke("amy-00001") });
  await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("prof-0001") });
  assert.equal(await code(service.erase({ actorUserId: "amy", sessionId: session, board: "main/0", strokeId: "prof-0001" })), "forbidden");
  assert.equal(await code(service.erase({ actorUserId: "amy", sessionId: session, board: "main/0", strokeId: "amy-00001" })), "resolved");
  assert.equal(await code(service.clear({ actorUserId: "amy", sessionId: session, board: "main/0" })), "forbidden");
  await service.draw({ actorUserId: "ben", sessionId: session, board: "student:ben/0", stroke: stroke("ben-00001") });
  assert.equal(await code(service.clear({ actorUserId: "amy", sessionId: session, board: "student:ben/0" })), "forbidden");
  assert.equal(await code(service.clear({ actorUserId: "ben", sessionId: session, board: "student:ben/0" })), "resolved");
  assert.equal(await service.clear({ actorUserId: "ben", sessionId: session, board: "student:ben/0" }), null, "clearing an empty board is a no-op");
  await service.clear({ actorUserId: "prof", sessionId: session, board: "main/0" });
  assert.equal(replay(await service.ops({ actorUserId: "amy", sessionId: session, board: "main/0", after: 0 })).strokes.length, 0);
});

test("the validation layer rejects bad input and keeps one op inside a LiveKit packet", () => {
  assert.throws(() => parseStroke(stroke("short"), "prof"), WhiteboardError, "id too short");
  assert.throws(() => parseStroke(stroke("stroke-0001", { color: "red" }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { width: 999 }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: [[1.5, 2]] }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: [[20000, 2]] }), "prof"), WhiteboardError);
  assert.throws(() => parseStroke(stroke("stroke-0001", { points: Array.from({ length: WHITEBOARD_LIMITS.maxPoints + 1 }, () => [1, 1]) }), "prof"), WhiteboardError);
  const biggest = parseStroke(stroke("stroke-0001", { points: Array.from({ length: WHITEBOARD_LIMITS.maxPoints }, () => [10000, 6250]) }), "prof");
  assert.ok(encodeWhiteboardMessage({ kind: "op", board: "student:a-very-long-user-identity-0000000000/99", op: { seq: 99999, kind: "stroke", stroke: biggest } }).length < 15 * 1024);
  assert.equal(parseStroke({ ...stroke("stroke-0001"), authorId: "someone-else" }, "prof").authorId, "prof");
  assert.throws(() => parseBoardKey("student:../0"), WhiteboardError);
  assert.throws(() => parseBoardKey("main/x"), WhiteboardError);
  assert.deepEqual(parseBoardKey("student:amy/3"), { owner: "amy", page: 3 });
  assert.throws(() => parseStageCommand({ type: "spotlight", userId: "amy", size: "huge" }), WhiteboardError);
  const stage = initialStage(session, 2);
  assert.equal(canSee(stage, "member", "ben", { owner: "amy", page: 0 }), false);
  assert.deepEqual(audience(stage, { owner: "amy", page: 0 }, ["prof", "amy"]), ["amy", "prof"]);
});

test("a browser applies ops in order, drops duplicates and reports gaps", () => {
  const op = (seq: number): BoardOp => ({ seq, kind: "stroke", stroke: { id: `s-${seq}-xxxxx`, authorId: "prof", color: "#101828", width: 8, points: [[1, 1]] } });
  let board = EMPTY_BOARD;
  ({ board } = receiveOp(board, op(1)));
  assert.equal(board.seq, 1);
  assert.deepEqual(receiveOp(board, op(1)), { board, gap: false });
  const gap = receiveOp(board, op(3));
  assert.equal(gap.gap, true);
  assert.equal(gap.board.seq, 1, "an op after a gap is not applied");
});

test("only server messages are trusted; ink is accepted from members as preview only", () => {
  const message: WhiteboardMessage = { kind: "op", board: "main/0", op: { seq: 1, kind: "clear", byId: "prof" } };
  const fromServer = whiteboardPacket({ participantIdentity: "", value: { case: "user", value: { payload: encodeWhiteboardMessage(message), topic: WHITEBOARD_TOPIC } } });
  assert.deepEqual(parseWhiteboardMessage(fromServer!.payload, fromServer!.senderIdentity), message);
  const forged = whiteboardPacket({ participantIdentity: "amy", value: { case: "user", value: { payload: encodeWhiteboardMessage({ kind: "stage", stage: initialStage(session, 2) }), topic: WHITEBOARD_TOPIC } } });
  assert.equal(parseWhiteboardMessage(forged!.payload, forged!.senderIdentity), null);
  const ink = encodeInk({ board: "main/0", strokeId: "amy-1", color: "#f04438", width: 10, points: [[-5, 99999], [10, 10]] });
  assert.deepEqual(parseInk(ink, "amy")?.points, [[0, 6250], [10, 10]]);
  assert.equal(parseInk(ink, ""), null);
  assert.equal(parseInk(encodeInk({ board: "../x", strokeId: "a", color: "#f04438", width: 10, points: [] }), "amy"), null);
  assert.equal(whiteboardPacket({ value: { case: "user", value: { payload: ink, topic: "" } } }), null);
  assert.equal(whiteboardPacket({ value: { case: "user", value: { payload: ink, topic: WHITEBOARD_INK_TOPIC } } })?.topic, WHITEBOARD_INK_TOPIC);
  assert.equal(parseRoomDataMessage(encodeWhiteboardMessage(message), true), null, "the chat parser ignores whiteboard packets");
});

test("a broadcast failure does not fail the write", async () => {
  const service = createWhiteboardService({ store: createMemoryWhiteboardStore(), roster: async () => ({ hostIds: ["prof"], memberIds: [] }), broadcast: async () => { throw new Error("livekit down"); } });
  await service.open({ actorUserId: "prof", sessionId: session, pageCount: 1 });
  assert.equal((await service.draw({ actorUserId: "prof", sessionId: session, board: "main/0", stroke: stroke("stroke-0001") })).seq, 1);
});

test("the LiveKit broadcaster sends on the whiteboard topic to the given identities", async () => {
  const calls: Array<{ room: string; topic: string; to?: string[]; body: unknown }> = [];
  const broadcast = createLiveKitWhiteboardBroadcaster({
    roomFor: async (id) => `room-${id}`,
    sendData: async (room, data, options) => { calls.push({ room, topic: options.topic, to: options.destinationIdentities, body: JSON.parse(new TextDecoder().decode(data)) }); }
  });
  const message: WhiteboardMessage = { kind: "op", board: "student:amy/0", op: { seq: 4, kind: "clear", byId: "prof" } };
  await broadcast({ sessionId: session, message, destinationIdentities: ["amy", "prof"] });
  assert.deepEqual(calls, [{ room: "room-s1", topic: WHITEBOARD_TOPIC, to: ["amy", "prof"], body: message }]);
});
