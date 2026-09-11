import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  COURSE_ID,
  PASSWORD,
  SESSION_COOKIE,
  clearCookies,
  isolate,
  jsonRequest,
  setCookie,
  takeSetCookie,
  uniqueEmail
} from "./harness";

let restore: () => Promise<void>;
let me: typeof import("../../app/api/auth/me/route");
let register: typeof import("../../app/api/auth/register/route");
let login: typeof import("../../app/api/auth/login/route");
let verifyEmail: typeof import("../../app/api/auth/verify-email/route");
let resetRequest: typeof import("../../app/api/auth/password-reset/request/route");
let quote: typeof import("../../app/api/purchase/quote/route");

before(async () => {
  restore = (await isolate("lg-io-login-")).restore;
  me = await import("../../app/api/auth/me/route");
  register = await import("../../app/api/auth/register/route");
  login = await import("../../app/api/auth/login/route");
  verifyEmail = await import("../../app/api/auth/verify-email/route");
  resetRequest = await import("../../app/api/auth/password-reset/request/route");
  quote = await import("../../app/api/purchase/quote/route");
});

after(async () => {
  await restore();
});

async function registerSignedIn(label: string) {
  clearCookies();
  const email = uniqueEmail(label);
  const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: PASSWORD,
    nickname: "IO Learner",
    locale: "en-GB"
  }));
  takeSetCookie(response);
  return { email, response };
}

test("AUTH-01 smoke: /api/auth/me without a session does not invent a user", async () => {
  clearCookies();
  const response = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.user, null);
});

test("AUTH-01 negative: purchase quote without a session is rejected", async () => {
  clearCookies();
  const response = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
});

test("AUTH-01 functional: signed-in /api/auth/me returns only that user's email", async () => {
  const { email, response } = await registerSignedIn("auth01-me");
  assert.equal(response.status, 200);
  const mine = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
  const body = await mine.json();
  assert.equal(mine.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.user.email, email);
  assert.notEqual(body.user.email, "other@example.test");
});

test("AUTH-01 edge: a forged session cookie does not restore a user", async () => {
  clearCookies();
  setCookie(SESSION_COOKIE, "forged-session-token");
  const response = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.user, null);
  const gated = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  assert.equal(gated.status, 401);
});

test("AUTH-02 smoke: sign-in without credentials is 401", async () => {
  clearCookies();
  const response = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", {}));
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.code, "AUTHENTICATION_FAILED");
});

test("AUTH-02 functional: register then sign-in issues a session cookie", async () => {
  const { email } = await registerSignedIn("auth02-register");
  clearCookies();
  const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", {
    email,
    password: PASSWORD
  }));
  takeSetCookie(signedIn);
  const body = await signedIn.json();
  assert.equal(signedIn.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.user.email, email);
  const mine = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
  assert.equal((await mine.json()).user.email, email);
});

test("AUTH-02 negative: wrong password is 401 and does not set a session", async () => {
  const { email } = await registerSignedIn("auth02-wrong");
  clearCookies();
  const response = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", {
    email,
    password: "not-the-password"
  }));
  takeSetCookie(response);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.code, "AUTHENTICATION_FAILED");
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-02 edge: verify-email without a token is 400", async () => {
  const response = await verifyEmail.POST(jsonRequest("POST", "http://localhost/api/auth/verify-email", {}));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.code, "VERIFICATION_TOKEN_REQUIRED");
});

test("AUTH-02 negative: verification required without mail delivery is 503", async () => {
  process.env.EMAIL_VERIFICATION_REQUIRED = "1";
  try {
    const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email: uniqueEmail("auth02-verify"),
      password: PASSWORD,
      locale: "en-GB"
    }));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, "EMAIL_DELIVERY_NOT_CONFIGURED");
  } finally {
    process.env.EMAIL_VERIFICATION_REQUIRED = "0";
  }
});

test("AUTH-02 edge: password-reset does not reveal whether the email exists", async () => {
  const known = await registerSignedIn("auth02-reset");
  clearCookies();
  const existing = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email: known.email,
    locale: "en-GB"
  }));
  const unknown = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email: uniqueEmail("auth02-missing"),
    locale: "en-GB"
  }));
  const existingBody = await existing.json();
  const unknownBody = await unknown.json();
  assert.equal(existing.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(existingBody.ok, true);
  assert.equal(unknownBody.ok, true);
});

test("AUTH-01 negative: another user's session cannot see this inbox course gate as entitled by default", async () => {
  await registerSignedIn("auth01-entitlement");
  const entitlements = await import("../../app/api/entitlements/check/route");
  const response = await entitlements.GET(jsonRequest("GET", `http://localhost/api/entitlements/check?courseId=${COURSE_ID}`));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.entitlement.allowed, false);
});
