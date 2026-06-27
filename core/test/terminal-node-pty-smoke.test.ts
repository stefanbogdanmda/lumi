import { describe, it, expect } from "vitest";
import { __resetPtyBackendCache, loadPtyBackend } from "../src/terminal/pty-backend";

__resetPtyBackendCache();
const backend = loadPtyBackend();
const maybe = backend ? describe : describe.skip;

maybe("node-pty real backend (smoke; skipped if unavailable)", () => {
  it("spawns a shell and receives output", async () => {
    const b = loadPtyBackend()!;
    const isWin = process.platform === "win32";
    const shell = isWin ? (process.env.COMSPEC || "cmd.exe") : "/bin/sh";
    const args = isWin ? ["/c", "echo lumi-smoke"] : ["-c", "echo lumi-smoke"];
    const s = b.spawn({ shell, args, cwd: process.cwd(), cols: 80, rows: 24 });
    const out = await new Promise<string>((resolve) => {
      let acc = "";
      s.onData((d) => { acc += d; });
      s.onExit(() => resolve(acc));
      setTimeout(() => resolve(acc), 3000);
    });
    expect(out).toContain("lumi-smoke");
  });
});
