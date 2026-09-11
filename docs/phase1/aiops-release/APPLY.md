# Apply the AIOps docs/skills pin

**Official pin:** `overlay-v1.0.1` / `forge-v1.0.1` @ `b4afc10ae0be4725e5109030f14a05bb2291fe4a`.

`1.0.1` is an **annotated git tag**, not a GitHub Release page. `gh release view overlay-v1.0.1` is 404. Pin [`/tree/overlay-v1.0.1`](https://github.com/LibertychaserUS/AIOps/tree/overlay-v1.0.1). Do not link `/releases/tag/overlay-v1.0.1`. Do not pin `main`. Do not force-move `1.0.0` (`235e514e673fa68b24879c8e139f2a5c6633ebb5`) or `1.0.1`. Next Release / semver is Human/Ops (`forge release` or Actions `release`).

`0001`–`0006` are already on AIOps `main`. Remaining: **`0007`** (README links → `/tree/…`) and **`0008`** (`forge check` fails on `deny_paths`). This directory lives on Learning Guide branch `cursor/forge-agent-entry-2e0c`, not on Overlay quality-gate PR #5.

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.1
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v1.0.1 --all
```

`gh skill` host ids: `codex` / `cursor` / `claude-code` / `github-copilot`.

---

## Land 0007 + 0008

From this checkout (needs write on `LibertychaserUS/AIOps` — not `cursor[bot]` HTTPS):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh --push
```

Dry-run apply (no push):

```text
bash docs/phase1/aiops-release/land-docs-pin.sh
```

The script `git am`s only `0007`+. It never force-moves tags. `cursor[bot]` cannot open the AIOps PR (`gh pr create` 403). Deploy-key SSH can push the branch; Oliver opens the draft PR.

---

## Durable deploy key (not one-shot)

The pair that landed docs-pin (`cursor-cloud-aiops-deploy-2e0c`) is still on GitHub. This Cloud Agent VM **lost that private key**. A replacement pair already exists on this environment and must be **reused**:

- Title: `cursor-cloud-aiops-deploy-448c`
- Public (safe to add):

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJTwhA9JEwDxc7lhNk0zk490uAJ57G3qv2AfcIWepTPf cursor-cloud-aiops-deploy-448c
```

Oliver, once:

1. Add that public key as a **write** deploy key on https://github.com/LibertychaserUS/AIOps/settings/keys (you may remove `2e0c`).
2. Put the matching private key in Cloud Agent environment secret `AIOPS_DEPLOY_SSH_KEY`: [bba32537-ad04-11f1-bf4b-42ffb4d10ea7](https://cursor.com/dashboard/cloud-agents/environments/e/bba32537-ad04-11f1-bf4b-42ffb4d10ea7).

Agents: do **not** generate another pair. Private file on this VM: `~/.local/share/lg-secrets/aiops-deploy-ed25519` (same key as `cursor-cloud-aiops-deploy-448c`). `land-docs-pin.sh` uses that file or `$AIOPS_DEPLOY_SSH_KEY`, and pushes over real SSH (it disables the HTTPS `insteadOf` rewrite that turns `git@` into `cursor[bot]`).

不要粘贴 PAT。不要用 First-Light PAT。

**Path B (App write):** [Environment](https://cursor.com/dashboard/cloud-agents/environments/e/bba32537-ad04-11f1-bf4b-42ffb4d10ea7) → attach `LibertychaserUS/AIOps` with `contents:write` → Save → **new** Cloud Agent. Save does not upgrade this run.

---

## Honesty that stays

- **Humans arm.** Agents must not write `reviewed_by` / `armed`. login / payment / portal / my-learning on fork `main` came through Oliver’s squash of PR #4 (`134ce2ae`). First fill of `reviewed_by: LibertychaserUS` was a Cursor Agent commit (`c3aee96e`); do not un-arm without Oliver. New suites stay draft.
- **Rulesets are a declaration.** `forge.yaml` is local. `gh api …/rulesets` is `[]` on LibertychaserUS / First-Light LearningGuidePortal and on AIOps. Phase 1 Ops does not live-apply to this product.
- **`deny_paths` is not enforced on the published 1.0.1 pin.** Official `forge check` still exits 0 if a PR touches `.github/workflows/overlay-check.yml`. `0008` makes check exit 2. Do not pin floating `main` to pick this up; Ops lands `0007`+`0008` and publishes a **new** semver.

---

## After 0007+0008 are on AIOps `main`

```text
python3 -m forge sop-lock --root .
python3 -m unittest tests.forge.test_check tests.forge.test_status -q
```

Next semver (never force-move an existing tag):

```text
python3 -m forge release --repo LibertychaserUS/AIOps --version X.Y.Z --dry-run
python3 -m forge release --repo LibertychaserUS/AIOps --version X.Y.Z
```

`cursor[bot]` cannot POST GitHub Releases (403). Deploy-key SSH can push annotated tags. Ops should create Release pages for the existing `1.0.1` tags, or own the next semver.
