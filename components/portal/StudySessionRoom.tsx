"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { participantStatus, raisedHands, sessionControls } from "@/modules/group-study/uiState";
import styles from "./study-groups.module.css";
import { fill, plannedMinutes, sessionScheduleLabel, studyGroupRequest, tutorQueueBody, type StudyGroupDetail, type StudySession } from "./studyGroupClient";

function tileStatus(copy: { muted: string; speaking: string; micOn: string }, tile: { mic: boolean; speaking: boolean }) {
  const status = participantStatus(tile);
  if (status === "muted") return copy.muted;
  if (status === "speaking") return copy.speaking;
  return copy.micOn;
}

function elapsedClock(startedAt: string | null) {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

type ChatLine = { id: string; from: string; text: string; at: string };

function chatStamp() {
  return new Date().toISOString();
}

function chatLabel(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}
type Tile = { identity: string; name: string; host: boolean; mic: boolean; speaking: boolean };
type AttachableTrack = { attach: (element: HTMLMediaElement) => HTMLMediaElement; detach: (element: HTMLMediaElement) => HTMLMediaElement[] };
type LocalMedia = { setMicrophoneEnabled: (on: boolean) => Promise<unknown>; setCameraEnabled: (on: boolean) => Promise<unknown>; setScreenShareEnabled: (on: boolean) => Promise<unknown>; publishData: (data: Uint8Array, options: { reliable: boolean }) => Promise<unknown>; identity?: string; isMicrophoneEnabled: boolean; isCameraEnabled: boolean };

function ParticipantCamera({ track }: { track: AttachableTrack | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!track || !element) return;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track]);
  if (!track) return null;
  return <video ref={ref} autoPlay playsInline muted />;
}

export function StudySessionRoom({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const copy = getMessages(locale).studyGroupsPage;
  const roomCopy = copy.room;
  const [session, setSession] = useState<StudySession | null>(null);
  const [group, setGroup] = useState<StudyGroupDetail | null>(null);
  const [errorCode, setErrorCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [seated, setSeated] = useState(false);
  const [entryDone, setEntryDone] = useState(false);
  const [left, setLeft] = useState(false);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [hands, setHands] = useState<string[]>([]);
  const [roomApi, setRoomApi] = useState<{ localParticipant: LocalMedia } | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareTrack, setShareTrack] = useState<AttachableTrack | null>(null);
  const [cameraTracks, setCameraTracks] = useState<Record<string, AttachableTrack>>({});
  const [addressTutor, setAddressTutor] = useState(false);
  const [clock, setClock] = useState("00:00");
  const shareVideo = useRef<HTMLVideoElement>(null);
  const audioRoot = useRef<HTMLDivElement>(null);
  const groupRef = useRef<StudyGroupDetail | null>(null);
  const repaintRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<{ startAudio: () => Promise<void>; disconnect: () => Promise<void> } | null>(null);
  const connectGeneration = useRef(0);
  groupRef.current = group;

  async function load() {
    const current = await studyGroupRequest<StudySession>(`/api/study-groups/sessions/${sessionId}`);
    if (!current.ok) {
      setErrorCode(current.code);
      return;
    }
    const detail = await studyGroupRequest<StudyGroupDetail>(`/api/study-groups/${current.data.groupId}`);
    setSession(current.data);
    if (detail.ok) setGroup(detail.data);
  }

  async function connect(generation: number) {
    const issued = await studyGroupRequest<{ token: string; liveKitUrl: string }>(`/api/study-groups/sessions/${sessionId}/token`, { method: "POST", body: "{}" });
    if (!issued.ok || !issued.data.liveKitUrl) throw new Error(issued.ok ? "unavailable" : issued.code);
    const { Room, RoomEvent } = await import("livekit-client");
    const room = new Room();
    const showShare = () => {
      const publications = [
        ...room.localParticipant.trackPublications.values(),
        ...Array.from(room.remoteParticipants.values()).flatMap((person) => [...person.trackPublications.values()])
      ];
      const shared = publications.find((item) => item.source === "screen_share" && item.track);
      setShareTrack(shared?.track ?? null);
      setSharing([...room.localParticipant.trackPublications.values()].some((item) => item.source === "screen_share" && item.track));
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      setCameraOn(room.localParticipant.isCameraEnabled);
    };
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      const message = JSON.parse(new TextDecoder().decode(payload)) as { type: string; text?: string; raised?: boolean };
      const from = participant?.name || participant?.identity || "participant";
      if (message.type === "tutor" && message.text) {
        setChat((items) => [...items, { id: `tutor-${items.length}`, from: roomCopy.aiTutor, text: message.text || "", at: chatStamp() }]);
        return;
      }
      if (message.type === "chat" && message.text) setChat((items) => [...items, { id: `${from}-${items.length}`, from, text: message.text || "", at: chatStamp() }]);
      if (message.type === "raise-hand") {
        const identity = participant?.identity || "";
        setHands((items) => raisedHands(items, identity, message.raised !== false));
      }
    });
    const paint = () => {
      const hostIds = new Set((groupRef.current?.members || []).filter((member) => member.role === "host").map((member) => member.userId));
      const people = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
      const nextCameras: Record<string, AttachableTrack> = {};
      for (const person of people) {
        const publication = [...person.trackPublications.values()].find((item) => item.source === "camera" && item.track && item.isMuted === false);
        if (publication?.track) nextCameras[person.identity] = publication.track;
      }
      setCameraTracks(nextCameras);
      setTiles(people.map((person) => ({
        identity: person.identity,
        name: person.name || person.identity,
        host: hostIds.has(person.identity),
        mic: person.isMicrophoneEnabled,
        speaking: person.isSpeaking
      })));
    };
    repaintRef.current = paint;
    room.on(RoomEvent.ParticipantConnected, () => { paint(); window.setTimeout(() => void load(), 400); });
    room.on(RoomEvent.ParticipantDisconnected, () => { paint(); window.setTimeout(() => void load(), 400); });
    room.on(RoomEvent.ActiveSpeakersChanged, paint);
    room.on(RoomEvent.TrackMuted, () => { paint(); showShare(); });
    room.on(RoomEvent.TrackUnmuted, () => { paint(); showShare(); });
    const attachRemoteAudio = (track: { kind: string; attach: () => HTMLMediaElement }) => {
      if (track.kind !== "audio") return;
      const element = track.attach();
      element.autoplay = true;
      if (audioRoot.current && element.parentElement !== audioRoot.current) audioRoot.current.appendChild(element);
      void room.startAudio().catch(() => undefined);
    };
    room.on(RoomEvent.TrackSubscribed, (track) => { attachRemoteAudio(track); paint(); showShare(); });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === "audio") track.detach().forEach((element) => element.remove());
      paint();
      showShare();
    });
    room.on(RoomEvent.LocalTrackPublished, () => { paint(); showShare(); });
    room.on(RoomEvent.LocalTrackUnpublished, () => { paint(); showShare(); });
    try {
      await room.connect(issued.data.liveKitUrl, issued.data.token);
    } catch (error) {
      await room.disconnect().catch(() => undefined);
      throw error;
    }
    if (connectGeneration.current !== generation) {
      await room.disconnect().catch(() => undefined);
      return;
    }
    roomRef.current = room;
    setRoomApi(room);
    setConnected(true);
    setErrorCode("");
    paint();
    void room.startAudio().catch(() => undefined);
  }

  useEffect(() => () => { void roomRef.current?.disconnect().catch(() => undefined); }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (session?.state === "completed") void releaseRoom();
  }, [session?.state]);

  useEffect(() => {
    if (!session || left) return;
    if (session.state !== "starting_soon" && session.state !== "live") {
      setEntryDone(true);
      return;
    }
    let cancelled = false;
    setEntryDone(false);
    void studyGroupRequest(`/api/study-groups/sessions/${sessionId}/enter`, { method: "POST", body: "{}" }).then((result) => {
      if (cancelled) return;
      if (result.ok) setSeated(true);
      else if (result.code !== "session_not_open") setErrorCode(result.code);
      setEntryDone(true);
    });
    return () => { cancelled = true; };
  }, [session?.state, sessionId, left]);

  useEffect(() => {
    if (session?.state !== "live" || connected || left || !seated) return;
    const generation = connectGeneration.current + 1;
    connectGeneration.current = generation;
    let timer = 0;
    const run = (triesLeft: number) => {
      void connect(generation).catch((error: unknown) => {
        if (connectGeneration.current !== generation) return;
        if (triesLeft > 0) {
          timer = window.setTimeout(() => run(triesLeft - 1), 600);
          return;
        }
        const code = error instanceof Error ? error.message : "";
        setErrorCode(code in copy.errors ? code : "connect_failed");
      });
    };
    run(2);
    return () => {
      connectGeneration.current += 1;
      window.clearTimeout(timer);
    };
  }, [session?.state, connected, left, seated]);

  useEffect(() => {
    if (session?.state !== "live") return;
    const tick = () => setClock(elapsedClock(session.startedAt));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session?.state, session?.startedAt]);

  useEffect(() => {
    repaintRef.current?.();
  }, [group]);

  useEffect(() => {
    const element = shareVideo.current;
    if (!shareTrack || !element) return;
    shareTrack.attach(element);
    return () => { shareTrack.detach(element); };
  }, [shareTrack]);

  async function setMedia(kind: "mic" | "camera" | "share", enabled: boolean) {
    const local = roomApi?.localParticipant;
    if (!local) return;
    await roomRef.current?.startAudio().catch(() => undefined);
    if (kind === "mic") await local.setMicrophoneEnabled(enabled);
    if (kind === "camera") await local.setCameraEnabled(enabled);
    if (kind === "share") await local.setScreenShareEnabled(enabled);
    if (kind === "mic") setMicOn(enabled);
    if (kind === "camera") setCameraOn(enabled);
    if (kind === "share") setSharing(enabled);
  }

  async function releaseRoom() {
    const room = roomRef.current;
    roomRef.current = null;
    await room?.disconnect().catch(() => undefined);
  }

  async function exitTo(href: string) {
    if (session && session.state === "live" && !left) {
      await releaseRoom();
      await studyGroupRequest(`/api/study-groups/sessions/${sessionId}/leave`, { method: "POST", body: "{}" });
    }
    window.location.assign(href);
  }

  function path() {
    if (!session) return null;
    return (
      <nav className={styles.crumb} aria-label={roomCopy.crumbGroups}>
        <button type="button" onClick={() => void exitTo(`/${locale}/portal`)}>{roomCopy.crumbHome}</button>
        <span aria-hidden="true">/</span>
        <button type="button" onClick={() => void exitTo(`/${locale}/portal/study-groups`)}>{roomCopy.crumbGroups}</button>
        {group ? <><span aria-hidden="true">/</span><button type="button" onClick={() => void exitTo(`/${locale}/portal/study-groups?group=${group.id}`)}>{group.title}</button></> : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{session.title}</span>
      </nav>
    );
  }

  if (!session) return <p className={styles.panel} role="status">{errorCode ? copy.errors[errorCode as keyof typeof copy.errors] || copy.errors.error : copy.loading}</p>;
  if (session.state === "completed" || left) {
    const ended = session.state === "completed";
    return (
      <>
      {path()}
      <section className={styles.empty}>
        <h1>{ended ? roomCopy.endedTitle : roomCopy.youLeft}</h1>
        <p>{session.title}</p>
        {session.focus ? <p>{session.focus}</p> : null}
        <p>{group?.courseTitle}</p>
        <p>{fill(roomCopy.groupStudy, { count: plannedMinutes(session) })}</p>
        {ended ? <p>{roomCopy.endedBody}</p> : null}
        <a className={styles.primary} href={group ? `/${locale}/portal/courses/${group.courseSlug}` : `/${locale}/portal/study-groups`}>{roomCopy.returnToCourse}</a>
      </section>
      </>
    );
  }
  if (!seated && (errorCode === "session_full" || errorCode === "course_access_required")) {
    return <>{path()}<section className={styles.empty} role="alert"><h1>{errorCode === "session_full" ? copy.sessionFull : copy.errors.course_access_required}</h1><p>{session.title}</p>{errorCode === "course_access_required" && group ? <a className={styles.primary} href={`/${locale}/portal/courses/${group.courseSlug}`}>{copy.getCourseAccess}</a> : null}</section></>;
  }
  if ((session.state === "starting_soon" || session.state === "live") && !seated && !entryDone) {
    return <p className={styles.panel} role="status">{copy.loading}</p>;
  }
  if (session.state === "scheduled") {
    return <>{path()}<section className={styles.empty} role="status"><h1>{copy.errors.session_not_open}</h1><p>{session.title}</p>{session.focus ? <><h2>{copy.focus}</h2><p>{session.focus}</p></> : null}<p>{sessionScheduleLabel(locale, session)}</p><p>{fill(copy.plannedDuration, { count: plannedMinutes(session) })}</p><p>{copy.enterWindow}</p></section></>;
  }
  if (session.state !== "live") {
    return <>{path()}<section className={styles.empty} role="status"><h1>{copy.waiting}</h1><p>{session.title}</p>{session.focus ? <><h2>{copy.focus}</h2><p>{session.focus}</p></> : null}<p>{sessionScheduleLabel(locale, session)}</p><p>{fill(copy.plannedDuration, { count: plannedMinutes(session) })}</p><p>{fill(copy.currentlyInSession, { count: session.occupancy, max: session.maxParticipants })}</p>{group?.role === "host" ? <button className={styles.primary} type="button" onClick={() => { void studyGroupRequest(`/api/study-groups/sessions/${sessionId}/start`, { method: "POST", body: "{}" }).then((started) => { if (!started.ok) { setErrorCode(started.code); return; } return load(); }); }}>{copy.start}</button> : null}</section></>;
  }

  const controls = sessionControls({ role: group?.role || "member", state: "live", occupancy: session.occupancy, maxParticipants: session.maxParticipants });
  const present = connected && tiles.length > 0 ? tiles.length : session.occupancy;
  const roster = tiles.length
    ? tiles.map((tile) => ({
        key: tile.identity,
        name: tile.name,
        detail: [tile.host ? roomCopy.host : "", hands.includes(tile.identity) ? roomCopy.raiseHand : "", tileStatus(roomCopy, tile)].filter(Boolean).join(" · ")
      }))
    : session.attendees.map((person) => ({
        key: person.userId,
        name: person.displayName,
        detail: group?.members?.some((member) => member.userId === person.userId && member.role === "host") ? roomCopy.host : ""
      }));
  const errorText = errorCode ? copy.errors[errorCode as keyof typeof copy.errors] || copy.errors.error : "";

  async function publish(message: { type: string; text?: string; raised?: boolean }) {
    if (!roomApi) return;
    await roomApi.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });
  }

  return (
    <>
    {path()}
    <section className={styles.room}>
      <div className={styles.stage}>
        <h1>{session.title}</h1>
        <p className={styles.meta}>{group?.courseTitle} · {fill(roomCopy.liveClock, { time: clock })}</p>
        {session.focus ? <p>{session.focus}</p> : null}
        {errorText ? <p className={styles.alert} role="alert">{errorText} <button className={styles.textButton} type="button" onClick={() => { setErrorCode(""); setConnected(false); }}>{roomCopy.reconnect}</button></p> : null}
        <div ref={audioRoot} hidden />
        {shareTrack ? <video ref={shareVideo} className={styles.shareMain} autoPlay playsInline /> : null}
        <div className={styles.videos}>
          {tiles.length === 0 ? <div className={styles.tile}><span>{connected ? copy.loading : roomCopy.notConnected}</span></div> : tiles.map((tile) => (
            <div className={styles.tile} key={tile.identity}>
              <ParticipantCamera track={cameraTracks[tile.identity] ?? null} />
              <span>{tile.name}{tile.host ? ` · ${roomCopy.host}` : ""}{hands.includes(tile.identity) ? " · " + roomCopy.raiseHand : ""}{" · " + tileStatus(roomCopy, tile)}</span>
            </div>
          ))}
        </div>
        <div className={styles.controls}>
          {controls.includes("mic") ? <button type="button" aria-pressed={micOn} onClick={() => void setMedia("mic", !micOn).catch(() => setMicOn(false))}>{roomCopy.mic}</button> : null}
          {controls.includes("camera") ? <button type="button" aria-pressed={cameraOn} onClick={() => void setMedia("camera", !cameraOn).catch(() => setCameraOn(false))}>{roomCopy.camera}</button> : null}
          {controls.includes("share") ? <button type="button" aria-pressed={sharing} onClick={() => void setMedia("share", !sharing).catch(() => setSharing(false))}>{roomCopy.share}</button> : null}
          {controls.includes("participants") ? <p className={styles.participantCount} data-participants={present}><strong>{present}</strong> {roomCopy.participants}</p> : null}
          {controls.includes("raise-hand") ? <button type="button" aria-pressed={Boolean(roomApi?.localParticipant.identity && hands.includes(roomApi.localParticipant.identity))} onClick={() => { const identity = roomApi?.localParticipant.identity || ""; if (!identity) return; const raised = !hands.includes(identity); setHands((items) => raisedHands(items, identity, raised)); void publish({ type: "raise-hand", raised }); }}>{roomCopy.raiseHand}</button> : null}
          {controls.includes("leave") ? <button type="button" onClick={async () => { await releaseRoom(); await studyGroupRequest(`/api/study-groups/sessions/${sessionId}/leave`, { method: "POST", body: "{}" }); setLeft(true); await load(); }}>{roomCopy.leave}</button> : null}
        </div>
      </div>
      <aside className={styles.side} aria-label={roomCopy.participants}>
        <div>
          <h2>{roomCopy.participants} {present}/{session.maxParticipants}</h2>
          <ul className={styles.roster}>
            {roster.map((person) => <li key={person.key}><span className={styles.rosterInitial}>{person.name.slice(0, 1)}</span><strong>{person.name}</strong>{person.detail ? <span>{person.detail}</span> : null}</li>)}
          </ul>
        </div>
        <div className={styles.chatLog} aria-live="polite">
          <h3>{roomCopy.chat}</h3>
          {chat.map((line) => <p key={line.id}><strong>{line.from}</strong> <time dateTime={line.at}>{chatLabel(line.at)}</time> {line.text.startsWith(`${roomCopy.aiTutor} `) ? <><span className={styles.tutorMention}>{roomCopy.aiTutor}</span>{line.text.slice(roomCopy.aiTutor.length)}</> : line.text}</p>)}
          {!connected ? <p>{roomCopy.chatUnavailable}</p> : null}
        </div>
        <form className={styles.chatForm} onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text || !connected) return;
          const mention = addressTutor && session.aiTutorEnabled;
          const chatText = mention ? `${roomCopy.aiTutor} ${text}` : text;
          void publish({ type: "chat", text: chatText });
          setChat((items) => [...items, { id: `local-${items.length}`, from: roomCopy.you, text: chatText, at: chatStamp() }]);
          if (mention) {
            void studyGroupRequest(`/api/study-groups/sessions/${sessionId}/ai-tutor`, { method: "POST", body: JSON.stringify(tutorQueueBody(text)) }).then((queued) => {
              if (!queued.ok) setErrorCode(queued.code);
            });
          }
          setDraft("");
          setAddressTutor(false);
        }}>
          {session.aiTutorEnabled ? <button className={styles.tutorEntry} type="button" aria-pressed={addressTutor} onClick={() => setAddressTutor((on) => !on)}>{roomCopy.aiTutor}</button> : null}
          <label className={styles.meta}>{roomCopy.chat}<input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={roomCopy.chatPlaceholder} disabled={!connected} /></label>
          <button className={styles.primary} type="submit" disabled={!connected}>{roomCopy.send}</button>
        </form>
      </aside>
    </section>
    </>
  );
}
