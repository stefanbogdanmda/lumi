import { describe, it, expect } from "vitest";
import { detectConcepts, scoreConcepts } from "../src/detector";

describe("detectConcepts", () => {
  it("detects a git commit from CLI output", () => {
    const out = "Created commit 2f591a4 on branch main";
    const ids = detectConcepts(out);
    expect(ids).toContain("git-commit");
    expect(ids).toContain("git-branch");
  });

  it("detects npm install", () => {
    expect(detectConcepts("Running `npm install` ...")).toContain("npm-install");
  });

  it("returns each concept at most once", () => {
    const ids = detectConcepts("commit commit commit");
    expect(ids.filter((i) => i === "git-commit")).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(detectConcepts("the weather is nice today")).toEqual([]);
  });
});

describe("scoreConcepts", () => {
  it("scores by number of matching matchers and sorts descending", () => {
    const ranked = scoreConcepts("git commit on a git branch, then git push");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
    const ids = ranked.map((r) => r.id);
    expect(ids).toContain("git-commit");
    expect(ids).toContain("git-branch");
  });

  it("returns empty array when nothing matches", () => {
    expect(scoreConcepts("the weather is nice")).toEqual([]);
  });
});
