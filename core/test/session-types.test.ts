import { describe, it, expect } from "vitest";
import type { SessionEvent } from "../src/session/types";

describe("SessionEvent", () => {
  it("accepts a fully-populated command event", () => {
    const e: SessionEvent = {
      tool: "claude-code",
      sessionId: "s1",
      cwd: "C:/proj",
      ts: "2026-06-26T12:00:00.000Z",
      role: "user",
      command: "npm test",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      files: ["a.ts"],
    };
    expect(e.tool).toBe("claude-code");
  });

  it("accepts a minimal assistant-prose event", () => {
    const e: SessionEvent = {
      tool: "claude-code",
      sessionId: "s1",
      cwd: "C:/proj",
      ts: "2026-06-26T12:00:00.000Z",
      role: "assistant",
      text: "I added authentication.",
    };
    expect(e.role).toBe("assistant");
  });
});
