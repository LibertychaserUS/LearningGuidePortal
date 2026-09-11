# Payment Management

Black-box I/O against quote, checkout, demo confirm, entitlement check, and `/api/payment/webhook`.
Suite stays draft so Overlay does not run these cases and does not go red.

Shallow to deep: unauthenticated smoke → server price contract → configured complete/cancel → webhook authenticity.

## PAY-01 Entitlement updates after a configured payment

### Functional
- Title: Configured demo payment completes
- Steps: Sign in; POST quote; POST checkout with consents; POST /api/purchase/demo/confirm `complete`; GET /api/entitlements/check
- Expected: Confirm 200 `paid`; `entitlement.allowed` is true

### Negative
- Title: Incomplete payment
- Steps: Same checkout; POST confirm `cancel`
- Expected: Order `canceled`; entitlement stays false; INV-unauth-no-grant for the unpaid path

### Edge
- Title: Repeat confirmation of a completed payment
- Steps: Confirm `complete` twice on the same order; GET entitlements
- Expected: Still allowed once; INV-one-charge — no second grant

## PAY-02 Server quote and checkout

### Functional
- Title: Quote amount is server-owned
- Steps: Sign in; POST /api/purchase/quote with `planId` and a client `amountMinor: 1`
- Expected: HTTP 200; `quote.amountMinor` is the server catalogue amount, not 1; INV-browser-not-price
- Title: Checkout returns a server order
- Steps: POST /api/purchase/checkout with the quote id and all consents
- Expected: HTTP 200; `order.amountMinor` matches the quote; `checkoutUrl` is a local checkout path; entitlement still false

### Negative
- Title: Quote or checkout without a session
- Steps: POST quote and checkout with no cookie
- Expected: HTTP 401; INV-unauth-no-grant
- Title: Checkout without consents
- Steps: Signed-in quote; POST checkout without consents
- Expected: HTTP 400

### Edge
- Title: Client price field is ignored
- Steps: Include `amountMinor` on the quote body
- Expected: Response amount stays the server amount; INV-browser-not-price

## PAY-03 Webhook authenticity and idempotency

### Functional
- Title: Unpaid completion stays pending
- Steps: POST /api/payment/webhook with a signed `checkout.session.completed` and `payment_status=unpaid`
- Expected: HTTP 200 `pending`; entitlement remains false

### Negative
- Title: Missing signature
- Steps: POST webhook with no `Stripe-Signature` and no secret
- Expected: HTTP 503
- Title: Bad signature
- Steps: POST webhook with a junk signature after configuring the signing secret
- Expected: HTTP 400
- Title: Live event in sandbox
- Steps: Signed event with `livemode: true` while `STRIPE_SANDBOX=1`
- Expected: HTTP 400

### Edge
- Title: Paid event without a server order
- Steps: Signed paid completion whose metadata does not match a stored order
- Expected: HTTP 400; entitlement stays false; INV-one-charge
- Title: Unknown event type
- Steps: Signed `ping`
- Expected: HTTP 200 `ignored`
