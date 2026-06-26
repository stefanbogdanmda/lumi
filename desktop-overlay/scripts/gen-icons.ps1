# Generate the full Tauri icon set (Windows / PowerShell).
#
# Produces the canonical multi-resolution icons (32x32.png, 128x128.png,
# 128x128@2x.png, icon.icns, icon.ico, Square*Logo.png, etc.) in src-tauri/icons/
# from the Lumi source PNG.
#
# Requires `npm install` first (fetches @tauri-apps/cli — a PREBUILT binary, so
# Rust is NOT needed just to generate icons). Run from the desktop-overlay folder.
#
# Usage:  .\scripts\gen-icons.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$src = Join-Path $PSScriptRoot "..\..\vscode-extension\media\icon.png"
if (-not (Test-Path $src)) {
  # Fall back to the placeholder copy committed in this repo.
  $src = Join-Path $PSScriptRoot "..\src-tauri\icons\icon.png"
}

Write-Host "[gen-icons] generating icons from: $src"
npx @tauri-apps/cli icon "$src"
Write-Host "[gen-icons] done -> src-tauri/icons/"
