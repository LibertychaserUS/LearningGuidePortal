# Registration and Authentication

Black-box I/O against `/api/auth/*` and one protected purchase gate. Not a mirror of the Registration PRD.
Suite stays draft so Overlay does not run these cases and does not go red.

Shallow to deep: smoke (no session) → contract (missing input) → happy path → reject → token / cookie edges.

## AUTH-01 Valid session sees own data

### Functional
- Title: Signed-in /api/auth/me returns that user
- Steps: POST /api/auth/register; GET /api/auth/me
- Expected: HTTP 200; `user.email` is the registered address only

### Negative
- Title: No session on a protected purchase API
- Steps: POST /api/purchase/quote with no cookie
- Expected: HTTP 401; INV-unauth-no-grant — no quote, no other user's data
- Title: Signed-in without purchase is not entitled
- Steps: Register; GET /api/entitlements/check?courseId=epicureanism
- Expected: HTTP 200; `entitlement.allowed` is false

### Edge
- Title: Forged session cookie
- Steps: Set `learning_guide_session` to a random token; GET /api/auth/me and POST /api/purchase/quote
- Expected: `user` is null; quote is 401

## AUTH-02 Email registration and sign-in

### Functional
- Title: Register then sign-in issues a session
- Steps: POST /api/auth/register; POST /api/auth/sign-in with the same email and password; GET /api/auth/me
- Expected: Both writes 200; `Set-Cookie` session; me returns that email

### Negative
- Title: Missing credentials
- Steps: POST /api/auth/sign-in with an empty body
- Expected: HTTP 401; `AUTHENTICATION_FAILED`
- Title: Wrong password
- Steps: Register; POST /api/auth/sign-in with a different password
- Expected: HTTP 401; me still has no user
- Title: Verification required without mail
- Steps: Set verification required; POST /api/auth/register
- Expected: HTTP 503; `EMAIL_DELIVERY_NOT_CONFIGURED` — no fake activation

### Edge
- Title: Verify-email without a token
- Steps: POST /api/auth/verify-email `{}`
- Expected: HTTP 400; `VERIFICATION_TOKEN_REQUIRED`
- Title: Password reset does not reveal account existence
- Steps: POST /api/auth/password-reset/request for a known email and an unknown email
- Expected: Both HTTP 200; `ok: true`
