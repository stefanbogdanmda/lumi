import { describe, it, expect } from "vitest";
import { weeklyDigest, renderDigestText, renderDigestHtml } from "../src/digest";
import { LearnedConcept } from "../src/types";
import { CONCEPTS } from "../src/concepts";

// Fixed "now" for deterministic tests
const NOW = new Date("2024-03-15T12:00:00.000Z");

// Helper: concept learned N days before NOW
const dayMs = 86_400_000;
const learnedAgo = (days: number): string =>
  new Date(NOW.getTime() - days * dayMs).toISOString();

const makeLC = (id: string, daysAgo: number, seenCount = 1): LearnedConcept => ({
  id,
  learnedAt: learnedAgo(daysAgo),
  seenCount,
});

// Pick real CONCEPTS ids
const GIT_COMMIT   = "git-commit";   // label: "Git commit"
const GIT_PUSH     = "git-push";     // label: "Git push"
const NPM_INSTALL  = "npm-install";  // label: "Installing packages (npm)"
const API          = "api";          // label: "API"

describe("weeklyDigest", () => {
  it("empty profile returns zero-state digest without throwing", () => {
    const d = weeklyDigest([], NOW);
    expect(d.learnedThisWeek).toEqual([]);
    expect(d.totalLearned).toBe(0);
    expect(d.level).toBe("beginner");
    expect(d.streakDays).toBe(0);
    expect(d.dueCount).toBe(0);
    expect(d.dueLabels).toEqual([]);
    // empty profile → paths have no learned concepts → nextStep is non-null
    // (the first concept of the first path is always available to a fresh learner)
    expect(d.nextStep).not.toBeNull();
    expect(typeof d.nextStep!.pathId).toBe("string");
    expect(typeof d.nextStep!.label).toBe("string");
    expect(typeof d.headline).toBe("string");
    expect(d.headline.length).toBeGreaterThan(0);
  });

  it("nextStep provides path and label when the learner has not completed all paths", () => {
    // Learn the first concept of "web-basics" → nextStep should be the second concept
    const firstConceptId = "localhost";
    const learned: LearnedConcept[] = [{ id: firstConceptId, learnedAt: learnedAgo(1), seenCount: 1 }];
    const d = weeklyDigest(learned, NOW);
    expect(d.nextStep).not.toBeNull();
    expect(typeof d.nextStep!.pathId).toBe("string");
    expect(typeof d.nextStep!.label).toBe("string");
    expect(d.nextStep!.label.length).toBeGreaterThan(0);
  });

  it("nextStep is null when all paths are fully complete", () => {
    // Build a profile that has learned every concept across all paths
    const allIds = [...new Set(CONCEPTS.map((c) => c.id))];
    const learned = allIds.map((id) => makeLC(id, 1));
    const d = weeklyDigest(learned, NOW);
    // nextStep should be null — every path concept is known
    // (nextAcrossPaths returns null when all paths are complete)
    // note: not all CONCEPT ids are necessarily in paths, but all path ids ARE in CONCEPTS,
    // so learning all CONCEPTS ids guarantees all paths are complete
    expect(d.nextStep).toBeNull();
  });

  it("counts only concepts learned within the last 7 days of now", () => {
    const learned: LearnedConcept[] = [
      makeLC(GIT_COMMIT,  2),   // 2 days ago — within 7 days
      makeLC(GIT_PUSH,    6),   // 6 days ago — within 7 days
      makeLC(NPM_INSTALL, 8),   // 8 days ago — outside 7 days (> 7)
      makeLC(API,        10),   // 10 days ago — outside 7 days
    ];
    const d = weeklyDigest(learned, NOW);
    expect(d.learnedThisWeek).toHaveLength(2);
    const weekIds = d.learnedThisWeek.map((x) => x.id);
    expect(weekIds).toContain(GIT_COMMIT);
    expect(weekIds).toContain(GIT_PUSH);
    expect(weekIds).not.toContain(NPM_INSTALL);
    expect(weekIds).not.toContain(API);
  });

  it("learnedThisWeek items carry a label from CONCEPTS", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1)];
    const d = weeklyDigest(learned, NOW);
    expect(d.learnedThisWeek[0].label).toBe("Git commit");
  });

  it("totalLearned counts all concepts regardless of age", () => {
    const learned: LearnedConcept[] = [
      makeLC(GIT_COMMIT,  2),
      makeLC(GIT_PUSH,    6),
      makeLC(NPM_INSTALL, 8),
      makeLC(API,        10),
    ];
    const d = weeklyDigest(learned, NOW);
    expect(d.totalLearned).toBe(4);
  });

  it("level reflects total learned count via levelFromCount", () => {
    // 6 concepts → "growing" (levelFromCount: <=5 → beginner, <=20 → growing)
    const ids = ["git-commit", "git-push", "git-branch", "git-merge", "git-pull", "npm-install"];
    const learned = ids.map((id) => makeLC(id, 1));
    const d = weeklyDigest(learned, NOW);
    expect(d.level).toBe("growing");
  });

  it("streakDays: consecutive days ending today counted correctly", () => {
    // NOW = 2024-03-15; concepts on 2024-03-13, 2024-03-14, 2024-03-15 → streak 3
    const learned: LearnedConcept[] = [
      { id: GIT_COMMIT,  learnedAt: "2024-03-13T08:00:00.000Z", seenCount: 1 },
      { id: GIT_PUSH,    learnedAt: "2024-03-14T09:00:00.000Z", seenCount: 1 },
      { id: NPM_INSTALL, learnedAt: "2024-03-15T10:00:00.000Z", seenCount: 1 },
    ];
    const d = weeklyDigest(learned, NOW);
    expect(d.streakDays).toBe(3);
  });

  it("dueCount and dueLabels reflect concepts due for review at now", () => {
    // seenCount=1 → interval=2d; learnedAt=3 days ago → due
    // seenCount=1 → interval=2d; learnedAt=1 day ago → not due
    const learned: LearnedConcept[] = [
      { id: GIT_COMMIT, learnedAt: learnedAgo(3), seenCount: 1 }, // due
      { id: GIT_PUSH,   learnedAt: learnedAgo(1), seenCount: 1 }, // not due
    ];
    const d = weeklyDigest(learned, NOW);
    expect(d.dueCount).toBe(1);
    expect(d.dueLabels).toHaveLength(1);
    expect(d.dueLabels[0]).toBe("Git commit");
  });

  it("headline is non-empty and contains the this-week count when > 0", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1), makeLC(GIT_PUSH, 2)];
    const d = weeklyDigest(learned, NOW);
    expect(d.headline).toMatch(/2/); // should reference the count
  });
});

describe("renderDigestText", () => {
  it("contains the week count", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1), makeLC(GIT_PUSH, 2)];
    const d = weeklyDigest(learned, NOW);
    const text = renderDigestText(d);
    expect(text).toContain("2");
  });

  it("contains the headline", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1)];
    const d = weeklyDigest(learned, NOW);
    const text = renderDigestText(d);
    expect(text).toContain(d.headline);
  });

  it("contains the streak line when streak > 0", () => {
    const learned: LearnedConcept[] = [
      { id: GIT_COMMIT, learnedAt: "2024-03-15T10:00:00.000Z", seenCount: 1 },
    ];
    const d = weeklyDigest(learned, NOW);
    const text = renderDigestText(d);
    // streak of 1 day should be mentioned
    expect(text.toLowerCase()).toMatch(/streak|day/);
  });

  it("contains due count info when due > 0", () => {
    const learned: LearnedConcept[] = [
      { id: GIT_COMMIT, learnedAt: learnedAgo(3), seenCount: 1 },
    ];
    const d = weeklyDigest(learned, NOW);
    const text = renderDigestText(d);
    expect(text).toMatch(/review|due/i);
  });

  it("contains next step path info when nextStep is not null", () => {
    const learned: LearnedConcept[] = [{ id: "localhost", learnedAt: learnedAgo(1), seenCount: 1 }];
    const d = weeklyDigest(learned, NOW);
    const text = renderDigestText(d);
    if (d.nextStep) {
      expect(text).toContain(d.nextStep.label);
    }
  });

  it("renders without throwing on zero-state", () => {
    const d = weeklyDigest([], NOW);
    const text = renderDigestText(d);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    // should have an encouraging / getting started message
    expect(text.toLowerCase()).toMatch(/start|begin|getting/);
  });
});

describe("renderDigestHtml", () => {
  it("contains the week count", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1), makeLC(GIT_PUSH, 2)];
    const d = weeklyDigest(learned, NOW);
    const html = renderDigestHtml(d);
    expect(html).toContain("2");
  });

  it("contains the headline", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1)];
    const d = weeklyDigest(learned, NOW);
    const html = renderDigestHtml(d);
    expect(html).toContain(d.headline);
  });

  it("is valid-looking HTML with a body tag", () => {
    const d = weeklyDigest([], NOW);
    const html = renderDigestHtml(d);
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
  });

  it("HTML-escapes a label containing < > & and quotes", () => {
    // Inject a synthetic concept with an XSS-like label
    const maliciousId = "xss-test";
    const maliciousLabel = '<script>alert("xss&evil")</script>';
    const learned: LearnedConcept[] = [
      { id: maliciousId, learnedAt: learnedAgo(1), seenCount: 1 },
    ];
    // Build a digest manually with the dangerous label injected
    const d = weeklyDigest(learned, NOW);
    // Patch the learnedThisWeek entry to simulate a dangerous label
    const patchedDigest = {
      ...d,
      learnedThisWeek: [{ id: maliciousId, label: maliciousLabel }],
      headline: `You learned 1 concept: ${maliciousLabel}`,
      dueLabels: [maliciousLabel],
    };
    const html = renderDigestHtml(patchedDigest);
    // The raw injection strings must NOT appear verbatim
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    // Escaped versions must be present
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;evil");
  });

  it("renders without throwing on zero-state", () => {
    const d = weeklyDigest([], NOW);
    const html = renderDigestHtml(d);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("<body");
  });

  it("uses only inline styles (no external stylesheet links)", () => {
    const learned: LearnedConcept[] = [makeLC(GIT_COMMIT, 1)];
    const d = weeklyDigest(learned, NOW);
    const html = renderDigestHtml(d);
    expect(html).not.toMatch(/<link\s+rel=["']stylesheet["']/i);
    expect(html).not.toMatch(/src=["']https?:\/\//i);
  });
});
