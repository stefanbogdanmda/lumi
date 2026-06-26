/**
 * terminal.ts — turn plain hand-typed terminal commands into Lumi lessons.
 *
 * A shell hook appends one JSON record per line to ~/.lumi/terminal.jsonl.
 * This module reads those records, redacts secrets FIRST, detects concepts,
 * flags non-zero exits, and produces FeedEvents the rest of Lumi already knows
 * how to render. Redaction always runs before detection, logging, or any write.
 */

import {
  existsSync,
  mkdirSync,
  closeSync,
  openSync,
  readSync,
  statSync,
  watch,
  type FSWatcher,
} from "node:fs";
import { dirname } from "node:path";
import { FeedEvent, FeedLesson, lessonEvent } from "./feed";
import { redactSecrets } from "./redact";
import { scoreSignals } from "./detector";
import { CONCEPTS } from "./concepts";
import { OutputSignals } from "./types";
import type { Lumi } from "./lumi";

/** One terminal command as captured by a shell hook (fixed wire contract). */
export interface TerminalRecord {
  v: number;
  ts: string;
  command: string;
  cwd?: string;
  shell?: string;
  exitCode?: number | null;
  durationMs?: number;
  output?: string;
}

/**
 * Validate + parse a single JSONL line into a TerminalRecord.
 * Required fields: v (number), ts (non-empty string), command (non-empty string).
 * Returns null for malformed JSON or any missing/invalid required field.
 */
export function parseTerminalRecord(line: string): TerminalRecord | null {
  if (!line || !line.trim()) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.v !== "number") return null;
  if (typeof o.ts !== "string" || !o.ts) return null;
  if (typeof o.command !== "string" || !o.command.trim()) return null;

  const rec: TerminalRecord = { v: o.v, ts: o.ts, command: o.command };
  if (typeof o.cwd === "string") rec.cwd = o.cwd;
  if (typeof o.shell === "string") rec.shell = o.shell;
  if (typeof o.durationMs === "number") rec.durationMs = o.durationMs;
  if (typeof o.output === "string") rec.output = o.output;
  // exitCode is optional and may be explicitly null — preserve the distinction.
  if ("exitCode" in o) {
    if (o.exitCode === null) rec.exitCode = null;
    else if (typeof o.exitCode === "number") rec.exitCode = o.exitCode;
  }
  return rec;
}

/** Short, single-line label of a command for lesson titles. */
function shortCommand(command: string): string {
  const oneLine = command.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? oneLine.slice(0, 59) + "…" : oneLine;
}

/** Build the "⚠ command failed" coaching event (type:"terminal" + command context). */
function buildFailureEvent(
  redactedCommand: string,
  exitCode: number,
  cwd: string | undefined,
  ts: string,
): FeedEvent {
  // Anchor the nudge to the strongest concept the command touches, if any.
  const top = scoreSignals({ text: redactedCommand, commands: [redactedCommand] })[0];
  const label = top ? CONCEPTS.find((c) => c.id === top.id)?.label : undefined;
  const what = label ? `This ${label} command` : "This command";

  const lesson: FeedLesson = {
    title: `⚠ Command failed: ${shortCommand(redactedCommand)}`,
    plainExplanation:
      `${what} exited with code ${exitCode}, which means it did not finish successfully. ` +
      `Read the last lines of its output first — they usually name the real problem. ` +
      `Common causes: a typo in the command, a missing dependency or file, or being in the wrong folder.`,
    whyItMatters: "The exit code and the error text are the fastest path to a fix.",
  };

  const base = lessonEvent({ source: "terminal", concept: top?.id ?? "command", lesson });
  return {
    ...base,
    ts,
    type: "terminal",
    command: { line: redactedCommand, exitCode, failed: true, ...(cwd ? { cwd } : {}) },
  };
}

/**
 * Process one terminal record into FeedEvents.
 *
 * Steps (in order):
 *  1. Redact secrets in the command and output.
 *  2. Build OutputSignals from the redacted text and run concept detection.
 *  3. Emit a lesson event per newly-detected concept (source "terminal") and
 *     mark each learned so it isn't re-taught next time.
 *  4. If the command failed (exitCode != null && !== 0), also emit a
 *     failure-context event so the overlay can flag "⚠ command failed".
 */
export async function processTerminalRecord(record: TerminalRecord, lumi: Lumi): Promise<FeedEvent[]> {
  // Kill switch: honor LUMI_NO_CAPTURE even if records still arrive (e.g. from a
  // shell hook installed before the user opted out). Skip all processing.
  if (process.env.LUMI_NO_CAPTURE) return [];

  const redactedCommand = redactSecrets(record.command);
  const redactedOutput = record.output ? redactSecrets(record.output) : "";
  const signals: OutputSignals = {
    text: redactedOutput ? `${redactedCommand}\n${redactedOutput}` : redactedCommand,
    commands: [redactedCommand],
  };

  const lessons = await lumi.processSignals(signals);
  const events: FeedEvent[] = [];
  for (const l of lessons) {
    events.push({
      ...lessonEvent({
        source: "terminal",
        concept: l.conceptId,
        lesson: {
          title: l.title,
          plainExplanation: l.plainExplanation,
          whyItMatters: l.whyItMatters,
          ...(l.analogy ? { analogy: l.analogy } : {}),
          ...(l.tinyExample ? { tinyExample: l.tinyExample } : {}),
        },
      }),
      ts: record.ts,
    });
    // Mark learned so the watch/serve pipeline mirrors `lumi feed` cross-turn dedupe.
    lumi.markLearned(l.conceptId);
  }

  if (record.exitCode != null && record.exitCode !== 0) {
    events.push(buildFailureEvent(redactedCommand, record.exitCode, record.cwd, record.ts));
  }

  return events;
}

// ---------------------------------------------------------------------------
// Tailer
// ---------------------------------------------------------------------------

export interface WatchOptions {
  /** Safety-net poll interval (ms). Defaults to 1000. fs.watch drives low-latency updates. */
  pollMs?: number;
  /** Called when reading/dispatching a record throws, so errors are surfaced not swallowed. */
  onError?: (err: unknown) => void;
}

/** Read whole lines appended after `offset`; returns the lines and the new byte offset. */
function readLinesSince(file: string, offset: number): { lines: string[]; offset: number } {
  if (!existsSync(file)) return { lines: [], offset };
  const size = statSync(file).size;
  if (size < offset) offset = 0; // truncated/rotated — resync
  if (size === offset) return { lines: [], offset };
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    const text = buf.toString("utf8");
    const lastNl = text.lastIndexOf("\n");
    if (lastNl === -1) return { lines: [], offset };
    const consumed = offset + Buffer.byteLength(text.slice(0, lastNl + 1), "utf8");
    const lines = text.slice(0, lastNl).split("\n").filter((l) => l.trim());
    return { lines, offset: consumed };
  } finally {
    closeSync(fd);
  }
}

/**
 * Follow `path`, dispatching each newly-appended valid TerminalRecord to `onRecord`.
 * Starts from the current end of file (only NEW commands are processed). Creates the
 * file (and parent dir) if missing, then watches. Returns a function to stop watching.
 */
export function watchTerminalFile(
  path: string,
  onRecord: (record: TerminalRecord) => void | Promise<void>,
  opts: WatchOptions = {},
): () => void {
  const pollMs = opts.pollMs ?? 1000;

  // Ensure the file exists so fs.watch has a target and we have a stable start
  // offset. Least-privilege perms (0700 dir / 0600 file) so terminal history
  // isn't world-readable on POSIX (mode is ignored, harmlessly, on Windows).
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (!existsSync(path)) closeSync(openSync(path, "a", 0o600));

  let offset = statSync(path).size; // skip history; only tail new appends
  let draining = false;

  // Process records SEQUENTIALLY: await each onRecord before the next so a burst
  // of same-concept commands can't race the "already learned?" check and emit
  // duplicate lessons. The `draining` guard stays set across ALL awaits, so the
  // poll interval / watcher can't start an overlapping drain mid-flight.
  const drain = async (): Promise<void> => {
    if (draining) return; // avoid overlapping reads
    draining = true;
    try {
      const { lines, offset: next } = readLinesSince(path, offset);
      offset = next;
      for (const line of lines) {
        const rec = parseTerminalRecord(line);
        if (!rec) continue;
        try {
          await onRecord(rec);
        } catch (e) {
          opts.onError?.(e);
        }
      }
    } catch (e) {
      opts.onError?.(e);
    } finally {
      draining = false;
    }
  };

  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(path, () => { void drain(); });
    // Surface OS-level watch errors instead of crashing the process.
    watcher.on("error", (e) => opts.onError?.(e));
  } catch (e) {
    opts.onError?.(e); // fall back to polling only
  }
  const timer = setInterval(() => { void drain(); }, pollMs);

  return () => {
    clearInterval(timer);
    if (watcher) {
      try { watcher.close(); } catch { /* already closed */ }
    }
  };
}
