import { LearnedConcept, Concept } from "./types";
import { CONCEPTS } from "./concepts";
import { learnMoreUrl } from "./learnmore";
import { categoryLabel } from "./topics";

const TITLE = "# My Lumi Glossary";

/** YYYY-MM-DD from an ISO timestamp (or any Date-parsable string). */
function isoDate(learnedAt: string): string {
  return learnedAt.slice(0, 10);
}

/**
 * Render a user's learned concepts as a friendly, deterministic Markdown glossary.
 * Pure: no I/O, stable ordering (categories alphabetical, concepts by label).
 */
export function renderGlossary(
  learned: LearnedConcept[],
  concepts: Concept[] = CONCEPTS,
): string {
  if (learned.length === 0) {
    return [
      TITLE,
      "",
      "You haven't learned any concepts yet. As Lumi explains things while you build,",
      "they'll show up here so you can look them back up any time.",
      "",
      "Want to get started now? Run `lumi learn` to learn your first concept, or",
      "`lumi topics` to browse what Lumi can teach.",
    ].join("\n");
  }

  const byId = new Map<string, Concept>();
  for (const c of concepts) byId.set(c.id, c);

  interface Entry {
    category: string;
    label: string;
    learnedAt: string;
    seenCount: number;
    learnMore?: string;
  }

  const entries: Entry[] = learned.map((l) => {
    const concept = byId.get(l.id);
    const category = concept?.category ?? "other";
    const label = concept?.label ?? l.id;
    return {
      category,
      label,
      learnedAt: l.learnedAt,
      seenCount: l.seenCount,
      learnMore: learnMoreUrl({ label, category }),
    };
  });

  // Group by category.
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = groups.get(e.category) ?? [];
    list.push(e);
    groups.set(e.category, list);
  }

  const count = learned.length;
  const lines: string[] = [
    TITLE,
    "",
    `You've learned ${count} ${count === 1 ? "concept" : "concepts"}.`,
  ];

  // Sort by the friendly heading so display order matches what the user reads.
  const categories = [...groups.keys()].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b)),
  );
  for (const category of categories) {
    const items = groups
      .get(category)!
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label));
    lines.push("", `## ${categoryLabel(category)}`);
    for (const item of items) {
      lines.push(
        `- **${item.label}** — learned ${isoDate(item.learnedAt)}, seen ${item.seenCount}×`,
      );
      if (item.learnMore) {
        lines.push(`  Learn more: ${item.learnMore}`);
      }
    }
  }

  return lines.join("\n");
}
