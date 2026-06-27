import { existsSync, openSync, readSync, statSync, closeSync } from "node:fs";

/** Read whole lines appended after `offset`; returns the lines and the new byte offset.
 *  Only consumes up to the last newline; resyncs from 0 if the file shrank (rotation). */
export function readLinesSince(file: string, offset: number): { lines: string[]; offset: number } {
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
