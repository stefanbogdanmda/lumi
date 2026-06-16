import { describe, it, expect } from "vitest";
import {
  listPaths,
  pathProgress,
  allPathsProgress,
  nextAcrossPaths,
  type Path,
  type PathProgress,
} from "../src/curriculum";
import { CONCEPTS } from "../src/concepts";

// ---- helpers ---------------------------------------------------------------
const knownIds = new Set(CONCEPTS.map((c) => c.id));

// ---- guard: no dead concept ids in any path --------------------------------
describe("curriculum integrity", () => {
  it("every conceptId in every path is a real CONCEPTS id", () => {
    for (const path of listPaths()) {
      for (const cid of path.conceptIds) {
        expect(knownIds.has(cid), `path "${path.id}" references unknown id "${cid}"`).toBe(true);
      }
    }
  });

  it("listPaths returns at least 3 paths, each with id, title, blurb, and conceptIds", () => {
    const paths = listPaths();
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.title).toBe("string");
      expect(p.title.length).toBeGreaterThan(0);
      expect(typeof p.blurb).toBe("string");
      expect(p.blurb.length).toBeGreaterThan(0);
      expect(Array.isArray(p.conceptIds)).toBe(true);
      expect(p.conceptIds.length).toBeGreaterThan(0);
    }
  });

  it("all path ids are unique", () => {
    const paths = listPaths();
    const ids = paths.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---- pathProgress ----------------------------------------------------------
describe("pathProgress", () => {
  it("returns 0% when nothing is learned", () => {
    const paths = listPaths();
    const first = paths[0];
    const result = pathProgress(first.id, []);
    expect(result.pathId).toBe(first.id);
    expect(result.done).toBe(0);
    expect(result.total).toBe(first.conceptIds.length);
    expect(result.pct).toBe(0);
    expect(result.nextConceptId).toBe(first.conceptIds[0]);
    expect(result.remaining).toEqual(first.conceptIds);
  });

  it("returns partial progress when some concepts are learned", () => {
    const paths = listPaths();
    const path = paths[0];
    // learn the first two concepts of the first path
    const learnedIds = path.conceptIds.slice(0, 2);
    const result = pathProgress(path.id, learnedIds);
    expect(result.done).toBe(2);
    expect(result.total).toBe(path.conceptIds.length);
    // pct is now rounded to the nearest integer
    expect(result.pct).toBe(Math.round((2 / path.conceptIds.length) * 100));
    expect(result.nextConceptId).toBe(path.conceptIds[2]);
    expect(result.remaining).toEqual(path.conceptIds.slice(2));
  });

  it("returns 100% when all concepts are learned", () => {
    const paths = listPaths();
    const path = paths[0];
    const result = pathProgress(path.id, path.conceptIds);
    expect(result.done).toBe(path.conceptIds.length);
    expect(result.pct).toBe(100);
    expect(result.nextConceptId).toBeNull();
    expect(result.remaining).toEqual([]);
  });

  it("counts extra learned ids that belong to a path (superset of path ids)", () => {
    const paths = listPaths();
    const path = paths[0];
    // learnedIds includes concepts from outside the path — should only count path ones
    const learnedIds = [path.conceptIds[0], "some-random-unknown-id-not-in-path"];
    const result = pathProgress(path.id, learnedIds);
    expect(result.done).toBe(1);
  });

  it("unknown pathId returns a zero-progress sentinel", () => {
    const result = pathProgress("this-path-does-not-exist", ["git-commit"]);
    expect(result.pathId).toBe("this-path-does-not-exist");
    expect(result.done).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
    expect(result.nextConceptId).toBeNull();
    expect(result.remaining).toEqual([]);
  });

  it("nextConceptId is the first UNlearned concept in order", () => {
    const paths = listPaths();
    const path = paths[0];
    // learn concepts 0 and 2 (skip 1) — next should be index 1
    const learnedIds = [path.conceptIds[0], path.conceptIds[2]];
    const result = pathProgress(path.id, learnedIds);
    expect(result.nextConceptId).toBe(path.conceptIds[1]);
  });
});

// ---- allPathsProgress ------------------------------------------------------
describe("allPathsProgress", () => {
  it("returns progress for every path", () => {
    const paths = listPaths();
    const all = allPathsProgress([]);
    expect(all).toHaveLength(paths.length);
    for (const pp of all) {
      expect(typeof pp.pathId).toBe("string");
      expect(pp.done).toBe(0);
      expect(pp.pct).toBe(0);
    }
  });

  it("reflects learned concepts correctly across paths", () => {
    const paths = listPaths();
    // learn ALL concepts of the second path
    const path = paths[1];
    const all = allPathsProgress(path.conceptIds);
    const found = all.find((pp) => pp.pathId === path.id);
    expect(found).toBeDefined();
    expect(found!.pct).toBe(100);
    expect(found!.done).toBe(path.conceptIds.length);
  });
});

// ---- nextAcrossPaths -------------------------------------------------------
describe("nextAcrossPaths", () => {
  it("returns a concept when nothing is learned (first concept of the first path)", () => {
    const paths = listPaths();
    const result = nextAcrossPaths([]);
    expect(result).not.toBeNull();
    expect(result!.pathId).toBe(paths[0].id);
    expect(result!.conceptId).toBe(paths[0].conceptIds[0]);
  });

  it("returns null when all paths are fully complete", () => {
    const allIds = listPaths().flatMap((p) => p.conceptIds);
    const result = nextAcrossPaths(allIds);
    expect(result).toBeNull();
  });

  it("skips a fully-completed path and picks from the next started path", () => {
    const paths = listPaths();
    // complete the first path and start the second path (learn first concept)
    const learnedIds = [
      ...paths[0].conceptIds,         // first path fully done
      paths[1].conceptIds[0],         // started second path
    ];
    const result = nextAcrossPaths(learnedIds);
    // second path is started but not done → it should be chosen over third
    expect(result!.pathId).toBe(paths[1].id);
    expect(result!.conceptId).toBe(paths[1].conceptIds[1]);
  });

  it("prefers the least-complete started path over a never-started one", () => {
    const paths = listPaths();
    // start path[1] at 1 concept learned; path[0] is never started
    // But path[0] has pct=0 (not started) and path[1] has pct>0 (started)
    // Rule: prefer started, non-complete paths first
    const learnedIds = [paths[1].conceptIds[0]];
    const result = nextAcrossPaths(learnedIds);
    expect(result!.pathId).toBe(paths[1].id);
  });
});

// ---- FIX 3 regression: pct must be an integer (or at most 2 dp) -----------
describe("pathProgress — FIX 3: pct is rounded to an integer", () => {
  it("pct is a whole number (no fractional part) for partial progress", () => {
    const paths = listPaths();
    const path = paths[0]; // 11 concepts
    // Learn 1 of 11: raw = 9.090909… — must round to 9
    const result = pathProgress(path.id, [path.conceptIds[0]]);
    expect(result.pct % 1).toBe(0); // no fractional part
    expect(result.pct).toBe(Math.round((1 / path.conceptIds.length) * 100));
  });

  it("pct is exactly 0 when nothing learned", () => {
    const paths = listPaths();
    const result = pathProgress(paths[0].id, []);
    expect(result.pct).toBe(0);
  });

  it("pct is exactly 100 when all concepts learned", () => {
    const paths = listPaths();
    const path = paths[0];
    const result = pathProgress(path.id, path.conceptIds);
    expect(result.pct).toBe(100);
  });
});
