import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let server: ReturnType<typeof createOverlayServer> | undefined;
afterEach(() => { server?.close(); server = undefined; });
function listen(): Promise<number> {
  return new Promise((r) => server!.listen(0, () => r((server!.address() as AddressInfo).port)));
}

describe("overlay /health", () => {
  it("GET /health returns 200 { ok: true }", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-health-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000, claudeRoots: [], codexRoots: [] });
    const port = await listen();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("overlay first-run welcome", () => {
  it("GET / includes the dismissible welcome banner", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-welcome-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000, claudeRoots: [], codexRoots: [] });
    const port = await listen();
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    expect(html).toContain('id="lumi-welcome"');
    expect(html).toContain("lumi-welcome-dismissed");
  });
});
