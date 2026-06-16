/**
 * Lumi learning paths — ordered skill ladders over existing concepts.
 *
 * Each Path lists concept ids in the recommended learning order. All ids MUST
 * exist in CONCEPTS (enforced by the curriculum integrity test).
 *
 * Public API:
 *   listPaths()               → Path[]
 *   pathProgress(id, learned) → PathProgress
 *   allPathsProgress(learned) → PathProgress[]
 *   nextAcrossPaths(learned)  → { pathId, conceptId } | null
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An ordered learning path over a subset of Lumi's concept dictionary. */
export interface Path {
  /** Stable kebab-case id, e.g. "web-basics". */
  id: string;
  /** Short human title, e.g. "Web basics". */
  title: string;
  /** One-sentence description shown in the UI. */
  blurb: string;
  /** Concept ids in recommended learning order. All must exist in CONCEPTS. */
  conceptIds: string[];
}

/** Progress for a single path. */
export interface PathProgress {
  pathId: string;
  /** Number of concepts in this path that the learner has seen. */
  done: number;
  /** Total concepts in the path. */
  total: number;
  /** Completion percentage 0–100 (rounded to the nearest integer). */
  pct: number;
  /** First concept in path order that the learner has NOT yet seen, or null if complete. */
  nextConceptId: string | null;
  /** All concepts not yet learned, in path order. */
  remaining: string[];
}

// ---------------------------------------------------------------------------
// Paths definition
// ---------------------------------------------------------------------------

/**
 * The four learning paths.
 *
 * Concept id selection rules:
 * - Only ids that appear verbatim in CONCEPTS (concepts.ts) are used.
 * - Order is pedagogically intentional: foundational before advanced.
 */
const PATHS: Path[] = [
  {
    id: "web-basics",
    title: "Web basics",
    blurb: "Understand the building blocks of the web — requests, responses, and the tools every web project relies on.",
    conceptIds: [
      "localhost",     // run things locally first
      "port",          // ports go hand-in-hand with localhost
      "http-request",  // what a request is
      "http-status",   // reading the response
      "json",          // data format for everything web
      "api",           // putting it together: calling an API
      "endpoint-route", // where the server listens
      "webhook",       // server-push variant
      "cors",          // first cross-origin surprise
      "ssl-tls",       // https / certificates
      "dns",           // how a domain resolves
    ],
  },
  {
    id: "ship-your-first-app",
    title: "Ship your first app",
    blurb: "Go from local code to a live product: version control, dependencies, build, and deploy.",
    conceptIds: [
      "cli",           // using the terminal at all
      "git-commit",    // save your work
      "git-branch",    // experiment safely
      "git-push",      // push to remote
      "pull-request",  // collaborate via PR
      "repository",    // the container for all of it
      "npm-install",   // pull in packages
      "npm-script",    // run tasks
      "dependency",    // understand what you're pulling in
      "env-var",       // keep secrets out of code
      "build-tool",    // bundle for production
      "deploy",        // ship it
      "environment-stage", // staging vs production
      "ci",            // automate the pipeline
    ],
  },
  {
    id: "stay-safe-online",
    title: "Stay safe online",
    blurb: "Authentication, secrets, and the security concepts every builder must know before going live.",
    conceptIds: [
      "env-var",        // secrets live in env vars
      "authentication", // who are you?
      "authorization",  // what can you do?
      "token",          // how auth travels over HTTP
      "jwt",            // token format you'll see everywhere
      "oauth",          // delegate auth to a provider
      "session",        // server-side auth state
      "cookie",         // how sessions are tracked in the browser
      "ssl-tls",        // encrypt the channel
      "hashing",        // never store plain-text passwords
      "encryption",     // protecting data at rest
      "cors",           // browser security policy
      "rate-limit",     // throttle abuse
      "xss",            // escaping output to prevent script injection
      "csrf",           // protecting state-changing requests
      "sensitive-data-in-logs", // don't log passwords or tokens
      "debug-mode-in-prod",     // turn off debug before going live
      "insecure-cookie",        // httpOnly / Secure / sameSite flags matter
      "cleartext-token-storage", // tokens belong in httpOnly cookies, not localStorage
      "verbose-error-exposed",  // never leak stack traces to end users
    ],
  },
  {
    id: "understand-your-ai",
    title: "Understand your AI",
    blurb: "The infrastructure concepts that appear when you build with or alongside AI tools.",
    conceptIds: [
      "api",            // AI is an API call
      "http-request",   // the call itself
      "token",          // API keys / bearer tokens
      "env-var",        // store the key safely
      "json",           // prompt + response are JSON
      "async",          // AI calls are inherently async
      "rate-limit",     // you'll hit it fast with AI
      "latency",        // why responses feel slow
      "caching",        // cache responses to save money
      "webhook",        // async completion callbacks
      "logging",        // debug what you sent and received
      "exception",      // handle failures gracefully
    ],
  },
];

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/** Return the full list of learning paths in definition order. */
export function listPaths(): Path[] {
  return PATHS;
}

/**
 * Return progress for a single path.
 * If pathId is not found, returns a zero-progress sentinel so callers never
 * have to handle undefined.
 */
export function pathProgress(pathId: string, learnedIds: string[]): PathProgress {
  const path = PATHS.find((p) => p.id === pathId);
  if (!path) {
    return { pathId, done: 0, total: 0, pct: 0, nextConceptId: null, remaining: [] };
  }

  const learnedSet = new Set(learnedIds);
  const remaining = path.conceptIds.filter((cid) => !learnedSet.has(cid));
  const done = path.conceptIds.length - remaining.length;
  const total = path.conceptIds.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const nextConceptId = remaining.length > 0 ? remaining[0] : null;

  return { pathId, done, total, pct, nextConceptId, remaining };
}

/** Return progress for every path. */
export function allPathsProgress(learnedIds: string[]): PathProgress[] {
  return PATHS.map((p) => pathProgress(p.id, learnedIds));
}

/**
 * Return the single best next concept to learn across all paths.
 *
 * Selection order:
 *   1. Started paths (done > 0) that are not yet complete, ordered by
 *      ascending completion percentage (least-complete started path first).
 *   2. If no started paths remain, the first concept of the first path that
 *      has not been completed.
 *
 * Returns null when every path is 100% complete.
 */
export function nextAcrossPaths(learnedIds: string[]): { pathId: string; conceptId: string } | null {
  const progressList = allPathsProgress(learnedIds);

  // Incomplete paths only
  const incomplete = progressList.filter((pp) => pp.nextConceptId !== null);
  if (incomplete.length === 0) return null;

  // Prefer started (done > 0) paths, sorted by pct ascending so we finish
  // what we started before jumping to something new.
  const started = incomplete
    .filter((pp) => pp.done > 0)
    .sort((a, b) => a.pct - b.pct);

  const chosen = started.length > 0 ? started[0] : incomplete[0];
  return { pathId: chosen.pathId, conceptId: chosen.nextConceptId as string };
}
