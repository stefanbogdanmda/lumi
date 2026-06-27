import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rotateFeed, purgeData } from "../src/retention";

const DAY = 86_400_000;

function feedWith(lines: object[]): string {
  const dir = mkdtempSync(join(tmpdir(), "lumi-ret-"));
  const file = join(dir, "feed.jsonl");
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return file;
}

describe("rotateFeed", () => {
  it("drops events older than maxAgeDays", () => {
    const now = 10 * DAY;
    const file = feedWith([
      { id: "old", ts: new Date(now - 5 * DAY).toISOString(), type: "lesson" },
      { id: "new", ts: new Date(now - 1 * DAY).toISOString(), type: "lesson" },
    ]);
    rotateFeed(file, { maxAgeDays: 3, maxBytes: 50_000_000, now: () => now });
    const kept = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(kept.map((e) => e.id)).toEqual(["new"]);
  });

  it("trims oldest events until under maxBytes, keeping newest", () => {
    const now = 10 * DAY;
    const big = "x".repeat(400);
    const events = Array.from({ length: 50 }, (_, i) => ({
      id: `e${i}`, ts: new Date(now - 60_000 * (50 - i)).toISOString(), type: "lesson", pad: big,
    }));
    const file = feedWith(events);
    const before = statSync(file).size;
    rotateFeed(file, { maxAgeDays: 365, maxBytes: Math.floor(before / 2), now: () => now });
    const after = statSync(file).size;
    expect(after).toBeLessThanOrEqual(Math.floor(before / 2));
    const kept = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(kept[kept.length - 1].id).toBe("e49");
    expect(kept[0].id).not.toBe("e0");
  });

  it("is a no-op when the file is missing", () => {
    expect(() => rotateFeed(join(tmpdir(), "nope-lumi.jsonl"), { maxAgeDays: 1, maxBytes: 1, now: () => 0 }))
      .not.toThrow();
  });
});

describe("purgeData", () => {
  it("deletes feed.jsonl and returns the removed paths", () => {
    const file = feedWith([{ id: "a", ts: new Date().toISOString(), type: "lesson" }]);
    const home = join(file, "..");
    const removed = purgeData(home);
    expect(existsSync(file)).toBe(false);
    expect(removed).toContain(file);
  });
});
