import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportBundle, importBundle, mergeProfiles, mergeHabit } from "../src/portability";
import { LearnedConcept } from "../src/types";

const lc = (id: string, learnedAt: string, seenCount = 1): LearnedConcept => ({ id, learnedAt, seenCount });

describe("mergeProfiles", () => {
  it("unions by id, keeping earliest learnedAt and max seenCount", () => {
    const a = [lc("git-commit", "2026-02-01T00:00:00Z", 3), lc("api", "2026-03-01T00:00:00Z", 1)];
    const b = [lc("git-commit", "2026-01-01T00:00:00Z", 1), lc("json", "2026-04-01T00:00:00Z", 2)];
    const merged = mergeProfiles(a, b);
    const ids = merged.map((c) => c.id).sort();
    expect(ids).toEqual(["api", "git-commit", "json"]);
    const gc = merged.find((c) => c.id === "git-commit")!;
    expect(gc.learnedAt).toBe("2026-01-01T00:00:00Z"); // earliest
    expect(gc.seenCount).toBe(3); // max
  });
  it("does not mutate inputs", () => {
    const a = [lc("git-commit", "2026-02-01T00:00:00Z", 3)];
    mergeProfiles(a, [lc("git-commit", "2026-01-01T00:00:00Z", 9)]);
    expect(a[0].seenCount).toBe(3);
  });
});

describe("mergeHabit", () => {
  it("takes max freezes/goal and unions badges", () => {
    const m = mergeHabit(
      { freezes: 1, dailyGoal: 2, earnedBadges: ["a", "b"] },
      { freezes: 3, dailyGoal: 1, earnedBadges: ["b", "c"] },
    )!;
    expect(m.freezes).toBe(3);
    expect(m.dailyGoal).toBe(2);
    expect(m.earnedBadges.sort()).toEqual(["a", "b", "c"]);
  });
  it("handles one side missing", () => {
    expect(mergeHabit(undefined, { freezes: 2, dailyGoal: 1, earnedBadges: [] })!.freezes).toBe(2);
    expect(mergeHabit({ freezes: 5, dailyGoal: 0, earnedBadges: [] }, undefined)!.freezes).toBe(5);
  });
});

describe("exportBundle / importBundle round-trip", () => {
  let home: string;
  beforeEach(() => { home = mkdtempSync(join(tmpdir(), "lumi-port-")); });
  afterEach(() => { rmSync(home, { recursive: true, force: true }); });

  it("exports profile + habit and re-imports them onto a fresh machine", () => {
    writeFileSync(join(home, "profile.json"), JSON.stringify([lc("git-commit", "2026-01-01T00:00:00Z", 2), lc("api", "2026-01-02T00:00:00Z")]));
    writeFileSync(join(home, "habit.json"), JSON.stringify({ freezes: 2, dailyGoal: 3, earnedBadges: ["first-concept"] }));
    const bundle = exportBundle(home);
    expect(bundle.v).toBe(1);
    expect(bundle.profile).toHaveLength(2);
    expect(bundle.habit?.freezes).toBe(2);

    const home2 = mkdtempSync(join(tmpdir(), "lumi-port2-"));
    try {
      const res = importBundle(home2, bundle);
      expect(res.added).toBe(2);
      expect(res.total).toBe(2);
      const prof = JSON.parse(readFileSync(join(home2, "profile.json"), "utf8")) as LearnedConcept[];
      expect(prof.map((c) => c.id).sort()).toEqual(["api", "git-commit"]);
      expect(existsSync(join(home2, "habit.json"))).toBe(true);
    } finally {
      rmSync(home2, { recursive: true, force: true });
    }
  });

  it("merges non-destructively (existing concepts preserved, only new ones added)", () => {
    writeFileSync(join(home, "profile.json"), JSON.stringify([lc("git-commit", "2026-01-01T00:00:00Z")]));
    const res = importBundle(home, { v: 1, exportedAt: "x", profile: [lc("git-commit", "2026-05-01T00:00:00Z"), lc("api", "2026-05-01T00:00:00Z")] });
    expect(res.added).toBe(1); // only api is new
    expect(res.total).toBe(2);
  });

  it("exports empty state without throwing and rejects a non-Lumi file", () => {
    expect(exportBundle(home).profile).toEqual([]);
    expect(() => importBundle(home, { foo: "bar" } as any)).toThrow();
    expect(() => importBundle(home, { v: 2, exportedAt: "x", profile: [] } as any)).toThrow();
  });

  it("skips malformed entries in a v1 bundle — never corrupts profile.json", () => {
    writeFileSync(join(home, "profile.json"), JSON.stringify([lc("git-commit", "2026-01-01T00:00:00Z")]));
    const res = importBundle(home, {
      v: 1, exportedAt: "x",
      profile: ["junk", 42, null, { seenCount: null }, lc("api", "2026-05-01T00:00:00Z")] as any,
    });
    expect(res.added).toBe(1); // only the one valid new concept (api)
    const written = JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));
    // every persisted entry is well-formed (no junk/null/NaN leaked to disk)
    for (const c of written) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.learnedAt).toBe("string");
      expect(Number.isFinite(c.seenCount)).toBe(true);
    }
    expect(written.map((c: any) => c.id).sort()).toEqual(["api", "git-commit"]);
  });

  // ---------------------------------------------------------------------------
  // FIX 6 regression: importBundle.added must never be negative
  // ---------------------------------------------------------------------------

  it("FIX 6: added is never negative when on-disk profile has entries filtered during merge", () => {
    // Write a profile containing malformed entries that isLearnedConcept() will reject.
    // After merge, merged.length may be LESS than the raw existing.length because
    // mergeProfiles silently drops malformed records from base.
    const malformed = [
      { id: 42, learnedAt: "2026-01-01T00:00:00Z", seenCount: 1 },      // id not a string
      { id: "git-commit", learnedAt: null, seenCount: 1 },               // learnedAt null
      { id: "api", learnedAt: "2026-01-01T00:00:00Z", seenCount: "x" },  // seenCount not a number
    ];
    writeFileSync(join(home, "profile.json"), JSON.stringify(malformed), "utf8");
    const bundle = { v: 1 as const, exportedAt: new Date().toISOString(), profile: [] };
    const result = importBundle(home, bundle);
    // added must be >= 0 (never negative)
    expect(result.added).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
