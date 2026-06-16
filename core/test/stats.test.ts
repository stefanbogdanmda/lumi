import { describe, it, expect } from "vitest";
import { learningStats } from "../src/stats";
import { LearnedConcept } from "../src/types";
import { CONCEPTS } from "../src/concepts";

// Fixed "now" for deterministic streak tests: 2024-03-15T12:00:00.000Z
const NOW = new Date("2024-03-15T12:00:00.000Z");

const makeLC = (id: string, isoDate: string, seenCount = 1): LearnedConcept => ({
  id,
  learnedAt: isoDate,
  seenCount,
});

// Pick two concepts that actually exist in CONCEPTS with known categories
const GIT_COMMIT = "git-commit";    // category: "git"
const GIT_PUSH   = "git-push";      // category: "git"
const NPM_INSTALL = "npm-install";  // category: "node"

describe("learningStats", () => {
  it("empty learned list → total 0, level beginner, streakDays 0, byCategory [], recent []", () => {
    const stats = learningStats([], NOW, CONCEPTS);
    expect(stats.total).toBe(0);
    expect(stats.level).toBe("beginner");
    expect(stats.streakDays).toBe(0);
    expect(stats.byCategory).toEqual([]);
    expect(stats.recent).toEqual([]);
  });

  it("a few concepts across 2 categories → correct total, byCategory counts + ordering, level word", () => {
    const learned: LearnedConcept[] = [
      makeLC(GIT_COMMIT,  "2024-03-10T08:00:00.000Z"),
      makeLC(GIT_PUSH,    "2024-03-11T09:00:00.000Z"),
      makeLC(NPM_INSTALL, "2024-03-12T10:00:00.000Z"),
    ];
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.total).toBe(3);
    expect(stats.level).toBe("beginner");

    // "git" has 2 entries, "node" has 1 → git first
    expect(stats.byCategory[0]).toEqual({ category: "git", count: 2 });
    expect(stats.byCategory[1]).toEqual({ category: "node", count: 1 });
  });

  it("byCategory: ties broken alphabetically", () => {
    const learned: LearnedConcept[] = [
      makeLC(GIT_COMMIT,  "2024-03-10T08:00:00.000Z"),
      makeLC(NPM_INSTALL, "2024-03-12T10:00:00.000Z"),
    ];
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.total).toBe(2);
    // "git": 1, "node": 1 → sorted alphabetically: git < node
    expect(stats.byCategory[0].category).toBe("git");
    expect(stats.byCategory[1].category).toBe("node");
  });

  it("recent: with 7 concepts learned, recent returns 5 newest first", () => {
    const ids = [
      "git-commit", "git-push", "git-branch", "git-merge", "git-pull",
      "npm-install", "npm-script",
    ];
    const learned: LearnedConcept[] = ids.map((id, i) =>
      makeLC(id, `2024-03-0${i + 1}T10:00:00.000Z`)
    );
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.recent).toHaveLength(5);
    // newest first: index 6 → 2024-03-07, index 5 → 2024-03-06, etc.
    expect(stats.recent[0].id).toBe("npm-script");
    expect(stats.recent[1].id).toBe("npm-install");
    expect(stats.recent[2].id).toBe("git-pull");
    expect(stats.recent[3].id).toBe("git-merge");
    expect(stats.recent[4].id).toBe("git-branch");
  });

  it("recent entries carry the label from CONCEPTS", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, "2024-03-14T10:00:00.000Z")];
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.recent[0].label).toBe("Git commit");
  });

  it("recent: unknown id falls back to id as label", () => {
    const learned: LearnedConcept[] = [makeLC("unknown-concept", "2024-03-14T10:00:00.000Z")];
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.recent[0].label).toBe("unknown-concept");
  });

  describe("streak", () => {
    it("streak of 3 consecutive days ending today → streakDays 3", () => {
      // NOW is 2024-03-15; days: 2024-03-13, 2024-03-14, 2024-03-15
      const learned: LearnedConcept[] = [
        makeLC(GIT_COMMIT,  "2024-03-13T08:00:00.000Z"),
        makeLC(GIT_PUSH,    "2024-03-14T09:00:00.000Z"),
        makeLC(NPM_INSTALL, "2024-03-15T10:00:00.000Z"),
      ];
      const stats = learningStats(learned, NOW, CONCEPTS);
      expect(stats.streakDays).toBe(3);
    });

    it("nothing learned today → streakDays 0", () => {
      // all learned before 2024-03-15
      const learned: LearnedConcept[] = [
        makeLC(GIT_COMMIT, "2024-03-13T08:00:00.000Z"),
        makeLC(GIT_PUSH,   "2024-03-14T09:00:00.000Z"),
      ];
      const stats = learningStats(learned, NOW, CONCEPTS);
      expect(stats.streakDays).toBe(0);
    });

    it("single concept learned today → streakDays 1", () => {
      const learned: LearnedConcept[] = [
        makeLC(GIT_COMMIT, "2024-03-15T06:00:00.000Z"),
      ];
      const stats = learningStats(learned, NOW, CONCEPTS);
      expect(stats.streakDays).toBe(1);
    });

    it("gap before 3 consecutive days ending today → still streakDays 3", () => {
      // Learned 2024-03-10 (gap), then 2024-03-13, 2024-03-14, 2024-03-15
      const learned: LearnedConcept[] = [
        makeLC("git-commit",  "2024-03-10T08:00:00.000Z"),
        makeLC("git-push",    "2024-03-13T09:00:00.000Z"),
        makeLC("npm-install", "2024-03-14T10:00:00.000Z"),
        makeLC("npm-script",  "2024-03-15T11:00:00.000Z"),
      ];
      const stats = learningStats(learned, NOW, CONCEPTS);
      expect(stats.streakDays).toBe(3);
    });
  });

  it("level word scales with learned count: 6 concepts → growing", () => {
    const ids = [
      "git-commit", "git-push", "git-branch", "git-merge", "git-pull", "npm-install",
    ];
    const learned: LearnedConcept[] = ids.map((id) =>
      makeLC(id, "2024-03-15T10:00:00.000Z")
    );
    const stats = learningStats(learned, NOW, CONCEPTS);
    expect(stats.level).toBe("growing");
  });
});
