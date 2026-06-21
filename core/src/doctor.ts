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
  const checks: string[] = [];
  // 1. claude CLI
  checks.push(input.claudeAvailable
    ? "✅ Claude CLI found — lessons will be tailored by your Claude subscription."
    : "⚠️  Claude CLI not found — Lumi will still teach using basic offline lessons. Install Claude Code and sign in for richer, tailored lessons.");
  // 2. progress / profile
  const profileFile = join(input.home, "profile.json");
  if (existsSync(profileFile)) {
    const count = new JsonFileProfile(profileFile).listLearned().length;
    checks.push(`✅ Progress is being saved — you've learned ${count} concept${count === 1 ? "" : "s"} (level: ${levelFromCount(count)}). Stored in ${input.home}.`);
  } else {
    checks.push(`ℹ️  No learning history yet — it'll be created at ${profileFile} the first time Lumi teaches you.`);
  }
  // 3. feed (overlay/panel source)
  const feedFile = join(input.home, "feed.jsonl");
  if (existsSync(feedFile) && statSync(feedFile).size > 0) {
    checks.push("✅ Lesson feed is active — the overlay and VS Code panel can show live lessons.");
  } else {
    checks.push("ℹ️  No lesson feed yet — register the Lumi hook (or pipe a tool's output to `lumi feed`) so the overlay/panel light up. See docs/integrations.md.");
  }
  // 4. tools detected on this machine
  if (input.tools !== undefined) {
    if (input.tools.length > 0) {
      checks.push(`✅ AI tools detected: ${input.tools.join(", ")}. Run \`lumi setup --all\` to connect them so lessons stream automatically.`);
    } else {
      checks.push("ℹ️  No AI coding tool configs found yet — install one (Claude Code, Codex, Cursor, …) then run `lumi setup --all`.");
    }
  }
  // 5. plan
  if (input.tier === "pro") {
    checks.push(`✅ Lumi Pro is active${input.expires ? ` (until ${input.expires.slice(0, 10)})` : ""}. Thanks for supporting Lumi!`);
  } else if (input.tier === "free") {
    checks.push("ℹ️  You're on the free plan — everything you need to learn is included. `lumi upgrade` shows what Pro adds.");
  }

  // Lead with a clear bottom-line verdict so beginners know at a glance whether
  // they're ready. Only ⚠️ items are "to fix"; ℹ️ items are just informational.
  const warnings = checks.filter((c) => c.startsWith("⚠️")).length;
  const verdict = warnings === 0
    ? "✅ You're all set — Lumi is ready to teach."
    : `⚠️  Almost there — ${warnings} thing${warnings === 1 ? "" : "s"} to set up for the best experience (see below).`;

  return [
    "🩺 Lumi setup check",
    "",
    verdict,
    "",
    ...checks,
    "",
    "Next: run `lumi serve` and open the overlay, or just keep building with your AI tool.",
  ].join("\n");
}
