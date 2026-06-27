import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface RotateOptions {
  maxAgeDays: number;
  maxBytes: number;
  /** Injectable clock for testing. Defaults to Date.now(). */
  now?: () => number;
}

const DAY_MS = 86_400_000;

/**
 * Bound feed.jsonl by age then size. Reads all lines, drops events older than
 * maxAgeDays (by ISO `ts`), then drops oldest-first until the serialized result
 * is <= maxBytes, and rewrites the file. Malformed lines are dropped. Missing
 * file → no-op. Synchronous + atomic-enough for a single-writer local file.
 */
export function rotateFeed(file: string, opts: RotateOptions): void {
  if (!existsSync(file)) return;

  // Use the injected clock so tests can freeze time without patching globals.
  const now = (opts.now ?? (() => Date.now()))();
  const cutoff = now - opts.maxAgeDays * DAY_MS;

  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim());

  type Row = { line: string; ts: number };
  const rows: Row[] = [];
  for (const line of lines) {
    let ts = 0;
    try {
      ts = Date.parse((JSON.parse(line) as Record<string, unknown>)?.ts as string) || 0;
    } catch {
      // Malformed JSON — skip the line rather than crashing.
      continue;
    }
    // Keep lines with a parseable ts that is within the age window.
    // Lines with ts === 0 (missing/invalid ts) are dropped to avoid
    // accumulating unparseable events forever.
    if (ts === 0 || ts < cutoff) continue;
    rows.push({ line, ts });
  }

  // Size cap: drop oldest first (rows are in file order = chronological append).
  // O(n^2) is acceptable here because feed.jsonl is a bounded local file
  // (the size cap itself prevents unbounded growth between rotation calls).
  const bytesOf = (rs: Row[]): number =>
    Buffer.byteLength(
      rs.map((r) => r.line).join("\n") + (rs.length ? "\n" : ""),
      "utf8",
    );

  let start = 0;
  while (start < rows.length && bytesOf(rows.slice(start)) > opts.maxBytes) {
    start++;
  }
  const kept = rows.slice(start);

  writeFileSync(
    file,
    kept.map((r) => r.line).join("\n") + (kept.length ? "\n" : ""),
    { encoding: "utf8", mode: 0o600 },
  );
}

/** Delete captured data under `home`. Returns the paths actually removed. */
export function purgeData(home: string): string[] {
  const removed: string[] = [];
  for (const name of ["feed.jsonl"]) {
    const p = join(home, name);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      removed.push(p);
    }
  }
  return removed;
}
