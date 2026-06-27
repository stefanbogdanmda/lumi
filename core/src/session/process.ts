import type { FeedEvent } from "../feed";
import { lessonEvent, stuckEvent } from "../feed";
import { detectStuck, unstuckAdvice } from "../unstuck";
import { redactSecrets } from "../redact";
import type { OutputSignals } from "../types";
import type { Lumi } from "../lumi";
import type { SessionEvent } from "./types";
import { isSensitiveCommand } from "./denylist";
import { allowsTool, allowsProject, allowsScope, type ConsentConfig } from "./consent-config";

// Captured output (build logs, stack traces) can be multi-MB. Cap each field and
// the joined total before the synchronous redaction + concept-detection passes so
// the live watch loop can't be blocked. The generator only sees the first ~800
// chars anyway (generator.ts), and concept detection only needs keyword presence.
const MAX_FIELD = 16_000;
const MAX_TOTAL = 64_000;
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

/**
 * Apply layered consent to a batch BEFORE redaction/detection:
 *  - drop events whose tool or project is not allowed;
 *  - null out fields whose scope is disabled (commands, output, ai-text);
 *  - drop events left with nothing capturable.
 * Pure; returns a new array (does not mutate inputs).
 */
export function applyConsent(events: SessionEvent[], consent: ConsentConfig): SessionEvent[] {
  const out: SessionEvent[] = [];
  for (const e of events) {
    if (!allowsTool(consent, e.tool)) continue;
    if (!allowsProject(consent, e.cwd)) continue;
    const next: SessionEvent = { ...e, ...(e.files ? { files: [...e.files] } : {}) };
    if (!allowsScope(consent, "aiText")) delete next.text;
    if (!allowsScope(consent, "commands")) delete next.command;
    // exitCode is intentionally not gated — non-content metadata (a number) that never enters signal text.
    if (!allowsScope(consent, "output")) { delete next.stdout; delete next.stderr; }
    if (!next.text && !next.command && !next.stdout && !next.stderr && !(next.files && next.files.length)) continue;
    out.push(next);
  }
  return out;
}

/** Drop sensitive records, then clip + redact every text-bearing field before
 *  building detection signals. Exported so the size caps are testable directly. */
export function buildSessionSignals(events: SessionEvent[]): OutputSignals {
  const safe = events.filter((e) => !(e.command && isSensitiveCommand(e.command)));
  const parts: string[] = [];
  const commands: string[] = [];
  const files: string[] = [];
  for (const e of safe) {
    if (e.text) parts.push(redactSecrets(clip(e.text, MAX_FIELD)));
    if (e.command) { const c = redactSecrets(clip(e.command, MAX_FIELD)); parts.push(c); commands.push(c); }
    if (e.stdout) parts.push(redactSecrets(clip(e.stdout, MAX_FIELD)));
    if (e.stderr) parts.push(redactSecrets(clip(e.stderr, MAX_FIELD)));
    // NOTE: e.files are NOT redacted — they feed only the extension-matcher in the
    // detector and are never persisted to the feed. Do not start persisting
    // signals.files without redacting them.
    if (e.files) for (const f of e.files) files.push(f);
  }
  return {
    text: clip(parts.join("\n"), MAX_TOTAL),
    ...(commands.length ? { commands } : {}),
    ...(files.length ? { files } : {}),
  };
}

export interface ProcessOptions {
  /** Layered consent applied per event. Omit to capture everything (tests). */
  consent?: ConsentConfig;
  /** Cross-batch dedupe of fix-loop cards (key = repeated error or first reason). */
  stuckSeen?: Set<string>;
}

/**
 * Turn normalized SessionEvents into FeedEvents through the existing Lumi brain.
 * Order: consent filter → drop sensitive command records → clip + redact ALL
 * text/output → build signals → detect new concepts → emit lesson events (and
 * mark learned). Mirrors processTerminalRecord so the consumer pipeline is unchanged.
 */
export async function processSessionEvents(
  events: SessionEvent[],
  lumi: Lumi,
  source: string,
  opts: ProcessOptions = {},
): Promise<FeedEvent[]> {
  if (process.env.LUMI_NO_CAPTURE) return [];

  const consented = opts.consent ? applyConsent(events, opts.consent) : events;
  if (consented.length === 0) return [];

  // buildSessionSignals drops sensitive records, then clips + redacts every field.
  const signals = buildSessionSignals(consented);
  if (!signals.text && !(signals.commands && signals.commands.length)) return [];

  const lessons = await lumi.processSignals(signals);
  const ts = (consented.length ? consented[consented.length - 1].ts : "") || new Date().toISOString();
  const out: FeedEvent[] = [];
  for (const l of lessons) {
    out.push({
      ...lessonEvent({
        source,
        concept: l.conceptId,
        lesson: {
          title: l.title,
          plainExplanation: l.plainExplanation,
          whyItMatters: l.whyItMatters,
          ...(l.analogy ? { analogy: l.analogy } : {}),
          ...(l.tinyExample ? { tinyExample: l.tinyExample } : {}),
        },
      }),
      ts,
    });
    lumi.markLearned(l.conceptId);
  }

  // Live fix-loop coaching: if the redacted text shows a stuck loop, surface ONE
  // proactive card. Deduped across batches via the caller's stuckSeen set so a
  // persistent loop doesn't spam the feed.
  const stuck = detectStuck(signals.text ?? "");
  if (stuck.stuck) {
    const key = stuck.repeatedError ?? stuck.reasons[0] ?? "stuck";
    if (!opts.stuckSeen || !opts.stuckSeen.has(key)) {
      opts.stuckSeen?.add(key);
      out.push({
        ...stuckEvent({
          source,
          advice: unstuckAdvice(stuck),
          ...(stuck.repeatedError ? { repeatedError: stuck.repeatedError } : {}),
        }),
        ts,
      });
    }
  }

  return out;
}
