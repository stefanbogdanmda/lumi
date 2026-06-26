# ============================================================================
#  Lumi terminal capture — PowerShell hook (Windows PowerShell 5.1 & PowerShell 7+)
# ----------------------------------------------------------------------------
#  WHAT THIS DOES
#  Lumi can learn from the plain shell commands you run by hand (not just from
#  AI coding tools). This snippet wraps your PowerShell `prompt` function so
#  that AFTER each command you run, it appends ONE JSON line describing that
#  command to:  ~/.lumi/terminal.jsonl
#
#  Another part of Lumi (`lumi watch` / `lumi serve`) tails that file, redacts
#  secrets a second time, and turns commands + failures into lessons.
#
#  HOW TO INSTALL (manual)
#  Add this line to your PowerShell profile ($PROFILE), then restart the shell:
#
#      . "C:\path\to\Lumi\adapters\terminal\lumi-terminal.ps1"
#
#  (The `lumi setup terminal` installer does this for you.)
#
#  PRIVACY / SAFETY
#   * Everything stays local in ~/.lumi/terminal.jsonl.
#   * Obvious secrets are scrubbed here AND again in core (defense in depth).
#   * Opt out any time by setting the env var LUMI_NO_CAPTURE to anything.
#   * A bug in this hook must NEVER break your shell — every line that touches
#     your real session is wrapped in try/catch and fails silently.
#
#  DESIGN NOTES FOR MAINTAINERS
#   * We PRESERVE the user's existing `prompt` function: we capture the original
#     and call through to it, so we never clobber a custom prompt.
#   * We guard against double dot-sourcing with a sentinel variable.
#   * v1 captures: command text, exit code, cwd, durationMs, shell. We do NOT
#     attempt output capture in PowerShell 5.1 (it's fragile); `output` is
#     simply omitted from the record. Core treats `output` as optional.
# ============================================================================

# --- Idempotency guard: safe to dot-source multiple times -------------------
if ($global:__LumiTerminalInstalled) { return }
$global:__LumiTerminalInstalled = $true

# Tracks the last history id we already logged, so re-rendering the prompt
# (which can happen without a new command) never double-logs the same command.
$global:__LumiLastHistoryId = -1

# ---------------------------------------------------------------------------
#  Internal: append a debug line if LUMI_DEBUG is set. Never throws.
# ---------------------------------------------------------------------------
function global:__Lumi-Debug([string]$message) {
    try {
        if ($env:LUMI_DEBUG) {
            $home = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
            $dir  = Join-Path $home '.lumi'
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }
            $stamp = (Get-Date).ToUniversalTime().ToString('o')
            Add-Content -LiteralPath (Join-Path $dir 'terminal-debug.log') `
                        -Value "[$stamp] $message" -Encoding utf8
        }
    } catch { }
}

# ---------------------------------------------------------------------------
#  Internal: first-pass secret scrub. Mirrors the bash version. Core also
#  redacts, so this is only a best-effort defense-in-depth pass.
# ---------------------------------------------------------------------------
function global:__Lumi-Scrub([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return $text }
    try {
        $t = $text
        # OpenAI-style keys: sk-... (and sk-proj-...)
        $t = [regex]::Replace($t, 'sk-[A-Za-z0-9_\-]{16,}', '[REDACTED]')
        # GitHub tokens: ghp_, gho_, ghs_, ghu_, ghr_, github_pat_
        $t = [regex]::Replace($t, 'gh[pousr]_[A-Za-z0-9]{20,}', '[REDACTED]')
        $t = [regex]::Replace($t, 'github_pat_[A-Za-z0-9_]{20,}', '[REDACTED]')
        # AWS access key ids: AKIA / ASIA + 16 chars
        $t = [regex]::Replace($t, 'A(?:KIA|SIA)[A-Z0-9]{16}', '[REDACTED]')
        # Bearer tokens
        $t = [regex]::Replace($t, '(?i)bearer\s+[A-Za-z0-9._\-]{12,}', 'Bearer [REDACTED]')
        # key=value style secrets: password=, token=, api_key=, apikey=, secret=
        $t = [regex]::Replace($t, '(?i)(password|passwd|pwd|token|api[_\-]?key|secret|access[_\-]?token)(\s*[=:]\s*)("?)([^\s"'']+)', '$1$2$3[REDACTED]')
        return $t
    } catch {
        return $text
    }
}

# ---------------------------------------------------------------------------
#  Internal: capture + record the LAST interactive command. Never throws.
# ---------------------------------------------------------------------------
function global:__Lumi-RecordLast {
    # $LastOk / $LastExit are snapshotted by the `prompt` wrapper on its FIRST
    # line (before any statement here resets $? or $LASTEXITCODE) and passed in.
    param(
        [Nullable[bool]]$LastOk,
        [Nullable[int]]$LastExit
    )
    try {
        # Honor the opt-out switch.
        if ($env:LUMI_NO_CAPTURE) { return }

        # Most recent history item (the command the user just ran).
        $h = Get-History -Count 1 -ErrorAction SilentlyContinue
        if ($null -eq $h) { return }

        # De-dup: only record each history item once.
        if ($h.Id -eq $global:__LumiLastHistoryId) { return }
        $global:__LumiLastHistoryId = $h.Id

        $command = $h.CommandLine
        if ([string]::IsNullOrWhiteSpace($command)) { return }

        # --- exit code ------------------------------------------------------
        # Native (.exe) commands set $LASTEXITCODE. PowerShell cmdlets don't,
        # so fall back to $? (success -> 0, failure -> 1). Both values were
        # captured by the prompt wrapper before anything could clobber them.
        $exitCode = $null
        if ($null -ne $LastExit) {
            $exitCode = [int]$LastExit
        } elseif ($null -ne $LastOk) {
            $exitCode = if ($LastOk) { 0 } else { 1 }
        }

        # --- durationMs -----------------------------------------------------
        $durationMs = $null
        try {
            if ($h.EndExecutionTime -and $h.StartExecutionTime) {
                $span = $h.EndExecutionTime - $h.StartExecutionTime
                $durationMs = [int][math]::Round($span.TotalMilliseconds)
            }
        } catch { }

        # --- shell label ----------------------------------------------------
        $shell = if ($PSVersionTable.PSVersion.Major -ge 6) { 'pwsh' } else { 'powershell' }

        # --- build the record (FIXED CONTRACT) ------------------------------
        $record = [ordered]@{
            v        = 1
            ts       = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
            cwd      = $PWD.Path
            shell    = $shell
            command  = (global:__Lumi-Scrub $command)
            exitCode = $exitCode
            durationMs = $durationMs
        }
        # NOTE: `output` is intentionally OMITTED in v1 (no fragile capture).

        $json = $record | ConvertTo-Json -Compress -Depth 4

        # --- append to ~/.lumi/terminal.jsonl -------------------------------
        $homeDir = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
        $lumiDir = Join-Path $homeDir '.lumi'
        if (-not (Test-Path -LiteralPath $lumiDir)) {
            New-Item -ItemType Directory -Path $lumiDir -Force | Out-Null
        }
        # IMPORTANT: write BOM-less UTF-8. Windows PowerShell 5.1's
        # `Add-Content -Encoding utf8` prepends a UTF-8 BOM (U+FEFF) to a NEW
        # file, which corrupts the first JSONL line for any byte-level tailer
        # (incl. core). .NET AppendAllText with UTF8Encoding($false) is BOM-free
        # and behaves identically on 5.1 and 7+.
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::AppendAllText(
            (Join-Path $lumiDir 'terminal.jsonl'),
            ($json + "`n"),
            $utf8NoBom)
    } catch {
        __Lumi-Debug "RecordLast failed: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
#  Wrap the existing `prompt` function (preserving the original).
# ---------------------------------------------------------------------------
try {
    # Capture whatever `prompt` currently is so we can call through to it.
    $existingPrompt = $null
    $cmd = Get-Command -Name prompt -CommandType Function -ErrorAction SilentlyContinue
    if ($cmd) {
        $existingPrompt = $cmd.ScriptBlock
    }
    if ($null -eq $existingPrompt) {
        # PowerShell's built-in default prompt, used when the user has none.
        $existingPrompt = [ScriptBlock]::Create('"PS $($executionContext.SessionState.Path.CurrentLocation)$(''>'' * ($nestedPromptLevel + 1)) "')
    }
    # Stash the original so our new prompt can invoke it.
    $global:__LumiOriginalPrompt = $existingPrompt

    function global:prompt {
        # FIRST LINE: snapshot the exit status of the command that just ran,
        # before ANY other statement (incl. our own) resets $? / $LASTEXITCODE.
        $lumiOk   = $?
        $lumiExit = $global:LASTEXITCODE

        # Record the just-finished command (best-effort, never throws).
        __Lumi-RecordLast -LastOk $lumiOk -LastExit $lumiExit

        # Then render the user's original prompt exactly as before.
        try {
            return (& $global:__LumiOriginalPrompt)
        } catch {
            # If the original prompt somehow fails, fall back to a sane default
            # so the shell is never left without a prompt.
            return "PS $($PWD.Path)> "
        }
    }

    __Lumi-Debug "Lumi terminal hook installed ($($PSVersionTable.PSVersion))."
} catch {
    # If installation itself fails, do nothing — the user's shell is untouched.
    __Lumi-Debug "Install failed: $($_.Exception.Message)"
}
