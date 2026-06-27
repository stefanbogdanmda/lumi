import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSessionFiles, detectActiveSessions, watchAiSessions, claudeAdapter, codexAdapter } from "../src/session/ai-monitor";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

describe("scanSessionFiles", () => {
  it("finds *.jsonl recursively under a root", () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-scan-"));
    const proj = join(root, "C--p");
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, "s1.jsonl"), "{}\n");
    writeFileSync(join(proj, "notes.txt"), "x");
    const found = scanSessionFiles([root]);
    expect(found.some((f) => f.endsWith("s1.jsonl"))).toBe(true);
    expect(found.some((f) => f.endsWith("notes.txt"))).toBe(false);
  });
});

describe("detectActiveSessions", () => {
  it("reports a session whose mtime is within the window as active", () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-detect-"));
    const proj = join(root, "C--Users-stefa-projects-Lumi");
    mkdirSync(proj, { recursive: true });
    const file = join(proj, "sess.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now), new Date(now)); // fresh
    const active = detectActiveSessions([root], 60_000, () => now + 5_000);
    expect(active.length).toBe(1);
    expect(active[0].tool).toBe("claude-code");
    expect(active[0].sessionId).toBe("sess");
  });

  it("omits a session whose mtime is older than the window", () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-detect-"));
    mkdirSync(join(root, "p"), { recursive: true });
    const file = join(root, "p", "old.jsonl");
    writeFileSync(file, "{}\n");
    const now = 1_000_000_000_000;
    utimesSync(file, new Date(now - 600_000), new Date(now - 600_000));
    const active = detectActiveSessions([root], 60_000, () => now);
    expect(active).toEqual([]);
  });
});

describe("watchAiSessions (multi-adapter integration)", () => {
  it("emits a lesson when a new Claude turn is appended", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-watch-"));
    mkdirSync(join(root, "C--p"), { recursive: true });
    const file = join(root, "C--p", "s.jsonl");
    writeFileSync(file, "");
    const lumi = new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
    const got: any[] = [];
    const stop = watchAiSessions({
      sources: [claudeAdapter([root])],
      lumi, isEnabled: () => true, pollMs: 50,
      onEvents: (evs) => { got.push(...evs); },
    });
    try {
      appendFileSync(file, JSON.stringify({
        type: "assistant", sessionId: "s", cwd: "C:/p", timestamp: "t2",
        message: { role: "assistant", content: [{ type: "tool_use", id: "tu", name: "Bash", input: { command: "git commit -m x" } }] },
      }) + "\n");
      appendFileSync(file, JSON.stringify({
        type: "user", sessionId: "s", cwd: "C:/p", timestamp: "t3",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu", content: "done" }] },
        toolUseResult: { stdout: "1 file changed", stderr: "" },
      }) + "\n");
      await new Promise((r) => setTimeout(r, 200));
      expect(got.some((e) => e.type === "lesson")).toBe(true);
    } finally { stop(); }
  });

  it("emits a lesson when a new Codex shell turn is appended", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-codex-"));
    mkdirSync(join(root, "2026", "06", "27"), { recursive: true });
    const file = join(root, "2026", "06", "27", "rollout-x.jsonl");
    writeFileSync(file, JSON.stringify({ type: "session_meta", payload: { cwd: "C:/p", id: "s" } }) + "\n");
    const lumi = new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
    const got: any[] = [];
    const stop = watchAiSessions({
      sources: [codexAdapter([root])],
      lumi, isEnabled: () => true, pollMs: 50,
      onEvents: (evs) => { got.push(...evs); },
    });
    try {
      appendFileSync(file, JSON.stringify({ type: "response_item", timestamp: "t1", payload: {
        type: "function_call", name: "shell", arguments: JSON.stringify({ command: "git commit -m y", workdir: "C:/p" }), call_id: "c1",
      } }) + "\n");
      appendFileSync(file, JSON.stringify({ type: "response_item", timestamp: "t2", payload: {
        type: "function_call_output", call_id: "c1", output: "Exit code: 0\nOutput:\n---\n1 file changed\n",
      } }) + "\n");
      await new Promise((r) => setTimeout(r, 200));
      expect(got.some((e) => e.type === "lesson")).toBe(true);
    } finally { stop(); }
  });

  it("emits lessons from both Claude and Codex sources in one watcher", async () => {
    const claudeRoot = mkdtempSync(join(tmpdir(), "lumi-both-cl-"));
    const codexRoot = mkdtempSync(join(tmpdir(), "lumi-both-cx-"));
    mkdirSync(join(claudeRoot, "C--p"), { recursive: true });
    mkdirSync(join(codexRoot, "2026", "06", "27"), { recursive: true });
    const cFile = join(claudeRoot, "C--p", "s.jsonl");
    const xFile = join(codexRoot, "2026", "06", "27", "rollout-x.jsonl");
    writeFileSync(cFile, "");
    writeFileSync(xFile, JSON.stringify({ type: "session_meta", payload: { cwd: "C:/p", id: "s" } }) + "\n");
    const lumi = new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
    const got: any[] = [];
    const stop = watchAiSessions({
      sources: [claudeAdapter([claudeRoot]), codexAdapter([codexRoot])],
      lumi, isEnabled: () => true, pollMs: 50,
      onEvents: (evs) => { got.push(...evs); },
    });
    try {
      appendFileSync(cFile, JSON.stringify({ type: "assistant", sessionId: "s", cwd: "C:/p", timestamp: "t2",
        message: { role: "assistant", content: [{ type: "tool_use", id: "tu", name: "Bash", input: { command: "git commit -m x" } }] } }) + "\n");
      appendFileSync(cFile, JSON.stringify({ type: "user", sessionId: "s", cwd: "C:/p", timestamp: "t3",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu", content: "done" }] },
        toolUseResult: { stdout: "1 file changed", stderr: "" } }) + "\n");
      // Use a DIFFERENT concept for Codex (npm install vs git commit): a single drain
      // teaches a concept and marks it learned, so two sources sharing one concept would
      // dedupe and the second source would emit nothing. Distinct concepts prove BOTH fire.
      appendFileSync(xFile, JSON.stringify({ type: "response_item", timestamp: "t1", payload: {
        type: "function_call", name: "shell", arguments: JSON.stringify({ command: "npm install", workdir: "C:/p" }), call_id: "c1" } }) + "\n");
      appendFileSync(xFile, JSON.stringify({ type: "response_item", timestamp: "t2", payload: {
        type: "function_call_output", call_id: "c1", output: "Exit code: 0\nOutput:\n---\nadded 1 package\n" } }) + "\n");
      await new Promise((r) => setTimeout(r, 250));
      expect(got.some((e) => e.source === "claude-code")).toBe(true);
      expect(got.some((e) => e.source === "codex")).toBe(true);
    } finally { stop(); }
  });

  it("does no capture while isEnabled() is false", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-disabled-"));
    mkdirSync(join(root, "C--p"), { recursive: true });
    const file = join(root, "C--p", "s.jsonl");
    writeFileSync(file, "");
    const lumi = new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
    const got: any[] = [];
    const stop = watchAiSessions({
      sources: [claudeAdapter([root])],
      lumi, isEnabled: () => false, pollMs: 50,
      onEvents: (evs) => { got.push(...evs); },
    });
    try {
      appendFileSync(file, JSON.stringify({ type: "assistant", sessionId: "s", cwd: "C:/p", timestamp: "t2",
        message: { role: "assistant", content: [{ type: "tool_use", id: "tu", name: "Bash", input: { command: "git commit -m x" } }] } }) + "\n");
      appendFileSync(file, JSON.stringify({ type: "user", sessionId: "s", cwd: "C:/p", timestamp: "t3",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu", content: "done" }] },
        toolUseResult: { stdout: "1 file changed" } }) + "\n");
      await new Promise((r) => setTimeout(r, 200));
      expect(got).toEqual([]);
    } finally { stop(); }
  });
});
