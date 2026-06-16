import { existsSync, readFileSync } from "node:fs";
import { LearnedConcept } from "./types";
import { atomicWriteFileSync } from "./fsutil";
import { CONCEPTS } from "./concepts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HabitState {
  /** Number of streak-freeze tokens available to the user. */
  freezes: number;
  /** ISO timestamp of the last day a freeze was consumed (UTC date portion). */
  lastFreezeUsedAt?: string;
  /** User's daily learning goal (number of concepts per day). */
  dailyGoal: number;
  /** Badge ids already earned (so we don't re-surface them as "new"). */
  earnedBadges: string[];
}

export interface DailyGoalStatus {
  goal: number;
  todayCount: number;
  met: boolean;
  remaining: number;
}

export interface StreakWithFreezeResult {
  streakDays: number;
  freezesAvailable: number;
  savedByFreeze: boolean;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the UTC date portion "YYYY-MM-DD" of an ISO timestamp. */
const dayKey = (iso: string): string => iso.slice(0, 10);

/** Returns the UTC date portion "YYYY-MM-DD" of a Date object. */
const dateToDayKey = (d: Date): string =>
  d.toISOString().slice(0, 10);

/** Returns a new Date that is `n` UTC days before `d`. */
const utcDaysBefore = (d: Date, n: number): Date => {
  const result = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  result.setUTCDate(result.getUTCDate() - n);
  return result;
};

// ---------------------------------------------------------------------------
// Daily goal
// ---------------------------------------------------------------------------

/**
 * Counts how many concepts were learned today (UTC) and compares against goal.
 *
 * @param learned   - Full list of learned concepts.
 * @param goal      - Target number of concepts to learn today.
 * @param now       - Injectable clock; defaults to new Date().
 */
export function dailyGoalStatus(
  learned: LearnedConcept[],
  goal: number,
  now: Date = new Date(),
): DailyGoalStatus {
  const today = dateToDayKey(now);
  const todayCount = learned.filter((lc) => dayKey(lc.learnedAt) === today).length;
  const met = todayCount >= goal;
  const remaining = Math.max(0, goal - todayCount);
  return { goal, todayCount, met, remaining };
}

// ---------------------------------------------------------------------------
// Streak with freeze
// ---------------------------------------------------------------------------

/**
 * Computes the learning streak, using available freeze tokens to bridge
 * single missed days.
 *
 * Rules:
 *  - The streak is a count of consecutive *active* days ending today.
 *  - A "gap" is a day where no concept was learned.
 *  - Each single-day gap consumes one freeze token (at most one per gap).
 *  - Two consecutive missed days cannot be bridged by one freeze — each
 *    requires its own token.
 *  - If today has no learning the streak still counts from yesterday
 *    (so a freeze can bridge yesterday's gap into today's chain), but only
 *    if tomorrow the user learns again — we keep the definition consistent
 *    with stats.ts: the streak counts consecutive days ENDING on the most
 *    recent active day that is today-or-yesterday (because we walk back from
 *    today, but require today to be active unless a freeze bridges it).
 *
 * Implementation:  walk backwards from today; collect active days using
 * freeze tokens to skip single gaps.
 *
 * @param learned         - Full list of learned concepts.
 * @param state           - Current HabitState (reads freezes count).
 * @param now             - Injectable clock; defaults to new Date().
 */
export function streakWithFreeze(
  learned: LearnedConcept[],
  state: HabitState,
  now: Date = new Date(),
): StreakWithFreezeResult {
  const activeDays = new Set(learned.map((lc) => dayKey(lc.learnedAt)));

  // Walk backwards from today, consuming freezes to bridge single gaps.
  //
  // Freeze consumption rule: a freeze is consumed for a gap day ONLY when
  // the walk LATER reaches another active day. We buffer pending freeze spends
  // while crossing gap days; if we reach an active day, we commit (decrement +
  // savedByFreeze=true); if the walk terminates without an active day we refund
  // (do not decrement, savedByFreeze stays false). This prevents reporting a
  // freeze as "saved" when the streak breaks at the same length as without it.
  let freezesRemaining = state.freezes;
  let streakDays = 0;
  let savedByFreeze = false;

  // Pre-compute the sorted active day keys for the "any earlier active day" check.
  const sortedActiveDays = [...activeDays].sort(); // lexicographic = chronological for YYYY-MM-DD

  /** Returns true if the learned set contains any day before the given key. */
  const hasActiveDayBefore = (key: string): boolean =>
    sortedActiveDays.length > 0 && sortedActiveDays[0] < key;

  // Pointer: current UTC day offset (0 = today, 1 = yesterday, …)
  let offset = 0;

  // Pending freeze spends buffered while crossing a run of gap days.
  // Each entry represents one gap day that wants to consume a freeze.
  let pendingFreezeSpends = 0;

  // The chain must START on an active day (today must be active).
  // If today is inactive the streak is 0 — consistent with stats.ts which
  // counts consecutive days ENDING TODAY.
  while (true) {
    const day = dateToDayKey(utcDaysBefore(now, offset));
    if (activeDays.has(day)) {
      // Active day reached — commit any buffered freeze spends.
      if (pendingFreezeSpends > 0) {
        freezesRemaining -= pendingFreezeSpends;
        savedByFreeze = true;
        pendingFreezeSpends = 0;
      }
      streakDays += 1;
      offset += 1;
    } else {
      // Gap found.
      if (streakDays === 0) {
        // Chain not started yet (today is inactive) → streak stays 0.
        break;
      }
      if (freezesRemaining - pendingFreezeSpends > 0 && hasActiveDayBefore(day)) {
        // There is an active day earlier in history and enough freezes available —
        // buffer a pending freeze spend and keep scanning.
        pendingFreezeSpends += 1;
        offset += 1; // bridge this gap day and continue scanning
      } else {
        // Out of freezes (after accounting for pending) or no active days before
        // this gap → chain breaks. Pending spends are refunded (not committed).
        break;
      }
    }
  }

  return { streakDays, freezesAvailable: freezesRemaining, savedByFreeze };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** All badge definitions, evaluated in order. */
const BADGE_DEFS: Array<{
  id: string;
  label: string;
  description: string;
  /** Returns true if the badge is earned given the current state. */
  earned: (learned: LearnedConcept[], streakDays: number) => boolean;
}> = [
  {
    id: "first-concept",
    label: "First Step",
    description: "Learned your very first concept.",
    earned: (learned) => learned.length >= 1,
  },
  {
    id: "concepts-10",
    label: "Getting Started",
    description: "Learned 10 concepts.",
    earned: (learned) => learned.length >= 10,
  },
  {
    id: "concepts-25",
    label: "On a Roll",
    description: "Learned 25 concepts.",
    earned: (learned) => learned.length >= 25,
  },
  {
    id: "concepts-50",
    label: "Knowledge Base",
    description: "Learned 50 concepts.",
    earned: (learned) => learned.length >= 50,
  },
  {
    id: "streak-3",
    label: "Hat Trick",
    description: "Maintained a 3-day learning streak.",
    earned: (_learned, streakDays) => streakDays >= 3,
  },
  {
    id: "streak-7",
    label: "Week Warrior",
    description: "Maintained a 7-day learning streak.",
    earned: (_learned, streakDays) => streakDays >= 7,
  },
  {
    id: "streak-30",
    label: "Month Master",
    description: "Maintained a 30-day learning streak.",
    earned: (_learned, streakDays) => streakDays >= 30,
  },
  {
    id: "multi-category",
    label: "Curious Mind",
    description: "Learned concepts in more than one category.",
    earned: (learned) => {
      // Look up the REAL category from the CONCEPTS dictionary for each learned
      // concept. Two concepts like "localhost" and "api" share the "web" category
      // even though their id prefixes differ — so we must not use the id prefix.
      const categories = new Set(
        learned
          .map((lc) => CONCEPTS.find((c) => c.id === lc.id)?.category)
          .filter(Boolean),
      );
      return categories.size >= 2;
    },
  },
];

/**
 * Returns all badges currently earned given the learned list and streak length.
 * Pure and deterministic — always returns the full set (call-sites can diff
 * against `HabitState.earnedBadges` to find newly unlocked ones).
 *
 * @param learned     - Full list of learned concepts.
 * @param streakDays  - Current streak (from `streakWithFreeze` or `learningStats`).
 */
export function earnedBadges(learned: LearnedConcept[], streakDays: number): Badge[] {
  return BADGE_DEFS
    .filter((def) => def.earned(learned, streakDays))
    .map(({ id, label, description }) => ({ id, label, description }));
}

// ---------------------------------------------------------------------------
// Persistence — JsonFileHabitStore
// ---------------------------------------------------------------------------

const DEFAULT_STATE: HabitState = {
  freezes: 0,
  dailyGoal: 3,
  earnedBadges: [],
};

/**
 * A simple file-backed store for HabitState, mirroring the JsonFileProfile
 * pattern: read on construction, write atomically on mutation.
 *
 * Missing or corrupt files are silently treated as the default state.
 */
export class JsonFileHabitStore {
  private state: HabitState;

  constructor(private readonly file: string) {
    this.state = { ...DEFAULT_STATE };
    if (existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<HabitState>;
        const rawGoal = typeof raw.dailyGoal === "number" ? raw.dailyGoal : DEFAULT_STATE.dailyGoal;
        this.state = {
          freezes: typeof raw.freezes === "number" ? raw.freezes : DEFAULT_STATE.freezes,
          // Clamp hand-edited negative dailyGoal to 0 so goal/stats can't show "N/−5 ✓"
          dailyGoal: Math.max(0, rawGoal),
          earnedBadges: Array.isArray(raw.earnedBadges) ? raw.earnedBadges : [],
          ...(raw.lastFreezeUsedAt !== undefined
            ? { lastFreezeUsedAt: raw.lastFreezeUsedAt }
            : {}),
        };
      } catch { /* corrupt file -> use default */ }
    }
  }

  getState(): HabitState {
    return { ...this.state };
  }

  setState(next: HabitState): void {
    this.state = { ...next };
    this.save();
  }

  /** Convenience: add freeze tokens. */
  addFreezes(count: number): void {
    this.setState({ ...this.state, freezes: this.state.freezes + count });
  }

  /** Convenience: record a badge as earned. Idempotent. */
  recordBadge(id: string): void {
    if (this.state.earnedBadges.includes(id)) return;
    this.setState({
      ...this.state,
      earnedBadges: [...this.state.earnedBadges, id],
    });
  }

  /** Convenience: update the daily goal target. */
  setDailyGoal(goal: number): void {
    this.setState({ ...this.state, dailyGoal: goal });
  }

  private save(): void {
    atomicWriteFileSync(this.file, JSON.stringify(this.state, null, 2));
  }
}
