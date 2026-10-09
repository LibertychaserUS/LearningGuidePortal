import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SESSION_COOKIE } from "../../services/productAuth";

const cwd = process.cwd();
const env = { ...process.env };
let directory = "";
let token = "";
let strangerToken = "";
type Route = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
let postGroup: Route;
let getGroups: Route;
let postJoin: Route;
let postSession: Route;
let postEnter: Route;
let postToken: Route;

function call(handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>, url: string, body?: unknown, cookie?: string, params?: Record<string, string>, method = body === undefined ? "GET" : "POST") {
  return handler(new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie: cookie ? `${SESSION_COOKIE}=${cookie}` : "" },
    body: body === undefined ? undefined : JSON.stringify(body)
  }), { params: Promise.resolve(params || {}) });
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "lg-study-group-api-"));
  process.chdir(directory);
  process.env.APP_ENV = "DEV";
  process.env.STORAGE_BACKEND = "local";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  process.env.LIVEKIT_API_KEY = "lk-key";
  process.env.LIVEKIT_API_SECRET = "lk-secret-at-least-32-characters";
  process.env.LIVEKIT_URL = "wss://livekit.example.test";
  process.env.STUDY_GROUP_TOKEN_LOG_KEY = Buffer.alloc(32, 9).toString("base64");
  const store = await import("../../services/productStore");
  const files = await import("../../services/fileStore");
  const data = await store.ensureProductData();
  const now = new Date().toISOString();
  const later = new Date(Date.now() + 86_400_000).toISOString();
  data.users.push(
    { id: "api-host", email: "host@example.test", passwordHash: null, nickname: "Anna", locale: "en-GB", status: "active", emailVerifiedAt: now, createdAt: now, role: "student" },
    { id: "api-stranger", email: "stranger@example.test", passwordHash: null, nickname: "Sam", locale: "en-GB", status: "active", emailVerifiedAt: now, createdAt: now, role: "student" }
  );
  data.courses.push({ id: "api-course", slug: "german-history", title: "German History", description: "Course", status: "published", sections: [], createdAt: now, updatedAt: now });
  data.entitlements.push({ id: "api-access", userId: "api-host", courseId: "api-course", state: "active", source: "purchase", validTo: later, scope: "course", scopeId: "api-course", device: "pc" });
  await files.atomicWriteJson(path.join(files.systemRoot(), "learning_guide", "product.json"), data);
  token = (await store.createSession("api-host")).token;
  strangerToken = (await store.createSession("api-stranger")).token;
  postGroup = (await import("../../app/api/study-groups/route")).POST as unknown as Route;
  getGroups = (await import("../../app/api/study-groups/route")).GET as unknown as Route;
  postJoin = (await import("../../app/api/study-groups/[groupId]/join/route")).POST as unknown as Route;
  postSession = (await import("../../app/api/study-groups/[groupId]/sessions/route")).POST as unknown as Route;
  postEnter = (await import("../../app/api/study-groups/sessions/[sessionId]/enter/route")).POST as unknown as Route;
  postToken = (await import("../../app/api/study-groups/sessions/[sessionId]/token/route")).POST as unknown as Route;
});

after(async () => {
  process.chdir(cwd);
  process.env = env;
  await rm(directory, { recursive: true, force: true });
});

test("study group API requires a session, hides sessions until join, and does not store the LiveKit token", async () => {
  const anonymous = await call(postGroup, "http://localhost/api/study-groups", { title: "Group", courseId: "api-course", about: "About" });
  assert.equal(anonymous.status, 401);
  assert.equal((await anonymous.json()).code, "unauthenticated");

  const missing = await call(postGroup, "http://localhost/api/study-groups", { title: "", courseId: "api-course", about: "About" }, token);
  assert.equal(missing.status, 400);

  const denied = await call(postGroup, "http://localhost/api/study-groups", { title: "Nope", courseId: "api-course", about: "About" }, strangerToken);
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "course_access_required");

  const created = await call(postGroup, "http://localhost/api/study-groups", { title: "Weimar", courseId: "api-course", about: "About the group." }, token);
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.data.role, "host");
  const groupId = createdBody.data.id as string;

  const discovered = await call(getGroups, "http://localhost/api/study-groups?view=discover", undefined, strangerToken);
  assert.equal(discovered.status, 200);
  assert.equal((await discovered.json()).data.some((item: { id: string }) => item.id === groupId), true);

  const joined = await call(postJoin, `http://localhost/api/study-groups/${groupId}/join`, {}, strangerToken, { groupId });
  assert.equal(joined.status, 403);

  const startsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const scheduled = await call(postSession, `http://localhost/api/study-groups/${groupId}/sessions`, {
    title: "Session",
    startsAt,
    durationMinutes: 30,
    maxParticipants: 2
  }, token, { groupId });
  assert.equal(scheduled.status, 200);
  const sessionId = (await scheduled.json()).data.id as string;
  const entered = await call(postEnter, `http://localhost/api/study-groups/sessions/${sessionId}/enter`, {}, token, { sessionId });
  assert.equal(entered.status, 200);
  const issued = await call(postToken, `http://localhost/api/study-groups/sessions/${sessionId}/token`, {}, token, { sessionId });
  assert.equal(issued.status, 200);
  const issuedBody = await issued.json();
  const storeFile = await readFile(path.join(directory, "data", "knowledge_system", "learning_guide", "study-group", "study-group.json"), "utf8");
  assert.equal(storeFile.includes(issuedBody.data.token), false);
  assert.equal(storeFile.includes("lk-secret-at-least-32-characters"), false);
  const wrong = await call(postToken, "http://localhost/api/study-groups/sessions/missing/token", {}, token, { sessionId: "missing" });
  assert.equal(wrong.status, 404);

  const startsLater = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const title = "12345678901234567890";
  const accepted = await call(postSession, `http://localhost/api/study-groups/${groupId}/sessions`, {
    title,
    startsAt: startsLater,
    durationMinutes: 25,
    maxParticipants: 4
  }, token, { groupId });
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.data.title, title);
  assert.equal(acceptedBody.data.durationMinutes, 25);
  const tooLong = await call(postSession, `http://localhost/api/study-groups/${groupId}/sessions`, {
    title: `${title}x`,
    startsAt: startsLater,
    durationMinutes: 25,
    maxParticipants: 4
  }, token, { groupId });
  assert.equal(tooLong.status, 400);
  assert.equal((await tooLong.json()).code, "validation");
  const missingDuration = await call(postSession, `http://localhost/api/study-groups/${groupId}/sessions`, {
    title: "No duration",
    startsAt: startsLater,
    maxParticipants: 4
  }, token, { groupId });
  assert.equal(missingDuration.status, 400);
  assert.equal((await missingDuration.json()).code, "validation");
});
