import { existsSync, readdirSync, statSync, watch, type FSWatcher } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readLinesSince } from "../tail";
import type { FeedEvent } from "../feed";
import type { Lumi } from "../lumi";
import { extractClaudeEvents, type PendingToolUse } from "./claude-adapter";
import { processSessionEvents } from "./process";

/** Recursively list *.jsonl files under the given roots (missing roots ignored). */
export function scanSessionFiles(roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: ReturnType<typeof readdirSync>;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith(".jsonl")) out.push(full);
    }
  };
  for (const root of roots) if (existsSync(root)) walk(root);
  return out;
}

export interface ActiveSession {
  tool: "claude-code";
  sessionId: string;
  project: string;   // basename of the parent dir (encoded cwd)
  file: string;
  mtimeMs: number;
}

/** A session file whose mtime advanced within `withinMs` of `now()` is "active". */
export function detectActiveSessions(
  roots: string[],
  withinMs: number,
  now: () => number = () => Date.now(),
): ActiveSession[] {
  const t = now();
  const out: ActiveSession[] = [];
  for (const file of scanSessionFiles(roots)) {
    let mtimeMs: number;
    try { mtimeMs = statSync(file).mtimeMs; } catch { continue; }
    if (t - mtimeMs > withinMs) continue;
    out.push({
      tool: "claude-code",
      sessionId: basename(file).replace(/\.jsonl$/, ""),
      project: basename(dirname(file)),
      file, mtimeMs,
    });
  }
  return out;
}

export interface AiMonitorOptions {
  roots: string[];
  lumi: Lumi;
  onEvents: (events: FeedEvent[]) => void | Promise<void>;
  /** Live consent check, evaluated each drain so pausing stops capture at source. */
  isEnabled: () => boolean;
  pollMs?: number;
  onError?: (err: unknown) => void;
}

/**
 * Tail every Claude session file under `roots`, processing only newly-appended
 * lines. Pre-existing content is skipped (start at EOF); files appearing later
 * are read from their start. Sequential drain with a guard prevents overlapping
 * reads. Returns a stop() that clears the timer and closes watchers.
 */
export function watchAiSessions(opts: AiMonitorOptions): () => void {
  const pollMs = opts.pollMs ?? 1000;
  const offsets = new Map<string, number>();
  const pendings = new Map<string, Map<string, PendingToolUse>>();
  let draining = false;

  // Seed-to-EOF at the first moment we are enabled (skip pre-existing history) and
  // again after any pause (skip the paused interval). Crucially, while consent is
  // OFF the monitor does ZERO filesystem enumeration: no scan, no per-file stat —
  // so a server constructed with capture disabled never walks ~/.claude/projects.
  //   - Enabled at construction: seed now so history is skipped while a file
  //     created AFTER start is still read from 0 (it won't be in `offsets` yet).
  //   - Disabled at construction: do nothing; the first enabled drain reseeds,
  //     which also skips whatever was written while disabled.
  let needsReseed = true;
  if (opts.isEnabled()) {
    for (const file of scanSessionFiles(opts.roots)) {
      try { offsets.set(file, statSync(file).size); } catch { /* ignore */ }
    }
    needsReseed = false;
  }

  const drain = async (): Promise<void> => {
    if (draining) return;
    if (!opts.isEnabled()) { needsReseed = true; return; } // disabled/paused: no FS work at all
    draining = true;
    try {
      if (needsReseed) {
        // First enabled drain after a disabled start, or resuming after a pause:
        // advance every offset to EOF so the disabled/paused interval is never
        // captured, and drop stale pending tool_use joins.
        for (const file of scanSessionFiles(opts.roots)) {
          try { offsets.set(file, statSync(file).size); } catch { /* ignore */ }
        }
        pendings.clear();
        needsReseed = false;
      }
      for (const file of scanSessionFiles(opts.roots)) {
        const start = offsets.has(file) ? offsets.get(file)! : 0; // new file → from start
        const { lines, offset } = readLinesSince(file, start);
        offsets.set(file, offset);
        if (lines.length === 0) continue;
        let pending = pendings.get(file);
        if (!pending) { pending = new Map(); pendings.set(file, pending); }
        const sessionEvents = extractClaudeEvents(lines, pending);
        if (sessionEvents.length === 0) continue;
        try {
          const feed = await processSessionEvents(sessionEvents, opts.lumi, "claude-code");
          if (feed.length) await opts.onEvents(feed);
        } catch (e) { opts.onError?.(e); }
      }
    } catch (e) {
      opts.onError?.(e);
    } finally {
      draining = false;
    }
  };

  const watchers: FSWatcher[] = [];
  for (const root of opts.roots) {
    if (!existsSync(root)) continue; // don't create another tool's dir; poll picks it up if it appears
    try {
      const w = watch(root, { recursive: true }, () => { void drain(); });
      w.on("error", (e) => opts.onError?.(e));
      watchers.push(w);
    } catch (e) {
      opts.onError?.(e); // recursive watch unsupported (e.g. Linux) → polling covers it
    }
  }
  const timer = setInterval(() => { void drain(); }, pollMs);

  return () => {
    clearInterval(timer);
    for (const w of watchers) { try { w.close(); } catch { /* already closed */ } }
  };
}
