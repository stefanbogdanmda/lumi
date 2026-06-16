import { describe, it, expect } from "vitest";
import { auditRisks, AuditReport } from "../src/audit";
import { runCli } from "../src/cli";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// PART 1: auditRisks — grade boundaries
// ---------------------------------------------------------------------------

describe("auditRisks — empty / clean input", () => {
  it("empty string → grade A, total 0, topFixes empty", () => {
    const r = auditRisks("");
    expect(r.grade).toBe("A");
    expect(r.total).toBe(0);
    expect(r.danger).toBe(0);
    expect(r.warn).toBe(0);
    expect(r.info).toBe(0);
    expect(r.hits).toHaveLength(0);
    expect(r.topFixes).toHaveLength(0);
  });

  it("benign prose → grade A", () => {
    const r = auditRisks("I went for a walk in the park today.");
    expect(r.grade).toBe("A");
    expect(r.total).toBe(0);
  });
});

describe("auditRisks — only info hits → grade A", () => {
  // info-severity hits are non-blocking, so still grade A
  it("info-only → grade A", () => {
    // We'll inject a fabricated report via the same grading logic
    // by passing text that produces no hits at all (cleanest path);
    // since the SEVERITY map has no info entries currently we test grade logic directly
    const r = auditRisks("nothing risky");
    // No real info-severity concepts exist in the registry, so this is clean A
    expect(r.grade).toBe("A");
  });
});

describe("auditRisks — warn-only hits → grade B or C", () => {
  it("one warn (open-cors) → grade B", () => {
    // Canonical trigger for open-cors (warn)
    const r = auditRisks('res.setHeader("Access-Control-Allow-Origin", "*")');
    expect(r.grade).toBe("B");
    expect(r.danger).toBe(0);
    expect(r.warn).toBeGreaterThanOrEqual(1);
    expect(r.total).toBe(r.warn + r.info);
  });

  it("multiple warns → grade C", () => {
    // Two warn-severity concepts: open-cors + missing-auth
    const text = [
      'res.setHeader("Access-Control-Allow-Origin", "*")',    // open-cors (warn)
      "no authentication required on this route",             // missing-auth (warn)
      "fetch(\"http://api.example.com/users\")",              // plaintext-http (warn)
    ].join("\n");
    const r = auditRisks(text);
    expect(r.grade).toBe("C");
    expect(r.danger).toBe(0);
    expect(r.warn).toBeGreaterThanOrEqual(2);
  });
});

describe("auditRisks — danger hits → grade D or F", () => {
  it("one danger → grade D", () => {
    const r = auditRisks('const apiKey = "sk-1234567890abcdef";');
    expect(r.grade).toBe("D");
    expect(r.danger).toBeGreaterThanOrEqual(1);
  });

  it("two+ dangers → grade F", () => {
    const text = [
      'const apiKey = "sk-1234567890abcdef";',   // hardcoded-secret (danger)
      "eval(userInput)",                           // eval-injection (danger)
    ].join("\n");
    const r = auditRisks(text);
    expect(r.grade).toBe("F");
    expect(r.danger).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// PART 2: hit ordering and counts
// ---------------------------------------------------------------------------

describe("auditRisks — ordering and counts", () => {
  it("hits are sorted danger-first, then warn", () => {
    const text = [
      'const apiKey = "sk-live-abc123"',          // hardcoded-secret (danger)
      "no authentication required on this route", // missing-auth (warn)
    ].join("\n");
    const r = auditRisks(text);
    const dangerIdx = r.hits.findIndex((h) => h.severity === "danger");
    const warnIdx = r.hits.findIndex((h) => h.severity === "warn");
    if (dangerIdx !== -1 && warnIdx !== -1) {
      expect(dangerIdx).toBeLessThan(warnIdx);
    }
  });

  it("total = danger + warn + info", () => {
    const text = [
      'const apiKey = "sk-1234567890abcdef";',
      "no authentication required on this route",
    ].join("\n");
    const r = auditRisks(text);
    expect(r.total).toBe(r.danger + r.warn + r.info);
  });

  it("hits array matches total", () => {
    const r = auditRisks('eval(userInput)');
    expect(r.hits.length).toBe(r.total);
  });
});

// ---------------------------------------------------------------------------
// PART 3: topFixes
// ---------------------------------------------------------------------------

describe("auditRisks — topFixes", () => {
  it("topFixes contains riskLessonHint strings for most severe hits", () => {
    const r = auditRisks('const apiKey = "sk-1234567890abcdef";');
    expect(r.topFixes.length).toBeGreaterThan(0);
    // Each fix is a non-empty string
    for (const fix of r.topFixes) expect(typeof fix).toBe("string");
    expect(r.topFixes[0].length).toBeGreaterThan(10);
  });

  it("topFixes capped at 3 even with many hits", () => {
    const text = [
      'const apiKey = "sk-1234567890abcdef";',   // hardcoded-secret
      "eval(userInput)",                           // eval-injection
      "NEXT_PUBLIC_STRIPE_SECRET=sk_live_abc123", // secret-in-frontend
      "no authentication required on this route", // missing-auth
      'res.setHeader("Access-Control-Allow-Origin", "*")', // open-cors
    ].join("\n");
    const r = auditRisks(text);
    expect(r.topFixes.length).toBeLessThanOrEqual(3);
  });

  it("topFixes is empty for a clean report", () => {
    const r = auditRisks("nothing dangerous here");
    expect(r.topFixes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PART 4: AuditReport shape
// ---------------------------------------------------------------------------

describe("auditRisks — AuditReport shape", () => {
  it("returns all required fields", () => {
    const r = auditRisks("");
    const keys: Array<keyof AuditReport> = ["grade", "total", "danger", "warn", "info", "hits", "topFixes"];
    for (const k of keys) expect(r).toHaveProperty(k);
  });

  it("grade is one of A B C D F", () => {
    const grades = ["A", "B", "C", "D", "F"] as const;
    const r = auditRisks('const secret = "abc123";');
    expect(grades).toContain(r.grade);
  });
});

// ---------------------------------------------------------------------------
// PART 5: CLI audit command
// ---------------------------------------------------------------------------

describe("runCli audit", () => {
  let home: string;
  let out: string[];
  const sink = (s: string) => out.push(s);
  const text = () => out.join("\n");

  const mkHome = () => {
    home = mkdtempSync(join(tmpdir(), "lumi-audit-"));
    out = [];
  };
  const rmHome = () => rmSync(home, { recursive: true, force: true });

  it("clean input → exit 0 + grade A reassurance", async () => {
    mkHome();
    try {
      const code = await runCli(["audit"], { home, out: sink, input: "nothing dangerous here" });
      expect(code).toBe(0);
      expect(text()).toContain("A");
      // Reassuring message
      expect(text()).toMatch(/[Ll]ooks safe|[Nn]o issues|clean/i);
    } finally { rmHome(); }
  });

  it("risky input (hardcoded secret) → exit 0 + grade D or F + fix listed", async () => {
    mkHome();
    try {
      const risky = 'const apiKey = "sk-1234567890abcdef"; eval(userInput);';
      const code = await runCli(["audit"], { home, out: sink, input: risky });
      expect(code).toBe(0);
      // Grade should be D or F (danger hits present)
      expect(text()).toMatch(/Grade:\s*[DF]/);
      // Should mention "high" issues
      expect(text()).toMatch(/high/i);
      // Fix list should be present
      expect(text()).toContain("Fix these first");
    } finally { rmHome(); }
  });

  it("audit with empty input → grade A message", async () => {
    mkHome();
    try {
      const code = await runCli(["audit"], { home, out: sink, input: "" });
      expect(code).toBe(0);
      expect(text()).toContain("A");
    } finally { rmHome(); }
  });

  it("audit appears in HELP output", async () => {
    mkHome();
    try {
      const code = await runCli(["help"], { home, out: sink });
      expect(code).toBe(0);
      expect(text()).toContain("audit");
    } finally { rmHome(); }
  });
});
