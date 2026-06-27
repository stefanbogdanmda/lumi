/** Options for spawning a PTY-hosted shell. */
export interface PtySpawnOptions {
  shell: string;
  args?: string[];
  cwd: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
}

/** A live PTY session — a thin, backend-agnostic handle. */
export interface PtySession {
  // onData/onExit register a listener for the session's lifetime; cleanup is via kill().
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

/** A source of PTY sessions (real node-pty, or a fake for tests). */
export interface PtyBackend {
  spawn(opts: PtySpawnOptions): PtySession;
}

let cachedBackend: PtyBackend | null | undefined;
let warned = false;

/**
 * Lazily load the native node-pty backend. Returns null (warned once) if the
 * module is missing or fails to load, so the rest of Lumi runs without a
 * terminal. Never throws. The require is intentionally lazy so importing this
 * module does not pull in the native addon.
 */
export function loadPtyBackend(): PtyBackend | null {
  if (cachedBackend !== undefined) return cachedBackend;
  try {
    // node-pty is an optional native addon — load it lazily so importing this
    // module never fails even in CI or when the addon is not compiled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pty = require("node-pty") as {
      spawn: (
        shell: string,
        args: string[],
        opts: { cwd: string; cols: number; rows: number; env: Record<string, string> }
      ) => {
        onData(cb: (d: string) => void): void;
        onExit(cb: (e: { exitCode: number }) => void): void;
        write(d: string): void;
        resize(c: number, r: number): void;
        kill(): void;
      };
    };
    cachedBackend = {
      spawn(opts) {
        // Build env without casting away undefined: process.env values are
        // `string | undefined`, so copy only defined keys, then layer opts.env.
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
        if (opts.env) for (const [k, v] of Object.entries(opts.env)) env[k] = v;
        const p = pty.spawn(opts.shell, opts.args ?? [], {
          cwd: opts.cwd,
          cols: opts.cols,
          rows: opts.rows,
          env,
        });
        return {
          onData: (cb) => { p.onData(cb); },
          onExit: (cb) => { p.onExit(({ exitCode }) => cb({ exitCode })); },
          write: (d) => p.write(d),
          resize: (c, r) => { try { p.resize(c, r); } catch { /* ignore bad geometry */ } },
          kill: () => { try { p.kill(); } catch { /* already dead */ } },
        };
      },
    };
  } catch {
    if (!warned) {
      console.error("[lumi:terminal] node-pty unavailable — Lumi Terminal disabled");
      warned = true;
    }
    cachedBackend = null;
  }
  return cachedBackend;
}

/** Reset the cached backend (tests only). */
export function __resetPtyBackendCache(): void { cachedBackend = undefined; warned = false; }

/** Deterministic in-memory PTY session for tests — no native code. */
export class FakePtySession implements PtySession {
  public written: string[] = [];
  public lastResize?: { cols: number; rows: number };
  public killed = false;
  private dataCbs: ((d: string) => void)[] = [];
  private exitCbs: ((e: { exitCode: number }) => void)[] = [];
  constructor(public opts: PtySpawnOptions) {}
  onData(cb: (d: string) => void): void { this.dataCbs.push(cb); }
  onExit(cb: (e: { exitCode: number }) => void): void { this.exitCbs.push(cb); }
  write(d: string): void { this.written.push(d); }
  resize(cols: number, rows: number): void { this.lastResize = { cols, rows }; }
  /** NOTE: unlike real node-pty, kill() does NOT fire onExit. Call exit() explicitly in tests that need exit-after-kill. */
  kill(): void { this.killed = true; }
  /** Test helper: simulate shell output. */
  emit(data: string): void { for (const cb of this.dataCbs) cb(data); }
  /** Test helper: simulate shell exit. */
  exit(exitCode = 0): void { for (const cb of this.exitCbs) cb({ exitCode }); }
}

/** Deterministic in-memory backend for tests — no native code. */
export class FakePtyBackend implements PtyBackend {
  public sessions: FakePtySession[] = [];
  spawn(opts: PtySpawnOptions): FakePtySession {
    const s = new FakePtySession(opts);
    this.sessions.push(s);
    return s;
  }
}
