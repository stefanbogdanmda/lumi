#!/usr/bin/env bash
# Lumi Stop hook for Claude Code.
# Reads the hook JSON on stdin and appends the assistant's last output text
# to the Lumi feed file, which the VS Code extension watches.
set -euo pipefail
FEED="${LUMI_FEED:-$HOME/.lumi/feed.jsonl}"
mkdir -p "$(dirname "$FEED")"
# Pass stdin through untouched as one JSON line; the extension extracts text.
payload="$(cat)"
printf '%s\n' "$payload" >> "$FEED"
exit 0
