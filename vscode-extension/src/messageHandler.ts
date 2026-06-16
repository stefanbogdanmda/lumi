/**
 * messageHandler.ts
 *
 * Pure-ish message routing for the Lumi VS Code panel.
 *
 * All vscode API calls are injected via `MessageHandlerDeps` so this module
 * has NO direct `vscode` import and can be unit-tested without the VS Code
 * runtime.  `activate()` in extension.ts builds the real deps object.
 */

import type { Lumi, LicenseResult, LearnedConcept } from "@lumi/core";
import {
  renderGlossary,
  dueForReview,
  levelFromCount,
  milestoneFor,
  runAdvise,
  runPrompt,
  allPathsProgress,
  listPaths,
  CONCEPTS,
  weeklyDigest,
  renderDigestText,
  isPro,
} from "@lumi/core";
import type { InboundMessage } from "./panelView";

// ---------------------------------------------------------------------------
// Deps bag — every vscode interaction is a callback here
// ---------------------------------------------------------------------------

/** The shape of every path entry posted to the panel. */
export interface PathEntry {
  pathId: string;
  title: string;
  done: number;
  total: number;
  pct: number;
  nextLabel: string | null;
  locked: boolean;
}

export interface MessageHandlerDeps {
  /** The Lumi orchestrator (already constructed, injectable for tests). */
  lumi: Lumi;

  /** Post any message to the webview panel. */
  panelPost(msg: unknown): void;

  /** Look up the human label for a concept id. */
  conceptLabel(id: string): string | undefined;

  /** Resolve the current entitlement (tier, valid, email, expires). */
  currentEntitlement(): LicenseResult;

  /**
   * Verify a raw license key string.
   * Returns LicenseResult so the caller decides what to do next.
   */
  verifyLicense(key: string): LicenseResult;

  /**
   * Persist the license key after a successful verification.
   * Throws on I/O error so the caller can catch and report.
   */
  storeLicense(key: string): void;
}

// ---------------------------------------------------------------------------
// Internal helper — posts current progress state
// ---------------------------------------------------------------------------

function postProgress(lumi: Lumi, panelPost: MessageHandlerDeps["panelPost"]): void {
  const count = lumi.listLearned().length;
  panelPost({
    type: "progress",
    count,
    level: levelFromCount(count),
    milestone: milestoneFor(count),
  });
}

// ---------------------------------------------------------------------------
// Main exported handler
// ---------------------------------------------------------------------------

/**
 * Route a single inbound panel message to the appropriate core operation.
 *
 * Returns a Promise so async handlers are awaited by callers that care (e.g.
 * tests).  The extension host fires-and-forgets; errors are caught internally
 * and result in a safe error payload posted to the panel.
 */
export async function handleMessage(
  msg: InboundMessage,
  deps: MessageHandlerDeps
): Promise<void> {
  const { lumi, panelPost, conceptLabel, currentEntitlement, verifyLicense, storeLicense } = deps;

  switch (msg.type) {
    case "gotit":
      lumi.markLearned(msg.conceptId);
      postProgress(lumi, panelPost);
      break;

    case "fuzzy":
      // Leave the concept unlearned so Lumi can re-teach it later.
      break;

    case "requestGlossary":
      panelPost({ type: "glossary", markdown: renderGlossary(lumi.listLearned()) });
      break;

    case "requestReview": {
      const items = dueForReview(lumi.listLearned()).map((c: LearnedConcept) => ({
        id: c.id,
        label: conceptLabel(c.id) ?? c.id,
      }));
      panelPost({ type: "review", items });
      break;
    }

    case "requestProgress":
      postProgress(lumi, panelPost);
      break;

    case "explain": {
      const lesson = await lumi.explain(msg.term);
      panelPost({ type: "explainResult", lesson });
      postProgress(lumi, panelPost);
      break;
    }

    case "requestNext": {
      try {
        const lines: string[] = [];
        await runAdvise({ out: (s) => lines.push(s), source: "claude" });
        panelPost({ type: "nextResult", text: lines.join("\n") });
      } catch {
        panelPost({ type: "nextResult", text: "Something went wrong. Please try again." });
      }
      break;
    }

    case "polishPrompt": {
      try {
        const lines: string[] = [];
        await runPrompt(msg.idea, {
          out: (s) => lines.push(s),
          source: "claude",
          level: levelFromCount(lumi.listLearned().length),
        });
        panelPost({ type: "promptResult", text: lines.join("\n") });
      } catch {
        panelPost({ type: "promptResult", text: "Something went wrong. Please try again." });
      }
      break;
    }

    case "paste": {
      try {
        const lessons = await lumi.processSignals({ text: msg.text });
        for (const lesson of lessons) {
          panelPost({ type: "lesson", lesson });
          lumi.markLearned(lesson.conceptId);
        }
        panelPost({ type: "pasteResult", count: lessons.length });
        postProgress(lumi, panelPost);
      } catch {
        panelPost({ type: "pasteResult", count: 0, error: "Something went wrong. Please try again." });
      }
      break;
    }

    case "requestPaths": {
      try {
        const ent = currentEntitlement();
        const pro = isPro(ent);
        const learnedIds = lumi.listLearned().map((c) => c.id);
        const progressList = allPathsProgress(learnedIds);
        const pathDefs = listPaths();
        const paths: PathEntry[] = progressList.map((pp, idx) => {
          const pathDef = pathDefs.find((p) => p.id === pp.pathId);
          const title = pathDef?.title ?? pp.pathId;
          const nextLabel = pp.nextConceptId
            ? (CONCEPTS.find((c) => c.id === pp.nextConceptId)?.label ?? pp.nextConceptId)
            : null;
          const locked = !pro && idx > 0;
          return {
            pathId: pp.pathId,
            title,
            done: pp.done,
            total: pp.total,
            pct: pp.pct,
            nextLabel,
            locked,
          };
        });
        panelPost({ type: "paths", paths });
      } catch {
        panelPost({ type: "paths", paths: [], error: "Could not load learning paths." });
      }
      break;
    }

    case "requestEntitlement": {
      const ent = currentEntitlement();
      panelPost({ type: "entitlement", tier: ent.tier, valid: ent.valid, email: ent.email, expires: ent.expires });
      break;
    }

    case "activateLicense": {
      const result = verifyLicense(msg.key ?? "");
      if (result.valid && result.tier === "pro") {
        try {
          storeLicense(msg.key);
          panelPost({ type: "licenseResult", ok: true, tier: "pro", email: result.email, expires: result.expires });
        } catch {
          panelPost({ type: "licenseResult", ok: false, reason: "Could not store license key." });
        }
      } else {
        panelPost({ type: "licenseResult", ok: false, reason: result.reason ?? "Invalid license key" });
      }
      break;
    }

    case "requestDigest": {
      try {
        const text = renderDigestText(weeklyDigest(lumi.listLearned()));
        panelPost({ type: "digest", text });
      } catch {
        panelPost({ type: "digest", text: "Could not load digest. Please try again." });
      }
      break;
    }
  }
}
