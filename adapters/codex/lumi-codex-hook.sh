#!/usr/bin/env bash
# Lumi Codex notify hook — forward Codex's turn output to `lumi feed --source codex`
# so lessons stream to the Lumi overlay. Mirrors vscode-extension/hook/lumi-hook.sh.
#
# Codex invokes its `notify` program with ONE argument: a JSON string for the event
# (e.g. {"type":"agent-turn-complete","last-assistant-message":"...", ...}).
# Codex passes the payload as argv[1], NOT stdin (unlike the Claude Stop hook).
#
# Register in ~/.codex/config.toml (user-level, before any [table] sections):
#   notify = ["bash", "/ABS/PATH/adapters/codex/lumi-codex-hook.sh"]
set -euo pipefail

# Codex passes the notification JSON as the first argument.
payload="${1:-}"
[ -n "$payload" ] || exit 0

# Resolve the Lumi CLI (same order as lumi-hook.sh).
if [ -n "${LUMI_BIN:-}" ]; then LUMI=(node "$LUMI_BIN");
elif command -v lumi >/dev/null 2>&1; then LUMI=(lumi);
else LUMI=(node "$(cd "$(dirname "$0")/../.." && pwd)/core/dist/cli-bin.js"); fi

# Only act on completed turns; extract the assistant's reply text from the JSON.
# node is already a Lumi dependency, so no extra tooling (jq) is required.
text="$(printf '%s' "$payload" | node -e '
  let s = "";
  process.stdin.on("data", d => s += d);
  process.stdin.on("end", () => {
    try {
      const n = JSON.parse(s);
      if (n.type && n.type !== "agent-turn-complete") process.exit(0);
      process.stdout.write(n["last-assistant-message"] || "");
    } catch (_) { /* not JSON we understand — emit nothing */ }
  });
' 2>/dev/null || true)"

[ -n "$text" ] || exit 0

printf '%s' "$text" | "${LUMI[@]}" feed --source codex >/dev/null 2>&1 || true
exit 0
