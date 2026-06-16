import { appendFileSync, mkdirSync, existsSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { LearnerLevel, Lesson } from "./types";

export interface FeedLesson {
  title: string;
  plainExplanation: string;
  whyItMatters: string;
  anchoredTo?: string;
  analogy?: string;
  tinyExample?: string;
}

export interface FeedEvent {
  v: 1;
  id: string;
  ts: string;
  source: string;
  session?: string;
  type: "lesson" | "review_due" | "progress" | "glossary_update" | "tool_action";
  concept?: string;
  level?: LearnerLevel;
  lesson?: FeedLesson;
}

export interface LessonEventInput {
  source: string;
  concept: string;
  lesson: FeedLesson;
  level?: LearnerLevel;
  session?: string;
  id?: string;
  ts?: string;
}

/** Construct a versioned lesson event (auto id + ts if omitted). */
export function lessonEvent(input: LessonEventInput): FeedEvent {
  return {
    v: 1,
    id: input.id ?? `evt_${randomUUID()}`,
    ts: input.ts ?? new Date().toISOString(),
    source: input.source,
    session: input.session,
    type: "lesson",
    concept: input.concept,
    level: input.level,
    lesson: input.lesson,
  };
}

/** Append one event as a JSON line (creates the file/dir if needed). */
export function appendEvent(file: string, event: FeedEvent): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(event) + "\n", "utf8");
}

/**
 * Read events appended after `offset` bytes; returns parsed events + the new offset.
 * Skips malformed lines; only consumes up to the last newline.
 */
export function readEventsSince(file: string, offset: number): { events: FeedEvent[]; offset: number } {
  if (!existsSync(file)) return { events: [], offset };
  const size = statSync(file).size;
  if (size < offset) offset = 0;             // file truncated/rotated — resync from the start
  if (size === offset) return { events: [], offset };
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    const text = buf.toString("utf8");
    const lastNl = text.lastIndexOf("\n");
    if (lastNl === -1) return { events: [], offset };
    const consumed = offset + Buffer.byteLength(text.slice(0, lastNl + 1), "utf8");
    const events: FeedEvent[] = [];
    for (const line of text.slice(0, lastNl).split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e && typeof e === "object") events.push(e as FeedEvent);
      } catch { /* skip malformed lines */ }
    }
    return { events, offset: consumed };
  } finally {
    closeSync(fd);
  }
}

/**
 * Map a FeedEvent to a panel-ready Lesson, or null if it isn't a usable lesson event.
 * Guards against missing type, concept, or any required lesson field.
 */
export function lessonFromEvent(event: FeedEvent): Lesson | null {
  if (event?.type !== "lesson" || !event.concept || !event.lesson) return null;
  const l = event.lesson;
  if (!l.title || !l.plainExplanation || !l.whyItMatters) return null;
  return {
    conceptId: event.concept,
    title: l.title,
    plainExplanation: l.plainExplanation,
    whyItMatters: l.whyItMatters,
    ...(l.analogy ? { analogy: l.analogy } : {}),
    ...(l.tinyExample ? { tinyExample: l.tinyExample } : {}),
  };
}

/** Drop events whose `id` was already seen (first occurrence wins). */
export function dedupeById(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}
