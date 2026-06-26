import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Write a file atomically: write to a temp sibling, then rename over the target.
 *  A crash mid-write leaves the original intact (the rename is atomic on one filesystem). */
export function atomicWriteFileSync(file: string, data: string): void {
  // Least-privilege perms (0700 dir / 0600 file) so Lumi state isn't
  // world-readable on POSIX. mode is ignored, harmlessly, on Windows.
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, file);
}
