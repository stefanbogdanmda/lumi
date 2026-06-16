/**
 * certificate.ts — Lumi "Verified" certificate artifact (SVG, 1400×990).
 *
 * Chosen dimensions: 1400×990 — a premium portrait-ish landscape that gives
 * enough breathing room for a formal certificate layout while remaining a
 * reasonable aspect ratio for print or sharing (roughly A4 landscape scale).
 *
 * All user-derived text is XML-escaped before embedding so the output is safe
 * to include in any renderer.  The `name` field is especially critical because
 * it is direct user input.
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
// Design tokens  (matching card.ts palette)
// ---------------------------------------------------------------------------

const W = 1400;
const H = 990;

const BG_START   = "#070A18";
const BG_END     = "#141A44";
const AMBER      = "#FFC56B";
const WHITE      = "#FFFFFF";
const CHIP_BG    = "#1E245A";
const CHIP_BORDER = "#2E3980";
const DIM_WHITE  = "#8891CC";
const BORDER_COLOR = "#2E3980";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CertificateInput {
  /** Learner's display name. Falls back to "Lumi Learner" if absent or empty. */
  name?: string;
  conceptCount: number;
  level: string;
  /** ISO date or display date string, e.g. "2024-06-15". */
  date: string;
  /** Up to 6 concept labels rendered as chips. */
  topConcepts: string[];
}

// ---------------------------------------------------------------------------
// renderCertificate
// ---------------------------------------------------------------------------

/**
 * Render a self-contained 1400×990 SVG certificate.
 * Returns a complete SVG string ready to write to a file or embed in HTML.
 */
export function renderCertificate(input: CertificateInput): string {
  const { conceptCount, level, date, topConcepts } = input;

  // Resolve name with fallback
  const displayName = input.name && input.name.trim().length > 0
    ? input.name
    : "Lumi Learner";

  // Cap chips at 6
  const chips = topConcepts.slice(0, 6);

  // Escaped dynamic values (CRITICAL: name is user input)
  const safeName  = escapeXml(displayName);
  const safeCount = escapeXml(String(conceptCount));
  const safeLevel = escapeXml(level);
  const safeDate  = escapeXml(date);

  const conceptUnit = conceptCount === 1 ? "concept" : "concepts";

  // -------------------------------------------------------------------------
  // Concept chips row
  // -------------------------------------------------------------------------

  const CHIP_H        = 36;
  const CHIP_PADDING_X = 16;
  const CHIP_FONT_SIZE = 14;
  const CHAR_WIDTH    = 8.5;
  const CHIP_SPACING  = 12;
  const CHIP_ROW_Y    = 780;
  const CHIP_TEXT_Y   = CHIP_ROW_Y + CHIP_H / 2 + CHIP_FONT_SIZE * 0.35;

  const chipWidths = chips.map((l) =>
    Math.round(l.length * CHAR_WIDTH + CHIP_PADDING_X * 2)
  );
  const totalChipWidth =
    chipWidths.reduce((a, b) => a + b, 0) +
    Math.max(0, chips.length - 1) * CHIP_SPACING;

  const chipStartX = Math.max(100, (W - totalChipWidth) / 2);

  let chipSvg = "";
  let cx = chipStartX;
  for (let i = 0; i < chips.length; i++) {
    const cw = chipWidths[i];
    const safeLabel = escapeXml(chips[i]);
    chipSvg += `
    <rect x="${cx}" y="${CHIP_ROW_Y}" width="${cw}" height="${CHIP_H}"
          rx="18" ry="18"
          fill="${CHIP_BG}" stroke="${CHIP_BORDER}" stroke-width="1"/>
    <text x="${cx + cw / 2}" y="${CHIP_TEXT_Y}"
          font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
          font-size="${CHIP_FONT_SIZE}" fill="${AMBER}" text-anchor="middle">${safeLabel}</text>`;
    cx += cw + CHIP_SPACING;
  }

  // -------------------------------------------------------------------------
  // Certificate border / frame
  // -------------------------------------------------------------------------

  const FRAME_INSET = 28;
  const FRAME_INNER = 40;

  // -------------------------------------------------------------------------
  // Build SVG
  // -------------------------------------------------------------------------

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
     aria-label="Lumi Verified certificate for ${safeName}">

  <!-- Defs: gradients + glow filter -->
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG_START}"/>
      <stop offset="100%" stop-color="${BG_END}"/>
    </linearGradient>
    <linearGradient id="amberGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${AMBER}" stop-opacity="0.6"/>
      <stop offset="50%"  stop-color="${AMBER}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${AMBER}" stop-opacity="0.6"/>
    </linearGradient>
    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${AMBER}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Subtle central glow -->
  <ellipse cx="${W / 2}" cy="${H / 2}" rx="550" ry="380" fill="url(#centerGlow)"/>

  <!-- Decorative corner arcs (top-right) -->
  <circle cx="${W}" cy="0" r="460" fill="none" stroke="${BORDER_COLOR}" stroke-width="1" opacity="0.3"/>
  <circle cx="${W}" cy="0" r="320" fill="none" stroke="${BORDER_COLOR}" stroke-width="1" opacity="0.18"/>

  <!-- Decorative corner arcs (bottom-left) -->
  <circle cx="0" cy="${H}" r="380" fill="none" stroke="${BORDER_COLOR}" stroke-width="1" opacity="0.2"/>

  <!-- Outer certificate frame -->
  <rect x="${FRAME_INSET}" y="${FRAME_INSET}"
        width="${W - FRAME_INSET * 2}" height="${H - FRAME_INSET * 2}"
        rx="12" ry="12"
        fill="none" stroke="${AMBER}" stroke-width="1.5" opacity="0.55"/>

  <!-- Inner certificate frame -->
  <rect x="${FRAME_INNER}" y="${FRAME_INNER}"
        width="${W - FRAME_INNER * 2}" height="${H - FRAME_INNER * 2}"
        rx="8" ry="8"
        fill="none" stroke="${AMBER}" stroke-width="0.75" opacity="0.3"/>

  <!-- Corner ornaments (top-left) -->
  <line x1="${FRAME_INSET}" y1="${FRAME_INSET + 60}" x2="${FRAME_INSET}" y2="${FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>
  <line x1="${FRAME_INSET}" y1="${FRAME_INSET}" x2="${FRAME_INSET + 60}" y2="${FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>

  <!-- Corner ornaments (top-right) -->
  <line x1="${W - FRAME_INSET}" y1="${FRAME_INSET + 60}" x2="${W - FRAME_INSET}" y2="${FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>
  <line x1="${W - FRAME_INSET}" y1="${FRAME_INSET}" x2="${W - FRAME_INSET - 60}" y2="${FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>

  <!-- Corner ornaments (bottom-left) -->
  <line x1="${FRAME_INSET}" y1="${H - FRAME_INSET - 60}" x2="${FRAME_INSET}" y2="${H - FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>
  <line x1="${FRAME_INSET}" y1="${H - FRAME_INSET}" x2="${FRAME_INSET + 60}" y2="${H - FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>

  <!-- Corner ornaments (bottom-right) -->
  <line x1="${W - FRAME_INSET}" y1="${H - FRAME_INSET - 60}" x2="${W - FRAME_INSET}" y2="${H - FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>
  <line x1="${W - FRAME_INSET}" y1="${H - FRAME_INSET}" x2="${W - FRAME_INSET - 60}" y2="${H - FRAME_INSET}"
        stroke="${AMBER}" stroke-width="2.5" opacity="0.7"/>

  <!-- Wordmark (top-centre) -->
  <text x="${W / 2}" y="100"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="26" font-weight="700" fill="${AMBER}"
        text-anchor="middle" letter-spacing="4" filter="url(#glow)">Lumi</text>

  <!-- Title: "Certificate of Progress" -->
  <text x="${W / 2}" y="160"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="18" font-weight="400" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="6">CERTIFICATE OF PROGRESS</text>

  <!-- Amber divider line below title -->
  <line x1="${W / 2 - 200}" y1="185" x2="${W / 2 + 200}" y2="185"
        stroke="url(#amberGrad)" stroke-width="1.5"/>

  <!-- "This certifies that" -->
  <text x="${W / 2}" y="250"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="17" font-weight="400" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="1">This certifies that</text>

  <!-- Learner name (large, prominent) -->
  <text x="${W / 2}" y="340"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="64" font-weight="800" fill="${WHITE}"
        text-anchor="middle" letter-spacing="-0.5">${safeName}</text>

  <!-- Amber underline beneath name -->
  <line x1="${W / 2 - 300}" y1="360" x2="${W / 2 + 300}" y2="360"
        stroke="url(#amberGrad)" stroke-width="1" opacity="0.5"/>

  <!-- "has learned" -->
  <text x="${W / 2}" y="430"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="20" font-weight="400" fill="${DIM_WHITE}"
        text-anchor="middle">has learned</text>

  <!-- Count + unit (large amber) -->
  <text x="${W / 2}" y="530"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="96" font-weight="900" fill="${AMBER}"
        text-anchor="middle" filter="url(#softGlow)">${safeCount}</text>

  <!-- unit label -->
  <text x="${W / 2}" y="582"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="22" font-weight="400" fill="${WHITE}"
        text-anchor="middle" letter-spacing="2">${conceptUnit}</text>

  <!-- Level badge -->
  <rect x="${W / 2 - 130}" y="612" width="260" height="42" rx="21" ry="21"
        fill="${CHIP_BG}" stroke="${CHIP_BORDER}" stroke-width="1.5"/>
  <text x="${W / 2}" y="638"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="17" font-weight="600" fill="${DIM_WHITE}"
        text-anchor="middle">Level: ${safeLevel}</text>

  <!-- "Lumi Verified" badge -->
  <rect x="${W / 2 - 100}" y="670" width="200" height="36" rx="18" ry="18"
        fill="${AMBER}" opacity="0.15" stroke="${AMBER}" stroke-width="1"/>
  <text x="${W / 2}" y="693"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="14" font-weight="700" fill="${AMBER}"
        text-anchor="middle" letter-spacing="1">Lumi Verified</text>

  <!-- Top concept chips (if any) -->
  ${chips.length > 0 ? `
  <text x="${W / 2}" y="${CHIP_ROW_Y - 20}"
        font-family="ui-sans-serif,system-ui,sans-serif"
        font-size="12" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="2">TOP CONCEPTS</text>
  ${chipSvg}` : ""}

  <!-- Footer separator -->
  <line x1="100" y1="${H - 80}" x2="${W - 100}" y2="${H - 80}"
        stroke="${BORDER_COLOR}" stroke-width="1" opacity="0.5"/>

  <!-- Footer: date (left) + domain (centre) -->
  <text x="110" y="${H - 48}"
        font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
        font-size="14" fill="${DIM_WHITE}"
        text-anchor="start" letter-spacing="0.5">Issued: ${safeDate}</text>

  <text x="${W / 2}" y="${H - 48}"
        font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
        font-size="14" fill="${DIM_WHITE}"
        text-anchor="middle" letter-spacing="0.5">lumi.dev</text>

  <text x="${W - 110}" y="${H - 48}"
        font-family="ui-monospace,SFMono-Regular,Menlo,monospace"
        font-size="14" fill="${DIM_WHITE}"
        text-anchor="end" letter-spacing="0.5">Powered by Lumi</text>

</svg>`;

  return svg;
}

// ---------------------------------------------------------------------------
// certificateFromProfile
// ---------------------------------------------------------------------------

/**
 * Derive certificate inputs from a list of learned concepts and call
 * renderCertificate.
 *
 * @param learned - Array of LearnedConcept from a LearningProfile.
 * @param opts    - Optional `name` for the learner and `now` for deterministic date.
 */
export function certificateFromProfile(
  learned: LearnedConcept[],
  opts: { name?: string; now?: Date } = {},
): string {
  const now = opts.now ?? new Date();
  const stats = learningStats(learned, now, CONCEPTS);

  // Top concept labels: up to 6 most recent, resolved via stats.recent
  const topConcepts = stats.recent.map((r) => r.label);

  // ISO date portion for display
  const date = now.toISOString().slice(0, 10);

  return renderCertificate({
    name: opts.name,
    conceptCount: stats.total,
    level: stats.level,
    date,
    topConcepts,
  });
}

// ---------------------------------------------------------------------------
// isCertificateEligible
// ---------------------------------------------------------------------------

/**
 * Returns true when the learner has reached the minimum milestone to receive
 * a certificate (10 or more concepts learned).
 *
 * The caller decides what to do when the learner is not yet eligible (e.g.,
 * show a progress nudge rather than blocking the workflow).
 */
export function isCertificateEligible(conceptCount: number): boolean {
  return conceptCount >= 10;
}
