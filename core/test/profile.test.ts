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

  it("review(id, true) on a known concept bumps seenCount and updates learnedAt", async () => {
    const p = new InMemoryProfile();
    p.markLearned("git-commit");
    const before = p.listLearned()[0].learnedAt;
    // small delay so timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    p.review("git-commit", true);
    const item = p.listLearned()[0];
    expect(item.seenCount).toBe(2);
    expect(item.learnedAt > before).toBe(true);
  });

  it("review(id, false) on a known concept resets seenCount to 1 and updates learnedAt", async () => {
    const p = new InMemoryProfile();
    p.markLearned("git-commit");
    p.markLearned("git-commit"); // seenCount = 2
    const before = p.listLearned()[0].learnedAt;
    await new Promise((r) => setTimeout(r, 5));
    p.review("git-commit", false);
    const item = p.listLearned()[0];
    expect(item.seenCount).toBe(1);
    expect(item.learnedAt > before).toBe(true);
  });

  it("review(id, true) on an unknown id creates the concept with seenCount 1", () => {
    const p = new InMemoryProfile();
    expect(p.hasLearned("new-concept")).toBe(false);
    p.review("new-concept", true);
    expect(p.hasLearned("new-concept")).toBe(true);
    expect(p.listLearned()[0].seenCount).toBe(1);
  });

  it("review(id, false) on an unknown id is a no-op", () => {
    const p = new InMemoryProfile();
    p.review("unknown-concept", false);
    expect(p.hasLearned("unknown-concept")).toBe(false);
    expect(p.listLearned()).toHaveLength(0);
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

  it("review persists: reload from a second instance and check seenCount", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-"));
    const file = join(dir, "profile.json");
    try {
      const p1 = new JsonFileProfile(file);
      p1.markLearned("docker");
      p1.review("docker", true); // seenCount -> 2
      const p2 = new JsonFileProfile(file);
      expect(p2.listLearned()[0].seenCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
