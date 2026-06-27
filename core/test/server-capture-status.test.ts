import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let server: ReturnType<typeof createOverlayServer> | undefined;
afterEach(() => { server?.close(); server = undefined; });
function listen(): Promise<number> {
  return new Promise((resolve) => server!.listen(0, () => resolve((server!.address() as any).port)));
}

describe("GET /api/capture-status", () => {
  it("returns recording=false by default (no consent)", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-cs-api-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000, claudeRoots: [], codexRoots: [] });
    const port = await listen();
    const body = await (await fetch(`http://127.0.0.1:${port}/api/capture-status`)).json();
    expect(body.recording).toBe(false);
    expect(body.scopes).toEqual({ commands: true, output: true, aiText: true });
  });
});
