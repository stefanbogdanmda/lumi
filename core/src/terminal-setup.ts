/**
 * terminal-setup.ts — `lumi setup terminal`: wire shell profiles so plain
 * hand-typed commands flow to Lumi.
 *
 * Strategy: append ONE guarded block to the user's shell profile that
 * dot-sources the adapter hook file (adapters/terminal/lumi-terminal.{ps1,bash}).
 * The block is fenced by a marker so the installer is idempotent and never
 * clobbers existing profile content (append-only, with a one-time backup).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

export const TERMINAL_HOOK_MARKER = "# >>> lumi terminal hook >>>";
const TERMINAL_HOOK_END = "# <<< lumi terminal hook <<<";

export interface MergeResult {
  content: string;
  changed: boolean;
}

/** Append a guarded dot-source block, or return unchanged if the marker exists. */
export function mergeProfileHook(existing: string, dotSourceLine: string): MergeResult {
  if (existing.includes(TERMINAL_HOOK_MARKER)) {
    return { content: existing, changed: false };
  }
  const needsNl = existing.length > 0 && !existing.endsWith("\n");
  const block = [TERMINAL_HOOK_MARKER, dotSourceLine, TERMINAL_HOOK_END, ""].join("\n");
  return { content: existing + (needsNl ? "\n" : "") + block, changed: true };
}

type ShellName = "powershell" | "bash";

interface ShellTarget {
  name: ShellName;
  profile: string;       // absolute path to the profile file
  adapter: string;       // absolute path to the adapter hook file
  dotSource: string;     // line that sources the adapter
  undo: string;          // human instruction to remove the block
}

function bashTarget(configHome: string, adaptersDir: string): ShellTarget {
  const profile = join(configHome, ".bashrc");
  const adapter = resolve(join(adaptersDir, "terminal", "lumi-terminal.bash"));
  return {
    name: "bash",
    profile,
    adapter,
    dotSource: `. "${adapter}"`,
    undo: `remove the "lumi terminal hook" block from ${profile}`,
  };
}

function powershellTarget(configHome: string, adaptersDir: string): ShellTarget {
  const profile = join(configHome, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
  const adapter = resolve(join(adaptersDir, "terminal", "lumi-terminal.ps1"));
  return {
    name: "powershell",
    profile,
    adapter,
    dotSource: `. "${adapter}"`,
    undo: `remove the "lumi terminal hook" block from ${profile}`,
  };
}

function defaultAdaptersDir(): string {
  // __dirname is core/src or core/dist; repo root is two levels up.
  return join(resolve(join(__dirname, "..", "..")), "adapters");
}

/** Default shells for the current platform. */
function defaultShells(): ShellName[] {
  return process.platform === "win32" ? ["powershell", "bash"] : ["bash"];
}

export interface SetupTerminalDeps {
  configHome?: string;
  adaptersDir?: string;
  out?: (s: string) => void;
  /** Which shells to wire. Defaults to platform-appropriate set. */
  shells?: ShellName[];
}

/**
 * Install the terminal hook into the requested shell profiles.
 * Idempotent, append-only, backs up before modifying. Returns process exit code.
 */
export async function runSetupTerminal(deps: SetupTerminalDeps = {}): Promise<number> {
  const out = deps.out ?? ((s: string) => console.log(s));
  const configHome = deps.configHome ?? homedir();
  const adaptersDir = deps.adaptersDir ?? defaultAdaptersDir();
  const shells = deps.shells ?? defaultShells();

  const targets = shells.map((s) =>
    s === "powershell" ? powershellTarget(configHome, adaptersDir) : bashTarget(configHome, adaptersDir),
  );

  let wired = 0;
  let failures = 0;
  for (const t of targets) {
    if (!existsSync(t.adapter)) {
      out(`ℹ️  ${t.name}: adapter not found yet at ${t.adapter} — wiring the profile to that path anyway.`);
    }

    const existing = existsSync(t.profile) ? readFileSync(t.profile, "utf8") : "";
    const result = mergeProfileHook(existing, t.dotSource);

    if (!result.changed) {
      out(`✅ ${t.name}: already wired — Lumi is watching your terminal (${t.profile}).`);
      continue;
    }

    // Only back up the TRUE original once: never overwrite an existing backup,
    // otherwise a re-install would clobber the user's real original profile.
    const backupPath = `${t.profile}.lumi-bak`;
    const shouldBackup = existing.length > 0 && !existsSync(backupPath);

    try {
      mkdirSync(dirname(t.profile), { recursive: true });
      if (shouldBackup) writeFileSync(backupPath, existing);
      writeFileSync(t.profile, result.content, "utf8");
    } catch (e) {
      // A write failure for one shell must not throw an uncaught stack trace out
      // of the CLI — report it clearly and keep going with the other targets.
      failures++;
      out(`⚠️  ${t.name}: couldn't update ${t.profile} — ${(e as Error).message}`);
      out(`   Skipped this shell. Fix the path/permissions above and re-run \`lumi setup terminal\`.`);
      continue;
    }

    wired++;
    out(`✅ ${t.name}: added the Lumi terminal hook to ${t.profile}`);
    out(`   It dot-sources: ${t.dotSource}`);
    if (shouldBackup) out(`   Backed up your previous profile to ${backupPath}`);
    out(`   To undo: ${t.undo}`);
  }

  if (wired > 0) {
    out("");
    out("Open a new terminal, then run commands as usual — Lumi will start teaching from them.");
    out("Process them live with:  lumi watch   (or keep `lumi serve` running)");
  }
  return failures > 0 ? 1 : 0;
}
