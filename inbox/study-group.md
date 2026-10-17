---
id: study-group
kind: prd
readiness: not-ready
source:
  repo: First-Light-TechHK/LearningGuidePortal
  path: docs/phase1/source-prd/Learning_Guide_Study_Group_PRD_v0.10_EN.docx
  ref: bb353aae76b8aea05d0aec3ae17ebf337a3b234a
packages:
  - modules/group-study
locale: en-GB
---

# Intent

Study Group P0. A learner with Course access creates a public Group and becomes Host. Live Sessions hold at most six people. Chat and tokens are not database rows. LiveKit project credentials remain server-only; an active or draining project is continuously checked through a redacted, non-mutating Room Service probe.

# In scope

- SG-01 Create a Group.
- SG-02 Join, leave, and discover.
- SG-03 Live Session capacity, start, and participant token.
- SG-04 LiveKit operational readiness and credential boundary.
- SG-05 Shared AI Tutor in the Live Session: queued questions answered from the whole Course Knowledge, tagged course or general, never refused (owner decision 2026-10-13, see `docs/phase1/study-group/decisions.md`).
- SG-06 PostgreSQL persistence (migration 012) and the signed LiveKit webhook with reconciliation.

# Out of scope

- Persisting chat.
- A token audit table.
- Hitting production ilovelearningguide.com.

# User cases

1. A learner with Course access creates a discoverable Group and is the Host.
2. Join is immediate; a user without Course access cannot join.
3. Entry is first-come-first-served up to the Session maximum, and the token is not a Host grant.
4. An Operator can see only a redacted LiveKit health snapshot. Invalid project configuration, unavailable credentials and provider authorization failures fail closed without exposing a secret.
