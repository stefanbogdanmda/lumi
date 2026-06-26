import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli, startWatch } from "../src/cli";
import { MockGenerator } from "../src/generator";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("lumi term", () => {
  let home: string;
  let out: string[];
  const sink = (s: string) => out.push(s);

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lumi-cliterm-"));
    out = [];
  });
  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it("processes a --json record and writes events to feed.jsonl", async () => {
    const json = JSON.stringify({ v: 1, ts: "2026-06-26T00:00:00Z", command: "git commit -m wip" });
    const code = await runCli(["term", "--json", json], { home, out: sink, generator: new MockGenerator() });
    expect(code).toBe(0);
    const feed = join(home, "feed.jsonl");
    expect(existsSync(feed)).toBe(true);
    const lines = readFileSync(feed, "utf8").split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const concepts = lines.map((l) => JSON.parse(l).concept);
    expect(concepts).toContain("git-commit");
  });

  it("reads a record from stdin (deps.input) and flags a failed command", async () => {
    const json = JSON.stringify({ v: 1, ts: "x", command: "npm test", exitCode: 1 });
    const code = await runCli(["term"], { home, out: sink, input: json, generator: new MockGenerator() });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("⚠ command failed");
    const lines = readFileSync(join(home, "feed.jsonl"), "utf8").split("\n").filter(Boolean);
    expect(lines.some((l) => JSON.parse(l).type === "terminal")).toBe(true);
  });

  it("redacts secrets before writing to the feed", async () => {
    const json = JSON.stringify({
      v: 1,
      ts: "x",
      command: "curl -H 'Authorization: Bearer aBcDeF0123456789ghIJklmnopqrstuvwxyz' https://api.x",
    });
    await runCli(["term", "--json", json], { home, out: sink, generator: new MockGenerator() });
    const feed = existsSync(join(home, "feed.jsonl")) ? readFileSync(join(home, "feed.jsonl"), "utf8") : "";
    expect(feed).not.toContain("aBcDeF0123456789ghIJklmnopqrstuvwxyz");
  });

  it("returns 1 for an invalid record", async () => {
    const code = await runCli(["term", "--json", "not json"], { home, out: sink, generator: new MockGenerator() });
    expect(code).toBe(1);
  });
});

describe("startWatch", () => {
  let home: string;
  let out: string[];
  const sink = (s: string) => out.push(s);
  let stop: (() => void) | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lumi-cliwatch-"));
    out = [];
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    rmSync(home, { recursive: true, force: true });
  });

  it("tails terminal.jsonl and appends lesson events to feed.jsonl", async () => {
    stop = startWatch({ home, generator: new MockGenerator(), pollMs: 30 }, sink);
    await delay(60);
    const termFile = join(home, "terminal.jsonl");
    appendFileSync(termFile, JSON.stringify({ v: 1, ts: "x", command: "git push origin main" }) + "\n");
    const feed = join(home, "feed.jsonl");
    for (let i = 0; i < 50 && !existsSync(feed); i++) await delay(30);
    const lines = readFileSync(feed, "utf8").split("\n").filter(Boolean);
    expect(lines.map((l) => JSON.parse(l).concept)).toContain("git-push");
  });
});
