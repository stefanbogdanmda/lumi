import { Concept, Lesson, LearnedConcept, LearningProfile, LessonCache, LessonGenerator } from "./types";
import { CONCEPTS } from "./concepts";
import { scoreConcepts } from "./detector";
import { InMemoryCache } from "./cache";

export interface LumiOptions {
  profile: LearningProfile;
  generator: LessonGenerator;
  cache?: LessonCache;
  concepts?: Concept[];
  maxPerTurn?: number;
}

export class Lumi {
  private profile: LearningProfile;
  private generator: LessonGenerator;
  private cache: LessonCache;
  private concepts: Concept[];
  private maxPerTurn: number;

  constructor(opts: LumiOptions) {
    this.profile = opts.profile;
    this.generator = opts.generator;
    this.cache = opts.cache ?? new InMemoryCache();
    this.concepts = opts.concepts ?? CONCEPTS;
    this.maxPerTurn = opts.maxPerTurn ?? 2;
  }

  /** Detect new concepts in `text` and return lessons. Does NOT mark them learned. */
  async processOutput(text: string): Promise<Lesson[]> {
    const ranked = scoreConcepts(text, this.concepts)
      .filter((r) => !this.profile.hasLearned(r.id))
      .slice(0, this.maxPerTurn);
    const lessons: Lesson[] = [];
    for (const { id } of ranked) {
      const concept = this.concepts.find((c) => c.id === id)!;
      let lesson = this.cache.get(id);
      if (!lesson) {
        lesson = await this.generator.generate(concept, text);
        this.cache.set(id, lesson);
      }
      lessons.push(lesson);
    }
    return lessons;
  }

  /** Inline mode: teach new concepts AND immediately mark them learned. */
  async teachAndRemember(text: string): Promise<Lesson[]> {
    const lessons = await this.processOutput(text);
    for (const l of lessons) this.profile.markLearned(l.conceptId);
    return lessons;
  }

  markLearned(id: string): void { this.profile.markLearned(id); }
  listLearned(): LearnedConcept[] { return this.profile.listLearned(); }
}
