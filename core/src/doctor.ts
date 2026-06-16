import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { JsonFileProfile } from "./profile";
import { levelFromCount } from "./level";

export interface DoctorInput {
  home: string;            // LUMI_HOME dir
  claudeAvailable: boolean; // whether the `claude` CLI was found
  /** AI tools detected on this machine (by config dir), e.g. ["codex","cursor"]. */
  tools?: string[];
  /** Current plan, for a quick status line. */
  tier?: "free" | "pro";
  /** ISO expiry, if a Pro license is time-limited. */
  expires?: string;
}

/** Build a friendly multi-line setup report. Pure: no spawning, no global state. */
export function doctorReport(input: DoctorInput): string {
  const lines: string[] = ["🩺 Lumi setup check", ""];
  // 1. claude CLI
  lines.push(input.claudeAvailable
    ? "✅ Claude CLI found — lessons will be tailored by your Claude subscription."
    : "⚠️  Claude CLI not found — Lumi will still teach using basic offline lessons. Install Claude Code and sign in for richer, tailored lessons.");
  // 2. progress / profile
  const profileFile = join(input.home, "profile.json");
  if (existsSync(profileFile)) {
    const count = new JsonFileProfile(profileFile).listLearned().length;
    lines.push(`✅ Progress is being saved — you've learned ${count} concept${count === 1 ? "" : "s"} (level: ${levelFromCount(count)}). Stored in ${input.home}.`);
  } else {
    lines.push(`ℹ️  No learning history yet — it'll be created at ${profileFile} the first time Lumi teaches you.`);
  }
  // 3. feed (overlay/panel source)
  const feedFile = join(input.home, "feed.jsonl");
  if (existsSync(feedFile) && statSync(feedFile).size > 0) {
    lines.push("✅ Lesson feed is active — the overlay and VS Code panel can show live lessons.");
  } else {
    lines.push("ℹ️  No lesson feed yet — register the Lumi hook (or pipe a tool's output to `lumi feed`) so the overlay/panel light up. See docs/integrations.md.");
  }
  // 4. tools detected on this machine
  if (input.tools !== undefined) {
    if (input.tools.length > 0) {
      lines.push(`✅ AI tools detected: ${input.tools.join(", ")}. Run \`lumi setup --all\` to connect them so lessons stream automatically.`);
    } else {
      lines.push("ℹ️  No AI coding tool configs found yet — install one (Claude Code, Codex, Cursor, …) then run `lumi setup --all`.");
    }
  }
  // 5. plan
  if (input.tier === "pro") {
    lines.push(`✅ Lumi Pro is active${input.expires ? ` (until ${input.expires.slice(0, 10)})` : ""}. Thanks for supporting Lumi!`);
  } else if (input.tier === "free") {
    lines.push("ℹ️  You're on the free plan — everything you need to learn is included. `lumi upgrade` shows what Pro adds.");
  }
  lines.push("", "Next: run `lumi serve` and open the overlay, or just keep building with your AI tool.");
  return lines.join("\n");
}
