# Apply the AIOps docs/skills pin

**One command** on a machine where **you** (not `cursor[bot]`) have `contents:write` on `LibertychaserUS/AIOps`. From this Learning Guide checkout:

```text
bash docs/phase1/aiops-release/land-docs-pin.sh --push
```

That clones current AIOps `main`, creates `cursor/forge-docs-pin-2e0c`, `git am`s every `000*.patch` in this directory (verified clean on `origin/main` `b21dbf9`), and pushes the branch. Then:

```text
gh pr create --repo LibertychaserUS/AIOps --base main --head cursor/forge-docs-pin-2e0c --draft \
  --title 'docs(docs/agent): pin published v1.0.0 and add zh-CN README'
```

Dry-run without push (this Cloud Agent can do this; it cannot `--push`):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh
```

Do **not** publish `overlay-v1.0.1` / `forge-v1.0.1` until that PR is on `main`. Never force-move `1.0.0`. Never pin `main` for the Python checkout.

---

## Why a human must run `--push`

Re-checked this turn (2026-09-11). This environment still cannot write AIOps.

| Path | Result |
|---|---|
| `git push` as `cursor[bot]` | `403 Permission to LibertychaserUS/AIOps.git denied to cursor[bot]` |
| GitHub MCP (`get_me` = LibertychaserUS) `create_branch` on AIOps, LearningGuidePortal, and `microfluidic-native-physics` | `403 Resource not accessible by personal access token` |
| MCP `push_files` / `create_repository` / `fork_repository` / `issue_write` | same 403 |
| `gh repo fork` | `403 Resource not accessible by integration` |
| Cursor Cloud `environment-info.repos` | only `github.com/LibertychaserUS/LearningGuidePortal` |
| `list-self-hosted-workers` | `workers: []` |
| MCP `search_repositories user:LibertychaserUS` | lists `permissions.push: true` on AIOps and other personal repos — that is the **user’s** ACL, not this PAT. Writes still 403 on every repo tried. |
| First-Light-TechHK/AIOps via `gh` | all permission bits false |
| SSH `git@github.com` | `Host key verification failed` |

No other writable host can open a GitHub PR into AIOps (cross-repo PR requires a fork; fork create is 403).

GitHub today:

- [`overlay-v1.0.0`](https://github.com/LibertychaserUS/AIOps/releases/tag/overlay-v1.0.0) and [`forge-v1.0.0`](https://github.com/LibertychaserUS/AIOps/releases/tag/forge-v1.0.0) at `235e514e673fa68b24879c8e139f2a5c6633ebb5`
- **No** `v1.0.1` tags. **No** `README.zh-CN.md` on `main`.
- `main` README still tells agents to checkout `overlay-v1.0.1` and `gh skill install … --pin overlay-v1.0.1 --agent copilot`

After `--push` + merge, every public README / skill / `gh skill install --pin` example points at **existing** `overlay-v1.0.0`, `README.zh-CN.md` exists, `use-forge` is six-step dev only, and `manage-repo` frontmatter is valid YAML.

Then, on that tree:

```text
python3 -m forge sop-lock --root .
```

## Optional — publish 1.0.1 only after the docs PR is on main

```text
cd /path/to/AIOps
git checkout main && git pull
python3 -m pip install -r requirements.txt
export PYTHONPATH=$PWD
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1 --dry-run
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1
# or Actions workflow "release" → version=1.0.1, products=both
```

Publishing 1.0.1 from **current** `main` (without this PR) would make the README’s `v1.0.1` pin exist but ship the old `use-forge` (apply in install steps), no zh-CN, and a `manage-repo` description that breaks `gh skill install --all`.

## Other agents until AIOps GitHub is updated

Product skills (this PR): `.agents/skills`, `.cursor/skills`, `.claude/skills` → `docs/phase1/skills/`. Tool checkout stays on the **published** pin:

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.0
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
```

```text
gh skill install LibertychaserUS/AIOps --agent {codex|cursor|claude-code} --pin overlay-v1.0.0 --all
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
```

On `overlay-v1.0.0`, `manage-repo` fails `--all` (unquoted `Ops only:`). Follow this repo’s six-step `$use-forge`. `gh skill` has no `--agent copilot`.
