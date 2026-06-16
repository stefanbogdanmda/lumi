#!/usr/bin/env bash
# Lumi Cursor "stop" hook — after the agent finishes a turn, forward its transcript
# to `lumi feed --source cursor` so lessons stream to the Lumi overlay.
#
# Cursor's `stop` hook (Cursor 1.7+) passes JSON on stdin that includes
# `transcript_path` (a .jsonl conversation transcript; null if transcripts are
# disabled) rather than the response text itself, so we resolve that path and feed
# its contents (falling back to the raw payload if the path is unavailable).
#
# Register via .cursor/hooks.json or ~/.cursor/hooks.json (see adapters/cursor/hooks.json).
set -euo pipefail

payload="$(cat)"

# Resolve the Lumi CLI (same order as lumi-hook.sh).
if [ -n "${LUMI_BIN:-}" ]; then LUMI=(node "$LUMI_BIN");
elif command -v lumi >/dev/null 2>&1; then LUMI=(lumi);
else LUMI=(node "$(cd "$(dirname "$0")/../.." && pwd)/core/dist/cli-bin.js"); fi

# Extract transcript_path from the stop-hook JSON. Prefer jq; fall back to node.
if command -v jq >/dev/null 2>&1; then
  transcript_path="$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
else
  transcript_path="$(printf '%s' "$payload" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d);
    process.stdin.on("end",()=>{ try{ process.stdout.write(JSON.parse(s).transcript_path||""); }catch(_){} });
  ' 2>/dev/null || true)"
fi

if [ -n "${transcript_path:-}" ] && [ -f "$transcript_path" ]; then
  cat "$transcript_path" | "${LUMI[@]}" feed --source cursor >/dev/null 2>&1 || true
else
  printf '%s' "$payload" | "${LUMI[@]}" feed --source cursor >/dev/null 2>&1 || true
fi

exit 0
