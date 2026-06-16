/**
 * portability.ts — manual "sync": export your Lumi learning to a single file and
 * import it on another machine. This is the offline precursor to Pro cloud sync;
 * it moves the *learning state* (`~/.lumi/profile.json` + `habit.json`), merging
 * rather than overwriting so importing never loses progress.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LearnedConcept } from "./types";
import { HabitState } from "./habit";
import { atomicWriteFileSync } from "./fsutil";

export interface LumiBundle {
  v: 1;
  exportedAt: string;
  profile: LearnedConcept[];
  habit?: HabitState;
}

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Bundle the learning state under `home` into a portable object. */
export function exportBundle(home: string, now: Date = new Date()): LumiBundle {
  const profile = readJson<LearnedConcept[]>(join(home, "profile.json"), []);
  const habit = existsSync(join(home, "habit.json"))
    ? readJson<HabitState | undefined>(join(home, "habit.json"), undefined)
    : undefined;
  const bundle: LumiBundle = { v: 1, exportedAt: now.toISOString(), profile };
  if (habit) bundle.habit = habit;
  return bundle;
}

/** True only for a well-formed learned-concept record (guards against junk in an imported file). */
function isLearnedConcept(c: unknown): c is LearnedConcept {
  return !!c && typeof c === "object"
    && typeof (c as LearnedConcept).id === "string"
    && typeof (c as LearnedConcept).learnedAt === "string"
    && typeof (c as LearnedConcept).seenCount === "number"
    && Number.isFinite((c as LearnedConcept).seenCount);
}

/**
 * Union two learned-concept lists: keep the earliest learnedAt and the max seenCount.
 * Malformed entries (from a hand-edited/corrupt import) are skipped, never written.
 */
export function mergeProfiles(base: LearnedConcept[], incoming: LearnedConcept[]): LearnedConcept[] {
  const byId = new Map<string, LearnedConcept>();
  for (const c of base) if (isLearnedConcept(c)) byId.set(c.id, { ...c });
  for (const c of incoming) {
    if (!isLearnedConcept(c)) continue;
    const cur = byId.get(c.id);
    if (!cur) {
      byId.set(c.id, { ...c });
    } else {
      // earliest learnedAt wins (you've known it longest); seenCount takes the max
      const earliest = cur.learnedAt <= c.learnedAt ? cur.learnedAt : c.learnedAt;
      byId.set(c.id, { id: c.id, learnedAt: earliest, seenCount: Math.max(cur.seenCount, c.seenCount) });
    }
  }
  return [...byId.values()];
}

/** Merge two habit states: max freezes/goal, union badges, latest freeze-use timestamp. */
export function mergeHabit(base: HabitState | undefined, incoming: HabitState | undefined): HabitState | undefined {
  if (!base) return incoming;
  if (!incoming) return base;
  const badges = [...new Set([...(base.earnedBadges ?? []), ...(incoming.earnedBadges ?? [])])];
  const lastFreezeUsedAt =
    [base.lastFreezeUsedAt, incoming.lastFreezeUsedAt].filter(Boolean).sort().pop();
  return {
    freezes: Math.max(base.freezes ?? 0, incoming.freezes ?? 0),
    dailyGoal: Math.max(base.dailyGoal ?? 0, incoming.dailyGoal ?? 0),
    earnedBadges: badges,
    ...(lastFreezeUsedAt ? { lastFreezeUsedAt } : {}),
  };
}

export interface ImportResult { added: number; total: number; }

/**
 * Merge a bundle into the learning state under `home` (never destructive).
 * Returns how many concepts were newly added and the new total.
 */
export function importBundle(home: string, bundle: LumiBundle): ImportResult {
  if (!bundle || bundle.v !== 1 || !Array.isArray(bundle.profile)) {
    throw new Error("Not a valid Lumi export file.");
  }
  const profileFile = join(home, "profile.json");
  const existing = readJson<LearnedConcept[]>(profileFile, []);
  const merged = mergeProfiles(existing, bundle.profile);
  // Clamp to 0: if the on-disk profile had malformed entries that mergeProfiles
  // silently filtered out, merged.length can be less than existing.length — but
  // "added" should never be reported as negative (we never report un-adding).
  const added = Math.max(0, merged.length - existing.length);
  atomicWriteFileSync(profileFile, JSON.stringify(merged, null, 2));

  const habitFile = join(home, "habit.json");
  const mergedHabit = mergeHabit(readJson<HabitState | undefined>(habitFile, undefined), bundle.habit);
  if (mergedHabit) atomicWriteFileSync(habitFile, JSON.stringify(mergedHabit, null, 2));

  return { added, total: merged.length };
}
