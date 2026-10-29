import { canDraw, parseStroke, replay, WhiteboardError, WHITEBOARD_LIMITS, type Board, type BoardOp, type BoardOpInput, type DrawMode } from "./domain";

// Ports. The prototype ships an in-memory store; production keeps the same
// interface on PostgreSQL: one row per op, primary key (session, seq), and a
// unique key (session, stroke id) so a retried stroke is stored once.
export interface WhiteboardStore {
  // Appends `op` as seq = current + 1. A stroke whose id is already stored is
  // not appended again; the stored op is returned with `duplicate: true`.
  append(sessionId: string, op: BoardOpInput): Promise<{ op: BoardOp; duplicate: boolean }>;
  // Ops with seq > `after`, in order.
  opsAfter(sessionId: string, after: number): Promise<BoardOp[]>;
}

// The actor's role in the session, read from the Study Group service; null
// for anyone who is not a member of this session.
export type WhiteboardMembership = (sessionId: string, userId: string) => Promise<"host" | "member" | null>;

// The only path to the room. A failed broadcast never fails the write:
// browsers repair a missing op by reading opsAfter.
export type WhiteboardBroadcaster = (input: { sessionId: string; op: BoardOp }) => Promise<void>;

export function createWhiteboardService(deps: { store: WhiteboardStore; membership: WhiteboardMembership; broadcast: WhiteboardBroadcaster }) {
  async function role(sessionId: string, userId: string) {
    const value = await deps.membership(sessionId, userId);
    if (!value) throw new WhiteboardError("forbidden");
    return value;
  }

  async function board(sessionId: string): Promise<Board> {
    return replay(await deps.store.opsAfter(sessionId, 0));
  }

  async function commit(sessionId: string, input: BoardOpInput) {
    const { op, duplicate } = await deps.store.append(sessionId, input);
    if (!duplicate) {
      try {
        await deps.broadcast({ sessionId, op });
      } catch {
        console.info(JSON.stringify({ type: "whiteboard.broadcast_failed", kind: op.kind }));
      }
    }
    return op;
  }

  return {
    // Join and resync: everything after the sequence the browser already has.
    async ops(input: { actorUserId: string; sessionId: string; after: number }) {
      const actorRole = await role(input.sessionId, input.actorUserId);
      const after = Number.isInteger(input.after) && input.after >= 0 ? input.after : 0;
      return { role: actorRole, ops: await deps.store.opsAfter(input.sessionId, after) };
    },

    async draw(input: { actorUserId: string; sessionId: string; stroke: unknown }) {
      const actorRole = await role(input.sessionId, input.actorUserId);
      const stroke = parseStroke(input.stroke, input.actorUserId);
      const current = await board(input.sessionId);
      if (!canDraw(current, actorRole)) throw new WhiteboardError("forbidden");
      if (current.strokes.length >= WHITEBOARD_LIMITS.maxStrokes) throw new WhiteboardError("board_full");
      return commit(input.sessionId, { kind: "stroke", stroke });
    },

    // Members erase their own strokes; the host erases any.
    async erase(input: { actorUserId: string; sessionId: string; strokeId: string }) {
      const actorRole = await role(input.sessionId, input.actorUserId);
      const current = await board(input.sessionId);
      const stroke = current.strokes.find((item) => item.id === input.strokeId);
      if (!stroke) throw new WhiteboardError("not_found");
      if (actorRole !== "host" && (stroke.authorId !== input.actorUserId || !canDraw(current, actorRole))) throw new WhiteboardError("forbidden");
      return commit(input.sessionId, { kind: "erase", strokeId: stroke.id, byId: input.actorUserId });
    },

    async clear(input: { actorUserId: string; sessionId: string }) {
      if ((await role(input.sessionId, input.actorUserId)) !== "host") throw new WhiteboardError("forbidden");
      const current = await board(input.sessionId);
      if (current.strokes.length === 0) return null;
      return commit(input.sessionId, { kind: "clear", byId: input.actorUserId });
    },

    async setMode(input: { actorUserId: string; sessionId: string; mode: unknown }) {
      if ((await role(input.sessionId, input.actorUserId)) !== "host") throw new WhiteboardError("forbidden");
      if (input.mode !== "host" && input.mode !== "everyone") throw new WhiteboardError("invalid_stroke");
      const current = await board(input.sessionId);
      if (current.mode === input.mode) return null;
      return commit(input.sessionId, { kind: "mode", mode: input.mode as DrawMode });
    }
  };
}

export type WhiteboardService = ReturnType<typeof createWhiteboardService>;

export function createMemoryWhiteboardStore(): WhiteboardStore {
  const logs = new Map<string, BoardOp[]>();
  return {
    async append(sessionId, input) {
      const log = logs.get(sessionId) ?? [];
      if (input.kind === "stroke") {
        const stored = log.find((op) => op.kind === "stroke" && op.stroke.id === input.stroke.id);
        if (stored) return { op: stored, duplicate: true };
      }
      const op = { ...input, seq: log.length + 1 } as BoardOp;
      logs.set(sessionId, [...log, op]);
      return { op, duplicate: false };
    },
    async opsAfter(sessionId, after) {
      return (logs.get(sessionId) ?? []).filter((op) => op.seq > after);
    }
  };
}
