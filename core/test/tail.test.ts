import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLinesSince } from "../src/tail";

describe("readLinesSince", () => {
  it("returns only complete lines appended after the offset", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-tail-"));
    const file = join(dir, "f.jsonl");
    writeFileSync(file, "a\nb\n");
    const first = readLinesSince(file, 0);
    expect(first.lines).toEqual(["a", "b"]);

    appendFileSync(file, "c\n");
    const second = readLinesSince(file, first.offset);
    expect(second.lines).toEqual(["c"]);
  });

  it("does not emit a partial trailing line until its newline arrives", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-tail-"));
    const file = join(dir, "f.jsonl");
    writeFileSync(file, "a\nb"); // 'b' has no newline yet
    const r = readLinesSince(file, 0);
    expect(r.lines).toEqual(["a"]);
    appendFileSync(file, "\n");
    const r2 = readLinesSince(file, r.offset);
    expect(r2.lines).toEqual(["b"]);
  });

  it("resyncs from 0 when the file is truncated/rotated", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-tail-"));
    const file = join(dir, "f.jsonl");
    writeFileSync(file, "x\ny\n");
    const r = readLinesSince(file, 999); // offset past EOF
    expect(r.lines).toEqual(["x", "y"]);
  });

  it("returns nothing for a missing file", () => {
    const r = readLinesSince(join(tmpdir(), "nope-lumi-missing.jsonl"), 0);
    expect(r.lines).toEqual([]);
  });
});
