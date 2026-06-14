import { describe, it, expect } from "vitest";
import { MockGenerator, parseLessonJson } from "../src/generator";
import { Concept } from "../src/types";

const concept: Concept = { id: "git-commit", label: "Git commit", category: "git", matchers: ["commit"] };

describe("MockGenerator", () => {
  it("returns a lesson for the concept", async () => {
    const l = await new MockGenerator().generate(concept, "some context");
    expect(l.conceptId).toBe("git-commit");
    expect(l.title).toContain("Git commit");
    expect(l.plainExplanation.length).toBeGreaterThan(0);
  });
});

describe("parseLessonJson", () => {
  it("extracts a lesson from a JSON code block in model output", () => {
    const raw = 'Sure!\n```json\n{"title":"Git commit","plainExplanation":"Saves a snapshot.","whyItMatters":"History."}\n```';
    const l = parseLessonJson(raw, concept);
    expect(l.title).toBe("Git commit");
    expect(l.conceptId).toBe("git-commit");
  });

  it("extracts a lesson from raw JSON with no code fence", () => {
    const raw = 'Here you go: {"title":"Git commit","plainExplanation":"Saves a snapshot.","whyItMatters":"History."} cheers';
    const l = parseLessonJson(raw, concept);
    expect(l.title).toBe("Git commit");
    expect(l.conceptId).toBe("git-commit");
  });

  it("throws on unparseable output", () => {
    expect(() => parseLessonJson("no json here", concept)).toThrow();
  });
});
