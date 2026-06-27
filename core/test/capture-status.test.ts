import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureStatus } from "../src/capture-status";

function homeWith(consent: object | null): string {
  const dir = mkdtempSync(join(tmpdir(), "lumi-cs-"));
  if (consent) writeFileSync(join(dir, "consent.json"), JSON.stringify(consent));
  return dir;
}

describe("captureStatus", () => {
  it("reports recording=false when consent is disabled", () => {
    const s = captureStatus(homeWith(null), [], () => 0);
    expect(s.recording).toBe(false);
  });

  it("reports recording=true with the active tool/project when enabled and a session is fresh", () => {
    const home = homeWith({ enabled: true });
    const root = mkdtempSync(join(tmpdir(), "lumi-cs-root-"));
    mkdirSync(join(root, "C--proj"), { recursive: true });
    const file = join(root, "C--proj", "s.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now), new Date(now));
    const s = captureStatus(home, [{ tool: "claude-code", roots: [root] }], () => now + 1000);
    expect(s.recording).toBe(true);
    expect(s.tool).toBe("claude-code");
    expect(s.project).toBe("C--proj");
    expect(s.scopes).toEqual({ commands: true, output: true, aiText: true });
  });

  it("reports recording=false when enabled but no session is fresh", () => {
    const home = homeWith({ enabled: true });
    const root = mkdtempSync(join(tmpdir(), "lumi-cs-root-"));
    mkdirSync(join(root, "p"), { recursive: true });
    const file = join(root, "p", "s.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now - 600_000), new Date(now - 600_000));
    const s = captureStatus(home, [{ tool: "claude-code", roots: [root] }], () => now);
    expect(s.recording).toBe(false);
  });

  it("reports recording=false when the tool is explicitly disabled in consent", () => {
    const home = homeWith({ enabled: true, tools: { "claude-code": false } });
    const root = mkdtempSync(join(tmpdir(), "lumi-cs-root-"));
    mkdirSync(join(root, "p"), { recursive: true });
    const file = join(root, "p", "s.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now), new Date(now));
    const s = captureStatus(home, [{ tool: "claude-code", roots: [root] }], () => now + 1000);
    expect(s.recording).toBe(false);
  });

  it("reports recording=false in allowlist mode (cannot verify project from slug)", () => {
    const home = homeWith({ enabled: true, projects: { mode: "allowlist", allow: ["C:/proj"] } });
    const root = mkdtempSync(join(tmpdir(), "lumi-cs-root-"));
    mkdirSync(join(root, "C--proj"), { recursive: true });
    const file = join(root, "C--proj", "s.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now), new Date(now));
    const s = captureStatus(home, [{ tool: "claude-code", roots: [root] }], () => now + 1000);
    expect(s.recording).toBe(false);
  });

  it("reports recording=false when LUMI_NO_CAPTURE is set", () => {
    const home = homeWith({ enabled: true });
    process.env.LUMI_NO_CAPTURE = "1";
    try {
      const s = captureStatus(home, [], () => 0);
      expect(s.recording).toBe(false);
    } finally { delete process.env.LUMI_NO_CAPTURE; }
  });

  it("picks the most-recently-active source across tools", () => {
    const home = homeWith({ enabled: true });
    const r1 = mkdtempSync(join(tmpdir(), "lumi-cs-a-"));
    const r2 = mkdtempSync(join(tmpdir(), "lumi-cs-b-"));
    mkdirSync(join(r1, "C--old"), { recursive: true });
    mkdirSync(join(r2, "C--new"), { recursive: true });
    const f1 = join(r1, "C--old", "s.jsonl"); writeFileSync(f1, "{}\n");
    const f2 = join(r2, "C--new", "s.jsonl"); writeFileSync(f2, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(f1, new Date(now - 30_000), new Date(now - 30_000));
    utimesSync(f2, new Date(now - 5_000), new Date(now - 5_000));
    const s = captureStatus(home, [
      { tool: "claude-code", roots: [r1] },
      { tool: "codex", roots: [r2] },
    ], () => now);
    expect(s.recording).toBe(true);
    expect(s.tool).toBe("codex");
    expect(s.project).toBe("C--new");
  });
});
