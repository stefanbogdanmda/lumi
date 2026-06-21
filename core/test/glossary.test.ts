import { describe, it, expect } from "vitest";
import { renderGlossary } from "../src/glossary";
import { learnMoreUrl } from "../src/learnmore";
import { CONCEPTS } from "../src/concepts";
import { Concept, LearnedConcept } from "../src/types";

describe("renderGlossary", () => {
  it("renders a friendly empty state when nothing is learned", () => {
    const out = renderGlossary([]);
    const firstLine = out.split("\n")[0];
    expect(firstLine).toBe("# My Lumi Glossary");
    // explains nothing learned yet
    expect(out.toLowerCase()).toContain("haven't");
    expect(out.toLowerCase()).toContain("yet");
    // points the new user at concrete next actions instead of a dead end
    expect(out).toContain("lumi learn");
    expect(out).toContain("lumi topics");
  });

  it("groups learned concepts by category with labels, dates and seen counts", () => {
    const learned: LearnedConcept[] = [
      { id: "git-commit", learnedAt: "2026-01-02T10:00:00.000Z", seenCount: 3 },
      { id: "api", learnedAt: "2026-02-15T08:30:00.000Z", seenCount: 1 },
      { id: "git-branch", learnedAt: "2026-01-05T12:00:00.000Z", seenCount: 2 },
    ];
    const out = renderGlossary(learned);

    expect(out.split("\n")[0]).toBe("# My Lumi Glossary");
    // one-line summary mentioning the count
    expect(out).toContain("3 concepts");
    // category headers shown with friendly labels (not raw ids)
    expect(out).toContain("## Git & version control");
    expect(out).toContain("## Web & APIs");
    // labels looked up by id
    expect(out).toContain("Git commit");
    expect(out).toContain("Git branch");
    expect(out).toContain("API");
    // a seen count and a date
    expect(out).toContain("seen 3×");
    expect(out).toContain("2026-01-02");
    // categories sorted by friendly heading: Git before Web
    expect(out.indexOf("## Git & version control")).toBeLessThan(out.indexOf("## Web & APIs"));
    // concepts sorted by label within git: "Git branch" before "Git commit"
    expect(out.indexOf("Git branch")).toBeLessThan(out.indexOf("Git commit"));
  });

  it("falls back to category 'other' and raw id for an unknown id without throwing", () => {
    const learned: LearnedConcept[] = [
      { id: "totally-unknown-thing", learnedAt: "2026-03-01T00:00:00.000Z", seenCount: 1 },
    ];
    let out = "";
    expect(() => { out = renderGlossary(learned); }).not.toThrow();
    expect(out).toContain("## other");
    expect(out).toContain("totally-unknown-thing");
  });

  it("accepts a custom concepts list", () => {
    const concepts: Concept[] = [
      { id: "x", label: "Thing X", category: "custom", matchers: [] },
    ];
    const learned: LearnedConcept[] = [
      { id: "x", learnedAt: "2026-04-01T00:00:00.000Z", seenCount: 1 },
    ];
    const out = renderGlossary(learned, concepts);
    expect(out).toContain("## custom");
    expect(out).toContain("Thing X");
  });

  it("appends a Learn more link for each learned concept", () => {
    const learned: LearnedConcept[] = [
      { id: "git-commit", learnedAt: "2026-01-02T10:00:00.000Z", seenCount: 3 },
    ];
    const out = renderGlossary(learned);
    // Link line appears after the concept bullet
    expect(out).toContain("Learn more:");
    // The URL should be a valid URL string (non-empty, starts with https)
    const concept = CONCEPTS.find((c) => c.id === "git-commit")!;
    const expectedUrl = learnMoreUrl({ label: concept.label, category: concept.category });
    expect(out).toContain(expectedUrl);
  });

  it("Learn more link for a security concept points to an OWASP search", () => {
    // hardcoded-secret is a security concept → should get an OWASP search URL
    const learned: LearnedConcept[] = [
      { id: "hardcoded-secret", learnedAt: "2026-05-01T00:00:00.000Z", seenCount: 1 },
    ];
    const out = renderGlossary(learned);
    expect(out).toContain("Learn more:");
    expect(out).toContain("OWASP");
  });

  it("existing grouping, labels, dates and seen counts still present when learn-more added", () => {
    const learned: LearnedConcept[] = [
      { id: "git-commit", learnedAt: "2026-01-02T10:00:00.000Z", seenCount: 3 },
      { id: "api", learnedAt: "2026-02-15T08:30:00.000Z", seenCount: 1 },
    ];
    const out = renderGlossary(learned);
    // Existing assertions still hold
    expect(out).toContain("## Git & version control");
    expect(out).toContain("## Web & APIs");
    expect(out).toContain("Git commit");
    expect(out).toContain("seen 3×");
    expect(out).toContain("2026-01-02");
    // And learn-more links present
    expect(out).toContain("Learn more:");
  });
});
