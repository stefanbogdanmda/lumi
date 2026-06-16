import { spawn } from "node:child_process";
import { Concept, Lesson, LessonGenerator, LearnerLevel } from "./types";

/** Deterministic generator for tests and offline fallback. */
export class MockGenerator implements LessonGenerator {
  async generate(concept: Concept, _context: string, _level: LearnerLevel = "beginner"): Promise<Lesson> {
    return {
      conceptId: concept.id,
      title: concept.label,
      plainExplanation: `${concept.label} is a ${concept.category} concept you just ran into.`,
      whyItMatters: "Understanding it helps you follow what Claude Code is doing.",
      analogy: `Think of ${concept.label} like an everyday tool you already use.`,
    };
  }
}

const LEVEL_GUIDANCE: Record<LearnerLevel, string> = {
  beginner: "The learner is a BEGINNER: assume zero prior knowledge, use a simple analogy, keep it very gentle.",
  growing: "The learner is GROWING: they know the basics; you can reference common concepts and add one useful detail.",
  confident: "The learner is CONFIDENT: be concise and skip the basics; add nuance or a non-obvious tip.",
};

/** Build the prompt that asks Claude to write a beginner lesson as strict JSON. */
export function buildLessonPrompt(concept: Concept, context: string, level: LearnerLevel = "beginner"): string {
  return [
    `You are Lumi, a friendly mini-teacher.`,
    LEVEL_GUIDANCE[level],
    `Teach ONLY the concept "${concept.label}" — nothing else.`,
    `Start the explanation by referring to what just happened, e.g. "Claude just ...".`,
    `Rules: plain English, no jargon (define any unavoidable term in the same sentence).`,
    `Do not invent specific names, numbers, or commands that are not in the context.`,
    `If you are unsure of a detail, stay general rather than guessing.`,
    `Include a short, vivid everyday analogy a non-technical person would instantly get.`,
    `Context where it appeared (use it to anchor the lesson): """${context.slice(0, 800)}"""`,
    ``,
    `Reply with ONLY a JSON code block, no prose, in exactly this shape:`,
    "```json",
    `{"title":"...","plainExplanation":"2-3 short sentences, <= 400 chars",`,
    `"whyItMatters":"one sentence","analogy":"optional, one short everyday-analogy sentence","tinyExample":"optional, <= 1 line","learnMore":"optional, 2-3 sentences"}`,
    "```",
  ].join("\n");
}

/** Attempt to extract key:"value" pairs from a string that is not valid JSON. */
function salvageFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["title", "plainExplanation", "whyItMatters", "analogy", "tinyExample", "learnMore"]) {
    const m = raw.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
    if (m) out[key] = m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/\s*\n\s*/g, " ").trim();
  }
  return out;
}

/** Pull a Lesson out of model output that contains a ```json block (or raw JSON). */
export function parseLessonJson(raw: string, concept: Concept): Lesson {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const start = raw.lastIndexOf("{"), end = raw.lastIndexOf("}");
  // When end <= start the block has no closing brace; include everything from start.
  const jsonText = fenced ? fenced[1]
    : (start !== -1 && end > start ? raw.slice(start, end + 1)
      : start !== -1 ? raw.slice(start) : "");
  let obj: any;
  try {
    obj = JSON.parse(jsonText.trim());
  } catch {
    // JSON.parse failed — try to salvage quoted fields, preferring the narrowed jsonText.
    const fromNarrow = salvageFields(jsonText);
    obj = (fromNarrow.title && fromNarrow.plainExplanation && fromNarrow.whyItMatters)
      ? fromNarrow
      : salvageFields(raw);
  }
  const req = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = req(obj.title), plain = req(obj.plainExplanation), why = req(obj.whyItMatters);
  if (!title || !plain || !why) {
    throw new Error("Lumi: could not parse lesson JSON from model output");
  }
  const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const opt = (v: unknown, n: number) => { const s = req(v); return s ? cap(s, n) : undefined; };
  return {
    conceptId: concept.id,
    title: cap(title, 80),
    plainExplanation: cap(plain, 500),
    whyItMatters: cap(why, 200),
    analogy: opt(obj.analogy, 160),
    tinyExample: opt(obj.tinyExample, 120),
    learnMore: opt(obj.learnMore, 400),
  };
}

export type ArgsBuilder = (prompt: string) => string[];

/** Generates lessons by shelling out to ANY AI CLI: bin + args-builder are injectable. */
export class CliGenerator implements LessonGenerator {
  readonly bin: string;
  readonly buildArgs: ArgsBuilder;
  private timeoutMs: number;

  constructor(opts: { bin: string; buildArgs?: ArgsBuilder; timeoutMs?: number }) {
    this.bin = opts.bin;
    this.buildArgs = opts.buildArgs ?? ((p) => ["-p", p]);
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  generate(concept: Concept, context: string, level: LearnerLevel = "beginner"): Promise<Lesson> {
    const prompt = buildLessonPrompt(concept, context, level);
    const args = this.buildArgs(prompt);
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let out = "", err = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Lumi: '${this.bin}' CLI timed out`)); }, this.timeoutMs);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => { clearTimeout(timer); reject(new Error(`Lumi: failed to run '${this.bin}': ${e.message}`)); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`Lumi: '${this.bin}' CLI exited ${code}: ${err.slice(0, 200)}`));
        try { resolve(parseLessonJson(out, concept)); } catch (e) { reject(e); }
      });
    });
  }
}

/** Preset: Claude Code CLI (`claude -p "<prompt>"`). Back-compat with prior usage. */
export class ClaudeCliGenerator extends CliGenerator {
  constructor(bin = "claude", timeoutMs = 30000) {
    super({ bin, timeoutMs });
  }
}

/** Preset: OpenAI Codex CLI (`codex exec "<prompt>"`). Exact args may need live tuning. */
export class CodexCliGenerator extends CliGenerator {
  constructor(bin = "codex", timeoutMs = 30000) {
    super({ bin, buildArgs: (p) => ["exec", p], timeoutMs });
  }
}

/** Preset: Gemini CLI (`gemini -p "<prompt>"`). Exact args may need live tuning. */
export class GeminiCliGenerator extends CliGenerator {
  constructor(bin = "gemini", timeoutMs = 30000) {
    super({ bin, buildArgs: (p) => ["-p", p], timeoutMs });
  }
}

/** Tries a primary generator, then falls back to a secondary one on failure. */
export class FallbackGenerator implements LessonGenerator {
  constructor(
    private primary: LessonGenerator,
    private fallback: LessonGenerator,
    private onFallback?: (err: unknown) => void,
  ) {}
  async generate(concept: Concept, context: string, level?: LearnerLevel): Promise<Lesson> {
    try {
      return await this.primary.generate(concept, context, level);
    } catch (err) {
      this.onFallback?.(err);
      return this.fallback.generate(concept, context, level);
    }
  }
}
