import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let server: ReturnType<typeof createOverlayServer> | undefined;
afterEach(() => { server?.close(); server = undefined; });

function listen(): Promise<number> {
  return new Promise((resolve) => {
    server!.listen(0, () => resolve((server!.address() as { port: number }).port));
  });
}

describe("consent API", () => {
  it("GET /api/consent returns defaults (disabled) when no file exists", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-capi-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000 });
    const port = await listen();
    const res = await fetch(`http://127.0.0.1:${port}/api/consent`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
    expect(body.scopes).toEqual({ commands: true, output: true, aiText: true });
  });

  it("POST /api/consent writes consent.json and GET reflects it", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-capi-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000 });
    const port = await listen();
    const post = await fetch(`http://127.0.0.1:${port}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, scopes: { aiText: false } }),
    });
    expect(post.status).toBe(200);
    expect(existsSync(join(home, "consent.json"))).toBe(true);
    const get = await (await fetch(`http://127.0.0.1:${port}/api/consent`)).json();
    expect(get.enabled).toBe(true);
    expect(get.scopes.aiText).toBe(false);
    expect(readFileSync(join(home, "consent.json"), "utf8")).toContain("\"enabled\"");
  });

  it("POST /api/consent rejects a non-object (array) body with 400", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-capi-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000 });
    const port = await listen();
    const res = await fetch(`http://127.0.0.1:${port}/api/consent`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "[]",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/consent rejects malformed JSON with 400", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-capi-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000 });
    const port = await listen();
    const res = await fetch(`http://127.0.0.1:${port}/api/consent`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "not json",
    });
    expect(res.status).toBe(400);
  });
});
