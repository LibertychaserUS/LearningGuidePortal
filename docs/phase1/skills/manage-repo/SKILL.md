---
name: manage-repo
description: >-
  Human maintainer actions on Learning Guide — review Overlay suites
  (write reviewed_by / armed yourself), merge when required checks are green.
  Do not live-apply Forge Rulesets to this repo. Do not forge submit for
  developers (use dev-pr). Agents must not use this skill to arm or apply.
metadata:
  short-description: Human review and merge; no live apply here
---

# Manage Repo (Learning Guide)

Review and merge live on **GitHub**. Agents must not use this skill to arm suites or apply Rulesets.

## Instructions

1. **Do not live-apply Forge** to `LibertychaserUS/LearningGuidePortal` or `First-Light-TechHK/LearningGuidePortal`. Phase 1 Ops does not apply. `python -m forge apply --dry-run` is diagnosis only.
2. **Required checks** (already in `forge.yaml`) are the PR **job names**: `Typecheck` / `Lint` / `Build and test` / `overlay-check`. The Verify **workflow** name is not a required check. Do not add `pr-title` / `sop-lock` unless this product repo actually grows those jobs.
3. **Merge** only when those checks are green and a human approved. Default squash. Do not let an agent merge.
4. **Overlay arm / block** is a human yaml edit. Agents must not. The review CLI does not write. Hand-edit `suites/<id>/suite.yaml`:
   - `status: armed` or `blocked`
   - non-empty `reviewed_by` + ISO-8601 `reviewed_at`
   - `armed_reason` or `blocked_reason`
5. After a human edit: `PYTHONPATH=/tmp/AIOps python3 -m overlay validate --root .` (`/tmp/AIOps` @ `overlay-v1.0.1`).
6. **AIOps tags:** official pin is `overlay-v1.0.1` / `forge-v1.0.1` @ `b4afc10ae0be4725e5109030f14a05bb2291fe4a`. Never force-move `1.0.0`. Next semver: `python -m forge release --version X.Y.Z --dry-run` then live, or push annotated tags over SSH. Spec: [`../aiops-release/APPLY.md`](../aiops-release/APPLY.md).

## Never

- Do not live-apply Forge to this product.
- Do not change Verify. Do not add `test:io` to Verify.
- Do not let agents write `reviewed_by` or `armed`.
- Do not hit `ilovelearningguide.com`.
- Do not vendor `forge/` / `overlay/`.
- Do not `forge submit` for developers.

## Examples

```text
# Human only — arm after reading cases
# suites/login/suite.yaml → status: armed, reviewed_by: <your handle>
PYTHONPATH=/tmp/AIOps python3 -m overlay validate --root .
```

## Performance Notes

Arm is a yaml edit + local validate. No model.

## Troubleshooting

| 现象 | 处理 |
|---|---|
| 想对本仓 live apply | 停。Phase 1 不做。 |
| Agent 代写 reviewed_by | 拒收。自己写。 |
| required_checks 抄了 Verify | 改回 job 名 Typecheck / Lint / Build and test / overlay-check。 |
| 想发下一版 tag | 确认新 tag 不存在，再 `python -m forge release --version X.Y.Z --dry-run`。不要 force-move 已有针。 |
