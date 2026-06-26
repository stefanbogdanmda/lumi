# Lumi terminal capture — learn from plain shell commands

Lumi already learns from your AI coding tools (Claude Code, Codex, Gemini, …) via the
[feed adapters](../README.md). This adapter adds a second, complementary signal: the **plain shell
commands you run by hand**, system-wide, across every terminal you open.

After each command finishes, a tiny shell hook appends **one JSON line** describing that command to
`~/.lumi/terminal.jsonl`. Core (`lumi watch` / `lumi serve`) tails that file, redacts secrets, and
turns your commands — especially the ones that **fail** — into lessons in the overlay / panel.

| File | Shell | Sourced from |
|---|---|---|
| `lumi-terminal.ps1` | Windows PowerShell 5.1 **and** PowerShell 7+ | your `$PROFILE` |
| `lumi-terminal.bash` | Bash (Git Bash on Windows; also Linux/macOS) | your `~/.bashrc` |

---

## What gets recorded — the contract

Each line is one compact JSON object (`output` is intentionally **omitted** in v1):

```json
{ "v":1, "ts":"2026-06-25T22:37:32.946Z", "cwd":"C:\\Users\\me\\proj", "shell":"powershell",
  "command":"git push origin main", "exitCode":1, "durationMs":325 }
```

| Key | Meaning | Source (PowerShell) | Source (Bash) |
|---|---|---|---|
| `v` | schema version (always `1`) | constant | constant |
| `ts` | ISO-8601 UTC timestamp | `Get-Date … 'o'`-style | `date -u …%3NZ` |
| `cwd` | working directory | `$PWD.Path` | `$PWD` |
| `shell` | `powershell` \| `pwsh` \| `bash` | `pwsh` if `$PSVersionTable.PSVersion.Major ≥ 6` else `powershell` | `bash` |
| `command` | the command line you ran | `Get-History -Count 1 .CommandLine` | `DEBUG` trap (`$BASH_COMMAND`), else `history 1` |
| `exitCode` | int or `null` | `$LASTEXITCODE` for native commands, else `$?`→`0/1` | `$?` (captured first) |
| `durationMs` | int or `null` | history `EndExecutionTime − StartExecutionTime` | `EPOCHREALTIME`/`date` start→stop |
| `output` | **omitted in v1** | — | — |

Required keys are `v`, `ts`, `command`. The rest are strongly preferred and always emitted by these
hooks (with `null` where genuinely unavailable, e.g. `durationMs` for a PowerShell cmdlet that has no
execution timestamps).

---

## Install

### PowerShell (`$PROFILE`)

Open your profile (`notepad $PROFILE`, creating it if missing) and add this **dot-source** line:

```powershell
. "C:\path\to\Lumi\adapters\terminal\lumi-terminal.ps1"
```

Restart PowerShell (or run `. $PROFILE`). Works in both Windows PowerShell 5.1 and PowerShell 7+.

### Bash (`~/.bashrc`)

Add this **source** line to the end of `~/.bashrc`:

```bash
source "/c/path/to/Lumi/adapters/terminal/lumi-terminal.bash"
```

Open a new Git Bash window (or run `source ~/.bashrc`).

> **Automated install:** `lumi setup terminal` writes the correct dot-source / source line into your
> `$PROFILE` and `~/.bashrc` for you (idempotently), using the exact lines above. Manual install is
> only needed if you prefer to edit the files yourself.

---

## Privacy model

- **Local only.** Records are written to `~/.lumi/terminal.jsonl` on your machine. Nothing is sent
  anywhere by these hooks.
- **Secrets redacted twice.** Each hook does a first-pass scrub before writing (obvious tokens →
  `[REDACTED]`): `sk-…`, `ghp_…`/`github_pat_…`, `AKIA…`/`ASIA…`, `Bearer …`, and
  `password=`/`token=`/`api_key=`/`secret=` style key/value pairs. Core then redacts again when it
  ingests the file (defense in depth). This is best-effort — do not rely on it to hide a secret you
  would not want written to a local log.
- **Opt out anytime.** Set the environment variable `LUMI_NO_CAPTURE` (to anything) and the hooks do
  nothing. Set it per-shell for a one-off, or globally to disable everywhere.
- **Remove the hook.** Delete the dot-source line from `$PROFILE` / the source line from `~/.bashrc`
  (or run `lumi setup terminal --remove`), then restart your shells. You can also delete
  `~/.lumi/terminal.jsonl` to discard collected history.
- **Debugging.** Set `LUMI_DEBUG` to also write a `~/.lumi/terminal-debug.log` describing what was
  captured / why a record was skipped. Off by default.

---

## v1 limitations

- **Command + exit code + cwd + duration** are the v1 target, and all four are captured.
- **`output` is not captured** (the key is omitted). Reliable, non-fragile stdout/stderr capture in
  **Windows PowerShell 5.1** and legacy **cmd** is hard and risks corrupting the user's session, so
  v1 deliberately skips it. A later version may add opt-in output capture on shells where it's safe
  (e.g. PowerShell 7+ / bash with a PTY wrapper).
- PowerShell history (`Get-History`) only exists in **interactive** sessions, so commands run inside
  non-interactive scripts (`powershell -File …`, `-Command …`) are not recorded — which is the
  intended scope (we want commands *you* type).

---

## Safety guarantees

Both hooks are written so a bug in capture can **never** break your shell or prompt:

- **PowerShell** preserves any pre-existing `prompt` function (captured and called through), wraps all
  capture logic in `try/catch`, guards against double dot-sourcing with a sentinel, de-duplicates by
  `HistoryId`, and writes **BOM-less UTF-8** (PowerShell 5.1's `Add-Content -Encoding utf8` would
  otherwise prepend a UTF-8 BOM and corrupt the first JSONL line).
- **Bash** preserves any existing `PROMPT_COMMAND` (it prepends a tiny `$?` capturer and appends the
  recorder, keeping your command in between), routes the whole record body through `… 2>/dev/null` so
  it fails silently, guards against double-sourcing, skips empty commands, and JSON-escapes the
  command string (via `jq` when available, else a manual `sed`/`awk` fallback) so Windows paths,
  quotes, tabs, and `$` never produce invalid JSON.
