#!/usr/bin/env bash
# Generate the full Tauri icon set (macOS / Linux).
#
# Produces the canonical multi-resolution icons (32x32.png, 128x128.png,
# 128x128@2x.png, icon.icns, icon.ico, etc.) in src-tauri/icons/ from the Lumi
# source PNG.
#
# Requires `npm install` first (fetches @tauri-apps/cli — a PREBUILT binary, so
# Rust is NOT needed just to generate icons). Run from the desktop-overlay folder.
#
# Usage:  ./scripts/gen-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="../vscode-extension/media/icon.png"
if [ ! -f "$SRC" ]; then
  # Fall back to the placeholder copy committed in this repo.
  SRC="src-tauri/icons/icon.png"
fi

echo "[gen-icons] generating icons from: $SRC"
npx @tauri-apps/cli icon "$SRC"
echo "[gen-icons] done -> src-tauri/icons/"
