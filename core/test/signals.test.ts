import { describe, it, expect } from "vitest";
import { conceptsFromSignals } from "../src/signals";

describe("conceptsFromSignals", () => {
  it("maps a git commit command to git-commit with a strong score", () => {
    const scored = conceptsFromSignals({ text: "", commands: ["git commit -m 'x'"] });
    const commit = scored.find((s) => s.id === "git-commit");
    expect(commit).toBeTruthy();
    expect(commit!.score).toBeGreaterThanOrEqual(3);
  });

  it("maps a Dockerfile path to docker and a .json file to json", () => {
    const ids = conceptsFromSignals({ text: "", files: ["Dockerfile", "data/config.json"] }).map((s) => s.id);
    expect(ids).toContain("docker");
    expect(ids).toContain("json");
  });

  it("returns nothing for empty signals", () => {
    expect(conceptsFromSignals({ text: "" })).toEqual([]);
  });
});
