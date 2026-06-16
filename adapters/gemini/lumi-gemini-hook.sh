#!/usr/bin/env bash
# Lumi AfterAgent hook for Gemini CLI — forward the model's response to
# `lumi feed --source gemini` so lessons stream to the Lumi overlay.
#
# Gemini CLI fires AfterAgent after the model's final turn response and passes a
# JSON object on stdin containing `prompt_response` (the model's text).
# Contract: write logs to stderr, write ONLY the final JSON object to stdout, exit 0.
#
# Register via the extension's hooks/hooks.json (see adapters/gemini/hooks.json)
# or by merging that block into ~/.gemini/settings.json.
#
# Known Gemini bug (#15712): AfterAgent may skip text-only turns; for one-shot use
# the generic wrapper still works: gemini -p "..." | lumi feed --source gemini
set -euo pipefail

payload="$(cat)"

# Extract the model's response text (.prompt_response). Prefer jq; fall back to node
# (a Lumi dependency); last resort, pass the whole payload (the detector tolerates it).
if command -v jq >/dev/null 2>&1; then
  response="$(printf '%s' "$payload" | jq -r '.prompt_response // empty' 2>/dev/null || true)"
else
  response="$(printf '%s' "$payload" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d);
    process.stdin.on("end",()=>{ try{ process.stdout.write(JSON.parse(s).prompt_response||""); }catch(_){ process.stdout.write(s); } });
  ' 2>/dev/null || printf '%s' "$payload")"
fi

# Resolve the Lumi CLI (same order as lumi-hook.sh).
if [ -n "${LUMI_BIN:-}" ]; then LUMI=(node "$LUMI_BIN");
elif command -v lumi >/dev/null 2>&1; then LUMI=(lumi);
else LUMI=(node "$(cd "$(dirname "$0")/../.." && pwd)/core/dist/cli-bin.js"); fi

# Feed the response. Keep Lumi's output OFF stdout (Gemini requires JSON-only stdout)
# and never let a failure break the user's turn.
if [ -n "$response" ]; then
  printf '%s' "$response" | "${LUMI[@]}" feed --source gemini >/dev/null 2>&1 || true
fi

# Required stdout: a single JSON object, non-blocking.
printf '%s\n' '{"decision":"allow"}'
exit 0
