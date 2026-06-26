import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSessionFiles, detectActiveSessions, watchAiSessions } from "../src/session/ai-monitor";
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

describe("watchAiSessions (integration)", () => {
  it("emits a lesson event when a new turn is appended", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumi-watch-"));
    mkdirSync(join(root, "C--p"), { recursive: true });
    const file = join(root, "C--p", "s.jsonl");
    writeFileSync(file, ""); // exists at start, empty
    const lumi = new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
    const got: any[] = [];
    const stop = watchAiSessions({
      roots: [root], lumi, isEnabled: () => true, pollMs: 50,
      onEvents: (evs) => { got.push(...evs); },
    });
    try {
      appendFileSync(file, JSON.stringify({
        type: "assistant", sessionId: "s", cwd: "C:/p", timestamp: "t2",
        message: { role: "assistant", content: [
          { type: "tool_use", id: "tu", name: "Bash", input: { command: "git commit -m x" } },
        ] },
      }) + "\n");
      appendFileSync(file, JSON.stringify({
        type: "user", sessionId: "s", cwd: "C:/p", timestamp: "t3",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu", content: "done" }] },
        toolUseResult: { stdout: "1 file changed", stderr: "" },
      }) + "\n");
      await new Promise((r) => setTimeout(r, 500));
      expect(got.some((e) => e.type === "lesson")).toBe(true);
    } finally { stop(); }
  });
});
