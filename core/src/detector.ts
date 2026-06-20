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

export interface ConceptSuggestion {
  id: string;
  label: string;
  score: number; // 0..1, higher = closer
}

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Split a phrase into lowercased word tokens of length >= 2. */
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

/** Similarity of two tokens in 0..1 via normalized edit distance. */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - editDistance(a, b) / maxLen;
}

/**
 * Suggest the closest concepts to a free-text term that didn't resolve exactly.
 * Tolerates typos (edit distance) and related wording (plurals, extra words) so a
 * beginner who doesn't know the exact jargon still gets pointed somewhere useful
 * instead of a dead end. Returns at most `limit` concepts above a relevance floor,
 * strongest first.
 */
export function suggestConcepts(
  term: string,
  concepts: Concept[] = CONCEPTS,
  limit = 3
): ConceptSuggestion[] {
  const t = term.trim().toLowerCase();
  const qTokens = tokenize(t);
  if (t.length < 3 || qTokens.length === 0) return [];
  const FLOOR = 0.66;

  const scored = concepts.map((c) => {
    const candidates = [c.label.toLowerCase(), c.id.replace(/-/g, " ")];
    let best = 0;
    for (const cand of candidates) {
      const cTokens = tokenize(cand);
      if (cTokens.length === 0) continue;
      let sum = 0;
      for (const qt of qTokens) {
        let m = 0;
        for (const ct of cTokens) m = Math.max(m, tokenSimilarity(qt, ct));
        sum += m;
      }
      const avg = sum / qTokens.length;
      const contains = cand.includes(t) || t.includes(cand) ? 0.25 : 0;
      best = Math.max(best, Math.min(1, avg + contains));
    }
    return { id: c.id, label: c.label, score: best };
  });

  return scored
    .filter((s) => s.score >= FLOOR)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
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
