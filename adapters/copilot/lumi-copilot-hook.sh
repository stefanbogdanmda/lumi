#!/usr/bin/env bash
# Lumi agentStop hook for GitHub Copilot CLI — when the CLI finishes responding to
# a prompt, forward the turn's text to `lumi feed --source copilot` so lessons
# stream to the Lumi overlay + panel. Mirrors vscode-extension/hook/lumi-hook.sh.
#
# Copilot delivers the hook payload as JSON on STDIN. The agentStop payload carries
# a TRANSCRIPT PATH (transcript_path / transcriptPath), not the response text — so
# we read the path, extract the text, and pipe THAT into `lumi feed`.
#
# Register in ~/.copilot/hooks/lumi.json (see adapters/copilot/hooks.json).
set -euo pipefail

payload="$(cat)"

# Resolve the Lumi CLI (same order as lumi-hook.sh).
if [ -n "${LUMI_BIN:-}" ]; then LUMI=(node "$LUMI_BIN");
elif command -v lumi >/dev/null 2>&1; then LUMI=(lumi);
else LUMI=(node "$(cd "$(dirname "$0")/../.." && pwd)/core/dist/cli-bin.js"); fi

# Pull the transcript path from the JSON (snake_case or camelCase). Prefer jq; fall
# back to node (a Lumi dependency).
transcript=""
if command -v jq >/dev/null 2>&1; then
  transcript="$(printf '%s' "$payload" | jq -r '.transcript_path // .transcriptPath // empty' 2>/dev/null || true)"
else
  transcript="$(printf '%s' "$payload" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d);
    process.stdin.on("end",()=>{ try{ const o=JSON.parse(s); process.stdout.write(o.transcript_path||o.transcriptPath||""); }catch(_){} });
  ' 2>/dev/null || true)"
fi

# Feed the transcript file if present; else the raw payload so Lumi still sees text.
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  cat "$transcript" | "${LUMI[@]}" feed --source copilot >/dev/null 2>&1 || true
else
  printf '%s' "$payload" | "${LUMI[@]}" feed --source copilot >/dev/null 2>&1 || true
fi
exit 0
