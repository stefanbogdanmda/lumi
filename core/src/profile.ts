import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { LearningProfile, LearnedConcept } from "./types";

export class InMemoryProfile implements LearningProfile {
  protected items = new Map<string, LearnedConcept>();

  hasLearned(id: string): boolean { return this.items.has(id); }

  markLearned(id: string): void {
    const existing = this.items.get(id);
    if (existing) { existing.seenCount += 1; return; }
    this.items.set(id, { id, learnedAt: new Date().toISOString(), seenCount: 1 });
  }

  listLearned(): LearnedConcept[] { return [...this.items.values()]; }
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

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.listLearned(), null, 2), "utf8");
  }
}
