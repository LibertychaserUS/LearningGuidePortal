# Apply the AIOps docs/skills pin

**One command**, as you (Oliver Zhang / `LibertychaserUS`) with `contents:write` on `LibertychaserUS/AIOps` — not `cursor[bot]`. From this Learning Guide checkout (PR #6 / `cursor/forge-agent-entry-2e0c`):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh --push
```

That clones current AIOps `main`, `git am`s every `000*.patch` here onto `cursor/forge-docs-pin-2e0c`, pushes the branch, and opens or reuses a **draft** PR (`docs(docs/agent): pin published v1.0.0 and add zh-CN README`) with the six required headings. It does **not** publish `1.0.1`. It never force-moves `1.0.0`.

Same command if you are not in this checkout (script pulls the patches from this branch):

```text
curl -fsSL https://raw.githubusercontent.com/LibertychaserUS/LearningGuidePortal/cursor/forge-agent-entry-2e0c/docs/phase1/aiops-release/land-docs-pin.sh | bash -s -- --push
```

Dry-run (no push, no PR):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh
```

Credential probe only (clone + dry-run push, no `git am`):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh --probe-write
```

Exit 0 = `write:yes`. HTTPS / `cursor[bot]` is still `write:no`. A repo deploy key can push the branch over SSH (see Last verified).

---

## 怎么给写权限 / How to grant write

This agent already has write on **Learning Guide**. It does **not** have `contents:write` on `LibertychaserUS/AIOps`. MCP `get_me` showing LibertychaserUS is identity, not AIOps write. `gh` here is `cursor[bot]`. Environment repos: Learning Guide only. 不要粘贴 PAT。不要用 First-Light PAT。

**Path A（最快，不交 token）：** 在 PR #6 分支上，用你自己的 `gh`：

```text
bash docs/phase1/aiops-release/land-docs-pin.sh --push
```

**Path B（给下一只 Cloud Agent）：** [Environment](https://cursor.com/dashboard/cloud-agents/environments/e/bba32537-ad04-11f1-bf4b-42ffb4d10ea7) → 挂上 `LibertychaserUS/AIOps` → Cursor GitHub App 对该仓 `contents:write` → **Save** → 开一只 **新** Cloud Agent。Save 救不了当前这只。

不要让 agent pin 还不存在的 `v1.0.1` 或 `main`。

---

Until that draft is on AIOps `main`, every other agent checkouts the **existing** pin `overlay-v1.0.0` (same SHA as `forge-v1.0.0`). Ignore `main` README if it still says `v1.0.1`. Do not invent a second official pin on Learning Guide.

Forge stays full-stack **post-dev** GitHub landing (`check` → `submit`). First run: contrast the existing landing path and wait for an explicit yes. After one yes: default-run. Do not rewrite Overlay or Verify.

---

## After the draft is on `main`

```text
python3 -m forge sop-lock --root .
```

Then, and only then, optional publish:

```text
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1 --dry-run
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1
```

Publishing `1.0.1` from **today’s** `main` (no docs-pin) would make the missing tag exist while shipping old `use-forge` (apply in install steps), no zh-CN, and a `manage-repo` description that breaks `gh skill install --all`.

## Other agents until AIOps GitHub is updated

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.0
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
gh skill install LibertychaserUS/AIOps --agent {codex|cursor|claude-code} --pin overlay-v1.0.0 --all
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
```

On `overlay-v1.0.0`, `manage-repo` fails `--all` (unquoted `Ops only:`). Follow this repo’s six-step `$use-forge`. `gh skill` host ids are `codex` / `cursor` / `claude-code` (also `github-copilot`). There is **no** `--agent copilot`.

---

## Last verified (branch on GitHub; draft PR still needs Oliver)

Patches `git am` 0001–0006 onto AIOps `origin/main` **`b21dbf9641427a33640c4b11d63fb7cad102ccff`** (2026-09-11). `sanity` + `forge sop-lock` / `pr-title` ok.

**Branch is on GitHub:** `cursor/forge-docs-pin-2e0c` @ **`878a6907ab7ccca9cfc3225570574f1747e71d68`** (six commits on that main). Pushed over SSH with the repo deploy key (`cursor-cloud-aiops-deploy-2e0c`). HTTPS `land-docs-pin.sh --push` / `cursor[bot]` still cannot push.

**No draft PR yet.** `gh pr create` as `cursor[bot]` → `403 Resource not accessible by integration`. GitHub MCP `create_pull_request` as LibertychaserUS → `403 Resource not accessible by personal access token`. Deploy keys cannot open PRs.

Oliver: one click, open as **draft** (do not merge, do not tag `1.0.1`):

https://github.com/LibertychaserUS/AIOps/compare/main...cursor/forge-docs-pin-2e0c?expand=1

Title: `docs(docs/agent): pin published v1.0.0 and add zh-CN README`. Body: the six headings in `land-docs-pin.sh` / this file.

---

## Published-pin cold start (2026-09-11)

Official pin is still **`overlay-v1.0.0` / `forge-v1.0.0` @ `235e514e673fa68b24879c8e139f2a5c6633ebb5`**. `git ls-remote --tags` shows only those two tags. There are **no** `v1.0.1` tags. Do not pin `main`. AIOps `main` README still tells agents to checkout `overlay-v1.0.1` and uses `--agent copilot`.

Fresh clone (not a floating `/tmp/AIOps` checkout of `main`):

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps-pin-v1.0.0
git -C /tmp/AIOps-pin-v1.0.0 checkout overlay-v1.0.0
# HEAD 235e514e673fa68b24879c8e139f2a5c6633ebb5 (also forge-v1.0.0)
# overlay-v1.0.1 → unknown revision
python3 --version   # Python 3.12.3
python3 -m pip install -r /tmp/AIOps-pin-v1.0.0/requirements.txt
export PYTHONPATH=/tmp/AIOps-pin-v1.0.0
```

Results against this Learning Guide tree (committed suites only: login / payment / my-learning / portal — all `### Functional` / `### Negative` / `### Edge`. Do not treat leftover `/tmp` workshop fixtures or any `## Specified` draft as product truth):

```text
python3 -m overlay validate --root .     # ok (4 inbox, 4 suite)
python3 -m overlay cover --root .        # ok (19 function_id, 3 invariant)
python3 -m overlay select --branch main --root .
# dropped 4 drafts (never_red_statuses); selected=0
python3 -m forge check --root .          # ok
python3 -m forge --help
# apply status check submit pr-title|title sop-lock ci-select ops-review bounce
# no brief / credential / ops-chain / revoke; no release on this pin
```

Skill paths on the **tag**: `skills/{design-cases,dev-pr,manage-repo,use-forge,use-overlay}` and `.agents/skills/*` symlinks. **No** `.cursor/skills` or `.claude/skills` on `overlay-v1.0.0`.

`gh skill` host ids (this CLI): `cursor` / `codex` / `claude-code` / `github-copilot`. `--agent copilot` is invalid. Default non-interactive agent is `github-copilot`.

```text
gh skill install LibertychaserUS/AIOps --agent copilot --pin overlay-v1.0.0 --all
# invalid argument "copilot" for "--agent"

gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v1.0.0 --all --dir /tmp/gh-skill-pin-v1.0.0
# Using ref overlay-v1.0.0 (235e514e)
# installed design-cases / dev-pr / use-forge / use-overlay
# failed to install skill "manage-repo": invalid frontmatter YAML
#   yaml: line 2: mapping values are not allowed in this context
# exit 1

# same PARSE_FAIL on PyYAML: unquoted `Ops only:` in skills/manage-repo/SKILL.md
# use-forge alone: ok (old install steps still list apply — use this repo’s six-step $use-forge)
```

That `manage-repo` break is why **1.0.1 must not ship** until the docs-pin is on AIOps `main`. Publishing 1.0.1 from today’s `main` would create the missing tag while still teaching `v1.0.1` / `--agent copilot` and shipping the broken frontmatter. Never force-move `1.0.0`.
