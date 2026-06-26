import { homedir } from "node:os";
import { join } from "node:path";

/** Root directory for Lumi's shared state. Override with LUMI_HOME. */
export function lumiHome(): string {
  return process.env.LUMI_HOME?.trim() || join(homedir(), ".lumi");
}

export function profilePath(): string { return join(lumiHome(), "profile.json"); }
export function cachePath(): string { return join(lumiHome(), "cache.json"); }
export function feedPath(): string { return join(lumiHome(), "feed.jsonl"); }
export function terminalFile(): string { return join(lumiHome(), "terminal.jsonl"); }
