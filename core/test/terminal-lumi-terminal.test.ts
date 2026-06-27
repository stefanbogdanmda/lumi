import { describe, it, expect } from "vitest";
import { startLumiTerminal } from "../src/terminal/lumi-terminal";
import { FakePtyBackend } from "../src/terminal/pty-backend";
import type { ConsentConfig } from "../src/session/consent-config";
import type { FeedEvent } from "../src/feed";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

function newLumi() {
  return new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
}
const onCfg = (over: Partial<ConsentConfig> = {}): ConsentConfig => ({
  enabled: true, tools: { "lumi-terminal": true }, projects: { mode: "all", allow: [] },
  scopes: { commands: true, output: true, aiText: true }, ...over,
});
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("startLumiTerminal", () => {
  it("displays all output and, when opted-in, captures a lumi-terminal feed event after idle flush", async () => {
    const backend = new FakePtyBackend();
    const display: string[] = [];
    const events: FeedEvent[] = [];
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: (d) => display.push(d), onExit: () => {},
      onEvents: (e) => { events.push(...e); },
      getConsent: () => onCfg(), flushIdleMs: 30,
    });
    backend.sessions[0].emit("$ git commit -m wip\r\n1 file changed\r\n");
    await tick(120);
    expect(display.join("")).toContain("git commit");
    expect(events.some((e) => e.source === "lumi-terminal")).toBe(true);
    term.stop();
    expect(backend.sessions[0].killed).toBe(true);
  });

  it("does NOT capture when the lumi-terminal tool is not explicitly opted in", async () => {
    const backend = new FakePtyBackend();
    const display: string[] = [];
    const events: FeedEvent[] = [];
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: (d) => display.push(d), onExit: () => {},
      onEvents: (e) => { events.push(...e); },
      getConsent: () => onCfg({ tools: {} }), flushIdleMs: 30,
    });
    backend.sessions[0].emit("$ git commit -m wip\r\noutput\r\n");
    await tick(120);
    expect(display.join("")).toContain("git commit");
    expect(events).toEqual([]);
    term.stop();
  });

  it("does NOT capture when the output scope is off", async () => {
    const backend = new FakePtyBackend();
    const events: FeedEvent[] = [];
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: () => {}, onExit: () => {},
      onEvents: (e) => { events.push(...e); },
      getConsent: () => onCfg({ scopes: { commands: true, output: false, aiText: true } }), flushIdleMs: 30,
    });
    backend.sessions[0].emit("$ git commit\r\noutput\r\n");
    await tick(120);
    expect(events).toEqual([]);
    term.stop();
  });

  it("forwards write/resize to the session and flushes on exit; stop disposes", async () => {
    const backend = new FakePtyBackend();
    let exited = -1;
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: () => {}, onExit: (e) => { exited = e.exitCode; },
      onEvents: () => {}, getConsent: () => onCfg(), flushIdleMs: 1000,
    });
    term.write("ls\n"); term.resize(100, 30);
    expect(backend.sessions[0].written).toEqual(["ls\n"]);
    expect(backend.sessions[0].lastResize).toEqual({ cols: 100, rows: 30 });
    backend.sessions[0].exit(0);
    await tick(30);
    expect(exited).toBe(0);
    term.stop();
    expect(backend.sessions[0].killed).toBe(true);
  });

  it("honors LUMI_NO_CAPTURE (no capture, display still works)", async () => {
    const backend = new FakePtyBackend();
    const display: string[] = [];
    const events: FeedEvent[] = [];
    process.env.LUMI_NO_CAPTURE = "1";
    try {
      const term = startLumiTerminal({
        backend, lumi: newLumi(), cwd: "C:/p",
        onOutput: (d) => display.push(d), onExit: () => {},
        onEvents: (e) => { events.push(...e); },
        getConsent: () => onCfg(), flushIdleMs: 30,
      });
      backend.sessions[0].emit("$ git commit\r\nout\r\n");
      await tick(120);
      expect(display.join("")).toContain("git commit");
      expect(events).toEqual([]);
      term.stop();
    } finally { delete process.env.LUMI_NO_CAPTURE; }
  });

  it("captures via the byte threshold (idle timer not relied on)", async () => {
    const backend = new FakePtyBackend();
    const events: FeedEvent[] = [];
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: () => {}, onExit: () => {},
      onEvents: (e) => { events.push(...e); },
      getConsent: () => onCfg(), flushIdleMs: 100000, flushBytes: 20,
    });
    backend.sessions[0].emit("git commit -m a-reasonably-long-message\r\n");
    await tick(80);
    expect(events.some((e) => e.source === "lumi-terminal")).toBe(true);
    term.stop();
  });

  it("does not forward raw secrets to onEvents (redaction pipeline wired)", async () => {
    const backend = new FakePtyBackend();
    const events: FeedEvent[] = [];
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: () => {}, onExit: () => {},
      onEvents: (e) => { events.push(...e); },
      getConsent: () => onCfg(), flushIdleMs: 30,
    });
    const secret = "ghp_" + "a".repeat(36);
    backend.sessions[0].emit("token " + secret + " end\r\n");
    await tick(120);
    expect(JSON.stringify(events)).not.toContain(secret);
    term.stop();
  });

  it("ignores late onData after stop() without throwing", async () => {
    const backend = new FakePtyBackend();
    const term = startLumiTerminal({
      backend, lumi: newLumi(), cwd: "C:/p",
      onOutput: () => {}, onExit: () => {},
      onEvents: () => {}, getConsent: () => onCfg(), flushIdleMs: 30,
    });
    term.stop();
    expect(() => backend.sessions[0].emit("late output\r\n")).not.toThrow();
  });
});
