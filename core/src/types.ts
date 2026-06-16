/** A tech concept Lumi can detect and teach. */
export interface Concept {
  id: string;            // stable id, e.g. "git-commit"
  label: string;         // human label, e.g. "Git commit"
  category: string;      // e.g. "git", "node", "shell"
  matchers: (string | RegExp)[]; // any match => concept present
  /** Higher = more important; preferred when capping lessons per turn. Default 1. */
  priority?: number;
}

/** A short beginner lesson about one concept. */
export interface Lesson {
  conceptId: string;
  title: string;
  plainExplanation: string; // 2-3 plain-English sentences
  whyItMatters: string;     // 1 sentence
  /** Optional one-line plain analogy for beginners. */
  analogy?: string;
  tinyExample?: string;     // optional minimal example
  learnMore?: string;       // optional longer expansion
}

/** A concept the user has learned. */
export interface LearnedConcept {
  id: string;
  learnedAt: string; // ISO timestamp
  seenCount: number;
}

/** Tracks which concepts the user has learned. */
export interface LearningProfile {
  hasLearned(id: string): boolean;
  markLearned(id: string): void; // idempotent; bumps seenCount if already present
  listLearned(): LearnedConcept[];
  /** Record a spaced-review attempt: remembered → reinforce (longer interval); forgotten → relearn from start. */
  review(id: string, remembered: boolean): void;
}

/** Stores generated lessons so they are reused (free + instant). */
export interface LessonCache {
  get(conceptId: string): Lesson | undefined;
  set(conceptId: string, lesson: Lesson): void;
}

/** A coarse learner level used to adapt lesson depth. */
export type LearnerLevel = "beginner" | "growing" | "confident";

/** Turns a concept + context into a Lesson. */
export interface LessonGenerator {
  generate(concept: Concept, context: string, level?: LearnerLevel): Promise<Lesson>;
}

/** What Claude produced in a turn: prose plus the concrete actions it took. */
export interface OutputSignals {
  text: string;
  commands?: string[];
  files?: string[];
}
