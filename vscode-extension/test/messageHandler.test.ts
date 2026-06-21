/**
 * messageHandler.test.ts
 *
 * Tests for the pure-ish message routing layer.  No VS Code runtime is needed
 * because all vscode interactions are injected via the MessageHandlerDeps bag.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Lumi,
  InMemoryProfile,
  InMemoryCache,
  MockGenerator,
  CONCEPTS,
} from "@lumi/core";
import type { LicenseResult } from "@lumi/core";
import { handleMessage } from "../src/messageHandler";
import type { MessageHandlerDeps } from "../src/messageHandler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLumi(): Lumi {
  return new Lumi({
    profile: new InMemoryProfile(),
    cache: new InMemoryCache(),
    generator: new MockGenerator(),
  });
}

function makeDeps(lumi: Lumi, overrides: Partial<MessageHandlerDeps> = {}): {
  deps: MessageHandlerDeps;
  posted: unknown[];
} {
  const posted: unknown[] = [];
  const deps: MessageHandlerDeps = {
    lumi,
    panelPost: (m) => posted.push(m),
    conceptLabel: (id) => CONCEPTS.find((c) => c.id === id)?.label,
    currentEntitlement: () => ({ valid: false, tier: "free" } as LicenseResult),
    verifyLicense: () => ({ valid: false, tier: "free", reason: "Invalid license key" } as LicenseResult),
    storeLicense: vi.fn(),
    ...overrides,
  };
  return { deps, posted };
}

// ---------------------------------------------------------------------------
// gotit
// ---------------------------------------------------------------------------

describe("handleMessage: gotit", () => {
  it("marks the concept learned and posts a progress update", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "gotit", conceptId: "git-commit" }, deps);

    // Concept must be recorded in the profile.
    expect(lumi.listLearned().map((c) => c.id)).toContain("git-commit");

    // A progress message must have been posted.
    const progress = posted.find((m: any) => m.type === "progress") as any;
    expect(progress).toBeDefined();
    expect(progress.count).toBeGreaterThanOrEqual(1);
  });

  it("progress.count reflects the total number of learned concepts", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "gotit", conceptId: "git-commit" }, deps);
    await handleMessage({ type: "gotit", conceptId: "git-branch" }, deps);

    const lastProgress = [...posted].reverse().find((m: any) => m.type === "progress") as any;
    expect(lastProgress.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// fuzzy
// ---------------------------------------------------------------------------

describe("handleMessage: fuzzy", () => {
  it("does NOT mark the concept learned (the user wants it retaught)", async () => {
    const lumi = makeLumi();
    const { deps } = makeDeps(lumi);

    await handleMessage({ type: "fuzzy", conceptId: "git-commit" }, deps);

    expect(lumi.listLearned()).toHaveLength(0);
  });

  it("does NOT post any message for fuzzy", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "fuzzy", conceptId: "git-commit" }, deps);

    expect(posted).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

describe("handleMessage: explain", () => {
  it("posts explainResult with the lesson from lumi.explain", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "explain", term: "git commit" }, deps);

    const result = posted.find((m: any) => m.type === "explainResult") as any;
    expect(result).toBeDefined();
    expect(result.lesson).not.toBeNull();
    expect(result.lesson.conceptId).toBe("git-commit");
  });

  it("also posts a progress update after explain", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "explain", term: "git commit" }, deps);

    const progress = posted.find((m: any) => m.type === "progress") as any;
    expect(progress).toBeDefined();
  });

  it("posts explainResult {lesson: null} for an unknown term without throwing", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "explain", term: "totally-unknown-concept-xyz" }, deps);

    const result = posted.find((m: any) => m.type === "explainResult") as any;
    expect(result).toBeDefined();
    expect(result.lesson).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requestEntitlement
// ---------------------------------------------------------------------------

describe("handleMessage: requestEntitlement", () => {
  it("posts the entitlement tier (free)", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "requestEntitlement" }, deps);

    const ent = posted.find((m: any) => m.type === "entitlement") as any;
    expect(ent).toBeDefined();
    expect(ent.tier).toBe("free");
    expect(ent.valid).toBe(false);
  });

  it("posts the entitlement tier (pro) when deps return a pro entitlement", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi, {
      currentEntitlement: () => ({
        valid: true,
        tier: "pro",
        email: "user@example.com",
      } as LicenseResult),
    });

    await handleMessage({ type: "requestEntitlement" }, deps);

    const ent = posted.find((m: any) => m.type === "entitlement") as any;
    expect(ent).toBeDefined();
    expect(ent.tier).toBe("pro");
    expect(ent.valid).toBe(true);
    expect(ent.email).toBe("user@example.com");
  });
});

// ---------------------------------------------------------------------------
// requestPaths — FREE entitlement
// ---------------------------------------------------------------------------

describe("handleMessage: requestPaths (FREE)", () => {
  it("returns all paths with locked:true for every path after the first", async () => {
    const lumi = makeLumi();
    // FREE entitlement is the default in makeDeps
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "requestPaths" }, deps);

    const msg = posted.find((m: any) => m.type === "paths") as any;
    expect(msg).toBeDefined();
    const paths = msg.paths as any[];
    expect(paths.length).toBeGreaterThan(1);

    // First path is always unlocked for free users.
    expect(paths[0].locked).toBe(false);
    // All subsequent paths must be locked.
    for (const p of paths.slice(1)) {
      expect(p.locked).toBe(true);
    }
  });

  it("includes pathId, title, done, total, pct, nextLabel in each entry", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "requestPaths" }, deps);

    const msg = posted.find((m: any) => m.type === "paths") as any;
    const first = msg.paths[0];
    expect(typeof first.pathId).toBe("string");
    expect(typeof first.title).toBe("string");
    expect(typeof first.done).toBe("number");
    expect(typeof first.total).toBe("number");
    expect(typeof first.pct).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// requestPaths — PRO entitlement
// ---------------------------------------------------------------------------

describe("handleMessage: requestPaths (PRO)", () => {
  it("returns all paths with locked:false for a pro user", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi, {
      currentEntitlement: () => ({
        valid: true,
        tier: "pro",
        email: "user@example.com",
      } as LicenseResult),
    });

    await handleMessage({ type: "requestPaths" }, deps);

    const msg = posted.find((m: any) => m.type === "paths") as any;
    expect(msg).toBeDefined();
    const paths = msg.paths as any[];
    for (const p of paths) {
      expect(p.locked).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// activateLicense — invalid key
// ---------------------------------------------------------------------------

describe("handleMessage: activateLicense (invalid key)", () => {
  it("posts licenseResult {ok:false} for an invalid key", async () => {
    const lumi = makeLumi();
    const storeLicense = vi.fn();
    const { deps, posted } = makeDeps(lumi, {
      verifyLicense: () => ({ valid: false, tier: "free", reason: "Invalid signature" } as LicenseResult),
      storeLicense,
    });

    await handleMessage({ type: "activateLicense", key: "bad-key" }, deps);

    const result = posted.find((m: any) => m.type === "licenseResult") as any;
    expect(result).toBeDefined();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/invalid/i);
  });

  it("does NOT call storeLicense for an invalid key", async () => {
    const lumi = makeLumi();
    const storeLicense = vi.fn();
    const { deps } = makeDeps(lumi, {
      verifyLicense: () => ({ valid: false, tier: "free", reason: "Invalid signature" } as LicenseResult),
      storeLicense,
    });

    await handleMessage({ type: "activateLicense", key: "bad-key" }, deps);

    expect(storeLicense).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// activateLicense — valid key
// ---------------------------------------------------------------------------

describe("handleMessage: activateLicense (valid key)", () => {
  it("calls storeLicense and posts licenseResult {ok:true} for a valid pro key", async () => {
    const lumi = makeLumi();
    const storeLicense = vi.fn();
    const { deps, posted } = makeDeps(lumi, {
      verifyLicense: () => ({
        valid: true,
        tier: "pro",
        email: "user@example.com",
      } as LicenseResult),
      storeLicense,
    });

    await handleMessage({ type: "activateLicense", key: "valid-key" }, deps);

    expect(storeLicense).toHaveBeenCalledWith("valid-key");
    const result = posted.find((m: any) => m.type === "licenseResult") as any;
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("pro");
    expect(result.email).toBe("user@example.com");
  });

  it("posts licenseResult {ok:false} when storeLicense throws", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi, {
      verifyLicense: () => ({
        valid: true,
        tier: "pro",
        email: "user@example.com",
      } as LicenseResult),
      storeLicense: () => { throw new Error("disk full"); },
    });

    await handleMessage({ type: "activateLicense", key: "valid-key" }, deps);

    const result = posted.find((m: any) => m.type === "licenseResult") as any;
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/store/i);
  });
});

// ---------------------------------------------------------------------------
// paste
// ---------------------------------------------------------------------------

describe("handleMessage: paste", () => {
  it("posts a lesson for each detected concept and then pasteResult{count}", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "paste", text: "git commit on a branch" }, deps);

    const lessons = posted.filter((m: any) => m.type === "lesson");
    expect(lessons.length).toBeGreaterThan(0);

    const result = posted.find((m: any) => m.type === "pasteResult") as any;
    expect(result).toBeDefined();
    expect(result.count).toBe(lessons.length);
    expect(Array.isArray(result.risks)).toBe(true);
  });

  it("runs the security lens on pasted code and returns risks", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage(
      { type: "paste", text: 'const apiKey = "sk-1234567890abcdef1234567890abcdef";' },
      deps,
    );

    const result = posted.find((m: any) => m.type === "pasteResult") as any;
    expect(result.risks.length).toBeGreaterThanOrEqual(1);
    expect(result.risks[0]).toHaveProperty("label");
    expect(result.risks[0]).toHaveProperty("severity");
    expect(result.risks[0]).toHaveProperty("advice");
  });

  it("marks each taught concept as learned", async () => {
    const lumi = makeLumi();
    const { deps } = makeDeps(lumi);

    await handleMessage({ type: "paste", text: "git commit on a branch" }, deps);

    const learned = lumi.listLearned().map((c) => c.id);
    expect(learned.length).toBeGreaterThan(0);
  });

  it("posts a progress update after paste", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "paste", text: "git commit" }, deps);

    const progress = posted.find((m: any) => m.type === "progress");
    expect(progress).toBeDefined();
  });

  it("posts pasteResult{count:0, error} when processSignals throws", async () => {
    const lumi = makeLumi();
    const { deps, posted } = makeDeps(lumi);

    // Override lumi.processSignals to throw.
    (lumi as any).processSignals = async () => { throw new Error("network error"); };

    await handleMessage({ type: "paste", text: "anything" }, deps);

    const result = posted.find((m: any) => m.type === "pasteResult") as any;
    expect(result.count).toBe(0);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// requestGlossary
// ---------------------------------------------------------------------------

describe("handleMessage: requestGlossary", () => {
  it("posts a glossary message with a markdown string", async () => {
    const lumi = makeLumi();
    lumi.markLearned("git-commit");
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "requestGlossary" }, deps);

    const msg = posted.find((m: any) => m.type === "glossary") as any;
    expect(msg).toBeDefined();
    expect(typeof msg.markdown).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// requestProgress
// ---------------------------------------------------------------------------

describe("handleMessage: requestProgress", () => {
  it("posts a progress message with count/level/milestone", async () => {
    const lumi = makeLumi();
    lumi.markLearned("git-commit");
    const { deps, posted } = makeDeps(lumi);

    await handleMessage({ type: "requestProgress" }, deps);

    const progress = posted.find((m: any) => m.type === "progress") as any;
    expect(progress).toBeDefined();
    expect(progress.count).toBe(1);
    expect(progress.level).toBeDefined();
  });
});
