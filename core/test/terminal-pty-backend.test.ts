import { describe, it, expect, afterEach } from "vitest";
import { FakePtyBackend, loadPtyBackend, __resetPtyBackendCache } from "../src/terminal/pty-backend";

describe("FakePtyBackend", () => {
  it("spawns a session that records writes/resizes/kill and emits data + exit", () => {
    const backend = new FakePtyBackend();
    const s = backend.spawn({ shell: "sh", cwd: "C:/p", cols: 80, rows: 24 });
    const seen: string[] = [];
    let exited = -99;
    s.onData((d) => seen.push(d));
    s.onExit((e) => { exited = e.exitCode; });
    s.write("ls\n");
    s.resize(100, 30);
    s.emit("file.txt\n");
    s.exit(0);
    expect(s.written).toEqual(["ls\n"]);
    expect(s.lastResize).toEqual({ cols: 100, rows: 30 });
    expect(seen).toEqual(["file.txt\n"]);
    expect(exited).toBe(0);
    s.kill();
    expect(s.killed).toBe(true);
    expect(backend.sessions).toHaveLength(1);
  });

  it("accumulates sessions across multiple spawns", () => {
    const b = new FakePtyBackend();
    b.spawn({ shell: "sh", cwd: "/", cols: 80, rows: 24 });
    b.spawn({ shell: "sh", cwd: "/", cols: 80, rows: 24 });
    expect(b.sessions).toHaveLength(2);
  });
});

describe("loadPtyBackend", () => {
  afterEach(() => __resetPtyBackendCache());

  it("returns null (never throws) when node-pty is not installed", () => {
    __resetPtyBackendCache();
    const a = loadPtyBackend();
    const b = loadPtyBackend();
    expect(a === null || typeof a.spawn === "function").toBe(true);
    expect(b).toBe(a); // cached
  });
});
