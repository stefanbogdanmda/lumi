#!/usr/bin/env bash
# Lumi Stop hook: forward Claude Code's output to `lumi feed` so lessons stream to the overlay + panel.
set -euo pipefail
payload="$(cat)"
if [ -n "${LUMI_BIN:-}" ]; then LUMI=(node "$LUMI_BIN");
elif command -v lumi >/dev/null 2>&1; then LUMI=(lumi);
else LUMI=(node "$(cd "$(dirname "$0")/../.." && pwd)/core/dist/cli-bin.js"); fi
printf '%s' "$payload" | "${LUMI[@]}" feed --source claude-code >/dev/null 2>&1 || true
exit 0
