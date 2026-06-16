import { LearnedConcept, Concept } from "./types";
import { CONCEPTS } from "./concepts";
import { levelFromCount } from "./level";

export interface CategoryStat { category: string; count: number; }
export interface RecentStat { id: string; label: string; learnedAt: string; }
export interface LearningStats {
  total: number;
  level: string;
  streakDays: number;       // consecutive days ENDING TODAY with >=1 concept learned (0 if none today)
  byCategory: CategoryStat[]; // sorted by count desc, then category asc
  recent: RecentStat[];     // up to 5 most recent by learnedAt desc
}

const dayKey = (iso: string): string => iso.slice(0, 10); // YYYY-MM-DD

export function learningStats(
  learned: LearnedConcept[],
  now: Date = new Date(),
  concepts: Concept[] = CONCEPTS,
): LearningStats {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const label = (id: string) => byId.get(id)?.label ?? id;

  // by category
  const catCounts = new Map<string, number>();
  for (const lc of learned) {
    const cat = byId.get(lc.id)?.category ?? "other";
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const byCategory = [...catCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  // recent
  const recent = [...learned]
    .sort((a, b) => b.learnedAt.localeCompare(a.learnedAt))
    .slice(0, 5)
    .map((lc) => ({ id: lc.id, label: label(lc.id), learnedAt: lc.learnedAt }));

  // current streak: consecutive days ending today
  const days = new Set(learned.map((lc) => dayKey(lc.learnedAt)));
  let streakDays = 0;
  const cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (days.has(cur.toISOString().slice(0, 10))) {
    streakDays += 1;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  return { total: learned.length, level: levelFromCount(learned.length), streakDays, byCategory, recent };
}
