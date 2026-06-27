import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { WebSocket } from "ws";
import { attachTerminalWebSocket } from "../src/terminal/ws";
import { FakePtyBackend } from "../src/terminal/pty-backend";
import type { ConsentConfig } from "../src/session/consent-config";
import { Lumi } from "../src/lumi";
import { InMemoryProfile } from "../src/profile";
import { InMemoryCache } from "../src/cache";
import { MockGenerator } from "../src/generator";

function newLumi() {
  return new Lumi({ profile: new InMemoryProfile(), cache: new InMemoryCache(), generator: new MockGenerator() });
}
const cfg = (): ConsentConfig => ({
  enabled: true, tools: { "lumi-terminal": true }, projects: { mode: "all", allow: [] },
  scopes: { commands: true, output: true, aiText: true },
});

let server: http.Server | undefined;
let stop: (() => void) | undefined;
afterEach(() => { try { stop?.(); } catch {} server?.close(); server = undefined; stop = undefined; });

function listen(s: http.Server): Promise<number> {
  return new Promise((r) => s.listen(0, () => r((s.address() as any).port)));
}

describe("attachTerminalWebSocket", () => {
  it("relays client input to the PTY and PTY output back to the client", async () => {
    const backend = new FakePtyBackend();
    server = http.createServer((_req, res) => res.end("ok"));
    stop = attachTerminalWebSocket(server, {
      lumi: newLumi(), cwd: () => "C:/p", getConsent: cfg, onEvents: () => {}, backend,
    });
    const port = await listen(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/term`);
    const got: any[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        setTimeout(() => ws.send(JSON.stringify({ type: "input", data: "ls\n" })), 20);
        setTimeout(() => { backend.sessions[0]?.emit("file.txt\r\n"); }, 40);
      });
      ws.on("message", (m) => { got.push(JSON.parse(m.toString())); });
      ws.on("error", reject);
      setTimeout(resolve, 120);
    });
    expect(backend.sessions[0].written).toContain("ls\n");
    expect(got.some((m) => m.type === "output" && String(m.data).includes("file.txt"))).toBe(true);
    ws.close();
  });

  it("forwards resize and sends exit then closes when the shell exits", async () => {
    const backend = new FakePtyBackend();
    server = http.createServer((_req, res) => res.end("ok"));
    stop = attachTerminalWebSocket(server, {
      lumi: newLumi(), cwd: () => "C:/p", getConsent: cfg, onEvents: () => {}, backend,
    });
    const port = await listen(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/term`);
    const got: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on("open", () => {
        setTimeout(() => ws.send(JSON.stringify({ type: "resize", cols: 111, rows: 22 })), 20);
        setTimeout(() => backend.sessions[0]?.exit(3), 40);
      });
      ws.on("message", (m) => got.push(JSON.parse(m.toString())));
      ws.on("close", () => resolve());
      setTimeout(resolve, 200);
    });
    expect(backend.sessions[0].lastResize).toEqual({ cols: 111, rows: 22 });
    expect(got.some((m) => m.type === "exit" && m.exitCode === 3)).toBe(true);
  });

  it("sends {type:'unavailable'} and closes when no PTY backend is present", async () => {
    server = http.createServer((_req, res) => res.end("ok"));
    stop = attachTerminalWebSocket(server, {
      lumi: newLumi(), cwd: () => "C:/p", getConsent: cfg, onEvents: () => {}, backend: null,
    });
    const port = await listen(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/term`);
    const got: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on("message", (m) => got.push(JSON.parse(m.toString())));
      ws.on("close", () => resolve());
      ws.on("error", () => resolve());
      setTimeout(resolve, 200);
    });
    expect(got.some((m) => m.type === "unavailable")).toBe(true);
  });
});
