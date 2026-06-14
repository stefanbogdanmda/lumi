import { spawn } from "node:child_process";
import { Concept, Lesson, LessonGenerator } from "./types";

/** Deterministic generator for tests and offline fallback. */
export class MockGenerator implements LessonGenerator {
  async generate(concept: Concept, _context: string): Promise<Lesson> {
    return {
      conceptId: concept.id,
      title: concept.label,
      plainExplanation: `${concept.label} is a ${concept.category} concept you just ran into.`,
      whyItMatters: "Understanding it helps you follow what Claude Code is doing.",
    };
  }
}

/** Build the prompt that asks Claude to write a beginner lesson as strict JSON. */
export function buildLessonPrompt(concept: Concept, context: string): string {
  return [
    `You are Lumi, a friendly mini-teacher for someone NEW to coding.`,
    `Teach ONLY the concept "${concept.label}" — nothing else.`,
    `Start the explanation by referring to what just happened, e.g. "Claude just ...".`,
    `Rules: plain English, no jargon (define any unavoidable term in the same sentence).`,
    `Do not invent specific names, numbers, or commands that are not in the context.`,
    `If you are unsure of a detail, stay general rather than guessing.`,
    `Context where it appeared (use it to anchor the lesson): """${context.slice(0, 800)}"""`,
    ``,
    `Reply with ONLY a JSON code block, no prose, in exactly this shape:`,
    "```json",
    `{"title":"...","plainExplanation":"2-3 short sentences, <= 400 chars",`,
    `"whyItMatters":"one sentence","tinyExample":"optional, <= 1 line","learnMore":"optional, 2-3 sentences"}`,
    "```",
  ].join("\n");
}

/** Pull a Lesson out of model output that contains a ```json block (or raw JSON). */
export function parseLessonJson(raw: string, concept: Concept): Lesson {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
  const jsonText = fenced ? fenced[1]
    : (start !== -1 && end > start ? raw.slice(start, end + 1) : "");
  let obj: any;
  try { obj = JSON.parse(jsonText.trim()); }
  catch { throw new Error("Lumi: could not parse lesson JSON from model output"); }
  const req = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const title = req(obj.title), plain = req(obj.plainExplanation), why = req(obj.whyItMatters);
  if (!title || !plain || !why) {
    throw new Error("Lumi: lesson JSON missing required fields");
  }
  const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const opt = (v: unknown, n: number) => { const s = req(v); return s ? cap(s, n) : undefined; };
  return {
    conceptId: concept.id,
    title: cap(title, 80),
    plainExplanation: cap(plain, 500),
    whyItMatters: cap(why, 200),
    tinyExample: opt(obj.tinyExample, 120),
    learnMore: opt(obj.learnMore, 400),
  };
}

/** Generates lessons via the local `claude` CLI (uses the user's subscription). */
export class ClaudeCliGenerator implements LessonGenerator {
  constructor(private claudeBin = "claude", private timeoutMs = 30000) {}

  generate(concept: Concept, context: string): Promise<Lesson> {
    const prompt = buildLessonPrompt(concept, context);
    return new Promise((resolve, reject) => {
      const child = spawn(this.claudeBin, ["-p", prompt], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "", err = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Lumi: claude CLI timed out")); }, this.timeoutMs);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => { clearTimeout(timer); reject(new Error(`Lumi: failed to run '${this.claudeBin}': ${e.message}`)); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`Lumi: claude CLI exited ${code}: ${err.slice(0, 200)}`));
        try { resolve(parseLessonJson(out, concept)); } catch (e) { reject(e); }
      });
    });
  }
}
