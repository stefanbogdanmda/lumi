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

  it("falls back when string contains Output: but no Exit code header", () => {
    const r = parseCodexExecOutput("Error: Output: was null\nStack: ...");
    expect(r.exitCode).toBeUndefined();
    expect(r.stdout).toBe("Error: Output: was null\nStack: ...");
  });

  it("preserves --- lines inside the body", () => {
    const r = parseCodexExecOutput("Exit code: 0\nWall time: 1s\nOutput:\n---\nfirst\n---\nsecond\n");
    expect(r.stdout).toContain("second");
    expect(r.stdout).toContain("---");
  });

  it("returns empty stdout when Output: has no fence (truncated)", () => {
    const r = parseCodexExecOutput("Exit code: 0\nWall time: 0.5s\nOutput:\n");
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("returns empty stdout for non-string input", () => {
    expect(parseCodexExecOutput(null as unknown as string)).toEqual({ stdout: "" });
  });
});
