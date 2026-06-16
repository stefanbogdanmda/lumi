/**
 * unstuck.ts — Lumi "un-stuck" Detector
 *
 * Detects the #1 vibe-coding wall: the AI fix-loop (whack-a-mole) where the
 * same error recurs, credits burn, and a non-technical user cannot diagnose.
 *
 * Pure detection + framing strings. No model calls, no external dependencies.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StuckSignal {
  stuck: boolean;
  reasons: string[];
  repeatedError?: string;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Regexes that match the *start* of an error line we care about.
 * We normalise the matched line before counting duplicates.
 */
const ERROR_LINE_PATTERNS: RegExp[] = [
  /^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|Error):/i,
  /^error\s+TS\d+:/i,          // TypeScript compiler errors
  /^Exception:/i,
  /^Traceback\s+\(most\s+recent\s+call\s+last\):/i,
  /^RuntimeError:/i,
  /^ValueError:/i,
  /^NameError:/i,
  /^AttributeError:/i,
  /^ImportError:/i,
  /^KeyError:/i,
  /^IndexError:/i,
];

/**
 * Frustration / loop phrases that signal stuck state when near error output.
 * Each entry: { pattern, label }.
 * "again" is intentionally kept here; it must only fire near an error line
 * (enforced in detectStuck logic below).
 */
const FRUSTRATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bstill\s+failing\b/i,        label: "frustration phrase: still failing" },
  { pattern: /\bsame\s+error\b(?!\s+(?:handling|message|page|boundary|code|class|type|response|object|state|format|behaviou?r))/i, label: "frustration phrase: same error" },
  { pattern: /\bstill\s+not\s+working\b/i,  label: "frustration phrase: still not working" },
  { pattern: /\btried\s+that\s+already\b/i, label: "frustration phrase: tried that already" },
  { pattern: /\bthat\s+didn['']t\s+work\b/i, label: "frustration phrase: that didn't work" },
  { pattern: /\bback\s+to\s+the\s+same\b/i, label: "frustration phrase: back to the same" },
  { pattern: /\bkeeps\s+happening\b/i,       label: "frustration phrase: keeps happening" },
];

/**
 * "again" is only a signal when directly adjacent to error context.
 * We check separately to avoid false positives on innocuous prose.
 */
const AGAIN_PATTERN = /\b(crashed|failed|error|broke|broke)\s+again\b|\bagain\b.{0,30}\b(error|fail|crash|broke)/i;

/**
 * Attempt / retry markers — multiple of these indicate the AI is looping.
 */
const ATTEMPT_PATTERNS: RegExp[] = [
  /\battempt\s+\d+\b/i,
  /\blet\s+me\s+try\b/i,
  /\btrying\s+again\b/i,
  /\blet'?s\s+try\s+again\b/i,
  /\blet\s+me\s+try\s+(?:that\s+)?(?:again|once\s+more|differently|another)/i,
];

// Minimum count of attempt-marker lines to constitute a loop signal
const ATTEMPT_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise an error line for deduplication: lowercase + collapse whitespace. */
function normaliseErrorLine(line: string): string {
  return line.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Return true if the line matches any known error pattern. */
function isErrorLine(line: string): boolean {
  const trimmed = line.trimStart();
  return ERROR_LINE_PATTERNS.some((re) => re.test(trimmed));
}

/** Return the normalised error key for a line, or null if not an error line. */
function errorKey(line: string): string | null {
  if (!isErrorLine(line)) return null;
  return normaliseErrorLine(line);
}

// ---------------------------------------------------------------------------
// Main detection
// ---------------------------------------------------------------------------

/**
 * Detect whether `text` shows signs of a fix-loop / stuck state.
 *
 * Conservative: requires at least one strong signal so ordinary single errors
 * or success output do not trigger false alarms.
 */
export function detectStuck(text: string): StuckSignal {
  const lines = text.split("\n");
  const reasons: string[] = [];
  let repeatedError: string | undefined;

  // ------------------------------------------------------------------
  // Signal 1: Same error line appears 2+ times
  // ------------------------------------------------------------------
  const errorCounts = new Map<string, { count: number; original: string }>();
  for (const line of lines) {
    const key = errorKey(line);
    if (key === null) continue;
    const existing = errorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      errorCounts.set(key, { count: 1, original: line.trim() });
    }
  }

  let maxRepeat = 0;
  let maxErrorOriginal = "";
  for (const { count, original } of errorCounts.values()) {
    if (count > maxRepeat) {
      maxRepeat = count;
      maxErrorOriginal = original;
    }
  }

  const hasRepeatedError = maxRepeat >= 2;
  if (hasRepeatedError) {
    repeatedError = maxErrorOriginal;
    reasons.push(`same error repeated ${maxRepeat} times: ${maxErrorOriginal}`);
  }

  // ------------------------------------------------------------------
  // Signal 2: Frustration / loop phrases — gated on hasAnyError so
  // benign prose ("that didn't work out as a marketing strategy") does
  // not fire. Consistent with the "again" and "attempt" signals below.
  // ------------------------------------------------------------------
  const hasAnyError = lines.some((l) => isErrorLine(l));

  if (hasAnyError) {
    for (const { pattern, label } of FRUSTRATION_PATTERNS) {
      if (pattern.test(text)) {
        reasons.push(label);
        break; // one frustration phrase is enough as a signal; avoid reason spam
      }
    }
  }

  // "again" only fires when there is at least one error line nearby
  if (hasAnyError && AGAIN_PATTERN.test(text)) {
    if (!reasons.some((r) => r.startsWith("frustration phrase:"))) {
      reasons.push("frustration phrase: 'again' adjacent to error context");
    }
  }

  // ------------------------------------------------------------------
  // Signal 3: Multiple consecutive attempt / retry markers
  // ------------------------------------------------------------------
  let attemptCount = 0;
  for (const line of lines) {
    if (ATTEMPT_PATTERNS.some((re) => re.test(line))) {
      attemptCount++;
    }
  }
  // Require error context too: repeated "let me try" in benign prose (a tutorial,
  // say) isn't a stuck-loop — a real fix-loop has errors present.
  if (attemptCount >= ATTEMPT_THRESHOLD && hasAnyError) {
    reasons.push(`multiple retry attempts detected (${attemptCount})`);
  }

  // ------------------------------------------------------------------
  // Decision: need at least one strong signal
  // ------------------------------------------------------------------
  const stuck = reasons.length > 0;

  return {
    stuck,
    reasons,
    ...(repeatedError !== undefined ? { repeatedError } : {}),
  };
}

// ---------------------------------------------------------------------------
// Framing advice
// ---------------------------------------------------------------------------

/**
 * Return a plain-English framing the user can act on immediately.
 *
 * When stuck: names the loop, suggests stepping back, and gives a concrete
 * "ask your AI THIS instead" prompt template.
 * When not stuck: a calm reassurance.
 */
export function unstuckAdvice(signal: StuckSignal): string {
  if (!signal.stuck) {
    return (
      "Looks like things are moving — no loop detected. Keep going and check " +
      "the output after each change before asking for the next fix."
    );
  }

  const errorRef = signal.repeatedError
    ? `"${signal.repeatedError}"`
    : "this error";

  return (
    `It looks like you may be stuck in a fix-loop — the same problem keeps ` +
    `coming back despite repeated attempts. This is a common pattern when the ` +
    `root cause hasn't been identified yet.\n\n` +
    `Step back from the current approach and try this instead. Paste the ` +
    `following prompt to your AI:\n\n` +
    `> Stop. Don't change any code yet. Explain in plain English what is ` +
    `causing ${errorRef}, list 2 possible root causes, and propose ONE ` +
    `specific change — don't rewrite everything.`
  );
}
