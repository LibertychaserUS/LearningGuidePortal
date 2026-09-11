#!/usr/bin/env bash
# Materialize LibertychaserUS/AIOps branch cursor/forge-docs-pin-2e0c from current main.
# One command from a Learning Guide checkout (this PR), on a machine with AIOps contents:write:
#
#   bash docs/phase1/aiops-release/land-docs-pin.sh --push
#
# Without --push: applies locally and prints the push / PR commands.
# Never force-moves overlay-v1.0.0 / forge-v1.0.0. Does not publish 1.0.1.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
DEST=${AIOPS_DIR:-/tmp/AIOps-docs-pin}
BRANCH=cursor/forge-docs-pin-2e0c
REMOTE=https://github.com/LibertychaserUS/AIOps.git
PUSH=0

usage() {
  sed -n '2,10p' "$0"
  echo "Usage: $0 [--push] [--dir PATH]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=1; shift ;;
    --dir) DEST=$2; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

shopt -s nullglob
PATCHES=("$HERE"/000*.patch)
if [[ ${#PATCHES[@]} -eq 0 ]]; then
  echo "no 000*.patch next to $HERE" >&2
  exit 2
fi

if [[ ! -d "$DEST/.git" ]]; then
  git clone "$REMOTE" "$DEST"
fi
git -C "$DEST" fetch origin main
git -C "$DEST" am --abort 2>/dev/null || true
git -C "$DEST" checkout --no-track -B "$BRANCH" origin/main
git -C "$DEST" am "${PATCHES[@]}"

echo "landed $BRANCH at $(git -C "$DEST" rev-parse HEAD)"
echo "base origin/main $(git -C "$DEST" rev-parse origin/main)"

if [[ "$PUSH" -eq 1 ]]; then
  git -C "$DEST" push -u origin "$BRANCH"
  echo "pushed origin/$BRANCH"
  echo "open PR: gh pr create --repo LibertychaserUS/AIOps --base main --head $BRANCH --draft --title 'docs(docs/agent): pin published v1.0.0 and add zh-CN README'"
else
  echo "Next (needs contents:write on LibertychaserUS/AIOps, not cursor[bot]):"
  echo "  git -C $DEST push -u origin $BRANCH"
  echo "  gh pr create --repo LibertychaserUS/AIOps --base main --head $BRANCH --draft --title 'docs(docs/agent): pin published v1.0.0 and add zh-CN README'"
fi
