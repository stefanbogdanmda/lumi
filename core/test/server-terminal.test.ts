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

describe("server terminal wiring", () => {
  it("GET /api/terminal/status reports a boolean availability", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-term-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000, claudeRoots: [], codexRoots: [] });
    const port = await listen();
    const body = await (await fetch(`http://127.0.0.1:${port}/api/terminal/status`)).json();
    expect(typeof body.available).toBe("boolean");
  });
});
