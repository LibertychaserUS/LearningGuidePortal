"use client";

// One browser's view of the classroom: the stage, the boards it may see, the
// strokes it has sent but not yet seen committed, and other people's ink.
// The server is the authority: this hook reads the stage and logs on join, on
// a sequence gap and whenever a board becomes visible, and otherwise applies
// what the room delivers.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMPTY_BOARD, receiveOp, type Board, type Stroke } from "@/modules/whiteboard/domain";
import type { WhiteboardService } from "@/modules/whiteboard/service";
import { audience, boardKey, canDraw, type Role, type Stage } from "@/modules/whiteboard/stage";
import { encodeInk, parseInk, parseWhiteboardMessage, whiteboardPacket, WHITEBOARD_INK_TOPIC, type InkPreview } from "@/modules/whiteboard/wire";

export type RoomPacket = Parameters<typeof whiteboardPacket>[0];

// The slice of a LiveKit room this hook uses: receive packets, and publish
// a member packet (localParticipant.publishData).
export type ClassroomRoom = {
  join(listener: { identity: string; deliver: (packet: RoomPacket) => void }): () => void;
  publish(identity: string, data: Uint8Array, options: { topic: string; reliable: boolean; destinationIdentities?: string[] }): void;
};

const ERRORS: Record<string, string> = {
  forbidden: "现在不能在这块板上画",
  not_found: "找不到这一笔",
  invalid_command: "这一笔没被接受",
  board_full: "这块板已经画满了",
  version_conflict: "操作冲突，请重试"
};

export function useClassroom(input: { identity: string; sessionId: string; room: ClassroomRoom; service: WhiteboardService; hostIds: string[]; memberIds: string[]; onNote?: (line: string) => void }) {
  const { identity, sessionId, room, service, hostIds, memberIds, onNote } = input;
  const [stage, setStage] = useState<Stage | null>(null);
  const [role, setRole] = useState<Role>("member");
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const boards = useRef(new Map<string, Board>());
  const loading = useRef(new Set<string>());
  const pending = useRef(new Map<string, Map<string, Stroke>>());
  const inks = useRef(new Map<string, InkPreview & { at: number; sender: string }>());
  const stageRef = useRef<Stage | null>(null);
  const repairs = useRef(0);
  const bump = useCallback(() => setTick((tick) => tick + 1), []);
  const note = useCallback((line: string) => onNote?.(`${identity}：${line}`), [identity, onNote]);

  const say = useCallback((code: string) => {
    setToast(ERRORS[code] || code);
    setTimeout(() => setToast(""), 2_200);
  }, []);

  const acceptStage = useCallback((next: Stage) => {
    if (next.sessionId !== sessionId) return;
    if (stageRef.current && next.version <= stageRef.current.version) return;
    stageRef.current = next;
    setStage(next);
  }, [sessionId]);

  // Reads a board's ops after the sequence this browser has. Used when a
  // board becomes visible and when a gap shows a broadcast was missed.
  const load = useCallback(async (key: string, reason: "open" | "gap") => {
    if (loading.current.has(key)) return;
    loading.current.add(key);
    try {
      const have = boards.current.get(key) ?? EMPTY_BOARD;
      const ops = await service.ops({ actorUserId: identity, sessionId, board: key, after: have.seq });
      let next = boards.current.get(key) ?? EMPTY_BOARD;
      for (const op of ops) next = receiveOp(next, op).board;
      boards.current.set(key, next);
      for (const stroke of next.strokes) pending.current.get(key)?.delete(stroke.id);
      if (reason === "gap") {
        repairs.current += 1;
        note(`补齐 ${key}，读到 ${ops.length} 条，现在 #${next.seq}`);
      }
      bump();
    } catch {
      // Not visible (any more): forget it; the stage decides when to retry.
      boards.current.delete(key);
    } finally {
      loading.current.delete(key);
    }
  }, [bump, identity, note, service, sessionId]);

  useEffect(() => {
    let alive = true;
    const leave = room.join({
      identity,
      deliver: (packet) => {
        if (!alive) return;
        const data = whiteboardPacket(packet);
        if (!data) return;
        if (data.topic === WHITEBOARD_INK_TOPIC) {
          const ink = parseInk(data.payload, data.senderIdentity);
          if (!ink) return;
          const key = `${data.senderIdentity}/${ink.strokeId}`;
          const previous = inks.current.get(key);
          inks.current.set(key, { ...ink, points: [...(previous?.points ?? []), ...ink.points], at: Date.now(), sender: data.senderIdentity });
          bump();
          return;
        }
        const message = parseWhiteboardMessage(data.payload, data.senderIdentity);
        if (!message) return;
        if (message.kind === "stage") { acceptStage(message.stage); return; }
        const have = boards.current.get(message.board);
        if (!have) return;
        if (message.op.kind === "stroke") {
          inks.current.delete(`${message.op.stroke.authorId}/${message.op.stroke.id}`);
          pending.current.get(message.board)?.delete(message.op.stroke.id);
        }
        const result = receiveOp(have, message.op);
        if (result.gap) { void load(message.board, "gap"); return; }
        if (result.board !== have) { boards.current.set(message.board, result.board); bump(); }
      }
    });
    // Subscribe first, then read: nothing between the two is lost, and the
    // version and sequence checks drop whichever copy arrives second.
    // The host may still be opening the board: retry a few times.
    const readStage = (attempt: number) => void service.stage({ actorUserId: identity, sessionId }).then((snapshot) => {
      if (!alive) return;
      setRole(snapshot.role);
      acceptStage(snapshot.stage);
    }).catch(() => {
      if (alive && attempt < 5) setTimeout(() => readStage(attempt + 1), 300);
      else note("读取课堂状态失败");
    });
    readStage(0);
    const fade = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [key, ink] of inks.current) if (now - ink.at > (ink.done ? 1_500 : 3_000)) { inks.current.delete(key); changed = true; }
      if (changed) bump();
    }, 400);
    return () => { alive = false; leave(); clearInterval(fade); };
  }, [acceptStage, bump, identity, load, note, room, service, sessionId]);

  // The boards this browser should hold for the current stage.
  const visible = useMemo(() => {
    if (!stage) return [] as string[];
    const page = stage.page;
    const keys = [boardKey({ owner: "main", page })];
    if (role === "host") {
      if (stage.work || stage.view.kind === "spotlight") for (const member of memberIds) keys.push(boardKey({ owner: member, page }));
    } else {
      if (stage.work) keys.push(boardKey({ owner: identity, page }));
      if (stage.view.kind === "spotlight") keys.push(boardKey({ owner: stage.view.userId, page }));
    }
    return [...new Set(keys)];
  }, [identity, memberIds, role, stage]);

  useEffect(() => {
    for (const key of [...boards.current.keys()]) if (!visible.includes(key)) boards.current.delete(key);
    for (const key of visible) if (!boards.current.has(key)) void load(key, "open");
  }, [load, visible]);

  const draw = useCallback((key: string, stroke: Stroke) => {
    const list = pending.current.get(key) ?? new Map<string, Stroke>();
    list.set(stroke.id, stroke);
    pending.current.set(key, list);
    bump();
    void service.draw({ actorUserId: identity, sessionId, board: key, stroke }).catch((error: { code?: string }) => {
      pending.current.get(key)?.delete(stroke.id);
      bump();
      say(error.code || "invalid_command");
    });
  }, [bump, identity, say, service, sessionId]);

  const publishInk = useCallback((ink: InkPreview) => {
    const current = stageRef.current;
    if (!current) return;
    const owner = ink.board.startsWith("student:") ? ink.board.slice(8, ink.board.lastIndexOf("/")) : "main";
    const to = audience(current, { owner, page: current.page }, hostIds)?.filter((id) => id !== identity);
    room.publish(identity, encodeInk(ink), { topic: WHITEBOARD_INK_TOPIC, reliable: false, ...(to ? { destinationIdentities: to } : {}) });
  }, [hostIds, identity, room]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      say((error as { code?: string }).code || "invalid_command");
    }
  }, [say]);

  return {
    stage,
    role,
    toast,
    repairs: repairs.current,
    board: (key: string) => boards.current.get(key),
    pending: (key: string) => [...(pending.current.get(key)?.values() ?? [])],
    inks: (key: string) => [...inks.current.values()].filter((ink) => ink.board === key && ink.sender !== identity),
    mayDraw: (key: string) => {
      if (!stage) return false;
      const owner = key.startsWith("student:") ? key.slice(8, key.lastIndexOf("/")) : "main";
      return canDraw(stage, role, identity, { owner, page: Number(key.slice(key.lastIndexOf("/") + 1)) });
    },
    draw,
    publishInk,
    erase: (key: string, strokeId: string) => run(() => service.erase({ actorUserId: identity, sessionId, board: key, strokeId })),
    undo: (key: string) => {
      const mine = (boards.current.get(key)?.strokes ?? []).filter((stroke) => stroke.authorId === identity).at(-1);
      if (mine) void run(() => service.erase({ actorUserId: identity, sessionId, board: key, strokeId: mine.id }));
    },
    clear: (key: string) => run(() => service.clear({ actorUserId: identity, sessionId, board: key })),
    command: (command: unknown) => run(() => service.command({ actorUserId: identity, sessionId, command }))
  };
}
