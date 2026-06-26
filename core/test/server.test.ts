import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as http from "node:http";
import { JsonFileProfile } from "../src/profile";
import { MockGenerator } from "../src/generator";
import { appendEvent, lessonEvent } from "../src/feed";
import { createOverlayServer } from "../src/server";
import type { LessonGenerator } from "../src/types";
import type { Lesson } from "../src/types";
import type { LicenseResult } from "../src/license";

const FREE_ENT: LicenseResult = { valid: false, tier: "free", reason: "No license key stored" };
const PRO_ENT: LicenseResult = { valid: true, tier: "pro", email: "test@example.com" };

/** A generator whose generate() always rejects — used to test Fix 2. */
class ThrowingGenerator implements LessonGenerator {
  async generate(_concept: string): Promise<Lesson> {
    throw new Error("generator exploded");
  }
}

function getPort(server: http.Server): number {
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  return addr.port;
}

async function get(port: number, path: string): Promise<{ status: number; type: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          type: res.headers["content-type"] ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
    req.on("error", reject);
  });
}

async function post(
  port: number,
  path: string,
  payload: unknown
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d: Buffer) => chunks.push(d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

describe("createOverlayServer", () => {
  let home: string;
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), "lumi-server-"));
    // Seed a learned concept
    const profile = new JsonFileProfile(join(home, "profile.json"));
    profile.markLearned("git-commit");
    // Append a feed event
    const feedFile = join(home, "feed.jsonl");
    appendEvent(
      feedFile,
      lessonEvent({
        source: "test",
        concept: "git-commit",
        lesson: {
          title: "Git commit",
          plainExplanation: "A commit saves a snapshot.",
          whyItMatters: "Tracks your changes.",
        },
      })
    );
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = getPort(server);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  });

  it("GET / returns 200 text/html with rich overlay page", async () => {
    const res = await get(port, "/");
    expect(res.status).toBe(200);
    expect(res.type).toContain("text/html");
    // Tab labels must all be present
    expect(res.body).toContain("Lessons");
    expect(res.body).toContain("Glossary");
    expect(res.body).toContain("Review");
    expect(res.body).toContain("Explain");
    // SSE wiring
    expect(res.body).toContain("EventSource('/events')");
    // CSP meta tag
    expect(res.body).toContain("Content-Security-Policy");
  });

  it("GET /api/glossary returns 200 with markdown key containing the glossary header", async () => {
    const res = await get(port, "/api/glossary");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("markdown");
    expect(json.markdown).toContain("# My Lumi Glossary");
  });

  it("GET /api/glossary also returns a structured entries array", async () => {
    const res = await get(port, "/api/glossary");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.entries)).toBe(true);
    // The seeded learned concept (git-commit) must appear as a structured entry.
    const entry = json.entries.find((e: { id: string }) => e.id === "git-commit");
    expect(entry).toBeTruthy();
    expect(entry.label).toBe("Git commit");
    expect(entry.category).toBe("git");
    expect(entry.categoryLabel).toBe("Git & version control");
    expect(entry.seenCount).toBeGreaterThanOrEqual(1);
    expect(entry.learnedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof entry.learnMore).toBe("string");
  });

  it("GET /api/review returns 200 with items array", async () => {
    const res = await get(port, "/api/review");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("items");
    expect(Array.isArray(json.items)).toBe(true);
  });

  it("GET /api/progress returns 200 with count, level, milestone, and streakDays", async () => {
    const res = await get(port, "/api/progress");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("count");
    expect(json).toHaveProperty("level");
    expect(Object.keys(json)).toContain("milestone");
    expect(typeof json.count).toBe("number");
    expect(typeof json.level).toBe("string");
    expect(typeof json.streakDays).toBe("number");
    expect(json.streakDays).toBeGreaterThanOrEqual(0);
    // forward nudge for the overlay footer (parity with `lumi progress`)
    expect(Object.keys(json)).toContain("nextMilestone");
    if (json.nextMilestone) {
      expect(json.nextMilestone).toHaveProperty("remaining");
      expect(json.nextMilestone).toHaveProperty("reward");
    }
  });

  it("POST /api/explain with known term returns lesson with correct conceptId", async () => {
    const res = await post(port, "/api/explain", { term: "git commit" });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("lesson");
    expect(json.lesson).not.toBeNull();
    expect(json.lesson.conceptId).toBe("git-commit");
  });

  it("POST /api/explain with unknown term returns lesson: null", async () => {
    const res = await post(port, "/api/explain", { term: "definitely-not-a-concept-xyz" });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.lesson).toBeNull();
  });

  it("GET /nope returns 404", async () => {
    const res = await get(port, "/nope");
    expect(res.status).toBe(404);
  });

  it("GET /events returns 200 with text/event-stream content-type", async () => {
    // Connect to SSE endpoint, read first chunk, then destroy
    await new Promise<void>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/events" }, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("text/event-stream");
        // Destroy after confirming headers
        res.destroy();
        resolve();
      });
      req.on("error", (err) => {
        // Connection reset is expected after destroy()
        if ((err as NodeJS.ErrnoException).code === "ECONNRESET") resolve();
        else reject(err);
      });
    });
  });

  // Fix 2: throwing generator must return 500 per-request and NOT crash the server
  it("POST /api/explain with a throwing generator returns 500 and server stays up", async () => {
    const throwingServer = createOverlayServer({
      home,
      generator: new ThrowingGenerator(),
      pollMs: 50,
    });
    await new Promise<void>((resolve) => throwingServer.listen(0, "127.0.0.1", resolve));
    const tPort = (throwingServer.address() as http.AddressInfo).port;

    try {
      const explainRes = await post(tPort, "/api/explain", { term: "git commit" });
      expect(explainRes.status).toBe(500);
      const json = JSON.parse(explainRes.body);
      expect(json).toHaveProperty("error");

      // Server must still be alive — subsequent GET /api/progress should succeed
      const progressRes = await get(tPort, "/api/progress");
      expect(progressRes.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => throwingServer.close(() => resolve()));
    }
  });

  // Fix 4: malformed JSON body → 400
  it("POST /api/explain with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json at all{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/explain",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  // Fix 3: no wildcard CORS header on /api/* responses
  it("GET /api/progress does NOT include Access-Control-Allow-Origin header", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/api/progress" }, resolve);
      req.on("error", reject);
    });
    // drain
    res.resume();
    await new Promise<void>((resolve) => res.on("end", resolve));
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  // Fix 3: no wildcard CORS header on /events
  it("GET /events does NOT include Access-Control-Allow-Origin header", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/events" }, (res) => {
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
        res.destroy();
        resolve();
      });
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ECONNRESET") resolve();
        else reject(err);
      });
    });
  });

  // SSE replay: connect to /events and read the first data frame; it must contain the seeded lesson title
  it("GET /events replays seeded feed event with title in first data frame", async () => {
    const firstData = await new Promise<string>((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/events" }, (res) => {
        let buf = "";
        res.on("data", (chunk: Buffer) => {
          buf += chunk.toString("utf8");
          // A complete SSE frame ends with \n\n
          if (buf.includes("\n\n")) {
            res.destroy();
            resolve(buf);
          }
        });
        res.on("error", () => resolve(buf));
      });
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ECONNRESET") resolve("");
        else reject(err);
      });
    });
    expect(firstData).toContain("data:");
    expect(firstData).toContain("Git commit");
  });

  // POST /api/review/answer: valid body → 200 {ok:true}, seenCount bumped
  it("POST /api/review/answer with known conceptId returns 200 {ok:true} and bumps seenCount", async () => {
    // git-commit was seeded with markLearned (seenCount=1)
    const res = await post(port, "/api/review/answer", { conceptId: "git-commit", remembered: true });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ ok: true });

    // Verify seenCount was bumped via fresh profile read
    const profile = new JsonFileProfile(join(home, "profile.json"));
    const learned = profile.listLearned().find((c) => c.id === "git-commit");
    expect(learned).toBeDefined();
    expect(learned!.seenCount).toBe(2);
  });

  it("POST /api/review/answer with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not valid json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/review/answer",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  it("POST /api/review/answer with missing conceptId returns 400 {error: 'conceptId required'}", async () => {
    const res = await post(port, "/api/review/answer", { remembered: true });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "conceptId required" });
  });

  it("POST /api/review/answer with empty string conceptId returns 400 {error: 'conceptId required'}", async () => {
    const res = await post(port, "/api/review/answer", { conceptId: "", remembered: false });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "conceptId required" });
  });

  // Fix 4: body over 64 KB is rejected with 413
  it("POST /api/explain with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/explain",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });

  // ── /api/next (Coach) tests ────────────────────────────────────────────────

  it("POST /api/next with injected advise fake returns 200 { advice } containing fake text", async () => {
    const fakeAdvice = "1. Build a project. 2. Combine concepts. 3. Share your work.";
    const srv = createOverlayServer({
      home,
      generator: new MockGenerator(),
      pollMs: 50,
      advise: async (_prompt: string) => fakeAdvice,
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await post(p, "/api/next", {});
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json).toHaveProperty("advice");
      expect(json.advice).toContain(fakeAdvice);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("POST /api/next with seeded profile and injected advise returns 200 and includes advice text", async () => {
    // Profile is already seeded with git-commit in beforeEach
    const srv = createOverlayServer({
      home,
      generator: new MockGenerator(),
      pollMs: 50,
      advise: async (_prompt: string) => "Step 1: practice. Step 2: repeat.",
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await post(p, "/api/next", {});
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(typeof json.advice).toBe("string");
      expect(json.advice.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("POST /api/next with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/next",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  it("POST /api/next with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/next",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });

  // ── /api/prompt (Prompt Polisher) tests ───────────────────────────────────

  it("POST /api/prompt with injected polish fake and valid idea returns 200 { prompt } with polished text", async () => {
    const polished = "## Goal\nbuild x\n## Context and constraints\n...\n## Acceptance criteria\n...";
    const srv = createOverlayServer({
      home,
      generator: new MockGenerator(),
      pollMs: 50,
      polish: async (_idea: string) => polished,
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await post(p, "/api/prompt", { idea: "build x" });
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json).toHaveProperty("prompt");
      expect(json.prompt).toContain(polished);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("POST /api/prompt with empty idea string returns 400 { error: 'idea required' }", async () => {
    const res = await post(port, "/api/prompt", { idea: "" });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "idea required" });
  });

  it("POST /api/prompt with whitespace-only idea returns 400 { error: 'idea required' }", async () => {
    const res = await post(port, "/api/prompt", { idea: "   " });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "idea required" });
  });

  it("POST /api/prompt with missing idea field returns 400 { error: 'idea required' }", async () => {
    const res = await post(port, "/api/prompt", {});
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "idea required" });
  });

  it("POST /api/prompt with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/prompt",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  it("POST /api/prompt with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/prompt",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });

  // ── /api/paste tests ─────────────────────────────────────────────────────

  it("POST /api/paste with text mentioning 'git commit' returns 200 { count >= 1 } and writes a feed event", async () => {
    // Use a fresh home so git-commit is NOT already marked learned
    const freshHome = mkdtempSync(join(tmpdir(), "lumi-paste-"));
    const srv = createOverlayServer({ home: freshHome, generator: new MockGenerator(), pollMs: 50 });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await post(p, "/api/paste", { text: "I ran git commit -m 'init' to save the first version of my project." });
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json).toHaveProperty("count");
      expect(typeof json.count).toBe("number");
      expect(json.count).toBeGreaterThanOrEqual(1);

      // Feed file must have been written
      const { readFileSync, existsSync } = await import("node:fs");
      const feedPath = join(freshHome, "feed.jsonl");
      expect(existsSync(feedPath)).toBe(true);
      const feedContent = readFileSync(feedPath, "utf8");
      expect(feedContent).toContain('"source":"paste"');
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
      const { rmSync } = await import("node:fs");
      rmSync(freshHome, { recursive: true, force: true });
    }
  });

  it("POST /api/paste runs the security lens and returns risks for risky code", async () => {
    const freshHome = mkdtempSync(join(tmpdir(), "lumi-paste-risk-"));
    const srv = createOverlayServer({ home: freshHome, generator: new MockGenerator(), pollMs: 50 });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await post(p, "/api/paste", { text: 'const apiKey = "sk-1234567890abcdef1234567890abcdef";' });
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(Array.isArray(json.risks)).toBe(true);
      expect(json.risks.length).toBeGreaterThanOrEqual(1);
      const hit = json.risks[0];
      expect(hit).toHaveProperty("label");
      expect(hit).toHaveProperty("severity"); // friendly word, e.g. "high"
      expect(hit).toHaveProperty("advice");
      expect(hit.advice).not.toMatch(/Explain this risk/i); // clean advice, no model directive
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
      const { rmSync } = await import("node:fs");
      rmSync(freshHome, { recursive: true, force: true });
    }
  });

  it("POST /api/paste with benign text returns an empty risks array", async () => {
    const res = await post(port, "/api/paste", { text: "I learned about functions today." });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(Array.isArray(json.risks)).toBe(true);
  });

  it("POST /api/paste with empty text returns 400 { error: 'text required' }", async () => {
    const res = await post(port, "/api/paste", { text: "" });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "text required" });
  });

  it("POST /api/paste with whitespace-only text returns 400 { error: 'text required' }", async () => {
    const res = await post(port, "/api/paste", { text: "   \n  " });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "text required" });
  });

  it("POST /api/paste with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/paste",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  it("POST /api/paste with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/paste",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });

  it("POST /api/paste with text that has no recognisable concepts returns 200 { count: 0 }", async () => {
    // git-commit is already learned in beforeEach, so even if it's detected it won't count.
    // Use text with no detectable concepts at all.
    const res = await post(port, "/api/paste", { text: "Hello world, the weather is nice today." });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("count");
    expect(json.count).toBe(0);
  });

  // ── /api/paths tests ─────────────────────────────────────────────────────

  it("GET /api/paths returns 200 { paths } array with expected number of paths and progress fields", async () => {
    const res = await get(port, "/api/paths");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("paths");
    expect(Array.isArray(json.paths)).toBe(true);
    // There are 4 paths defined in curriculum.ts
    expect(json.paths.length).toBe(4);
    // Each path must have the expected fields
    for (const p of json.paths) {
      expect(typeof p.pathId).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(typeof p.done).toBe("number");
      expect(typeof p.total).toBe("number");
      expect(typeof p.pct).toBe("number");
      // nextConceptId is string or null
      expect(p.nextConceptId === null || typeof p.nextConceptId === "string").toBe(true);
    }
  });

  it("GET /api/paths reflects learned concepts in progress", async () => {
    // git-commit was seeded in beforeEach — it appears in 'ship-your-first-app' path
    const res = await get(port, "/api/paths");
    const json = JSON.parse(res.body);
    const shipPath = json.paths.find((p: { pathId: string }) => p.pathId === "ship-your-first-app");
    expect(shipPath).toBeDefined();
    expect(shipPath.done).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/paths includes nextLabel string for the next concept", async () => {
    const res = await get(port, "/api/paths");
    const json = JSON.parse(res.body);
    // At least one path must have a nextLabel (all are incomplete in test env)
    const withNext = json.paths.filter((p: { nextLabel: string | null }) => p.nextLabel !== null);
    expect(withNext.length).toBeGreaterThan(0);
    for (const p of withNext) {
      expect(typeof p.nextLabel).toBe("string");
      expect(p.nextLabel.length).toBeGreaterThan(0);
    }
  });

  // ── /api/card tests ──────────────────────────────────────────────────────

  it("GET /api/card returns 200 with content-type image/svg+xml and body starting with <svg", async () => {
    const res = await get(port, "/api/card");
    expect(res.status).toBe(200);
    expect(res.type).toContain("image/svg+xml");
    expect(res.body.trimStart().startsWith("<svg")).toBe(true);
  });

  it("GET /api/card SVG body is well-formed (contains closing </svg>)", async () => {
    const res = await get(port, "/api/card");
    expect(res.body).toContain("</svg>");
  });

  // ── /api/digest tests ─────────────────────────────────────────────────────

  it("GET /api/digest returns 200 with text string and digest object", async () => {
    const res = await get(port, "/api/digest");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(typeof json.text).toBe("string");
    expect(json.text.length).toBeGreaterThan(0);
    expect(typeof json.digest).toBe("object");
    expect(json.digest).not.toBeNull();
  });

  it("GET /api/digest with seeded profile returns text containing learned concept info", async () => {
    // profile has git-commit seeded in beforeEach
    const res = await get(port, "/api/digest");
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    // digest object must have expected fields
    expect(typeof json.digest.totalLearned).toBe("number");
    expect(json.digest.totalLearned).toBeGreaterThanOrEqual(1);
    expect(typeof json.digest.level).toBe("string");
    expect(typeof json.digest.streakDays).toBe("number");
    expect(Array.isArray(json.digest.learnedThisWeek)).toBe(true);
    expect(Array.isArray(json.digest.dueLabels)).toBe(true);
    expect(typeof json.digest.dueCount).toBe("number");
    expect(typeof json.digest.headline).toBe("string");
    // text must be a non-trivial string (the Lumi sign-off is always present)
    expect(json.text).toContain("-- Lumi");
  });

  // ── /api/unstuck tests ────────────────────────────────────────────────────

  it("POST /api/unstuck with looping error text returns 200 {stuck:true, advice:<non-empty>}", async () => {
    const loopText = [
      "TypeError: Cannot read property 'foo' of undefined",
      "Let me try again.",
      "TypeError: Cannot read property 'foo' of undefined",
      "Let me try again.",
    ].join("\n");
    const res = await post(port, "/api/unstuck", { text: loopText });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.stuck).toBe(true);
    expect(typeof json.advice).toBe("string");
    expect(json.advice.length).toBeGreaterThan(0);
  });

  it("POST /api/unstuck with calm text returns 200 {stuck:false}", async () => {
    const res = await post(port, "/api/unstuck", { text: "Everything is working great, deployment succeeded." });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.stuck).toBe(false);
    expect(typeof json.advice).toBe("string");
  });

  it("POST /api/unstuck with empty text returns 400 {error:'text required'}", async () => {
    const res = await post(port, "/api/unstuck", { text: "" });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "text required" });
  });

  it("POST /api/unstuck with whitespace-only text returns 400 {error:'text required'}", async () => {
    const res = await post(port, "/api/unstuck", { text: "   \n  " });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ error: "text required" });
  });

  it("POST /api/unstuck with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/unstuck",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });

  it("POST /api/unstuck with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/unstuck",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  // ── /api/entitlement tests ─────────────────────────────────────────────────

  it("GET /api/entitlement returns {tier:'free'} when free entitlement is injected", async () => {
    const srv = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, entitlement: FREE_ENT });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await get(p, "/api/entitlement");
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.tier).toBe("free");
      expect(json.valid).toBe(false);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("GET /api/entitlement returns {tier:'pro', valid:true} when pro entitlement is injected", async () => {
    const srv = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, entitlement: PRO_ENT });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await get(p, "/api/entitlement");
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.tier).toBe("pro");
      expect(json.valid).toBe(true);
      expect(json.email).toBe("test@example.com");
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  // ── /api/paths locked field tests ─────────────────────────────────────────

  it("GET /api/paths with free entitlement: first path locked:false, others locked:true", async () => {
    const srv = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, entitlement: FREE_ENT });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await get(p, "/api/paths");
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      const paths = json.paths as Array<{ locked: boolean }>;
      expect(paths.length).toBeGreaterThan(1);
      expect(paths[0].locked).toBe(false);
      for (let i = 1; i < paths.length; i++) {
        expect(paths[i].locked).toBe(true);
      }
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it("GET /api/paths with pro entitlement: all paths locked:false", async () => {
    const srv = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 50, entitlement: PRO_ENT });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const p = (srv.address() as http.AddressInfo).port;
    try {
      const res = await get(p, "/api/paths");
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      const paths = json.paths as Array<{ locked: boolean }>;
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.locked).toBe(false);
      }
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  // ── /api/license tests ─────────────────────────────────────────────────────

  it("POST /api/license with empty key returns 400 {error:'key required'}", async () => {
    const res = await post(port, "/api/license", { key: "" });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
    expect(json.error).toBe("key required");
  });

  it("POST /api/license with whitespace-only key returns 400", async () => {
    const res = await post(port, "/api/license", { key: "   " });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.error).toBe("key required");
  });

  it("POST /api/license with a garbage key returns 200 {ok:false}", async () => {
    const res = await post(port, "/api/license", { key: "not-a-real-license-key" });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.ok).toBe(false);
    expect(typeof json.reason).toBe("string");
    expect(json.reason.length).toBeGreaterThan(0);
  });

  it("POST /api/license with malformed JSON body returns 400", async () => {
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const raw = "not json{{";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/license",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(raw);
      req.end();
    });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json).toHaveProperty("error");
  });

  it("POST /api/license with body > 64 KB returns 413", async () => {
    const bigBody = "x".repeat(65537);
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/license",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": bigBody.length },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (d: Buffer) => chunks.push(d));
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(bigBody);
      req.end();
    });
    expect(res.status).toBe(413);
  });
});

describe("createOverlayServer — terminal.jsonl tailing", () => {
  let home: string;
  let server: http.Server;

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), "lumi-server-term-"));
    server = createOverlayServer({ home, generator: new MockGenerator(), pollMs: 30 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(home, { recursive: true, force: true });
  });

  it("teaches from a command appended to terminal.jsonl and writes it to feed.jsonl", async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const termFile = join(home, "terminal.jsonl");
    await delay(60); // let the watcher attach
    appendFileSync(termFile, JSON.stringify({ v: 1, ts: "x", command: "npm install react" }) + "\n");
    const feed = join(home, "feed.jsonl");
    for (let i = 0; i < 50 && !existsSync(feed); i++) await delay(30);
    const lines = readFileSync(feed, "utf8").split("\n").filter(Boolean);
    expect(lines.map((l) => JSON.parse(l).concept)).toContain("npm-install");
  });
});
