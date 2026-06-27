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
});
