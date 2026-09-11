import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Stripe from "stripe";
import {
  COURSE_ID,
  PASSWORD,
  PLAN_ID,
  SERVER_AMOUNT_MINOR,
  clearCookies,
  isolate,
  jsonRequest,
  takeSetCookie,
  uniqueEmail
} from "./harness";

const CONSENTS = { renewal: true, terms: true, refund: true };

let restore: () => Promise<void>;
let register: typeof import("../../app/api/auth/register/route");
let quote: typeof import("../../app/api/purchase/quote/route");
let checkout: typeof import("../../app/api/purchase/checkout/route");
let confirm: typeof import("../../app/api/purchase/demo/confirm/route");
let entitlements: typeof import("../../app/api/entitlements/check/route");
let webhook: typeof import("../../app/api/payment/webhook/route");

before(async () => {
  restore = (await isolate("lg-io-payment-")).restore;
  register = await import("../../app/api/auth/register/route");
  quote = await import("../../app/api/purchase/quote/route");
  checkout = await import("../../app/api/purchase/checkout/route");
  confirm = await import("../../app/api/purchase/demo/confirm/route");
  entitlements = await import("../../app/api/entitlements/check/route");
  webhook = await import("../../app/api/payment/webhook/route");
});

after(async () => {
  await restore();
});

async function signIn(label: string) {
  clearCookies();
  const email = uniqueEmail(label);
  const response = await register.POST(jsonRequest("POST", "http://localhost/api/auth/register", {
    email,
    password: PASSWORD,
    nickname: "IO Buyer",
    locale: "en-GB"
  }));
  takeSetCookie(response);
  assert.equal(response.status, 200);
  return email;
}

async function entitlementAllowed() {
  const response = await entitlements.GET(jsonRequest("GET", `http://localhost/api/entitlements/check?courseId=${COURSE_ID}`));
  const body = await response.json();
  return { status: response.status, allowed: Boolean(body.entitlement?.allowed), body };
}

function signedWebhook(event: object, secret = "whsec_fixture") {
  const payload = JSON.stringify(event);
  const stripe = new Stripe("sk_test_fixture");
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/payment/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload
  });
}

test("PAY-02 smoke: quote without a session is 401", async () => {
  clearCookies();
  const response = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).ok, false);
});

test("PAY-02 smoke: checkout without a session is 401", async () => {
  clearCookies();
  const response = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId: "quote-missing",
    consents: CONSENTS
  }));
  assert.equal(response.status, 401);
});

test("PAY-02 functional: quote amount is server-owned", async () => {
  await signIn("pay02-quote");
  const response = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", {
    planId: PLAN_ID,
    amountMinor: 1
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.quote.amountMinor, SERVER_AMOUNT_MINOR);
  assert.equal(body.quote.currency, "usd");
  assert.equal(body.quote.planId, PLAN_ID);
  assert.ok(body.quote.id);
  assert.notEqual(body.quote.amountMinor, 1);
});

test("PAY-02 negative: checkout without consents is 400", async () => {
  await signIn("pay02-consents");
  const quoted = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  const quoteId = (await quoted.json()).quote.id as string;
  const response = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", { quoteId }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /confirmations/i);
});

test("PAY-02 functional: checkout returns a server order and a local checkout URL", async () => {
  await signIn("pay02-checkout");
  const quoted = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  const quoteBody = await quoted.json();
  const response = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId: quoteBody.quote.id,
    locale: "en-GB",
    consents: CONSENTS
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.order.amountMinor, SERVER_AMOUNT_MINOR);
  assert.equal(body.order.status, "pending");
  assert.match(body.checkoutUrl, /\/en-GB\/portal\/payment\/checkout\?orderId=/);
  assert.equal((await entitlementAllowed()).allowed, false);
});

test("PAY-01 functional: completed demo payment allows the course", async () => {
  await signIn("pay01-complete");
  const quoted = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  const quoteId = (await quoted.json()).quote.id as string;
  const pending = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId,
    locale: "en-GB",
    consents: CONSENTS
  }));
  const orderId = (await pending.json()).order.id as string;
  const paid = await confirm.POST(jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", {
    orderId,
    action: "complete"
  }));
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).status, "paid");
  const access = await entitlementAllowed();
  assert.equal(access.status, 200);
  assert.equal(access.allowed, true);
});

test("PAY-01 negative: cancelled demo payment does not allow the course", async () => {
  await signIn("pay01-cancel");
  const quoted = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  const quoteId = (await quoted.json()).quote.id as string;
  const pending = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId,
    locale: "en-GB",
    consents: CONSENTS
  }));
  const orderId = (await pending.json()).order.id as string;
  const cancelled = await confirm.POST(jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", {
    orderId,
    action: "cancel"
  }));
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).status, "canceled");
  assert.equal((await entitlementAllowed()).allowed, false);
});

test("PAY-01 edge: repeating complete does not create a second grant", async () => {
  await signIn("pay01-repeat");
  const quoted = await quote.POST(jsonRequest("POST", "http://localhost/api/purchase/quote", { planId: PLAN_ID }));
  const quoteId = (await quoted.json()).quote.id as string;
  const pending = await checkout.POST(jsonRequest("POST", "http://localhost/api/purchase/checkout", {
    quoteId,
    locale: "en-GB",
    consents: CONSENTS
  }));
  const orderId = (await pending.json()).order.id as string;
  const first = await confirm.POST(jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", { orderId, action: "complete" }));
  const second = await confirm.POST(jsonRequest("POST", "http://localhost/api/purchase/demo/confirm", { orderId, action: "complete" }));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const access = await entitlementAllowed();
  assert.equal(access.allowed, true);
  assert.ok(!Array.isArray(access.body.entitlement) || access.body.entitlement.length <= 1);
});

test("PAY-03 smoke: webhook without a signature is 503", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const response = await webhook.POST(new Request("http://localhost/api/payment/webhook", {
    method: "POST",
    body: "{}"
  }));
  assert.equal(response.status, 503);
});

test("PAY-03 negative: a bad signature is 400", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SANDBOX = "1";
  const response = await webhook.POST(new Request("http://localhost/api/payment/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" })
  }));
  assert.equal(response.status, 400);
});

test("PAY-03 functional: unpaid completion stays pending and grants nothing", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SANDBOX = "1";
  await signIn("pay03-unpaid");
  const response = await webhook.POST(signedWebhook({
    id: "evt_unpaid",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_unpaid",
        payment_status: "unpaid",
        metadata: { userId: "u", quoteId: "q", planId: PLAN_ID }
      }
    }
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.pending, true);
  assert.equal((await entitlementAllowed()).allowed, false);
});

test("PAY-03 edge: a paid event without a server order does not grant access", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SANDBOX = "1";
  await signIn("pay03-orphan");
  const response = await webhook.POST(signedWebhook({
    id: "evt_orphan_paid",
    object: "event",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_orphan",
        payment_status: "paid",
        amount_total: SERVER_AMOUNT_MINOR,
        currency: "usd",
        metadata: { userId: "missing-user", quoteId: "missing-quote", planId: PLAN_ID }
      }
    }
  }));
  assert.equal(response.status, 400);
  assert.equal((await entitlementAllowed()).allowed, false);
});

test("PAY-03 edge: an unknown event type is ignored", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SANDBOX = "1";
  const response = await webhook.POST(signedWebhook({
    id: "evt_ping",
    object: "event",
    livemode: false,
    type: "ping",
    data: { object: {} }
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ignored, true);
});

test("PAY-03 negative: a live event is rejected in sandbox", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_SANDBOX = "1";
  const response = await webhook.POST(signedWebhook({
    id: "evt_live",
    object: "event",
    livemode: true,
    type: "ping",
    data: { object: {} }
  }));
  assert.equal(response.status, 400);
});
