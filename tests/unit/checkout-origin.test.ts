import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutRequestOrigin } from "../../services/paymentService";
import { paymentFailure } from "../../services/paymentHttp";
import { PaymentError } from "../../contracts/payment";

test("checkout origin permits only same-origin loopback in DEV and configured origin in managed environments", async () => {
  const previous = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_APP_URL = "https://payment.example.test";
    for (const environment of ["DEV", "SIT", "UAT", "PPE/PROD"]) {
      process.env.APP_ENV = environment;
      for (const host of ["localhost:3011", "127.0.0.1:3001", "[::1]:3012"]) {
        const origin = `http://${host}`;
        const request = new Request(`${origin}/api/purchase/checkout`, { headers: { origin } });
        if (environment === "DEV") assert.equal(checkoutRequestOrigin(request), origin);
        else assert.throws(() => checkoutRequestOrigin(request), { code: "origin_mismatch" });
        for (const headers of [{}, { origin: "https://attacker.invalid" }, { origin: "null" }]) {
          assert.throws(() => checkoutRequestOrigin(new Request(request.url, { headers: new Headers(Object.entries(headers) as [string, string][]) })), { code: "origin_mismatch" });
        }
      }
      assert.equal(checkoutRequestOrigin(new Request("http://internal:8080/api/purchase/checkout", { headers: { origin: "https://payment.example.test" } })), "https://payment.example.test");
      // next dev reports request.url as localhost even when bound to 127.0.0.1.
      const aliased = new Request("http://localhost:3013/api/trial", { headers: { origin: "http://127.0.0.1:3013" } });
      if (environment === "DEV") assert.equal(checkoutRequestOrigin(aliased), "http://127.0.0.1:3013");
      else assert.throws(() => checkoutRequestOrigin(aliased), { code: "origin_mismatch" });
      for (const origin of ["http://127.0.0.1:3014", "https://127.0.0.1:3013", "http://127.0.0.1:3013/x"]) {
        assert.throws(() => checkoutRequestOrigin(new Request(aliased.url, { headers: { origin } })), { code: "origin_mismatch" });
      }
    }
    for (const locale of ["en-GB", "zh-CN"] as const) {
      const origin = paymentFailure(new PaymentError("origin_mismatch", 403), locale);
      const consent = paymentFailure(new PaymentError("consent_required"), locale);
      assert.equal(origin.status, 403);
      assert.equal(consent.status, 400);
      assert.notEqual((await origin.json()).message, (await consent.json()).message);
    }
  } finally { process.env = previous; }
});
