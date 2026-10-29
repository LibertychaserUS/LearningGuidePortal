// The classroom around the boards: what everyone is looking at and who may
// draw where. The host (the professor) runs it; the server stores it as one
// versioned record and broadcasts the whole record on every change, so a
// browser never applies deltas and only compares versions.
//
// Boards, one op log each, keyed per page:
//  - "main/<page>": the courseware page everyone sees. The host draws; a
//    member draws only while holding the pen.
//  - "student:<userId>/<page>": that student's own copy of the page, used in
//    "work" mode. The owner draws on it; the host sees every student's copy and
//    may annotate it. Other students see it only while the host spotlights it.
//
// Pure: no I/O, no clock, no LiveKit.

import { WhiteboardError } from "./domain";

export const STAGE_LIMITS = { maxPages: 100, maxPens: 6 } as const;

// What the room is shown. "full" spotlights one student's board enlarged;
// "split" shows it beside the main board.
export type StageView = Readonly<{ kind: "main" } | { kind: "spotlight"; userId: string; size: "full" | "split" }>;

export type Stage = Readonly<{
  sessionId: string;
  version: number;
  page: number;
  pageCount: number;
  view: StageView;
  // Members allowed to draw on the main board.
  pens: ReadonlyArray<string>;
  // Every student works on their own copy of the current page.
  work: boolean;
  // Freezes all member drawing (main and own boards) at once.
  locked: boolean;
}>;

export type StageCommand =
  | { type: "goto"; page: number }
  | { type: "spotlight"; userId: string; size: "full" | "split" }
  | { type: "end_spotlight" }
  | { type: "grant_pen"; userId: string }
  | { type: "revoke_pen"; userId: string }
  | { type: "work"; on: boolean }
  | { type: "lock"; on: boolean };

export type Role = "host" | "member";

export type BoardRef = Readonly<{ owner: "main" | string; page: number }>;

const USER = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,63}$/;

export function initialStage(sessionId: string, pageCount: number): Stage {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > STAGE_LIMITS.maxPages) throw new WhiteboardError("invalid_command");
  return { sessionId, version: 0, page: 0, pageCount, view: { kind: "main" }, pens: [], work: false, locked: false };
}

export function boardKey(board: BoardRef) {
  return board.owner === "main" ? `main/${board.page}` : `student:${board.owner}/${board.page}`;
}

export function parseBoardKey(key: unknown): BoardRef {
  if (typeof key !== "string") throw new WhiteboardError("invalid_command");
  const match = /^(?:main|student:([A-Za-z0-9][A-Za-z0-9_.:@-]{0,63}))\/(\d{1,3})$/.exec(key);
  if (!match) throw new WhiteboardError("invalid_command");
  return { owner: match[1] ?? "main", page: Number(match[2]) };
}

// The one validation layer for host input: the shape is rebuilt field by field.
export function parseStageCommand(raw: unknown): StageCommand {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WhiteboardError("invalid_command");
  const command = raw as Record<string, unknown>;
  const user = typeof command.userId === "string" && USER.test(command.userId) ? command.userId : null;
  switch (command.type) {
    case "goto":
      if (!Number.isInteger(command.page)) throw new WhiteboardError("invalid_command");
      return { type: "goto", page: command.page as number };
    case "spotlight":
      if (!user || (command.size !== "full" && command.size !== "split")) throw new WhiteboardError("invalid_command");
      return { type: "spotlight", userId: user, size: command.size };
    case "end_spotlight":
      return { type: "end_spotlight" };
    case "grant_pen":
    case "revoke_pen":
      if (!user) throw new WhiteboardError("invalid_command");
      return { type: command.type, userId: user };
    case "work":
    case "lock":
      if (typeof command.on !== "boolean") throw new WhiteboardError("invalid_command");
      return { type: command.type, on: command.on };
    default:
      throw new WhiteboardError("invalid_command");
  }
}

// Applies one validated host command. `members` are the session's student
// ids, so a spotlight or pen can only name someone in the room. Returns null
// when nothing changes, so a repeated click neither bumps the version nor
// broadcasts.
export function applyStageCommand(stage: Stage, command: StageCommand, members: ReadonlyArray<string>): Stage | null {
  const next = (patch: Partial<Stage>): Stage => ({ ...stage, ...patch, version: stage.version + 1 });
  switch (command.type) {
    case "goto":
      if (command.page < 0 || command.page >= stage.pageCount) throw new WhiteboardError("invalid_command");
      return command.page === stage.page ? null : next({ page: command.page });
    case "spotlight":
      if (!members.includes(command.userId)) throw new WhiteboardError("not_found");
      if (stage.view.kind === "spotlight" && stage.view.userId === command.userId && stage.view.size === command.size) return null;
      return next({ view: { kind: "spotlight", userId: command.userId, size: command.size } });
    case "end_spotlight":
      return stage.view.kind === "main" ? null : next({ view: { kind: "main" } });
    case "grant_pen":
      if (!members.includes(command.userId)) throw new WhiteboardError("not_found");
      if (stage.pens.includes(command.userId)) return null;
      if (stage.pens.length >= STAGE_LIMITS.maxPens) throw new WhiteboardError("invalid_command");
      return next({ pens: [...stage.pens, command.userId] });
    case "revoke_pen":
      return stage.pens.includes(command.userId) ? next({ pens: stage.pens.filter((id) => id !== command.userId) }) : null;
    case "work":
      return stage.work === command.on ? null : next({ work: command.on });
    case "lock":
      return stage.locked === command.on ? null : next({ locked: command.on });
  }
}

function spotlighted(stage: Stage, owner: string) {
  return stage.view.kind === "spotlight" && stage.view.userId === owner;
}

// Who may read a board's log (and so receive its ops).
export function canSee(stage: Stage, role: Role, actorId: string, board: BoardRef) {
  if (role === "host" || board.owner === "main") return true;
  return board.owner === actorId || spotlighted(stage, board.owner);
}

// Who may add a stroke to a board, or erase their own strokes on it. The host
// always may; members only on the current page and never while locked.
export function canDraw(stage: Stage, role: Role, actorId: string, board: BoardRef) {
  if (role === "host") return true;
  if (stage.locked || board.page !== stage.page) return false;
  if (board.owner === "main") return stage.pens.includes(actorId);
  return board.owner === actorId && stage.work;
}

// The LiveKit destinations for an op on `board`: undefined means the whole
// room. A student's own board goes to that student and the hosts only, unless
// it is spotlighted.
export function audience(stage: Stage, board: BoardRef, hostIds: ReadonlyArray<string>): string[] | undefined {
  if (board.owner === "main" || spotlighted(stage, board.owner)) return undefined;
  return [...new Set([board.owner, ...hostIds])];
}
