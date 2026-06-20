/**
 * topics.ts — browse what Lumi can teach.
 *
 * The glossary only shows concepts a learner has *already* met. A brand-new user
 * (empty glossary) has no way to see the menu of what's available to learn. `lumi
 * topics` closes that gap: a friendly, category-grouped map of the whole dictionary,
 * with a drill-in view that marks what you already know.
 */

import { CONCEPTS } from "./concepts";
import { Concept } from "./types";

/** Friendly, beginner-facing names for raw category ids, in a sensible learning order. */
const CATEGORY_LABELS: Record<string, string> = {
  programming: "Programming basics",
  git: "Git & version control",
  shell: "Terminal & shell",
  node: "Node & packages",
  web: "Web & APIs",
  data: "Data & databases",
  build: "Building & compiling",
  testing: "Testing",
  devops: "Deploy & DevOps",
  security: "Security & safety",
};

/** Human-friendly label for a raw category id (falls back to the id itself). */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export interface TopicCategory {
  category: string;
  label: string;
  count: number;
  examples: string[]; // a few concept labels, for a taste of the category
}

/** Rank categories by the curated learning order above; unknown categories sort last. */
function categoryRank(category: string): number {
  const order = Object.keys(CATEGORY_LABELS);
  const idx = order.indexOf(category);
  return idx === -1 ? order.length : idx;
}

/** Group all concepts by category, each with a count and a few example labels. */
export function topicCategories(concepts: Concept[] = CONCEPTS, exampleCount = 3): TopicCategory[] {
  const byCat = new Map<string, Concept[]>();
  for (const c of concepts) {
    const list = byCat.get(c.category) ?? [];
    list.push(c);
    byCat.set(c.category, list);
  }
  return [...byCat.entries()]
    .map(([category, list]) => ({
      category,
      label: categoryLabel(category),
      count: list.length,
      examples: list.slice(0, exampleCount).map((c) => c.label),
    }))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.label.localeCompare(b.label));
}

export interface TopicConcept {
  id: string;
  label: string;
  learned: boolean;
}

/**
 * List every concept in one category, marking which the learner already knows.
 * Matching is case-insensitive on the raw category id (e.g. "git", "Security").
 * Returns null if no concept uses that category, so callers can show the menu.
 */
export function topicsInCategory(
  category: string,
  learnedIds: string[],
  concepts: Concept[] = CONCEPTS
): TopicConcept[] | null {
  const cat = category.trim().toLowerCase();
  if (!cat) return null;
  const learned = new Set(learnedIds);
  const matches = concepts
    .filter((c) => c.category.toLowerCase() === cat)
    .map((c) => ({ id: c.id, label: c.label, learned: learned.has(c.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return matches.length > 0 ? matches : null;
}

/**
 * Up to `limit` sibling concepts (same category) the learner hasn't met yet — a
 * "you might also like" trail shown after a successful `lumi explain`, so there's
 * always an obvious next thing to learn. Most important siblings (higher priority)
 * come first. Returns [] if the concept is unknown or all siblings are learned.
 */
export function relatedConcepts(
  conceptId: string,
  learnedIds: string[],
  concepts: Concept[] = CONCEPTS,
  limit = 3
): TopicConcept[] {
  const self = concepts.find((c) => c.id === conceptId);
  if (!self) return [];
  const learned = new Set(learnedIds);
  return concepts
    .filter((c) => c.category === self.category && c.id !== self.id && !learned.has(c.id))
    .sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => ({ id: c.id, label: c.label, learned: false }));
}
