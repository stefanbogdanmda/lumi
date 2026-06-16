import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditPath } from "../src/scan";

describe("auditPath", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lumi-scan-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (rel: string, content: string) => {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf8");
  };

  it("flags a risky file and grades the project F", () => {
    write("src/app.js", 'const apiKey = "sk-live-abc123secret";\nel.innerHTML = userInput;\n');
    write("src/clean.js", "export function add(a, b) { return a + b; }\n");
    const report = auditPath(root);
    expect(report.grade).toBe("F");
    expect(report.danger).toBeGreaterThanOrEqual(2);
    expect(report.files.some((f) => f.path.includes("app.js"))).toBe(true);
    // the clean file is scanned but produces no finding
    expect(report.files.some((f) => f.path.includes("clean.js"))).toBe(false);
    expect(report.filesScanned).toBeGreaterThanOrEqual(2);
    expect(report.topFixes.length).toBeGreaterThan(0);
  });

  it("returns grade A and no files for a clean project", () => {
    write("index.js", "console.log('hello world');\n");
    write("util.ts", "export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);\n");
    const report = auditPath(root);
    expect(report.grade).toBe("A");
    expect(report.total).toBe(0);
    expect(report.files).toHaveLength(0);
  });

  it("skips node_modules and other dependency/build dirs", () => {
    write("node_modules/evil/index.js", 'const apiKey = "sk-live-SHOULD-NOT-BE-SCANNED";\n');
    write("dist/bundle.js", 'const secret = "sk-live-ALSO-IGNORED-aaaaaa";\n');
    write("app.js", "export const ok = true;\n");
    const report = auditPath(root);
    expect(report.grade).toBe("A");
    expect(report.total).toBe(0);
    // app.js was scanned; the ignored dirs were not
    expect(report.filesScanned).toBe(1);
  });

  it("skips binary/non-text and oversized files", () => {
    write("photo.png", "\x89PNG\x00\x00 not really scanned");
    write("big.js", 'const k = "sk-live-toolargetoscan-aaaaaa";\n' + "x".repeat(2000));
    const report = auditPath(root, { maxBytes: 100 });
    // png skipped by extension; big.js skipped by size cap → clean
    expect(report.total).toBe(0);
    expect(report.grade).toBe("A");
  });

  it("respects maxFiles and never throws on an unreadable root", () => {
    for (let i = 0; i < 5; i++) write(`f${i}.js`, "export const x = 1;\n");
    const report = auditPath(root, { maxFiles: 2 });
    expect(report.filesScanned).toBeLessThanOrEqual(2);
    expect(() => auditPath(join(root, "does-not-exist"))).not.toThrow();
  });

  it("scans .env files (a common secret-leak source)", () => {
    write(".env", "API_SECRET=sk-live-realsecretvalue123\n");
    const report = auditPath(root);
    // .env committed/exposed is itself a flagged pattern; at minimum it is scanned
    expect(report.filesScanned).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // Regression: FIX #2 — auditPath still returns grade A / 0 files for empty dirs
  // (the CLI layer — not scan.ts — is responsible for the empty-dir message)
  // ---------------------------------------------------------------------------

  it("returns grade A and filesScanned=0 for a completely empty directory", () => {
    // root is an empty dir (nothing written yet)
    const report = auditPath(root);
    expect(report.grade).toBe("A");
    expect(report.filesScanned).toBe(0);
    expect(report.total).toBe(0);
  });
});
