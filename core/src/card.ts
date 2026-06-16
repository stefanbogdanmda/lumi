/**
 * card.ts — Lumi shareable progress card (SVG, 1200×630).
 *
 * The chosen dimensions are 1200×630 (Open Graph / Twitter card ratio),
 * which makes the output screenshot-friendly on every major social platform.
 *
 * All user-derived text is HTML/XML-escaped before being embedded in the SVG
 * so the output is safe to embed in any renderer.
 */

import { LearnedConcept, Concept } from "./types";
import { CONCEPTS } from "./concepts";
import { levelFromCount } from "./level";
import { learningStats } from "./stats";

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/** Escape characters that are special in XML/SVG text content and attributes. */
function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const W = 1200;
const H = 630;

const BG_START = "#070A18";
const BG_END   = "#141A44";
const AMBER    = "#FFC56B";
const WHITE    = "#FFFFFF";
const CHIP_BG  = "#1E245A";
const CHIP_BORDER = "#2E3980";
const DIM_WHITE = "#8891CC";

// ---------------------------------------------------------------------------
// Small SVG flame path (centred on 0,0; approx 18×22 px)
// ---------------------------------------------------------------------------

const FLAME_PATH =
  "M0-11c1 4-1 7 2 9-1-3 1-5 3-4-2 2-1 6 2 7-1-2 0-4 2-4 2 3 0 7-3 9 4-1 6-5 4-9 2 2 2 5 0 8 3-2 4-7 1-11-1 3-3 4-4 3 2-3 0-7-4-8 1 2 0 4-2 4 1-2 1-5-1-4z";

// ---------------------------------------------------------------------------
// renderProgressCard
// ---------------------------------------------------------------------------

export interface ProgressCardInput {
  conceptCount: number;
  level: string;
  streakDays: number;
  recentLabels: string[];
}

/**
 * Render a self-contained 1200×630 SVG progress card.
 * Returns a complete SVG string ready to write to a file or embed in HTML.
 */
export function renderProgressCard(input: ProgressCardInput): string {
  const { conceptCount, level, streakDays, recentLabels } = input;

  // Cap chips at 5
  const chips = recentLabels.slice(0, 5);

  // Escaped dynamic values
  const safeLevel  = escapeXml(level);
  const safeCount  = escapeXml(String(conceptCount));

  // Headline: "I learned N concepts with Lumi"
  const headlineUnit = conceptCount === 1 ? "concept" : "concepts";
  const headlineLine1 = `I learned ${safeCount} ${headlineUnit}`;
  const headlineLine2 = "with Lumi";

  // Streak text (no emoji dependency)
  const streakText = streakDays > 0
    ? `${escapeXml(String(streakDays))}-day streak`
    : "";

  // Level badge text
  const levelText = `Level: ${safeLevel}`;

  // -------------------------------------------------------------------------
  // Concept chips row
  // -------------------------------------------------------------------------

  // Each chip is a rounded rect + text.  We lay them out left-to-right
  // starting at chipRowX, centred at chipRowY.
  // Approximate chip width = label length * 8 + 24px padding
  const CHIP_H = 34;
  const CHIP_PADDING_X = 14;
  const CHIP_FONT_SIZE = 14;
  const CHAR_WIDTH = 8.5; // rough monospace estimate
  const CHIP_SPACING = 10;
  const CHIP_ROW_Y = 440;
  const CHIP_TEXT_Y = CHIP_ROW_Y + CHIP_H / 2 + CHIP_FONT_SIZE * 0.35;

  // Compute widths
  const chipWidths = chips.map((l) =>
    Math.round(l.length * CHAR_WIDTH + CHIP_PADDING_X * 2)
  );
  const totalChipWidth =
    chipWidths.reduce((a, b) => a + b, 0) +
    Math.max(0, chips.length - 1) * CHIP_SPACING;

  const chipStartX = Math.max(80, (W - totalChipWidth) / 2);

  let chipSvg = "";
  let cx = chipStartX;
  for (let i = 0; i < chips.length; i++) {
    const cw = chipWidths[i];
    const safeLabel = escapeXml(chips[i]);
    chipSvg += `
    <rect x="${cx}" y="${CHIP_ROW_Y}" width="${cw}" height="${CHIP_H}"
          rx="17" ry="17"
          fill="${CHIP_BG}" stroke="${CHIP_BORDER}" stroke-width="1"/>
    <text x="${cx + cw / 2}" y="${CHIP_TEXT_Y}"
          font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
          font-size="${CHIP_FONT_SIZE}" fill="${AMBER}" text-anchor="middle">${safeLabel}</text>`;
    cx += cw + CHIP_SPACING;
  }

  // -------------------------------------------------------------------------
  // Glow "spark" dot
  // -------------------------------------------------------------------------
  const SPARK_CX = 80;
  const SPARK_CY = 80;
  const SPARK_R  = 6;

  // -------------------------------------------------------------------------
  // Build SVG
  // -------------------------------------------------------------------------

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
     aria-label="Lumi progress card: ${safeCount} concepts learned">

  <!-- Defs: gradient + glow filters -->
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG_START}"/>
      <stop offset="100%" stop-color="${BG_END}"/>
    </linearGradient>
    <radialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${AMBER}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Decorative top-right arc -->
  <circle cx="${W}" cy="0" r="380" fill="none" stroke="${CHIP_BORDER}" stroke-width="1" opacity="0.4"/>
  <circle cx="${W}" cy="0" r="260" fill="none" stroke="${CHIP_BORDER}" stroke-width="1" opacity="0.25"/>

  <!-- Spark / glow dot -->
  <circle cx="${SPARK_CX}" cy="${SPARK_CY}" r="40" fill="url(#sparkGlow)" opacity="0.55"/>
  <circle cx="${SPARK_CX}" cy="${SPARK_CY}" r="${SPARK_R}" fill="${AMBER}" filter="url(#glow)"/>

  <!-- Wordmark -->
  <text x="${SPARK_CX + 22}" y="${SPARK_CY + 6}"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="22" font-weight="700" fill="${AMBER}" letter-spacing="2">Lumi</text>

  <!-- Headline line 1 -->
  <text x="${W / 2}" y="215"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="72" font-weight="800" fill="${WHITE}"
        text-anchor="middle" dominant-baseline="auto"
        letter-spacing="-1">${headlineLine1}</text>

  <!-- Headline line 2 -->
  <text x="${W / 2}" y="305"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="72" font-weight="800" fill="${AMBER}"
        text-anchor="middle" letter-spacing="-1">${headlineLine2}</text>

  <!-- Level badge -->
  <rect x="${W / 2 - 110}" y="340" width="220" height="38" rx="19" ry="19"
        fill="${CHIP_BG}" stroke="${CHIP_BORDER}" stroke-width="1.5"/>
  <text x="${W / 2}" y="364"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="16" font-weight="600" fill="${DIM_WHITE}"
        text-anchor="middle">${levelText}</text>

  <!-- Flame icon + streak -->
  ${streakDays > 0 ? `
  <g transform="translate(${W / 2 + 130}, 358)" filter="url(#glow)">
    <path d="${FLAME_PATH}" fill="${AMBER}" transform="scale(0.85)"/>
  </g>
  <text x="${W / 2 + 150}" y="364"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="15" font-weight="600" fill="${AMBER}"
        text-anchor="start">${streakText}</text>` : ""}

  <!-- Concept chips -->
  ${chips.length > 0 ? `
  <text x="${W / 2}" y="${CHIP_ROW_Y - 18}"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="13" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="1">RECENT CONCEPTS</text>
  ${chipSvg}` : ""}

  <!-- Footer separator -->
  <line x1="80" y1="${H - 72}" x2="${W - 80}" y2="${H - 72}"
        stroke="${CHIP_BORDER}" stroke-width="1" opacity="0.6"/>

  <!-- Footer text -->
  <text x="${W / 2}" y="${H - 40}"
        font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
        font-size="15" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="0.5">Made with Lumi — npm i -g lumi</text>

</svg>`;

  return svg;
}

// ---------------------------------------------------------------------------
// progressCardFromProfile
// ---------------------------------------------------------------------------

export interface ProgressCardFromProfileOpts {
  now?: Date;
  concepts?: Concept[];
}

/**
 * Derive card inputs from a list of learned concepts and call renderProgressCard.
 *
 * @param learned  - Array of LearnedConcept from a LearningProfile.
 * @param opts     - Optional `now` (for deterministic streak) and `concepts` list.
 */
export function progressCardFromProfile(
  learned: LearnedConcept[],
  opts: ProgressCardFromProfileOpts = {},
): string {
  const now = opts.now ?? new Date();
  const concepts = opts.concepts ?? CONCEPTS;

  const stats = learningStats(learned, now, concepts);
  const recentLabels = stats.recent.map((r) => r.label);

  return renderProgressCard({
    conceptCount: stats.total,
    level: stats.level,
    streakDays: stats.streakDays,
    recentLabels,
  });
}
