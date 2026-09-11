import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  COURSE_ID,
  COURSE_PLAN,
  PASSWORD,
  TRIAL_MS,
  callRoute,
  clearCookies,
  isolate,
  jsonRequest,
  takeSetCookie,
  uniqueEmail
} from "./harness";
import { PRIVATE_LP } from "../unit/helpers/my-learning";

const CONSENTS = { renewal: true, terms: true, refund: true };

let restore: () => Promise<void>;
let register: typeof import("../../app/api/auth/register/route");
let quote: typeof import("../../app/api/purchase/quote/route");
let confirm: typeof import("../../app/api/purchase/demo/confirm/route");
let trial: typeof import("../../app/api/trial/route");
let subscription: typeof import("../../app/api/subscription/route");
let entitlements: typeof import("../../app/api/entitlements/check/route");
let study: typeof import("../../app/api/study/events/route");

before(async () => {
  restore = (await isolate("lg-io-visitor-trial-")).restore;
  register = await import("../../app/api/auth/register/route");
  quote = await import("../../app/api/purchase/quote/route");
  confirm = await import("../../app/api/purchase/demo/confirm/route");
  trial = await import("../../app/api/trial/route");
  subscription = await import("../../app/api/subscription/route");
  entitlements = await import("../../app/api/entitlements/check/route");
  study = await import("../../app/api/study/events/route");
});

after(async () => {
  await restore();
});

async function signIn(label: string) {
  clearCookies();
  const email = uniqueEmail(label);
  const response = await callRoute(register.POST, jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: PASSWORD,
    nickname: "IO Visitor",
    locale: "en-GB"
  }));
  takeSetCookie(response);
  assert.equal(response.status, 200);
  return email;
}

async function entitlementAllowed() {
  const response = await callRoute(
    entitlements.GET,
    jsonRequest("GET", `http://localhost/api/entitlements/check?courseId=${COURSE_ID}`)
  );
  const body = await response.json();
  return {
    status: response.status,
    allowed: Boolean(body.entitlement?.allowed),
    source: body.entitlement?.source as string | undefined,
    validTo: body.entitlement?.validTo as string | undefined
  };
}

async function startTrial() {
  const quoted = await callRoute(quote.POST, jsonRequest("POST", "http://localhost/api/purchase/quote", {
    planId: COURSE_PLAN,
    kind: "trial"
  }));
  assert.equal(quoted.status, 200);
  const quoteId = (await quoted.json()).quote.id as string;
  const pending = await callRoute(trial.POST, jsonRequest("POST", "http://localhost/api/trial", {
    quoteId,
    locale: "en-GB",
    consents: CONSENTS
  }));
  const body = await pending.json();
  return { pending, body, orderId: body.order?.id as string | undefined };
}

async function completeTrial(orderId: string) {
  return callRoute(confirm.POST, jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", {
    orderId,
    action: "complete"
  }));
}

async function currentTrialSubscription() {
  const listed = await callRoute(subscription.GET, jsonRequest("GET", "http://localhost/api/subscription"));
  const rows = (await listed.json()).subscriptions as Array<{ id?: string; source?: string; state?: string; validTo?: string }>;
  return rows.find((item) => item.source === "trial");
}

async function postLockedStudy() {
  return callRoute(study.POST, jsonRequest("POST", "http://localhost/api/study/events", {
    courseId: COURSE_ID,
    lessonId: PRIVATE_LP,
    event: "open",
    seconds: 0,
    clientEventId: `trial-io-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }));
}

test("PAY-01 functional: trial quote + /api/trial + demo complete grants visitor access inside three days", async () => {
  await signIn("vt-complete");
  const before = Date.now();
  const started = await startTrial();
  assert.equal(started.pending.status, 200);
  const paid = await completeTrial(started.orderId as string);
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).status, "paid");
  const access = await entitlementAllowed();
  assert.equal(access.status, 200);
  assert.equal(access.allowed, true);
  assert.equal(access.source, "trial");
  const validTo = Date.parse(access.validTo || "");
  assert.ok(Number.isFinite(validTo));
  assert.ok(validTo <= before + TRIAL_MS + 60_000);
});

test("PAY-01 negative: cancelling a demo trial never grants the course", async () => {
  await signIn("vt-cancel-confirm");
  const started = await startTrial();
  const cancelled = await callRoute(confirm.POST, jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", {
    orderId: started.orderId,
    action: "cancel"
  }));
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).status, "canceled");
  assert.equal((await entitlementAllowed()).allowed, false);
  const blocked = await postLockedStudy();
  assert.equal(blocked.status, 403);
});

test("PAY-10 negative: cancelled trial stays false and a second complete does not grant", async () => {
  await signIn("vt-no-revive");
  const started = await startTrial();
  await completeTrial(started.orderId as string);
  const current = await currentTrialSubscription();
  assert.ok(current?.id);
  const cancelled = await callRoute(subscription.POST, jsonRequest("POST", "http://localhost/api/subscription", {
    subscriptionId: current.id,
    action: "cancel",
    reasonCode: "other"
  }));
  assert.equal(cancelled.status, 200);
  assert.equal((await entitlementAllowed()).allowed, false);
  const blocked = await postLockedStudy();
  assert.equal(blocked.status, 403);
  const again = await completeTrial(started.orderId as string);
  assert.equal(again.status, 400);
  assert.equal((await entitlementAllowed()).allowed, false);
});

test("PAY-01 edge: resume of trial_canceled restores access without extending validTo", async () => {
  await signIn("vt-restore");
  const started = await startTrial();
  await completeTrial(started.orderId as string);
  const before = await entitlementAllowed();
  assert.equal(before.allowed, true);
  const originalValidTo = before.validTo;
  assert.ok(originalValidTo);
  const current = await currentTrialSubscription();
  assert.ok(current?.id);
  const cancelled = await callRoute(subscription.POST, jsonRequest("POST", "http://localhost/api/subscription", {
    subscriptionId: current.id,
    action: "cancel",
    reasonCode: "other"
  }));
  assert.equal(cancelled.status, 200);
  assert.equal((await entitlementAllowed()).allowed, false);

  const resumed = await callRoute(subscription.POST, jsonRequest("POST", "http://localhost/api/subscription", {
    subscriptionId: current.id,
    action: "resume"
  }));
  assert.equal(resumed.status, 200);
  const restored = await entitlementAllowed();
  assert.equal(restored.allowed, true);
  assert.equal(restored.validTo, originalValidTo);
  assert.ok(Date.parse(restored.validTo || "") <= Date.parse(originalValidTo) + 1000);
});
