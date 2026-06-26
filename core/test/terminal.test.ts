import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseTerminalRecord,
  processTerminalRecord,
  watchTerminalFile,
  TerminalRecord,
} from "../src/terminal";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

function makeLumi() {
  return new Lumi({
    profile: new InMemoryProfile(),
    generator: new MockGenerator(),
    cache: new InMemoryCache(),
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("parseTerminalRecord", () => {
  it("parses a valid record with all fields", () => {
    const line = JSON.stringify({
      v: 1,
      ts: "2026-06-26T00:00:00.000Z",
      cwd: "/home/u/app",
      shell: "bash",
      command: "npm test",
      exitCode: 1,
      durationMs: 4210,
      output: "1 failing",
    });
    const rec = parseTerminalRecord(line);
    expect(rec).not.toBeNull();
    expect(rec?.command).toBe("npm test");
    expect(rec?.exitCode).toBe(1);
    expect(rec?.cwd).toBe("/home/u/app");
  });

  it("parses a minimal record (only required fields)", () => {
    const rec = parseTerminalRecord(JSON.stringify({ v: 1, ts: "2026-06-26T00:00:00Z", command: "git status" }));
    expect(rec?.command).toBe("git status");
    expect(rec?.exitCode).toBeUndefined();
  });

  it("returns null for malformed JSON", () => {
    expect(parseTerminalRecord("not json")).toBeNull();
    expect(parseTerminalRecord("")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseTerminalRecord(JSON.stringify({ ts: "x", command: "ls" }))).toBeNull(); // no v
    expect(parseTerminalRecord(JSON.stringify({ v: 1, command: "ls" }))).toBeNull(); // no ts
    expect(parseTerminalRecord(JSON.stringify({ v: 1, ts: "x" }))).toBeNull(); // no command
    expect(parseTerminalRecord(JSON.stringify({ v: 1, ts: "x", command: "" }))).toBeNull(); // empty command
  });

  it("preserves exitCode null distinctly from absent", () => {
    const rec = parseTerminalRecord(JSON.stringify({ v: 1, ts: "x", command: "ls", exitCode: null }));
    expect(rec?.exitCode).toBeNull();
  });
});

describe("processTerminalRecord — concept detection", () => {
  it("detects a concept from a command-only record", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = { v: 1, ts: "x", command: "git commit -m wip" };
    const events = await processTerminalRecord(rec, lumi);
    const concepts = events.map((e) => e.concept);
    expect(concepts).toContain("git-commit");
    expect(events.every((e) => e.source === "terminal")).toBe(true);
  });

  it("does not re-teach a concept already learned (marks learned)", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = { v: 1, ts: "x", command: "git commit -m a" };
    await processTerminalRecord(rec, lumi);
    const again = await processTerminalRecord({ v: 1, ts: "y", command: "git commit -m b" }, lumi);
    expect(again.filter((e) => e.type === "lesson").map((e) => e.concept)).not.toContain("git-commit");
  });
});

describe("processTerminalRecord — redaction before detection", () => {
  it("redacts secrets in the command before writing any event", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = {
      v: 1,
      ts: "x",
      command: "curl -H 'Authorization: Bearer aBcDeF0123456789ghIJklmnopqrstuvwxyz' https://api.x",
    };
    const events = await processTerminalRecord(rec, lumi);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("aBcDeF0123456789ghIJklmnopqrstuvwxyz");
  });

  it("redacts secrets in output before writing any event", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = {
      v: 1,
      ts: "x",
      command: "npm test",
      exitCode: 1,
      output: "leaked OPENAI=sk-abcdEFGH1234567890abcdEFGH1234567890abcdEFGH",
    };
    const events = await processTerminalRecord(rec, lumi);
    expect(JSON.stringify(events)).not.toContain("sk-abcdEFGH1234567890");
  });
});

describe("processTerminalRecord — failure flagging", () => {
  it("emits a terminal failure event when exitCode is non-zero", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = { v: 1, ts: "x", command: "npm test", exitCode: 1, cwd: "/app" };
    const events = await processTerminalRecord(rec, lumi);
    const fail = events.find((e) => e.type === "terminal");
    expect(fail).toBeDefined();
    expect(fail?.command?.failed).toBe(true);
    expect(fail?.command?.exitCode).toBe(1);
    expect(fail?.command?.cwd).toBe("/app");
    expect(fail?.command?.line).toContain("npm test");
  });

  it("does NOT emit a failure event when exitCode is 0", async () => {
    const lumi = makeLumi();
    const rec: TerminalRecord = { v: 1, ts: "x", command: "git commit -m ok", exitCode: 0 };
    const events = await processTerminalRecord(rec, lumi);
    expect(events.find((e) => e.type === "terminal")).toBeUndefined();
  });

  it("does NOT emit a failure event when exitCode is null/absent", async () => {
    const lumi = makeLumi();
    const evNull = await processTerminalRecord({ v: 1, ts: "x", command: "git commit -m ok", exitCode: null }, lumi);
    expect(evNull.find((e) => e.type === "terminal")).toBeUndefined();
    const lumi2 = makeLumi();
    const evAbsent = await processTerminalRecord({ v: 1, ts: "x", command: "git status" }, lumi2);
    expect(evAbsent.find((e) => e.type === "terminal")).toBeUndefined();
  });

  it("failure event carries a teaching lesson payload", async () => {
    const lumi = makeLumi();
    const events = await processTerminalRecord({ v: 1, ts: "x", command: "docker build .", exitCode: 2 }, lumi);
    const fail = events.find((e) => e.type === "terminal");
    expect(fail?.lesson?.title).toBeTruthy();
    expect(fail?.lesson?.plainExplanation).toBeTruthy();
  });
});

describe("watchTerminalFile", () => {
  let dir: string;
  let file: string;
  let close: (() => void) | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lumi-term-"));
    file = join(dir, "terminal.jsonl");
  });

  afterEach(() => {
    close?.();
    close = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates the file if it does not exist and processes appended records", async () => {
    const seen: TerminalRecord[] = [];
    close = watchTerminalFile(file, (r) => { seen.push(r); }, { pollMs: 30 });
    await delay(60);
    appendFileSync(file, JSON.stringify({ v: 1, ts: "x", command: "npm test" }) + "\n");
    // poll for up to ~1s
    for (let i = 0; i < 40 && seen.length === 0; i++) await delay(30);
    expect(seen.map((r) => r.command)).toContain("npm test");
  });

  it("ignores malformed lines and only dispatches valid records", async () => {
    const seen: TerminalRecord[] = [];
    close = watchTerminalFile(file, (r) => { seen.push(r); }, { pollMs: 30 });
    await delay(60);
    appendFileSync(file, "garbage line\n");
    appendFileSync(file, JSON.stringify({ v: 1, ts: "x", command: "git push" }) + "\n");
    for (let i = 0; i < 40 && seen.length === 0; i++) await delay(30);
    expect(seen).toHaveLength(1);
    expect(seen[0].command).toBe("git push");
  });

  it("processes a burst of same-concept records into exactly ONE lesson (no race)", async () => {
    // Shared Lumi across the burst: the sequential drain must mark the concept
    // learned after the first record so the next two are deduped.
    const lumi = makeLumi();
    const lessonConcepts: string[] = [];
    close = watchTerminalFile(
      file,
      async (rec) => {
        const events = await processTerminalRecord(rec, lumi);
        for (const e of events) if (e.type === "lesson" && e.concept) lessonConcepts.push(e.concept);
      },
      { pollMs: 30 },
    );
    await delay(60);
    // Append three identical-concept commands as one burst (single drain).
    const line = JSON.stringify({ v: 1, ts: "x", command: "git commit -m wip" }) + "\n";
    appendFileSync(file, line + line + line);
    for (let i = 0; i < 60 && lessonConcepts.filter((c) => c === "git-commit").length === 0; i++) await delay(30);
    await delay(120); // let any erroneous extra dispatches settle
    expect(lessonConcepts.filter((c) => c === "git-commit")).toHaveLength(1);
  });

  it("resyncs to 0 when the file is truncated below the current offset", async () => {
    const seen: TerminalRecord[] = [];
    close = watchTerminalFile(file, (r) => { seen.push(r); }, { pollMs: 30 });
    await delay(60);
    appendFileSync(file, JSON.stringify({ v: 1, ts: "x", command: "first cmd here long" }) + "\n");
    for (let i = 0; i < 40 && seen.length === 0; i++) await delay(30);
    expect(seen.map((r) => r.command)).toContain("first cmd here long");
    // Truncate to a SHORTER content (size now below the previous offset).
    writeFileSync(file, JSON.stringify({ v: 1, ts: "y", command: "x" }) + "\n");
    for (let i = 0; i < 40 && seen.length < 2; i++) await delay(30);
    expect(seen.map((r) => r.command)).toContain("x");
  });

  it("stops dispatching after the stop function is called", async () => {
    const seen: TerminalRecord[] = [];
    const stop = watchTerminalFile(file, (r) => { seen.push(r); }, { pollMs: 30 });
    await delay(60);
    stop();
    appendFileSync(file, JSON.stringify({ v: 1, ts: "x", command: "after stop" }) + "\n");
    await delay(180);
    expect(seen.map((r) => r.command)).not.toContain("after stop");
  });

  it("tracks byte offsets correctly with multi-byte UTF-8 commands (no drift)", async () => {
    const seen: TerminalRecord[] = [];
    close = watchTerminalFile(file, (r) => { seen.push(r); }, { pollMs: 30 });
    await delay(60);
    appendFileSync(file, JSON.stringify({ v: 1, ts: "x", command: "echo 🚀 deploy" }) + "\n");
    for (let i = 0; i < 40 && seen.length < 1; i++) await delay(30);
    appendFileSync(file, JSON.stringify({ v: 1, ts: "y", command: "echo 🎉 done" }) + "\n");
    for (let i = 0; i < 40 && seen.length < 2; i++) await delay(30);
    expect(seen.map((r) => r.command)).toEqual(["echo 🚀 deploy", "echo 🎉 done"]);
  });
});

describe("processTerminalRecord — LUMI_NO_CAPTURE kill switch", () => {
  it("returns no events when LUMI_NO_CAPTURE is set", async () => {
    const lumi = makeLumi();
    const prev = process.env.LUMI_NO_CAPTURE;
    process.env.LUMI_NO_CAPTURE = "1";
    try {
      const events = await processTerminalRecord(
        { v: 1, ts: "x", command: "git commit -m wip", exitCode: 1 },
        lumi,
      );
      expect(events).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.LUMI_NO_CAPTURE;
      else process.env.LUMI_NO_CAPTURE = prev;
    }
  });

  it("processes records normally when LUMI_NO_CAPTURE is unset", async () => {
    const lumi = makeLumi();
    delete process.env.LUMI_NO_CAPTURE;
    const events = await processTerminalRecord({ v: 1, ts: "x", command: "git commit -m wip" }, lumi);
    expect(events.length).toBeGreaterThan(0);
  });
});
