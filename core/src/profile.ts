import { existsSync, readFileSync } from "node:fs";
import { LearningProfile, LearnedConcept } from "./types";
import { atomicWriteFileSync } from "./fsutil";

export class InMemoryProfile implements LearningProfile {
  protected items = new Map<string, LearnedConcept>();

  hasLearned(id: string): boolean { return this.items.has(id); }

  markLearned(id: string): void {
    const existing = this.items.get(id);
    if (existing) { existing.seenCount += 1; return; }
    this.items.set(id, { id, learnedAt: new Date().toISOString(), seenCount: 1 });
  }

  listLearned(): LearnedConcept[] { return [...this.items.values()]; }

  review(id: string, remembered: boolean): void {
    const now = new Date().toISOString();
    const existing = this.items.get(id);
    if (!existing) {
      if (remembered) this.items.set(id, { id, learnedAt: now, seenCount: 1 });
      return; // forgetting a concept you never learned is a no-op
    }
    if (remembered) {
      existing.seenCount += 1;   // success -> reviewIntervalDays grows
      existing.learnedAt = now;  // reset the clock from this review
    } else {
      existing.seenCount = 1;    // failure -> relearn from the start (shortest interval)
      existing.learnedAt = now;
    }
  }
}

/** Same behavior as InMemoryProfile, but persisted to a JSON file. */
export class JsonFileProfile extends InMemoryProfile {
  constructor(private file: string) {
    super();
    if (existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, "utf8")) as LearnedConcept[];
        for (const c of data) this.items.set(c.id, c);
      } catch { /* corrupt file -> start fresh */ }
    }
  }

  markLearned(id: string): void {
    super.markLearned(id);
    this.save();
  }

  review(id: string, remembered: boolean): void {
    super.review(id, remembered);
    this.save();
  }

  private save(): void {
    atomicWriteFileSync(this.file, JSON.stringify(this.listLearned(), null, 2));
  }
}
