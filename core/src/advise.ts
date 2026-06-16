/**
 * advise.ts — the `lumi next` coach.
 *
 * Looks at what the user has learned, builds a focused prompt, calls the AI
 * model (via the same CLI shell-out pattern as CliGenerator), and prints
 * 2–3 encouraging concrete next steps with "why it matters" reasoning,
 * pitched at the learner's level.  Always falls back to a deterministic
 * offline template so it never hard-fails.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JsonFileProfile } from "./profile";
import { readEventsSince, FeedEvent } from "./feed";
import { levelFromCount } from "./level";
import { CONCEPTS } from "./concepts";
import { LearnedConcept } from "./types";
import { lumiHome } from "./paths";
import { runTextModel } from "./textmodel";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AdviceInput {
  level: string;
  learnedLabels: string[];
  recentConcepts: string[];
}

/** Minimal injectable interface for free-text generation. */
export interface AdviceGenerator {
  advise(prompt: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// buildAdvicePrompt — PURE
// ---------------------------------------------------------------------------

/**
 * Builds a tight prompt that instructs the model to give 2–3 specific,
 * encouraging next build-steps for a NON-TECHNICAL person, each with a
 * one-line "why it matters," grounded in what they have done.
 */
export function buildAdvicePrompt(input: AdviceInput): string {
  const { level, learnedLabels, recentConcepts } = input;

  const learnedSection =
    learnedLabels.length > 0
      ? `Concepts the learner already knows: ${learnedLabels.join(", ")}.`
      : "The learner has not yet learned any concepts.";

  const recentSection =
    recentConcepts.length > 0
      ? `Most recently encountered: ${recentConcepts.join(", ")}.`
      : "";

  return [
    `You are Lumi, a friendly coding coach for non-technical people.`,
    `The learner's level is: ${level}.`,
    learnedSection,
    recentSection,
    ``,
    `Give exactly 2-3 concrete next build-steps this person can try TODAY.`,
    `For each step, add one short sentence: "Why it matters: ..."`,
    `Rules:`,
    `- Write in plain, everyday language — avoid jargon or explain any you must use.`,
    `- Be specific and encouraging. Ground every suggestion in what they have already done.`,
    `- Keep your entire response to about 150 words maximum.`,
    `- Do NOT use bullet points with dashes; number each step (1. 2. 3.).`,
    `- Do not invent steps unrelated to what they have learned.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// offlineAdvice — deterministic fallback, PURE
// ---------------------------------------------------------------------------

/**
 * Returns a useful, jargon-light advice string derived purely from what the
 * user has already learned.  Used when no model is reachable.
 */
export function offlineAdvice(input: AdviceInput): string {
  const { learnedLabels, recentConcepts, level } = input;

  if (learnedLabels.length === 0) {
    return (
      "Great start! Here are your first steps:\n" +
      "1. Try building something small — even a single file counts. Why it matters: you learn best by doing.\n" +
      "2. Run a command in the terminal. Why it matters: getting comfortable with the command line opens every door in tech.\n" +
      "3. Save your work with Git. Why it matters: you will never lose progress again."
    );
  }

  const anchor = recentConcepts[0] ?? learnedLabels[0];
  const extras = learnedLabels.filter((l) => l !== anchor).slice(0, 2);

  const levelHint =
    level === "confident"
      ? "Since you are confident, try combining what you know in a new project."
      : level === "growing"
      ? "You are growing — now is a great time to practise what you know on a real task."
      : "As a beginner, every small win builds your confidence.";

  const lines: string[] = [
    `Here are your next steps based on what you have learned so far:`,
    ``,
    `1. Build a small practice project using ${anchor}. Why it matters: hands-on practice is the fastest way to make ${anchor} feel natural.`,
  ];

  if (extras[0]) {
    lines.push(
      `2. Combine ${anchor} with ${extras[0]} in the same project. Why it matters: seeing how concepts work together is when things really click.`,
    );
  } else {
    lines.push(
      `2. Repeat what you did with ${anchor}, but change one small thing. Why it matters: small experiments build understanding faster than reading.`,
    );
  }

  lines.push(
    `3. Share or describe what you built to someone else. Why it matters: explaining something is the best way to know you truly understand it.`,
  );

  lines.push(``, levelHint);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CliAdviceGenerator — real implementation via CLI shell-out, source-routed
// ---------------------------------------------------------------------------

/**
 * Shells out to the appropriate CLI (determined by `source`) to get free-text
 * advice.  Uses runTextModel from textmodel.ts so bin/args conventions are
 * centralised: codex→"codex exec", gemini→"gemini -p", everything else→"claude -p".
 *
 * The class is named CliAdviceGenerator but exported as ClaudeAdviceGenerator
 * for back-compat (existing code that imports the old name keeps working).
 */
export class CliAdviceGenerator implements AdviceGenerator {
  constructor(
    private readonly source: string = "claude",
    private readonly timeoutMs: number = 30_000,
  ) {}

  advise(prompt: string): Promise<string> {
    return runTextModel(prompt, { source: this.source, timeoutMs: this.timeoutMs });
  }
}

/** @deprecated Use CliAdviceGenerator instead. Back-compat alias. */
export const ClaudeAdviceGenerator = CliAdviceGenerator;

// ---------------------------------------------------------------------------
// runAdvise — orchestrator
// ---------------------------------------------------------------------------

export interface RunAdviseDeps {
  home?: string;
  out?: (s: string) => void;
  /** Injectable advise function; defaults to source-routed CLI with offline fallback. */
  advise?: (prompt: string) => Promise<string>;
  /**
   * Which AI tool to use when no `advise` fn is injected.
   * Accepted values: "claude" (default), "codex", "gemini", "claude-code",
   * "cursor", "copilot", "opencode", "unknown".
   * Mapped to the correct CLI bin/args by resolveTextModel().
   */
  source?: string;
}

/**
 * Reads the profile (learned concepts) + recent feed events, builds a prompt,
 * calls the injected `advise` fn (default = real Claude CLI with offline
 * fallback), prints a friendly result, and returns an exit code.
 */
export async function runAdvise(deps: RunAdviseDeps = {}): Promise<number> {
  const out = deps.out ?? ((s: string) => console.log(s));
  const home = deps.home ?? lumiHome();
  const profileFile = join(home, "profile.json");

  // Load profile — safe if missing
  let learned: LearnedConcept[] = [];
  if (existsSync(profileFile)) {
    try {
      const raw = readFileSync(profileFile, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) learned = parsed as LearnedConcept[];
    } catch {
      /* corrupt profile -> start fresh */
    }
  }

  // Empty-profile onboarding shortcut
  if (learned.length === 0) {
    out("You haven't learned any concepts yet — start building and run `lumi next` again!");
    out("Lumi will give you personalised advice once it has seen you in action.");
    return 0;
  }

  // Resolve human-readable labels for learned concepts
  const conceptMap = new Map(CONCEPTS.map((c) => [c.id, c]));
  const learnedLabels = learned
    .map((lc) => conceptMap.get(lc.id)?.label ?? lc.id)
    .filter(Boolean) as string[];

  // Determine level
  const level = levelFromCount(learned.length);

  // Recent concepts from feed (last ~50 events, most recent 3 unique concepts)
  const feedFile = join(home, "feed.jsonl");
  let recentConcepts: string[] = [];
  if (existsSync(feedFile)) {
    try {
      const { events } = readEventsSince(feedFile, 0);
      const seen = new Set<string>();
      const recent: string[] = [];
      for (const e of [...events].reverse()) {
        const ev = e as FeedEvent;
        if (ev.type === "lesson" && ev.concept) {
          const label = conceptMap.get(ev.concept)?.label ?? ev.concept;
          if (!seen.has(label)) {
            seen.add(label);
            recent.push(label);
          }
          if (recent.length >= 3) break;
        }
      }
      recentConcepts = recent;
    } catch {
      /* feed unreadable -> skip */
    }
  }

  const input: AdviceInput = { level, learnedLabels, recentConcepts };
  const prompt = buildAdvicePrompt(input);

  // Choose advise fn: injected > source-routed CliAdviceGenerator > offline
  const source = deps.source ?? "claude";
  const adviseFn: (p: string) => Promise<string> =
    deps.advise ??
    (async (p: string) => {
      try {
        return await new CliAdviceGenerator(source).advise(p);
      } catch {
        return offlineAdvice(input);
      }
    });

  let text: string;
  try {
    text = await adviseFn(prompt);
    if (!text || !text.trim()) text = offlineAdvice(input);
  } catch {
    text = offlineAdvice(input);
  }

  out("Lumi's next-step suggestions for you:");
  out("");
  out(text.trim());
  return 0;
}
