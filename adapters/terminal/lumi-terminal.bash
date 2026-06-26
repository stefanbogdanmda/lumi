# ============================================================================
#  Lumi terminal capture — Bash hook (Git Bash on Windows, also Linux/macOS)
# ----------------------------------------------------------------------------
#  WHAT THIS DOES
#  Lumi can learn from the plain shell commands you run by hand. This snippet
#  records, AFTER each command, ONE JSON line describing it to:
#       ~/.lumi/terminal.jsonl
#  `lumi watch` / `lumi serve` tails that file, redacts secrets again, and
#  turns commands + failures into lessons.
#
#  HOW TO INSTALL (manual)
#  Add this line to the END of your ~/.bashrc, then open a new shell:
#
#      source "/c/path/to/Lumi/adapters/terminal/lumi-terminal.bash"
#
#  (The `lumi setup terminal` installer does this for you.)
#
#  PRIVACY / SAFETY
#   * Everything stays local in ~/.lumi/terminal.jsonl.
#   * Obvious secrets are scrubbed here AND again in core (defense in depth).
#   * Opt out any time by setting  LUMI_NO_CAPTURE=1.
#   * A bug here must NEVER break your shell: we PRESERVE any existing
#     PROMPT_COMMAND (append, not overwrite) and guard every step.
#
#  HOW IT WORKS
#   * A DEBUG trap remembers the command about to run.
#   * PROMPT_COMMAND fires after the command finishes; we read $? (exit code)
#     there FIRST, then assemble + append the JSON record.
#   * durationMs is computed from EPOCHREALTIME (bash >= 5) when available.
# ============================================================================

# --- Idempotency guard: safe to source multiple times -----------------------
if [ -n "${__LUMI_TERMINAL_INSTALLED:-}" ]; then
    return 0 2>/dev/null || true
fi
__LUMI_TERMINAL_INSTALLED=1

# State shared between the DEBUG trap and PROMPT_COMMAND.
__lumi_cmd=""          # command captured by the DEBUG trap
__lumi_start_ns=""     # start time (nanoseconds) for duration
__lumi_armed=""        # 1 once a real command has been seen this prompt cycle
__lumi_exit=0          # exit code of the user's command, captured FIRST

# ---------------------------------------------------------------------------
#  __lumi_now_ns — current time in nanoseconds, best-effort.
#  Prefers EPOCHREALTIME (bash 5+, no subprocess); falls back to `date`.
# ---------------------------------------------------------------------------
__lumi_now_ns() {
    if [ -n "${EPOCHREALTIME:-}" ]; then
        # EPOCHREALTIME looks like 1718900000.123456 — strip the dot, pad to ns.
        local er="${EPOCHREALTIME/./}"
        # er is microseconds (16 digits-ish); convert us -> ns by *1000.
        printf '%s000' "$er"
    else
        date +%s%N 2>/dev/null || echo ""
    fi
}

# ---------------------------------------------------------------------------
#  __lumi_scrub — first-pass secret scrub. Mirrors the PowerShell version.
#  Core also redacts; this is defense-in-depth only.
# ---------------------------------------------------------------------------
__lumi_scrub() {
    # Read from stdin, write scrubbed text to stdout. Never fails the pipeline.
    sed -E \
        -e 's/sk-[A-Za-z0-9_-]{16,}/[REDACTED]/g' \
        -e 's/gh[pousr]_[A-Za-z0-9]{20,}/[REDACTED]/g' \
        -e 's/github_pat_[A-Za-z0-9_]{20,}/[REDACTED]/g' \
        -e 's/A(KIA|SIA)[A-Z0-9]{16}/[REDACTED]/g' \
        -e 's/([Bb][Ee][Aa][Rr][Ee][Rr])[[:space:]]+[A-Za-z0-9._-]{12,}/\1 [REDACTED]/g' \
        -e 's/([Pp][Aa][Ss][Ss][Ww]?[Oo]?[Rr]?[Dd]?|[Tt][Oo][Kk][Ee][Nn]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Ss][Ee][Cc][Rr][Ee][Tt])([[:space:]]*[=:][[:space:]]*)("?)[^[:space:]"'"'"']+/\1\2\3[REDACTED]/g' \
        2>/dev/null || cat
}

# ---------------------------------------------------------------------------
#  __lumi_json_escape — JSON-escape a string for embedding in a "..." value.
#  Uses jq when available (most correct); otherwise manual escaping of
#  backslash, double-quote, and the common control chars (tab, CR, LF).
#  Reads stdin, prints the escaped string WITHOUT surrounding quotes.
# ---------------------------------------------------------------------------
__lumi_json_escape() {
    if command -v jq >/dev/null 2>&1; then
        # -Rs: read raw, slurp whole input; tojson quotes it; trim the quotes.
        jq -Rs 'tojson | .[1:-1]' 2>/dev/null && return 0
    fi
    # Manual fallback. Order matters: escape backslash first.
    sed -e 's/\\/\\\\/g' \
        -e 's/"/\\"/g' \
        -e 's/\t/\\t/g' \
        -e 's/\r/\\r/g' \
    | awk 'BEGIN{ORS=""} {if (NR>1) printf "\\n"; printf "%s", $0}'
}

# ---------------------------------------------------------------------------
#  DEBUG trap: remember the command about to run and when it started.
#  $BASH_COMMAND holds the command being executed. We ignore our own
#  PROMPT_COMMAND machinery so we don't record the bookkeeping itself.
# ---------------------------------------------------------------------------
__lumi_debug_trap() {
    # Skip while PROMPT_COMMAND is running (the prompt is being drawn).
    case "$BASH_COMMAND" in
        __lumi_*|*__lumi_record*) return 0 ;;
    esac
    __lumi_cmd="$BASH_COMMAND"
    __lumi_armed=1
    if [ -z "$__lumi_start_ns" ]; then
        __lumi_start_ns="$(__lumi_now_ns)"
    fi
}

# ---------------------------------------------------------------------------
#  __lumi_record: runs from PROMPT_COMMAND after each command finishes.
#  MUST read $? as its very first action.
# ---------------------------------------------------------------------------
# Capturer: PREPENDED to PROMPT_COMMAND so it sees the user command's true $?
# before any pre-existing PROMPT_COMMAND segment can overwrite it.
__lumi_cap_exit() {
    __lumi_exit=$?
    return 0
}

__lumi_record() {
    local exit_code=${__lumi_exit:-0}
    local end_ns start_ns

    {
        # Opt-out and "nothing ran" short-circuits.
        [ -n "${LUMI_NO_CAPTURE:-}" ] && { __lumi_reset; return 0; }
        [ -z "${__lumi_armed:-}" ]   && { __lumi_reset; return 0; }

        # Prefer the DEBUG-trap command; fall back to `history 1`.
        local cmd="$__lumi_cmd"
        if [ -z "$cmd" ]; then
            cmd="$(history 1 2>/dev/null | sed -E 's/^[[:space:]]*[0-9]+[[:space:]]+//')"
        fi
        # Skip empty commands.
        [ -z "$cmd" ] && { __lumi_reset; return 0; }

        # --- duration (ms) ---------------------------------------------------
        local duration="null"
        end_ns="$(__lumi_now_ns)"
        start_ns="$__lumi_start_ns"
        if [ -n "$end_ns" ] && [ -n "$start_ns" ] && [ "$end_ns" -ge "$start_ns" ] 2>/dev/null; then
            duration=$(( (end_ns - start_ns) / 1000000 ))
        fi

        # --- shell label -----------------------------------------------------
        local shell="bash"

        # --- timestamp (ISO-8601 UTC) ---------------------------------------
        local ts
        ts="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ 2>/dev/null)"
        # If %3N is unsupported (rare), fall back to whole seconds.
        case "$ts" in
            *%3N*|"") ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)" ;;
        esac

        # --- escape command (scrub first, then JSON-escape) ------------------
        local cmd_json
        cmd_json="$(printf '%s' "$cmd" | __lumi_scrub | __lumi_json_escape)"
        local cwd_json
        cwd_json="$(printf '%s' "$PWD" | __lumi_json_escape)"

        # --- assemble record (FIXED CONTRACT, `output` omitted in v1) --------
        local line
        line="{\"v\":1,\"ts\":\"${ts}\",\"cwd\":\"${cwd_json}\",\"shell\":\"${shell}\",\"command\":\"${cmd_json}\",\"exitCode\":${exit_code},\"durationMs\":${duration}}"

        # --- append to ~/.lumi/terminal.jsonl --------------------------------
        local home_dir="${HOME:-$USERPROFILE}"
        local dir="${home_dir}/.lumi"
        mkdir -p -m 700 "$dir" 2>/dev/null
        printf '%s\n' "$line" >> "${dir}/terminal.jsonl" 2>/dev/null

        if [ -n "${LUMI_DEBUG:-}" ]; then
            # Log the SCRUBBED+escaped command ($cmd_json), never the raw $cmd —
            # enabling debug must not write secrets to disk.
            printf '[%s] recorded: %s\n' "$ts" "$cmd_json" >> "${dir}/terminal-debug.log" 2>/dev/null
        fi
    } 2>/dev/null   # whole body fails silently — never break the shell

    __lumi_reset
    return 0
}

# Reset per-command state so the next prompt cycle starts clean.
__lumi_reset() {
    __lumi_cmd=""
    __lumi_start_ns=""
    __lumi_armed=""
}

# ---------------------------------------------------------------------------
#  Wire up the DEBUG trap and PROMPT_COMMAND, PRESERVING anything already set.
# ---------------------------------------------------------------------------
trap '__lumi_debug_trap' DEBUG

case ";${PROMPT_COMMAND:-};" in
    *"__lumi_record"*) : ;;                       # already wired
    *)
        if [ -n "${PROMPT_COMMAND:-}" ]; then
            # Capture $? FIRST (prepend), keep the user's command in the middle,
            # then record (append). The user's PROMPT_COMMAND is preserved.
            PROMPT_COMMAND="__lumi_cap_exit;${PROMPT_COMMAND%;};__lumi_record"
        else
            PROMPT_COMMAND="__lumi_cap_exit;__lumi_record"
        fi
        ;;
esac
