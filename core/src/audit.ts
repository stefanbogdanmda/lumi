/**
 * audit.ts — Lumi Security Audit
 *
 * Productizes the security lens into a graded, prioritized, plain-English
 * safety report non-technical builders can act on immediately.
 * Pure: no I/O, no external deps.
 */

import { detectRisks, riskLessonHint, RiskHit } from "./risk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditGrade = "A" | "B" | "C" | "D" | "F";

export interface AuditReport {
  /** Letter grade summarising the overall risk level. */
  grade: AuditGrade;
  /** Total number of risk hits found. */
  total: number;
  /** Count of danger-severity hits. */
  danger: number;
  /** Count of warn-severity hits. */
  warn: number;
  /** Count of info-severity hits. */
  info: number;
  /** Full list of hits, sorted danger → warn → info. */
  hits: RiskHit[];
  /** Up to 3 plain-English fix strings for the most severe hits. */
  topFixes: string[];
}

// ---------------------------------------------------------------------------
// Grade calculation
//
// Rule (documented):
//   - no hits, or only info hits        → A
//   - warn hits but no danger, count=1  → B
//   - warn hits but no danger, count≥2  → C
//   - any danger, danger count=1        → D
//   - any danger, danger count≥2        → F
// ---------------------------------------------------------------------------

export function gradeFor(danger: number, warn: number): AuditGrade {
  if (danger >= 2) return "F";
  if (danger === 1) return "D";
  if (warn >= 2)   return "C";
  if (warn === 1)  return "B";
  return "A";
}

// ---------------------------------------------------------------------------
// auditRisks
// ---------------------------------------------------------------------------

/**
 * Scan `text` for security risks and return a graded safety report.
 *
 * - Uses `detectRisks` for detection (already sorts danger → warn → info).
 * - Grade follows the documented rule above.
 * - `topFixes` contains up to 3 `riskLessonHint` strings for the highest-
 *   severity hits (danger first, then warn).
 */
export function auditRisks(text: string): AuditReport {
  const hits = detectRisks(text);

  let danger = 0;
  let warn = 0;
  let info = 0;
  for (const h of hits) {
    if (h.severity === "danger") danger++;
    else if (h.severity === "warn") warn++;
    else info++;
  }

  const grade = gradeFor(danger, warn);
  const topFixes = hits.slice(0, 3).map((h) => riskLessonHint(h.conceptId));

  return {
    grade,
    total: hits.length,
    danger,
    warn,
    info,
    hits,
    topFixes,
  };
}
