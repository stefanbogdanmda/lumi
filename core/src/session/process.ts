import type { FeedEvent } from "../feed";
import { lessonEvent } from "../feed";
import { redactSecrets } from "../redact";
import type { OutputSignals } from "../types";
import type { Lumi } from "../lumi";
import type { SessionEvent } from "./types";
import { isSensitiveCommand } from "./denylist";

// Captured output (build logs, stack traces) can be multi-MB. Cap each field and
// the joined total before the synchronous redaction + concept-detection passes so
// the live watch loop can't be blocked. The generator only sees the first ~800
// chars anyway (generator.ts), and concept detection only needs keyword presence.
const MAX_FIELD = 16_000;
const MAX_TOTAL = 64_000;
const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

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

/**
 * Turn normalized SessionEvents into FeedEvents through the existing Lumi brain.
 * Order: drop sensitive command records → clip + redact ALL text/output → build
 * signals → detect new concepts → emit lesson events (and mark learned). Mirrors
 * processTerminalRecord so the consumer pipeline is unchanged.
 */
export async function processSessionEvents(
  events: SessionEvent[],
  lumi: Lumi,
  source: string,
): Promise<FeedEvent[]> {
  if (process.env.LUMI_NO_CAPTURE) return [];

  // buildSessionSignals drops sensitive records, then clips + redacts every field.
  const signals = buildSessionSignals(events);
  if (!signals.text && !(signals.commands && signals.commands.length)) return [];

  const lessons = await lumi.processSignals(signals);
  const ts = (events.length ? events[events.length - 1].ts : "") || new Date().toISOString();
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
  return out;
}
