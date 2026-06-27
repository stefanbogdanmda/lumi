import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { secureDir } from "../src/acl";

describe("secureDir", () => {
  it("is a safe no-op on non-Windows and never throws", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-acl-"));
    // On POSIX CI this returns false (nothing to do); on Windows it returns
    // true when icacls succeeds. Either way it must not throw.
    expect(() => secureDir(dir)).not.toThrow();
    if (process.platform !== "win32") expect(secureDir(dir)).toBe(false);
  });

  it("returns false for a missing directory without throwing", () => {
    expect(secureDir(join(tmpdir(), "nope-lumi-acl"))).toBe(false);
  });

  it("returns false when USERNAME env var is absent", () => {
    const saved = process.env.USERNAME;
    delete process.env.USERNAME;
    try {
      const dir = mkdtempSync(join(tmpdir(), "lumi-acl-"));
      expect(secureDir(dir)).toBe(false);
    } finally {
      if (saved !== undefined) process.env.USERNAME = saved;
      else delete process.env.USERNAME;
    }
  });
});
