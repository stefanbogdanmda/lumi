import { describe, it, expect } from "vitest";
import { renderProgressCard, progressCardFromProfile } from "../src/card";
import { LearnedConcept } from "../src/types";
import { CONCEPTS } from "../src/concepts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLC = (id: string, isoDate: string, seenCount = 1): LearnedConcept => ({
  id,
  learnedAt: isoDate,
  seenCount,
});

// Fixed "now" for deterministic streak tests: 2024-03-15
const NOW = new Date("2024-03-15T12:00:00.000Z");

// ---------------------------------------------------------------------------
// renderProgressCard
// ---------------------------------------------------------------------------

describe("renderProgressCard", () => {
  it("returns a string that starts with <svg and ends with </svg>", () => {
    const svg = renderProgressCard({
      conceptCount: 12,
      level: "growing",
      streakDays: 3,
      recentLabels: ["Git commit", "npm install"],
    });
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("contains the concept count", () => {
    const svg = renderProgressCard({
      conceptCount: 42,
      level: "confident",
      streakDays: 7,
      recentLabels: [],
    });
    expect(svg).toContain("42");
  });

  it("contains 'Made with Lumi'", () => {
    const svg = renderProgressCard({
      conceptCount: 5,
      level: "beginner",
      streakDays: 0,
      recentLabels: [],
    });
    expect(svg).toContain("Made with Lumi");
  });

  it("contains the npm install attribution", () => {
    const svg = renderProgressCard({
      conceptCount: 5,
      level: "beginner",
      streakDays: 0,
      recentLabels: [],
    });
    // Must point at the real package (@lumi/core), not a bare "lumi" that installs
    // an unrelated npm package.
    expect(svg).toContain("npm i -g @lumi/core");
  });

  it("contains the level string", () => {
    const svg = renderProgressCard({
      conceptCount: 8,
      level: "growing",
      streakDays: 2,
      recentLabels: [],
    });
    expect(svg).toContain("growing");
  });

  it("contains the streak days when non-zero", () => {
    const svg = renderProgressCard({
      conceptCount: 3,
      level: "beginner",
      streakDays: 5,
      recentLabels: [],
    });
    expect(svg).toContain("5");
    expect(svg).toContain("day streak");
  });

  it("renders recent concept chip labels", () => {
    const svg = renderProgressCard({
      conceptCount: 3,
      level: "beginner",
      streakDays: 1,
      recentLabels: ["Git commit", "npm install", "REST API"],
    });
    expect(svg).toContain("Git commit");
    expect(svg).toContain("npm install");
    expect(svg).toContain("REST API");
  });

  it("renders without throwing for zero/empty state", () => {
    expect(() =>
      renderProgressCard({
        conceptCount: 0,
        level: "beginner",
        streakDays: 0,
        recentLabels: [],
      })
    ).not.toThrow();
  });

  it("contains the Lumi wordmark", () => {
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 1,
      recentLabels: [],
    });
    expect(svg).toContain("Lumi");
  });

  it("contains the deep-indigo background color", () => {
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 1,
      recentLabels: [],
    });
    // gradient stop colors
    expect(svg).toContain("#070A18");
    expect(svg).toContain("#141A44");
  });

  it("contains the amber accent color", () => {
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 1,
      recentLabels: [],
    });
    expect(svg).toContain("#FFC56B");
  });

  // -------------------------------------------------------------------------
  // XSS / escaping tests
  // -------------------------------------------------------------------------

  it("escapes < and > in a label containing a script tag", () => {
    const malicious = "<script>alert('xss')</script>";
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 0,
      recentLabels: [malicious],
    });
    // The raw injection string must NOT appear verbatim
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("</script>");
    // The escaped form should be present
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes & in labels", () => {
    const label = "Fetch & XHR";
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 0,
      recentLabels: [label],
    });
    expect(svg).not.toContain("Fetch & XHR");
    expect(svg).toContain("Fetch &amp; XHR");
  });

  it("escapes double-quotes in labels", () => {
    const label = 'Say "hello"';
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 0,
      recentLabels: [label],
    });
    expect(svg).not.toContain('"hello"');
    expect(svg).toContain("&quot;hello&quot;");
  });

  it("escapes single-quotes in labels", () => {
    const label = "it's alive";
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 0,
      recentLabels: [label],
    });
    expect(svg).not.toContain("it's alive");
    expect(svg).toContain("it&#39;s alive");
  });

  it("caps chips at 5 even when more than 5 labels are provided", () => {
    const labels = ["A", "B", "C", "D", "E", "F", "G"];
    const svg = renderProgressCard({
      conceptCount: 7,
      level: "growing",
      streakDays: 0,
      recentLabels: labels,
    });
    // F and G (indices 5 and 6) should not appear as chips
    expect(svg).not.toContain(">F<");
    expect(svg).not.toContain(">G<");
  });

  it("has the chosen dimensions (1200 wide, 630 high)", () => {
    const svg = renderProgressCard({
      conceptCount: 1,
      level: "beginner",
      streakDays: 0,
      recentLabels: [],
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });

  it("is a self-contained SVG (no external resource references)", () => {
    const svg = renderProgressCard({
      conceptCount: 5,
      level: "growing",
      streakDays: 3,
      recentLabels: ["Git commit"],
    });
    // No href= pointing to external http resources
    expect(svg).not.toMatch(/href="https?:/);
    // No src= pointing to external resources
    expect(svg).not.toMatch(/src="https?:/);
  });
});

// ---------------------------------------------------------------------------
// progressCardFromProfile
// ---------------------------------------------------------------------------

describe("progressCardFromProfile", () => {
  it("returns a valid SVG string", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit", "2024-03-15T10:00:00.000Z"),
      makeLC("git-push",   "2024-03-14T10:00:00.000Z"),
    ];
    const svg = progressCardFromProfile(learned, { now: NOW, concepts: CONCEPTS });
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("derives the correct concept count from the learned list", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit",  "2024-03-15T10:00:00.000Z"),
      makeLC("git-push",    "2024-03-14T10:00:00.000Z"),
      makeLC("npm-install", "2024-03-13T10:00:00.000Z"),
    ];
    const svg = progressCardFromProfile(learned, { now: NOW, concepts: CONCEPTS });
    expect(svg).toContain("3");
  });

  it("derives the level from the learned count (6 concepts → growing)", () => {
    const ids = ["git-commit", "git-push", "git-branch", "git-merge", "git-pull", "npm-install"];
    const learned = ids.map((id) => makeLC(id, "2024-03-15T10:00:00.000Z"));
    const svg = progressCardFromProfile(learned, { now: NOW, concepts: CONCEPTS });
    expect(svg).toContain("growing");
  });

  it("derives the streak correctly (consecutive days ending today)", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit",  "2024-03-13T08:00:00.000Z"),
      makeLC("git-push",    "2024-03-14T09:00:00.000Z"),
      makeLC("npm-install", "2024-03-15T10:00:00.000Z"),
    ];
    const svg = progressCardFromProfile(learned, { now: NOW, concepts: CONCEPTS });
    // 3-day streak should appear
    expect(svg).toContain("3");
    expect(svg).toContain("day streak");
  });

  it("renders without throwing for empty profile", () => {
    expect(() => progressCardFromProfile([], { now: NOW, concepts: CONCEPTS })).not.toThrow();
  });

  it("uses recent concept labels from stats.recent (resolved via concepts)", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit", "2024-03-15T10:00:00.000Z"),
    ];
    const svg = progressCardFromProfile(learned, { now: NOW, concepts: CONCEPTS });
    // Label for git-commit is "Git commit"
    expect(svg).toContain("Git commit");
  });

  it("works with no options (uses defaults)", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit", new Date().toISOString()),
    ];
    expect(() => progressCardFromProfile(learned)).not.toThrow();
  });
});
