import { describe, it, expect } from "vitest";
import { MockGenerator, parseLessonJson, buildLessonPrompt, FallbackGenerator, CliGenerator, ClaudeCliGenerator, CodexCliGenerator, GeminiCliGenerator } from "../src/generator";
import { Concept } from "../src/types";
import { LearnerLevel, LessonGenerator } from "../src/types";

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

describe("buildLessonPrompt levels", () => {
  it("includes the learner level so depth can adapt", () => {
    const beginner = buildLessonPrompt(concept, "ctx", "beginner");
    const confident = buildLessonPrompt(concept, "ctx", "confident");
    expect(beginner.toLowerCase()).toContain("beginner");
    expect(confident.toLowerCase()).toContain("confident");
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

describe("FallbackGenerator", () => {
  const throwing = { generate: async () => { throw new Error("claude not found"); } };
  const ok = { generate: async (c: any) => ({ conceptId: c.id, title: c.label, plainExplanation: "primary", whyItMatters: "y" }) };

  it("returns the primary lesson when the primary succeeds", async () => {
    let fellBack = false;
    const gen = new FallbackGenerator(ok, new MockGenerator(), () => { fellBack = true; });
    const lesson = await gen.generate(concept, "ctx");
    expect(lesson.plainExplanation).toBe("primary");
    expect(fellBack).toBe(false);
  });

  it("falls back and notifies when the primary throws", async () => {
    let fellBack = false;
    const gen = new FallbackGenerator(throwing, new MockGenerator(), () => { fellBack = true; });
    const lesson = await gen.generate(concept, "ctx");
    expect(lesson.conceptId).toBe(concept.id); // got a real lesson from MockGenerator
    expect(lesson.plainExplanation.length).toBeGreaterThan(0);
    expect(fellBack).toBe(true);
  });
});

describe("buildLessonPrompt analogy instruction", () => {
  it("includes the word 'analogy' in the beginner prompt", () => {
    const p = buildLessonPrompt(concept, "ctx", "beginner");
    expect(p.toLowerCase()).toContain("analogy");
  });

  it("includes analogy in the JSON shape line", () => {
    const p = buildLessonPrompt(concept, "ctx", "beginner");
    expect(p).toContain('"analogy"');
  });
});

describe("parseLessonJson salvage", () => {
  it("salvages a lesson from slightly-malformed JSON with an unescaped newline in a value", () => {
    // An unescaped newline inside a JSON string value makes JSON.parse throw,
    // but the key:"value" pairs are still extractable by regex.
    const malformed = `{"title":"Git commit","plainExplanation":"Saves a snapshot.\nThat is a newline.","whyItMatters":"History matters."}`;
    const l = parseLessonJson(malformed, concept);
    expect(l.title).toBe("Git commit");
    expect(l.whyItMatters).toBe("History matters.");
    expect(l.conceptId).toBe("git-commit");
    // The field that contained the real newline should have it collapsed to a space
    expect(l.plainExplanation).toContain("Saves a snapshot.");
    expect(l.plainExplanation).not.toMatch(/\n/);
  });

  it("salvages a lesson from JSON with a trailing comma", () => {
    const malformed = `{"title":"Git commit","plainExplanation":"Saves a snapshot.","whyItMatters":"History.",}`;
    const l = parseLessonJson(malformed, concept);
    expect(l.title).toBe("Git commit");
    expect(l.plainExplanation).toBe("Saves a snapshot.");
  });

  it("still throws on total garbage with no extractable fields", () => {
    expect(() => parseLessonJson("no fields here", concept)).toThrow();
  });

  it("returns the analogy field when present in valid JSON", () => {
    const raw = `{"title":"Git commit","plainExplanation":"Saves a snapshot.","whyItMatters":"History.","analogy":"Think of it like saving a document."}`;
    const l = parseLessonJson(raw, concept);
    expect(l.analogy).toBe("Think of it like saving a document.");
  });

  it("returns analogy as undefined when not present in valid JSON", () => {
    const raw = `{"title":"Git commit","plainExplanation":"Saves a snapshot.","whyItMatters":"History."}`;
    const l = parseLessonJson(raw, concept);
    expect(l.analogy).toBeUndefined();
  });

  it("prefers the narrowed JSON span over a prompt-echo placeholder that precedes it", () => {
    // The model echoes the prompt shape first (with placeholder values), then emits the
    // real (slightly malformed) lesson. Salvage must NOT grab the placeholder title "...".
    const raw =
      `{"title":"...","plainExplanation":"2-3 short sentences","whyItMatters":"one sentence"}\n` +
      `{"title":"Git commit","plainExplanation":"Saves your work","whyItMatters":"History"`;
    // No closing brace on the real block → JSON.parse fails on the narrowed span;
    // salvage of the narrowed span should still find the correct values.
    const l = parseLessonJson(raw, concept);
    expect(l.title).toBe("Git commit");
    expect(l.plainExplanation).toBe("Saves your work");
  });
});

describe("MockGenerator analogy", () => {
  it("sets an analogy on the returned lesson", async () => {
    const l = await new MockGenerator().generate(concept, "some context");
    expect(l.analogy).toBeDefined();
    expect(typeof l.analogy).toBe("string");
    expect((l.analogy as string).length).toBeGreaterThan(0);
  });
});

describe("CliGenerator base class", () => {
  it("stores bin and custom buildArgs", () => {
    const buildArgs = (p: string) => ["run", p];
    const gen = new CliGenerator({ bin: "mytool", buildArgs });
    expect(gen.bin).toBe("mytool");
    expect(gen.buildArgs("hi")).toEqual(["run", "hi"]);
  });

  it("defaults buildArgs to ['-p', prompt] when not provided", () => {
    const gen = new CliGenerator({ bin: "anytool" });
    expect(gen.buildArgs("hello")).toEqual(["-p", "hello"]);
  });

  it("is an instanceof CliGenerator (identity check)", () => {
    expect(new CliGenerator({ bin: "mytool" })).toBeInstanceOf(CliGenerator);
  });
});

// ---------------------------------------------------------------------------
// GAP 1 — CliGenerator.generate() subprocess path (real node binary)
// ---------------------------------------------------------------------------

import { CONCEPTS } from "../src/concepts";

const gitCommitConcept = CONCEPTS.find((c) => c.id === "git-commit")!;

describe("CliGenerator.generate() — subprocess paths", () => {
  it("success: resolves to a Lesson when node emits a valid ```json block", async () => {
    // node writes a valid fenced JSON block to stdout then exits 0
    const jsonPayload = JSON.stringify({
      title: "T",
      plainExplanation: "Plain.",
      whyItMatters: "Why.",
    });
    const script = `process.stdout.write(\`\\\`\\\`\\\`json\\n${jsonPayload}\\n\\\`\\\`\\\`\`)`;
    const gen = new CliGenerator({
      bin: "node",
      buildArgs: () => ["-e", script],
    });
    const lesson = await gen.generate(gitCommitConcept, "ctx");
    expect(lesson.title).toBe("T");
    expect(lesson.plainExplanation).toBe("Plain.");
    expect(lesson.whyItMatters).toBe("Why.");
    expect(lesson.conceptId).toBe("git-commit");
  });

  it("non-zero exit: rejects with a message mentioning the exit code", async () => {
    const gen = new CliGenerator({
      bin: "node",
      buildArgs: () => ["-e", "process.exit(3)"],
    });
    await expect(gen.generate(gitCommitConcept, "ctx")).rejects.toThrow(/3/);
  });

  it("spawn error (bin not found): rejects via child.on('error') path", async () => {
    const gen = new CliGenerator({ bin: "definitely-not-a-real-binary-xyzzy" });
    await expect(gen.generate(gitCommitConcept, "ctx")).rejects.toThrow(
      /definitely-not-a-real-binary-xyzzy/,
    );
  });

  it("timeout: rejects with timeout message well within the allotted window", async () => {
    const gen = new CliGenerator({
      bin: "node",
      buildArgs: () => ["-e", "setTimeout(()=>{}, 10000)"],
      timeoutMs: 100,
    });
    await expect(gen.generate(gitCommitConcept, "ctx")).rejects.toThrow(/timed out/i);
  }, 3000 /* Vitest per-test timeout ms */);
});

describe("ClaudeCliGenerator preset", () => {
  it("defaults bin to 'claude' and buildArgs to ['-p', prompt]", () => {
    const g = new ClaudeCliGenerator();
    expect(g.bin).toBe("claude");
    expect(g.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("is an instanceof CliGenerator", () => {
    expect(new ClaudeCliGenerator()).toBeInstanceOf(CliGenerator);
  });
});

describe("CodexCliGenerator preset", () => {
  it("defaults bin to 'codex' and buildArgs to ['exec', prompt]", () => {
    const g = new CodexCliGenerator();
    expect(g.bin).toBe("codex");
    expect(g.buildArgs("hi")).toEqual(["exec", "hi"]);
  });

  it("is an instanceof CliGenerator", () => {
    expect(new CodexCliGenerator()).toBeInstanceOf(CliGenerator);
  });
});

describe("GeminiCliGenerator preset", () => {
  it("defaults bin to 'gemini' and buildArgs to ['-p', prompt]", () => {
    const g = new GeminiCliGenerator();
    expect(g.bin).toBe("gemini");
    expect(g.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("is an instanceof CliGenerator", () => {
    expect(new GeminiCliGenerator()).toBeInstanceOf(CliGenerator);
  });
});
