# Visitor / Trial

Black-box I/O against trial quote, `/api/trial`, demo confirm, entitlement check, study/events, and `/api/subscription` resume.
Suite is draft. Overlay select does not run this product_command until a human arms it.

Visitor-facing checks reuse PAY-01 and PAY-10. Trial Canceled → Trial Active before the original `trial_end` must not extend `validTo` (`domain-model.md`).

## PAY-01 Trial activation

### Functional
- Title: Completed demo trial grants visitor access inside three days
- Steps: Sign in; POST trial quote; POST /api/trial; POST demo confirm `complete`; GET /api/entitlements/check
- Expected: Confirm 200 `paid`; `allowed` true; `source` is trial; `validTo` stays inside the 3-day window

### Negative
- Title: Cancelling checkout never grants the course
- Steps: Same trial checkout; POST confirm `cancel`; GET entitlements; POST /api/study/events on a locked lesson
- Expected: Order `canceled`; entitlement false; study/events 403

### Edge
- Title: Resume trial_canceled inside the original window does not extend validTo
- Steps: Complete trial; record `validTo`; POST /api/subscription `cancel`; POST `resume`; GET entitlements
- Expected: Cancel removes access; resume is Trial Active; `validTo` equals the original trial end. Matches Trial Canceled → Trial Active before original `trial_end`, no extension. If resume is 400, keep this intended assertion (do not weaken)

## PAY-10 Cancelled trial does not revive

### Functional
- Title: Completed demo trial allows the course
- Steps: Covered by PAY-01 functional (`tests/io/visitor-trial.test.ts`)
- Expected: Confirm 200; entitlement allowed

### Negative
- Title: Second complete after trial cancel does not grant
- Steps: Complete trial; POST subscription cancel; GET entitlements; POST /api/study/events on a locked lesson; POST confirm `complete` again
- Expected: Entitlement false; study/events 403; second complete 400; entitlement stays false (PAY-10)

### Edge
- Title: Trial checkout without consents
- Steps: Specified in `tests/io/payment.test.ts` PAY-10 edge
- Expected: HTTP 400
