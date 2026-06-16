import type { LicenseResult } from "./license";

// ---------------------------------------------------------------------------
// Feature type and Pro feature set
// ---------------------------------------------------------------------------

export type Feature =
  | "certificate"
  | "all-paths"
  | "project-scan"
  | "cloud-sync"
  | "streak-freeze"
  | "rich-digest";

export const PRO_FEATURES: Set<Feature> = new Set([
  "certificate",
  "all-paths",
  "project-scan",
  "cloud-sync",
  "streak-freeze",
  "rich-digest",
]);

// ---------------------------------------------------------------------------
// Gating helpers
// ---------------------------------------------------------------------------

/** Returns true when the entitlement represents an active Pro subscription. */
export function isPro(ent: LicenseResult): boolean {
  return ent.valid === true && ent.tier === "pro";
}

/** Returns true when the feature requires a Pro license to use. */
export function requiresPro(feature: Feature): boolean {
  return PRO_FEATURES.has(feature);
}

/** Returns true when the given feature is accessible with the current entitlement. */
export function allowed(feature: Feature, ent: LicenseResult): boolean {
  if (!requiresPro(feature)) return true;
  return isPro(ent);
}

// ---------------------------------------------------------------------------
// Upgrade messaging
// ---------------------------------------------------------------------------

const UPGRADE_MESSAGES: Record<Feature, string> = {
  certificate:
    "Completion certificates are a Pro feature — they give you a shareable record of what you've learned and make a great addition to your portfolio. Upgrade to unlock yours: run `lumi upgrade`.",
  "all-paths":
    "Access to all learning paths is a Pro feature — it opens up every curated topic so you can follow the curriculum that fits your goals. Upgrade to explore them all: run `lumi upgrade`.",
  "project-scan":
    "Project-wide risk scanning is a Pro feature — it reviews your entire codebase for security and quality patterns, not just the current file. Upgrade to run a full scan: run `lumi upgrade`.",
  "cloud-sync":
    "Cloud sync is a Pro feature — it keeps your learning progress, streaks, and certificates backed up and available across every machine you work on. Upgrade to turn it on: run `lumi upgrade`.",
  "streak-freeze":
    "Streak freeze is a Pro feature — it lets you protect your learning streak on days you need a break, without losing the momentum you've built. Upgrade to keep your streak safe: run `lumi upgrade`.",
  "rich-digest":
    "Rich weekly digests are a Pro feature — they give you a detailed look at what you've learned, your progress trends, and personalised suggestions for what to tackle next. Upgrade to get the full picture: run `lumi upgrade`.",
};

/**
 * Returns a friendly, plain-English explanation of why a feature requires Pro
 * and how to upgrade. Never pressuring — just clear about the value.
 */
export function upgradeMessage(feature: Feature): string {
  return (
    UPGRADE_MESSAGES[feature] ??
    `This feature is available on Pro. Upgrade to unlock it: run \`lumi upgrade\`.`
  );
}
