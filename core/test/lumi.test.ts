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
