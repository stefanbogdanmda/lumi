import { Concept, Lesson, LearnedConcept, LearningProfile, LessonCache, LessonGenerator, OutputSignals, LearnerLevel } from "./types";
import { CONCEPTS } from "./concepts";
import { scoreSignals, resolveConcept } from "./detector";
import { levelFromCount } from "./level";
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

  /** Detect new concepts from prose only. Does NOT mark them learned. */
  async processOutput(text: string): Promise<Lesson[]> {
    return this.processSignals({ text });
  }

  /** Detect new concepts from prose + actions. Does NOT mark them learned. */
  async processSignals(signals: OutputSignals): Promise<Lesson[]> {
    // Lessons are cached per (concept, level); changing level yields a fresh lesson.
    const level = levelFromCount(this.profile.listLearned().length);
    const ranked = scoreSignals(signals, this.concepts)
      .filter((r) => !this.profile.hasLearned(r.id))
      .slice(0, this.maxPerTurn);
    const lessons: Lesson[] = [];
    for (const { id } of ranked) {
      const concept = this.concepts.find((c) => c.id === id);
      if (!concept) continue; // an action rule fired for an id not in this concept set
      const key = `${id}:${level}`;
      let lesson = this.cache.get(key);
      if (!lesson) {
        lesson = await this.generator.generate(concept, signals.text, level);
        this.cache.set(key, lesson);
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

  /** Teach a specific concept on request. Returns null if the term isn't in the dictionary. */
  async explain(term: string): Promise<Lesson | null> {
    const concept = resolveConcept(term, this.concepts);
    if (!concept) return null;
    const level = levelFromCount(this.profile.listLearned().length);
    const key = `${concept.id}:${level}`;
    let lesson = this.cache.get(key);
    if (!lesson) {
      lesson = await this.generator.generate(concept, `The user asked what "${term}" means.`, level);
      this.cache.set(key, lesson);
    }
    this.profile.markLearned(concept.id);
    return lesson;
  }

  markLearned(id: string): void { this.profile.markLearned(id); }
  listLearned(): LearnedConcept[] { return this.profile.listLearned(); }

  /**
   * Look up a cached definition + analogy for a concept, for the glossary.
   * Lessons are cached per (concept, level); we try each level and return the
   * first hit's plain explanation (as the definition) and analogy. Returns an
   * empty object when nothing is cached — definitions are optional.
   */
  definitionFor(conceptId: string): { definition?: string; analogy?: string } {
    const levels: LearnerLevel[] = ["beginner", "growing", "confident"];
    for (const level of levels) {
      const lesson = this.cache.get(`${conceptId}:${level}`);
      if (lesson) {
        return {
          ...(lesson.plainExplanation ? { definition: lesson.plainExplanation } : {}),
          ...(lesson.analogy ? { analogy: lesson.analogy } : {}),
        };
      }
    }
    return {};
  }

  /** Record a spaced-review attempt (remembered → reinforce; forgotten → relearn). */
  review(id: string, remembered: boolean): void {
    this.profile.review(id, remembered);
  }
}
