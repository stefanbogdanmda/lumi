import { Concept, OutputSignals } from "./types";
import { CONCEPTS } from "./concepts";
import { conceptsFromSignals } from "./signals";

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

/**
 * Resolve a free-text term to a concept: exact id, exact label, partial label, then matcher.
 * The partial-label tier only runs for terms of length >= 3 to avoid 1-2 char terms
 * matching a label substring.
 */
export function resolveConcept(term: string, concepts: Concept[] = CONCEPTS): Concept | undefined {
  const t = term.trim().toLowerCase();
  if (!t) return undefined;
  return (
    concepts.find((c) => c.id.toLowerCase() === t) ||
    concepts.find((c) => c.label.toLowerCase() === t) ||
    concepts.find((c) => {
      if (t.length < 3) return false; // avoid 1-2 char terms matching a label substring
      const label = c.label.toLowerCase();
      return label.includes(t) || t.includes(label);
    }) ||
    concepts.find((c) => c.matchers.some((m) => (typeof m === "string" ? t.includes(m.toLowerCase()) : m.test(term))))
  );
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

/** Combine prose scoring with action (command/file) scoring; sorted strongest first. */
export function scoreSignals(signals: OutputSignals, concepts: Concept[] = CONCEPTS): ScoredConcept[] {
  const merged = new Map<string, number>();
  const add = (id: string, by: number) => merged.set(id, (merged.get(id) ?? 0) + by);
  for (const { id, score } of scoreConcepts(signals.text, concepts)) add(id, score);
  for (const { id, score } of conceptsFromSignals(signals)) add(id, score);
  const priorityOf = (id: string) => concepts.find((c) => c.id === id)?.priority ?? 1;
  return [...merged.entries()]
    .map(([id, score]) => ({ id, score: score * priorityOf(id) }))
    .sort((a, b) => b.score - a.score);
}
