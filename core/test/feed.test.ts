import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  lessonEvent,
  appendEvent,
  readEventsSince,
  dedupeById,
  lessonFromEvent,
  FeedEvent,
  FeedLesson,
} from "../src/feed";

const sampleLesson: FeedLesson = {
  title: "Git Commit",
  plainExplanation: "A commit is a saved snapshot.",
  whyItMatters: "It lets you track changes over time.",
};

describe("lessonEvent", () => {
  it("fills v:1, a unique id, an ISO ts, and type:lesson", () => {
    const evt = lessonEvent({
      source: "test",
      concept: "git-commit",
      lesson: sampleLesson,
    });
    expect(evt.v).toBe(1);
    expect(evt.id).toMatch(/^evt_[0-9a-f-]+$/);
    expect(evt.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evt.type).toBe("lesson");
    expect(evt.source).toBe("test");
    expect(evt.concept).toBe("git-commit");
    expect(evt.lesson).toEqual(sampleLesson);
  });

  it("uses provided id and ts when supplied", () => {
    const evt = lessonEvent({
      source: "test",
      concept: "git-commit",
      lesson: sampleLesson,
      id: "evt_custom",
      ts: "2026-01-01T00:00:00.000Z",
    });
    expect(evt.id).toBe("evt_custom");
    expect(evt.ts).toBe("2026-01-01T00:00:00.000Z");
  });

  it("generates unique ids for distinct calls", () => {
    const a = lessonEvent({ source: "s", concept: "c", lesson: sampleLesson });
    const b = lessonEvent({ source: "s", concept: "c", lesson: sampleLesson });
    expect(a.id).not.toBe(b.id);
  });

  it("includes level and session when provided", () => {
    const evt = lessonEvent({
      source: "s",
      concept: "c",
      lesson: sampleLesson,
      level: "growing",
      session: "abc123",
    });
    expect(evt.level).toBe("growing");
    expect(evt.session).toBe("abc123");
  });
});

describe("appendEvent + readEventsSince", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lumi-feed-"));
    file = join(dir, "feed.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips an event and returns a non-zero offset", () => {
    const evt = lessonEvent({ source: "test", concept: "git-commit", lesson: sampleLesson });
    appendEvent(file, evt);
    const result = readEventsSince(file, 0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe(evt.id);
    expect(result.events[0].type).toBe("lesson");
    expect(result.offset).toBeGreaterThan(0);
  });

  it("incremental tail: second read returns only the new event", () => {
    const evt1 = lessonEvent({ source: "test", concept: "git-commit", lesson: sampleLesson });
    appendEvent(file, evt1);
    const first = readEventsSince(file, 0);
    expect(first.events).toHaveLength(1);

    const evt2 = lessonEvent({ source: "test", concept: "npm-install", lesson: { title: "npm install", plainExplanation: "Installs deps.", whyItMatters: "Gets your code working." } });
    appendEvent(file, evt2);
    const second = readEventsSince(file, first.offset);
    expect(second.events).toHaveLength(1);
    expect(second.events[0].id).toBe(evt2.id);
    expect(second.offset).toBeGreaterThan(first.offset);
  });

  it("skips malformed lines and still returns valid events", () => {
    const evt = lessonEvent({ source: "test", concept: "git-commit", lesson: sampleLesson });
    // Write a malformed line before the valid one
    writeFileSync(file, "not valid json\n" + JSON.stringify(evt) + "\n", "utf8");
    const result = readEventsSince(file, 0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe(evt.id);
  });

  it("returns empty events and offset:0 for a missing file", () => {
    const missing = join(dir, "does-not-exist.jsonl");
    const result = readEventsSince(missing, 0);
    expect(result.events).toEqual([]);
    expect(result.offset).toBe(0);
  });

  it("returns current offset when no new data beyond offset", () => {
    const evt = lessonEvent({ source: "test", concept: "git-commit", lesson: sampleLesson });
    appendEvent(file, evt);
    const first = readEventsSince(file, 0);
    // Read again from the end offset — should get no new events
    const second = readEventsSince(file, first.offset);
    expect(second.events).toEqual([]);
    expect(second.offset).toBe(first.offset);
  });

  it("creates parent directories if they do not exist", () => {
    const nested = join(dir, "deep", "nested", "feed.jsonl");
    const evt = lessonEvent({ source: "test", concept: "git-commit", lesson: sampleLesson });
    expect(() => appendEvent(nested, evt)).not.toThrow();
    const result = readEventsSince(nested, 0);
    expect(result.events).toHaveLength(1);
  });
});

describe("readEventsSince — truncation / rotation hardening", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lumi-feed-trunc-"));
    file = join(dir, "feed.jsonl");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("resyncs from the start when the file shrinks (truncation/rotation)", () => {
    // Append two events and record their offset
    const evt1 = lessonEvent({ source: "s", concept: "git-commit", lesson: sampleLesson, id: "evt_1", ts: "2026-01-01T00:00:00Z" });
    const evt2 = lessonEvent({ source: "s", concept: "npm-install", lesson: { title: "npm install", plainExplanation: "Installs deps.", whyItMatters: "Gets code working." }, id: "evt_2", ts: "2026-01-01T00:01:00Z" });
    appendEvent(file, evt1);
    appendEvent(file, evt2);
    const first = readEventsSince(file, 0);
    expect(first.events).toHaveLength(2);
    const oldOffset = first.offset;

    // Overwrite with a SINGLE new event — file is now smaller than oldOffset
    const evt3 = lessonEvent({ source: "s", concept: "docker-build", lesson: { title: "Docker Build", plainExplanation: "Builds an image.", whyItMatters: "Packages your app." }, id: "evt_3", ts: "2026-01-01T00:02:00Z" });
    writeFileSync(file, JSON.stringify(evt3) + "\n", "utf8");

    // Reading from oldOffset should resync and return evt3, not drop it
    const second = readEventsSince(file, oldOffset);
    expect(second.events).toHaveLength(1);
    expect(second.events[0].id).toBe("evt_3");
    expect(second.offset).toBe(statSync(file).size);
  });

  it("round-trips multi-byte characters and tracks byte-accurate offsets", () => {
    const multiByteLesson: FeedLesson = {
      title: "café — 日本語",
      plainExplanation: "Multi-byte test.",
      whyItMatters: "Ensures UTF-8 byte offsets are correct.",
    };
    const evt1 = lessonEvent({ source: "s", concept: "encoding", lesson: multiByteLesson, id: "evt_mb1", ts: "2026-01-01T00:00:00Z" });
    appendEvent(file, evt1);

    const first = readEventsSince(file, 0);
    expect(first.events).toHaveLength(1);
    expect(first.events[0].lesson?.title).toBe("café — 日本語");
    // Offset must equal the actual byte size of the file
    expect(first.offset).toBe(statSync(file).size);

    // Append a second event and read only the new one from the recorded offset
    const evt2 = lessonEvent({ source: "s", concept: "encoding2", lesson: sampleLesson, id: "evt_mb2", ts: "2026-01-01T00:01:00Z" });
    appendEvent(file, evt2);
    const second = readEventsSince(file, first.offset);
    expect(second.events).toHaveLength(1);
    expect(second.events[0].id).toBe("evt_mb2");
    expect(second.offset).toBe(statSync(file).size);
  });
});

describe("dedupeById", () => {
  it("removes duplicate ids, preserving first occurrence", () => {
    const evt1 = lessonEvent({ source: "s", concept: "git-commit", lesson: sampleLesson, id: "evt_A", ts: "2026-01-01T00:00:00Z" });
    const evt2 = lessonEvent({ source: "s", concept: "npm-install", lesson: sampleLesson, id: "evt_B", ts: "2026-01-01T00:01:00Z" });
    const evt1dup = { ...evt1 };
    const result = dedupeById([evt1, evt2, evt1dup]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("evt_A");
    expect(result[1].id).toBe("evt_B");
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeById([])).toEqual([]);
  });

  it("preserves order of unique events", () => {
    const events: FeedEvent[] = ["A", "B", "C"].map((id) =>
      lessonEvent({ source: "s", concept: id, lesson: sampleLesson, id: `evt_${id}`, ts: "2026-01-01T00:00:00Z" })
    );
    expect(dedupeById(events).map((e) => e.id)).toEqual(["evt_A", "evt_B", "evt_C"]);
  });
});

describe("lessonFromEvent", () => {
  const fullLesson: FeedLesson = {
    title: "Git Commit",
    plainExplanation: "A commit is a saved snapshot of your project.",
    whyItMatters: "It lets you track changes over time.",
    analogy: "Like saving a game checkpoint.",
    tinyExample: "git commit -m 'add feature'",
  };

  it("maps a well-formed lesson event to a Lesson with correct fields", () => {
    const event = lessonEvent({ source: "test", concept: "git-commit", lesson: fullLesson });
    const result = lessonFromEvent(event);
    expect(result).not.toBeNull();
    expect(result?.conceptId).toBe("git-commit");
    expect(result?.title).toBe("Git Commit");
    expect(result?.plainExplanation).toBe("A commit is a saved snapshot of your project.");
    expect(result?.whyItMatters).toBe("It lets you track changes over time.");
    expect(result?.analogy).toBe("Like saving a game checkpoint.");
    expect(result?.tinyExample).toBe("git commit -m 'add feature'");
  });

  it("passes through analogy and tinyExample when present", () => {
    const event = lessonEvent({ source: "test", concept: "git-commit", lesson: fullLesson });
    const result = lessonFromEvent(event);
    expect(result).toHaveProperty("analogy", "Like saving a game checkpoint.");
    expect(result).toHaveProperty("tinyExample", "git commit -m 'add feature'");
  });

  it("omits analogy and tinyExample keys when not present in the lesson", () => {
    const minimalLesson: FeedLesson = {
      title: "npm install",
      plainExplanation: "Installs project dependencies.",
      whyItMatters: "Without it your project won't run.",
    };
    const event = lessonEvent({ source: "test", concept: "npm-install", lesson: minimalLesson });
    const result = lessonFromEvent(event);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("analogy");
    expect(result).not.toHaveProperty("tinyExample");
  });

  it("returns null for a non-lesson event (type: progress)", () => {
    const event: FeedEvent = {
      v: 1,
      id: "evt_progress",
      ts: "2026-01-01T00:00:00Z",
      source: "test",
      type: "progress",
      concept: "git-commit",
    };
    expect(lessonFromEvent(event)).toBeNull();
  });

  it("returns null for a lesson event missing concept", () => {
    const event: FeedEvent = {
      v: 1,
      id: "evt_no_concept",
      ts: "2026-01-01T00:00:00Z",
      source: "test",
      type: "lesson",
      lesson: fullLesson,
      // concept intentionally omitted
    };
    expect(lessonFromEvent(event)).toBeNull();
  });

  it("returns null for a lesson event missing lesson.title", () => {
    const noTitle: FeedLesson = {
      title: "",
      plainExplanation: "Some explanation.",
      whyItMatters: "It matters.",
    };
    const event = lessonEvent({ source: "test", concept: "git-commit", lesson: noTitle });
    expect(lessonFromEvent(event)).toBeNull();
  });

  it("returns null for a lesson event missing lesson.plainExplanation", () => {
    const noExplanation: FeedLesson = {
      title: "Git Commit",
      plainExplanation: "",
      whyItMatters: "It matters.",
    };
    const event = lessonEvent({ source: "test", concept: "git-commit", lesson: noExplanation });
    expect(lessonFromEvent(event)).toBeNull();
  });

  it("returns null for a lesson event missing lesson.whyItMatters", () => {
    const noWhy: FeedLesson = {
      title: "Git Commit",
      plainExplanation: "A commit saves state.",
      whyItMatters: "",
    };
    const event = lessonEvent({ source: "test", concept: "git-commit", lesson: noWhy });
    expect(lessonFromEvent(event)).toBeNull();
  });

  it("returns null when lesson payload is absent entirely", () => {
    const event: FeedEvent = {
      v: 1,
      id: "evt_no_lesson",
      ts: "2026-01-01T00:00:00Z",
      source: "test",
      type: "lesson",
      concept: "git-commit",
      // lesson intentionally omitted
    };
    expect(lessonFromEvent(event)).toBeNull();
  });
});
