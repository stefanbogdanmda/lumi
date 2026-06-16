/**
 * scan.ts — project-level security scan.
 *
 * Walks a real project directory, runs the security lens (`auditRisks`) over
 * each text file, and aggregates the findings into one graded report. This is
 * the "is my actual app safe to ship?" answer — the I/O wrapper around the pure
 * `audit.ts` logic. Skips dependency/build/VCS dirs and oversized/binary files.
 */

import { readdirSync, readFileSync, statSync, Dirent } from "node:fs";
import { join, relative, extname } from "node:path";
import { auditRisks, gradeFor, AuditGrade } from "./audit";
import { riskLessonHint, RiskHit } from "./risk";

/** Directories never worth scanning (deps, build output, VCS, Lumi state). */
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage",
  "vendor", ".lumi", "out", ".cache", ".turbo", ".svelte-kit", "__pycache__",
]);

/** Text source extensions worth scanning for risky patterns. */
const TEXT_EXT = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json", ".py", ".rb", ".php",
  ".go", ".java", ".cs", ".yml", ".yaml", ".html", ".css", ".scss", ".sh",
  ".sql", ".vue", ".svelte", ".astro", ".env", ".txt", ".md", ".toml", ".ini",
]);

export interface FileFinding {
  /** Path relative to the scanned root. */
  path: string;
  /** Risk hits in this file, danger → warn → info. */
  hits: RiskHit[];
}

export interface ProjectAuditReport {
  grade: AuditGrade;
  filesScanned: number;
  total: number;
  danger: number;
  warn: number;
  info: number;
  /** Files that had at least one hit, most-severe first. */
  files: FileFinding[];
  /** Up to 3 plain-English fixes for the most severe distinct risks. */
  topFixes: string[];
}

const SEV_RANK: Record<RiskHit["severity"], number> = { danger: 0, warn: 1, info: 2 };

/** Should this file be scanned? `.env` (no extension) is always included. */
function isScannableFile(name: string): boolean {
  if (name === ".env" || name.startsWith(".env.")) return true;
  return TEXT_EXT.has(extname(name).toLowerCase());
}

/**
 * Scan a project directory and return one aggregated security report.
 * Bounded by `maxFiles` (default 2000) and per-file `maxBytes` (default 256 KB)
 * so it can't run away on a huge tree. Unreadable paths are skipped silently.
 */
export function auditPath(
  rootDir: string,
  opts: { maxFiles?: number; maxBytes?: number } = {},
): ProjectAuditReport {
  const maxFiles = opts.maxFiles ?? 2000;
  const maxBytes = opts.maxBytes ?? 256 * 1024;

  // ── collect candidate files (skip ignore + hidden dirs; no symlink follow) ──
  const files: string[] = [];
  const walk = (dir: string): void => {
    if (files.length >= maxFiles) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return; // unreadable dir — skip
    }
    for (const e of entries) {
      if (files.length >= maxFiles) break;
      if (e.isDirectory()) {
        // skip dependency/build dirs and hidden dirs (.git, .next, …)
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        walk(join(dir, e.name));
      } else if (e.isFile() && isScannableFile(e.name)) {
        files.push(join(dir, e.name));
      }
      // symlinks (e.isSymbolicLink()) are intentionally not followed
    }
  };
  walk(rootDir);

  // ── scan each file ──
  const findings: FileFinding[] = [];
  let danger = 0, warn = 0, info = 0;
  const fixByConcept = new Map<string, RiskHit["severity"]>();

  let scanned = 0;
  for (const f of files) {
    let content: string;
    try {
      if (statSync(f).size > maxBytes) continue;
      content = readFileSync(f, "utf8");
    } catch {
      continue; // unreadable/binary — skip
    }
    scanned++;
    const rep = auditRisks(content);
    if (rep.hits.length === 0) continue;
    findings.push({ path: relative(rootDir, f) || f, hits: rep.hits });
    danger += rep.danger;
    warn += rep.warn;
    info += rep.info;
    for (const h of rep.hits) {
      // keep the most severe occurrence per concept for topFixes ordering
      const prev = fixByConcept.get(h.conceptId);
      if (prev === undefined || SEV_RANK[h.severity] < SEV_RANK[prev]) {
        fixByConcept.set(h.conceptId, h.severity);
      }
    }
  }

  // most-severe-first ordering of files
  findings.sort((a, b) => SEV_RANK[a.hits[0].severity] - SEV_RANK[b.hits[0].severity]);

  // top 3 distinct fixes, danger-first
  const topFixes = [...fixByConcept.entries()]
    .sort((a, b) => SEV_RANK[a[1]] - SEV_RANK[b[1]])
    .slice(0, 3)
    .map(([conceptId]) => riskLessonHint(conceptId));

  return {
    grade: gradeFor(danger, warn),
    filesScanned: scanned,
    total: danger + warn + info,
    danger,
    warn,
    info,
    files: findings,
    topFixes,
  };
}
