/**
 * textmodel.ts — per-source text-model routing.
 *
 * Maps a `source` string (the tool name detected from the hook, e.g. "codex",
 * "gemini", "claude") to the CLI binary and argument-builder needed to call it.
 *
 * Conventions mirror CliGenerator in generator.ts:
 *   claude / claude-code / cursor / copilot / opencode / unknown / default
 *     → bin "claude",  args (p) => ["-p", p]
 *   codex
 *     → bin "codex",   args (p) => ["exec", p]
 *   gemini
 *     → bin "gemini",  args (p) => ["-p", p]
 */

import { spawn } from "node:child_process";

export interface TextModelSpec {
  bin: string;
  buildArgs: (prompt: string) => string[];
}

/**
 * Returns the bin + args-builder for the given source string.
 * Anything not explicitly mapped falls back to the claude CLI.
 */
export function resolveTextModel(source = "claude"): TextModelSpec {
  switch (source) {
    case "codex":
      return { bin: "codex", buildArgs: (p) => ["exec", p] };
    case "gemini":
      return { bin: "gemini", buildArgs: (p) => ["-p", p] };
    default:
      // claude, claude-code, cursor, copilot, opencode, unknown, or any future source
      return { bin: "claude", buildArgs: (p) => ["-p", p] };
  }
}

/**
 * Shells out to the appropriate CLI for the given source, returning trimmed stdout.
 *
 * Mirror of CliGenerator's spawn/timeout/error pattern (generator.ts):
 *  - clears timer on every terminal path
 *  - rejects on spawn error / timeout / non-zero exit
 *  - resolves trimmed stdout on success
 */
export function runTextModel(
  prompt: string,
  opts: { source?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { bin, buildArgs } = resolveTextModel(opts.source ?? "claude");
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const args = buildArgs(prompt);

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Lumi: '${bin}' CLI timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e: Error) => {
      clearTimeout(timer);
      reject(new Error(`Lumi: failed to run '${bin}': ${e.message}`));
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Lumi: '${bin}' CLI exited ${code}: ${err.slice(0, 200)}`));
      } else {
        resolve(out.trim());
      }
    });
  });
}
