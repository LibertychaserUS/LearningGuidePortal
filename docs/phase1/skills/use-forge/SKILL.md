---
name: use-forge
description: >-
  Learning Guide developer cold start for Forge — pin published overlay-v1.0.1,
  pip install, PYTHONPATH, python -m forge check, then draft PR. Live apply and
  Rulesets belong to manage-repo. Do not use for Overlay inbox or suites
  (use use-overlay). Do not auto-merge. Do not submit when local check is red.
  Do not live-apply to this repo.
metadata:
  short-description: Six-step Forge cold start; no live apply
---

# Use Forge (Learning Guide)

Forge is the developer gate: local `check`, then optional `submit` (draft PR). It does not merge. It must not edit Overlay `status`.

**This product repo already has** `forge.yaml`. Do not vendor `forge/` or `overlay/`. Do not live-apply Rulesets. Token details: in the tool checkout, `docs/submit-credential.md`.

Pin **published** tags only: `overlay-v1.0.1` / `forge-v1.0.1` (same SHA `b4afc10ae0be4725e5109030f14a05bb2291fe4a`). Do not pin `main`. Do not force-move `1.0.0`.

Entry: [`../../../AGENTS.md`](../../../AGENTS.md) item 6 and [`../overlay-forge-brief.md`](../overlay-forge-brief.md) §11.

## Real CLI

`python -m forge --help` on the published pin:

`apply` `status` `check` `submit` `pr-title`/`title` `sop-lock` `ci-select` `ops-review` `bounce` `release`

There is **no** `brief`, `credential`, `ops-chain`, or `revoke`.

| Action | Agent | Human / Ops |
|---|---|---|
| `forge check` | yes | — |
| `forge submit` | yes, with `FORGE_SUBMIT_TOKEN` | — |
| live `forge apply` | **no** | Ops (`$manage-repo`). Learning Guide **does not** live-apply |
| write `reviewed_by` / `armed` | **no** | human review |

## Instructions

Six cold-start steps. Live apply is **not** in this list.

### 1. Checkout a published pin beside this repo

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.1
```

Need CPython **3.12+**. `forge-v1.0.1` is the same commit.

### 2. Install Python deps

```text
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
```

### 3. Keep the existing `forge.yaml` job names

This repo’s `required_checks` are the CI **job names** on a PR:

`Typecheck` / `Lint` / `Build and test` / `overlay-check`

The workflow file is named `Verify`. Do **not** put `Verify` in `required_checks`. Do not copy example `Verify` from the workshop. Do not add `test:io` to Verify.

### 4. Do not copy `forge/`

Policy text already lives in `AGENTS.md`. “Copy these files” means **text**, not `git add forge/`.

### 5. `python -m forge check` from this repo

```text
cd /path/to/LearningGuidePortal
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
```

Check also runs `overlay validate` + `overlay cover`. Red → stop. Do not push. Do not submit.

Overlay contract: [`../use-overlay/SKILL.md`](../use-overlay/SKILL.md).

### 6. Draft PR only when check is green

Hold `FORGE_SUBMIT_TOKEN` (see tool-repo `docs/submit-credential.md`). Then [`../dev-pr/SKILL.md`](../dev-pr/SKILL.md). Ambient `gh auth` is not enough. Never merge. Never arm. Never live-apply.

## Never

- Do not vendor `forge/` / `overlay/` / `schema/` / `prompts/`.
- Do not pin `main`. Do not force-move `1.0.0`.
- Do not live-apply Forge to LearningGuidePortal.
- Do not change Verify. Do not add `test:io` to `test:ci`.
- Do not hit `ilovelearningguide.com`.
- Do not write `reviewed_by` or `armed`.
- Do not invent `python -m forge brief|credential|ops-chain|revoke`.

## Examples

```text
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
```

Illegal: `required_checks: [Verify]`. Illegal: live `forge apply`. Illegal: pin `main`.

## Performance Notes

`check` is local. Token details stay in the tool checkout `docs/submit-credential.md`.

## Troubleshooting

| 现象 | 处理 |
|---|---|
| 想把 `forge/` 拷进本仓 | 停。工具留在 `/tmp/AIOps`。 |
| checkout `overlay-v1.0.1` 失败 | `git fetch --tags` 后再 pin `overlay-v1.0.1`。不要 pin `main`。 |
| `required_checks` 写成 Verify | 改成 Typecheck / Lint / Build and test / overlay-check。 |
| 想 live apply | 停。`$manage-repo`。本仓现在不 apply。 |
