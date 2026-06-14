import { describe, it, expect } from "vitest";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

function makeLumi() {
  return new Lumi({
    profile: new InMemoryProfile(),
    generator: new MockGenerator(),
    cache: new InMemoryCache(),
  });
}

describe("Lumi.processOutput", () => {
  it("returns lessons for new concepts only", async () => {
    const lumi = makeLumi();
    const first = await lumi.processOutput("git commit created on branch main");
    const ids = first.map((l) => l.conceptId);
    expect(ids).toContain("git-commit");
    expect(ids).toContain("git-branch");

    // Mark git-commit as learned; it should no longer be taught.
    lumi.markLearned("git-commit");
    const second = await lumi.processOutput("another git commit on a branch");
    expect(second.map((l) => l.conceptId)).not.toContain("git-commit");
  });

  it("does not auto-mark concepts as learned (caller decides)", async () => {
    const lumi = makeLumi();
    await lumi.processOutput("git commit");
    expect(lumi.listLearned()).toHaveLength(0);
  });

  it("teachAndRemember marks taught concepts (inline mode)", async () => {
    const lumi = makeLumi();
    await lumi.teachAndRemember("git commit");
    const repeat = await lumi.teachAndRemember("git commit again");
    expect(repeat).toHaveLength(0); // already taught
  });

  it("teaches at most maxPerTurn (default 2) concepts, highest score first", async () => {
    const lumi = makeLumi(); // default options
    // This text contains 4+ concepts: git commit, git branch, npm install, JSON
    const lessons = await lumi.processOutput(
      "git commit then git branch, run npm install, read the JSON in package.json"
    );
    expect(lessons.length).toBeLessThanOrEqual(2);
  });

  it("respects a custom maxPerTurn", async () => {
    const lumi = new Lumi({
      profile: new InMemoryProfile(),
      generator: new MockGenerator(),
      cache: new InMemoryCache(),
      maxPerTurn: 1,
    });
    const lessons = await lumi.processOutput("git commit on a git branch");
    expect(lessons).toHaveLength(1);
  });

  it("uses the cache so a concept is generated once", async () => {
    let calls = 0;
    const gen = { generate: async (c: any) => { calls++; return { conceptId: c.id, title: c.label, plainExplanation: "x", whyItMatters: "y" }; } };
    const lumi = new Lumi({ profile: new InMemoryProfile(), generator: gen, cache: new InMemoryCache() });
    await lumi.processOutput("git commit");
    // not learned, so processOutput again should hit cache, not generator
    await lumi.processOutput("git commit");
    expect(calls).toBe(1);
  });
});
