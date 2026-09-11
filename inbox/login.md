---
id: login
kind: prd
readiness: not-ready
source:
  repo: LibertychaserUS/LearningGuidePortal
  path: docs/phase1/source-prd/Registration_Authentication_PRD_v1.0_0814.docx
  ref: 6d8934e5811e371554a94aa47b2f56c40bf0cbd3
packages:
  - modules/user-registration
  - app/api/auth
locale: en-GB
---

# Intent

Registration and session. Cases are black-box I/O against `/api/auth/*`. The suite stays draft so Overlay does not gate until a human arms it.

# In scope

- AUTH-01 Valid session sees own data.
- AUTH-02 Email registration and sign-in.

# Out of scope

- Using login as a merge gate.
- Changing LearningGuidePortal Verify.
- Real WeChat QR or production OAuth.
- White-box calls into productStore.

# User cases

1. A user with a valid session opens a protected API and sees their own data.
2. Email register / sign-in succeeds only with valid credentials; missing mail does not fake verification.

# Notes

`readiness: not-ready` is a hint only. Do not arm until live login is claimed testable. Executable I/O lives in `tests/io/login.test.ts`.
