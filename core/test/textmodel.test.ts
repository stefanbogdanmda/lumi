/**
 * textmodel.test.ts — unit tests for per-source text-model routing.
 *
 * These are pure tests (no spawning); they verify the bin/args mapping only.
 */

import { describe, it, expect } from "vitest";
import { resolveTextModel } from "../src/textmodel";

describe("resolveTextModel — source → { bin, buildArgs }", () => {
  it("codex → bin='codex', args=['exec', prompt]", () => {
    const m = resolveTextModel("codex");
    expect(m.bin).toBe("codex");
    expect(m.buildArgs("hello")).toEqual(["exec", "hello"]);
  });

  it("gemini → bin='gemini', args=['-p', prompt]", () => {
    const m = resolveTextModel("gemini");
    expect(m.bin).toBe("gemini");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("claude → bin='claude', args=['-p', prompt]", () => {
    const m = resolveTextModel("claude");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("claude-code → bin='claude', args=['-p', prompt]", () => {
    const m = resolveTextModel("claude-code");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("cursor → defaults to claude bin", () => {
    const m = resolveTextModel("cursor");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("copilot → defaults to claude bin", () => {
    const m = resolveTextModel("copilot");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("opencode → defaults to claude bin", () => {
    const m = resolveTextModel("opencode");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("unknown → defaults to claude bin", () => {
    const m = resolveTextModel("unknown");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("default (no source) → defaults to claude bin", () => {
    const m = resolveTextModel();
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });

  it("arbitrary unsupported source → defaults to claude bin (false-positive guard)", () => {
    const m = resolveTextModel("someRandomTool");
    expect(m.bin).toBe("claude");
    expect(m.buildArgs("hi")).toEqual(["-p", "hi"]);
  });
});
