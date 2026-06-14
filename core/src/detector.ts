import { Concept } from "./types";
import { CONCEPTS } from "./concepts";

/** Return the ids of all concepts present in `text` (deduped). */
export function detectConcepts(text: string, concepts: Concept[] = CONCEPTS): string[] {
  const found = new Set<string>();
  for (const c of concepts) {
    for (const m of c.matchers) {
      const hit = typeof m === "string"
        ? text.toLowerCase().includes(m.toLowerCase())
        : m.test(text);
      if (hit) { found.add(c.id); break; }
    }
  }
  return [...found];
}
