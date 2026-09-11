#!/usr/bin/env bash
# Land LibertychaserUS/AIOps docs-pin (published v1.0.0 + zh-CN) and open a draft PR.
#
# One command, as a human with contents:write on AIOps (not cursor[bot]):
#
#   bash docs/phase1/aiops-release/land-docs-pin.sh --push
#
# Same outcome from any directory (fetches this PR's 000*.patch files):
#
#   curl -fsSL https://raw.githubusercontent.com/LibertychaserUS/LearningGuidePortal/cursor/forge-agent-entry-2e0c/docs/phase1/aiops-release/land-docs-pin.sh | bash -s -- --push
#
# --push applies current AIOps main, pushes cursor/forge-docs-pin-2e0c, opens/reuses a draft PR.
# Without --push: local apply only.
# Never force-moves overlay-v1.0.0 / forge-v1.0.0. Does not publish 1.0.1.
set -euo pipefail

LG_REPO=${LG_REPO:-LibertychaserUS/LearningGuidePortal}
LG_REF=${LG_REF:-cursor/forge-agent-entry-2e0c}
AIOPS_REPO=${AIOPS_REPO:-LibertychaserUS/AIOps}
DEST=${AIOPS_DIR:-/tmp/AIOps-docs-pin}
BRANCH=cursor/forge-docs-pin-2e0c
REMOTE=https://github.com/${AIOPS_REPO}.git
TITLE='docs(docs/agent): pin published v1.0.0 and add zh-CN README'
PUSH=0
NO_PR=0
FROM_GITHUB=0

usage() {
  sed -n '2,16p' "$0"
  echo "Usage: $0 [--push] [--no-pr] [--from-github] [--dir PATH]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=1; shift ;;
    --no-pr) NO_PR=1; shift ;;
    --from-github) FROM_GITHUB=1; shift ;;
    --dir) DEST=$2; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

pr_body() {
  cat <<'EOF'
## 做了什么

- Pin every public README / skill / `gh skill install --pin` example to **existing** `overlay-v1.0.0` / `forge-v1.0.0` (same SHA). Stop telling agents to checkout missing `v1.0.1`.
- Add `README.zh-CN.md` and mutual EN ↔ zh-CN links.
- `use-forge` is the six-step **dev** cold start only (no live `apply` in that skill).
- Quote `manage-repo` frontmatter so `gh skill install --all` works.
- `gh skill` host ids: `codex` / `cursor` / `claude-code` (no `--agent copilot`).
- Forge first-run: contrast the existing landing path and wait for an explicit yes; after one yes, default-run `check` → `submit`.

## 为什么

AIOps `main` still tells agents to pin `v1.0.1`, but GitHub only has `1.0.0`. That is the workshop entry other agents follow. Learning Guide is a fixture, not a second official pin.

## 动了哪些门

- 通用 `pr-title` / `sop-lock`（永远跑）.
- `docs` title → product overlay-check / forge-check skipped.
- No Overlay / Verify rewrite. No live `forge apply`. No tag move.

## 怎么验

```text
git checkout overlay-v1.0.0   # until this PR is on main AND a human publishes 1.0.1
python3 -m pip install -r requirements.txt
export PYTHONPATH=$PWD
python3 -m forge check --root . --title "docs(docs/agent): pin published v1.0.0 and add zh-CN README"
python3 -m forge sop-lock --root .
python3 -m forge pr-title --title "docs(docs/agent): pin published v1.0.0 and add zh-CN README"
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
```

## 不做什么

- Do not publish `overlay-v1.0.1` / `forge-v1.0.1` until this is on `main`.
- Never force-move `1.0.0`. Never pin `main` for the Python checkout.
- Do not vendor `forge/` / `overlay/` into a product repo.
- Do not rewrite Overlay or Verify to “make Forge work.”
- Do not live-apply Rulesets or let an agent write `reviewed_by` / `armed`.

## 分工

- 审：Oliver Zhang (LibertychaserUS)
- 合：Oliver Zhang after `pr-title` / `sop-lock` are green. Squash, then 换底 from the new `main` SHA before any 1.0.1 release.
EOF
}

resolve_patch_dir() {
  local src=${BASH_SOURCE[0]:-$0}
  local dir=""
  if [[ "$FROM_GITHUB" -eq 0 && -f "$src" ]]; then
    dir=$(cd "$(dirname "$src")" 2>/dev/null && pwd || true)
  fi
  if [[ -n "${dir:-}" ]]; then
    shopt -s nullglob
    local local_patches=("$dir"/000*.patch)
    if [[ ${#local_patches[@]} -gt 0 ]]; then
      PATCH_DIR=$dir
      echo "using local patches in $PATCH_DIR"
      return
    fi
  fi

  local tmp
  tmp=$(mktemp -d)
  echo "fetching patches from https://github.com/${LG_REPO}/tree/${LG_REF}/docs/phase1/aiops-release"
  git clone --depth 1 --branch "$LG_REF" "https://github.com/${LG_REPO}.git" "$tmp/lg"
  PATCH_DIR="$tmp/lg/docs/phase1/aiops-release"
  shopt -s nullglob
  local remote_patches=("$PATCH_DIR"/000*.patch)
  if [[ ${#remote_patches[@]} -eq 0 ]]; then
    echo "no 000*.patch on ${LG_REPO}@${LG_REF}" >&2
    exit 2
  fi
}

open_or_reuse_pr() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "gh not found; push succeeded. Open the draft PR as yourself:" >&2
    echo "  gh pr create --repo $AIOPS_REPO --base main --head $BRANCH --draft --title $(printf %q "$TITLE")"
    return 1
  fi
  local existing
  existing=$(gh pr list --repo "$AIOPS_REPO" --head "$BRANCH" --state open --json url --jq '.[0].url // empty' || true)
  if [[ -n "${existing:-}" ]]; then
    echo "draft PR already open: $existing"
    return 0
  fi
  local body_file
  body_file=$(mktemp)
  pr_body >"$body_file"
  gh pr create --repo "$AIOPS_REPO" --base main --head "$BRANCH" --draft \
    --title "$TITLE" --body-file "$body_file"
}

resolve_patch_dir
shopt -s nullglob
PATCHES=("$PATCH_DIR"/000*.patch)
if [[ ${#PATCHES[@]} -eq 0 ]]; then
  echo "no 000*.patch in $PATCH_DIR" >&2
  exit 2
fi

if [[ ! -d "$DEST/.git" ]]; then
  git clone "$REMOTE" "$DEST"
fi
git -C "$DEST" fetch origin main
git -C "$DEST" am --abort 2>/dev/null || true
git -C "$DEST" checkout --no-track -B "$BRANCH" origin/main
git -C "$DEST" am "${PATCHES[@]}"

if command -v python3 >/dev/null 2>&1; then
  PYTHONPATH="$DEST" python3 -m forge sop-lock --root "$DEST"
  PYTHONPATH="$DEST" python3 -m forge pr-title --title "$TITLE"
fi

echo "landed $BRANCH at $(git -C "$DEST" rev-parse HEAD)"
echo "base origin/main $(git -C "$DEST" rev-parse origin/main)"

if [[ "$PUSH" -eq 0 ]]; then
  echo "Next (needs contents:write on $AIOPS_REPO, as you — not cursor[bot]):"
  echo "  $0 --push --dir $DEST"
  exit 0
fi

if ! git -C "$DEST" push -u origin "$BRANCH"; then
  echo "push failed. Run this command as a human who can write $AIOPS_REPO." >&2
  echo "Cloud Agents: add https://github.com/${AIOPS_REPO} to the environment and grant contents:write, then start a new agent." >&2
  exit 1
fi
echo "pushed origin/$BRANCH"

if [[ "$NO_PR" -eq 1 ]]; then
  echo "skipped PR (--no-pr). Open when ready:"
  echo "  gh pr create --repo $AIOPS_REPO --base main --head $BRANCH --draft --title $(printf %q "$TITLE")"
  exit 0
fi

open_or_reuse_pr
echo "Do not publish overlay-v1.0.1 / forge-v1.0.1 until this PR is on main. Never force-move 1.0.0."
