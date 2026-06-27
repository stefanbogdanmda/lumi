import { describe, it, expect } from "vitest";
import { applyConsent } from "../src/session/process";
import type { SessionEvent } from "../src/session/types";
import type { ConsentConfig } from "../src/session/consent-config";

const ev = (over: Partial<SessionEvent>): SessionEvent => ({
  tool: "claude-code", sessionId: "s", cwd: "C:/work/app", ts: "t", role: "user", ...over,
});

const cfg = (over: Partial<ConsentConfig>): ConsentConfig => ({
  enabled: true, tools: {}, projects: { mode: "all", allow: [] },
  scopes: { commands: true, output: true, aiText: true }, ...over,
});

describe("applyConsent", () => {
  it("drops events from a disabled tool", () => {
    const out = applyConsent([ev({ command: "git status" })], cfg({ tools: { "claude-code": false } }));
    expect(out).toEqual([]);
  });

  it("drops events outside the project allowlist", () => {
    const out = applyConsent(
      [ev({ cwd: "C:/other", command: "git status" })],
      cfg({ projects: { mode: "allowlist", allow: ["C:/work"] } }),
    );
    expect(out).toEqual([]);
  });

  it("strips the command/output fields when those scopes are off", () => {
    const out = applyConsent(
      [ev({ command: "git push", stdout: "done", stderr: "warn" })],
      cfg({ scopes: { commands: false, output: false, aiText: true } }),
    );
    expect(out).toEqual([]); // nothing left → event dropped
  });

  it("keeps ai-text when aiText scope is on but commands off", () => {
    const out = applyConsent(
      [ev({ role: "assistant", text: "I refactored auth", command: "git push" })],
      cfg({ scopes: { commands: false, output: true, aiText: true } }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("I refactored auth");
    expect(out[0].command).toBeUndefined();
  });

  it("keeps output but strips command when only output scope is on", () => {
    const out = applyConsent(
      [ev({ command: "npm test", stdout: "2 passed" })],
      cfg({ scopes: { commands: false, output: true, aiText: false } }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].command).toBeUndefined();
    expect(out[0].stdout).toBe("2 passed");
  });
});
