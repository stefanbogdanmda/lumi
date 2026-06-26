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

describe("processSessionEvents", () => {
  it("emits lesson events for new concepts and marks them learned", async () => {
    const lumi = newLumi();
    const events: SessionEvent[] = [
      { tool: "claude-code", sessionId: "s1", cwd: "C:/p", ts: "t", role: "user",
        command: "git commit -m wip", exitCode: 0, stdout: "1 file changed" },
    ];
    const feed = await processSessionEvents(events, lumi, "claude-code");
    expect(feed.length).toBeGreaterThan(0);
    expect(feed[0].source).toBe("claude-code");
    expect(feed[0].type).toBe("lesson");
  });

  it("drops a record whose command is sensitive (no events, nothing learned)", async () => {
    const lumi = newLumi();
    const events: SessionEvent[] = [
      { tool: "claude-code", sessionId: "s1", cwd: "C:/p", ts: "t", role: "user",
        command: "cat .env", exitCode: 0, stdout: "API_KEY=zzz" },
    ];
    const feed = await processSessionEvents(events, lumi, "claude-code");
    expect(feed).toEqual([]);
  });

  it("redacts secrets in stdout before they reach the feed", async () => {
    const lumi = newLumi();
    const secret = "ghp_" + "a".repeat(36);
    const events: SessionEvent[] = [
      { tool: "claude-code", sessionId: "s1", cwd: "C:/p", ts: "t", role: "assistant",
        text: "Here is the token " + secret + " for the API key." },
    ];
    const feed = await processSessionEvents(events, lumi, "claude-code");
    expect(JSON.stringify(feed)).not.toContain(secret);
  });

  it("honors LUMI_NO_CAPTURE", async () => {
    const lumi = newLumi();
    process.env.LUMI_NO_CAPTURE = "1";
    try {
      const feed = await processSessionEvents(
        [{ tool: "claude-code", sessionId: "s", cwd: "C:/p", ts: "t", role: "user", command: "git push" }],
        lumi, "claude-code",
      );
      expect(feed).toEqual([]);
    } finally {
      delete process.env.LUMI_NO_CAPTURE;
    }
  });
});
