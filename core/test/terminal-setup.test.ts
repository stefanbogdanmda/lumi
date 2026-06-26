import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeProfileHook, runSetupTerminal, TERMINAL_HOOK_MARKER } from "../src/terminal-setup";

describe("mergeProfileHook", () => {
  it("appends a guarded block when the marker is absent", () => {
    const res = mergeProfileHook("# my profile\n", '. "/repo/adapters/terminal/lumi-terminal.ps1"');
    expect(res.changed).toBe(true);
    expect(res.content).toContain(TERMINAL_HOOK_MARKER);
    expect(res.content).toContain('lumi-terminal.ps1');
    expect(res.content.startsWith("# my profile\n")).toBe(true); // never clobbers existing
  });

  it("is idempotent — no change when the marker is already present", () => {
    const once = mergeProfileHook("", '. "/x/lumi-terminal.bash"');
    const twice = mergeProfileHook(once.content, '. "/x/lumi-terminal.bash"');
    expect(twice.changed).toBe(false);
    expect(twice.content).toBe(once.content);
  });
});

describe("runSetupTerminal", () => {
  let dir: string;
  let configHome: string;
  let adaptersDir: string;
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lumi-term-setup-"));
    configHome = join(dir, "home");
    adaptersDir = join(dir, "adapters");
    mkdirSync(configHome, { recursive: true });
    lines.length = 0;
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates the bash profile and appends the guarded dot-source line", async () => {
    const code = await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    expect(code).toBe(0);
    const bashrc = join(configHome, ".bashrc");
    expect(existsSync(bashrc)).toBe(true);
    const content = readFileSync(bashrc, "utf8");
    expect(content).toContain(TERMINAL_HOOK_MARKER);
    expect(content).toContain("lumi-terminal.bash");
    // Reports what changed and how to undo
    expect(lines.join("\n").toLowerCase()).toContain("undo");
  });

  it("is idempotent across repeated runs (does not duplicate the block)", async () => {
    await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    const content = readFileSync(join(configHome, ".bashrc"), "utf8");
    const occurrences = content.split(TERMINAL_HOOK_MARKER).length - 1;
    expect(occurrences).toBe(1);
  });

  it("never clobbers an existing profile's content", async () => {
    const bashrc = join(configHome, ".bashrc");
    writeFileSync(bashrc, "export EXISTING=1\n");
    await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    const content = readFileSync(bashrc, "utf8");
    expect(content).toContain("export EXISTING=1");
    expect(content).toContain(TERMINAL_HOOK_MARKER);
  });

  it("installs the PowerShell profile when requested", async () => {
    const code = await runSetupTerminal({ configHome, adaptersDir, out, shells: ["powershell"] });
    expect(code).toBe(0);
    const ps1 = join(configHome, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    expect(existsSync(ps1)).toBe(true);
    expect(readFileSync(ps1, "utf8")).toContain("lumi-terminal.ps1");
  });

  it("preserves the ORIGINAL backup across re-installs (does not overwrite .lumi-bak)", async () => {
    const bashrc = join(configHome, ".bashrc");
    const bak = `${bashrc}.lumi-bak`;
    writeFileSync(bashrc, "export ORIGINAL=1\n");
    // First install backs up the true original.
    await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    expect(existsSync(bak)).toBe(true);
    expect(readFileSync(bak, "utf8")).toContain("export ORIGINAL=1");
    // Simulate the marker being removed so a second install rewrites the file…
    writeFileSync(bashrc, "export MUTATED=2\n");
    await runSetupTerminal({ configHome, adaptersDir, out, shells: ["bash"] });
    // …the backup must STILL be the very first original, not the mutated copy.
    expect(readFileSync(bak, "utf8")).toContain("export ORIGINAL=1");
    expect(readFileSync(bak, "utf8")).not.toContain("MUTATED");
  });

  it("returns non-zero and prints a friendly message when a profile cannot be written", async () => {
    // Point the bash profile at a path whose parent is a FILE, so mkdir/write fails.
    const fileAsDir = join(configHome, "not-a-dir");
    writeFileSync(fileAsDir, "x");
    const code = await runSetupTerminal({
      configHome: fileAsDir, // join(fileAsDir, ".bashrc") -> parent is a file
      adaptersDir,
      out,
      shells: ["bash"],
    });
    expect(code).not.toBe(0);
    const joined = lines.join("\n").toLowerCase();
    expect(joined).toContain("bash");
    expect(joined).toMatch(/could ?n.?t|failed|error|unable/);
  });
});
