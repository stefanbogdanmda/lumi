import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Capture scopes — each toggled independently. */
export type Scope = "commands" | "output" | "aiText";

/** Layered, default-OFF consent (spec §7.5). Read live from consent.json. */
export interface ConsentConfig {
  enabled: boolean;                          // global gate
  tools: Record<string, boolean>;            // per-tool; missing key = allowed
  projects: { mode: "all" | "allowlist"; allow: string[] };
  scopes: { commands: boolean; output: boolean; aiText: boolean };
}

const DEFAULT: ConsentConfig = {
  enabled: false,
  tools: {},
  projects: { mode: "all", allow: [] },
  scopes: { commands: true, output: true, aiText: true },
};

/** Normalize a path for prefix comparison: forward slashes, lowercase drive. */
function norm(p: string): string {
  return p.replace(/\\/g, "/").replace(/^([a-zA-Z]):/, (_, d) => d.toLowerCase() + ":");
}

/**
 * Read consent.json from `home`, tolerating both the Phase-1 boolean shape
 * (`{ aiSessions: true }`) and the layered Phase-2 shape. Missing fields fall
 * back to safe defaults (disabled; all scopes on; all projects). Unreadable or
 * malformed file → fully default (disabled).
 */
export function loadConsent(home: string): ConsentConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(home, "consent.json"), "utf8"));
  } catch {
    return { ...DEFAULT, projects: { ...DEFAULT.projects }, scopes: { ...DEFAULT.scopes } };
  }
  // Parsed JSON is untrusted external input; we must cast to inspect fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const enabled = typeof c.enabled === "boolean" ? c.enabled : c.aiSessions === true;
  // Keep only boolean-valued entries so the typed Record<string, boolean> stays truthful.
  const tools: Record<string, boolean> = {};
  if (c.tools && typeof c.tools === "object" && !Array.isArray(c.tools)) {
    for (const [k, v] of Object.entries(c.tools)) if (typeof v === "boolean") tools[k] = v;
  }
  const projects =
    c.projects && (c.projects.mode === "allowlist" || c.projects.mode === "all")
      ? {
          mode: c.projects.mode as "all" | "allowlist",
          allow: Array.isArray(c.projects.allow) ? (c.projects.allow as unknown[]).map(String) : [],
        }
      : { mode: "all" as const, allow: [] };
  const s =
    c.scopes && typeof c.scopes === "object" && !Array.isArray(c.scopes)
      ? (c.scopes as Record<string, unknown>)
      : {};
  const scopes = {
    commands: s.commands !== false,
    output: s.output !== false,
    aiText: s.aiText !== false,
  };
  return { enabled, tools, projects, scopes };
}

/** A tool is allowed unless it is explicitly set to false. */
export function allowsTool(c: ConsentConfig, tool: string): boolean {
  return c.tools[tool] !== false;
}

/** All projects allowed in "all" mode; in "allowlist" mode the cwd must sit under an allowed root. */
export function allowsProject(c: ConsentConfig, cwd: string): boolean {
  if (c.projects.mode === "all") return true;
  if (!cwd) return false;
  const n = norm(cwd);
  return c.projects.allow.some((root) => {
    const r = norm(root).replace(/\/$/, "");
    return n === r || n.startsWith(r + "/");
  });
}

/** A scope is allowed unless explicitly disabled. */
export function allowsScope(c: ConsentConfig, scope: Scope): boolean {
  return c.scopes[scope] !== false;
}
