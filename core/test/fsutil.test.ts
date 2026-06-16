import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWriteFileSync } from "../src/fsutil";

describe("atomicWriteFileSync", () => {
  it("writes content correctly (read it back)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-fsutil-"));
    const file = join(dir, "data.json");
    try {
      atomicWriteFileSync(file, '{"hello":"world"}');
      expect(readFileSync(file, "utf8")).toBe('{"hello":"world"}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("overwrites an existing file with new content", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-fsutil-"));
    const file = join(dir, "data.json");
    try {
      atomicWriteFileSync(file, "first");
      atomicWriteFileSync(file, "second");
      expect(readFileSync(file, "utf8")).toBe("second");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves no leftover .tmp-* file after writing", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-fsutil-"));
    const file = join(dir, "data.json");
    try {
      atomicWriteFileSync(file, "content");
      const entries = readdirSync(dir);
      expect(entries.every((e) => !e.includes(".tmp-"))).toBe(true);
      expect(entries).toContain("data.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates parent directories if missing (nested path)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-fsutil-"));
    const file = join(dir, "nested", "deep", "data.json");
    try {
      atomicWriteFileSync(file, "nested-content");
      expect(readFileSync(file, "utf8")).toBe("nested-content");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
