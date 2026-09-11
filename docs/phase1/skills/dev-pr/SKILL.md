---
name: dev-pr
description: >-
  forge check 绿之后把 Learning Guide PR 打到 dev。不要 apply Rulesets、
  不要 merge、不要把套件改成 blocked（那是 manage-repo）。不要改 Verify。
  不要 vendor forge/ 或 overlay/。agent 不得自合。
metadata:
  short-description: PR 打到 dev；不合入、不 apply
---

# Dev PR（Learning Guide）

写产品代码和 Overlay 文件。不管合入锁。Pin `/tmp/AIOps` 为 `overlay-v2.0.0`（Forge CLI 用 `forge-v1.1.2`）。SOP：[`use-forge`](../use-forge/SKILL.md)、[`use-overlay`](../use-overlay/SKILL.md)。权威步骤见工具仓 [dev-pr](https://github.com/LibertychaserUS/AIOps/blob/forge-v1.1.2/skills/dev-pr/SKILL.md)。路径图：[dev-main-flow.md](https://github.com/LibertychaserUS/AIOps/blob/forge-v1.1.2/docs/dev-main-flow.md)。

## Instructions

1. **先过本地门。** 红 → 不 push、不开 PR。

```text
PYTHONPATH=/tmp/AIOps python3 -m forge check --root . --title "feat: subject"
```

有 `overlay.yaml` 时跑 validate + cover；有 `--title` 时跑 `pr-title`；`docs_sync` / `suite_guard` / `deny_paths` 总会跑。

2. **把 draft PR 打到 `protect[0]`（`dev`）。** `forge submit` 即使 `--dry-run` 也要 `FORGE_SUBMIT_TOKEN`（Oliver 配的环境密钥；agent 永不粘贴）。没有这把钥匙就走 host 的 PR 路径。不要推保护分支。不要 merge。`--base` 必须在 `protect`。
3. **不要 live `forge apply`。** 不要改 Ruleset、required checks、`.github/workflows/`。
4. **Overlay：不要把 `status` 改成 `blocked`。** `suite_guard` 在 agent 分支上会红。人改走 `$manage-repo`。
5. **不要改 Verify。** 不要把 `test:io` 加进 `test:ci`。
6. **Promote 不是 submit。** `dev` → `main` 用 `forge promote`，仍然不 merge。人批 + CODEOWNERS 后 merge commit。
7. 本仓四套（login / payment / portal / my-learning）已是 `active`。修红靠修该 `function_id` 的代码或 `product_command`，不要靠改 `status` 躲。

入口：[`AGENTS.md`](../../../../AGENTS.md)、[`overlay-forge-brief.md`](../../overlay-forge-brief.md)。

## Never

- 不要 vendor 工具。
- 不要 pin `main`。不要 force-move 旧针。
- 不要自 merge / 自批。
- 不要打 `ilovelearningguide.com`。
- 不要发明 `python -m forge brief|credential|ops-chain|revoke`。
- 不要在缺 `FORGE_SUBMIT_TOKEN` 时 submit。
- 不要改 `.github/workflows/`。

## Examples

```text
git switch -c cursor/fix-slice
PYTHONPATH=/tmp/AIOps python3 -m forge check --root . --title "feat: subject"
# 然后开打到 dev 的 draft PR；不要 merge
```

非法：`git push origin main`。非法：check 红还 submit。非法：agent 分支写 `status: blocked`。

## Performance Notes

`forge check` 是本地的。Overlay 模型 token 不在 push 上花。

## Troubleshooting

| 现象 | 处理 |
|---|---|
| 想直推 main | 停。先 `forge check`，再 PR 到 `dev`。 |
| `forge check` 红了 | 停。按清单修。 |
| 缺 `FORGE_SUBMIT_TOKEN` 还想 `forge submit` | 停。用 host PR 路径，或等 Oliver 配环境密钥。不要粘贴 token。 |
| 想把套件改成 blocked | 停。`$manage-repo`。 |
| 想改 Verify / 加 test:io | 停。 |
| `docs_sync` 红了 | 修相对链接；改 suites/inbox/配置时同步改 brief。 |
