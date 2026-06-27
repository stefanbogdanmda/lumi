import { Terminal } from "@xterm/headless";

export interface CleanTextSink {
  /** Write raw VT/ANSI bytes into the buffer. */
  feed(bytes: string): void;
  /** Flush all pending writes, return clean rendered text, and reset. */
  drain(): Promise<string>;
  /** Release the underlying Terminal (IDisposable) — call once per session. */
  dispose(): void;
}

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;
const DEFAULT_SCROLLBACK = 1000;

/**
 * Convert a raw VT/ANSI byte stream into clean rendered text. Wraps a headless
 * xterm terminal so escape codes / cursor moves don't pollute the text the brain
 * sees. We read cell-by-cell from the terminal buffer via translateToString(),
 * which yields plain character data with no ANSI codes — unlike SerializeAddon
 * which preserves escape codes for terminal-state restoration, not plain-text
 * extraction. Bounded geometry + scrollback so a flood can't grow memory
 * unbounded. drain() is async because xterm processes its write queue
 * asynchronously — we flush with an empty-write callback before reading.
 */
export function createCleanTextSink(opts?: { cols?: number; rows?: number; scrollback?: number }): CleanTextSink {
  const term = new Terminal({
    cols: opts?.cols ?? DEFAULT_COLS,
    rows: opts?.rows ?? DEFAULT_ROWS,
    scrollback: opts?.scrollback ?? DEFAULT_SCROLLBACK,
    allowProposedApi: true,
  });

  // Serialize drains so a second drain() can't read an already-cleared buffer
  // mid-flight and lose data. Each drain chains after the previous one resolves.
  let drainChain: Promise<string> = Promise.resolve("");

  async function doDrain(): Promise<string> {
    // Move the cursor onto a fresh blank line BEFORE the flush barrier so clear()
    // doesn't retain a partial (no-trailing-newline) line into the next drain.
    term.write("\r\n");
    // Flush xterm's async write queue before reading; without this the buffer
    // may lag behind and we'd read incomplete state.
    await new Promise<void>((resolve) => term.write("", () => resolve()));

    // translateToString() reads cell characters, no ANSI codes. trim-right
    // flag (true) strips trailing spaces from each line.
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    term.clear();
    return lines.join("\n").replace(/\s+$/g, "");
  }

  return {
    feed(bytes: string): void { if (bytes) term.write(bytes); },
    drain(): Promise<string> { return (drainChain = drainChain.then(() => doDrain())); },
    dispose(): void { term.dispose(); },
  };
}
