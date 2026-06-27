import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOverlayServer } from "../src/server";
import { MockGenerator } from "../src/generator";

let server: ReturnType<typeof createOverlayServer> | undefined;
afterEach(() => { server?.close(); server = undefined; });

function listen(): Promise<number> {
  return new Promise((resolve) => server!.listen(0, () => resolve((server!.address() as any).port)));
}

describe("POST /api/delete-data", () => {
  it("removes feed.jsonl", async () => {
    const home = mkdtempSync(join(tmpdir(), "lumi-del-"));
    const feed = join(home, "feed.jsonl");
    writeFileSync(feed, JSON.stringify({ id: "a", ts: new Date().toISOString(), type: "lesson" }) + "\n");
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 1000 });
    const port = await listen();
    const res = await fetch(`http://127.0.0.1:${port}/api/delete-data`, { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(existsSync(feed)).toBe(false);
  });
});
