import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
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
  const bytesOf = (rs: Row[]): number =>
    Buffer.byteLength(
      rs.map((r) => r.line).join("\n") + (rs.length ? "\n" : ""),
      "utf8",
    );

  // Track a running byte total (one full serialization up front) instead of
  // re-serializing each iteration — the file can transiently reach tens of MB
  // between rotations, so O(n^2) would hang.
  let totalBytes = bytesOf(rows);
  let start = 0;
  while (start < rows.length && totalBytes > opts.maxBytes) {
    totalBytes -= Buffer.byteLength(rows[start].line, "utf8") + 1; // line bytes + its \n
    start++;
  }
  const kept = rows.slice(start);

  // Atomic rewrite: write to a temp file then rename, so a mid-write kill
  // can't corrupt/truncate the feed.
  const content = kept.map((r) => r.line).join("\n") + (kept.length ? "\n" : "");
  const tmp = file + ".tmp";
  writeFileSync(tmp, content, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file); // atomic on POSIX, near-atomic on Windows
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
