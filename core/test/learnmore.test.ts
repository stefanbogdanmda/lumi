import { describe, it, expect } from "vitest";
import { learnMoreUrl } from "../src/learnmore";

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
