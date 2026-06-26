#!/usr/bin/env bash
# Lumi Overlay launcher (macOS / Linux) — FALLBACK.
#
# The native shell already starts `lumi serve` on its own (see src-tauri/src/lib.rs),
# so normally you can just run `npm run tauri dev`. This script is a belt-and-suspenders
# fallback: it ensures `lumi serve` is up, then launches the dev window, and stops the
# server it started when you quit.
#
# Usage:  ./scripts/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=4321
SERVER_PID=""

port_open() {
  # Bash /dev/tcp probe — no external tools needed.
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && exec 3>&- 3<&-
}

if port_open; then
  echo "[run] lumi serve already running on port $PORT; reusing it."
else
  echo "[run] starting lumi serve on port $PORT..."
  lumi serve --port "$PORT" &
  SERVER_PID=$!
fi

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "[run] stopping lumi serve (pid $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

npm run tauri dev
