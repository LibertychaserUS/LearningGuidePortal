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

On `overlay-v1.0.0`, `manage-repo` fails `--all` (unquoted `Ops only:`). Follow this repo’s six-step `$use-forge`. `gh skill` has no `--agent copilot`.
