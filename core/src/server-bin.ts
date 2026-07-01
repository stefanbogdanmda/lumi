/**
 * server-bin.ts — standalone entrypoint for the packaged Lumi server sidecar.
 *
 * Compiled to one self-contained executable by @yao-pkg/pkg and shipped with the
 * desktop app. It runs the same overlay server as `lumi serve`, bound to
 * 127.0.0.1, and shuts down cleanly on SIGTERM/SIGINT so the Tauri shell leaves
 * no orphan process when the window closes.
 */
import type { Server } from "node:http";
import { startServer } from "./cli";

/** Parse `--port N` from argv. Defaults to 4321; returns null on invalid input. */
export function parsePort(argv: string[]): number | null {
  const i = argv.indexOf("--port");
  if (i < 0) return 4321;
  const n = parseInt(argv[i + 1] ?? "", 10);
  return Number.isInteger(n) ? n : null;
}

/** Start the sidecar server and wire clean shutdown. Returns the http.Server. */
export function main(argv: string[]): Server {
  const port = parsePort(argv);
  if (port === null) {
    console.error("Error: --port must be a valid integer");
    process.exit(1);
  }
  const server = startServer(port);
  const shutdown = (): void => {
    // Idempotent: drop both handlers so a second signal can't re-enter close().
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
    server.close(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}

// Run only when executed directly (compiled as CommonJS → require.main works).
if (require.main === module) {
  main(process.argv.slice(2));
}
