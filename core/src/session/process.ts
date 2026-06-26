import type { FeedEvent } from "../feed";
import { lessonEvent } from "../feed";
import { redactSecrets } from "../redact";
import type { OutputSignals } from "../types";
import type { Lumi } from "../lumi";
import type { SessionEvent } from "./types";
import { isSensitiveCommand } from "./denylist";

/**
 * Turn normalized SessionEvents into FeedEvents through the existing Lumi brain.
 * Order: drop sensitive command records → redact ALL text/output → build signals
 * → detect new concepts → emit lesson events (and mark learned). Mirrors
 * processTerminalRecord so the consumer pipeline is unchanged.
 */
export async function processSessionEvents(
  events: SessionEvent[],
  lumi: Lumi,
  source: string,
): Promise<FeedEvent[]> {
  if (process.env.LUMI_NO_CAPTURE) return [];

  // Drop whole records that touch secret-class commands before anything is read.
  const safe = events.filter((e) => !(e.command && isSensitiveCommand(e.command)));
  if (safe.length === 0) return [];

  const parts: string[] = [];
  const commands: string[] = [];
  const files: string[] = [];
  for (const e of safe) {
    if (e.text) parts.push(redactSecrets(e.text));
    if (e.command) { const c = redactSecrets(e.command); parts.push(c); commands.push(c); }
    if (e.stdout) parts.push(redactSecrets(e.stdout));
    if (e.stderr) parts.push(redactSecrets(e.stderr));
    if (e.files) for (const f of e.files) files.push(f);
  }

  const signals: OutputSignals = {
    text: parts.join("\n"),
    ...(commands.length ? { commands } : {}),
    ...(files.length ? { files } : {}),
  };

  const lessons = await lumi.processSignals(signals);
  const ts = safe[safe.length - 1].ts || new Date().toISOString();
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
