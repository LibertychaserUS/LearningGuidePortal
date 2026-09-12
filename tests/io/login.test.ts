import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  COURSE_ID,
  PASSWORD,
  SESSION_COOKIE,
  clearCookies,
  getCookie,
  callRoute,
  isolate,
  jsonRequest,
  publicShape,
  setCookie,
  takeSetCookie,
  uniqueEmail,
  runProductLockWorker
} from "./harness";

let restore: () => Promise<void>;
let me: typeof import("../../app/api/auth/me/route");
let register: typeof import("../../app/api/auth/register/route");
let login: typeof import("../../app/api/auth/login/route");
let checkEmail: typeof import("../../app/api/auth/check-email/route");
let resend: typeof import("../../app/api/auth/resend-verification/route");
let resetRequest: typeof import("../../app/api/auth/password-reset/request/route");
let resetConfirm: typeof import("../../app/api/auth/password-reset/confirm/route");
let verifyEmail: typeof import("../../app/api/auth/verify-email/route");
let logout: typeof import("../../app/api/auth/logout/route");
let google: typeof import("../../app/api/auth/google/route");
let wechat: typeof import("../../app/api/auth/wechat/route");
let profile: typeof import("../../app/api/me/profile/route");
let backoffice: typeof import("../../app/api/backoffice/courses/route");
let backofficeOrders: typeof import("../../app/api/backoffice/orders/route");
let backofficePayment: typeof import("../../app/api/backoffice/payment/route");
let quote: typeof import("../../app/api/purchase/quote/route");
let checkout: typeof import("../../app/api/purchase/checkout/route");
let confirm: typeof import("../../app/api/purchase/demo/confirm/route");
let trial: typeof import("../../app/api/trial/route");
let subscription: typeof import("../../app/api/subscription/route");
let subscriptionQuote: typeof import("../../app/api/subscription/quote/route");
let billingPortal: typeof import("../../app/api/subscription/portal/route");
let entitlements: typeof import("../../app/api/entitlements/check/route");
let overview: typeof import("../../app/api/my-learning/route");
let settings: typeof import("../../app/api/my-learning/settings/route");
let notifications: typeof import("../../app/api/my-learning/notifications/route");
let avatar: typeof import("../../app/api/my-learning/avatar/route");
let study: typeof import("../../app/api/study/events/route");
let preview: typeof import("../../app/api/study/preview/route");
let tutor: typeof import("../../app/api/ai-tutor/route");

before(async () => {
  restore = (await isolate("lg-io-login-")).restore;
  me = await import("../../app/api/auth/me/route");
  register = await import("../../app/api/auth/register/route");
  login = await import("../../app/api/auth/login/route");
  checkEmail = await import("../../app/api/auth/check-email/route");
  resend = await import("../../app/api/auth/resend-verification/route");
  resetRequest = await import("../../app/api/auth/password-reset/request/route");
  resetConfirm = await import("../../app/api/auth/password-reset/confirm/route");
  verifyEmail = await import("../../app/api/auth/verify-email/route");
  logout = await import("../../app/api/auth/logout/route");
  google = await import("../../app/api/auth/google/route");
  wechat = await import("../../app/api/auth/wechat/route");
  profile = await import("../../app/api/me/profile/route");
  backoffice = await import("../../app/api/backoffice/courses/route");
  backofficeOrders = await import("../../app/api/backoffice/orders/route");
  backofficePayment = await import("../../app/api/backoffice/payment/route");
  quote = await import("../../app/api/purchase/quote/route");
  checkout = await import("../../app/api/purchase/checkout/route");
  confirm = await import("../../app/api/purchase/demo/confirm/route");
  trial = await import("../../app/api/trial/route");
  subscription = await import("../../app/api/subscription/route");
  subscriptionQuote = await import("../../app/api/subscription/quote/route");
  billingPortal = await import("../../app/api/subscription/portal/route");
  entitlements = await import("../../app/api/entitlements/check/route");
  overview = await import("../../app/api/my-learning/route");
  settings = await import("../../app/api/my-learning/settings/route");
  notifications = await import("../../app/api/my-learning/notifications/route");
  avatar = await import("../../app/api/my-learning/avatar/route");
  study = await import("../../app/api/study/events/route");
  preview = await import("../../app/api/study/preview/route");
  tutor = await import("../../app/api/ai-tutor/route");
});

after(async () => {
  await restore();
});

async function registerAccount(label: string, password = PASSWORD) {
  clearCookies();
  const email = uniqueEmail(label);
  const response = await callRoute(register.POST, jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password,
    nickname: "IO Learner",
    locale: "en-GB"
  }));
  takeSetCookie(response);
  return { email, response };
}

async function registerPending(label: string, password = PASSWORD) {
  const previousVerification = process.env.EMAIL_VERIFICATION_REQUIRED;
  const previousDelivery = process.env.EMAIL_DELIVERY;
  process.env.EMAIL_VERIFICATION_REQUIRED = "1";
  process.env.EMAIL_DELIVERY = "discard";
  try {
    return await registerAccount(label, password);
  } finally {
    process.env.EMAIL_VERIFICATION_REQUIRED = previousVerification;
    process.env.EMAIL_DELIVERY = previousDelivery;
  }
}

test("AUTH-01 functional: check-email does not distinguish a known address from an unknown one", async () => {
  const { email } = await registerAccount("auth01-check");
  clearCookies();
  const known = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email }));
  const unknown = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email: uniqueEmail("auth01-unknown") }));
  const knownBody = await known.json() as Record<string, unknown>;
  const unknownBody = await unknown.json() as Record<string, unknown>;
  assert.equal(known.status, unknown.status);
  assert.equal("exists" in knownBody, false);
  assert.equal("exists" in unknownBody, false);
  assert.deepEqual(publicShape(knownBody), publicShape(unknownBody));
});

test("AUTH-01 negative: register copy does not say the address already exists", async () => {
  const email = uniqueEmail("auth01-register");
  const first = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: PASSWORD,
    nickname: "IO Learner",
    locale: "en-GB"
  }));
  const second = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: "attacker9",
    nickname: "Other Name",
    locale: "en-GB"
  }));
  const firstBody = await first.json() as Record<string, unknown>;
  const secondBody = await second.json() as Record<string, unknown>;
  assert.equal(first.status, second.status);
  assert.equal(firstBody.ok, secondBody.ok);
  assert.equal(JSON.stringify(secondBody).toLowerCase().includes("already exists"), false);
});

test("AUTH-01 negative: login does not 403 only for a pending address", async () => {
  const { email } = await registerPending("auth01-pending-login");
  clearCookies();
  const pending = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  const missing = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", {
    email: uniqueEmail("auth01-login-missing"),
    password: PASSWORD
  }));
  const pendingBody = await pending.json() as Record<string, unknown>;
  const missingBody = await missing.json() as Record<string, unknown>;
  assert.equal(pending.status, missing.status);
  assert.notEqual(pending.status, 403);
  assert.equal(pendingBody.code, missingBody.code);
  assert.deepEqual(publicShape(pendingBody), publicShape(missingBody));
});

test("AUTH-01 depth: active, pending, and unknown check-email share one public shape", async () => {
  const { email: active } = await registerAccount("auth01-depth-active");
  const { email: pending } = await registerPending("auth01-depth-pending");
  clearCookies();
  const activeBody = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email: active })).then((item) => item.json()) as Record<string, unknown>;
  const pendingBody = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email: pending })).then((item) => item.json()) as Record<string, unknown>;
  const unknownBody = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email: uniqueEmail("auth01-depth-unknown") })).then((item) => item.json()) as Record<string, unknown>;
  assert.equal("exists" in activeBody, false);
  assert.deepEqual(publicShape(activeBody), publicShape(pendingBody));
  assert.deepEqual(publicShape(pendingBody), publicShape(unknownBody));
});

test("AUTH-01 depth: check-email after a failed login still has no exists field", async () => {
  const { email } = await registerAccount("auth01-depth-after-login");
  clearCookies();
  await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "wrong-pass" }));
  const known = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email }));
  const unknown = await checkEmail.POST(jsonRequest("POST", "http://localhost/api/auth/check-email", { email: uniqueEmail("auth01-depth-after-unknown") }));
  const knownBody = await known.json() as Record<string, unknown>;
  const unknownBody = await unknown.json() as Record<string, unknown>;
  assert.equal("exists" in knownBody, false);
  assert.deepEqual(publicShape(knownBody), publicShape(unknownBody));
});

test("AUTH-01 depth: a second pending register does not say the address already exists", async () => {
  const { email } = await registerPending("auth01-depth-pending-copy");
  const second = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: "attacker9",
    nickname: "Other Name",
    locale: "en-GB"
  }));
  const body = await second.json() as Record<string, unknown>;
  assert.equal(second.status, 200);
  assert.equal(JSON.stringify(body).toLowerCase().includes("already exists"), false);
});

test("AUTH-01 edge: resend-verification does not 429 only for a pending address", async () => {
  const { email } = await registerPending("auth01-resend");
  process.env.EMAIL_DELIVERY = "discard";
  try {
    const pending = await resend.POST(jsonRequest("POST", "http://localhost/api/auth/resend-verification", { email, locale: "en-GB" }));
    const missing = await resend.POST(jsonRequest("POST", "http://localhost/api/auth/resend-verification", {
      email: uniqueEmail("auth01-resend-missing"),
      locale: "en-GB"
    }));
    const again = await resend.POST(jsonRequest("POST", "http://localhost/api/auth/resend-verification", { email, locale: "en-GB" }));
    const pendingBody = await pending.json() as Record<string, unknown>;
    const missingBody = await missing.json() as Record<string, unknown>;
    const againBody = await again.json() as Record<string, unknown>;
    assert.equal(pending.status, missing.status);
    assert.equal(again.status, missing.status);
    assert.notEqual(pending.status, 429);
    assert.deepEqual(publicShape(pendingBody), publicShape(missingBody));
    assert.deepEqual(publicShape(againBody), publicShape(missingBody));
  } finally {
    process.env.EMAIL_DELIVERY = "";
  }
});

test("AUTH-02 functional: password-reset JSON has no resetUrl or token", async () => {
  const { email } = await registerAccount("auth02-reset");
  clearCookies();
  const response = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email,
    locale: "en-GB"
  }));
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.resetUrl, undefined);
  assert.equal(body.token, undefined);
  assert.equal(JSON.stringify(body).includes("token="), false);
});

test("AUTH-02 negative: password-reset does not reveal whether the email exists", async () => {
  const { email } = await registerAccount("auth02-enum");
  clearCookies();
  const existing = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", { email, locale: "en-GB" }));
  const unknown = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email: uniqueEmail("auth02-missing"),
    locale: "en-GB"
  }));
  const existingBody = await existing.json() as Record<string, unknown>;
  const unknownBody = await unknown.json() as Record<string, unknown>;
  assert.equal(existing.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(publicShape(existingBody), publicShape(unknownBody));
});

test("AUTH-02 depth: repeating password-reset still has no resetUrl or token", async () => {
  const { email } = await registerAccount("auth02-depth-retry");
  clearCookies();
  const first = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", { email, locale: "en-GB" }));
  const second = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", { email, locale: "en-GB" }));
  const firstBody = await first.json() as Record<string, unknown>;
  const secondBody = await second.json() as Record<string, unknown>;
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstBody.resetUrl, undefined);
  assert.equal(secondBody.resetUrl, undefined);
  assert.equal(JSON.stringify(secondBody).includes("token="), false);
  assert.deepEqual(publicShape(firstBody), publicShape(secondBody));
});

test("AUTH-02 depth: pending and unknown password-reset share one public shape", async () => {
  const { email } = await registerPending("auth02-depth-pending");
  clearCookies();
  const pending = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", { email, locale: "en-GB" }));
  const unknown = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email: uniqueEmail("auth02-depth-missing"),
    locale: "en-GB"
  }));
  assert.equal(pending.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(publicShape(await pending.json() as Record<string, unknown>), publicShape(await unknown.json() as Record<string, unknown>));
});

test("AUTH-02 depth: a failed sign-in JSON has no resetUrl or token", async () => {
  const { email } = await registerAccount("auth02-depth-login");
  clearCookies();
  const response = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "wrong-pass" }));
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 401);
  assert.equal(body.resetUrl, undefined);
  assert.equal(JSON.stringify(body).includes("token="), false);
});

test("AUTH-02 edge: sign-in without credentials is 401 and does not set a session", async () => {
  clearCookies();
  const response = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", {}));
  takeSetCookie(response);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.code, "AUTHENTICATION_FAILED");
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-03 functional: APP_ENV=PRODUCTION does not leak a reset URL", async () => {
  const { email } = await registerAccount("auth03-reset");
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "PRODUCTION";
  try {
    const response = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
      email,
      locale: "en-GB"
    }));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 503);
    assert.equal(body.resetUrl, undefined);
    assert.equal(JSON.stringify(body).includes("token="), false);
  } finally {
    process.env.APP_ENV = previous;
  }
});

test("AUTH-03 negative: APP_ENV=PRODUCTION does not issue a local social session", async () => {
  const previousEnv = process.env.APP_ENV;
  const previousSocial = process.env.LOCAL_SOCIAL_LOGIN;
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.APP_ENV = "PRODUCTION";
  process.env.LOCAL_SOCIAL_LOGIN = "1";
  process.env.NEXT_PUBLIC_APP_URL = "https://localhost";
  clearCookies();
  try {
    const response = await google.GET(jsonRequest("GET", "https://localhost/api/auth/google?locale=en-GB"));
    takeSetCookie(response);
    assert.equal(response.status, 503);
    assert.equal(getCookie(SESSION_COOKIE), undefined);
    assert.equal((await me.GET(jsonRequest("GET", "https://localhost/api/auth/me")).then((item) => item.json())).user, null);
  } finally {
    process.env.APP_ENV = previousEnv;
    process.env.LOCAL_SOCIAL_LOGIN = previousSocial;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});

test("AUTH-03 depth: PRODUCTION with mail configured still omits resetUrl from JSON", async () => {
  const { email } = await registerAccount("auth03-depth-mail");
  const previousEnv = process.env.APP_ENV;
  const previousDelivery = process.env.EMAIL_DELIVERY;
  process.env.APP_ENV = "PRODUCTION";
  process.env.EMAIL_DELIVERY = "discard";
  try {
    const response = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
      email,
      locale: "en-GB"
    }));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.resetUrl, undefined);
    assert.equal(JSON.stringify(body).includes("token="), false);
  } finally {
    process.env.APP_ENV = previousEnv;
    process.env.EMAIL_DELIVERY = previousDelivery;
  }
});

test("AUTH-03 depth: PPE/PROD without mail does not leak a reset URL", async () => {
  const { email } = await registerAccount("auth03-depth-ppe");
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "PPE/PROD";
  try {
    const response = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
      email,
      locale: "en-GB"
    }));
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 503);
    assert.equal(body.resetUrl, undefined);
    assert.equal(JSON.stringify(body).includes("token="), false);
  } finally {
    process.env.APP_ENV = previous;
  }
});

test("AUTH-03 depth: PRODUCTION with mail still does not issue a local social session", async () => {
  const previousEnv = process.env.APP_ENV;
  const previousSocial = process.env.LOCAL_SOCIAL_LOGIN;
  const previousDelivery = process.env.EMAIL_DELIVERY;
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.APP_ENV = "PRODUCTION";
  process.env.LOCAL_SOCIAL_LOGIN = "1";
  process.env.EMAIL_DELIVERY = "discard";
  process.env.NEXT_PUBLIC_APP_URL = "https://localhost";
  clearCookies();
  try {
    const response = await google.GET(jsonRequest("GET", "https://localhost/api/auth/google?locale=en-GB"));
    takeSetCookie(response);
    assert.equal(response.status, 503);
    assert.equal(getCookie(SESSION_COOKIE), undefined);
  } finally {
    process.env.APP_ENV = previousEnv;
    process.env.LOCAL_SOCIAL_LOGIN = previousSocial;
    process.env.EMAIL_DELIVERY = previousDelivery;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});

test("AUTH-03 edge: APP_ENV=DEV still allows a local password-reset request without a token leak", async () => {
  process.env.APP_ENV = "DEV";
  const response = await resetRequest.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/request", {
    email: uniqueEmail("auth03-dev"),
    locale: "en-GB"
  }));
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.resetUrl, undefined);
});

test("AUTH-04 functional: registering the operator email stays a student", async () => {
  const email = uniqueEmail("auth04-ops");
  process.env.BACKOFFICE_OPERATOR_EMAIL = email;
  try {
    const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: PASSWORD,
      nickname: "IO Learner",
      locale: "en-GB"
    }));
    takeSetCookie(response);
    assert.equal(response.status, 200);
    const mine = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
    const body = await mine.json();
    assert.equal(body.user.role, "student");
    const office = await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"));
    assert.equal(office.status, 403);
  } finally {
    delete process.env.BACKOFFICE_OPERATOR_EMAIL;
  }
});

test("AUTH-04 negative: matching the operator email later does not open backoffice", async () => {
  const { email } = await registerAccount("auth04-live");
  process.env.BACKOFFICE_OPERATOR_EMAIL = email;
  try {
    const office = await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"));
    assert.equal(office.status, 403);
    const mine = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
    assert.equal((await mine.json()).user.role, "student");
  } finally {
    delete process.env.BACKOFFICE_OPERATOR_EMAIL;
  }
});

test("AUTH-04 depth: signing in after the operator email is set stays a student", async () => {
  const { email } = await registerAccount("auth04-depth-login");
  process.env.BACKOFFICE_OPERATOR_EMAIL = email;
  clearCookies();
  try {
    const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
    takeSetCookie(signedIn);
    assert.equal(signedIn.status, 200);
    assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user.role, "student");
    assert.equal((await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"))).status, 403);
  } finally {
    delete process.env.BACKOFFICE_OPERATOR_EMAIL;
  }
});

test("AUTH-04 depth: mixed-case operator email stays a student", async () => {
  const email = uniqueEmail("auth04-depth-case");
  process.env.BACKOFFICE_OPERATOR_EMAIL = email.toUpperCase();
  try {
    const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: PASSWORD,
      nickname: "IO Learner",
      locale: "en-GB"
    }));
    takeSetCookie(response);
    assert.equal(response.status, 200);
    assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user.role, "student");
    assert.equal((await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"))).status, 403);
  } finally {
    delete process.env.BACKOFFICE_OPERATOR_EMAIL;
  }
});

test("AUTH-04 depth: changing profile under the operator email does not open backoffice", async () => {
  const { email } = await registerAccount("auth04-depth-profile");
  process.env.BACKOFFICE_OPERATOR_EMAIL = email;
  try {
    const changed = await profile.PATCH(jsonRequest("PATCH", "http://localhost/api/me/profile", {
      nickname: "IO Operator",
      locale: "en-GB"
    }));
    assert.equal(changed.status, 200);
    assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user.role, "student");
    assert.equal((await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"))).status, 403);
  } finally {
    delete process.env.BACKOFFICE_OPERATOR_EMAIL;
  }
});

test("AUTH-04 edge: unauthenticated backoffice is 403", async () => {
  clearCookies();
  const response = await backoffice.GET(jsonRequest("GET", "http://localhost/api/backoffice/courses"));
  assert.equal(response.status, 403);
});

test("AUTH-05 functional: a second register does not take over the first password", async () => {
  const email = uniqueEmail("auth05-owner");
  const first = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: PASSWORD,
    nickname: "First Owner",
    locale: "en-GB"
  }));
  assert.equal(first.status, 200);
  const second = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: "attacker9",
    nickname: "Attacker",
    locale: "en-GB"
  }));
  assert.equal(second.status, 200);
  assert.equal(JSON.stringify(await second.json()).toLowerCase().includes("already exists"), false);
  clearCookies();
  const owner = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(owner);
  assert.equal(owner.status, 200);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user.email, email);
  clearCookies();
  const attacker = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "attacker9" }));
  takeSetCookie(attacker);
  assert.equal(attacker.status, 401);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-05 edge: concurrent same-email register keeps one working password", async () => {
  const email = uniqueEmail("auth05-race");
  const [first, second] = await Promise.all([
    register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: "password1",
      nickname: "First Owner",
      locale: "en-GB"
    })),
    register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: "attacker9",
      nickname: "Attacker",
      locale: "en-GB"
    }))
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  clearCookies();
  const firstLogin = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "password1" }));
  const secondLogin = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "attacker9" }));
  const wins = [firstLogin.status, secondLogin.status].filter((status) => status === 200);
  assert.equal(wins.length, 1);
});

test("AUTH-05 depth: a second register of a pending email does not start an attacker session", async () => {
  const { email } = await registerPending("auth05-depth-pending");
  clearCookies();
  const second = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: "attacker9",
    nickname: "Attacker",
    locale: "en-GB"
  }));
  takeSetCookie(second);
  assert.equal(second.status, 200);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
  const attacker = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "attacker9" }));
  takeSetCookie(attacker);
  assert.equal(attacker.status, 401);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-05 depth: three parallel registers keep exactly one working password", async () => {
  const email = uniqueEmail("auth05-depth-triple");
  const responses = await Promise.all([
    register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: "password1",
      nickname: "First Owner",
      locale: "en-GB"
    })),
    register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: "password2",
      nickname: "Second",
      locale: "en-GB"
    })),
    register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email,
      password: "attacker9",
      nickname: "Attacker",
      locale: "en-GB"
    }))
  ]);
  assert.ok(responses.every((item) => item.status === 200));
  clearCookies();
  const wins = [];
  for (const password of ["password1", "password2", "attacker9"]) {
    const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password }));
    if (signedIn.status === 200) wins.push(password);
  }
  assert.equal(wins.length, 1);
});

test("AUTH-05 depth: a second register of an active email does not start an attacker session", async () => {
  const { email } = await registerAccount("auth05-depth-active");
  clearCookies();
  const second = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: "attacker9",
    nickname: "Attacker",
    locale: "en-GB"
  }));
  takeSetCookie(second);
  assert.equal(second.status, 200);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-05 depth: two processes registering the same email keep one working password", async () => {
  const email = uniqueEmail("auth05-depth-workers");
  const [first, second] = await Promise.all([
    runProductLockWorker({ action: "register", email, password: "password1" }),
    runProductLockWorker({ action: "register", email, password: "attacker9" })
  ]);
  assert.equal([first, second].filter((item) => item.ok).length, 1);
  clearCookies();
  const owner = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "password1" }));
  const attacker = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: "attacker9" }));
  const wins = [owner.status, attacker.status].filter((status) => status === 200);
  assert.equal(wins.length, 1);
});

test("AUTH-05 negative: verification required without mail delivery is 503", async () => {
  process.env.EMAIL_VERIFICATION_REQUIRED = "1";
  process.env.EMAIL_DELIVERY = "";
  delete process.env.SES_FROM_EMAIL;
  try {
    const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
      email: uniqueEmail("auth05-verify"),
      password: PASSWORD,
      locale: "en-GB"
    }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "EMAIL_DELIVERY_NOT_CONFIGURED");
  } finally {
    process.env.EMAIL_VERIFICATION_REQUIRED = "0";
  }
});

test("AUTH-06 functional: a second sign-in invalidates the first session", async () => {
  const { email } = await registerAccount("auth06-kick");
  const firstToken = getCookie(SESSION_COOKIE);
  assert.ok(firstToken);
  clearCookies();
  const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(signedIn);
  const secondToken = getCookie(SESSION_COOKIE);
  assert.ok(secondToken);
  assert.notEqual(firstToken, secondToken);
  setCookie(SESSION_COOKIE, firstToken);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
  setCookie(SESSION_COOKIE, secondToken);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user.email, email);
});

test("AUTH-06 negative: changing password invalidates the previous session", async () => {
  await registerAccount("auth06-password");
  const changed = await profile.PATCH(jsonRequest("PATCH", "http://localhost/api/me/profile", {
    nickname: "IO Learner",
    locale: "en-GB",
    currentPassword: PASSWORD,
    newPassword: "Passw0rd!999"
  }));
  assert.equal(changed.status, 200);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
  const gated = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  assert.equal(gated.status, 401);
});

test("AUTH-06 depth: the kicked session cannot open a purchase quote", async () => {
  const { email } = await registerAccount("auth06-depth-quote");
  const firstToken = getCookie(SESSION_COOKIE);
  assert.ok(firstToken);
  clearCookies();
  const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(signedIn);
  setCookie(SESSION_COOKIE, firstToken);
  const gated = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  assert.equal(gated.status, 401);
});

test("AUTH-06 depth: the kicked session cannot open checkout", async () => {
  const { email } = await registerAccount("auth06-depth-checkout");
  const firstToken = getCookie(SESSION_COOKIE);
  assert.ok(firstToken);
  clearCookies();
  const signedIn = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(signedIn);
  setCookie(SESSION_COOKIE, firstToken);
  const gated = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId: "quote-missing",
    locale: "en-GB",
    consents: { renewal: true, terms: true, refund: true }
  }));
  assert.equal(gated.status, 401);
});

test("AUTH-06 depth: a third sign-in invalidates the second session", async () => {
  const { email } = await registerAccount("auth06-depth-third");
  clearCookies();
  const second = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(second);
  const secondToken = getCookie(SESSION_COOKIE);
  clearCookies();
  const third = await login.POST(jsonRequest("POST", "http://localhost/api/auth/sign-in", { email, password: PASSWORD }));
  takeSetCookie(third);
  assert.ok(secondToken);
  setCookie(SESSION_COOKIE, secondToken);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-06 edge: a forged session cookie does not restore a user", async () => {
  clearCookies();
  setCookie(SESSION_COOKIE, "forged-session-token");
  const response = await me.GET(jsonRequest("GET", "http://localhost/api/auth/me"));
  assert.equal((await response.json()).user, null);
  const gated = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  assert.equal(gated.status, 401);
});

function assertNoSecretLeak(body: Record<string, unknown>) {
  assert.equal(body.resetUrl, undefined);
  assert.equal(body.token, undefined);
  assert.equal("exists" in body, false);
  assert.equal(JSON.stringify(body).includes("token="), false);
  const entitlement = body.entitlement as { allowed?: boolean } | undefined;
  if (entitlement) assert.equal(entitlement.allowed, false);
  assert.equal(body.quote, undefined);
  assert.equal(body.order, undefined);
  assert.equal(body.courses, undefined);
  assert.equal(body.orders, undefined);
}

async function assertSignedOut401(response: Response) {
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.match(String(body.error || body.message || ""), /sign in is required/i);
  assertNoSecretLeak(body);
  return body;
}

test("AUTH-06 / INV-unauth-no-grant: unauthenticated student routes are 401 with the same public shape", async () => {
  clearCookies();
  const rows: Array<{ name: string; call: () => Promise<Response> }> = [
    { name: "GET /api/me/profile", call: () => callRoute(profile.GET, jsonRequest("GET", "http://localhost/api/me/profile")) },
    { name: "PATCH /api/me/profile", call: () => callRoute(profile.PATCH, jsonRequest("PATCH", "http://localhost/api/me/profile", { nickname: "x", locale: "en-GB" })) },
    { name: "POST /api/trial", call: () => callRoute(trial.POST, jsonRequest("POST", "http://localhost/api/trial", { quoteId: "q", locale: "en-GB", consents: { renewal: true, terms: true, refund: true } })) },
    { name: "GET /api/subscription", call: () => callRoute(subscription.GET, jsonRequest("GET", "http://localhost/api/subscription")) },
    { name: "POST /api/subscription", call: () => callRoute(subscription.POST, jsonRequest("POST", "http://localhost/api/subscription", { subscriptionId: "sub", action: "cancel" })) },
    { name: "GET /api/subscription/quote", call: () => callRoute(subscriptionQuote.GET, jsonRequest("GET", "http://localhost/api/subscription/quote?quoteId=missing")) },
    { name: "POST /api/subscription/quote", call: () => callRoute(subscriptionQuote.POST, jsonRequest("POST", "http://localhost/api/subscription/quote", { planId: "everything-pc-6" })) },
    { name: "POST /api/subscription/portal", call: () => callRoute(billingPortal.POST, jsonRequest("POST", "http://localhost/api/subscription/portal", { action: "manage" })) },
    { name: "POST /api/purchase/quote", call: () => callRoute(quote.POST, jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" })) },
    { name: "POST /api/purchase/checkout", call: () => callRoute(checkout.POST, jsonRequest("POST", "http://localhost/api/purchase/checkout", { quoteId: "missing", locale: "en-GB", consents: { renewal: true, terms: true, refund: true } })) },
    { name: "POST /api/purchase/demo/confirm", call: () => callRoute(confirm.POST, jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", { orderId: "missing", action: "complete" })) },
    { name: "GET /api/entitlements/check", call: () => callRoute(entitlements.GET, jsonRequest("GET", `http://localhost/api/entitlements/check?courseId=${COURSE_ID}`)) },
    { name: "GET /api/my-learning", call: () => callRoute(overview.GET, jsonRequest("GET", "http://localhost/api/my-learning")) },
    { name: "PATCH /api/my-learning/settings", call: () => callRoute(settings.PATCH, jsonRequest("PATCH", "http://localhost/api/my-learning/settings", { nickname: "x", locale: "en-GB" })) },
    { name: "GET /api/my-learning/notifications", call: () => callRoute(notifications.GET, jsonRequest("GET", "http://localhost/api/my-learning/notifications")) },
    { name: "GET /api/my-learning/avatar", call: () => callRoute(avatar.GET, jsonRequest("GET", "http://localhost/api/my-learning/avatar")) },
    { name: "POST /api/study/events", call: () => callRoute(study.POST, jsonRequest("POST", "http://localhost/api/study/events", { courseId: COURSE_ID, lessonId: "x", event: "open", seconds: 0, clientEventId: "unauth" })) },
    { name: "POST /api/study/preview", call: () => callRoute(preview.POST, jsonRequest("POST", "http://localhost/api/study/preview", { courseId: COURSE_ID, lessonId: "x", event: "open" })) },
    { name: "GET /api/ai-tutor", call: () => callRoute(tutor.GET, jsonRequest("GET", `http://localhost/api/ai-tutor?courseId=${COURSE_ID}`)) },
    { name: "POST /api/ai-tutor", call: () => callRoute(tutor.POST, jsonRequest("POST", "http://localhost/api/ai-tutor", { courseId: COURSE_ID, message: "hello", locale: "en-GB" })) }
  ];
  const shapes: Record<string, unknown>[] = [];
  for (const row of rows) {
    const body = await assertSignedOut401(await row.call());
    shapes.push(publicShape(body));
  }
  for (const shape of shapes.slice(1)) {
    assert.deepEqual(shape, shapes[0], "unauthenticated JSON shape must not vary by route");
  }
});

test("AUTH-04 / INV-unauth-no-grant: unauthenticated backoffice is 403 and lists nothing", async () => {
  clearCookies();
  const courses = await callRoute(backoffice.GET, jsonRequest("GET", "http://localhost/api/backoffice/courses"));
  const orders = await callRoute(backofficeOrders.GET, jsonRequest("GET", "http://localhost/api/backoffice/orders"));
  const payment = await callRoute(backofficePayment.GET, jsonRequest("GET", "http://localhost/api/backoffice/payment"));
  for (const response of [courses, orders, payment]) {
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 403);
    assert.equal(body.ok, false);
    assertNoSecretLeak(body);
  }
});

test("AUTH-06 functional: logout invalidates the current session", async () => {
  await registerAccount("auth06-logout");
  assert.ok(getCookie(SESSION_COOKIE));
  const signedOut = await callRoute(logout.POST, jsonRequest("POST", "http://localhost/api/auth/logout"));
  takeSetCookie(signedOut);
  assert.equal(signedOut.status, 200);
  assert.equal((await signedOut.json()).ok, true);
  assert.equal(getCookie(SESSION_COOKIE), undefined);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
  const gated = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: "everything-pc-6" }));
  assert.equal(gated.status, 401);
});

test("AUTH-06 edge: logout without a session is still ok and does not leak a user", async () => {
  clearCookies();
  const response = await callRoute(logout.POST, jsonRequest("POST", "http://localhost/api/auth/logout"));
  takeSetCookie(response);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assertNoSecretLeak(body);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-05 / register: a pending account does not receive a session cookie", async () => {
  const { response } = await registerPending("auth05-no-session");
  takeSetCookie(response);
  assert.equal(response.status, 200);
  assert.equal(getCookie(SESSION_COOKIE), undefined);
  assert.equal((await me.GET(jsonRequest("GET", "http://localhost/api/auth/me")).then((item) => item.json())).user, null);
});

test("AUTH-02 negative: password-reset confirm without a token is 400 and leaks nothing", async () => {
  clearCookies();
  const missing = await resetConfirm.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/confirm", { newPassword: "Passw0rd!999" }));
  const garbage = await resetConfirm.POST(jsonRequest("POST", "http://localhost/api/auth/password-reset/confirm", {
    token: "not-a-real-reset-token",
    newPassword: "Passw0rd!999"
  }));
  const missingBody = await missing.json() as Record<string, unknown>;
  const garbageBody = await garbage.json() as Record<string, unknown>;
  assert.equal(missing.status, 400);
  assert.equal(garbage.status, 400);
  assert.equal(missingBody.ok, false);
  assert.equal(garbageBody.ok, false);
  assertNoSecretLeak(missingBody);
  assertNoSecretLeak(garbageBody);
});

test("AUTH-01 / verify-email: missing and unknown tokens share one public failure shape", async () => {
  clearCookies();
  const missing = await verifyEmail.POST(jsonRequest("POST", "http://localhost/api/auth/verify-email", {}));
  const unknown = await verifyEmail.POST(jsonRequest("POST", "http://localhost/api/auth/verify-email", { token: "unknown-verify-token" }));
  const missingBody = await missing.json() as Record<string, unknown>;
  const unknownBody = await unknown.json() as Record<string, unknown>;
  assert.equal(missing.status, 400);
  assert.equal(unknown.status, 400);
  assert.equal(missingBody.ok, false);
  assert.equal(unknownBody.ok, false);
  assert.equal(missingBody.code, "VERIFICATION_TOKEN_REQUIRED");
  assert.equal(unknownBody.code, "VERIFICATION_TOKEN_INVALID");
  assertNoSecretLeak(missingBody);
  assertNoSecretLeak(unknownBody);
});

test("AUTH-03 / social origin: Google from a foreign host does not set a session", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.example.test";
  process.env.LOCAL_SOCIAL_LOGIN = "0";
  clearCookies();
  try {
    const response = await google.GET(jsonRequest("GET", "https://evil.example/api/auth/google?locale=en-GB"));
    takeSetCookie(response);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://www.example.test/api/auth/google?locale=en-GB");
    assert.equal(getCookie(SESSION_COOKIE), undefined);
    assert.equal((await me.GET(jsonRequest("GET", "https://evil.example/api/auth/me")).then((item) => item.json())).user, null);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});

test("AUTH-03 / social origin: WeChat from a foreign host does not set a session", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.example.test";
  clearCookies();
  try {
    const response = await wechat.GET(jsonRequest("GET", "https://evil.example/api/auth/wechat?locale=zh-CN"));
    takeSetCookie(response);
    assert.equal(response.status, 303);
    assert.equal(getCookie(SESSION_COOKIE), undefined);
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});
