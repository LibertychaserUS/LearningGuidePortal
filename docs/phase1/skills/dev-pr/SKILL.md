---
name: dev-pr
description: >-
  Land a Learning Guide draft PR after python -m forge check is green.
  Do not apply Rulesets, merge, or write reviewed_by / armed (use manage-repo).
  Do not change Verify. Do not vendor forge/ or overlay/. Agents must not
  self-merge.
metadata:
  short-description: Open PRs; do not arm or apply Forge
---

# Dev PR (Learning Guide)

You write product code and draft Overlay files. You do **not** manage merge gates. Pin `/tmp/AIOps` at `overlay-v1.0.1`. SOP: [`../use-forge/SKILL.md`](../use-forge/SKILL.md), [`../use-overlay/SKILL.md`](../use-overlay/SKILL.md).

## Instructions

1. **Local gate first.** Red → no push, no PR.

```text
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
```

2. **Open a draft PR** on a `cursor/` branch. Prefer the host’s normal PR path if you do not hold `FORGE_SUBMIT_TOKEN`. `forge submit` requires that token even on `--dry-run` (tool-repo `docs/submit-credential.md`). Ambient `gh auth` is not enough. Never push `main`. Never merge.
3. **Do not live `forge apply`.** Do not edit Rulesets, required checks, or `overlay-check.yml`.
4. **Overlay stays draft.** Do not write `reviewed_by`. Do not set `status: armed` or `blocked`.
5. **Do not change Verify.** Do not add `test:io` to `test:ci`.
6. **Fix armed-red** by fixing that `function_id`’s code or `product_command`. Do not re-arm to “make it pass.” On fork `main`, login / payment / portal / my-learning are already `armed` (human squash #4); never touch their `status` / `reviewed_by`. New suites you add stay `draft`.

## Never

- Do not vendor the tool.
- Do not pin `main`. Do not force-move `1.0.0`.
- Do not self-merge or self-approve.
- Do not hit `ilovelearningguide.com`.
- Do not invent `python -m forge brief|credential|ops-chain|revoke`.

## Examples

```text
git switch -c cursor/fix-slice
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
# then open a draft PR; do not merge
```

## Performance Notes

`forge check` is local. Overlay model tokens are not spent on push.

## Troubleshooting

| 现象 | 处理 |
|---|---|
| 想直推 main | 停。先 `forge check`，再开 draft PR。 |
| `forge check` 红了 | 停。按清单修。 |
| 缺 `FORGE_SUBMIT_TOKEN` 还想 `forge submit` | 停。用 host PR 路径，或先持钥。 |
| 想把 draft 标 armed | 停。`$manage-repo`。 |
| 想改 Verify / 加 test:io | 停。 |
