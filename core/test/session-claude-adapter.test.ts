import { describe, it, expect } from "vitest";
import { extractClaudeEvents, type PendingToolUse } from "../src/session/claude-adapter";

function line(obj: unknown): string { return JSON.stringify(obj); }

describe("extractClaudeEvents", () => {
  it("joins a Bash tool_use to the following toolUseResult by id", () => {
    const lines = [
      line({
        type: "assistant", sessionId: "s1", cwd: "C:/proj", gitBranch: "main",
        timestamp: "2026-06-26T12:00:00.000Z",
        message: { role: "assistant", content: [
          { type: "text", text: "Running the tests." },
          { type: "tool_use", id: "tu_1", name: "Bash", input: { command: "npm test" } },
        ] },
      }),
      line({
        type: "user", sessionId: "s1", cwd: "C:/proj",
        timestamp: "2026-06-26T12:00:01.000Z",
        message: { role: "user", content: [
          { type: "tool_result", tool_use_id: "tu_1", content: "..." },
        ] },
        toolUseResult: { stdout: "2 passed", stderr: "", interrupted: false },
      }),
    ];
    const pending = new Map<string, PendingToolUse>();
    const events = extractClaudeEvents(lines, pending);

    const prose = events.find((e) => e.role === "assistant");
    expect(prose?.text).toBe("Running the tests.");

    const cmd = events.find((e) => e.command === "npm test");
    expect(cmd).toBeTruthy();
    expect(cmd?.stdout).toBe("2 passed");
    expect(cmd?.tool).toBe("claude-code");
    expect(cmd?.cwd).toBe("C:/proj");
    expect(pending.size).toBe(0); // joined and cleared
  });

  it("keeps an unmatched tool_use pending across batches", () => {
    const pending = new Map<string, PendingToolUse>();
    extractClaudeEvents([
      line({ type: "assistant", sessionId: "s1", cwd: "C:/proj", timestamp: "t",
        message: { role: "assistant", content: [
          { type: "tool_use", id: "tu_9", name: "Bash", input: { command: "ls" } },
        ] } }),
    ], pending);
    expect(pending.has("tu_9")).toBe(true);

    const events = extractClaudeEvents([
      line({ type: "user", sessionId: "s1", cwd: "C:/proj", timestamp: "t2",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_9", content: "x" }] },
        toolUseResult: { stdout: "file.txt", stderr: "" } }),
    ], pending);
    expect(events.find((e) => e.command === "ls")?.stdout).toBe("file.txt");
    expect(pending.size).toBe(0);
  });

  it("captures file_path from Read/Write tool_use", () => {
    const events = extractClaudeEvents([
      JSON.stringify({ type: "assistant", sessionId: "s1", cwd: "C:/p", timestamp: "t",
        message: { role: "assistant", content: [
          { type: "tool_use", id: "tu_2", name: "Write", input: { file_path: "C:/p/a.ts" } },
        ] } }),
    ], new Map());
    expect(events.find((e) => e.files?.includes("C:/p/a.ts"))).toBeTruthy();
  });

  it("ignores unknown/bridge line types without throwing", () => {
    const events = extractClaudeEvents([
      JSON.stringify({ type: "bridge-session", foo: 1 }),
      JSON.stringify({ type: "mode", mode: "default" }),
      "not json at all",
    ], new Map());
    expect(events).toEqual([]);
  });
});
