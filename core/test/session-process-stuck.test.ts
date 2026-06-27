import { describe, it, expect } from "vitest";
import { processSessionEvents } from "../src/session/process";
import type { SessionEvent } from "../src/session/types";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

function newLumi() {
  return new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
}

const stuckText =
  "TypeError: cannot read x\nlet me try again\nTypeError: cannot read x\nstill failing\nlet me try again";

describe("processSessionEvents — fix-loop card", () => {
  it("emits a stuck event when the captured text shows a fix-loop", async () => {
    const feed = await processSessionEvents(
      [{ tool: "claude-code", sessionId: "s", cwd: "C:/p", ts: "t", role: "assistant", text: stuckText }],
      newLumi(), "claude-code", {},
    );
    expect(feed.some((e) => e.type === "stuck")).toBe(true);
  });

  it("does not re-emit the same stuck signature when a seen-set is provided", async () => {
    const seen = new Set<string>();
    const ev: SessionEvent[] = [{ tool: "claude-code", sessionId: "s", cwd: "C:/p", ts: "t", role: "assistant", text: stuckText }];
    const first = await processSessionEvents(ev, newLumi(), "claude-code", { stuckSeen: seen });
    const second = await processSessionEvents(ev, newLumi(), "claude-code", { stuckSeen: seen });
    expect(first.some((e) => e.type === "stuck")).toBe(true);
    expect(second.some((e) => e.type === "stuck")).toBe(false);
  });

  it("emits a stuck card for a different error signature even when one is already in seen-set", async () => {
    const seen = new Set<string>();
    const error1 = "TypeError: cannot read x\nlet me try again\nTypeError: cannot read x\nstill failing\nlet me try again";
    const error2 = "ReferenceError: y is not defined\nlet me try again\nReferenceError: y is not defined\nstill failing\nlet me try again";
    const base = { tool: "claude-code", sessionId: "s", cwd: "C:/p", ts: "t", role: "assistant" } as const;
    await processSessionEvents([{ ...base, text: error1 }], newLumi(), "claude-code", { stuckSeen: seen });
    const feed = await processSessionEvents([{ ...base, text: error2 }], newLumi(), "claude-code", { stuckSeen: seen });
    expect(feed.some((e) => e.type === "stuck")).toBe(true);
  });

  it("emits no stuck event for ordinary text", async () => {
    const feed = await processSessionEvents(
      [{ tool: "claude-code", sessionId: "s", cwd: "C:/p", ts: "t", role: "assistant", text: "All tests pass." }],
      newLumi(), "claude-code", {},
    );
    expect(feed.some((e) => e.type === "stuck")).toBe(false);
  });
});
