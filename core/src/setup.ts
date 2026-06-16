/**
 * setup.ts — `lumi setup` command: auto-wires each AI coding tool's hook.
 *
 * Design principles:
 *  - Pure, injectable deps so tests can use temp dirs
 *  - Idempotent: already-wired hooks are not rewritten
 *  - Non-clobbering: foreign existing values get a manual instruction unless --force
 *  - Backup-before-change: writes <file>.lumi-bak when actually modifying
 *  - Node built-ins only (fs, path, os)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetupDeps {
  home?: string;
  out?: (s: string) => void;
  force?: boolean;
  /** Base for ~/.codex, ~/.cursor, etc.  Defaults to os.homedir(). */
  configHome?: string;
  /** Root dir that contains codex/, cursor/, copilot/, gemini/ sub-dirs. */
  adaptersDir?: string;
}

export interface MergeResult {
  content: string;
  changed: boolean;
}

// ---------------------------------------------------------------------------
// Codex — ~/.codex/config.toml
//   notify = ["bash", "<abs-path>/adapters/codex/lumi-codex-hook.sh"]
// ---------------------------------------------------------------------------

/**
 * Merge a `notify` key into existing TOML content.
 *
 * Rules:
 *  - No existing notify key  → prepend it before any [table] header (or append).
 *  - Exact same value already → not changed (idempotent).
 *  - Different value          → return changed:false, content = original (caller
 *    treats this as a "conflict" and prints manual instruction).
 *
 * We use a simple text-level approach rather than a full TOML parser to stay
 * dependency-free. Handles the subset used by Codex config.
 */
export function mergeCodexNotify(
  existingToml: string,
  hookPath: string
): MergeResult & { conflict: boolean } {
  const desired = `notify = ["bash", "${hookPath}"]`;

  // Check if any notify key already exists
  const notifyRe = /^\s*notify\s*=/m;
  const exactRe = new RegExp(
    `^\\s*notify\\s*=\\s*\\[\\s*"bash"\\s*,\\s*"${escapeRegex(hookPath)}"\\s*\\]`,
    "m"
  );

  if (exactRe.test(existingToml)) {
    // Already wired to us — idempotent
    return { content: existingToml, changed: false, conflict: false };
  }

  if (notifyRe.test(existingToml)) {
    // Wired to something else — conflict
    return { content: existingToml, changed: false, conflict: true };
  }

  // Not present — insert before the first [table] header or append at top
  const tableHeaderIdx = existingToml.search(/^\s*\[/m);
  let newContent: string;
  if (tableHeaderIdx === -1) {
    // No table headers — just append (with leading newline if file not empty)
    newContent =
      existingToml.length > 0 && !existingToml.endsWith("\n")
        ? existingToml + "\n" + desired + "\n"
        : existingToml + desired + "\n";
  } else {
    // Insert before first [table]
    newContent =
      existingToml.slice(0, tableHeaderIdx) +
      desired +
      "\n" +
      existingToml.slice(tableHeaderIdx);
  }

  return { content: newContent, changed: true, conflict: false };
}

// ---------------------------------------------------------------------------
// Cursor — ~/.cursor/hooks.json
//   { "version": 1, "hooks": { "stop": [{ "command": "<abs-path>" }] } }
// ---------------------------------------------------------------------------

/** Merge a cursor stop-hook entry.  Returns conflict:true if a *different*
 *  stop hook (non-lumi) already occupies the array's command field. */
export function mergeCursorHook(
  existing: Record<string, unknown>,
  hookPath: string
): MergeResult & { conflict: boolean } {
  const obj: Record<string, unknown> = JSON.parse(JSON.stringify(existing)); // deep clone
  if (!obj.version) obj.version = 1;
  if (typeof obj.hooks !== "object" || obj.hooks === null) obj.hooks = {};
  const hooks = obj.hooks as Record<string, unknown>;

  // If stop key is present but not an array, treat as a conflict to avoid
  // clobbering existing non-array data (e.g. string or object value).
  if ("stop" in hooks && !Array.isArray(hooks.stop)) {
    return {
      content: JSON.stringify(existing, null, 2),
      changed: false,
      conflict: true,
    };
  }

  if (!Array.isArray(hooks.stop)) hooks.stop = [];
  const stopArr = hooks.stop as Array<Record<string, unknown>>;

  // Already wired?
  if (stopArr.some((e) => e.command === hookPath)) {
    return {
      content: JSON.stringify(obj, null, 2),
      changed: false,
      conflict: false,
    };
  }

  // For Cursor the stop array can have multiple entries, so we always append
  // (no true conflict when the existing stop value is an array).
  stopArr.push({ command: hookPath });
  return {
    content: JSON.stringify(obj, null, 2),
    changed: true,
    conflict: false,
  };
}

// ---------------------------------------------------------------------------
// Copilot — ~/.copilot/hooks/lumi.json
//   Entire file is the copilot hooks JSON from adapters/copilot/hooks.json
//   but with the script path replaced.
// ---------------------------------------------------------------------------

/** Build the copilot hooks JSON with the given hook path injected. */
export function buildCopilotHooksJson(hookPath: string): string {
  const obj = {
    version: 1,
    hooks: {
      agentStop: [
        {
          type: "command",
          bash: `bash "${hookPath}"`,
          timeoutSec: 30,
        },
      ],
    },
  };
  return JSON.stringify(obj, null, 2);
}

/**
 * Merge copilot hooks file.
 * If the file already references our hookPath → idempotent.
 * If it references a different bash path → conflict.
 * If empty/new → write the fresh template.
 */
export function mergeCopilotHook(
  existingJson: string,
  hookPath: string
): MergeResult & { conflict: boolean } {
  const desired = buildCopilotHooksJson(hookPath);
  const quotedPath = `bash "${hookPath}"`;

  // Try to parse existing
  let existing: Record<string, unknown> | null = null;
  try {
    existing = JSON.parse(existingJson) as Record<string, unknown>;
  } catch {
    // Malformed — treat as empty (fresh write)
  }

  if (existing !== null) {
    // Check for our exact entry
    try {
      const hooks = (existing.hooks as Record<string, unknown>) ?? {};
      const stops = (hooks.agentStop as Array<Record<string, unknown>>) ?? [];
      if (stops.some((e) => e.bash === quotedPath)) {
        return { content: existingJson, changed: false, conflict: false };
      }
      // Conflict if another bash command present
      if (stops.some((e) => typeof e.bash === "string" && e.bash !== quotedPath)) {
        return { content: existingJson, changed: false, conflict: true };
      }
    } catch {
      // Defensive: treat as fresh write
    }
  }

  return { content: desired, changed: true, conflict: false };
}

// ---------------------------------------------------------------------------
// Gemini — ~/.gemini/settings.json
//   Merge under hooks.AfterAgent[]
// ---------------------------------------------------------------------------

function buildGeminiEntry(hookPath: string): Record<string, unknown> {
  return {
    hooks: [
      {
        name: "lumi-feed",
        type: "command",
        command: `bash "${hookPath}"`,
        timeout: 60000,
      },
    ],
  };
}

/**
 * Merge a Gemini AfterAgent hook entry into existing settings JSON.
 * Idempotent: if an entry with name "lumi-feed" already exists → no change.
 * The Gemini AfterAgent value is an array of group objects, each with a
 * `hooks` sub-array.
 */
export function mergeGeminiHook(
  existingJson: string,
  hookPath: string
): MergeResult & { conflict: boolean } {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(existingJson) as Record<string, unknown>;
  } catch {
    // Malformed JSON — start fresh
    obj = {};
  }

  if (typeof obj.hooks !== "object" || obj.hooks === null) obj.hooks = {};
  const hooksSection = obj.hooks as Record<string, unknown>;

  // If AfterAgent key is present but not an array, treat as a conflict to avoid
  // clobbering existing non-array data (e.g. string or object value).
  if ("AfterAgent" in hooksSection && !Array.isArray(hooksSection.AfterAgent)) {
    return {
      content: existingJson,
      changed: false,
      conflict: true,
    };
  }

  if (!Array.isArray(hooksSection.AfterAgent)) hooksSection.AfterAgent = [];
  const afterAgent = hooksSection.AfterAgent as Array<Record<string, unknown>>;

  // Check if already wired (any group has a hook named lumi-feed)
  const alreadyWired = afterAgent.some((group) => {
    const subHooks = group.hooks as Array<Record<string, unknown>> | undefined;
    return (
      Array.isArray(subHooks) &&
      subHooks.some((h) => h.name === "lumi-feed")
    );
  });

  if (alreadyWired) {
    return {
      content: existingJson,
      changed: false,
      conflict: false,
    };
  }

  afterAgent.push(buildGeminiEntry(hookPath));
  return {
    content: JSON.stringify(obj, null, 2),
    changed: true,
    conflict: false,
  };
}

// ---------------------------------------------------------------------------
// Claude Code — vscode-extension/hook/lumi-hook.sh
// This is a documented-manual step because Claude Code's user settings path
// varies across environments (it's set up via VS Code extension or manually
// editing ~/.claude.json).  We print a clear manual instruction.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// OpenCode — print instruction (destination can't be reliably resolved)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Config dirs/files that indicate a tool is installed. */
const TOOL_CONFIG_DIRS: Record<string, string> = {
  codex: ".codex",
  cursor: ".cursor",
  copilot: ".copilot",
  gemini: ".gemini",
  "claude-code": ".claude",
  opencode: ".config/opencode",
};

/**
 * Return the list of tool names whose config dir is present under configHome.
 */
export function detectInstalledTools(configHome: string): string[] {
  return Object.entries(TOOL_CONFIG_DIRS)
    .filter(([, dir]) => existsSync(join(configHome, dir)))
    .map(([tool]) => tool);
}

// ---------------------------------------------------------------------------
// Per-tool wiring
// ---------------------------------------------------------------------------

function backup(file: string): void {
  if (existsSync(file)) {
    writeFileSync(`${file}.lumi-bak`, readFileSync(file));
  }
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function readTextSafe(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJsonSafe(file: string): Record<string, unknown> {
  try {
    const txt = readFileSync(file, "utf8");
    return JSON.parse(txt) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type WireResult = "already" | "wired" | "conflict" | "manual" | "error";

function wireCodex(
  configHome: string,
  adaptersDir: string,
  force: boolean,
  out: (s: string) => void
): WireResult {
  const configDir = join(configHome, ".codex");
  if (!existsSync(configDir)) {
    // Not installed — skip
    return "error";
  }

  const hookPath = resolve(join(adaptersDir, "codex", "lumi-codex-hook.sh"));
  const configFile = join(configDir, "config.toml");
  const existing = readTextSafe(configFile);

  const result = mergeCodexNotify(existing, hookPath);

  if (!result.changed && !result.conflict) {
    out("✅ Codex already connected — Lumi is already wired to Codex.");
    return "already";
  }

  if (result.conflict && !force) {
    out(
      [
        "⚠️  Codex: a different notify hook is already set in ~/.codex/config.toml.",
        `   To wire Lumi manually, add this line (before any [table] headers):`,
        `   notify = ["bash", "${hookPath}"]`,
        `   Or re-run with --force to overwrite.`,
      ].join("\n")
    );
    return "conflict";
  }

  if (result.conflict && force) {
    // Force: replace the existing notify line with ours.
    // Replacing only the first root-level `notify` is intentional: Codex config
    // is a flat TOML file with a single notify key at the root scope.
    const forced = existing.replace(
      /^\s*notify\s*=.*$/m,
      `notify = ["bash", "${hookPath}"]`
    );
    backup(configFile);
    writeFileSync(configFile, forced, "utf8");
    out(
      "✅ Lumi is now connected to Codex (forced). Start coding and lessons will appear in your overlay."
    );
    return "wired";
  }

  // Normal write
  ensureDir(dirname(configFile));
  backup(configFile);
  writeFileSync(configFile, result.content, "utf8");
  out(
    "✅ Lumi is now connected to Codex. Start coding and lessons will appear in your overlay."
  );
  return "wired";
}

function wireCursor(
  configHome: string,
  adaptersDir: string,
  force: boolean,
  out: (s: string) => void
): WireResult {
  const configDir = join(configHome, ".cursor");
  if (!existsSync(configDir)) return "error";

  const hookPath = resolve(join(adaptersDir, "cursor", "lumi-cursor-hook.sh"));
  const configFile = join(configDir, "hooks.json");
  const existing = readJsonSafe(configFile);

  const result = mergeCursorHook(existing, hookPath);

  if (!result.changed && !result.conflict) {
    out("✅ Cursor already connected — Lumi is already wired to Cursor.");
    return "already";
  }

  if (result.conflict && !force) {
    out(
      [
        "⚠️  Cursor: the hooks.stop value in ~/.cursor/hooks.json is not an array.",
        `   To wire Lumi manually, add this entry to the stop array:`,
        `   { "command": "${hookPath}" }`,
        `   Or re-run with --force to overwrite.`,
      ].join("\n")
    );
    return "conflict";
  }

  if (result.conflict && force) {
    // Force: rebuild hooks.json with our entry, preserving other fields
    const forced = JSON.parse(JSON.stringify(existing));
    if (!forced.version) forced.version = 1;
    if (typeof forced.hooks !== "object" || forced.hooks === null) forced.hooks = {};
    (forced.hooks as Record<string, unknown>).stop = [{ command: hookPath }];
    ensureDir(dirname(configFile));
    backup(configFile);
    writeFileSync(configFile, JSON.stringify(forced, null, 2), "utf8");
    out(
      "✅ Lumi is now connected to Cursor (forced). Start coding and lessons will appear in your overlay."
    );
    return "wired";
  }

  ensureDir(dirname(configFile));
  backup(configFile);
  writeFileSync(configFile, result.content, "utf8");
  out(
    "✅ Lumi is now connected to Cursor. Start coding and lessons will appear in your overlay."
  );
  return "wired";
}

function wireCopilot(
  configHome: string,
  adaptersDir: string,
  force: boolean,
  out: (s: string) => void
): WireResult {
  const configDir = join(configHome, ".copilot");
  if (!existsSync(configDir)) return "error";

  const hookPath = resolve(join(adaptersDir, "copilot", "lumi-copilot-hook.sh"));
  const hooksDir = join(configDir, "hooks");
  const configFile = join(hooksDir, "lumi.json");

  // If the file doesn't exist yet, it's a fresh write
  const existingJson = existsSync(configFile) ? readTextSafe(configFile) : "";
  const result = mergeCopilotHook(existingJson, hookPath);

  if (!result.changed && !result.conflict) {
    out("✅ Copilot already connected — Lumi is already wired to Copilot.");
    return "already";
  }

  if (result.conflict && !force) {
    out(
      [
        "⚠️  Copilot: a different hook is already set in ~/.copilot/hooks/lumi.json.",
        `   To wire Lumi manually, set the agentStop bash command to:`,
        `   bash "${hookPath}"`,
        `   Or re-run with --force to overwrite.`,
      ].join("\n")
    );
    return "conflict";
  }

  if (result.conflict && force) {
    // Force: overwrite the file with a fresh template using our hook path
    const forcedContent = buildCopilotHooksJson(hookPath);
    ensureDir(hooksDir);
    backup(configFile);
    writeFileSync(configFile, forcedContent, "utf8");
    out(
      "✅ Lumi is now connected to Copilot (forced). Start coding and lessons will appear in your overlay."
    );
    return "wired";
  }

  ensureDir(hooksDir);
  backup(configFile);
  writeFileSync(configFile, result.content, "utf8");
  out(
    "✅ Lumi is now connected to Copilot. Start coding and lessons will appear in your overlay."
  );
  return "wired";
}

function wireGemini(
  configHome: string,
  adaptersDir: string,
  force: boolean,
  out: (s: string) => void
): WireResult {
  const configDir = join(configHome, ".gemini");
  if (!existsSync(configDir)) return "error";

  const hookPath = resolve(join(adaptersDir, "gemini", "lumi-gemini-hook.sh"));
  const configFile = join(configDir, "settings.json");
  const existingJson = existsSync(configFile) ? readTextSafe(configFile) : "{}";

  const result = mergeGeminiHook(existingJson, hookPath);

  if (!result.changed && !result.conflict) {
    out("✅ Gemini already connected — Lumi is already wired to Gemini CLI.");
    return "already";
  }

  if (result.conflict && !force) {
    out(
      [
        "⚠️  Gemini: the hooks.AfterAgent value in ~/.gemini/settings.json is not an array.",
        `   To wire Lumi manually, set hooks.AfterAgent to an array and add:`,
        `   { "hooks": [{ "name": "lumi-feed", "type": "command", "command": "bash \\"${hookPath}\\"", "timeout": 60000 }] }`,
        `   Or re-run with --force to overwrite.`,
      ].join("\n")
    );
    return "conflict";
  }

  if (result.conflict && force) {
    // Force: parse existing, reset AfterAgent to our entry, preserve other fields
    let forced: Record<string, unknown> = {};
    try { forced = JSON.parse(existingJson) as Record<string, unknown>; } catch { /* start fresh */ }
    if (typeof forced.hooks !== "object" || forced.hooks === null) forced.hooks = {};
    (forced.hooks as Record<string, unknown>).AfterAgent = [buildGeminiEntry(hookPath)];
    ensureDir(dirname(configFile));
    backup(configFile);
    writeFileSync(configFile, JSON.stringify(forced, null, 2), "utf8");
    out(
      "✅ Lumi is now connected to Gemini CLI (forced). Start coding and lessons will appear in your overlay."
    );
    return "wired";
  }

  ensureDir(dirname(configFile));
  backup(configFile);
  writeFileSync(configFile, result.content, "utf8");
  out(
    "✅ Lumi is now connected to Gemini CLI. Start coding and lessons will appear in your overlay."
  );
  return "wired";
}

function wireClaudeCode(
  configHome: string,
  repoRoot: string,
  _force: boolean,
  out: (s: string) => void
): WireResult {
  const hookPath = resolve(
    join(repoRoot, "vscode-extension", "hook", "lumi-hook.sh")
  );
  out(
    [
      "ℹ️  Claude Code: wiring requires a one-time manual step.",
      `   Open Claude Code → Settings → Hooks → Stop hook → add:`,
      `     ${hookPath}`,
      `   (or set LUMI_HOOK_SH to that path before launching Claude Code)`,
    ].join("\n")
  );
  return "manual";
}

function wireOpenCode(
  _configHome: string,
  repoRoot: string,
  _force: boolean,
  out: (s: string) => void
): WireResult {
  const pluginSrc = resolve(join(repoRoot, "claude-plugin", ".opencode"));
  out(
    [
      "ℹ️  OpenCode: to install the Lumi plugin, copy or symlink the plugin directory:",
      `     cp -r "${pluginSrc}" ~/.config/opencode/.opencode`,
      `   then add "lumi@git+..." to the plugin array in your opencode.json.`,
      `   See ${pluginSrc}/INSTALL.md for full instructions.`,
    ].join("\n")
  );
  return "manual";
}

// ---------------------------------------------------------------------------
// Resolve adapters dir from __dirname (works whether in src/ or dist/)
// ---------------------------------------------------------------------------

function defaultAdaptersDir(): string {
  // __dirname is core/src or core/dist; walk up to repo root then /adapters
  // core/src -> core -> repo root
  const repoRoot = resolve(join(__dirname, "..", ".."));
  return join(repoRoot, "adapters");
}

function defaultRepoRoot(): string {
  return resolve(join(__dirname, "..", ".."));
}

// ---------------------------------------------------------------------------
// All known tools
// ---------------------------------------------------------------------------

const ALL_TOOLS = ["codex", "cursor", "copilot", "gemini", "claude-code", "opencode"];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the setup command.
 *
 * @param tools  Tool names to wire, e.g. ["codex", "cursor"].
 *               Pass [] or ["--all"] to auto-detect and wire all installed.
 * @param deps   Injectable dependencies for testing.
 * @returns      Process exit code (0 = success / partial-manual, 1 = nothing done).
 */
export async function runSetup(
  tools: string[],
  deps: SetupDeps = {}
): Promise<number> {
  const out = deps.out ?? ((s: string) => console.log(s));
  const configHome = deps.configHome ?? homedir();
  const adaptersDir = deps.adaptersDir ?? defaultAdaptersDir();
  const repoRoot = resolve(join(adaptersDir, ".."));
  const force = deps.force ?? false;

  // Determine which tools to wire
  let targets: string[];
  const normalised = tools.filter((t) => t !== "--force");
  if (
    normalised.length === 0 ||
    normalised.includes("--all") ||
    normalised.includes("all")
  ) {
    targets = detectInstalledTools(configHome);
    if (targets.length === 0) {
      out(
        "ℹ️  No supported AI coding tools detected. Install Codex, Cursor, Copilot, or Gemini CLI first."
      );
      return 1;
    }
    out(`Detected tools: ${targets.join(", ")}`);
  } else {
    targets = normalised.filter((t) => ALL_TOOLS.includes(t));
    const unknown = normalised.filter((t) => !ALL_TOOLS.includes(t));
    if (unknown.length > 0) {
      out(`⚠️  Unknown tool(s): ${unknown.join(", ")}. Supported: ${ALL_TOOLS.join(", ")}`);
    }
    if (targets.length === 0) return 1;
  }

  out("");

  const summary: Array<{ tool: string; result: WireResult }> = [];

  for (const tool of targets) {
    let result: WireResult;
    switch (tool) {
      case "codex":
        result = wireCodex(configHome, adaptersDir, force, out);
        break;
      case "cursor":
        result = wireCursor(configHome, adaptersDir, force, out);
        break;
      case "copilot":
        result = wireCopilot(configHome, adaptersDir, force, out);
        break;
      case "gemini":
        result = wireGemini(configHome, adaptersDir, force, out);
        break;
      case "claude-code":
        result = wireClaudeCode(configHome, repoRoot, force, out);
        break;
      case "opencode":
        result = wireOpenCode(configHome, repoRoot, force, out);
        break;
      default:
        out(`⚠️  Unknown tool: ${tool}`);
        result = "error";
    }
    summary.push({ tool, result });
    out("");
  }

  // Summary
  out("--- Summary ---");
  for (const { tool, result } of summary) {
    const icon =
      result === "wired" ? "✅" :
      result === "already" ? "✅" :
      result === "manual" ? "ℹ️ " :
      result === "conflict" ? "⚠️ " :
      "❌";
    const label =
      result === "wired" ? "connected" :
      result === "already" ? "already connected" :
      result === "manual" ? "manual step required" :
      result === "conflict" ? "conflict — manual step required" :
      "skipped (not installed)";
    out(`  ${icon}  ${tool}: ${label}`);
  }

  const allErrored = summary.every((s) => s.result === "error");
  return allErrored ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
