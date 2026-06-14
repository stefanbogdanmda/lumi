import { describe, it, expect } from "vitest";
import { detectConcepts } from "../src/detector";

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
