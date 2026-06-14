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
    `Teach the concept "${concept.label}" in simple, encouraging language.`,
    `Context where it appeared (may help you tailor it): """${context.slice(0, 800)}"""`,
    ``,
    `Reply with ONLY a JSON code block, no prose, in exactly this shape:`,
    "```json",
    `{"title":"...","plainExplanation":"2-3 short sentences in plain English",`,
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
  if (!obj.title || !obj.plainExplanation || !obj.whyItMatters) {
    throw new Error("Lumi: lesson JSON missing required fields");
  }
  return {
    conceptId: concept.id,
    title: String(obj.title),
    plainExplanation: String(obj.plainExplanation),
    whyItMatters: String(obj.whyItMatters),
    tinyExample: obj.tinyExample ? String(obj.tinyExample) : undefined,
    learnMore: obj.learnMore ? String(obj.learnMore) : undefined,
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
