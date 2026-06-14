import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryProfile, JsonFileProfile } from "../src/profile";

describe("InMemoryProfile", () => {
  it("reports unlearned, then learned after markLearned", () => {
    const p = new InMemoryProfile();
    expect(p.hasLearned("git-commit")).toBe(false);
    p.markLearned("git-commit");
    expect(p.hasLearned("git-commit")).toBe(true);
    expect(p.listLearned()).toHaveLength(1);
  });

  it("markLearned is idempotent and bumps seenCount", () => {
    const p = new InMemoryProfile();
    p.markLearned("api");
    p.markLearned("api");
    const learned = p.listLearned();
    expect(learned).toHaveLength(1);
    expect(learned[0].seenCount).toBe(2);
  });
});

describe("JsonFileProfile", () => {
  it("persists across instances using the same file", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-"));
    const file = join(dir, "profile.json");
    try {
      const p1 = new JsonFileProfile(file);
      p1.markLearned("docker");
      const p2 = new JsonFileProfile(file);
      expect(p2.hasLearned("docker")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
