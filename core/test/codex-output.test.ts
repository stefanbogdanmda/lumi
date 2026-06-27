import { describe, it, expect } from "vitest";
import { parseCodexExecOutput } from "../src/session/codex-output";

describe("parseCodexExecOutput", () => {
  it("extracts exit code and stdout from the standard format", () => {
    const out = "Exit code: 0\nWall time: 1.1 seconds\nOutput:\n---\r\n2 passed\r\nall good\r\n";
    const r = parseCodexExecOutput(out);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("2 passed");
    expect(r.stdout).toContain("all good");
  });

  it("captures a non-zero exit code", () => {
    const r = parseCodexExecOutput("Exit code: 1\nWall time: 0.2 seconds\nOutput:\n---\nboom\n");
    expect(r.exitCode).toBe(1);
    expect(r.stdout.trim()).toBe("boom");
  });

  it("falls back to treating the whole string as stdout when unstructured", () => {
    const r = parseCodexExecOutput("just some text without markers");
    expect(r.exitCode).toBeUndefined();
    expect(r.stdout).toBe("just some text without markers");
  });
});
