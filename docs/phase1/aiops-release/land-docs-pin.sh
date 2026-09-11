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
# --probe-write: clone/fetch + dry-run push only (no am, no PR). Exit 0 = write:yes.
# Without --push: local apply only.
# Never force-moves overlay-v1.0.0 / forge-v1.0.0. Does not publish 1.0.1.
#
# LAST_VERIFIED_MAIN is the AIOps main SHA these 000*.patch files last applied
# onto (read-only fetch). Update it when you regenerate patches.
set -euo pipefail

LG_REPO=${LG_REPO:-LibertychaserUS/LearningGuidePortal}
LG_REF=${LG_REF:-cursor/forge-agent-entry-2e0c}
AIOPS_REPO=${AIOPS_REPO:-LibertychaserUS/AIOps}
DEST=${AIOPS_DIR:-/tmp/AIOps-docs-pin}
BRANCH=cursor/forge-docs-pin-2e0c
REMOTE=https://github.com/${AIOPS_REPO}.git
TITLE='docs(docs/agent): pin published v1.0.0 and add zh-CN README'
LAST_VERIFIED_MAIN=b21dbf9641427a33640c4b11d63fb7cad102ccff
PUSH=0
NO_PR=0
FROM_GITHUB=0
PROBE_WRITE=0

usage() {
  sed -n '2,18p' "$0"
  echo "Usage: $0 [--push] [--probe-write] [--no-pr] [--from-github] [--dir PATH]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=1; shift ;;
    --probe-write) PROBE_WRITE=1; shift ;;
    --no-pr) NO_PR=1; shift ;;
    --from-github) FROM_GITHUB=1; shift ;;
    --dir) DEST=$2; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

github_login() {
  # Identity only. Never print tokens or remote URLs (they may embed PATs).
  local out
  if command -v gh >/dev/null 2>&1; then
    out=$(gh api user --jq '.login' 2>/dev/null || true)
    if [[ "$out" =~ ^[A-Za-z0-9_\[\]-]+$ ]]; then
      echo "$out"
      return 0
    fi
  fi
  return 0
}

probe_write() {
  local err login denied
  err=$(mktemp)
  if git -C "$DEST" push --dry-run origin "origin/main:refs/heads/$BRANCH" 2>"$err"; then
    echo "write:yes on $AIOPS_REPO (dry-run push of $BRANCH)"
    rm -f "$err"
    return 0
  fi
  denied=$(sed -n 's/.*denied to \([^[:space:].]*\).*/\1/p' "$err" | head -1)
  login=${denied:-$(github_login)}
  echo "write:no on $AIOPS_REPO as ${login:-unknown}." >&2
  echo "Need LibertychaserUS with contents:write. Cloud Agents: cursor[bot] and the GitHub MCP PAT cannot push AIOps." >&2
  grep -E 'Permission|denied|403|fatal' "$err" | sed 's#https://[^@]*@#https://#' >&2 || true
  rm -f "$err"
  return 1
}

sanity_docs_pin() {
  local readme="$DEST/README.md"
  local skill="$DEST/skills/manage-repo/SKILL.md"
  if [[ ! -f "$readme" ]]; then
    echo "sanity: missing $readme" >&2
    return 1
  fi
  if ! grep -q '\[`overlay-v1.0.0`\]' "$readme"; then
    echo "sanity: README pin table does not link overlay-v1.0.0" >&2
    return 1
  fi
  if grep -nE 'gh skill install.*--agent copilot' "$readme" "$DEST/README.zh-CN.md" 2>/dev/null; then
    echo "sanity: README still installs with invalid --agent copilot" >&2
    return 1
  fi
  if grep -nE '^\s*git checkout overlay-v1\.0\.1\s*$' "$readme"; then
    echo "sanity: README still instructs checkout of missing overlay-v1.0.1" >&2
    return 1
  fi
  if [[ -f "$skill" ]] && command -v python3 >/dev/null 2>&1; then
    if ! python3 - "$skill" <<'PY'
import pathlib, sys
try:
    import yaml
except ImportError:
    sys.exit(0)
text = pathlib.Path(sys.argv[1]).read_text()
parts = text.split("---", 2)
if len(parts) < 3:
    print("sanity: manage-repo missing frontmatter", file=sys.stderr)
    sys.exit(1)
data = yaml.safe_load(parts[1])
if not isinstance(data, dict) or data.get("name") != "manage-repo":
    print("sanity: manage-repo frontmatter is not a mapping (unquoted Ops only: ?)", file=sys.stderr)
    sys.exit(1)
print("sanity: manage-repo frontmatter parses")
PY
    then
      echo "sanity: manage-repo YAML failed (this is why overlay-v1.0.0 cannot gh skill install --all)" >&2
      return 1
    fi
  fi
  echo "sanity: docs-pin README + manage-repo frontmatter ok"
}

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
  existing=$(gh pr list --repo "$AIOPS_REPO" --head "${AIOPS_REPO%%/*}:$BRANCH" --state open --json url --jq '.[0].url // empty' || true)
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
MAIN_SHA=$(git -C "$DEST" rev-parse origin/main)
if [[ "$MAIN_SHA" != "$LAST_VERIFIED_MAIN" ]]; then
  echo "warning: origin/main is $MAIN_SHA; 000*.patch last verified on $LAST_VERIFIED_MAIN. Trying git am anyway." >&2
else
  echo "origin/main $MAIN_SHA matches last-verified patches"
fi

if [[ "$PUSH" -eq 1 || "$PROBE_WRITE" -eq 1 ]]; then
  if ! probe_write; then
    echo "Cloud Agents cannot land this. As Oliver: $0 --push" >&2
    exit 1
  fi
fi
if [[ "$PROBE_WRITE" -eq 1 && "$PUSH" -eq 0 ]]; then
  echo "probe-write only; not applying patches. Run without --probe-write to am, or add --push to land."
  exit 0
fi

git -C "$DEST" am --abort 2>/dev/null || true
git -C "$DEST" checkout --force --no-track -B "$BRANCH" origin/main
git -C "$DEST" clean -fd
if ! git -C "$DEST" am "${PATCHES[@]}"; then
  echo "git am failed on origin/main $MAIN_SHA. Refresh 000*.patch from a clean apply of current main, then retry." >&2
  echo "Do not force-move overlay-v1.0.0 / forge-v1.0.0. Do not publish 1.0.1." >&2
  exit 2
fi
sanity_docs_pin

# Local forge checks must not block --push. Oliver may have git+gh only.
if command -v python3 >/dev/null 2>&1; then
  if ! PYTHONPATH="$DEST" python3 -m forge sop-lock --root "$DEST"; then
    echo "warning: local sop-lock failed; continuing (CI will re-check)" >&2
  fi
  if ! PYTHONPATH="$DEST" python3 -m forge pr-title --title "$TITLE"; then
    echo "warning: local pr-title failed; continuing (CI will re-check)" >&2
  fi
fi

echo "landed $BRANCH at $(git -C "$DEST" rev-parse HEAD)"
echo "base origin/main $(git -C "$DEST" rev-parse origin/main)"

if [[ "$PUSH" -eq 0 ]]; then
  echo "Next (needs contents:write on $AIOPS_REPO, as you — not cursor[bot]):"
  echo "  $0 --push --dir $DEST"
  exit 0
fi

if ! git -C "$DEST" push -u origin "$BRANCH"; then
  login=$(github_login)
  echo "push failed as ${login:-unknown}. Run this command as LibertychaserUS with contents:write on $AIOPS_REPO (not cursor[bot])." >&2
  echo "Cloud Agents: environment repos are Learning Guide only until AIOps is added with contents:write." >&2
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
