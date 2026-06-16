import { describe, it, expect } from "vitest";
import { generatorForSource } from "../src/cli";
import {
  FallbackGenerator,
  ClaudeCliGenerator,
  CodexCliGenerator,
  GeminiCliGenerator,
  MockGenerator,
} from "../src/generator";

describe("generatorForSource", () => {
  it("returns a FallbackGenerator for any source", () => {
    expect(generatorForSource("codex")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("gemini")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("claude-code")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("claude")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("cursor")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("copilot")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("opencode")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("generic")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("unknown")).toBeInstanceOf(FallbackGenerator);
    expect(generatorForSource("anything")).toBeInstanceOf(FallbackGenerator);
  });

  it("CodexCliGenerator has bin===codex", () => {
    const g = new CodexCliGenerator();
    expect(g.bin).toBe("codex");
  });

  it("GeminiCliGenerator has bin===gemini", () => {
    const g = new GeminiCliGenerator();
    expect(g.bin).toBe("gemini");
  });

  it("ClaudeCliGenerator has bin===claude", () => {
    const g = new ClaudeCliGenerator();
    expect(g.bin).toBe("claude");
  });

  it("generatorForSource(codex) wraps a CodexCliGenerator primary (inspected via primary field)", () => {
    const g = generatorForSource("codex") as any;
    // FallbackGenerator stores primary; check it has codex bin
    expect(g.primary).toBeInstanceOf(CodexCliGenerator);
    expect(g.primary.bin).toBe("codex");
  });

  it("generatorForSource(gemini) wraps a GeminiCliGenerator primary", () => {
    const g = generatorForSource("gemini") as any;
    expect(g.primary).toBeInstanceOf(GeminiCliGenerator);
    expect(g.primary.bin).toBe("gemini");
  });

  it("generatorForSource(claude-code) wraps a ClaudeCliGenerator primary", () => {
    const g = generatorForSource("claude-code") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
    expect(g.primary.bin).toBe("claude");
  });

  it("generatorForSource(claude) wraps a ClaudeCliGenerator primary", () => {
    const g = generatorForSource("claude") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
    expect(g.primary.bin).toBe("claude");
  });

  it("generatorForSource(cursor) defaults to ClaudeCliGenerator primary", () => {
    const g = generatorForSource("cursor") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
    expect(g.primary.bin).toBe("claude");
  });

  it("generatorForSource(copilot) defaults to ClaudeCliGenerator primary", () => {
    const g = generatorForSource("copilot") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
  });

  it("generatorForSource(opencode) defaults to ClaudeCliGenerator primary", () => {
    const g = generatorForSource("opencode") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
  });

  it("generatorForSource(generic) defaults to ClaudeCliGenerator primary", () => {
    const g = generatorForSource("generic") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
  });

  it("generatorForSource(anything-unknown) defaults to ClaudeCliGenerator primary", () => {
    const g = generatorForSource("anything-unknown") as any;
    expect(g.primary).toBeInstanceOf(ClaudeCliGenerator);
  });

  it("all sources have a MockGenerator as the fallback", () => {
    for (const src of ["codex", "gemini", "claude-code", "claude", "cursor", "copilot", "unknown"]) {
      const g = generatorForSource(src) as any;
      expect(g.fallback).toBeInstanceOf(MockGenerator);
    }
  });
});
