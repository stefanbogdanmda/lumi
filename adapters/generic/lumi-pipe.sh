#!/bin/sh
# lumi-pipe.sh — Generic Lumi feed adapter
#
# Usage:
#   your-ai-tool | lumi-pipe.sh [source-name]
#
# Reads all of stdin, then hands it to the Lumi CLI feed subcommand.
# The source name (default: "generic") is recorded on each lesson event
# so you can tell which tool produced the lesson in the feed viewer.
#
# Example:
#   codex run my-task | lumi-pipe.sh codex
#   gemini-cli chat    | lumi-pipe.sh gemini
#   my-custom-tool     | lumi-pipe.sh my-custom-tool
#
# ------------------------------------------------------------------
# HONEST NOTE ON STDIN WIRING:
# The Lumi CLI binary (dist/cli-bin.js) currently receives text through
# its programmatic `input` option (used by tests and Claude Code hooks).
# Wiring real stdin into the installed binary is a small follow-up that
# needs to be confirmed on the founder's machine with a live build.
# This script documents the intended shell adapter pattern and will work
# end-to-end once that wiring is in place.
# ------------------------------------------------------------------
#
# The CLI binary is resolved in order:
#   1. LUMI_BIN env var (override for development or alternate installs)
#   2. $(npm root -g)/@lumi/core/dist/cli-bin.js (global npm install)
#   3. Relative path from this script for monorepo usage
# ------------------------------------------------------------------

set -e

SOURCE="${1:-generic}"

# Resolve the Lumi CLI binary.
if [ -n "${LUMI_BIN:-}" ]; then
  LUMI_CLI="$LUMI_BIN"
elif command -v lumi >/dev/null 2>&1; then
  # Prefer the installed `lumi` wrapper on PATH (set by npm install -g @lumi/core).
  LUMI_CLI="lumi"
else
  # Fall back to the monorepo location relative to this script.
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  LUMI_CLI="node ${SCRIPT_DIR}/../../core/dist/cli-bin.js"
fi

# Read all of stdin into a variable.
# Note: this buffers the full output in memory. For very large outputs
# (thousands of lines) a streaming approach would be better, but for
# typical AI tool responses this is fine.
INPUT="$(cat)"

if [ -z "$INPUT" ]; then
  echo "lumi-pipe: no input received — nothing to process." >&2
  exit 0
fi

# Pass input to the Lumi feed subcommand.
# When stdin wiring is confirmed in cli-bin.js, the preferred invocation
# will be:
#   printf '%s' "$INPUT" | $LUMI_CLI feed --source "$SOURCE"
# Until then, the CLI accepts input through its API; this script documents
# the intended call site.
printf '%s' "$INPUT" | $LUMI_CLI feed --source "$SOURCE"
