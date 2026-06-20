import { describe, it, expect } from "vitest";
import { topicCategories, topicsInCategory, categoryLabel, relatedConcepts } from "../src/topics";
import { Concept } from "../src/types";

const SAMPLE: Concept[] = [
  { id: "git-commit", label: "Git commit", category: "git", matchers: [] },
  { id: "git-branch", label: "Git branch", category: "git", matchers: [] },
  { id: "api", label: "API", category: "web", matchers: [] },
  { id: "secret", label: "Leaked secret", category: "security", matchers: [] },
];

describe("categoryLabel", () => {
  it("maps known raw categories to friendly names", () => {
    expect(categoryLabel("security")).toBe("Security & safety");
    expect(categoryLabel("git")).toBe("Git & version control");
  });

  it("falls back to the raw id for unknown categories", () => {
    expect(categoryLabel("quantum")).toBe("quantum");
  });
});

describe("topicCategories", () => {
  it("groups concepts by category with counts and examples", () => {
    const cats = topicCategories(SAMPLE);
    const git = cats.find((c) => c.category === "git");
    expect(git?.count).toBe(2);
    expect(git?.label).toBe("Git & version control");
    expect(git?.examples).toContain("Git commit");
  });

  it("limits examples to the requested count", () => {
    const cats = topicCategories(SAMPLE, 1);
    expect(cats.find((c) => c.category === "git")?.examples.length).toBe(1);
  });

  it("orders categories by the curated learning order (programming/git first, security last)", () => {
    const cats = topicCategories(SAMPLE);
    expect(cats[0].category).toBe("git"); // earliest present in curated order
    expect(cats[cats.length - 1].category).toBe("security");
  });

  it("covers the real dictionary across all its categories", () => {
    const cats = topicCategories();
    const total = cats.reduce((n, c) => n + c.count, 0);
    expect(total).toBeGreaterThan(100);
    expect(cats.length).toBeGreaterThanOrEqual(8);
  });
});

describe("topicsInCategory", () => {
  it("lists concepts in a category, marking learned ones", () => {
    const list = topicsInCategory("git", ["git-commit"], SAMPLE);
    expect(list).not.toBeNull();
    expect(list!.length).toBe(2);
    expect(list!.find((c) => c.id === "git-commit")?.learned).toBe(true);
    expect(list!.find((c) => c.id === "git-branch")?.learned).toBe(false);
  });

  it("is case-insensitive on the category id", () => {
    expect(topicsInCategory("GIT", [], SAMPLE)).not.toBeNull();
  });

  it("returns null for an unknown category", () => {
    expect(topicsInCategory("nope", [], SAMPLE)).toBeNull();
    expect(topicsInCategory("", [], SAMPLE)).toBeNull();
  });

  it("sorts concepts alphabetically by label", () => {
    const list = topicsInCategory("git", [], SAMPLE)!;
    expect(list.map((c) => c.label)).toEqual(["Git branch", "Git commit"]);
  });
});

describe("relatedConcepts", () => {
  it("suggests unlearned siblings in the same category", () => {
    const rel = relatedConcepts("git-commit", [], SAMPLE);
    expect(rel.map((r) => r.id)).toEqual(["git-branch"]);
  });

  it("excludes the concept itself and already-learned siblings", () => {
    const rel = relatedConcepts("git-commit", ["git-branch"], SAMPLE);
    expect(rel).toEqual([]);
  });

  it("returns [] for an unknown concept", () => {
    expect(relatedConcepts("not-a-concept", [], SAMPLE)).toEqual([]);
  });

  it("respects the limit", () => {
    const many: Concept[] = [
      { id: "a", label: "A", category: "x", matchers: [] },
      { id: "b", label: "B", category: "x", matchers: [] },
      { id: "c", label: "C", category: "x", matchers: [] },
      { id: "d", label: "D", category: "x", matchers: [] },
    ];
    expect(relatedConcepts("a", [], many, 2).length).toBe(2);
  });

  it("orders higher-priority siblings first", () => {
    const withPriority: Concept[] = [
      { id: "a", label: "A", category: "x", matchers: [] },
      { id: "low", label: "Low", category: "x", matchers: [], priority: 1 },
      { id: "high", label: "High", category: "x", matchers: [], priority: 5 },
    ];
    expect(relatedConcepts("a", [], withPriority)[0].id).toBe("high");
  });
});
