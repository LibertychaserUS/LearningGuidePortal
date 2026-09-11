---
name: use-overlay
description: >-
  Operate Overlay on Learning Guide — inbox, suites, validate, cover, select.
  Pin overlay-v1.0.0. Leaves must use ### Functional / ### Negative / ### Edge.
  Do not generate or arm. Do not replace the existing overlay-check.yml reusable
  caller. Do not use for GitHub Rulesets (use use-forge).
metadata:
  short-description: Overlay contract and validate; no arm
---

# Use Overlay (Learning Guide)

Overlay turns requirement leaves into reviewable suites. CI runs only **`armed`**. `draft` / `blocked` drop and must not redden `overlay-check`.

This repo already has `overlay.yaml`, `inbox/`, `suites/`, `invariants.yaml`, and `.github/workflows/overlay-check.yml`. Do not vendor `overlay/`. Agents never write `reviewed_by` and never arm.

Pin **`overlay-v1.0.0`**. Do not checkout `overlay-v1.0.1`. Case method: [`../design-cases/SKILL.md`](../design-cases/SKILL.md). Brief: [`../overlay-forge-brief.md`](../overlay-forge-brief.md).

## Contract (leaves)

`overlay validate` treats every `##` heading’s first whitespace-free token as a `function_id`. Armed leaves need three `###` technique headings.

```markdown
## AUTH-01
### Functional
### Negative
### Edge
```

- Technique headings must be **`### Functional` / `### Negative` / `### Edge`**. **Do not** use `### Depth`.
- **Do not** use `## Specified` (or any prose `##`). It becomes a `function_id`.
- `function_id` is globally unique across this overlay root.
- `invariants.yaml` `function_ids` must match existing `##` titles. The invariant id must appear as a token in some `cases.md`.
- Login / payment suites in **this** product repo are `draft` (not the workshop fixture `blocked`). Do not copy fixture status. Do not arm.

## Instructions

1. Checkout the pin: `git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps && git -C /tmp/AIOps checkout overlay-v1.0.0`
2. `python3 -m pip install -r /tmp/AIOps/requirements.txt` and `export PYTHONPATH=/tmp/AIOps`
3. Write or edit `inbox/<id>.md` and `suites/<id>/` as **draft**. One slice = one id. Use existing AUTH- / PAY- / portal ids — do not invent `REQ-n`.
4. Design cases against the **whole** overlay root (`$design-cases`).
5. Validate:

```text
PYTHONPATH=/tmp/AIOps python3 -m overlay validate --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay cover --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay select --branch main --root .
```

6. Humans arm or block (`$manage-repo`). Agents must not.
7. **Keep** `.github/workflows/overlay-check.yml`. It already `uses: LibertychaserUS/AIOps/.github/workflows/overlay.yml@overlay-v1.0.0` plus a wrapper job named `overlay-check`. Do **not** replace it with a different inline job or a different pin. Never pin `main`. Never `workflow_call` Verify.

## Never

- Do not vendor `overlay/` / `forge/`.
- Do not change Verify. Do not add `test:io` to `test:ci`.
- Do not hit `ilovelearningguide.com`.
- Do not generate on push. Do not arm. Do not write `reviewed_by`.
- Do not copy workshop `pr-title` / `sop-lock` into this repo’s CI.

## Examples

```text
PYTHONPATH=/tmp/AIOps python3 -m overlay validate --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay cover --root .
# select --branch main: draft suites drop; overlay-check stays green
```

## Performance Notes

validate / cover / select are local YAML. No model. `run` only executes `armed` `product_command`.

## Troubleshooting

| 现象 | 处理 |
|---|---|
| 想把 `overlay/` 拷进本仓 | 停。`PYTHONPATH=/tmp/AIOps`。 |
| `### Depth` / `## Specified` | 契约红。改成 `### Edge`；Specified 改成段落。 |
| 跨套件重复 `function_id` | 契约红。全局唯一。 |
| invariant 点了不存在的 `##` | 契约红。先对齐标题。 |
| 想把 overlay-check 改成另一种形状 | 停。已有 reusable + wrapper，不要换。 |
| 想 pin `main` 或 `v1.0.1` | 停。pin `overlay-v1.0.0`。 |
