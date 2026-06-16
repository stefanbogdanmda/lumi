import { existsSync, readFileSync } from "node:fs";
import { Lesson, LessonCache } from "./types";
import { atomicWriteFileSync } from "./fsutil";

export class InMemoryCache implements LessonCache {
  protected items = new Map<string, Lesson>();
  get(conceptId: string): Lesson | undefined { return this.items.get(conceptId); }
  set(conceptId: string, lesson: Lesson): void { this.items.set(conceptId, lesson); }
}

export class JsonFileCache extends InMemoryCache {
  constructor(private file: string) {
    super();
    if (existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Lesson>;
        for (const [k, v] of Object.entries(data)) this.items.set(k, v);
      } catch { /* corrupt -> start fresh */ }
    }
  }
  set(conceptId: string, lesson: Lesson): void {
    super.set(conceptId, lesson);
    const obj = Object.fromEntries(this.items.entries());
    atomicWriteFileSync(this.file, JSON.stringify(obj, null, 2));
  }
}
