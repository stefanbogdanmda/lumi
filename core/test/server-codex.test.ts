import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let server: ReturnType<typeof createOverlayServer> | undefined;
afterEach(() => { server?.close(); server = undefined; });

describe("server Codex capture", () => {
  it("teaches from a Codex shell turn when consent is enabled", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-cx-home-"));
    writeFileSync(join(home, "consent.json"), JSON.stringify({ enabled: true }));
    const codexRoot = mkdtempSync(join(tmpdir(), "lumi-cx-root-"));
    mkdirSync(join(codexRoot, "2026", "06", "27"), { recursive: true });
    const file = join(codexRoot, "2026", "06", "27", "rollout-x.jsonl");
    writeFileSync(file, JSON.stringify({ type: "session_meta", payload: { cwd: "C:/p", id: "s" } }) + "\n");

    server = createOverlayServer({
      home, generator: new MockGenerator(), pollMs: 50,
      claudeRoots: [], codexRoots: [codexRoot],
    });
    await new Promise((r) => setTimeout(r, 80));
    appendFileSync(file, JSON.stringify({ type: "response_item", timestamp: "t1", payload: {
      type: "function_call", name: "shell", arguments: JSON.stringify({ command: "git commit -m z", workdir: "C:/p" }), call_id: "c1",
    } }) + "\n");
    appendFileSync(file, JSON.stringify({ type: "response_item", timestamp: "t2", payload: {
      type: "function_call_output", call_id: "c1", output: "Exit code: 0\nOutput:\n---\n1 file changed\n",
    } }) + "\n");
    await new Promise((r) => setTimeout(r, 200));

    const feed = join(home, "feed.jsonl");
    const text = existsSync(feed) ? readFileSync(feed, "utf8") : "";
    expect(text).toContain("\"source\":\"codex\"");
  });
});
