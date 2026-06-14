import { describe, it, expect } from "vitest";
import { MockGenerator, parseLessonJson, buildLessonPrompt } from "../src/generator";
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

describe("buildLessonPrompt", () => {
  it("anchors to what just happened and constrains the model", () => {
    const p = buildLessonPrompt(concept, "Claude just ran git commit -m 'x'");
    expect(p).toContain("Git commit");                 // the concept label
    expect(p.toLowerCase()).toContain("just");          // action anchoring
    expect(p.toLowerCase()).toContain("do not invent");  // anti-hallucination
  });
});

describe("parseLessonJson validation", () => {
  it("trims over-long fields to a safe length", () => {
    const long = "x".repeat(2000);
    const raw = `{"title":"T","plainExplanation":"${long}","whyItMatters":"y"}`;
    const l = parseLessonJson(raw, concept);
    expect(l.plainExplanation.length).toBeLessThanOrEqual(500);
  });
  it("rejects whitespace-only required fields", () => {
    const raw = '{"title":"   ","plainExplanation":"ok","whyItMatters":"y"}';
    expect(() => parseLessonJson(raw, concept)).toThrow();
  });
});
