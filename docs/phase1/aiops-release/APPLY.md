# Apply the AIOps docs/skills pin (human, write access required)

This Cloud Agent environment can **read** `LibertychaserUS/AIOps` and can **write** `LibertychaserUS/LearningGuidePortal`. It cannot write AIOps:

| Path | Result |
|---|---|
| `git push` as `cursor[bot]` | `403 Permission to LibertychaserUS/AIOps.git denied to cursor[bot]` |
| GitHub MCP (login `LibertychaserUS`) `create_branch` / `create_or_update_file` / `fork_repository` / `create_repository` / `issue_write` | `403 Resource not accessible by personal access token` |
| `gh repo fork` | `403 Resource not accessible by integration` |

Cursor Cloud environment repos for this run: **only** `github.com/LibertychaserUS/LearningGuidePortal` (no AIOps write grant).

GitHub today (do not invent tags):

- [`overlay-v1.0.0`](https://github.com/LibertychaserUS/AIOps/releases/tag/overlay-v1.0.0) and [`forge-v1.0.0`](https://github.com/LibertychaserUS/AIOps/releases/tag/forge-v1.0.0) at SHA `235e514e673fa68b24879c8e139f2a5c6633ebb5`
- **No** `overlay-v1.0.1` / `forge-v1.0.1`
- `main` README still tells agents to pin `v1.0.1` and `gh skill install … --pin overlay-v1.0.1`

Never force-move `1.0.0`. Never pin `main` for the Python checkout.

## 1. Land the docs/skills PR on AIOps (needed)

Local commits already prepared: `8fa3e7b` + `beae731` on `cursor/forge-docs-pin-2e0c` (not on GitHub).

On a machine where **you** (not `cursor[bot]`) have `contents:write` on `LibertychaserUS/AIOps`:

```text
git clone https://github.com/LibertychaserUS/AIOps.git
cd AIOps
git checkout main
git pull origin main
git checkout -b cursor/forge-docs-pin-2e0c
git am /path/to/LearningGuidePortal/docs/phase1/aiops-release/0001-docs-docs-agent-pin-published-v1.0.0-and-add-zh-CN-R.patch
git am /path/to/LearningGuidePortal/docs/phase1/aiops-release/0002-docs-docs-agent-fix-gh-skill-host-ids-and-Learning-G.patch
git am /path/to/LearningGuidePortal/docs/phase1/aiops-release/0003-docs-docs-agent-quote-skill-frontmatter-so-gh-skill-.patch
git push -u origin cursor/forge-docs-pin-2e0c
# open PR into main (draft is fine)
```

That PR points every public README / skill / `gh skill install --pin` example at **existing** `overlay-v1.0.0`, adds `README.zh-CN.md`, and splits live `apply` out of `use-forge`.

After it is on `main`:

```text
python3 -m forge sop-lock --root .
```

## 2. Optional — publish 1.0.1 after the docs PR is on main

Only if you have release / `contents:write`. Dry-run first. Do **not** move `1.0.0`.

```text
cd /path/to/AIOps
git checkout main && git pull
python3 -m pip install -r requirements.txt
export PYTHONPATH=$PWD
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1 --dry-run
python3 -m forge release --repo LibertychaserUS/AIOps --version 1.0.1
# or Actions workflow "release" → Run workflow → version=1.0.1, products=both
```

If you publish 1.0.1 **from current main without step 1**, tags would exist but `use-forge` would still list `apply` in its old install steps and there would be no `README.zh-CN.md`. Prefer step 1 first. After 1.0.1 exists, change pins from `v1.0.0` to `v1.0.1` in a follow-up.

## 3. Other agents — until AIOps GitHub is updated

In **this** product repo, skills are already on standard paths (this PR):

- `.agents/skills/{use-forge,use-overlay,design-cases,dev-pr,manage-repo}`
- `.cursor/skills/…`
- `.claude/skills/…`

Tool checkout still uses the published pin:

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.0
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
```

Install workshop skills from the **existing** tag (older `use-forge` text still mentions apply — follow this repo’s six-step `$use-forge` instead). On `overlay-v1.0.0`, `manage-repo` fails `gh skill install --all` because its description contains unquoted `Ops only:` (invalid YAML). The third patch quotes that frontmatter.

```text
gh skill install LibertychaserUS/AIOps --agent codex --pin overlay-v1.0.0 --all
gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v1.0.0 --all
gh skill install LibertychaserUS/AIOps --agent claude-code --pin overlay-v1.0.0 --all
```

Until the AIOps patches land, install **this product repo’s** skills (hidden standard paths):

```text
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
# or from GitHub after this PR is merged to main (pin the PR head SHA until then)
# gh skill install LibertychaserUS/LearningGuidePortal --all --allow-hidden-dirs --agent cursor
```

`gh skill` host ids are `codex`, `cursor`, `claude-code`, `github-copilot`. There is no `--agent copilot`.
