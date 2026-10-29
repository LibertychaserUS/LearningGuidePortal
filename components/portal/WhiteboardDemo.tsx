"use client";

// Prototype playground for the shared whiteboard (2026-10-29). One page runs
// the real whiteboard service with the in-memory store, plus a stand-in for
// the LiveKit room that delivers the same packet shape the SFU forwards: an
// empty sender stamp for RoomService.SendData (stage and committed ops), the
// member's identity for member publishes (ink preview), and destination
// identities honoured both ways. Each screen is one person's browser.
// DEV only; no Figma frame yet (待视觉验收); copy not localised.

import { useCallback, useMemo, useRef, useState } from "react";
import { WHITEBOARD_COLORS } from "@/modules/whiteboard/domain";
import { createLiveKitWhiteboardBroadcaster } from "@/modules/whiteboard/liveKitBroadcaster";
import { createMemoryWhiteboardStore, createWhiteboardService, type WhiteboardService } from "@/modules/whiteboard/service";
import { boardKey } from "@/modules/whiteboard/stage";
import { BoardCanvas, type Tool } from "./whiteboard/BoardCanvas";
import { COURSEWARE_PAGES } from "./whiteboard/Courseware";
import { useClassroom, type ClassroomRoom, type RoomPacket } from "./whiteboard/useClassroom";
import styles from "./whiteboard/whiteboard.module.css";

const SESSION = "demo-session";
const HOSTS = ["professor"];
const MEMBERS = ["amy", "ben"];
const PEOPLE: Record<string, { name: string; color: string }> = {
  professor: { name: "王教授", color: "#1d6bff" },
  amy: { name: "Amy", color: "#f79009" },
  ben: { name: "Ben", color: "#12b76a" }
};
const WIDTHS = [{ label: "细", value: 18 }, { label: "中", value: 34 }, { label: "粗", value: 60 }];

function createDemoRoom(lossRef: { current: number }) {
  const listeners = new Set<{ identity: string; deliver: (packet: RoomPacket) => void }>();
  const deliver = (packet: RoomPacket, sender: string, to?: string[]) => {
    for (const listener of listeners) {
      if (listener.identity === sender) continue;
      if (to && !to.includes(listener.identity)) continue;
      if (Math.random() < lossRef.current) continue;
      setTimeout(() => listener.deliver(packet), 20 + Math.random() * 80);
    }
  };
  const room: ClassroomRoom & { sendData(room: string, data: Uint8Array, options: { topic: string; destinationIdentities?: string[] }): Promise<void> } = {
    join(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    // RoomService.SendData: no sender stamp. The loss switch drops these too,
    // to show that a browser repairs a missed op from the server's log.
    async sendData(_room, data, options) {
      deliver({ participantIdentity: "", value: { case: "user", value: { payload: data.slice(), topic: options.topic } } }, "", options.destinationIdentities);
    },
    publish(identity, data, options) {
      deliver({ participantIdentity: identity, value: { case: "user", value: { payload: data, topic: options.topic } } }, identity, options.destinationIdentities);
    }
  };
  return room;
}

function Avatar({ id }: { id: string }) {
  return <span className={styles.avatar} style={{ background: PEOPLE[id]?.color || "#98a2b3" }}>{(PEOPLE[id]?.name || id).slice(0, 1)}</span>;
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={styles.switch} onClick={() => onChange(!on)} />;
}

function Room({ identity, room, service, onNote }: { identity: string; room: ClassroomRoom; service: WhiteboardService; onNote: (line: string) => void }) {
  const classroom = useClassroom({ identity, sessionId: SESSION, room, service, hostIds: HOSTS, memberIds: MEMBERS, onNote });
  const [tool, setTool] = useState<Tool>({ kind: "pen", color: identity === "professor" ? WHITEBOARD_COLORS[2] : WHITEBOARD_COLORS[1], width: WIDTHS[1].value });
  const { stage, role } = classroom;
  if (!stage) return <div className={styles.stage}>正在进入课堂…</div>;
  const host = role === "host";
  const page = stage.page;
  const main = boardKey({ owner: "main", page });
  const spot = stage.view.kind === "spotlight" ? stage.view : null;
  const spotKey = spot ? boardKey({ owner: spot.userId, page }) : "";
  const own = boardKey({ owner: identity, page });

  // What this screen shows, in order. The first entry is the one the toolbar
  // acts on (undo, clear).
  const shown: Array<{ key: string; tag: string; accent?: boolean }> = [];
  if (spot && spot.size === "full") shown.push({ key: spotKey, tag: `${PEOPLE[spot.userId]?.name} 的白板 · 全员可见`, accent: true });
  else if (spot) shown.push({ key: main, tag: "课件主板" }, { key: spotKey, tag: `${PEOPLE[spot.userId]?.name} 的白板`, accent: true });
  else if (!host && stage.work) shown.push({ key: own, tag: "我的作答板 · 只有老师能看到", accent: true });
  else shown.push({ key: main, tag: "课件主板" });
  const primary = shown[0].key;
  const drawable = shown.some((item) => classroom.mayDraw(item.key));

  const banner = spot
    ? { tone: "spot", text: host ? `正在向全员展示 ${PEOPLE[spot.userId]?.name} 的白板${spot.size === "split" ? "（与主板并排）" : ""}，你可以直接在上面批注` : `老师正在展示 ${PEOPLE[spot.userId]?.name} 的白板` }
    : stage.locked && !host ? { tone: "locked", text: "老师已锁定白板，暂时不能书写" }
      : stage.work ? { tone: "work", text: host ? "学生正在各自的作答板上练习，右侧可以查看每个人的进度" : "请在你自己的作答板上完成练习，同学看不到你的作答" }
        : null;

  const status = host ? { tone: "ok", text: "主持人" } : drawable ? { tone: "ok", text: stage.work && !spot ? "可以在作答板上书写" : "老师给了你画笔" } : { tone: stage.locked ? "warn" : "", text: stage.locked ? "已锁定" : "只能观看" };

  const board = (item: { key: string; tag: string; accent?: boolean }) => (
    <div className={styles.boardFrame} key={item.key}>
      <span className={styles.boardTag} data-accent={item.accent ? "true" : "false"}>{item.tag}</span>
      <BoardCanvas
        boardKey={item.key}
        page={page}
        board={classroom.board(item.key)}
        pending={classroom.pending(item.key)}
        inks={classroom.inks(item.key)}
        editable={classroom.mayDraw(item.key)}
        active={shown.length > 1 && classroom.mayDraw(item.key) && item.key === primary}
        tool={tool}
        actorId={identity}
        canEraseAny={host}
        testId={`board-${identity}-${item.key}`}
        onStroke={(stroke) => classroom.draw(item.key, stroke)}
        onInk={classroom.publishInk}
        onErase={(strokeId) => void classroom.erase(item.key, strokeId)}
      />
    </div>
  );

  return (
    <div className={styles.room}>
      <section className={styles.stage} style={{ position: "relative" }}>
        <header className={styles.stageHead}>
          <h2>第 3 讲 · 牛顿第二定律</h2>
          <span className={styles.coursePill}>物理 · 学习小组</span>
          <span className={styles.liveClock}><span className={styles.liveDot} />直播中 00:24:13</span>
        </header>
        {banner ? <div className={styles.banner} data-tone={banner.tone} data-testid={`banner-${identity}`}>{banner.text}{host && spot ? <button type="button" className={styles.button} onClick={() => void classroom.command({ type: "end_spotlight" })}>结束展示</button> : null}</div> : null}
        <div className={`${styles.boards} ${shown.length > 1 ? styles.boardsSplit : ""}`}>{shown.map(board)}</div>
        <div className={styles.toolbar}>
          <div className={styles.tools} aria-disabled={!drawable}>
            {WHITEBOARD_COLORS.map((color) => <button key={color} type="button" className={styles.swatch} style={{ background: color }} aria-label={`颜色 ${color}`} aria-pressed={tool.kind === "pen" && tool.color === color} onClick={() => setTool({ ...tool, kind: "pen", color })} />)}
            <span className={styles.toolDivider} />
            {WIDTHS.map((width) => <button key={width.value} type="button" className={styles.toolButton} aria-label={`线宽 ${width.label}`} aria-pressed={tool.width === width.value} onClick={() => setTool({ ...tool, kind: "pen", width: width.value })}><span className={styles.widthDot} style={{ width: 4 + width.value / 8, height: 4 + width.value / 8 }} /></button>)}
            <span className={styles.toolDivider} />
            <button type="button" className={styles.toolButton} aria-pressed={tool.kind === "eraser"} onClick={() => setTool({ ...tool, kind: tool.kind === "eraser" ? "pen" : "eraser" })}>橡皮</button>
            <button type="button" className={styles.toolButton} onClick={() => classroom.undo(primary)}>撤销</button>
            {host || primary === own ? <button type="button" className={styles.toolButton} onClick={() => void classroom.clear(primary)}>清空</button> : null}
          </div>
          <span className={styles.status} data-tone={status.tone} data-testid={`status-${identity}`}>{status.text}</span>
          <div className={styles.pager}>
            {host ? <button type="button" className={styles.button} disabled={page === 0} onClick={() => void classroom.command({ type: "goto", page: page - 1 })}>上一页</button> : null}
            <span>第 {page + 1} / {stage.pageCount} 页</span>
            {host ? <button type="button" className={styles.button} disabled={page >= stage.pageCount - 1} onClick={() => void classroom.command({ type: "goto", page: page + 1 })}>下一页</button> : null}
          </div>
        </div>
        {classroom.toast ? <div className={styles.toast} role="status">{classroom.toast}</div> : null}
      </section>

      <aside className={styles.side}>
        {host ? (
          <>
            <h3 className={styles.sideTitle}>白板管理</h3>
            <div className={styles.switchRow}><div>学生各自作答<small>每人一块作答板，同学之间互相看不到</small></div><Switch label="学生各自作答" on={stage.work} onChange={(on) => void classroom.command({ type: "work", on })} /></div>
            <div className={styles.switchRow}><div>锁定所有学生<small>收起所有人的画笔和作答板</small></div><Switch label="锁定所有学生" on={stage.locked} onChange={(on) => void classroom.command({ type: "lock", on })} /></div>
            <hr className={styles.rule} />
            <h3 className={styles.sideTitle}>学生 <span>{MEMBERS.length}</span></h3>
            {MEMBERS.map((member) => {
              const key = boardKey({ owner: member, page });
              const spotlit = spot?.userId === member;
              const pen = stage.pens.includes(member);
              const strokes = classroom.board(key)?.strokes.length ?? 0;
              return (
                <div key={member} className={styles.studentCard} data-spotlit={spotlit ? "true" : "false"} data-testid={`student-${member}`}>
                  <div className={styles.studentHead}>
                    <Avatar id={member} /> {PEOPLE[member].name}
                    {pen ? <span className={styles.chip} data-tone="blue">有画笔</span> : null}
                    {stage.work ? <span className={styles.chip} data-tone="green">{strokes} 笔</span> : null}
                  </div>
                  {stage.work || spotlit ? (
                    <BoardCanvas boardKey={key} page={page} board={classroom.board(key)} inks={classroom.inks(key)} testId={`thumb-${member}`} />
                  ) : <div className={styles.thumbEmpty}>打开“学生各自作答”后，这里实时显示 {PEOPLE[member].name} 的作答板</div>}
                  <div className={styles.studentActions}>
                    {spotlit && spot?.size === "full" ? <button type="button" className={styles.button} onClick={() => void classroom.command({ type: "spotlight", userId: member, size: "split" })}>缩小并排</button>
                      : <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} disabled={!stage.work && !spotlit} onClick={() => void classroom.command({ type: "spotlight", userId: member, size: "full" })}>放大展示</button>}
                    {spotlit ? <button type="button" className={styles.button} onClick={() => void classroom.command({ type: "end_spotlight" })}>收回</button>
                      : <button type="button" className={styles.button} disabled={!stage.work} onClick={() => void classroom.command({ type: "spotlight", userId: member, size: "split" })}>并排</button>}
                    <button type="button" className={styles.button} onClick={() => void classroom.command({ type: pen ? "revoke_pen" : "grant_pen", userId: member })}>{pen ? "收回画笔" : "给画笔"}</button>
                    {stage.work ? <button type="button" className={`${styles.button} ${styles.buttonDanger}`} disabled={!strokes} onClick={() => void classroom.clear(key)}>清空</button> : null}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <h3 className={styles.sideTitle}>课堂</h3>
            <p className={styles.note}>{spot ? `老师正在展示 ${PEOPLE[spot.userId]?.name} 的白板。` : stage.work ? "现在是练习时间：在作答板上写出你的答案，老师能实时看到。" : "老师正在讲解课件。"}{stage.pens.includes(identity) && !stage.locked ? " 老师给了你画笔，可以直接在主板上写。" : ""}</p>
            <hr className={styles.rule} />
            <h3 className={styles.sideTitle}>成员 <span>{HOSTS.length + MEMBERS.length}</span></h3>
            <ul className={styles.roster}>
              {[...HOSTS, ...MEMBERS].map((person) => (
                <li key={person}><Avatar id={person} />{PEOPLE[person].name}{person === identity ? "（我）" : ""}
                  {HOSTS.includes(person) ? <span className={styles.chip} data-tone="blue">主持人</span> : stage.pens.includes(person) ? <span className={styles.chip} data-tone="green">有画笔</span> : spot?.userId === person ? <span className={styles.chip} data-tone="blue">展示中</span> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

type View = "professor" | "amy" | "ben" | "all";

export default function WhiteboardDemo() {
  const lossRef = useRef(0);
  const [loss, setLoss] = useState(false);
  const [view, setView] = useState<View>("professor");
  const [log, setLog] = useState<string[]>([]);
  const room = useMemo(() => createDemoRoom(lossRef), []);
  const service = useMemo(() => {
    const created = createWhiteboardService({
      store: createMemoryWhiteboardStore(),
      roster: async () => ({ hostIds: HOSTS, memberIds: MEMBERS }),
      broadcast: createLiveKitWhiteboardBroadcaster({ roomFor: async (id) => `study-session-${id}`, sendData: room.sendData })
    });
    void created.open({ actorUserId: "professor", sessionId: SESSION, pageCount: COURSEWARE_PAGES });
    return created;
  }, [room]);
  const onNote = useCallback((line: string) => setLog((lines) => [line, ...lines].slice(0, 6)), []);
  const screens: Array<{ id: Exclude<View, "all">; label: string }> = [{ id: "professor", label: "王教授（主持人）的屏幕" }, { id: "amy", label: "学生 Amy 的屏幕" }, { id: "ben", label: "学生 Ben 的屏幕" }];
  return (
    <main className={styles.demo}>
      <div className={styles.demoBar}>
        <h1>共享白板原型</h1>
        <span className={styles.devPill}>DEV · 待视觉验收</span>
        <div className={styles.switcher} role="group" aria-label="切换视角">
          {([["professor", "教授视角"], ["amy", "Amy 视角"], ["ben", "Ben 视角"], ["all", "三屏对照"]] as Array<[View, string]>).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
        </div>
        <label className={styles.lossToggle}><input type="checkbox" checked={loss} data-testid="loss" onChange={(event) => { lossRef.current = event.target.checked ? 0.3 : 0; setLoss(event.target.checked); }} />模拟 30% 丢包</label>
      </div>
      <div className={`${styles.screens} ${view === "all" ? styles.screensCompare : ""}`}>
        {screens.map((screen) => (
          <div key={screen.id} className={styles.screen} data-visible={view === "all" || view === screen.id ? "true" : "false"} data-testid={`screen-${screen.id}`}>
            {view === "all" ? <p className={styles.screenLabel}>{screen.label}</p> : null}
            <Room identity={screen.id} room={room} service={service} onNote={onNote} />
          </div>
        ))}
      </div>
      {log.length ? <ol className={styles.log} data-testid="log">{log.map((line, index) => <li key={index}>{line}</li>)}</ol> : null}
    </main>
  );
}
