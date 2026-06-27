import type { FeedEvent } from "../feed";
import type { Lumi } from "../lumi";
import type { ConsentConfig } from "../session/consent-config";
import { allowsScope } from "../session/consent-config";
import type { SessionEvent } from "../session/types";
import { processSessionEvents } from "../session/process";
import { createCleanTextSink, type CleanTextSink } from "./clean-text";
import type { PtyBackend, PtySession } from "./pty-backend";

export interface LumiTerminalOptions {
  backend: PtyBackend;
  lumi: Lumi;
  cwd: string;
  shell?: string;
  cols?: number;
  rows?: number;
  /** Stream raw bytes to the display (the WS client). Always called. */
  onOutput: (data: string) => void;
  /** Called when the shell exits. */
  onExit: (e: { exitCode: number }) => void;
  /** Persist captured feed events. */
  onEvents: (events: FeedEvent[]) => void | Promise<void>;
  /** Live consent, read each flush. */
  getConsent: () => ConsentConfig;
  flushIdleMs?: number;
  flushBytes?: number;
  onError?: (e: unknown) => void;
}

export interface LumiTerminalSession {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  stop(): void;
}

const DEFAULT_FLUSH_IDLE_MS = 600;
const DEFAULT_FLUSH_BYTES = 8_000;
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;

function defaultShell(): string {
  if (process.platform === "win32") return process.env.COMSPEC || "powershell.exe";
  return process.env.SHELL || "/bin/bash";
}

/** True only when the user has EXPLICITLY opted the Lumi Terminal in (heightened surface). */
function terminalCaptureAllowed(c: ConsentConfig): boolean {
  return c.enabled && c.tools["lumi-terminal"] === true;
}

/**
 * Own a shell via the PTY backend. Output is ALWAYS streamed to onOutput
 * (display); it is ALSO fed to a clean-text sink and, on a flush cadence
 * (idle or size), turned into a lumi-terminal SessionEvent and run through the
 * existing consent/denylist/redact/brain pipeline. Capture requires explicit
 * opt-in + the output scope; display does not.
 */
export function startLumiTerminal(opts: LumiTerminalOptions): LumiTerminalSession {
  const cols = opts.cols ?? DEFAULT_COLS;
  const rows = opts.rows ?? DEFAULT_ROWS;
  const sink: CleanTextSink = createCleanTextSink({ cols, rows });
  const session: PtySession = opts.backend.spawn({
    shell: opts.shell ?? defaultShell(),
    cwd: opts.cwd, cols, rows,
  });

  const flushIdleMs = opts.flushIdleMs ?? DEFAULT_FLUSH_IDLE_MS;
  const flushBytes = opts.flushBytes ?? DEFAULT_FLUSH_BYTES;
  let pending = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let flushing = false;
  let stopped = false;

  const flush = async (): Promise<void> => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
    if (stopped || flushing || pending === 0) return;
    pending = 0; // reset BEFORE the async drain so bytes arriving during drain accrue into the NEXT flush
    flushing = true;
    try {
      const clean = await sink.drain();
      if (!clean.trim()) return;
      if (process.env.LUMI_NO_CAPTURE) return;
      const consent = opts.getConsent();
      if (!terminalCaptureAllowed(consent)) return;
      if (!allowsScope(consent, "output")) return;
      const event: SessionEvent = {
        tool: "lumi-terminal",
        sessionId: "lumi-terminal",
        cwd: opts.cwd,
        ts: new Date().toISOString(),
        role: "user",
        stdout: clean,
      };
      const feed = await processSessionEvents([event], opts.lumi, "lumi-terminal", { consent });
      if (feed.length) await opts.onEvents(feed);
    } catch (e) {
      opts.onError?.(e);
    } finally {
      flushing = false;
    }
  };

  session.onData((data) => {
    if (stopped) return;                 // ignore late callbacks after stop()/dispose()
    opts.onOutput(data);                 // display always
    sink.feed(data);                     // capture buffer
    pending += data.length;
    if (pending >= flushBytes) void flush(); // fire immediately…
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { void flush(); }, flushIdleMs); // …AND always arm the idle fallback
  });

  session.onExit((e) => { void flush().finally(() => opts.onExit(e)); });

  return {
    write: (d) => { if (!stopped) session.write(d); },
    resize: (c, r) => { if (!stopped) session.resize(c, r); },
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
      try { session.kill(); } catch { /* ignore */ }
      try { sink.dispose(); } catch { /* ignore */ }
    },
  };
}
