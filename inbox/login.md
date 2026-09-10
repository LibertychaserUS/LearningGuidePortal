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

Registration and session. Cases may be written; the suite stays draft so Overlay does not gate on live login.

# In scope

- AUTH-01 Valid session sees own data.

# Out of scope

- Using login as a merge gate.
- Changing LearningGuidePortal Verify.
- Real WeChat QR or production OAuth.

# User cases

1. A user with a valid session opens a protected page and sees their own data.

# Notes

`readiness: not-ready` is a hint only. A human may later mark the suite blocked. Do not arm until live login is claimed testable.
