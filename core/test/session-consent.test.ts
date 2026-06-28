import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAiCaptureEnabled } from "../src/session/consent";

function home(contents?: object): string {
  const dir = mkdtempSync(join(tmpdir(), "lumi-consent-"));
  if (contents) writeFileSync(join(dir, "consent.json"), JSON.stringify(contents));
  return dir;
}

describe("isAiCaptureEnabled", () => {
  it("defaults to false when no consent file exists", () => {
    expect(isAiCaptureEnabled(home())).toBe(false);
  });

  it("returns true only when aiSessions is explicitly enabled", () => {
    expect(isAiCaptureEnabled(home({ aiSessions: true }))).toBe(true);
    expect(isAiCaptureEnabled(home({ aiSessions: false }))).toBe(false);
  });

  it("is forced off by LUMI_NO_CAPTURE regardless of consent file", () => {
    const h = home({ aiSessions: true });
    process.env.LUMI_NO_CAPTURE = "1";
    try { expect(isAiCaptureEnabled(h)).toBe(false); }
    finally { delete process.env.LUMI_NO_CAPTURE; }
  });
});
