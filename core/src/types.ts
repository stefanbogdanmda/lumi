/** A tech concept Lumi can detect and teach. */
export interface Concept {
  id: string;            // stable id, e.g. "git-commit"
  label: string;         // human label, e.g. "Git commit"
  category: string;      // e.g. "git", "node", "shell"
  matchers: (string | RegExp)[]; // any match => concept present
}

/** A short beginner lesson about one concept. */
export interface Lesson {
  conceptId: string;
  title: string;
  plainExplanation: string; // 2-3 plain-English sentences
  whyItMatters: string;     // 1 sentence
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
}

/** Stores generated lessons so they are reused (free + instant). */
export interface LessonCache {
  get(conceptId: string): Lesson | undefined;
  set(conceptId: string, lesson: Lesson): void;
}

/** Turns a concept + context into a Lesson. */
export interface LessonGenerator {
  generate(concept: Concept, context: string): Promise<Lesson>;
}
