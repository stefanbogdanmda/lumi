import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryCache, JsonFileCache } from "../src/cache";
import { Lesson } from "../src/types";

const lesson: Lesson = {
  conceptId: "git-commit", title: "Git commit",
  plainExplanation: "A commit saves a snapshot of your changes.",
  whyItMatters: "It lets you undo and track history.",
};

describe("InMemoryCache", () => {
  it("stores and retrieves a lesson", () => {
    const c = new InMemoryCache();
    expect(c.get("git-commit")).toBeUndefined();
    c.set("git-commit", lesson);
    expect(c.get("git-commit")?.title).toBe("Git commit");
  });
});

describe("JsonFileCache", () => {
  it("persists lessons across instances", () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-"));
    const file = join(dir, "cache.json");
    try {
      new JsonFileCache(file).set("git-commit", lesson);
      expect(new JsonFileCache(file).get("git-commit")?.title).toBe("Git commit");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
