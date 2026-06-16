#!/usr/bin/env bash
#
# publish-lumi-plugin.sh — one command to ship Lumi to Codex / Cursor / Gemini / OpenCode.
#
# Those tools install plugins from a REPOSITORY ROOT, but Lumi's plugin lives in the
# `claude-plugin/` subfolder of this monorepo. This script copies that self-contained
# plugin package into its own standalone repo and publishes it, so each tool can install it.
#
# Prerequisites (run on your PC, not in the sandbox):
#   - GitHub CLI installed + authenticated:  gh auth login
#   - git installed
#
# Usage (from the repo root):
#   ./scripts/publish-lumi-plugin.sh [repo-name]      # default repo name: lumi-plugin
#
set -euo pipefail

REPO_NAME="${1:-lumi-plugin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/claude-plugin"

if [ ! -d "$SRC" ]; then echo "error: $SRC not found (run from the digitalproduct repo)"; exit 1; fi
if ! command -v gh >/dev/null 2>&1; then echo "error: GitHub CLI (gh) not found. Install it + 'gh auth login' first."; exit 1; fi

OWNER="$(gh api user --jq .login)"
WORK="$(mktemp -d)"
echo "→ Assembling the standalone plugin from $SRC ..."
cp -R "$SRC/." "$WORK/"

cd "$WORK"
git init -q
git add -A
git commit -q -m "Lumi plugin — multi-tool (Claude / Copilot / Codex / Cursor / Gemini / OpenCode)"
git branch -M main

echo "→ Creating and pushing github.com/$OWNER/$REPO_NAME ..."
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push

URL="https://github.com/$OWNER/$REPO_NAME"
cat <<EOF

✅ Published: $URL

Install Lumi in each tool:
  • Claude Code:   /plugin marketplace add $OWNER/$REPO_NAME   then  /plugin install lumi@lumi
  • Copilot CLI:   copilot plugin marketplace add $OWNER/$REPO_NAME   then install lumi
  • Gemini CLI:    gemini extensions install $URL
  • OpenCode:      add  "lumi@git+$URL.git"  to your opencode.json "plugin" array
  • Codex:         open /plugins, add from $URL
  • Cursor:        /add-plugin lumi  (or add from $URL in the marketplace)

Then trigger something technical and confirm a "Lumi — quick lesson" appears.
EOF
