/**
 * setup.test.ts — TDD for `lumi setup` module.
 *
 * All file-system operations use temp dirs so the real home dir is never touched.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runSetup,
  detectInstalledTools,
  mergeCodexNotify,
  mergeCursorHook,
  mergeCopilotHook,
  mergeGeminiHook,
  buildCopilotHooksJson,
} from "../src/setup";

// ---------------------------------------------------------------------------
// Shared temp-dir helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

/** A fake adapters dir that has the expected sub-dirs + stub scripts. */
let adaptersDir: string;
/** A fake configHome that we populate per-test. */
let configHome: string;

function setupTmpDir() {
  tmpDir = mkdtempSync(join(tmpdir(), "lumi-setup-test-"));
  configHome = join(tmpDir, "home");
  adaptersDir = join(tmpDir, "adapters");

  // Create fake adapter scripts
  for (const [tool, script] of [
    ["codex", "lumi-codex-hook.sh"],
    ["cursor", "lumi-cursor-hook.sh"],
    ["copilot", "lumi-copilot-hook.sh"],
    ["gemini", "lumi-gemini-hook.sh"],
  ]) {
    mkdirSync(join(adaptersDir, tool), { recursive: true });
    writeFileSync(join(adaptersDir, tool, script), "#!/bin/bash\necho ok\n");
  }
}

function teardownTmpDir() {
  rmSync(tmpDir, { recursive: true, force: true });
}

function lines(log: string[]): string {
  return log.join("\n");
}

// ---------------------------------------------------------------------------
// Pure helpers — mergeCodexNotify
// ---------------------------------------------------------------------------

describe("mergeCodexNotify", () => {
  const hookPath = "/abs/adapters/codex/lumi-codex-hook.sh";

  it("fresh empty file → inserts notify, changed=true, conflict=false", () => {
    const r = mergeCodexNotify("", hookPath);
    expect(r.changed).toBe(true);
    expect(r.conflict).toBe(false);
    expect(r.content).toContain(`notify = ["bash", "${hookPath}"]`);
  });

  it("file with other keys but no notify → prepends notify, preserves other content", () => {
    const existing = `# comment\nmodel = "claude"\n`;
    const r = mergeCodexNotify(existing, hookPath);
    expect(r.changed).toBe(true);
    expect(r.content).toContain(`notify = ["bash", "${hookPath}"]`);
    expect(r.content).toContain(`model = "claude"`);
  });

  it("file already has our exact notify → idempotent (changed=false, conflict=false)", () => {
    const existing = `notify = ["bash", "${hookPath}"]\n`;
    const r = mergeCodexNotify(existing, hookPath);
    expect(r.changed).toBe(false);
    expect(r.conflict).toBe(false);
    expect(r.content).toBe(existing);
  });

  it("file has a different notify value → conflict=true, content unchanged", () => {
    const existing = `notify = ["bash", "/other/tool/hook.sh"]\n`;
    const r = mergeCodexNotify(existing, hookPath);
    expect(r.changed).toBe(false);
    expect(r.conflict).toBe(true);
    expect(r.content).toBe(existing);
  });

  it("inserts before first [table] header when one exists", () => {
    const existing = `[model]\nname = "claude"\n`;
    const r = mergeCodexNotify(existing, hookPath);
    expect(r.changed).toBe(true);
    const notifyPos = r.content.indexOf("notify");
    const tablePos = r.content.indexOf("[model]");
    expect(notifyPos).toBeLessThan(tablePos);
  });

  it("false-positive guard: ordinary English 'notify' word in comment doesn't trigger", () => {
    // A comment with the word "notify" (not as a TOML key) should not be treated as a match
    const existing = `# This will notify the user\n`;
    const r = mergeCodexNotify(existing, hookPath);
    // "# This will notify" is not a TOML key assignment, so no conflict
    expect(r.conflict).toBe(false);
    expect(r.changed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — mergeCursorHook
// ---------------------------------------------------------------------------

describe("mergeCursorHook", () => {
  const hookPath = "/abs/adapters/cursor/lumi-cursor-hook.sh";

  it("fresh empty object → adds stop entry, changed=true", () => {
    const r = mergeCursorHook({}, hookPath);
    expect(r.changed).toBe(true);
    expect(r.conflict).toBe(false);
    const obj = JSON.parse(r.content);
    expect(obj.hooks.stop).toContainEqual({ command: hookPath });
  });

  it("already has our entry → idempotent (changed=false)", () => {
    const existing = {
      version: 1,
      hooks: { stop: [{ command: hookPath }] },
    };
    const r = mergeCursorHook(existing, hookPath);
    expect(r.changed).toBe(false);
    expect(r.conflict).toBe(false);
  });

  it("has a different stop entry → appends ours alongside (no conflict for Cursor)", () => {
    const existing = {
      version: 1,
      hooks: { stop: [{ command: "/other/hook.sh" }] },
    };
    const r = mergeCursorHook(existing, hookPath);
    expect(r.changed).toBe(true);
    const obj = JSON.parse(r.content);
    expect(obj.hooks.stop).toHaveLength(2);
    expect(obj.hooks.stop).toContainEqual({ command: hookPath });
  });

  it("preserves existing version and other hook types", () => {
    const existing = {
      version: 2,
      hooks: { start: [{ command: "/start.sh" }] },
    };
    const r = mergeCursorHook(existing, hookPath);
    const obj = JSON.parse(r.content);
    expect(obj.version).toBe(2);
    expect(obj.hooks.start).toEqual([{ command: "/start.sh" }]);
  });

  it("non-array stop value → conflict=true, original content preserved", () => {
    const existing = {
      version: 1,
      hooks: { stop: "some-string-value" },
    };
    const r = mergeCursorHook(existing as any, hookPath);
    expect(r.conflict).toBe(true);
    expect(r.changed).toBe(false);
    // Original data is preserved, not clobbered
    const parsed = JSON.parse(r.content);
    expect(parsed.hooks.stop).toBe("some-string-value");
  });

  it("object stop value → conflict=true, original content preserved", () => {
    const existing = {
      version: 1,
      hooks: { stop: { command: "/something.sh" } },
    };
    const r = mergeCursorHook(existing as any, hookPath);
    expect(r.conflict).toBe(true);
    expect(r.changed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — mergeCopilotHook
// ---------------------------------------------------------------------------

describe("mergeCopilotHook", () => {
  const hookPath = "/abs/adapters/copilot/lumi-copilot-hook.sh";

  it("empty string (fresh file) → writes correct template, changed=true", () => {
    const r = mergeCopilotHook("", hookPath);
    expect(r.changed).toBe(true);
    expect(r.conflict).toBe(false);
    const obj = JSON.parse(r.content);
    expect(obj.hooks.agentStop[0].bash).toBe(`bash "${hookPath}"`);
  });

  it("already wired → idempotent (changed=false)", () => {
    const initial = buildCopilotHooksJson(hookPath);
    const r = mergeCopilotHook(initial, hookPath);
    expect(r.changed).toBe(false);
    expect(r.conflict).toBe(false);
  });

  it("different bash path → conflict=true, content unchanged", () => {
    const initial = buildCopilotHooksJson("/other/hook.sh");
    const r = mergeCopilotHook(initial, hookPath);
    expect(r.changed).toBe(false);
    expect(r.conflict).toBe(true);
  });

  it("malformed JSON → treats as fresh write, changed=true (doesn't crash)", () => {
    const r = mergeCopilotHook("this is not json {{{{", hookPath);
    expect(r.changed).toBe(true);
    // Should produce valid JSON
    expect(() => JSON.parse(r.content)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Pure helpers — mergeGeminiHook
// ---------------------------------------------------------------------------

describe("mergeGeminiHook", () => {
  const hookPath = "/abs/adapters/gemini/lumi-gemini-hook.sh";

  it("fresh empty JSON → adds AfterAgent entry, changed=true", () => {
    const r = mergeGeminiHook("{}", hookPath);
    expect(r.changed).toBe(true);
    const obj = JSON.parse(r.content);
    const afterAgent = obj.hooks.AfterAgent as Array<Record<string, unknown>>;
    expect(afterAgent).toHaveLength(1);
    const subHooks = afterAgent[0].hooks as Array<Record<string, unknown>>;
    expect(subHooks[0].name).toBe("lumi-feed");
    expect(subHooks[0].command).toBe(`bash "${hookPath}"`);
  });

  it("already has lumi-feed entry → idempotent (changed=false)", () => {
    const initial = mergeGeminiHook("{}", hookPath).content;
    const r = mergeGeminiHook(initial, hookPath);
    expect(r.changed).toBe(false);
  });

  it("malformed JSON → starts fresh, doesn't crash", () => {
    const r = mergeGeminiHook("not json", hookPath);
    expect(r.changed).toBe(true);
    expect(() => JSON.parse(r.content)).not.toThrow();
  });

  it("preserves other existing hooks settings", () => {
    const existing = JSON.stringify({
      model: "gemini-pro",
      hooks: { BeforeAgent: [{ name: "other" }] },
    });
    const r = mergeGeminiHook(existing, hookPath);
    const obj = JSON.parse(r.content);
    expect(obj.model).toBe("gemini-pro");
    expect(obj.hooks.BeforeAgent).toEqual([{ name: "other" }]);
  });

  it("non-array AfterAgent value → conflict=true, original content preserved", () => {
    const existing = JSON.stringify({
      hooks: { AfterAgent: "some-string" },
    });
    const r = mergeGeminiHook(existing, hookPath);
    expect(r.conflict).toBe(true);
    expect(r.changed).toBe(false);
    // Original JSON is returned unchanged
    expect(r.content).toBe(existing);
  });

  it("object AfterAgent value → conflict=true, original content preserved", () => {
    const existing = JSON.stringify({
      hooks: { AfterAgent: { name: "some-hook" } },
    });
    const r = mergeGeminiHook(existing, hookPath);
    expect(r.conflict).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.content).toBe(existing);
  });
});

// ---------------------------------------------------------------------------
// detectInstalledTools
// ---------------------------------------------------------------------------

describe("detectInstalledTools", () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  it("empty configHome → returns []", () => {
    mkdirSync(configHome, { recursive: true });
    expect(detectInstalledTools(configHome)).toEqual([]);
  });

  it("only .codex present → returns ['codex']", () => {
    mkdirSync(join(configHome, ".codex"), { recursive: true });
    const tools = detectInstalledTools(configHome);
    expect(tools).toContain("codex");
    expect(tools).not.toContain("cursor");
    expect(tools).not.toContain("gemini");
  });

  it("multiple tool dirs present → returns all of them", () => {
    mkdirSync(join(configHome, ".codex"), { recursive: true });
    mkdirSync(join(configHome, ".cursor"), { recursive: true });
    mkdirSync(join(configHome, ".gemini"), { recursive: true });
    const tools = detectInstalledTools(configHome);
    expect(tools).toContain("codex");
    expect(tools).toContain("cursor");
    expect(tools).toContain("gemini");
  });

  it("non-tool dir does not cause false positive", () => {
    mkdirSync(join(configHome, ".someothertool"), { recursive: true });
    const tools = detectInstalledTools(configHome);
    expect(tools).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runSetup — integration tests using temp dirs
// ---------------------------------------------------------------------------

describe("runSetup", () => {
  beforeEach(setupTmpDir);
  afterEach(teardownTmpDir);

  // Helper: create a tool config dir so detection works
  function makeToolDir(tool: string) {
    const dirMap: Record<string, string> = {
      codex: ".codex",
      cursor: ".cursor",
      copilot: ".copilot",
      gemini: ".gemini",
      "claude-code": ".claude",
      opencode: ".config/opencode",
    };
    mkdirSync(join(configHome, dirMap[tool]), { recursive: true });
  }

  // Helper: read config file content
  function readConfig(relPath: string): string {
    return readFileSync(join(configHome, relPath), "utf8");
  }

  it("no tools installed → returns 1 and prints nothing-detected message", async () => {
    mkdirSync(configHome, { recursive: true });
    const log: string[] = [];
    const code = await runSetup([], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(1);
    expect(lines(log)).toContain("No supported AI coding tools detected");
  });

  // --- Codex ---

  it("codex: fresh wire → creates config.toml, exit 0", async () => {
    makeToolDir("codex");
    const log: string[] = [];
    const code = await runSetup(["codex"], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(0);
    const cfg = readConfig(".codex/config.toml");
    expect(cfg).toContain("lumi-codex-hook.sh");
    expect(lines(log)).toContain("connected to Codex");
  });

  it("codex: idempotent — second run reports 'already connected', no backup on second run", async () => {
    makeToolDir("codex");
    const log1: string[] = [];
    await runSetup(["codex"], { configHome, adaptersDir, out: (s) => log1.push(s) });

    const log2: string[] = [];
    await runSetup(["codex"], { configHome, adaptersDir, out: (s) => log2.push(s) });
    expect(lines(log2)).toContain("already connected");

    // Backup should NOT exist for second run (no change)
    expect(existsSync(join(configHome, ".codex", "config.toml.lumi-bak"))).toBe(false);
  });

  it("codex: backup written on first (real) change", async () => {
    makeToolDir("codex");
    // Pre-populate config with non-notify content
    writeFileSync(join(configHome, ".codex", "config.toml"), "model = \"claude\"\n");
    await runSetup(["codex"], { configHome, adaptersDir, out: () => {} });
    // Backup should exist
    expect(existsSync(join(configHome, ".codex", "config.toml.lumi-bak"))).toBe(true);
    // Backup matches original
    const bak = readFileSync(join(configHome, ".codex", "config.toml.lumi-bak"), "utf8");
    expect(bak).toContain('model = "claude"');
  });

  it("codex: non-clobber — foreign notify → conflict message, config unchanged", async () => {
    makeToolDir("codex");
    const original = `notify = ["bash", "/foreign/hook.sh"]\n`;
    writeFileSync(join(configHome, ".codex", "config.toml"), original);
    const log: string[] = [];
    await runSetup(["codex"], { configHome, adaptersDir, out: (s) => log.push(s) });
    // Config should be unchanged
    expect(readConfig(".codex/config.toml")).toBe(original);
    // Should have printed a manual instruction
    expect(lines(log)).toMatch(/manual|conflict|manually/i);
  });

  it("codex: --force overwrites a foreign notify", async () => {
    makeToolDir("codex");
    writeFileSync(
      join(configHome, ".codex", "config.toml"),
      `notify = ["bash", "/foreign/hook.sh"]\n`
    );
    const log: string[] = [];
    await runSetup(["codex"], {
      configHome,
      adaptersDir,
      force: true,
      out: (s) => log.push(s),
    });
    const cfg = readConfig(".codex/config.toml");
    expect(cfg).toContain("lumi-codex-hook.sh");
    expect(lines(log)).toContain("forced");
  });

  // --- Cursor ---

  it("cursor: fresh wire → creates hooks.json, exit 0", async () => {
    makeToolDir("cursor");
    const log: string[] = [];
    const code = await runSetup(["cursor"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(code).toBe(0);
    const cfg = JSON.parse(readConfig(".cursor/hooks.json"));
    expect(cfg.hooks.stop[0].command).toContain("lumi-cursor-hook.sh");
    expect(lines(log)).toContain("connected to Cursor");
  });

  it("cursor: idempotent — second run reports 'already connected'", async () => {
    makeToolDir("cursor");
    await runSetup(["cursor"], { configHome, adaptersDir, out: () => {} });
    const log: string[] = [];
    await runSetup(["cursor"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(lines(log)).toContain("already connected");
  });

  it("cursor: backup written on first change", async () => {
    makeToolDir("cursor");
    writeFileSync(
      join(configHome, ".cursor", "hooks.json"),
      JSON.stringify({ version: 1, hooks: { stop: [] } }, null, 2)
    );
    await runSetup(["cursor"], { configHome, adaptersDir, out: () => {} });
    expect(existsSync(join(configHome, ".cursor", "hooks.json.lumi-bak"))).toBe(true);
  });

  // --- Copilot ---

  it("copilot: fresh wire → creates ~/.copilot/hooks/lumi.json, exit 0", async () => {
    makeToolDir("copilot");
    const log: string[] = [];
    const code = await runSetup(["copilot"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(code).toBe(0);
    const cfg = JSON.parse(readConfig(".copilot/hooks/lumi.json"));
    expect(cfg.hooks.agentStop[0].bash).toContain("lumi-copilot-hook.sh");
    expect(lines(log)).toContain("connected to Copilot");
  });

  it("copilot: idempotent — second run reports 'already connected'", async () => {
    makeToolDir("copilot");
    await runSetup(["copilot"], { configHome, adaptersDir, out: () => {} });
    const log: string[] = [];
    await runSetup(["copilot"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(lines(log)).toContain("already connected");
  });

  it("copilot: non-clobber — foreign hook → conflict message, no overwrite", async () => {
    makeToolDir("copilot");
    mkdirSync(join(configHome, ".copilot", "hooks"), { recursive: true });
    const original = buildCopilotHooksJson("/foreign/hook.sh");
    writeFileSync(join(configHome, ".copilot", "hooks", "lumi.json"), original);
    const log: string[] = [];
    await runSetup(["copilot"], { configHome, adaptersDir, out: (s) => log.push(s) });
    const cfg = readConfig(".copilot/hooks/lumi.json");
    expect(cfg).toBe(original);
    expect(lines(log)).toMatch(/conflict|manual/i);
  });

  it("copilot: --force overwrites a foreign hook", async () => {
    makeToolDir("copilot");
    mkdirSync(join(configHome, ".copilot", "hooks"), { recursive: true });
    const original = buildCopilotHooksJson("/foreign/hook.sh");
    writeFileSync(join(configHome, ".copilot", "hooks", "lumi.json"), original);
    const log: string[] = [];
    await runSetup(["copilot"], {
      configHome,
      adaptersDir,
      force: true,
      out: (s) => log.push(s),
    });
    const cfg = JSON.parse(readConfig(".copilot/hooks/lumi.json"));
    expect(cfg.hooks.agentStop[0].bash).toContain("lumi-copilot-hook.sh");
    expect(lines(log)).toContain("connected to Copilot");
  });

  it("copilot: malformed JSON in existing file → doesn't crash, writes fresh config", async () => {
    makeToolDir("copilot");
    mkdirSync(join(configHome, ".copilot", "hooks"), { recursive: true });
    writeFileSync(
      join(configHome, ".copilot", "hooks", "lumi.json"),
      "this is not valid json {{{"
    );
    const log: string[] = [];
    // Should not throw
    const code = await runSetup(["copilot"], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(0);
    // Result should be valid JSON
    expect(() => JSON.parse(readConfig(".copilot/hooks/lumi.json"))).not.toThrow();
  });

  // --- Gemini ---

  it("gemini: fresh wire → creates settings.json, exit 0", async () => {
    makeToolDir("gemini");
    const log: string[] = [];
    const code = await runSetup(["gemini"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(code).toBe(0);
    const cfg = JSON.parse(readConfig(".gemini/settings.json"));
    expect(cfg.hooks.AfterAgent[0].hooks[0].name).toBe("lumi-feed");
    expect(lines(log)).toContain("connected to Gemini");
  });

  it("gemini: idempotent — second run reports 'already connected'", async () => {
    makeToolDir("gemini");
    await runSetup(["gemini"], { configHome, adaptersDir, out: () => {} });
    const log: string[] = [];
    await runSetup(["gemini"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(lines(log)).toContain("already connected");
  });

  it("gemini: preserves existing settings keys", async () => {
    makeToolDir("gemini");
    writeFileSync(
      join(configHome, ".gemini", "settings.json"),
      JSON.stringify({ model: "gemini-pro", temperature: 0.7 })
    );
    await runSetup(["gemini"], { configHome, adaptersDir, out: () => {} });
    const cfg = JSON.parse(readConfig(".gemini/settings.json"));
    expect(cfg.model).toBe("gemini-pro");
    expect(cfg.temperature).toBe(0.7);
  });

  it("gemini: malformed existing JSON → doesn't crash, writes valid config", async () => {
    makeToolDir("gemini");
    writeFileSync(join(configHome, ".gemini", "settings.json"), "{ broken json");
    const code = await runSetup(["gemini"], { configHome, adaptersDir, out: () => {} });
    expect(code).toBe(0);
    expect(() => JSON.parse(readConfig(".gemini/settings.json"))).not.toThrow();
  });

  // --- Claude-code (manual step) ---

  it("claude-code: prints manual instruction regardless, exit 0", async () => {
    makeToolDir("claude-code");
    const log: string[] = [];
    const code = await runSetup(["claude-code"], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(0);
    expect(lines(log)).toContain("manual step");
    expect(lines(log)).toContain("lumi-hook.sh");
  });

  // --- OpenCode (manual step) ---

  it("opencode: prints install instruction, exit 0", async () => {
    makeToolDir("opencode");
    const log: string[] = [];
    const code = await runSetup(["opencode"], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(0);
    expect(lines(log)).toMatch(/opencode|opencode\.json/i);
  });

  // --- --all flag ---

  it("--all: wires all detected tools", async () => {
    makeToolDir("codex");
    makeToolDir("gemini");
    const log: string[] = [];
    const code = await runSetup(["--all"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(code).toBe(0);
    const allOutput = lines(log);
    expect(allOutput).toContain("codex");
    expect(allOutput).toContain("gemini");
    // Both should be wired
    expect(existsSync(join(configHome, ".codex", "config.toml"))).toBe(true);
    expect(existsSync(join(configHome, ".gemini", "settings.json"))).toBe(true);
  });

  it("empty args (same as --all): wires all detected tools", async () => {
    makeToolDir("cursor");
    makeToolDir("copilot");
    const log: string[] = [];
    const code = await runSetup([], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(code).toBe(0);
    expect(existsSync(join(configHome, ".cursor", "hooks.json"))).toBe(true);
    expect(existsSync(join(configHome, ".copilot", "hooks", "lumi.json"))).toBe(true);
  });

  // --- Summary output ---

  it("summary block is always printed at end", async () => {
    makeToolDir("codex");
    const log: string[] = [];
    await runSetup(["codex"], { configHome, adaptersDir, out: (s) => log.push(s) });
    expect(lines(log)).toContain("Summary");
  });

  // --- Unknown tool ---

  it("unknown tool name → prints warning and returns 1", async () => {
    mkdirSync(configHome, { recursive: true });
    const log: string[] = [];
    const code = await runSetup(["nonexistenttool"], {
      configHome,
      adaptersDir,
      out: (s) => log.push(s),
    });
    expect(code).toBe(1);
    expect(lines(log)).toContain("Unknown");
  });
});
