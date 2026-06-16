import * as http from "node:http";
import { join } from "node:path";
import { JsonFileProfile } from "./profile";
import { JsonFileCache } from "./cache";
import { lumiHome } from "./paths";
import { levelFromCount } from "./level";
import { renderGlossary } from "./glossary";
import { dueForReview } from "./review";
import { milestoneFor } from "./milestones";
import { readEventsSince, appendEvent, lessonEvent } from "./feed";
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

  const generator =
    deps.generator ??
    new FallbackGenerator(new ClaudeCliGenerator(), new MockGenerator());

  const profile = new JsonFileProfile(join(home, "profile.json"));
  const cache = new JsonFileCache(join(home, "cache.json"));
  const lumi = new Lumi({ profile, cache, generator });

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
        const markdown = renderGlossary(profile.listLearned());
        sendJson(res, 200, { markdown });
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
          sendJson(res, 200, { count });
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

  return server;
}
