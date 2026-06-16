import { describe, it, expect } from "vitest";
import { reviewIntervalDays, dueForReview, recallQuestion } from "../src/review";
import { InMemoryProfile } from "../src/profile";
import { LearnedConcept } from "../src/types";

const dayMs = 86_400_000;

describe("reviewIntervalDays", () => {
  it("maps seenCount to the spaced-repetition interval", () => {
    expect(reviewIntervalDays(1)).toBe(2);
    expect(reviewIntervalDays(2)).toBe(7);
    expect(reviewIntervalDays(3)).toBe(16);
    expect(reviewIntervalDays(4)).toBe(30);
    expect(reviewIntervalDays(5)).toBe(60);
    expect(reviewIntervalDays(10)).toBe(60);
  });

  it("clamps zero and negative seenCount to the first interval", () => {
    expect(reviewIntervalDays(0)).toBe(2);
    expect(reviewIntervalDays(-3)).toBe(2);
  });
});

describe("dueForReview", () => {
  const now = new Date("2026-06-14T00:00:00.000Z");
  const learnedAgo = (days: number) =>
    new Date(now.getTime() - days * dayMs).toISOString();

  it("returns concepts whose age has passed their interval", () => {
    const learned: LearnedConcept[] = [
      { id: "a", learnedAt: learnedAgo(3), seenCount: 1 }, // interval 2 -> due
      { id: "b", learnedAt: learnedAgo(1), seenCount: 1 }, // interval 2 -> not due
      { id: "c", learnedAt: learnedAgo(8), seenCount: 2 }, // interval 7 -> due
      { id: "d", learnedAt: learnedAgo(8), seenCount: 3 }, // interval 16 -> not due
    ];
    const due = dueForReview(learned, now).map((c) => c.id);
    expect(due).toContain("a");
    expect(due).not.toContain("b");
    expect(due).toContain("c");
    expect(due).not.toContain("d");
  });

  it("sorts results oldest-learnedAt first", () => {
    const learned: LearnedConcept[] = [
      { id: "newer", learnedAt: learnedAgo(3), seenCount: 1 },
      { id: "older", learnedAt: learnedAgo(10), seenCount: 1 },
      { id: "middle", learnedAt: learnedAgo(5), seenCount: 1 },
    ];
    expect(dueForReview(learned, now).map((c) => c.id)).toEqual([
      "older",
      "middle",
      "newer",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(dueForReview([], now)).toEqual([]);
  });
});

describe("recallQuestion", () => {
  it("contains the label in the prompt", () => {
    const q = recallQuestion("Git commit");
    expect(q).toContain("Git commit");
  });

  it("contains a remember prompt", () => {
    const q = recallQuestion("Git commit");
    expect(q.toLowerCase()).toContain("remember");
  });
});

describe("dueForReview integration with profile.review()", () => {
  it("after review(id, true) the concept is no longer due when the clock resets", () => {
    const reviewNow = new Date("2026-06-14T00:00:00.000Z");
    const eightDaysAgo = new Date(reviewNow.getTime() - 8 * dayMs).toISOString();
    const p = new InMemoryProfile();
    // Seed a concept with seenCount=1 learned 8 days ago (interval=2 -> due)
    p.markLearned("git-commit"); // seenCount=1
    const seedItem = p.listLearned()[0];
    seedItem.learnedAt = eightDaysAgo; // reach into the object reference
    expect(dueForReview(p.listLearned(), reviewNow).map((c) => c.id)).toContain("git-commit");

    // review(true): seenCount -> 2, learnedAt -> now (real clock, approx reviewNow)
    p.review("git-commit", true);
    // seenCount=2 -> interval=7d; learnedAt=just now -> ageDays~0 -> not due
    expect(dueForReview(p.listLearned(), reviewNow).map((c) => c.id)).not.toContain("git-commit");
  });
});
