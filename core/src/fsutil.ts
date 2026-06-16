import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Write a file atomically: write to a temp sibling, then rename over the target.
 *  A crash mid-write leaves the original intact (the rename is atomic on one filesystem). */
export function atomicWriteFileSync(file: string, data: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, file);
}
