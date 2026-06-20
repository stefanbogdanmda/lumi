import { describe, it, expect } from "vitest";
import { lumiHome, profilePath, cachePath } from "../src/paths";
import { homedir } from "node:os";
import { join } from "node:path";

describe("paths", () => {
  it("uses LUMI_HOME when set", () => {
    const prev = process.env.LUMI_HOME;
    process.env.LUMI_HOME = "/tmp/lumi-test-home";
    try {
      expect(lumiHome()).toBe("/tmp/lumi-test-home");
      expect(profilePath()).toBe(join("/tmp/lumi-test-home", "profile.json"));
      expect(cachePath()).toBe(join("/tmp/lumi-test-home", "cache.json"));
    } finally {
      if (prev === undefined) delete process.env.LUMI_HOME; else process.env.LUMI_HOME = prev;
    }
  });

  it("falls back to ~/.lumi when LUMI_HOME is empty or whitespace", () => {
    const prev = process.env.LUMI_HOME;
    process.env.LUMI_HOME = "   ";
    try {
      expect(lumiHome()).toBe(join(homedir(), ".lumi"));
    } finally {
      if (prev === undefined) delete process.env.LUMI_HOME; else process.env.LUMI_HOME = prev;
    }
  });
});
