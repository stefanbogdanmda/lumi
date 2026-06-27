import { existsSync, readdirSync, statSync, watch, type Dirent, type FSWatcher } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readLinesSince } from "../tail";
import type { FeedEvent } from "../feed";
import type { Lumi } from "../lumi";
import type { SessionEvent } from "./types";
import type { ConsentConfig } from "./consent-config";
import { extractClaudeEvents, type PendingToolUse } from "./claude-adapter";
import { extractCodexEvents, makeCodexState, type CodexState } from "./codex-adapter";
import { processSessionEvents } from "./process";

/** Recursively list *.jsonl files under the given roots (missing roots ignored). */
export function scanSessionFiles(roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: Dirent[];
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
  tool: string;
  sessionId: string;
  project: string;
  file: string;
  mtimeMs: number;
}

/** A session file whose mtime advanced within `withinMs` of `now()` is "active". */
export function detectActiveSessions(
  roots: string[],
  withinMs: number,
  now: () => number = () => Date.now(),
  tool = "claude-code",
): ActiveSession[] {
  const t = now();
  const out: ActiveSession[] = [];
  for (const file of scanSessionFiles(roots)) {
    let mtimeMs: number;
    try { mtimeMs = statSync(file).mtimeMs; } catch { continue; }
    if (t - mtimeMs > withinMs) continue;
    out.push({
      tool,
      sessionId: basename(file).replace(/\.jsonl$/, ""),
      project: basename(dirname(file)),
      file, mtimeMs,
    });
  }
  return out;
}

/** One tool's transcript source: its roots, a per-file state factory, and an extractor. */
export interface SessionAdapter {
  tool: string;
  roots: string[];
  initState: () => unknown;
  extract: (lines: string[], state: unknown) => SessionEvent[];
}

/** Claude Code transcript source (~/.claude/projects). */
export function claudeAdapter(roots: string[]): SessionAdapter {
  return {
    tool: "claude-code",
    roots,
    initState: () => new Map<string, PendingToolUse>(),
    extract: (lines, st) => extractClaudeEvents(lines, st as Map<string, PendingToolUse>),
  };
}

/** OpenAI Codex rollout source (~/.codex/sessions). */
export function codexAdapter(roots: string[]): SessionAdapter {
  return {
    tool: "codex",
    roots,
    initState: () => makeCodexState(),
    extract: (lines, st) => extractCodexEvents(lines, st as CodexState),
  };
}

export interface AiMonitorOptions {
  sources: SessionAdapter[];
  lumi: Lumi;
  onEvents: (events: FeedEvent[]) => void | Promise<void>;
  /** Live consent gate; pausing stops capture at the source (no FS work). */
  isEnabled: () => boolean;
  /** Live layered consent passed per-event to the pipeline. */
  getConsent?: () => ConsentConfig;
  pollMs?: number;
  onError?: (err: unknown) => void;
}

/**
 * Tail every session file across all `sources`, processing only newly-appended
 * lines. Per-file byte offsets skip history; per-file adapter state carries
 * cross-batch joins. While disabled the monitor does ZERO filesystem work.
 * Returns a stop() that clears the timer and closes watchers.
 */
export function watchAiSessions(opts: AiMonitorOptions): () => void {
  const pollMs = opts.pollMs ?? 1000;
  const offsets = new Map<string, number>();
  const states = new Map<string, unknown>();        // file → adapter state
  const fileTool = new Map<string, SessionAdapter>(); // file → owning adapter
  let draining = false;
  let needsReseed = true;

  const allFiles = (): string[] => {
    const files: string[] = [];
    for (const src of opts.sources) {
      for (const f of scanSessionFiles(src.roots)) { fileTool.set(f, src); files.push(f); }
    }
    return files;
  };

  const seed = () => {
    for (const file of allFiles()) {
      try { offsets.set(file, statSync(file).size); } catch { /* ignore */ }
    }
  };

  if (opts.isEnabled()) { seed(); needsReseed = false; }

  const drain = async (): Promise<void> => {
    if (draining) return;
    if (!opts.isEnabled()) { needsReseed = true; return; }
    draining = true;
    try {
      if (needsReseed) { seed(); states.clear(); needsReseed = false; }
      for (const file of allFiles()) {
        const src = fileTool.get(file)!;
        const start = offsets.has(file) ? offsets.get(file)! : 0;
        const { lines, offset } = readLinesSince(file, start);
        offsets.set(file, offset);
        if (lines.length === 0) continue;
        let state = states.get(file);
        if (state === undefined) { state = src.initState(); states.set(file, state); }
        const sessionEvents = src.extract(lines, state);
        if (sessionEvents.length === 0) continue;
        try {
          const feed = await processSessionEvents(sessionEvents, opts.lumi, src.tool, {
            ...(opts.getConsent ? { consent: opts.getConsent() } : {}),
          });
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
  for (const src of opts.sources) {
    for (const root of src.roots) {
      if (!existsSync(root)) continue;
      try {
        const w = watch(root, { recursive: true }, () => { void drain(); });
        w.on("error", (e) => opts.onError?.(e));
        watchers.push(w);
      } catch (e) {
        opts.onError?.(e);
      }
    }
  }
  const timer = setInterval(() => { void drain(); }, pollMs);

  return () => {
    clearInterval(timer);
    for (const w of watchers) { try { w.close(); } catch { /* already closed */ } }
  };
}
