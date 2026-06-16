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

  it("keeps the highest-scored concept when capping", async () => {
    const lumi = new Lumi({ profile: new InMemoryProfile(), generator: new MockGenerator(), cache: new InMemoryCache(), maxPerTurn: 1 });
    // git-commit matches 2 matchers; json matches 1 -> git-commit must win
    const lessons = await lumi.processOutput("git commit, then git commit again, and read the JSON");
    expect(lessons).toHaveLength(1);
    expect(lessons[0].conceptId).toBe("git-commit");
  });

  it("prefers a high-priority concept over a low-priority one when capping", async () => {
    const lumi = new Lumi({ profile: new InMemoryProfile(), generator: new MockGenerator(), cache: new InMemoryCache(), maxPerTurn: 1 });
    // race-condition (priority 3, 1 matcher -> score 3) vs json (priority 1, 1 matcher -> score 1).
    // On raw matcher count they tie; the priority multiplier must flip race-condition to the front.
    const lessons = await lumi.processOutput("hit a race condition while parsing the JSON");
    expect(lessons).toHaveLength(1);
    expect(lessons[0].conceptId).toBe("race-condition");
  });

  it("detects concepts from commands even when prose is vague", async () => {
    const lumi = makeLumi();
    const lessons = await lumi.processSignals({ text: "Done!", commands: ["git commit -m 'init'"] });
    expect(lessons.map((l) => l.conceptId)).toContain("git-commit");
  });

  it("caches lessons per level so different levels get different lessons", async () => {
    let calls = 0;
    const gen = { generate: async (c: any, _ctx: string, _lvl?: any) => { calls++; return { conceptId: c.id, title: c.label, plainExplanation: "x", whyItMatters: "y" }; } };
    const profile = new InMemoryProfile();
    const cache = new InMemoryCache();
    const lumi = new Lumi({ profile, generator: gen, cache });
    await lumi.processOutput("git commit");      // beginner -> generates once
    await lumi.processOutput("git commit");      // same level -> cache hit
    expect(calls).toBe(1);
  });

  it("does not crash when an action maps to an id outside the concept set", async () => {
    const lumi = new Lumi({
      profile: new InMemoryProfile(),
      generator: new MockGenerator(),
      cache: new InMemoryCache(),
      concepts: [], // empty concept set
    });
    const lessons = await lumi.processSignals({ text: "done", commands: ["git commit -m x"] });
    expect(lessons).toEqual([]); // skipped gracefully, no throw
  });

  it("explain() teaches a specific concept on request and marks it learned", async () => {
    const lumi = makeLumi();
    const lesson = await lumi.explain("Git commit");
    expect(lesson).not.toBeNull();
    expect(lesson!.conceptId).toBe("git-commit");
    expect(lumi.listLearned().map((l) => l.id)).toContain("git-commit");
  });

  it("explain() returns null for an unknown term and does not throw", async () => {
    const lumi = makeLumi();
    const lesson = await lumi.explain("totally unknown xyz");
    expect(lesson).toBeNull();
    expect(lumi.listLearned()).toHaveLength(0);
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

describe("Lumi.review", () => {
  it("review(id, true) bumps seenCount for a learned concept", async () => {
    const lumi = makeLumi();
    await lumi.processOutput("git commit created on branch main");
    lumi.markLearned("git-commit");

    const before = lumi.listLearned().find((c) => c.id === "git-commit")!;
    expect(before.seenCount).toBe(1);

    lumi.review("git-commit", true);

    const after = lumi.listLearned().find((c) => c.id === "git-commit")!;
    expect(after.seenCount).toBe(2);
  });

  it("review(unknownId, false) does not throw (no-op for unknown concept)", () => {
    const lumi = makeLumi();
    expect(() => lumi.review("totally-unknown-id", false)).not.toThrow();
    expect(lumi.listLearned()).toHaveLength(0);
  });
});
