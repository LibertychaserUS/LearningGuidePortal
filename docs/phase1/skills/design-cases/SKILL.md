---
name: design-cases
description: Design Learning Guide Overlay cases — leaf triad Functional / Negative / Edge plus declared invariants. Use when writing cases.md or invariants.yaml or running overlay cover. Not line coverage. Use with use-overlay. Do not arm. Do not use ### Depth or ## Specified.
metadata:
  short-description: Overlay triad, invariants, unique function_id
---

# Design Cases (Learning Guide)

Define Overlay “full cover” before writing any `cases.md`. Operate Overlay with [`../use-overlay/SKILL.md`](../use-overlay/SKILL.md). Product leaves and lock status: [`../overlay-forge-brief.md`](../overlay-forge-brief.md) §7–§8.

## Instructions

Full cover is three layers — not PRD scan, not line coverage, not N×N leaves:

| Layer | What is standard |
|---|---|
| Leaf techniques | Each `function_id` has Functional / Negative / Edge |
| Invariants | Each declared invariant is cited in some `cases.md` |
| Interaction | Only when leaves are already coupled (`span: interaction` + `relates`) |

Write any `cases.md` only after reading the whole overlay root: all `inbox/*.md`, all `suites/*/cases.md`, `invariants.yaml`, and “不得 / 永不” sentences in Phase 1 docs.

### 1. Inventory

List existing `function_id`s (AUTH-01..06, PAY-01..10, portal / my-learning ids). Copy them. Do not invent `E2E-B1` / `CROSS-01` / `REQ-n`.

### 2. Leaf triad

Each `function_id` is a `## <id>` section. The three `###` titles must be these words (case-insensitive):

```markdown
## AUTH-01
### Functional
### Negative
### Edge
```

**Do not** write `### Depth`. **Do not** write `## Specified / not tested now`. `function_id` is globally unique. `invariants.yaml` `function_ids` must match existing `##` titles.

### 3. Invariants

This repo already has `INV-unauth-no-grant`, `INV-browser-not-price`, `INV-one-charge`. Each must appear as a token in some `cases.md`. Do not point an invariant at a `##` title that does not exist.

### 4. Interaction only when coupled

Shared session / entitlement / “不得同时” → one case on the leaf that fails first, plus `span: interaction` and `relates`. No pairwise explosion.

### 5. Human review

`cover` prints the matrix. Humans decide `blocked` / `armed`. Models do not arm.

## Never

- Do not change Verify. Do not add `test:io` to `test:ci`.
- Do not hit `ilovelearningguide.com`.
- Do not generate on push. Do not write `reviewed_by`.
- Do not vendor `forge/` / `overlay/`.

## Examples

```text
PYTHONPATH=/tmp/AIOps python3 -m overlay cover --root .
```

Half-locked PAY leaves stay in cases for humans; do not pretend HTTP already locked Stripe internals.

## Performance Notes

`cover` / `validate` only scan this repo’s YAML and Markdown.

## Troubleshooting

| 现象 | 处理 |
|---|---|
| armed 缺 Edge | 补 `### Edge`，不要用 `### Depth`。 |
| 写了 `## Specified` | 改成段落。 |
| 跨套件重复 function_id | 换一个稳定唯一的 id。 |
| invariant 点了不存在的 `##` | 先对齐标题。 |
| 想两两组合所有叶子 | 停。没有耦合就不是测试项。 |
