import { runTextModel } from "./textmodel";

/** Minimal interface for a prompt polisher — injectable so tests stay offline. */
export interface PromptPolisher {
  polish(rawIdea: string): Promise<string>;
}

/** Options shared by pure helper functions. */
export interface PolishOpts {
  /** Learner level hint passed to the model ("beginner" | "growing" | "confident"). */
  level?: string;
}

/**
 * PURE — builds the meta-prompt that instructs a model to rewrite a rough idea
 * into a strong, paste-ready prompt for an AI coding assistant.
 *
 * The output from the model should be the ready-to-use prompt itself, not a
 * lecture about prompting, so the instruction says "output the rewritten prompt
 * only".
 */
export function buildPolishPrompt(rawIdea: string, opts: PolishOpts = {}): string {
  const levelNote =
    opts.level === "confident"
      ? "The user is a confident developer; technical vocabulary is fine."
      : opts.level === "growing"
        ? "The user has some coding experience; keep explanations light."
        : "The user is a beginner; use plain language they can immediately understand.";

  return [
    `You are a prompt-crafting assistant that helps people get better results from AI coding tools (Claude, Codex, Cursor, etc.).`,
    ``,
    `${levelNote}`,
    ``,
    `Your task: rewrite the rough idea below into a clear, well-structured prompt that a beginner can paste directly into their AI coding tool.`,
    ``,
    `The rewritten prompt MUST include ALL of the following sections (use these exact headings):`,
    `  ## Goal`,
    `  ## Context and constraints`,
    `  ## Acceptance criteria`,
    ``,
    `Rules:`,
    `- Keep every sentence in plain language — no unexplained jargon.`,
    `- Be specific about what "done" looks like (acceptance criteria).`,
    `- Do NOT lecture about prompting — just output the improved prompt.`,
    `- Do NOT invent features or requirements not implied by the rough idea.`,
    `- One short note at the end is allowed, formatted as: Note: <what was improved>.`,
    ``,
    `Rough idea:`,
    `"""${rawIdea.trim()}"""`,
    ``,
    `Output the rewritten prompt only (start immediately with "## Goal").`,
  ].join("\n");
}

/**
 * PURE offline fallback — wraps the raw idea in a solid four-section template
 * without needing a live model. Always returns a non-empty, structured result.
 */
export function offlinePolish(rawIdea: string, opts: PolishOpts = {}): string {
  const idea = rawIdea.trim();
  const levelHint =
    opts.level === "confident"
      ? "technical implementation"
      : "simple, step-by-step implementation";

  return [
    `## Goal`,
    ``,
    `${idea}`,
    ``,
    `## Context and constraints`,
    ``,
    `- Use a ${levelHint} approach.`,
    `- Prefer standard, well-supported libraries unless the goal specifically requires something else.`,
    `- Keep the code readable and easy to maintain.`,
    ``,
    `## Acceptance criteria`,
    ``,
    `- The feature works as described in the Goal section above.`,
    `- Edge cases (empty input, errors, missing data) are handled gracefully.`,
    `- The code includes at least a brief comment explaining the main logic.`,
    `- A human can verify it works by [describe a simple manual test related to: ${idea}].`,
    ``,
    `Note: Goal and constraints clarified; acceptance criteria added so "done" is unambiguous.`,
  ].join("\n");
}

/**
 * Shells out to the source-routed CLI to polish a prompt.
 *
 * The class is named CliPolisher but exported as ClaudePolisher for
 * back-compat (existing code that imports the old name keeps working).
 * When constructed with no `source`, defaults to "claude".
 */
export class CliPolisher implements PromptPolisher {
  private source: string;
  private timeoutMs: number;

  constructor(opts: { bin?: string; source?: string; timeoutMs?: number } = {}) {
    // Accept `bin` for back-compat: if only bin is given (not source), derive
    // source from it so bin="claude" still routes correctly.
    this.source = opts.source ?? opts.bin ?? "claude";
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  async polish(rawIdea: string): Promise<string> {
    const metaPrompt = buildPolishPrompt(rawIdea);
    const result = await runTextModel(metaPrompt, { source: this.source, timeoutMs: this.timeoutMs });
    if (!result) throw new Error(`Lumi prompt: model returned empty output`);
    return result;
  }
}

/** @deprecated Use CliPolisher instead. Back-compat alias. */
export const ClaudePolisher = CliPolisher;

/** Tries CliPolisher first, falls back to offlinePolish on any error. */
export class FallbackPolisher implements PromptPolisher {
  private primary: PromptPolisher;
  private opts: PolishOpts;

  constructor(primary?: PromptPolisher, opts: PolishOpts = {}) {
    this.primary = primary ?? new CliPolisher();
    this.opts = opts;
  }

  async polish(rawIdea: string): Promise<string> {
    try {
      return await this.primary.polish(rawIdea);
    } catch {
      return offlinePolish(rawIdea, this.opts);
    }
  }
}

const USAGE = `Usage: lumi prompt "<rough idea>"

  Turns a messy one-line idea into a clear, structured prompt you can paste
  into Claude, Codex, Cursor, or any other AI coding tool.

  Example:
    lumi prompt "make a todo list app"`;

const DELIMITER_TOP = "─────────────── Your polished prompt ───────────────";
const DELIMITER_BOT = "─────────────────────────────────────────────────────";

/**
 * Validates input, polishes the prompt, prints it clearly delimited, and
 * returns an exit code.
 *
 * Injectable deps for tests:
 *   out      — replace console.log (default)
 *   polish   — replace the real polisher (default = FallbackPolisher)
 *   source   — which AI tool to route to ("claude" default, "codex", "gemini", …)
 *   generator — accepted for CliDeps bag compat (unused)
 *   level    — learner level hint
 */
export async function runPrompt(
  rawIdea: string,
  deps: {
    out?: (s: string) => void;
    polish?: (p: string) => Promise<string>;
    source?: string;
    generator?: unknown;
    level?: string;
  } = {},
): Promise<number> {
  const out = deps.out ?? ((s: string) => console.log(s));
  const idea = (rawIdea ?? "").trim();

  if (!idea) {
    out(USAGE);
    return 1;
  }

  const source = deps.source ?? "claude";
  const polishFn: (p: string) => Promise<string> =
    deps.polish ??
    (async (idea: string) =>
      new FallbackPolisher(new CliPolisher({ source }), { level: deps.level }).polish(idea));

  const polished = await polishFn(idea);

  out(DELIMITER_TOP);
  out(polished);
  out(DELIMITER_BOT);

  return 0;
}
