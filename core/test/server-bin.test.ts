import { describe, it, expect } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { parsePort, main } from "../src/server-bin";

describe("server-bin parsePort", () => {
  it("defaults to 4321 when --port is absent", () => {
    expect(parsePort([])).toBe(4321);
  });
  it("parses an explicit --port value", () => {
    expect(parsePort(["--port", "5123"])).toBe(5123);
  });
  it("returns null for a non-integer port", () => {
    expect(parsePort(["--port", "nope"])).toBeNull();
  });
});

describe("server-bin main", () => {
  it("starts a server that answers /health, then closes", async () => {
    // --port 0 → OS picks a free port, so the test never collides.
    const server: Server = main(["--port", "0"]);
    await new Promise<void>((resolve) =>
      server.listening ? resolve() : server.once("listening", () => resolve())
    );
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
