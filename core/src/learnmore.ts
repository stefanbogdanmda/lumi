/**
 * learnmore.ts — honest "where to read more" links.
 *
 * We deliberately do NOT fabricate deep documentation URLs (which could 404 or
 * point at the wrong page). Instead we build a SEARCH on a trusted source,
 * chosen by the concept's category, which always resolves. This fills the
 * "learn more / citation" gap without inventing facts.
 */

import { Concept } from "./types";

const mdnSearch = (q: string): string =>
  `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(q)}`;

const webSearch = (q: string): string =>
  `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

// Categories whose concepts are well covered by MDN web docs.
const MDN_CATEGORIES = new Set(["web", "programming", "node", "build", "shell"]);

/**
 * Build a trustworthy "learn more" URL for a concept.
 * - web/programming/node/build/shell → MDN search (authoritative web docs)
 * - security → a search qualified with "OWASP" (the canonical security source)
 * - everything else (git, devops, data, testing) → a plain-English explainer search
 */
export function learnMoreUrl(concept: Pick<Concept, "label" | "category">): string {
  const label = concept.label.trim();
  if (concept.category === "security") {
    return webSearch(`${label} OWASP security best practice`);
  }
  if (MDN_CATEGORIES.has(concept.category)) {
    return mdnSearch(label);
  }
  return webSearch(`${label} explained simply`);
}
