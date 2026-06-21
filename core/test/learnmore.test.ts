import { describe, it, expect } from "vitest";
import { learnMoreUrl } from "../src/learnmore";
import { CONCEPTS } from "../src/concepts";

describe("learnMoreUrl over the whole dictionary", () => {
  it("produces a valid, non-empty-query URL for every concept", () => {
    for (const c of CONCEPTS) {
      const url = learnMoreUrl(c);
      expect(url, `${c.id} has raw spaces`).not.toContain(" ");
      expect(() => new URL(url), `${c.id} → ${url}`).not.toThrow();
      expect(new URL(url).search.length, `${c.id} empty query`).toBeGreaterThan(3);
    }
  });
});

describe("learnMoreUrl", () => {
  it("uses MDN search for web concepts", () => {
    const url = learnMoreUrl({ label: "API", category: "web" });
    expect(url).toContain("developer.mozilla.org");
    expect(url).toContain("q=API");
  });

  it("uses MDN for programming/node/build/shell", () => {
    for (const category of ["programming", "node", "build", "shell"] as const) {
      expect(learnMoreUrl({ label: "Async", category })).toContain("developer.mozilla.org");
    }
  });

  it("qualifies security concepts with OWASP", () => {
    const url = learnMoreUrl({ label: "SQL injection risk", category: "security" });
    expect(url).toContain("duckduckgo.com");
    expect(decodeURIComponent(url)).toContain("OWASP");
    expect(decodeURIComponent(url)).toContain("SQL injection risk");
  });

  it("uses a plain-English explainer search for git/devops/data/testing", () => {
    const url = learnMoreUrl({ label: "Git commit", category: "git" });
    expect(url).toContain("duckduckgo.com");
    expect(decodeURIComponent(url)).toContain("explained simply");
  });

  it("URL-encodes labels with spaces and symbols (valid URL, no raw spaces)", () => {
    const url = learnMoreUrl({ label: "CI/CD pipeline", category: "devops" });
    expect(url).not.toContain(" ");
    expect(() => new URL(url)).not.toThrow();
  });
});
