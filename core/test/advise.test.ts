import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildAdvicePrompt, offlineAdvice, runAdvise } from "../src/advise";
import { LearnedConcept } from "../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeFakeProfile(home: string, concepts: LearnedConcept[]): void {
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, "profile.json"), JSON.stringify(concepts), "utf8");
}

// ---------------------------------------------------------------------------
// buildAdvicePrompt — pure function, no I/O
// ---------------------------------------------------------------------------

describe("buildAdvicePrompt", () => {
  const base = {
    level: "beginner",
    learnedLabels: ["Git commit", "npm install"],
    recentConcepts: ["Git commit"],
  };

  it("includes the learner level", () => {
    const p = buildAdvicePrompt(base);
    expect(p.toLowerCase()).toContain("beginner");
  });

  it("includes each learned label", () => {
    const p = buildAdvicePrompt(base);
    expect(p).toContain("Git commit");
    expect(p).toContain("npm install");
  });

  it("includes the recent concept", () => {
    const p = buildAdvicePrompt(base);
    expect(p).toContain("Git commit"); // present in recentConcepts
  });

  it("asks for 'why it matters' framing", () => {
    const p = buildAdvicePrompt(base);
    expect(p.toLowerCase()).toContain("why it matters");
  });

  it("requests non-technical / plain language framing", () => {
    const p = buildAdvicePrompt(base);
    // The prompt must ask for jargon-free or plain language output
    const lower = p.toLowerCase();
    const hasPlainLang =
      lower.includes("plain") ||
      lower.includes("non-technical") ||
      lower.includes("jargon") ||
      lower.includes("everyday");
    expect(hasPlainLang).toBe(true);
  });

  it("asks for 2-3 next steps", () => {
    const p = buildAdvicePrompt(base);
    // Should mention 2 or 3 suggestions
    expect(p).toMatch(/2[–\-–—]?3|two.{0,8}three/i);
  });

  it("requests approximately 150 words or similar length cap", () => {
    const p = buildAdvicePrompt(base);
    // The prompt should request a length limit so the output stays tight
    expect(p).toMatch(/\b150\b|~?\s*150\b|about 150/i);
  });

  it("handles empty learned lists without throwing", () => {
    const p = buildAdvicePrompt({ level: "beginner", learnedLabels: [], recentConcepts: [] });
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(0);
  });

  it("includes 'confident' level for advanced learners", () => {
    const p = buildAdvicePrompt({ level: "confident", learnedLabels: ["Git commit"], recentConcepts: [] });
    expect(p.toLowerCase()).toContain("confident");
  });
});

// ---------------------------------------------------------------------------
// offlineAdvice — pure deterministic fallback
// ---------------------------------------------------------------------------

describe("offlineAdvice", () => {
  it("returns a non-empty string", () => {
    const result = offlineAdvice({
      level: "beginner",
      learnedLabels: ["Git commit", "npm install"],
      recentConcepts: ["Git commit"],
    });
    expect(typeof result).toBe("string");
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("references at least one learned concept in the output", () => {
    const result = offlineAdvice({
      level: "beginner",
      learnedLabels: ["Git commit", "npm install"],
      recentConcepts: ["Git commit"],
    });
    // Should contain at least one concept label to be useful
    const lower = result.toLowerCase();
    const hasRef = lower.includes("git commit") || lower.includes("npm install");
    expect(hasRef).toBe(true);
  });

  it("works with an empty learned list", () => {
    const result = offlineAdvice({ level: "beginner", learnedLabels: [], recentConcepts: [] });
    expect(typeof result).toBe("string");
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("avoids dense jargon-only output (no raw command-line directives)", () => {
    const result = offlineAdvice({
      level: "beginner",
      learnedLabels: ["Git commit"],
      recentConcepts: [],
    });
    // Should contain at least one everyday-English word; not be pure symbols
    expect(result).toMatch(/\b(try|build|create|make|start|add|next|your|you|great|step)\b/i);
  });

  it("mentions something about the recent concept when one is provided", () => {
    const result = offlineAdvice({
      level: "beginner",
      learnedLabels: ["npm install"],
      recentConcepts: ["npm install"],
    });
    expect(result.toLowerCase()).toContain("npm install");
  });
});

// ---------------------------------------------------------------------------
// runAdvise — orchestrator with injected deps
// ---------------------------------------------------------------------------

describe("runAdvise", () => {
  let home: string;
  let lines: string[];
  const sink = (s: string) => lines.push(s);

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lumi-advise-"));
    lines = [];
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it("returns exit code 0 with an injected fake advise function", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    const fakeAdvise = async (_prompt: string) => "1. Try something. 2. Build on it.";
    const code = await runAdvise({ home, out: sink, advise: fakeAdvise });
    expect(code).toBe(0);
  });

  it("prints the model response text in the output", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    const advice = "Here are your next steps: 1. Keep committing. 2. Try branching.";
    const fakeAdvise = async (_prompt: string) => advice;
    await runAdvise({ home, out: sink, advise: fakeAdvise });
    const all = lines.join("\n");
    // The model text (or most of it) should appear somewhere in the printed output
    expect(all).toContain("next steps");
  });

  it("passes the prompt derived from the profile to the advise function", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 3 },
      { id: "npm-install", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    let capturedPrompt = "";
    const fakeAdvise = async (prompt: string) => {
      capturedPrompt = prompt;
      return "Great work!";
    };
    await runAdvise({ home, out: sink, advise: fakeAdvise });
    // The prompt should mention what was learned
    expect(capturedPrompt).toContain("Git commit");
    expect(capturedPrompt).toContain("Installing packages");
  });

  it("prints an onboarding message and returns 0 when profile is empty", async () => {
    // No profile.json written — fresh home directory
    const code = await runAdvise({ home, out: sink });
    expect(code).toBe(0);
    const all = lines.join("\n");
    // Should print an encouraging start-building message
    expect(all.toLowerCase()).toMatch(/start|build|run|first/);
  });

  it("uses offlineAdvice as a fallback when no advise fn is injected and model is unavailable", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    // Inject an advise fn that always rejects to simulate offline model
    const alwaysFail = async (_prompt: string): Promise<string> => {
      throw new Error("model not available");
    };
    const code = await runAdvise({ home, out: sink, advise: alwaysFail });
    expect(code).toBe(0);
    const all = lines.join("\n");
    expect(all.trim().length).toBeGreaterThan(0);
  });

  it("prints a header or preamble so the user knows what they are looking at", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    await runAdvise({ home, out: sink, advise: async () => "Step 1." });
    const all = lines.join("\n");
    // Should include some kind of header / label before the advice text
    expect(all).toMatch(/next|advice|step|Lumi/i);
  });

  it("accepts source param without breaking when injected advise fn is also provided", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    // Both source and advise injected: injected fn takes precedence, source is ignored
    const fakeAdvise = async (_prompt: string) => "1. Go! 2. Build!";
    const code = await runAdvise({ home, out: sink, advise: fakeAdvise, source: "codex" });
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("Go!");
  });

  it("falls back to offline when source is set and model is unavailable (no injected fn)", async () => {
    writeFakeProfile(home, [
      { id: "git-commit", learnedAt: new Date().toISOString(), seenCount: 1 },
    ]);
    // No advise fn injected; source='codex' will try to spawn codex (which doesn't exist here)
    // — should gracefully fall back to offlineAdvice
    const code = await runAdvise({ home, out: sink, source: "codex" });
    expect(code).toBe(0);
    // Should still print something useful (offline advice)
    expect(lines.join("\n").trim().length).toBeGreaterThan(0);
  });
});
