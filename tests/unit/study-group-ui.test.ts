import assert from "node:assert/strict";
import { test } from "node:test";
import { sessionControls, studyGroupPane } from "../../modules/group-study/uiState";

test("study group pane shows empty, error, and a selected group without inventing sessions for a visitor", () => {
  assert.equal(studyGroupPane({ status: "loading", selected: null }).kind, "loading");
  assert.equal(studyGroupPane({ status: "error", selected: null }).kind, "error");
  assert.equal(studyGroupPane({ status: "ready", selected: null }).kind, "empty");
  assert.equal(studyGroupPane({ status: "ready", selected: { role: null, sessions: null } }).kind, "join-gate");
  assert.equal(studyGroupPane({ status: "ready", selected: { role: "member", sessions: [] } }).kind, "sessions");
});

test("in-room controls stay the same for host and participant, and a full session disables entry", () => {
  assert.deepEqual(sessionControls({ role: "host", state: "live", occupancy: 2, maxParticipants: 6 }), ["mic", "camera", "share", "participants", "raise-hand", "leave"]);
  assert.deepEqual(sessionControls({ role: "member", state: "live", occupancy: 2, maxParticipants: 6 }), ["mic", "camera", "share", "participants", "raise-hand", "leave"]);
  assert.equal(sessionControls({ role: "member", state: "starting_soon", occupancy: 6, maxParticipants: 6 }).includes("join"), false);
  assert.equal(sessionControls({ role: "host", state: "starting_soon", occupancy: 1, maxParticipants: 6 }).includes("start"), true);
  assert.equal(sessionControls({ role: "member", state: "starting_soon", occupancy: 1, maxParticipants: 6 }).includes("join"), true);
  assert.equal(sessionControls({ role: "member", state: "scheduled", occupancy: 0, maxParticipants: 6 }).includes("plan"), true);
});
