/**
 * Lumi weekly digest generator.
 *
 * Generates a structured Digest from the learner's profile, then renders it
 * as plain text or HTML email body. Actual sending is handled by founder infra.
 *
 * All functions are pure and time-injectable (pass `now` for deterministic tests).
 */

import { LearnedConcept } from "./types";
import { CONCEPTS } from "./concepts";
import { learningStats } from "./stats";
import { dueForReview } from "./review";
import { nextAcrossPaths, listPaths } from "./curriculum";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DigestConcept {
  id: string;
  label: string;
}

export interface DigestNextStep {
  pathId: string;
  label: string;
}

export interface Digest {
  learnedThisWeek: DigestConcept[];
  totalLearned: number;
  level: string;
  streakDays: number;
  dueCount: number;
  dueLabels: string[];
  nextStep: DigestNextStep | null;
  headline: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 86_400_000;

/** Build an id→label map from CONCEPTS, falling back to id when not found. */
function buildLabelMap(): Map<string, string> {
  return new Map(CONCEPTS.map((c) => [c.id, c.label]));
}

/** Return the label for a concept id; falls back to the id itself. */
function labelFor(id: string, labelMap: Map<string, string>): string {
  return labelMap.get(id) ?? id;
}

/** Build a headline suitable for a digest email subject / summary sentence. */
function buildHeadline(weekCount: number, level: string): string {
  if (weekCount === 0) {
    return "Your Lumi digest — ready to start learning this week?";
  }
  if (weekCount === 1) {
    return `You learned 1 concept this week — keep it up, ${level} learner!`;
  }
  return `You learned ${weekCount} concepts this week — great work!`;
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * Build a complete weekly Digest from a learner's profile.
 *
 * @param learned  The full list of LearnedConcepts from the learner's profile.
 * @param now      Injected clock — defaults to real `new Date()`.
 */
export function weeklyDigest(learned: LearnedConcept[], now: Date = new Date()): Digest {
  const labelMap = buildLabelMap();

  // 1. Concepts learned within the last 7 days (< 7 * 24h from now)
  const windowStart = now.getTime() - SEVEN_DAYS_MS;
  const learnedThisWeek: DigestConcept[] = learned
    .filter((lc) => new Date(lc.learnedAt).getTime() > windowStart)
    .map((lc) => ({ id: lc.id, label: labelFor(lc.id, labelMap) }));

  // 2. Aggregate stats (streak, level) via learningStats
  const stats = learningStats(learned, now, CONCEPTS);

  // 3. Due for review
  const due = dueForReview(learned, now);
  const dueLabels = due.map((lc) => labelFor(lc.id, labelMap));

  // 4. Next recommended step across paths
  const learnedIds = learned.map((lc) => lc.id);
  const next = nextAcrossPaths(learnedIds);
  let nextStep: DigestNextStep | null = null;
  if (next !== null) {
    nextStep = {
      pathId: next.pathId,
      label: labelFor(next.conceptId, labelMap),
    };
  }

  // 5. Headline
  const headline = buildHeadline(learnedThisWeek.length, stats.level);

  return {
    learnedThisWeek,
    totalLearned: stats.total,
    level: stats.level,
    streakDays: stats.streakDays,
    dueCount: due.length,
    dueLabels,
    nextStep,
    headline,
  };
}

// ---------------------------------------------------------------------------
// Plain-text renderer
// ---------------------------------------------------------------------------

/**
 * Render a Digest as a warm, plain-English text email body.
 * Safe for terminals, plain-text email clients, and logging.
 */
export function renderDigestText(d: Digest): string {
  const lines: string[] = [];

  // Greeting / headline
  lines.push(d.headline);
  lines.push("");

  if (d.totalLearned === 0) {
    // Zero state — encouraging onboarding message
    lines.push("You haven't learned any concepts with Lumi yet — and that's totally fine.");
    lines.push("Just start building or asking questions in your AI tool and Lumi will explain");
    lines.push("tech terms as they come up. Getting started is the hardest part!");
    lines.push("");
    const firstPath = listPaths()[0];
    if (firstPath) {
      lines.push(`Tip: try exploring the "${firstPath.title}" path to get going.`);
      lines.push("");
    }
  } else {
    // Concepts learned this week
    if (d.learnedThisWeek.length === 0) {
      lines.push("You didn't learn any new concepts this week — no worries, every week is a fresh start.");
    } else {
      const conceptList = d.learnedThisWeek.map((c) => c.label).join(", ");
      if (d.learnedThisWeek.length === 1) {
        lines.push(`This week you learned: ${conceptList}.`);
      } else {
        lines.push(`This week you learned ${d.learnedThisWeek.length} concepts: ${conceptList}.`);
      }
    }
    lines.push("");

    // Total & level
    lines.push(`Overall you have learned ${d.totalLearned} concept${d.totalLearned === 1 ? "" : "s"} and you are at the ${d.level} level.`);
    lines.push("");

    // Streak
    if (d.streakDays > 0) {
      lines.push(`You are on a ${d.streakDays}-day learning streak — nice! Keep it going today.`);
    } else {
      lines.push("No streak yet this week — open your AI tool today to start one.");
    }
    lines.push("");

    // Due for review
    if (d.dueCount === 0) {
      lines.push("Nothing is due for review right now. Check back later!");
    } else if (d.dueCount === 1) {
      lines.push(`You have 1 concept due for review: ${d.dueLabels[0]}.`);
    } else {
      const reviewList = d.dueLabels.slice(0, 5).join(", ");
      const extra = d.dueCount > 5 ? ` (+${d.dueCount - 5} more)` : "";
      lines.push(`You have ${d.dueCount} concepts due for review: ${reviewList}${extra}.`);
    }
    lines.push("");

    // Next step in learning path
    if (d.nextStep) {
      lines.push(`Next up in your path: ${d.nextStep.label}`);
      lines.push(`(path: ${d.nextStep.pathId})`);
    } else {
      lines.push("You have completed all learning paths — that is a real achievement!");
    }
    lines.push("");
  }

  // Encouraging close
  lines.push("Keep building, keep asking, keep learning.");
  lines.push("-- Lumi");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

/** Escape a string for safe inclusion in HTML content and attribute values. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render a Digest as a self-contained HTML email body.
 * - No external resources (images, fonts, stylesheets).
 * - All styles are inline.
 * - All dynamic text is HTML-escaped.
 */
export function renderDigestHtml(d: Digest): string {
  const bodyBg   = "#f4f4f4";
  const cardBg   = "#ffffff";
  const primary  = "#4f46e5"; // indigo-600
  const textMain = "#1f2937"; // gray-800
  const textMute = "#6b7280"; // gray-500
  const accent   = "#10b981"; // emerald-500

  const containerStyle = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${bodyBg}; padding: 24px;`;
  const cardStyle      = `background: ${cardBg}; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);`;
  const headlineStyle  = `font-size: 22px; font-weight: 700; color: ${textMain}; margin: 0 0 16px 0;`;
  const h2Style        = `font-size: 15px; font-weight: 600; color: ${primary}; margin: 24px 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;`;
  const pStyle         = `font-size: 15px; color: ${textMain}; margin: 0 0 8px 0; line-height: 1.6;`;
  const mutedStyle     = `font-size: 13px; color: ${textMute}; margin: 0 0 4px 0;`;
  const tagStyle       = `display: inline-block; background: #e0e7ff; color: ${primary}; border-radius: 4px; padding: 2px 8px; font-size: 13px; margin: 2px 2px 2px 0;`;
  const accentStyle    = `color: ${accent}; font-weight: 600;`;
  const footerStyle    = `margin-top: 24px; font-size: 13px; color: ${textMute}; text-align: center;`;

  const parts: string[] = [];

  parts.push(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Lumi Weekly Digest</title></head>
<body style="margin:0;padding:0;background:${escHtml(bodyBg)};">
<div style="${escHtml(containerStyle)}">
<div style="${escHtml(cardStyle)}">`);

  // Headline
  parts.push(`<h1 style="${headlineStyle}">${escHtml(d.headline)}</h1>`);

  if (d.totalLearned === 0) {
    // Zero state
    parts.push(`<p style="${pStyle}">You haven't learned any concepts with Lumi yet — and that's totally fine.</p>`);
    parts.push(`<p style="${pStyle}">Just start building or asking questions in your AI tool and Lumi will explain tech terms as they come up.</p>`);
    const firstPath = listPaths()[0];
    if (firstPath) {
      parts.push(`<p style="${pStyle}">Tip: try exploring the <strong>${escHtml(firstPath.title)}</strong> path to get going.</p>`);
    }
  } else {
    // Concepts learned this week
    parts.push(`<h2 style="${h2Style}">This week</h2>`);
    if (d.learnedThisWeek.length === 0) {
      parts.push(`<p style="${pStyle}">No new concepts this week — no worries, every week is a fresh start.</p>`);
    } else {
      parts.push(`<p style="${pStyle}">You learned <span style="${accentStyle}">${d.learnedThisWeek.length} concept${d.learnedThisWeek.length === 1 ? "" : "s"}</span>:</p>`);
      parts.push(`<p style="margin:0 0 12px 0;">`);
      for (const c of d.learnedThisWeek) {
        parts.push(`<span style="${tagStyle}">${escHtml(c.label)}</span>`);
      }
      parts.push(`</p>`);
    }

    // Summary stats
    parts.push(`<h2 style="${h2Style}">Your progress</h2>`);
    parts.push(`<p style="${pStyle}">Total concepts learned: <strong>${d.totalLearned}</strong> &nbsp;|&nbsp; Level: <strong>${escHtml(d.level)}</strong></p>`);

    if (d.streakDays > 0) {
      parts.push(`<p style="${pStyle}"><span style="${accentStyle}">${d.streakDays}-day streak</span> — keep it going today!</p>`);
    } else {
      parts.push(`<p style="${pStyle}">No streak yet this week — open your AI tool today to start one.</p>`);
    }

    // Due for review
    parts.push(`<h2 style="${h2Style}">Due for review</h2>`);
    if (d.dueCount === 0) {
      parts.push(`<p style="${pStyle}">Nothing due right now. Check back soon!</p>`);
    } else {
      const reviewList = d.dueLabels.slice(0, 5);
      const extra = d.dueCount > 5 ? d.dueCount - 5 : 0;
      parts.push(`<p style="${pStyle}">${d.dueCount} concept${d.dueCount === 1 ? "" : "s"} to review:</p>`);
      parts.push(`<p style="margin:0 0 4px 0;">`);
      for (const label of reviewList) {
        parts.push(`<span style="${tagStyle}">${escHtml(label)}</span>`);
      }
      parts.push(`</p>`);
      if (extra > 0) {
        parts.push(`<p style="${mutedStyle}">+${extra} more</p>`);
      }
    }

    // Next step
    parts.push(`<h2 style="${h2Style}">Next up</h2>`);
    if (d.nextStep) {
      parts.push(`<p style="${pStyle}">Your next concept to learn: <strong>${escHtml(d.nextStep.label)}</strong></p>`);
      parts.push(`<p style="${mutedStyle}">Path: ${escHtml(d.nextStep.pathId)}</p>`);
    } else {
      parts.push(`<p style="${pStyle}">You have completed all learning paths. Incredible work!</p>`);
    }
  }

  // Footer / close
  parts.push(`</div>
<p style="${footerStyle}">Keep building, keep asking, keep learning. &mdash; Lumi</p>
</div>
</body>
</html>`);

  return parts.join("\n");
}
