import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; });

function fullTurn(): string {
  // one assistant Bash tool_use + its user toolUseResult (a git commit turn)
  return (
    JSON.stringify({ type: "assistant", sessionId: "s", cwd: "C:/p", timestamp: "t1",
      message: { role: "assistant", content: [
        { type: "tool_use", id: "tu1", name: "Bash", input: { command: "git commit -m wip" } },
      ] } }) + "\n" +
    JSON.stringify({ type: "user", sessionId: "s", cwd: "C:/p", timestamp: "t2",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
      toolUseResult: { stdout: "1 file changed", stderr: "" } }) + "\n"
  );
}

describe("createOverlayServer AI monitor wiring", () => {
  it("does NOT capture AI sessions when consent is absent (default OFF)", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-home-"));
    const claudeRoot = mkdtempSync(join(tmpdir(), "lumi-claude-"));
    mkdirSync(join(claudeRoot, "C--p"), { recursive: true });
    const sessionFile = join(claudeRoot, "C--p", "s.jsonl");
    writeFileSync(sessionFile, "");
    const server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, claudeRoots: [claudeRoot] });
    stop = () => server.close();
    appendFileSync(sessionFile, fullTurn()); // a real turn, but consent is OFF
    await new Promise((r) => setTimeout(r, 250));
    const feed = join(home, "feed.jsonl");
    const lines = existsSync(feed) ? readFileSync(feed, "utf8").trim() : "";
    expect(lines).toBe(""); // nothing captured without consent
  });

  it("captures AI sessions into the feed when consent is granted", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-home-"));
    writeFileSync(join(home, "consent.json"), JSON.stringify({ aiSessions: true }));
    const claudeRoot = mkdtempSync(join(tmpdir(), "lumi-claude-"));
    mkdirSync(join(claudeRoot, "C--p"), { recursive: true });
    const sessionFile = join(claudeRoot, "C--p", "s.jsonl");
    writeFileSync(sessionFile, ""); // exists empty at start
    const server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, claudeRoots: [claudeRoot] });
    stop = () => server.close();
    appendFileSync(sessionFile, fullTurn());
    await new Promise((r) => setTimeout(r, 400));
    const feed = join(home, "feed.jsonl");
    const text = existsSync(feed) ? readFileSync(feed, "utf8") : "";
    expect(text).toContain("\"type\":\"lesson\"");
    expect(text).toContain("\"source\":\"claude-code\"");
  });
});
