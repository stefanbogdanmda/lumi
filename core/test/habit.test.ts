import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  dailyGoalStatus,
  streakWithFreeze,
  earnedBadges,
  nextBadge,
  JsonFileHabitStore,
} from "../src/habit";
import type { HabitState } from "../src/habit";
import type { LearnedConcept } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLC = (id: string, isoDate: string): LearnedConcept => ({
  id,
  learnedAt: isoDate,
  seenCount: 1,
});

const NOW = new Date("2024-03-15T14:00:00.000Z"); // Friday 2024-03-15

/** A HabitState with zero freezes — baseline for most tests. */
const noFreezes: HabitState = {
  freezes: 0,
  dailyGoal: 3,
  earnedBadges: [],
};

const oneFreezeState: HabitState = {
  freezes: 1,
  dailyGoal: 3,
  earnedBadges: [],
};

const twoFreezeState: HabitState = {
  freezes: 2,
  dailyGoal: 3,
  earnedBadges: [],
};

// ---------------------------------------------------------------------------
// dailyGoalStatus
// ---------------------------------------------------------------------------

describe("dailyGoalStatus", () => {
  it("empty list → todayCount 0, not met, remaining equals goal", () => {
    const r = dailyGoalStatus([], 3, NOW);
    expect(r.goal).toBe(3);
    expect(r.todayCount).toBe(0);
    expect(r.met).toBe(false);
    expect(r.remaining).toBe(3);
  });

  it("exactly goal concepts today → met, remaining 0", () => {
    const learned = [
      makeLC("git-commit", "2024-03-15T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T09:00:00.000Z"),
      makeLC("git-branch", "2024-03-15T10:00:00.000Z"),
    ];
    const r = dailyGoalStatus(learned, 3, NOW);
    expect(r.todayCount).toBe(3);
    expect(r.met).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("more than goal today → met, remaining 0 (not negative)", () => {
    const learned = [
      makeLC("git-commit", "2024-03-15T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T09:00:00.000Z"),
      makeLC("git-branch", "2024-03-15T10:00:00.000Z"),
      makeLC("git-merge",  "2024-03-15T11:00:00.000Z"),
    ];
    const r = dailyGoalStatus(learned, 3, NOW);
    expect(r.todayCount).toBe(4);
    expect(r.met).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("partial progress → not met, remaining correct", () => {
    const learned = [
      makeLC("git-commit", "2024-03-15T08:00:00.000Z"),
    ];
    const r = dailyGoalStatus(learned, 3, NOW);
    expect(r.todayCount).toBe(1);
    expect(r.met).toBe(false);
    expect(r.remaining).toBe(2);
  });

  it("concepts from yesterday do NOT count toward today's goal", () => {
    const learned = [
      makeLC("git-commit", "2024-03-14T23:59:59.999Z"), // yesterday UTC
      makeLC("git-push",   "2024-03-15T00:00:00.000Z"), // today UTC (midnight)
    ];
    const r = dailyGoalStatus(learned, 2, NOW);
    // Only the midnight-today one counts
    expect(r.todayCount).toBe(1);
    expect(r.met).toBe(false);
  });

  it("goal of 1 → met after one concept", () => {
    const learned = [makeLC("git-commit", "2024-03-15T08:00:00.000Z")];
    const r = dailyGoalStatus(learned, 1, NOW);
    expect(r.met).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("uses real clock when now is omitted (smoke — just must not throw)", () => {
    // We can't assert exact values without controlling the clock, but it must not throw.
    expect(() => dailyGoalStatus([], 3)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// streakWithFreeze
// ---------------------------------------------------------------------------

describe("streakWithFreeze", () => {
  it("no learned → streak 0, no freeze consumed", () => {
    const r = streakWithFreeze([], oneFreezeState, NOW);
    expect(r.streakDays).toBe(0);
    expect(r.freezesAvailable).toBe(1); // freeze not used
    expect(r.savedByFreeze).toBe(false);
  });

  it("only today active → streak 1, no freeze consumed", () => {
    const learned = [makeLC("git-commit", "2024-03-15T08:00:00.000Z")];
    const r = streakWithFreeze(learned, noFreezes, NOW);
    expect(r.streakDays).toBe(1);
    expect(r.savedByFreeze).toBe(false);
  });

  it("3 consecutive days ending today → streak 3, no freeze consumed", () => {
    const learned = [
      makeLC("git-commit", "2024-03-13T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-14T09:00:00.000Z"),
      makeLC("git-branch", "2024-03-15T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, noFreezes, NOW);
    expect(r.streakDays).toBe(3);
    expect(r.savedByFreeze).toBe(false);
    expect(r.freezesAvailable).toBe(0);
  });

  it("single gap yesterday bridged by one freeze → streak continues, savedByFreeze true", () => {
    // Active: 2024-03-13, 2024-03-15 (gap on 2024-03-14)
    const learned = [
      makeLC("git-commit", "2024-03-13T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, oneFreezeState, NOW);
    expect(r.streakDays).toBe(2); // 2024-03-15 + 2024-03-13 = 2 active days
    expect(r.savedByFreeze).toBe(true);
    expect(r.freezesAvailable).toBe(0);
  });

  it("single gap with 2 freezes available → consumes only 1 freeze", () => {
    const learned = [
      makeLC("git-commit", "2024-03-13T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, twoFreezeState, NOW);
    expect(r.streakDays).toBe(2);
    expect(r.savedByFreeze).toBe(true);
    expect(r.freezesAvailable).toBe(1); // only 1 consumed
  });

  it("two-day gap with only 1 freeze → streak does NOT span the full gap, freeze NOT consumed", () => {
    // Active: 2024-03-12, 2024-03-15 (gap on 2024-03-13 AND 2024-03-14)
    // 1 freeze can bridge ONE gap day but not two. Because the second gap day has no freeze
    // to bridge it, the walk terminates without reaching 2024-03-12. The pending freeze spend
    // is refunded — savedByFreeze must be false and freezesAvailable must remain 1.
    const learned = [
      makeLC("git-commit", "2024-03-12T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, oneFreezeState, NOW);
    expect(r.streakDays).toBe(1); // only 2024-03-15; double-gap can't be bridged with 1 freeze
    expect(r.savedByFreeze).toBe(false); // FIX 3: freeze was not committed (walk failed)
    expect(r.freezesAvailable).toBe(1);  // FIX 3: freeze refunded
  });

  it("two-day gap with 2 freezes → bridges both missed days, streak extends", () => {
    // Active: 2024-03-12, 2024-03-15 (gaps on 2024-03-13 and 2024-03-14)
    const learned = [
      makeLC("git-commit", "2024-03-12T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, twoFreezeState, NOW);
    expect(r.streakDays).toBe(2); // 2024-03-15 + 2024-03-12
    expect(r.savedByFreeze).toBe(true);
    expect(r.freezesAvailable).toBe(0);
  });

  it("nothing today but active yesterday + no freeze → streak 0 (mirrors stats.ts definition)", () => {
    // stats.ts requires today to be active; if today has nothing the streak is 0.
    const learned = [
      makeLC("git-commit", "2024-03-14T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, noFreezes, NOW);
    // Today (2024-03-15) is not active and no freeze → streak 0
    expect(r.streakDays).toBe(0);
    expect(r.savedByFreeze).toBe(false);
  });

  it("nothing today but active yesterday + 1 freeze → freeze cannot extend streak (today not started)", () => {
    // The freeze can only be consumed AFTER the chain has started (streakDays > 0).
    // Since today is the first day checked and it's empty, streakDays never starts.
    const learned = [
      makeLC("git-commit", "2024-03-14T10:00:00.000Z"),
    ];
    const r = streakWithFreeze(learned, oneFreezeState, NOW);
    expect(r.streakDays).toBe(0);
    expect(r.freezesAvailable).toBe(1); // freeze not consumed
    expect(r.savedByFreeze).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // FIX 3 regression: freeze must NOT be consumed when it can't help
  // ---------------------------------------------------------------------------

  it("FIX 3 NEGATIVE: two-day gap with 1 freeze — freeze not consumed, savedByFreeze false", () => {
    // Active: today (offset 0) and 3 days ago (offset 3). Gaps: offsets 1 and 2.
    // 1 freeze can bridge one gap day but not two — the chain still breaks,
    // so the freeze should be refunded and savedByFreeze must be false.
    const today3 = "2024-03-15T08:00:00.000Z"; // offset 0
    const day3 = "2024-03-12T08:00:00.000Z";   // offset 3 (gaps at 14 and 13)
    const learned = [
      makeLC("git-commit", today3),
      makeLC("git-push",   day3),
    ];
    const withNoFreeze = streakWithFreeze(learned, noFreezes, NOW);
    const withOneFreeze = streakWithFreeze(learned, oneFreezeState, NOW);
    // streak should be identical to the zero-freeze result
    expect(withOneFreeze.streakDays).toBe(withNoFreeze.streakDays);
    // freeze must NOT have been consumed
    expect(withOneFreeze.freezesAvailable).toBe(1);
    expect(withOneFreeze.savedByFreeze).toBe(false);
  });

  it("FIX 3 POSITIVE: two-day gap with 2 freezes — both consumed, streak extends, savedByFreeze true", () => {
    // Active: today and 3 days ago. Two gap days. Two freezes bridge both.
    const today3 = "2024-03-15T08:00:00.000Z"; // offset 0
    const day3 = "2024-03-12T08:00:00.000Z";   // offset 3
    const learned = [
      makeLC("git-commit", today3),
      makeLC("git-push",   day3),
    ];
    const r = streakWithFreeze(learned, twoFreezeState, NOW);
    expect(r.streakDays).toBe(2);       // today + 3-days-ago
    expect(r.freezesAvailable).toBe(0); // both consumed
    expect(r.savedByFreeze).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// earnedBadges
// ---------------------------------------------------------------------------

describe("earnedBadges", () => {
  it("no concepts, streak 0 → no badges", () => {
    expect(earnedBadges([], 0)).toHaveLength(0);
  });

  it("first-concept badge unlocks after 1 concept", () => {
    const learned = [makeLC("git-commit", "2024-03-15T08:00:00.000Z")];
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("first-concept");
  });

  it("first-concept badge has correct shape (id, label, description)", () => {
    const learned = [makeLC("git-commit", "2024-03-15T08:00:00.000Z")];
    const badge = earnedBadges(learned, 0).find((b) => b.id === "first-concept");
    expect(badge).toBeDefined();
    expect(typeof badge!.label).toBe("string");
    expect(badge!.label.length).toBeGreaterThan(0);
    expect(typeof badge!.description).toBe("string");
    expect(badge!.description.length).toBeGreaterThan(0);
  });

  it("concepts-10 badge unlocks at exactly 10 concepts", () => {
    const learned = Array.from({ length: 10 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("concepts-10");
  });

  it("concepts-10 badge is NOT present with 9 concepts", () => {
    const learned = Array.from({ length: 9 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).not.toContain("concepts-10");
  });

  it("concepts-25 badge unlocks at exactly 25 concepts", () => {
    const learned = Array.from({ length: 25 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("concepts-25");
  });

  it("concepts-50 badge unlocks at exactly 50 concepts", () => {
    const learned = Array.from({ length: 50 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("concepts-50");
  });

  it("concepts-50 badge is NOT present with 49 concepts", () => {
    const learned = Array.from({ length: 49 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).not.toContain("concepts-50");
  });

  it("streak-3 badge unlocks at streakDays === 3", () => {
    const badges = earnedBadges([], 3);
    expect(badges.map((b) => b.id)).toContain("streak-3");
  });

  it("streak-3 badge is NOT present with streakDays === 2", () => {
    const badges = earnedBadges([], 2);
    expect(badges.map((b) => b.id)).not.toContain("streak-3");
  });

  it("streak-7 badge unlocks at streakDays === 7", () => {
    const badges = earnedBadges([], 7);
    expect(badges.map((b) => b.id)).toContain("streak-7");
  });

  it("streak-30 badge unlocks at streakDays === 30", () => {
    const badges = earnedBadges([], 30);
    expect(badges.map((b) => b.id)).toContain("streak-30");
  });

  it("streak-30 badge is NOT present with streakDays === 29", () => {
    const badges = earnedBadges([], 29);
    expect(badges.map((b) => b.id)).not.toContain("streak-30");
  });

  it("multi-category badge unlocks when ids span >= 2 different prefixes", () => {
    const learned = [
      makeLC("git-commit",  "2024-03-15T08:00:00.000Z"), // prefix: git
      makeLC("npm-install", "2024-03-15T09:00:00.000Z"), // prefix: npm
    ];
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("multi-category");
  });

  it("multi-category badge is NOT present with only one prefix", () => {
    const learned = [
      makeLC("git-commit", "2024-03-15T08:00:00.000Z"),
      makeLC("git-push",   "2024-03-15T09:00:00.000Z"),
    ];
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).not.toContain("multi-category");
  });

  // FIX 1 regression: multi-category badge must use the REAL category from CONCEPTS,
  // not the id prefix. "localhost" (web) and "api" (web) share the same category
  // even though their id prefixes differ.
  it("multi-category badge is NOT earned for localhost + api (both web category)", () => {
    const learned = [
      makeLC("localhost", "2024-03-15T08:00:00.000Z"), // category: web
      makeLC("api",       "2024-03-15T09:00:00.000Z"), // category: web
    ];
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).not.toContain("multi-category");
  });

  it("multi-category badge IS earned for localhost (web) + git-commit (git)", () => {
    const learned = [
      makeLC("localhost",  "2024-03-15T08:00:00.000Z"), // category: web
      makeLC("git-commit", "2024-03-15T09:00:00.000Z"), // category: git
    ];
    const badges = earnedBadges(learned, 0);
    expect(badges.map((b) => b.id)).toContain("multi-category");
  });

  it("badges do NOT duplicate — calling twice returns same set, each id appears once", () => {
    const learned = Array.from({ length: 50 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges1 = earnedBadges(learned, 30);
    const badges2 = earnedBadges(learned, 30);
    const ids1 = badges1.map((b) => b.id);
    const ids2 = badges2.map((b) => b.id);
    // No duplicate ids within a single call
    expect(new Set(ids1).size).toBe(ids1.length);
    // Deterministic across two calls
    expect(ids1).toEqual(ids2);
  });

  it("higher thresholds do not re-add lower-threshold badges (cumulative is correct)", () => {
    // With 50 concepts and streak 30 all concept + streak badges should be present exactly once
    const learned = Array.from({ length: 50 }, (_, i) =>
      makeLC(`concept-${i}`, "2024-03-15T08:00:00.000Z"),
    );
    const badges = earnedBadges(learned, 30);
    const ids = badges.map((b) => b.id);
    expect(ids.filter((id) => id === "first-concept")).toHaveLength(1);
    expect(ids.filter((id) => id === "concepts-10")).toHaveLength(1);
    expect(ids.filter((id) => id === "concepts-25")).toHaveLength(1);
    expect(ids.filter((id) => id === "concepts-50")).toHaveLength(1);
    expect(ids.filter((id) => id === "streak-3")).toHaveLength(1);
    expect(ids.filter((id) => id === "streak-7")).toHaveLength(1);
    expect(ids.filter((id) => id === "streak-30")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// JsonFileHabitStore
// ---------------------------------------------------------------------------

describe("JsonFileHabitStore", () => {
  const makeTmp = () => {
    const dir = mkdtempSync(join(tmpdir(), "lumi-habit-"));
    return { dir, file: join(dir, "habit.json") };
  };

  it("missing file → returns default state (freezes 0, dailyGoal 3, earnedBadges [])", () => {
    const { dir, file } = makeTmp();
    try {
      const store = new JsonFileHabitStore(file);
      const state = store.getState();
      expect(state.freezes).toBe(0);
      expect(state.dailyGoal).toBe(3);
      expect(state.earnedBadges).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("corrupt file → returns default state without throwing", () => {
    const { dir, file } = makeTmp();
    try {
      writeFileSync(file, "not-valid-json");
      const store = new JsonFileHabitStore(file);
      const state = store.getState();
      expect(state.freezes).toBe(0);
      expect(state.dailyGoal).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("round-trips state across two instances", () => {
    const { dir, file } = makeTmp();
    try {
      const store1 = new JsonFileHabitStore(file);
      store1.setState({
        freezes: 2,
        dailyGoal: 5,
        earnedBadges: ["first-concept"],
        lastFreezeUsedAt: "2024-03-14",
      });

      const store2 = new JsonFileHabitStore(file);
      const state = store2.getState();
      expect(state.freezes).toBe(2);
      expect(state.dailyGoal).toBe(5);
      expect(state.earnedBadges).toEqual(["first-concept"]);
      expect(state.lastFreezeUsedAt).toBe("2024-03-14");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("addFreezes accumulates across saves and reloads", () => {
    const { dir, file } = makeTmp();
    try {
      const store1 = new JsonFileHabitStore(file);
      store1.addFreezes(2);
      store1.addFreezes(1);

      const store2 = new JsonFileHabitStore(file);
      expect(store2.getState().freezes).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recordBadge is idempotent — calling twice stores id only once", () => {
    const { dir, file } = makeTmp();
    try {
      const store = new JsonFileHabitStore(file);
      store.recordBadge("first-concept");
      store.recordBadge("first-concept");
      expect(store.getState().earnedBadges).toEqual(["first-concept"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recordBadge persists and reloads", () => {
    const { dir, file } = makeTmp();
    try {
      const store1 = new JsonFileHabitStore(file);
      store1.recordBadge("streak-7");

      const store2 = new JsonFileHabitStore(file);
      expect(store2.getState().earnedBadges).toContain("streak-7");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("setDailyGoal persists and reloads", () => {
    const { dir, file } = makeTmp();
    try {
      const store1 = new JsonFileHabitStore(file);
      store1.setDailyGoal(7);

      const store2 = new JsonFileHabitStore(file);
      expect(store2.getState().dailyGoal).toBe(7);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("getState returns a copy — mutating the returned object does not affect the store", () => {
    const { dir, file } = makeTmp();
    try {
      const store = new JsonFileHabitStore(file);
      const state = store.getState();
      state.freezes = 999;
      expect(store.getState().freezes).toBe(0); // store unchanged
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Regression: FIX #8 — hand-edited negative dailyGoal must be clamped to 0
  // ---------------------------------------------------------------------------

  it("FIX 8: hand-edited negative dailyGoal is clamped to 0 on load", () => {
    const { dir, file } = makeTmp();
    try {
      // Simulate a hand-edited file with a negative dailyGoal
      writeFileSync(file, JSON.stringify({ freezes: 0, dailyGoal: -5, earnedBadges: [] }), "utf8");
      const store = new JsonFileHabitStore(file);
      expect(store.getState().dailyGoal).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("FIX 8: hand-edited dailyGoal of 0 is accepted as-is (edge: >= 0)", () => {
    const { dir, file } = makeTmp();
    try {
      writeFileSync(file, JSON.stringify({ freezes: 0, dailyGoal: 0, earnedBadges: [] }), "utf8");
      const store = new JsonFileHabitStore(file);
      expect(store.getState().dailyGoal).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// nextBadge
// ---------------------------------------------------------------------------

describe("nextBadge", () => {
  it("points a fresh learner at the First Step badge", () => {
    expect(nextBadge(0)).toMatchObject({ id: "first-concept", remaining: 1 });
  });

  it("counts down toward the next concept-count badge", () => {
    expect(nextBadge(1)).toMatchObject({ id: "concepts-10", remaining: 9 });
    expect(nextBadge(10)).toMatchObject({ id: "concepts-25", remaining: 15 });
    expect(nextBadge(25)).toMatchObject({ id: "concepts-50", remaining: 25 });
  });

  it("every target matches a real earned badge at that count", () => {
    for (const count of [1, 10, 25, 50]) {
      const ids = earnedBadges(
        Array.from({ length: count }, (_, i) => ({ id: `x${i}`, learnedAt: "2026-01-01T00:00:00Z", seenCount: 1 })),
        0,
      ).map((b) => b.id);
      // the badge whose target is exactly `count` should now be earned
      const target = [
        { c: 1, id: "first-concept" },
        { c: 10, id: "concepts-10" },
        { c: 25, id: "concepts-25" },
        { c: 50, id: "concepts-50" },
      ].find((t) => t.c === count)!;
      expect(ids).toContain(target.id);
    }
  });

  it("returns null once all count badges are earned", () => {
    expect(nextBadge(50)).toBeNull();
    expect(nextBadge(100)).toBeNull();
  });
});
