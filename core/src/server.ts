import * as http from "node:http";
import { join } from "node:path";
import { homedir } from "node:os";
import { watchAiSessions, claudeAdapter, codexAdapter } from "./session/ai-monitor";
import { isAiCaptureEnabled } from "./session/consent";
import { loadConsent } from "./session/consent-config";
import { writeFileSync, readFileSync as fsReadFileSync } from "node:fs";
import { attachTerminalWebSocket } from "./terminal/ws";
import { loadPtyBackend } from "./terminal/pty-backend";
import { JsonFileProfile } from "./profile";
import { JsonFileCache } from "./cache";
import { lumiHome } from "./paths";
import { levelFromCount } from "./level";
import { renderGlossary, buildGlossaryEntries } from "./glossary";
import { dueForReview } from "./review";
import { milestoneFor, nextMilestone } from "./milestones";
import { readEventsSince, appendEvent, lessonEvent } from "./feed";
import { watchTerminalFile, processTerminalRecord } from "./terminal";
import { detectRisks, riskAdvice, severityLabel } from "./risk";
import { Lumi } from "./lumi";
import { FallbackGenerator, ClaudeCliGenerator, MockGenerator } from "./generator";
import { CONCEPTS } from "./concepts";
import { LessonGenerator } from "./types";
import { OVERLAY_HTML } from "./overlay";
import { learningStats } from "./stats";
import { runAdvise } from "./advise";
import { runPrompt } from "./prompt";
import { allPathsProgress, listPaths } from "./curriculum";
import { progressCardFromProfile } from "./card";
import { weeklyDigest, renderDigestText } from "./digest";
import { detectStuck, unstuckAdvice } from "./unstuck";
import { currentEntitlement, verifyLicense, JsonFileLicenseStore } from "./license";
import { isPro } from "./entitlements";
import type { LicenseResult } from "./license";
import { rotateFeed, purgeData } from "./retention";
import { secureDir } from "./acl";
import { captureStatus } from "./capture-status";

export interface OverlayServerDeps {
  home?: string;
  generator?: LessonGenerator;
  pollMs?: number;
  /** Injectable advise fn for /api/next — keeps server tests offline. */
  advise?: (prompt: string) => Promise<string>;
  /** Injectable polish fn for /api/prompt — keeps server tests offline. */
  polish?: (p: string) => Promise<string>;
  /** Which AI source to use when no advise/polish fn is injected (default "claude"). */
  source?: string;
  /** Injectable entitlement for tests — skips disk read. */
  entitlement?: LicenseResult;
  /** Override the AI-session roots watched (default ~/.claude/projects). Tests inject a temp dir. */
  claudeRoots?: string[];
  /** Override the Codex roots watched (default ~/.codex/sessions). Tests inject a temp dir. */
  codexRoots?: string[];
}


function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const MAX_BODY_BYTES = 65536;
const RETENTION_DAYS = 30;
const RETENTION_BYTES = 50 * 1024 * 1024;

/** Resolves with the body string, or rejects with "413" if over MAX_BODY_BYTES. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let rejected = false;
    req.on("data", (d: Buffer) => {
      if (rejected) return; // drain silently after rejection
      total += d.length;
      if (total > MAX_BODY_BYTES) {
        rejected = true;
        reject(new Error("413"));
        // Resume draining so the socket stays open for the 413 response to be sent
        req.resume();
        return;
      }
      chunks.push(d);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (err) => {
      if (!rejected) reject(err);
    });
  });
}

export function createOverlayServer(deps: OverlayServerDeps = {}): http.Server {
  const home = deps.home ?? lumiHome();
  const pollMs = deps.pollMs ?? 1000;
  const feedFile = join(home, "feed.jsonl");

  // Resolve the vendored xterm asset dir once (null until @xterm/xterm is installed).
  let xtermPkgDir: string | null = null;
  try { xtermPkgDir = join(require.resolve("@xterm/xterm/package.json"), ".."); } catch { /* not installed yet */ }

  // Resolve the xterm fit addon's UMD entry once (null until installed).
  let fitJsPath: string | null = null;
  try { fitJsPath = require.resolve("@xterm/addon-fit"); } catch { /* not installed yet */ }

  // Harden the home dir (Windows ACL; POSIX already 0700) and bound the feed at
  // startup. Rotation also runs hourly so a long-lived overlay stays bounded.
  secureDir(home);
  const rotate = () => { try { rotateFeed(feedFile, { maxAgeDays: RETENTION_DAYS, maxBytes: RETENTION_BYTES }); } catch { /* best-effort */ } };
  rotate();
  const rotateTimer = setInterval(rotate, 60 * 60 * 1000);
  if (typeof rotateTimer.unref === "function") rotateTimer.unref();

  const generator =
    deps.generator ??
    new FallbackGenerator(new ClaudeCliGenerator(), new MockGenerator());

  const profile = new JsonFileProfile(join(home, "profile.json"));
  const cache = new JsonFileCache(join(home, "cache.json"));
  const lumi = new Lumi({ profile, cache, generator });

  // Self-sufficient terminal ingestion: running the overlay automatically
  // teaches from plain commands the user runs by hand. Lessons land in
  // feed.jsonl, which the SSE /events poller already pushes to the overlay.
  const stopTerminalWatch = watchTerminalFile(
    join(home, "terminal.jsonl"),
    async (record) => {
      const events = await processTerminalRecord(record, lumi);
      for (const e of events) appendEvent(feedFile, e);
    },
    // Surface ingestion errors instead of silently swallowing them.
    { pollMs, onError: (e) => console.error("[lumi:terminal-watch]", e) },
  );

  // AI-session monitor: tail Claude Code + Codex transcripts and teach from the
  // assistant's prose + commands + OUTPUT. Default OFF — only runs while consent is
  // granted (checked live each drain, so toggling consent.json pauses capture at source).
  const claudeRoots = deps.claudeRoots ?? [join(homedir(), ".claude", "projects")];
  const codexRoots = deps.codexRoots ?? [join(homedir(), ".codex", "sessions")];
  const stopAiWatch = watchAiSessions({
    sources: [
      ...(claudeRoots.length ? [claudeAdapter(claudeRoots)] : []),
      ...(codexRoots.length ? [codexAdapter(codexRoots)] : []),
    ],
    lumi,
    isEnabled: () => isAiCaptureEnabled(home),
    getConsent: () => loadConsent(home),
    pollMs,
    onEvents: (events) => { for (const e of events) appendEvent(feedFile, e); },
    onError: (e) => console.error("[lumi:ai-watch]", e),
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      const method = req.method ?? "GET";

      // Resolve entitlement once per request (injected in tests, disk-read in production)
      const ent = deps.entitlement ?? currentEntitlement({ home });
      const pro = isPro(ent);

      // GET /
      if (method === "GET" && url === "/") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": Buffer.byteLength(OVERLAY_HTML),
        });
        res.end(OVERLAY_HTML);
        return;
      }

      // GET /api/entitlement
      if (method === "GET" && url === "/api/entitlement") {
        const payload: Record<string, unknown> = { tier: ent.tier, valid: ent.valid };
        if (ent.email) payload.email = ent.email;
        if (ent.expires) payload.expires = ent.expires;
        sendJson(res, 200, payload);
        return;
      }

      // GET /api/consent — current layered consent (defaults when no file)
      if (method === "GET" && url === "/api/consent") {
        sendJson(res, 200, loadConsent(home));
        return;
      }

      // GET /api/capture-status — recording indicator (same consent the watcher reads)
      if (method === "GET" && url === "/api/capture-status") {
        sendJson(res, 200, captureStatus(home, [
          ...(claudeRoots.length ? [{ tool: "claude-code", roots: claudeRoots }] : []),
          ...(codexRoots.length ? [{ tool: "codex", roots: codexRoots }] : []),
        ]));
        return;
      }

      // GET /api/terminal/status — is the native PTY backend available?
      if (method === "GET" && url === "/api/terminal/status") {
        sendJson(res, 200, { available: loadPtyBackend() !== null });
        return;
      }

      // GET /vendor/xterm.js | /vendor/xterm.css — overlay terminal panel assets
      if (method === "GET" && (url === "/vendor/xterm.js" || url === "/vendor/xterm.css")) {
        if (!xtermPkgDir) { sendJson(res, 404, { error: "xterm assets unavailable" }); return; }
        try {
          const isCss = url.endsWith(".css");
          const file = join(xtermPkgDir, isCss ? "css/xterm.css" : "lib/xterm.js");
          const buf = fsReadFileSync(file);
          res.writeHead(200, {
            "Content-Type": isCss ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
            "Content-Length": buf.length,
            "Cache-Control": "public, max-age=86400",
          });
          res.end(buf);
        } catch {
          sendJson(res, 404, { error: "xterm assets unavailable" });
        }
        return;
      }

      // GET /vendor/addon-fit.js — xterm fit addon (UMD) for the terminal panel
      if (method === "GET" && url === "/vendor/addon-fit.js") {
        if (!fitJsPath) { sendJson(res, 404, { error: "xterm addon-fit unavailable" }); return; }
        try {
          const buf = fsReadFileSync(fitJsPath);
          res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Content-Length": buf.length, "Cache-Control": "public, max-age=86400" });
          res.end(buf);
        } catch { sendJson(res, 404, { error: "xterm addon-fit unavailable" }); }
        return;
      }

      // POST /api/consent — overwrite consent.json (human-readable)
      if (method === "POST" && url === "/api/consent") {
        let parsed: unknown;
        try {
          const raw = await readBody(req);
          parsed = JSON.parse(raw);
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          sendJson(res, 400, { error: "object body required" });
          return;
        }
        try {
          writeFileSync(join(home, "consent.json"), JSON.stringify(parsed, null, 2), { encoding: "utf8", mode: 0o600 });
          sendJson(res, 200, loadConsent(home));
        } catch {
          sendJson(res, 500, { error: "could not save consent" });
        }
        return;
      }

      // POST /api/delete-data — one-click purge of captured data. Requires a JSON
      // body { confirm: true } so a cross-origin form-POST (CSRF) can't wipe the
      // feed: the JSON content-type forces a preflight this server never approves.
      if (method === "POST" && url === "/api/delete-data") {
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.confirm !== true) {
            sendJson(res, 400, { error: "body must be { confirm: true }" });
            return;
          }
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        try {
          const removed = purgeData(home);
          sendJson(res, 200, { ok: true, removed });
        } catch {
          sendJson(res, 500, { error: "could not delete data" });
        }
        return;
      }

      // POST /api/license — activate a license key
      if (method === "POST" && url === "/api/license") {
        let key = "";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          key = typeof parsed.key === "string" ? parsed.key : "";
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!key.trim()) {
          sendJson(res, 400, { error: "key required" });
          return;
        }
        const result = verifyLicense(key);
        if (result.valid && result.tier === "pro") {
          new JsonFileLicenseStore(join(home, "license.json")).setKey(key);
          sendJson(res, 200, { ok: true, tier: "pro", email: result.email, expires: result.expires ?? null });
        } else {
          sendJson(res, 200, { ok: false, reason: result.reason ?? "Invalid license key" });
        }
        return;
      }

      // GET /events — Server-Sent Events
      if (method === "GET" && url === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        let offset = 0;

        // Replay existing events
        const initial = readEventsSince(feedFile, 0);
        offset = initial.offset;
        for (const event of initial.events) {
          res.write("data: " + JSON.stringify(event) + "\n\n");
        }

        // Poll for new events
        const timer = setInterval(() => {
          try {
            const result = readEventsSince(feedFile, offset);
            offset = result.offset;
            for (const event of result.events) {
              res.write("data: " + JSON.stringify(event) + "\n\n");
            }
          } catch {
            // Socket is broken (e.g. half-closed before 'close' event fires).
            // Stop polling to avoid repeated throws and leaked intervals.
            clearInterval(timer);
          }
        }, pollMs);

        req.on("close", () => {
          clearInterval(timer);
        });

        return;
      }

      // GET /api/glossary
      if (method === "GET" && url === "/api/glossary") {
        const learned = profile.listLearned();
        const markdown = renderGlossary(learned);
        // Structured entries for the interactive overlay glossary. Definitions
        // come from each concept's CACHED lesson (empty when none is cached).
        const entries = buildGlossaryEntries(learned, (id) => lumi.definitionFor(id));
        sendJson(res, 200, { markdown, entries });
        return;
      }

      // GET /api/review
      if (method === "GET" && url === "/api/review") {
        const items = dueForReview(profile.listLearned()).map((c) => ({
          id: c.id,
          label: CONCEPTS.find((x) => x.id === c.id)?.label ?? c.id,
        }));
        sendJson(res, 200, { items });
        return;
      }

      // GET /api/progress
      if (method === "GET" && url === "/api/progress") {
        const learned = lumi.listLearned();
        const count = learned.length;
        const streakDays = learningStats(learned).streakDays;
        sendJson(res, 200, {
          count,
          level: levelFromCount(count),
          milestone: milestoneFor(count),
          nextMilestone: nextMilestone(count),
          streakDays,
        });
        return;
      }

      // POST /api/review/answer
      if (method === "POST" && url === "/api/review/answer") {
        let conceptId = "";
        let remembered = false;
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          conceptId = typeof parsed.conceptId === "string" ? parsed.conceptId : "";
          remembered = !!parsed.remembered;
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!conceptId) {
          sendJson(res, 400, { error: "conceptId required" });
          return;
        }
        try {
          lumi.review(conceptId, remembered);
          sendJson(res, 200, { ok: true });
        } catch {
          sendJson(res, 500, { error: "review failed" });
        }
        return;
      }

      // POST /api/explain
      if (method === "POST" && url === "/api/explain") {
        let term = "";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          term = typeof parsed.term === "string" ? parsed.term : "";
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        try {
          const lesson = await lumi.explain(term);
          sendJson(res, 200, { lesson });
        } catch {
          sendJson(res, 500, { error: "explain failed" });
        }
        return;
      }

      // POST /api/next — coaching advice (lumi next)
      if (method === "POST" && url === "/api/next") {
        let source = deps.source ?? "claude";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          if (typeof parsed.source === "string") source = parsed.source;
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        try {
          const lines: string[] = [];
          await runAdvise({ home, out: (s) => lines.push(s), source, advise: deps.advise });
          sendJson(res, 200, { advice: lines.join("\n") });
        } catch {
          sendJson(res, 500, { error: "next failed" });
        }
        return;
      }

      // POST /api/prompt — prompt polisher (lumi prompt)
      if (method === "POST" && url === "/api/prompt") {
        let idea = "";
        let source = deps.source ?? "claude";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          idea = typeof parsed.idea === "string" ? parsed.idea : "";
          if (typeof parsed.source === "string") source = parsed.source;
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!idea.trim()) {
          sendJson(res, 400, { error: "idea required" });
          return;
        }
        try {
          const level = levelFromCount(profile.listLearned().length);
          const lines: string[] = [];
          await runPrompt(idea, { out: (s) => lines.push(s), source, level, polish: deps.polish });
          sendJson(res, 200, { prompt: lines.join("\n") });
        } catch {
          sendJson(res, 500, { error: "prompt failed" });
        }
        return;
      }

      // POST /api/paste — process text pasted from a web AI builder
      if (method === "POST" && url === "/api/paste") {
        let text = "";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          text = typeof parsed.text === "string" ? parsed.text : "";
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!text.trim()) {
          sendJson(res, 400, { error: "text required" });
          return;
        }
        try {
          const level = levelFromCount(profile.listLearned().length);
          const lessons = await lumi.processSignals({ text });
          let count = 0;
          for (const lesson of lessons) {
            appendEvent(feedFile, lessonEvent({
              source: "paste",
              concept: lesson.conceptId,
              level,
              lesson: {
                title: lesson.title,
                plainExplanation: lesson.plainExplanation,
                whyItMatters: lesson.whyItMatters,
                ...(lesson.analogy ? { analogy: lesson.analogy } : {}),
                ...(lesson.tinyExample ? { tinyExample: lesson.tinyExample } : {}),
              },
            }));
            profile.markLearned(lesson.conceptId);
            count++;
          }
          // Run the security lens on the same pasted output — the moment a beginner
          // pastes AI-written code is exactly when risk-flagging matters most.
          const risks = detectRisks(text).map((r) => ({
            label: r.label,
            severity: severityLabel(r.severity),
            advice: riskAdvice(r.conceptId),
          }));
          sendJson(res, 200, { count, risks });
        } catch {
          sendJson(res, 500, { error: "paste failed" });
        }
        return;
      }

      // GET /api/paths — return all learning paths with progress
      if (method === "GET" && url === "/api/paths") {
        const learnedIds = profile.listLearned().map((c) => c.id);
        const progressList = allPathsProgress(learnedIds);
        const pathDefs = listPaths();
        const paths = progressList.map((pp, idx) => {
          const pathDef = pathDefs.find((p) => p.id === pp.pathId);
          const title = pathDef?.title ?? pp.pathId;
          const nextLabel = pp.nextConceptId
            ? (CONCEPTS.find((c) => c.id === pp.nextConceptId)?.label ?? pp.nextConceptId)
            : null;
          // Free users can only access path index 0; all others are locked
          const locked = !pro && idx > 0;
          return {
            pathId: pp.pathId,
            title,
            done: pp.done,
            total: pp.total,
            pct: pp.pct,
            nextConceptId: pp.nextConceptId,
            nextLabel,
            locked,
          };
        });
        sendJson(res, 200, { paths });
        return;
      }

      // GET /api/card — return SVG progress card
      if (method === "GET" && url === "/api/card") {
        const learned = profile.listLearned();
        const svg = progressCardFromProfile(learned);
        const buf = Buffer.from(svg, "utf8");
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Content-Length": buf.length,
        });
        res.end(buf);
        return;
      }

      // GET /api/digest
      if (method === "GET" && url === "/api/digest") {
        const d = weeklyDigest(profile.listLearned());
        sendJson(res, 200, { text: renderDigestText(d), digest: d });
        return;
      }

      // POST /api/unstuck
      if (method === "POST" && url === "/api/unstuck") {
        let text = "";
        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw);
          text = typeof parsed.text === "string" ? parsed.text : "";
        } catch (e) {
          const status = (e as Error).message === "413" ? 413 : 400;
          sendJson(res, status, { error: status === 413 ? "request entity too large" : "invalid JSON body" });
          return;
        }
        if (!text.trim()) {
          sendJson(res, 400, { error: "text required" });
          return;
        }
        const sig = detectStuck(text);
        sendJson(res, 200, { stuck: sig.stuck, advice: unstuckAdvice(sig) });
        return;
      }

      // 404 fallback
      sendJson(res, 404, { error: "not found" });
    } catch {
      try { sendJson(res, 500, { error: "server error" }); } catch {}
    }
  });

  // Lumi Terminal: a spawned-shell PTY whose output feeds the capture pipeline.
  // Display is unconditional; capture is gated by opt-in consent inside the orchestrator.
  const stopTerminalWs = attachTerminalWebSocket(server, {
    lumi,
    cwd: () => process.cwd(),
    getConsent: () => loadConsent(home),
    onEvents: (events) => { for (const e of events) appendEvent(feedFile, e); },
    onError: (e) => console.error("[lumi:terminal-ws]", e),
  });

  // Stop both watchers when the server is closed so tests/processes don't
  // leak fs.watch handles or poll intervals.
  server.on("close", () => {
    clearInterval(rotateTimer);
    try { stopTerminalWatch(); } catch { /* already stopped */ }
    try { stopAiWatch(); } catch { /* already stopped */ }
    try { stopTerminalWs(); } catch { /* already stopped */ }
  });

  return server;
}
