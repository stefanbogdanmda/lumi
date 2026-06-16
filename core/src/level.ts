import { LearnerLevel } from "./types";

/** Coarse learner level from how many concepts they've learned. */
export function levelFromCount(learnedCount: number): LearnerLevel {
  if (learnedCount <= 5) return "beginner";
  if (learnedCount <= 20) return "growing";
  return "confident";
}
