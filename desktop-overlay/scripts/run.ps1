# Lumi Overlay launcher (Windows / PowerShell) — FALLBACK.
#
# The native shell already starts `lumi serve` on its own (see src-tauri/src/lib.rs),
# so normally you can just run `npm run tauri dev`. This script is a belt-and-suspenders
# fallback: it ensures `lumi serve` is up, then launches the dev window, and stops the
# server it started when you quit.
#
# Usage:  .\scripts\run.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$port = 4321
$serverJob = $null

function Test-PortOpen([int]$p) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect("127.0.0.1", $p)
    $client.Close()
    return $true
  } catch { return $false }
}

if (Test-PortOpen $port) {
  Write-Host "[run] lumi serve already running on port $port; reusing it."
} else {
  Write-Host "[run] starting lumi serve on port $port..."
  # NOTE: stopping this job may not kill node grandchildren spawned by the lumi shim.
  # The native shell's own spawn (lib.rs) handles clean shutdown; this is a fallback.
  $serverJob = Start-Job -ScriptBlock { lumi serve --port 4321 }
}

try {
  npm run tauri dev
} finally {
  if ($serverJob) {
    Write-Host "[run] stopping lumi serve..."
    Stop-Job   $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
  }
}
