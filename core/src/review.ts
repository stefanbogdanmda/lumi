import { LearnedConcept } from "./types";

/** A gentle active-recall prompt for a concept the learner is reviewing. */
export function recallQuestion(label: string): string {
  return `Do you remember what "${label}" means? (think first, then check)`;
}

/** Spaced-repetition interval (days) before a concept is due for review, given how many times it's been seen. */
export function reviewIntervalDays(seenCount: number): number {
  const schedule = [2, 7, 16, 30, 60]; // seen 1 -> 2d, 2 -> 7d, 3 -> 16d, 4 -> 30d, 5+ -> 60d
  const idx = Math.min(Math.max(seenCount, 1), schedule.length) - 1;
  return schedule[idx];
}

/** Concepts whose time-since-learned has passed their spaced-repetition interval, oldest first. */
export function dueForReview(learned: LearnedConcept[], now: Date = new Date()): LearnedConcept[] {
  const dayMs = 86_400_000;
  return learned
    .filter((c) => {
      const ageDays = (now.getTime() - new Date(c.learnedAt).getTime()) / dayMs;
      return ageDays >= reviewIntervalDays(c.seenCount);
    })
    .sort((a, b) => new Date(a.learnedAt).getTime() - new Date(b.learnedAt).getTime());
}
