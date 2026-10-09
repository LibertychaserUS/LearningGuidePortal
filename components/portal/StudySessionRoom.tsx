"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { sessionControls } from "@/modules/group-study/uiState";
import styles from "./study-groups.module.css";
import { studyGroupRequest, type StudyGroupDetail, type StudySession } from "./studyGroupClient";

type ChatLine = { id: string; from: string; text: string };
type Tile = { identity: string; name: string; host: boolean; mic: boolean };

export function StudySessionRoom({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const copy = getMessages(locale).studyGroupsPage;
  const roomCopy = copy.room;
  const [session, setSession] = useState<StudySession | null>(null);
  const [group, setGroup] = useState<StudyGroupDetail | null>(null);
  const [errorCode, setErrorCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [left, setLeft] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [hands, setHands] = useState<string[]>([]);
  const [roomApi, setRoomApi] = useState<{ localParticipant: { setMicrophoneEnabled: (on: boolean) => Promise<unknown>; setCameraEnabled: (on: boolean) => Promise<unknown>; setScreenShareEnabled: (on: boolean) => Promise<unknown>; publishData: (data: Uint8Array, options: { reliable: boolean }) => Promise<unknown>; identity?: string } } | null>(null);

  async function load() {
    const current = await studyGroupRequest<StudySession>(`/api/study-groups/sessions/${sessionId}`);
    if (!current.ok) {
      setErrorCode(current.code);
      return;
    }
    setSession(current.data);
    const detail = await studyGroupRequest<StudyGroupDetail>(`/api/study-groups/${current.data.groupId}`);
    if (detail.ok) setGroup(detail.data);
  }

  async function connect() {
    const issued = await studyGroupRequest<{ token: string; liveKitUrl: string }>(`/api/study-groups/sessions/${sessionId}/token`, { method: "POST", body: "{}" });
    if (!issued.ok || !issued.data.liveKitUrl) {
      setErrorCode(issued.ok ? "unavailable" : issued.code);
      return;
    }
    const { Room, RoomEvent } = await import("livekit-client");
    const room = new Room();
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      const message = JSON.parse(new TextDecoder().decode(payload)) as { type: string; text?: string };
      const from = participant?.identity || "participant";
      if (message.type === "chat" && message.text) setChat((items) => [...items, { id: `${from}-${items.length}`, from, text: message.text || "" }]);
      if (message.type === "raise-hand") setHands((items) => items.includes(from) ? items : [...items, from]);
    });
    const paint = () => {
      const hostIds = new Set((group?.members || []).filter((member) => member.role === "host").map((member) => member.userId));
      setTiles([room.localParticipant, ...Array.from(room.remoteParticipants.values())].map((person) => ({
        identity: person.identity,
        name: person.name || person.identity,
        host: hostIds.has(person.identity),
        mic: person.isMicrophoneEnabled
      })));
    };
    room.on(RoomEvent.ParticipantConnected, paint);
    room.on(RoomEvent.ParticipantDisconnected, paint);
    room.on(RoomEvent.TrackMuted, paint);
    room.on(RoomEvent.TrackUnmuted, paint);
    await room.connect(issued.data.liveKitUrl, issued.data.token);
    setRoomApi(room);
    setConnected(true);
    paint();
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (session?.state === "live" && !connected && !left) void connect().catch(() => setErrorCode("unavailable"));
  }, [session?.state, connected, left]);

  if (!session) return <p className={styles.panel} role="status">{errorCode ? copy.errors[errorCode as keyof typeof copy.errors] || copy.errors.error : copy.loading}</p>;
  if (session.state === "completed" || left) {
    return (
      <section className={styles.empty}>
        <h1>{left && session.state !== "completed" ? roomCopy.youLeft : roomCopy.endedTitle}</h1>
        <p>{session.title}</p>
        <p>{group?.courseTitle}</p>
        <p>{roomCopy.endedBody}</p>
        <a className={styles.primary} href={group ? `/${locale}/portal/courses/${group.courseSlug}` : `/${locale}/portal/study-groups`}>{roomCopy.returnToCourse}</a>
      </section>
    );
  }
  if (session.state !== "live") {
    return <section className={styles.empty} role="status"><h1>{copy.waiting}</h1><p>{session.title}</p></section>;
  }

  const controls = sessionControls({ role: group?.role || "member", state: "live", occupancy: session.occupancy, maxParticipants: session.maxParticipants });
  const errorText = errorCode ? copy.errors[errorCode as keyof typeof copy.errors] || copy.errors.error : "";

  async function publish(message: { type: string; text?: string }) {
    if (!roomApi) return;
    await roomApi.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });
  }

  return (
    <section className={styles.room}>
      <div className={styles.stage}>
        <h1>{session.title}</h1>
        <p className={styles.meta}>{group?.courseTitle} · {copy.live}</p>
        {errorText ? <p className={styles.alert} role="alert">{errorText} <button className={styles.textButton} type="button" onClick={() => { setErrorCode(""); setConnected(false); }}>{roomCopy.reconnect}</button></p> : null}
        <div className={styles.videos}>
          {tiles.length === 0 ? <div className={styles.tile}><span>{connected ? copy.loading : roomCopy.notConnected}</span></div> : tiles.map((tile) => (
            <div className={styles.tile} key={tile.identity}>
              <span>{tile.name}{tile.host ? ` · ${roomCopy.host}` : ""}{hands.includes(tile.identity) ? " · " + roomCopy.raiseHand : ""}{tile.mic ? "" : " · " + roomCopy.mic}</span>
            </div>
          ))}
        </div>
        <div className={styles.controls}>
          {controls.includes("mic") ? <button type="button" onClick={() => void roomApi?.localParticipant.setMicrophoneEnabled(true)}>{roomCopy.mic}</button> : null}
          {controls.includes("camera") ? <button type="button" onClick={() => void roomApi?.localParticipant.setCameraEnabled(true)}>{roomCopy.camera}</button> : null}
          {controls.includes("share") ? <button type="button" onClick={() => void roomApi?.localParticipant.setScreenShareEnabled(true)}>{roomCopy.share}</button> : null}
          {controls.includes("raise-hand") ? <button type="button" onClick={() => void publish({ type: "raise-hand" })}>{roomCopy.raiseHand}</button> : null}
          {controls.includes("leave") ? <button type="button" onClick={async () => { await studyGroupRequest(`/api/study-groups/sessions/${sessionId}/leave`, { method: "POST", body: "{}" }); setLeft(true); await load(); }}>{roomCopy.leave}</button> : null}
        </div>
      </div>
      <aside className={styles.side} aria-label={roomCopy.participants}>
        <h2>{roomCopy.participants} {session.occupancy}/{session.maxParticipants}</h2>
        <div className={styles.chatLog} aria-live="polite">
          <h3>{roomCopy.chat}</h3>
          {chat.map((line) => <p key={line.id}><strong>{line.from}</strong> {line.text}</p>)}
          {!connected ? <p>{roomCopy.chatUnavailable}</p> : null}
        </div>
        <form className={styles.chatForm} onSubmit={(event) => { event.preventDefault(); if (!draft.trim() || !connected) return; void publish({ type: "chat", text: draft.trim() }); setDraft(""); }}>
          <label className={styles.meta}>{roomCopy.chat}<input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={roomCopy.chatPlaceholder} disabled={!connected} /></label>
          <button className={styles.primary} type="submit" disabled={!connected}>{roomCopy.send}</button>
        </form>
      </aside>
    </section>
  );
}
