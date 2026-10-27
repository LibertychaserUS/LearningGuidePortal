import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { plainTutorReply } from "../../modules/group-study/tutorReplyText";

// QA 2026-10-19 M22, again after the Tutor moved to KnowledgeSystem
// (2026-10-23): the room shows plain text, so KS markdown is dropped while
// identifiers keep their marks.
test("a KS answer loses its markdown but keeps x_1, snake_case_name and 2*3*4", () => {
  assert.equal(plainTutorReply("Use x_1 and snake_case_name; 2*3*4 = 24 is the **key** point."), "Use x_1 and snake_case_name; 2*3*4 = 24 is the key point.");
  assert.equal(plainTutorReply("## Summary\n- *pleasure* is `ataraxia`\n---\n* __friends__ matter"), "Summary\n• pleasure is ataraxia\n• friends matter");
  assert.equal(plainTutorReply("这是**重点**内容"), "这是重点内容");
  assert.equal(plainTutorReply("Plain answer."), "Plain answer.");
});

test("the room shows the Tutor line through the plain-text pass; the server stays verbatim", () => {
  const room = readFileSync(new URL("../../components/portal/StudySessionRoom.tsx", import.meta.url), "utf8");
  assert.match(room, /plainTutorReply\(line\.text\)\.split\("\\n"\)/);
});
