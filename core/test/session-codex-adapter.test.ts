import { describe, it, expect } from "vitest";
import { extractCodexEvents, makeCodexState } from "../src/session/codex-adapter";

const line = (obj: unknown): string => JSON.stringify(obj);

describe("extractCodexEvents", () => {
  it("captures session cwd from session_meta and assistant prose", () => {
    const st = makeCodexState();
    const events = extractCodexEvents([
      line({ type: "session_meta", payload: { cwd: "C:/proj", id: "sess-1" } }),
      line({ type: "response_item", timestamp: "2026-06-17T09:00:00.000Z", payload: {
        type: "message", role: "assistant", content: [{ type: "output_text", text: "I will run the tests." }],
      } }),
    ], st);
    const prose = events.find((e) => e.role === "assistant");
    expect(prose?.text).toBe("I will run the tests.");
    expect(prose?.tool).toBe("codex");
    expect(prose?.cwd).toBe("C:/proj");
  });

  it("joins a shell function_call to its function_call_output by call_id", () => {
    const st = makeCodexState();
    extractCodexEvents([
      line({ type: "session_meta", payload: { cwd: "C:/proj", id: "s" } }),
    ], st);
    const events = extractCodexEvents([
      line({ type: "response_item", timestamp: "t1", payload: {
        type: "function_call", name: "shell",
        arguments: JSON.stringify({ command: "npm test", workdir: "C:/proj/app" }),
        call_id: "call_1",
      } }),
      line({ type: "response_item", timestamp: "t2", payload: {
        type: "function_call_output", call_id: "call_1",
        output: "Exit code: 0\nWall time: 1s\nOutput:\n---\n2 passed\n",
      } }),
    ], st);
    const cmd = events.find((e) => e.command === "npm test");
    expect(cmd).toBeTruthy();
    expect(cmd?.stdout).toContain("2 passed");
    expect(cmd?.exitCode).toBe(0);
    expect(cmd?.cwd).toBe("C:/proj/app"); // workdir wins over session cwd
    expect(cmd?.tool).toBe("codex");
  });

  it("keeps an unmatched function_call pending across batches", () => {
    const st = makeCodexState();
    extractCodexEvents([
      line({ type: "response_item", timestamp: "t", payload: {
        type: "function_call", name: "shell_command",
        arguments: JSON.stringify({ command: "ls", workdir: "C:/p" }), call_id: "c9",
      } }),
    ], st);
    const events = extractCodexEvents([
      line({ type: "response_item", timestamp: "t2", payload: {
        type: "function_call_output", call_id: "c9", output: "Exit code: 0\nOutput:\n---\nfile.txt\n",
      } }),
    ], st);
    expect(events.find((e) => e.command === "ls")?.stdout).toContain("file.txt");
  });

  it("ignores reasoning/web_search/event_msg/token_count and malformed lines", () => {
    const st = makeCodexState();
    const events = extractCodexEvents([
      line({ type: "response_item", payload: { type: "reasoning" } }),
      line({ type: "response_item", payload: { type: "web_search_call" } }),
      line({ type: "event_msg", payload: { type: "agent_message", message: "dup prose" } }),
      line({ type: "event_msg", payload: { type: "token_count" } }),
      line({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "my prompt" }] } }),
      "not json",
    ], st);
    expect(events).toEqual([]); // agent_message is a duplicate; user prompt not captured
  });
});
