import { describe, it, expect } from "vitest";
import {
  PRO_FEATURES,
  isPro,
  requiresPro,
  allowed,
  upgradeMessage,
} from "../src/entitlements";
import type { Feature } from "../src/entitlements";
import type { LicenseResult } from "../src/license";

const FREE_ENT: LicenseResult = { valid: false, tier: "free" };
const PRO_ENT: LicenseResult = { valid: true, tier: "pro", email: "user@example.com" };

// ---------------------------------------------------------------------------
// PRO_FEATURES set
// ---------------------------------------------------------------------------

describe("PRO_FEATURES", () => {
  it("contains all expected features", () => {
    const expected: Feature[] = [
      "certificate",
      "all-paths",
      "project-scan",
      "cloud-sync",
      "streak-freeze",
      "rich-digest",
    ];
    for (const f of expected) {
      expect(PRO_FEATURES.has(f)).toBe(true);
    }
  });

  it("contains exactly 6 features", () => {
    expect(PRO_FEATURES.size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// isPro
// ---------------------------------------------------------------------------

describe("isPro", () => {
  it("returns true for a valid pro entitlement", () => {
    expect(isPro(PRO_ENT)).toBe(true);
  });

  it("returns false for a free entitlement", () => {
    expect(isPro(FREE_ENT)).toBe(false);
  });

  it("returns false for valid:false even if tier is somehow pro", () => {
    const weird: LicenseResult = { valid: false, tier: "pro" };
    expect(isPro(weird)).toBe(false);
  });

  it("returns false for valid:true but tier free (edge case)", () => {
    const weird: LicenseResult = { valid: true, tier: "free" };
    expect(isPro(weird)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requiresPro
// ---------------------------------------------------------------------------

describe("requiresPro", () => {
  it("returns true for all declared pro features", () => {
    for (const f of PRO_FEATURES) {
      expect(requiresPro(f)).toBe(true);
    }
  });

  it("returns false for a feature not in PRO_FEATURES (cast via unknown)", () => {
    expect(requiresPro("non-existent-feature" as unknown as Feature)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// allowed
// ---------------------------------------------------------------------------

describe("allowed", () => {
  it("allows a pro feature for a pro entitlement", () => {
    expect(allowed("certificate", PRO_ENT)).toBe(true);
    expect(allowed("all-paths", PRO_ENT)).toBe(true);
    expect(allowed("project-scan", PRO_ENT)).toBe(true);
    expect(allowed("cloud-sync", PRO_ENT)).toBe(true);
    expect(allowed("streak-freeze", PRO_ENT)).toBe(true);
    expect(allowed("rich-digest", PRO_ENT)).toBe(true);
  });

  it("blocks a pro feature for a free entitlement", () => {
    expect(allowed("certificate", FREE_ENT)).toBe(false);
    expect(allowed("all-paths", FREE_ENT)).toBe(false);
    expect(allowed("project-scan", FREE_ENT)).toBe(false);
    expect(allowed("cloud-sync", FREE_ENT)).toBe(false);
    expect(allowed("streak-freeze", FREE_ENT)).toBe(false);
    expect(allowed("rich-digest", FREE_ENT)).toBe(false);
  });

  it("allows a non-pro (free) feature for everyone", () => {
    // Cast an unknown string so we can test the free-fallthrough path
    const freeFeature = "basic-lesson" as unknown as Feature;
    expect(allowed(freeFeature, FREE_ENT)).toBe(true);
    expect(allowed(freeFeature, PRO_ENT)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// upgradeMessage
// ---------------------------------------------------------------------------

describe("upgradeMessage", () => {
  const PRO_FEATURE_LIST: Feature[] = [
    "certificate",
    "all-paths",
    "project-scan",
    "cloud-sync",
    "streak-freeze",
    "rich-digest",
  ];

  for (const feature of PRO_FEATURE_LIST) {
    it(`upgradeMessage("${feature}") returns a non-empty string`, () => {
      const msg = upgradeMessage(feature);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
    });

    it(`upgradeMessage("${feature}") mentions lumi upgrade`, () => {
      const msg = upgradeMessage(feature);
      expect(msg.toLowerCase()).toMatch(/lumi upgrade/);
    });
  }

  it("upgradeMessage returns a string for unknown feature (graceful)", () => {
    const msg = upgradeMessage("unknown-feature" as unknown as Feature);
    expect(typeof msg).toBe("string");
  });
});
