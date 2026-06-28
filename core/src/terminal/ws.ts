import type { Server, IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import type { FeedEvent } from "../feed";
import type { Lumi } from "../lumi";
import type { ConsentConfig } from "../session/consent-config";
import { loadPtyBackend, type PtyBackend } from "./pty-backend";
import { startLumiTerminal, type LumiTerminalSession } from "./lumi-terminal";

export interface TerminalWsDeps {
  lumi: Lumi;
  /** Working directory for spawned shells (resolved per connection). */
  cwd: () => string;
  getConsent: () => ConsentConfig;
  onEvents: (events: FeedEvent[]) => void | Promise<void>;
  onError?: (e: unknown) => void;
  /** Override the PTY backend (tests). undefined => loadPtyBackend(); null => none. */
  backend?: PtyBackend | null;
  maxSessions?: number;
}

const DEFAULT_MAX_SESSIONS = 4;
/** Cap inbound WS frame size — far more than any real keypress batch needs. */
const MAX_WS_MESSAGE_BYTES = 65_536;
/** Allow only same-machine browser origins; non-browser clients send no Origin. */
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
/** Clamp resize geometry to a safe range so node-pty can't over-allocate. */
const MIN_DIM = 1, MAX_COLS = 500, MAX_ROWS = 300;

function send(ws: WebSocket, msg: unknown): void {
  try { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

/**
 * Attach a WebSocket terminal endpoint at /term to an existing http server.
 * Each socket owns one Lumi Terminal (spawned shell).
 *   client→server: {"type":"input","data":string} | {"type":"resize","cols":n,"rows":n}
 *   server→client: {"type":"output","data":string} | {"type":"exit","exitCode":n} | {"type":"unavailable"}
 * Returns stop() that detaches the upgrade handler and closes all sockets.
 */
export function attachTerminalWebSocket(server: Server, deps: TerminalWsDeps): () => void {
  // maxPayload caps inbound WS frames so a single huge `input` message cannot
  // exhaust heap — `ws` enforces this before emitting the `message` event.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_MESSAGE_BYTES });
  const maxSessions = deps.maxSessions ?? DEFAULT_MAX_SESSIONS;
  let active = 0;

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    let path = "/";
    try { path = new URL(req.url ?? "/", "http://localhost").pathname; } catch { /* default */ }
    if (path !== "/term") return; // not ours — leave for any other handler
    // Reject cross-site WebSocket handshakes. Browsers always send an Origin
    // header but never a CORS preflight, so the server must enforce origin
    // policy itself. A non-browser client (CLI, VS Code ext, curl) sends no
    // Origin and is left unaffected.
    const origin = req.headers.origin ?? "";
    if (origin && !LOCALHOST_ORIGIN.test(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };
  server.on("upgrade", onUpgrade);

  wss.on("connection", (ws: WebSocket) => {
    const backend = deps.backend === undefined ? loadPtyBackend() : deps.backend;
    if (!backend) { send(ws, { type: "unavailable" }); ws.close(); return; }
    if (active >= maxSessions) { send(ws, { type: "exit", exitCode: -1 }); ws.close(); return; }
    active++;
    let closed = false;
    const dec = () => { if (!closed) { closed = true; active = Math.max(0, active - 1); } };

    let term: LumiTerminalSession;
    try {
      term = startLumiTerminal({
        backend, lumi: deps.lumi, cwd: deps.cwd(),
        getConsent: deps.getConsent,
        onOutput: (data) => send(ws, { type: "output", data }),
        onExit: (e) => { send(ws, { type: "exit", exitCode: e.exitCode }); try { ws.close(); } catch {} },
        onEvents: deps.onEvents,
        onError: deps.onError,
      });
    } catch (e) { deps.onError?.(e); dec(); try { ws.close(); } catch {} return; }

    ws.on("message", (raw) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      try {
        if (msg?.type === "input" && typeof msg.data === "string") term.write(msg.data);
        else if (
          msg?.type === "resize" &&
          Number.isInteger(msg.cols) && msg.cols >= MIN_DIM && msg.cols <= MAX_COLS &&
          Number.isInteger(msg.rows) && msg.rows >= MIN_DIM && msg.rows <= MAX_ROWS
        ) term.resize(msg.cols, msg.rows);
      } catch (e) { deps.onError?.(e); }
    });
    const cleanup = () => { try { term.stop(); } catch (e) { deps.onError?.(e); } dec(); };
    ws.on("close", cleanup);
    ws.on("error", (e) => { deps.onError?.(e); cleanup(); });
  });

  return () => {
    server.off("upgrade", onUpgrade);
    for (const c of wss.clients) { try { c.close(); } catch {} }
    try { wss.close(); } catch {}
  };
}
