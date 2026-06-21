import { describe, it, expect } from "vitest";
import {
  buildPolishPrompt,
  offlinePolish,
  runPrompt,
  promptTips,
  FallbackPolisher,
  ClaudePolisher,
} from "../src/prompt";

// ─── buildPolishPrompt (pure) ────────────────────────────────────────────────

describe("buildPolishPrompt", () => {
  it("embeds the raw idea verbatim", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p).toContain("build a todo list app");
  });

  it("mentions acceptance criteria", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p.toLowerCase()).toContain("acceptance criteria");
  });

  it("mentions constraints", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p.toLowerCase()).toContain("constraint");
  });

  it("asks for plain language output (beginner-oriented)", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p.toLowerCase()).toContain("plain language");
  });

  it("instructs the model to output the prompt only, not a lecture", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p.toLowerCase()).toContain("do not lecture");
  });

  it("includes Goal, Context and constraints, Acceptance criteria section headings", () => {
    const p = buildPolishPrompt("build a todo list app");
    expect(p).toContain("## Goal");
    expect(p).toContain("## Context and constraints");
    expect(p).toContain("## Acceptance criteria");
  });

  it("adapts the level hint for 'beginner'", () => {
    const p = buildPolishPrompt("build a todo list app", { level: "beginner" });
    expect(p.toLowerCase()).toContain("beginner");
  });

  it("adapts the level hint for 'confident'", () => {
    const p = buildPolishPrompt("build a todo list app", { level: "confident" });
    expect(p.toLowerCase()).toContain("confident");
  });

  it("does not use the same level note for confident vs beginner", () => {
    const beginner = buildPolishPrompt("build an app", { level: "beginner" });
    const confident = buildPolishPrompt("build an app", { level: "confident" });
    expect(beginner).not.toBe(confident);
  });

  // False-positive guard: ensure ordinary English words don't accidentally
  // end up interpreted as level hints that change the prompt substantively.
  it("defaults safely to beginner language when no level is supplied", () => {
    const p = buildPolishPrompt("build an app");
    expect(p.toLowerCase()).toContain("beginner");
  });
});

// ─── offlinePolish (pure fallback) ──────────────────────────────────────────

describe("offlinePolish", () => {
  it("returns a non-empty string", () => {
    const result = offlinePolish("make a todo app");
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("embeds the user's original idea", () => {
    const result = offlinePolish("make a todo app");
    expect(result).toContain("make a todo app");
  });

  it("contains a Goal section", () => {
    const result = offlinePolish("make a todo app");
    expect(result).toContain("## Goal");
  });

  it("contains a Context and constraints section", () => {
    const result = offlinePolish("make a todo app");
    expect(result).toContain("## Context and constraints");
  });

  it("contains an Acceptance criteria section", () => {
    const result = offlinePolish("make a todo app");
    expect(result).toContain("## Acceptance criteria");
  });

  it("mentions 'done' or acceptance criteria so output is unambiguous", () => {
    const result = offlinePolish("make a todo app");
    expect(result.toLowerCase()).toMatch(/acceptance criteria|done/);
  });

  it("includes an explanatory note at the bottom", () => {
    const result = offlinePolish("make a todo app");
    expect(result.toLowerCase()).toContain("note:");
  });

  it("adjusts language for 'confident' level", () => {
    const result = offlinePolish("build an API", { level: "confident" });
    expect(result.toLowerCase()).toContain("technical");
  });

  it("uses simple language for default/beginner level", () => {
    const result = offlinePolish("build an API");
    expect(result.toLowerCase()).toContain("simple");
  });

  // False-positive guard: must work with multi-word ideas too
  it("handles a multi-word idea without crashing or producing an empty result", () => {
    const result = offlinePolish("build a REST API with auth and a dashboard");
    expect(result.trim().length).toBeGreaterThan(50);
    expect(result).toContain("build a REST API with auth and a dashboard");
  });
});

// ─── promptTips (pure) ───────────────────────────────────────────────────────

describe("promptTips", () => {
  it("coaches a too-vague one-liner", () => {
    const tips = promptTips("make an app");
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].toLowerCase()).toContain("detail");
  });

  it("returns nothing for an empty idea", () => {
    expect(promptTips("")).toEqual([]);
    expect(promptTips("   ")).toEqual([]);
  });

  it("returns nothing for a long, detailed idea", () => {
    const detailed =
      "Build a Python script that reads a CSV of customers, removes duplicate rows, " +
      "and writes a cleaned file so that I can import it into my mailing tool and verify " +
      "the row count matches what I expect when it finishes running successfully today";
    expect(promptTips(detailed)).toEqual([]);
  });

  it("suggests naming the platform when none is mentioned", () => {
    const tips = promptTips("track my expenses each month and show totals");
    expect(tips.join(" ").toLowerCase()).toMatch(/website|script|mobile app|kind of thing/);
  });

  it("never returns more than two tips", () => {
    expect(promptTips("thing").length).toBeLessThanOrEqual(2);
  });
});

// ─── runPrompt ───────────────────────────────────────────────────────────────

describe("runPrompt", () => {
  it("returns exit code 0 and prints polished prompt when a valid idea is given", async () => {
    const lines: string[] = [];
    const fakPolish = async (_idea: string) => "## Goal\nBuild a todo app.\n## Context and constraints\nNone.\n## Acceptance criteria\nApp works.";

    const code = await runPrompt("make a todo app", {
      out: (s) => lines.push(s),
      polish: fakPolish,
    });

    expect(code).toBe(0);
    const output = lines.join("\n");
    expect(output).toContain("## Goal");
    expect(output).toContain("Build a todo app.");
  });

  it("appends 'next time' coaching tips for a vague idea", async () => {
    const lines: string[] = [];
    const code = await runPrompt("make an app", {
      out: (s) => lines.push(s),
      polish: async () => "## Goal\nDone.",
    });
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("To get even better results next time");
  });

  it("does not append tips for a long, detailed idea", async () => {
    const lines: string[] = [];
    const detailed =
      "Build a Python script that reads a CSV of customers, removes duplicate rows, " +
      "and writes a cleaned file so that I can import it into my mailing tool and verify " +
      "the row count matches what I expect when it finishes running successfully today";
    await runPrompt(detailed, { out: (s) => lines.push(s), polish: async () => "## Goal\nDone." });
    expect(lines.join("\n")).not.toContain("next time");
  });

  it("prints a clear delimiter around the polished prompt", async () => {
    const lines: string[] = [];
    const fakPolish = async (_: string) => "polished content here";

    await runPrompt("some idea", {
      out: (s) => lines.push(s),
      polish: fakPolish,
    });

    const output = lines.join("\n");
    // There should be some visual delimiter lines around the content
    expect(output).toContain("polished content here");
    expect(lines.length).toBeGreaterThanOrEqual(3); // delimiter + content + delimiter
  });

  it("returns exit code 1 and prints usage message when idea is empty", async () => {
    const lines: string[] = [];
    const code = await runPrompt("", { out: (s) => lines.push(s) });

    expect(code).toBe(1);
    const output = lines.join("\n");
    expect(output.toLowerCase()).toContain("usage");
  });

  it("returns exit code 1 and prints usage message when idea is whitespace only", async () => {
    const lines: string[] = [];
    const code = await runPrompt("   ", { out: (s) => lines.push(s) });

    expect(code).toBe(1);
    const output = lines.join("\n");
    expect(output.toLowerCase()).toContain("usage");
  });

  it("passes the idea through to the injected polish function", async () => {
    let receivedIdea = "";
    const fakPolish = async (idea: string) => {
      receivedIdea = idea;
      return "## Goal\nDone.";
    };

    await runPrompt("  build a REST API  ", {
      out: () => {},
      polish: fakPolish,
    });

    // runPrompt trims the idea before passing it
    expect(receivedIdea).toBe("build a REST API");
  });

  it("accepts and ignores the generator dep without throwing (CliDeps bag compat)", async () => {
    const lines: string[] = [];
    const code = await runPrompt("build something", {
      out: (s) => lines.push(s),
      polish: async () => "## Goal\nOk.",
      generator: { generate: async () => ({}) }, // dummy generator
    });
    expect(code).toBe(0);
  });
});

// ─── FallbackPolisher ────────────────────────────────────────────────────────

describe("FallbackPolisher", () => {
  it("uses the primary polisher when it succeeds", async () => {
    const primary: { polish: (s: string) => Promise<string> } = {
      polish: async (_: string) => "## Goal\nFrom primary.",
    };
    const polisher = new FallbackPolisher(primary as any);
    const result = await polisher.polish("make something");
    expect(result).toContain("From primary.");
  });

  it("falls back to offlinePolish when the primary throws", async () => {
    const failing = {
      polish: async (_: string): Promise<string> => {
        throw new Error("claude not available");
      },
    };
    const polisher = new FallbackPolisher(failing as any, {});
    const result = await polisher.polish("make a todo app");
    // Should get the offline template which has the idea embedded
    expect(result).toContain("make a todo app");
    expect(result).toContain("## Goal");
  });

  it("offline fallback result always contains acceptance criteria section", async () => {
    const failing = {
      polish: async (_: string): Promise<string> => {
        throw new Error("no internet");
      },
    };
    const polisher = new FallbackPolisher(failing as any);
    const result = await polisher.polish("build a dashboard");
    expect(result).toContain("## Acceptance criteria");
  });
});

// ─── ClaudePolisher surface (no live spawn) ──────────────────────────────────

describe("ClaudePolisher", () => {
  it("is instantiable and exposes a polish method", () => {
    const p = new ClaudePolisher();
    expect(typeof p.polish).toBe("function");
  });

  it("accepts a custom bin name", () => {
    const p = new ClaudePolisher({ bin: "myclaude" });
    expect((p as any).source).toBe("myclaude");
  });
});

// ─── runPrompt source routing ────────────────────────────────────────────────

describe("runPrompt source routing", () => {
  it("accepts source param without throwing when injected polish fn is also provided", async () => {
    const lines: string[] = [];
    const code = await runPrompt("build a thing", {
      out: (s) => lines.push(s),
      polish: async () => "## Goal\nBuild.",
      source: "codex",
    });
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("## Goal");
  });

  it("defaults to offline polish when source='codex' and no injected polish fn (codex not available)", async () => {
    // No injected polish fn; source='codex' will fail to spawn → FallbackPolisher catches it
    const lines: string[] = [];
    const code = await runPrompt("make something cool", {
      out: (s) => lines.push(s),
      source: "codex",
    });
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("make something cool");
  });

  it("source param is accepted without error for all known sources", async () => {
    for (const source of ["claude", "codex", "gemini", "cursor", "copilot", "opencode", "unknown"]) {
      const lines: string[] = [];
      const code = await runPrompt("test idea", {
        out: (s) => lines.push(s),
        polish: async () => "## Goal\nTest.",
        source,
      });
      expect(code).toBe(0);
    }
  });
});
