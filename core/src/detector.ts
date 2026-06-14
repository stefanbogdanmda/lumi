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

export interface ScoredConcept {
  id: string;
  score: number;
}

/** Score every concept present in `text` by how many of its matchers hit; sorted strongest first. */
export function scoreConcepts(text: string, concepts: Concept[] = CONCEPTS): ScoredConcept[] {
  const scores: ScoredConcept[] = [];
  for (const c of concepts) {
    let score = 0;
    for (const m of c.matchers) {
      const hit = typeof m === "string"
        ? text.toLowerCase().includes(m.toLowerCase())
        : m.test(text);
      if (hit) score += 1;
    }
    if (score > 0) scores.push({ id: c.id, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}
