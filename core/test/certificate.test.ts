import { describe, it, expect } from "vitest";
import {
  renderCertificate,
  certificateFromProfile,
  isCertificateEligible,
} from "../src/certificate";
import { LearnedConcept } from "../src/types";
import { CONCEPTS } from "../src/concepts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLC = (id: string, isoDate: string, seenCount = 1): LearnedConcept => ({
  id,
  learnedAt: isoDate,
  seenCount,
});

const FIXED_DATE = "2024-06-15";

// ---------------------------------------------------------------------------
// isCertificateEligible
// ---------------------------------------------------------------------------

describe("isCertificateEligible", () => {
  it("returns false for 0 concepts", () => {
    expect(isCertificateEligible(0)).toBe(false);
  });

  it("returns false for 9 concepts", () => {
    expect(isCertificateEligible(9)).toBe(false);
  });

  it("returns true for exactly 10 concepts", () => {
    expect(isCertificateEligible(10)).toBe(true);
  });

  it("returns true for 50 concepts", () => {
    expect(isCertificateEligible(50)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderCertificate — structural
// ---------------------------------------------------------------------------

describe("renderCertificate", () => {
  const base = {
    conceptCount: 12,
    level: "growing",
    date: FIXED_DATE,
    topConcepts: ["Git commit", "npm install", "REST API"],
  };

  it("starts with <svg and ends with </svg>", () => {
    const svg = renderCertificate(base);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("contains the concept count", () => {
    const svg = renderCertificate({ ...base, conceptCount: 42 });
    expect(svg).toContain("42");
  });

  it("contains the Lumi wordmark", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("Lumi");
  });

  it('contains "Lumi Verified" somewhere', () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("Lumi Verified");
  });

  it("contains the learner name when provided", () => {
    const svg = renderCertificate({ ...base, name: "Alice" });
    expect(svg).toContain("Alice");
  });

  it('uses "Lumi Learner" as the default name when name is absent', () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("Lumi Learner");
  });

  it('uses "Lumi Learner" as the default when name is empty string', () => {
    const svg = renderCertificate({ ...base, name: "" });
    expect(svg).toContain("Lumi Learner");
  });

  it("contains the level string", () => {
    const svg = renderCertificate({ ...base, level: "confident" });
    expect(svg).toContain("confident");
  });

  it("contains the date string", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain(FIXED_DATE);
  });

  it("renders top concept chip labels", () => {
    const svg = renderCertificate({
      ...base,
      topConcepts: ["Git commit", "npm install", "REST API"],
    });
    expect(svg).toContain("Git commit");
    expect(svg).toContain("npm install");
    expect(svg).toContain("REST API");
  });

  it("caps chips at 6 even when more are provided", () => {
    const topConcepts = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const svg = renderCertificate({ ...base, topConcepts });
    // G and H (index 6 and 7) must not appear as chip text
    expect(svg).not.toContain(">G<");
    expect(svg).not.toContain(">H<");
  });

  it("renders without throwing for empty topConcepts", () => {
    expect(() =>
      renderCertificate({ ...base, topConcepts: [] })
    ).not.toThrow();
  });

  it("contains the footer/domain reference", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("lumi.dev");
  });

  it("has the chosen dimensions (1400 wide, 990 high)", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain('width="1400"');
    expect(svg).toContain('height="990"');
  });

  it("contains the deep-indigo background gradient colors", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("#070A18");
    expect(svg).toContain("#141A44");
  });

  it("contains the amber accent color", () => {
    const svg = renderCertificate(base);
    expect(svg).toContain("#FFC56B");
  });

  it("is self-contained (no external http references)", () => {
    const svg = renderCertificate(base);
    expect(svg).not.toMatch(/href="https?:/);
    expect(svg).not.toMatch(/src="https?:/);
  });

  // -------------------------------------------------------------------------
  // XSS / escaping — critical: name is user-controlled input
  // -------------------------------------------------------------------------

  it("escapes a script-injection attempt in the name field", () => {
    const malicious = "</text><script>alert(1)</script>";
    const svg = renderCertificate({ ...base, name: malicious });
    expect(svg).not.toContain("</text><script>");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("</script>");
    expect(svg).toContain("&lt;/text&gt;&lt;script&gt;");
  });

  it("escapes & in the name", () => {
    const svg = renderCertificate({ ...base, name: "Alice & Bob" });
    expect(svg).not.toContain("Alice & Bob");
    expect(svg).toContain("Alice &amp; Bob");
  });

  it("escapes double-quotes in the name", () => {
    const svg = renderCertificate({ ...base, name: 'Say "hello"' });
    expect(svg).not.toContain('"hello"');
    expect(svg).toContain("&quot;hello&quot;");
  });

  it("escapes & in a concept label", () => {
    const svg = renderCertificate({
      ...base,
      topConcepts: ["Fetch & XHR"],
    });
    expect(svg).not.toContain("Fetch & XHR");
    expect(svg).toContain("Fetch &amp; XHR");
  });

  it("escapes < and > in a concept label", () => {
    const svg = renderCertificate({
      ...base,
      topConcepts: ["<bad>"],
    });
    expect(svg).not.toContain("<bad>");
    expect(svg).toContain("&lt;bad&gt;");
  });

  // False-positive guard: ordinary words must not break anything
  it("does not escape ordinary ASCII text", () => {
    const svg = renderCertificate({ ...base, name: "Jane Doe" });
    expect(svg).toContain("Jane Doe");
  });
});

// ---------------------------------------------------------------------------
// certificateFromProfile
// ---------------------------------------------------------------------------

describe("certificateFromProfile", () => {
  it("returns a valid SVG string", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit",  "2024-06-15T10:00:00.000Z"),
      makeLC("git-push",    "2024-06-14T10:00:00.000Z"),
      makeLC("npm-install", "2024-06-13T10:00:00.000Z"),
    ];
    const svg = certificateFromProfile(learned, { now: new Date("2024-06-15T12:00:00.000Z") });
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("derives the correct concept count", () => {
    const ids = ["git-commit", "git-push", "npm-install"];
    const learned = ids.map((id) => makeLC(id, "2024-06-15T10:00:00.000Z"));
    const svg = certificateFromProfile(learned);
    expect(svg).toContain("3");
  });

  it("derives the level (6 concepts → growing)", () => {
    const ids = [
      "git-commit", "git-push", "git-branch",
      "git-merge", "git-pull", "npm-install",
    ];
    const learned = ids.map((id) => makeLC(id, "2024-06-15T10:00:00.000Z"));
    const svg = certificateFromProfile(learned);
    expect(svg).toContain("growing");
  });

  it("includes the learner name when provided via opts", () => {
    const learned = [makeLC("git-commit", "2024-06-15T10:00:00.000Z")];
    const svg = certificateFromProfile(learned, { name: "Bob" });
    expect(svg).toContain("Bob");
  });

  it('uses "Lumi Learner" when no name given', () => {
    const learned = [makeLC("git-commit", "2024-06-15T10:00:00.000Z")];
    const svg = certificateFromProfile(learned);
    expect(svg).toContain("Lumi Learner");
  });

  it("renders without throwing for empty profile", () => {
    expect(() => certificateFromProfile([])).not.toThrow();
  });

  it("renders top concept labels resolved via CONCEPTS", () => {
    const learned: LearnedConcept[] = [
      makeLC("git-commit", "2024-06-15T10:00:00.000Z"),
    ];
    const svg = certificateFromProfile(learned, { now: new Date("2024-06-15T12:00:00.000Z") });
    // Label for git-commit is "Git commit"
    expect(svg).toContain("Git commit");
  });

  it("works with no options (defaults)", () => {
    const learned = [makeLC("git-commit", new Date().toISOString())];
    expect(() => certificateFromProfile(learned)).not.toThrow();
  });
});
