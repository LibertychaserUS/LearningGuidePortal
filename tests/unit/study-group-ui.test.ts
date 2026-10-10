import assert from "node:assert/strict";
import { test } from "node:test";
import { participantStatus, sessionControls, studyGroupPane } from "../../modules/group-study/uiState";
import { readFileSync } from "node:fs";
import en from "../../messages/en-GB.json";
import zh from "../../messages/zh-CN.json";
import { DURATION_MINUTE_CHOICES, fill, hostMayOpenRoom, SESSION_TITLE_MAX, sessionTitleCount, tutorQueueBody } from "../../components/portal/studyGroupClient";

test("schedule duration is a required dropdown of 30, 45, 60, and 90 minutes", () => {
  assert.deepEqual([...DURATION_MINUTE_CHOICES], [30, 45, 60, 90]);
  assert.equal(en.studyGroupsPage.duration, "Duration");
  assert.equal(zh.studyGroupsPage.duration, "时长");
  assert.deepEqual(DURATION_MINUTE_CHOICES.map((minutes) => fill(en.studyGroupsPage.plannedDuration, { count: minutes })), ["30 mins", "45 mins", "60 mins", "90 mins"]);
  assert.deepEqual(DURATION_MINUTE_CHOICES.map((minutes) => fill(zh.studyGroupsPage.plannedDuration, { count: minutes })), ["30 分钟", "45 分钟", "60 分钟", "90 分钟"]);
  const source = readFileSync(new URL("../../components/portal/StudyGroupsApp.tsx", import.meta.url), "utf8");
  assert.match(source, /select name="durationMinutes" required/);
  assert.match(source, /DURATION_MINUTE_CHOICES\.map/);
  assert.equal(source.includes("durationSeconds"), false);
  assert.equal(source.includes('type="number"'), false);
});

test("the chat control queues the user's text and does not carry a system prompt or an answer", () => {
  assert.deepEqual(tutorQueueBody("Why did 1928 look stable?"), { message: "Why did 1928 look stable?" });
  assert.equal("prompt" in tutorQueueBody("Why did 1928 look stable?"), false);
  const room = readFileSync(new URL("../../components/portal/StudySessionRoom.tsx", import.meta.url), "utf8");
  assert.match(room, /tutorQueueBody\(text\)/);
  assert.match(room, /session\.aiTutorEnabled \?/);
  assert.equal(room.includes("/api/ai-tutor"), false);
  assert.equal(room.includes("prompts/"), false);
  assert.equal(room.includes("You are"), false);
  assert.equal(room.includes("queued.data"), false);
});

test("host start opens the room only after entry succeeds", () => {
  assert.equal(hostMayOpenRoom(true, true), true);
  assert.equal(hostMayOpenRoom(true, false), false);
  assert.equal(hostMayOpenRoom(false, false), false);
  const page = readFileSync(new URL("../../components/portal/StudyGroupsApp.tsx", import.meta.url), "utf8");
  assert.match(page, /copy\.createdTitle/);
  assert.match(page, /copy\.openGroup/);
  assert.match(page, /copy\.editSession/);
  assert.match(page, /\/enter/);
  const css = readFileSync(new URL("../../components/portal/study-groups.module.css", import.meta.url), "utf8");
  assert.match(css, /\.memberList[\s\S]*overflow-y: auto/);
  assert.match(css, /\.shareMain/);
});

test("session title counter matches the 20 character Figma limit", () => {
  assert.equal(SESSION_TITLE_MAX, 20);
  assert.equal(sessionTitleCount(""), "0/20");
  assert.equal(sessionTitleCount("1234567"), "7/20");
  assert.equal(sessionTitleCount("x".repeat(20)), "20/20");
  assert.equal(sessionTitleCount("x".repeat(21)), "20/20");
});

test("study group pane shows empty, error, and a selected group without inventing sessions for a visitor", () => {
  assert.equal(studyGroupPane({ status: "loading", selected: null }).kind, "loading");
  assert.equal(studyGroupPane({ status: "error", selected: null }).kind, "error");
  assert.equal(studyGroupPane({ status: "ready", selected: null }).kind, "empty");
  assert.equal(studyGroupPane({ status: "ready", selected: { role: null, sessions: null } }).kind, "join-gate");
  assert.equal(studyGroupPane({ status: "ready", selected: { role: "member", sessions: [] } }).kind, "sessions");
});

test("Join Study Group is the join label and Hosting is only for the Host", () => {
  assert.equal(en.studyGroupsPage.joinGroup, "Join Study Group");
  assert.equal(zh.studyGroupsPage.joinGroup, "加入学习小组");
  const source = readFileSync(new URL("../../components/portal/StudyGroupsApp.tsx", import.meta.url), "utf8");
  assert.match(source, /\{copy\.joinGroup\}/);
  assert.match(source, /selected\.role === "host" \? <span className=\{styles\.hostChip\}>\{copy\.hosting\}<\/span> : null/);
  assert.match(source, /selected\.role === "host" \? <div className=\{styles\.hostFoot\}>/);
  assert.equal(source.includes("{copy.hosting}</span> : null"), true);
});

test("in-room controls stay the same for host and participant, and a full session disables entry", () => {
  assert.deepEqual(sessionControls({ role: "host", state: "live", occupancy: 2, maxParticipants: 6 }), ["mic", "camera", "share", "participants", "raise-hand", "leave"]);
  assert.deepEqual(sessionControls({ role: "member", state: "live", occupancy: 2, maxParticipants: 6 }), ["mic", "camera", "share", "participants", "raise-hand", "leave"]);
  assert.equal(sessionControls({ role: "member", state: "starting_soon", occupancy: 6, maxParticipants: 6 }).includes("join"), false);
  assert.equal(sessionControls({ role: "host", state: "starting_soon", occupancy: 1, maxParticipants: 6 }).includes("start"), true);
  assert.equal(sessionControls({ role: "member", state: "starting_soon", occupancy: 1, maxParticipants: 6 }).includes("join"), true);
  assert.equal(sessionControls({ role: "member", state: "scheduled", occupancy: 0, maxParticipants: 6 }).includes("plan"), true);
});

test("a live tile says who is speaking, who has a microphone, and who is muted", () => {
  assert.equal(participantStatus({ mic: false, speaking: true }), "muted");
  assert.equal(participantStatus({ mic: true, speaking: true }), "speaking");
  assert.equal(participantStatus({ mic: true, speaking: false }), "mic-on");
  assert.equal(en.studyGroupsPage.room.muted, "Muted");
  assert.equal(en.studyGroupsPage.room.speaking, "Speaking");
  assert.equal(en.studyGroupsPage.room.micOn, "Mic on");
  assert.equal(zh.studyGroupsPage.room.muted, "已静音");
  assert.equal(zh.studyGroupsPage.room.speaking, "正在发言");
  const room = readFileSync(new URL("../../components/portal/StudySessionRoom.tsx", import.meta.url), "utf8");
  assert.match(room, /styles\.roster/);
  assert.match(room, /ActiveSpeakersChanged/);
  assert.match(room, /person\.isSpeaking/);
  assert.match(room, /triesLeft > 0/);
  assert.match(room, /releaseRoom\(\)/);
  assert.match(room, /room\?\.disconnect\(\)/);
  assert.equal(en.studyGroupsPage.errors.connect_failed, "The Live Session could not connect. Check the connection and try again.");
  assert.equal(zh.studyGroupsPage.errors.connect_failed, "直播课无法连接。请检查连接后重试。");
});

test("the ended screen and live clock follow the Live Session frames", () => {
  assert.equal(en.studyGroupsPage.room.endedBody, "The Session has ended. You can return to the lesson and continue learning.");
  assert.equal(fill(en.studyGroupsPage.room.groupStudy, { count: 45 }), "45-minute Group Study");
  assert.equal(fill(en.studyGroupsPage.room.liveClock, { time: "32:18" }), "● Live 32:18");
  assert.equal(fill(zh.studyGroupsPage.room.groupStudy, { count: 45 }), "45 分钟学习小组");
  assert.equal(fill(zh.studyGroupsPage.room.liveClock, { time: "32:18" }), "● 直播中 32:18");
  const room = readFileSync(new URL("../../components/portal/StudySessionRoom.tsx", import.meta.url), "utf8");
  assert.match(room, /elapsedClock\(session\.startedAt\)/);
  assert.match(room, /roomCopy\.groupStudy/);
  assert.match(room, /roomCopy\.liveClock/);
  assert.match(room, /roomCopy\.crumbHome/);
  assert.match(room, /study-groups\?group=/);
  assert.equal(en.studyGroupsPage.room.crumbHome, "Home");
  assert.equal(zh.studyGroupsPage.room.crumbGroups, "学习小组");
  const app = readFileSync(new URL("../../components/portal/StudyGroupsApp.tsx", import.meta.url), "utf8");
  assert.match(app, /URLSearchParams\(window\.location\.search\)\.get\("group"\)/);
});
