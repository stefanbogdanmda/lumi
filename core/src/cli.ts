import { join } from "node:path";
import { writeFileSync, statSync, readFileSync } from "node:fs";
import * as http from "node:http";
import { spawn } from "node:child_process";
import { JsonFileProfile } from "./profile";
import { JsonFileCache } from "./cache";
import { lumiHome } from "./paths";
import { levelFromCount } from "./level";
import { renderGlossary } from "./glossary";
import { dueForReview, recallQuestion } from "./review";
import { Lumi } from "./lumi";
import { FallbackGenerator, ClaudeCliGenerator, CodexCliGenerator, GeminiCliGenerator, MockGenerator } from "./generator";
import { CONCEPTS } from "./concepts";
import { LessonGenerator } from "./types";
import { extractSignals } from "./transcript";
import { suggestConcepts } from "./detector";
import { topicCategories, topicsInCategory, categoryLabel, relatedConcepts } from "./topics";
import { appendEvent, lessonEvent } from "./feed";
import { milestoneFor } from "./milestones";
import { createOverlayServer } from "./server";
import { doctorReport } from "./doctor";
import { learningStats } from "./stats";
import { runAdvise } from "./advise";
import { runPrompt } from "./prompt";
import { runSetup, detectInstalledTools } from "./setup";
import { homedir } from "node:os";
import { listPaths, allPathsProgress, nextAcrossPaths } from "./curriculum";
import { progressCardFromProfile } from "./card";
import { detectRisks, riskLessonHint } from "./risk";
import { auditRisks } from "./audit";
import { auditPath } from "./scan";
import { dailyGoalStatus, earnedBadges, JsonFileHabitStore, streakWithFreeze } from "./habit";
import { weeklyDigest, renderDigestText, renderDigestHtml } from "./digest";
import { certificateFromProfile, isCertificateEligible } from "./certificate";
import { detectStuck, unstuckAdvice } from "./unstuck";
import { learnMoreUrl } from "./learnmore";
import { verifyLicense, currentEntitlement, JsonFileLicenseStore, LicenseResult } from "./license";
import { allowed, upgradeMessage } from "./entitlements";
import { exportBundle, importBundle } from "./portability";
import { onboardingGuide } from "./onboarding";

/** Read all of process stdin as a string; returns "" if nothing is piped (TTY). */
export async function readStdin(stream: NodeJS.ReadableStream = process.stdin): Promise<string> {
  if ("isTTY" in stream && stream.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export interface CliDeps {
  home?: string;
  out?: (s: string) => void;
  generator?: LessonGenerator;
  input?: string;
  claudeAvailable?: boolean;
  entitlement?: LicenseResult;
}

/** Build a simple ASCII progress bar of width 10. */
function buildBar(done: number, total: number): string {
  const width = 10;
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

/** Pick the lesson generator for a feed --source, with a Mock fallback so it never hard-fails offline. */
export function generatorForSource(source: string): LessonGenerator {
  const primary =
    source === "codex" ? new CodexCliGenerator() :
    source === "gemini" ? new GeminiCliGenerator() :
    new ClaudeCliGenerator(); // claude-code/claude + sensible default for the rest
  return new FallbackGenerator(primary, new MockGenerator());
}

const HELP = `Lumi — your AI mini-teacher

Usage:
  lumi progress             Show how many concepts you've learned and your level
  lumi stats                Show learning stats: streak, topics, recent concepts
  lumi glossary             Print your personal glossary
  lumi topics [<category>]  Browse everything Lumi can teach (or one category)
  lumi explain "<term>"     Explain a specific concept now
  lumi next                 Suggest what to build next — and why — for where you're at
  lumi prompt "<idea>"      Turn a rough idea into a clear, ready-to-paste prompt
  lumi review               Show concepts due for a refresher
  lumi feed [--source S]    Detect concepts from captured tool output and write lesson events to the feed
  lumi path                 Show learning path progress and your next recommended concept
  lumi card [--out <file>]  Generate a shareable SVG progress card
  lumi check                Run a security lens over piped input and flag risky patterns
  lumi audit [--path <dir>] Grade piped output — or scan a whole project — for security safety (A–F)
  lumi goal [<n>]           View or set your daily learning goal (concepts per day)
  lumi digest [--rich]      Print your weekly learning recap (Pro: --rich for HTML output)
  lumi freeze [--add]       Show or bank streak-freeze tokens (Pro)
  lumi certificate [--out]  Generate a shareable "Lumi Verified" certificate (at 10+ concepts)
  lumi unstuck              Spot an AI fix-loop in piped output and coach a way forward
  lumi serve [--port N]     Start the web overlay server (default port 4321)
  lumi setup [tool|--all]   Connect Lumi to your AI tool(s) automatically (Codex, Cursor, …)
  lumi export [--out <f>]   Save your learning to a file (move it between machines)
  lumi import <file>        Merge a Lumi export into this machine (never overwrites)
  lumi doctor               Check that Lumi is set up correctly
  lumi welcome              Show the getting-started guide
  lumi upgrade              See what's in Lumi Pro and how to get a key
  lumi license [<key>]      View your license status, or activate a Pro license key`;

export async function runCli(argv: string[], deps: CliDeps = {}): Promise<number> {
  const out = deps.out ?? ((s: string) => console.log(s));
  const home = deps.home ?? lumiHome();
  const ent = deps.entitlement ?? currentEntitlement({ home });
  const profile = new JsonFileProfile(join(home, "profile.json"));
  const cmd = (argv[0] ?? "").toLowerCase();
  switch (cmd) {
    case "stats": {
      const learnedList = profile.listLearned();
      if (learnedList.length === 0) {
        out("No stats yet — start building and Lumi will track your progress.");
        return 0;
      }
      const s = learningStats(learnedList);
      out("📊 Your Lumi stats");
      out(`Learned: ${s.total} concept${s.total === 1 ? "" : "s"} (level: ${s.level})`);
      // Daily goal progress and Pro freeze-protected streak (resilient to missing habit file)
      try {
        const habitStore = new JsonFileHabitStore(join(home, "habit.json"));
        const habitState = habitStore.getState();
        if (allowed("streak-freeze", ent)) {
          // Pro: show freeze-protected streak
          const sff = streakWithFreeze(learnedList, habitState);
          const freezeSuffix = ` (❄️ ${sff.freezesAvailable} freeze${sff.freezesAvailable === 1 ? "" : "s"} banked)`;
          out(`🔥 Current streak: ${sff.streakDays} day${sff.streakDays === 1 ? "" : "s"}${freezeSuffix}`);
        } else {
          out(`🔥 Current streak: ${s.streakDays} day${s.streakDays === 1 ? "" : "s"}`);
        }
        const goal = habitState.dailyGoal;
        if (goal > 0) {
          const gs = dailyGoalStatus(learnedList, goal);
          out(`Today: ${gs.todayCount}/${goal} concepts${gs.met ? " ✓" : ""}`);
        }
      } catch {
        // missing or corrupt habit.json — fall back to plain streak
        out(`🔥 Current streak: ${s.streakDays} day${s.streakDays === 1 ? "" : "s"}`);
      }
      if (s.byCategory.length > 0) {
        out("By topic:");
        for (const cat of s.byCategory) out(`  ${cat.category}: ${cat.count}`);
      }
      if (s.recent.length > 0) {
        out("Recently learned:");
        for (const r of s.recent) out(`  • ${r.label} (${r.learnedAt.slice(0, 10)})`);
      }
      // Earned badges
      const badges = earnedBadges(learnedList, s.streakDays);
      if (badges.length > 0) {
        out("Badges:");
        for (const b of badges) out(`  🏅 ${b.label}`);
      }
      return 0;
    }
    case "progress": {
      const n = profile.listLearned().length;
      out(`You've learned ${n} concept${n === 1 ? "" : "s"}. Level: ${levelFromCount(n)}.`);
      const m = milestoneFor(n);
      if (m) out(m);
      return 0;
    }
    case "glossary": {
      out(renderGlossary(profile.listLearned()));
      return 0;
    }
    case "topics": {
      const learnedIds = profile.listLearned().map((c) => c.id);
      const arg = argv.slice(1).join(" ").trim();
      if (arg) {
        const inCat = topicsInCategory(arg, learnedIds);
        if (!inCat) {
          out(`No topic called "${arg}". Run \`lumi topics\` to see the list.`);
          return 1;
        }
        const known = inCat.filter((c) => c.learned).length;
        out(`${categoryLabel(arg.toLowerCase())} — ${inCat.length} concept${inCat.length === 1 ? "" : "s"}${known > 0 ? ` (${known} learned)` : ""}`);
        for (const c of inCat) out(`  ${c.learned ? "✓" : " "} ${c.label}`);
        out("");
        out(`Learn one now:  lumi explain "${inCat[0].label}"`);
        return 0;
      }
      const cats = topicCategories();
      const total = cats.reduce((n, c) => n + c.count, 0);
      out(`📚 What Lumi can teach you — ${total} concepts across ${cats.length} topics`);
      out("");
      for (const c of cats) {
        out(`  ${c.label} (${c.count}) — e.g. ${c.examples.join(", ")}`);
      }
      out("");
      out("Drill into one:  lumi topics security");
      out('Learn one now:   lumi explain "API"');
      return 0;
    }
    case "review": {
      const due = dueForReview(profile.listLearned());
      if (due.length === 0) {
        out("Nothing to review — you're all caught up! 🎉");
        return 0;
      }
      const label = (id: string) => CONCEPTS.find((c) => c.id === id)?.label ?? id;
      out("Time for a quick refresher on:");
      for (const c of due) out(recallQuestion(label(c.id)));
      return 0;
    }
    case "explain": {
      const term = argv.slice(1).join(" ").trim();
      if (!term) {
        out('Usage: lumi explain "<term>"');
        return 1;
      }
      const cache = new JsonFileCache(join(home, "cache.json"));
      const generator = deps.generator ?? new FallbackGenerator(new ClaudeCliGenerator(), new MockGenerator());
      const lumi = new Lumi({ profile, cache, generator });
      // Snapshot what's already learned before explain() marks this term learned,
      // so the "related" trail reflects genuine prior knowledge.
      const learnedBefore = profile.listLearned().map((c) => c.id);
      const lesson = await lumi.explain(term);
      if (!lesson) {
        out(`I don't have a lesson for "${term}" yet.`);
        const suggestions = suggestConcepts(term);
        if (suggestions.length > 0) {
          out(`Did you mean: ${suggestions.map((s) => `"${s.label}"`).join(", ")}?`);
          out(`Try:  lumi explain "${suggestions[0].label}"`);
        } else {
          out("Browse everything Lumi can teach:  lumi topics");
        }
        return 0;
      }
      out(`🪄 ${lesson.title}\n\n${lesson.plainExplanation}\nWhy it matters: ${lesson.whyItMatters}`);
      const concept = CONCEPTS.find((c) => c.id === lesson.conceptId);
      if (concept) out(`Learn more: ${learnMoreUrl(concept)}`);
      const related = relatedConcepts(lesson.conceptId, learnedBefore);
      if (related.length > 0) {
        out(`Related: ${related.map((r) => `"${r.label}"`).join(", ")}`);
      }
      return 0;
    }
    case "next": {
      const sourceIdx = argv.indexOf("--source");
      const source = sourceIdx >= 0 ? (argv[sourceIdx + 1] ?? "claude") : "claude";
      return runAdvise({ home, out, source });
    }
    case "prompt": {
      const sourceIdx = argv.indexOf("--source");
      const source = sourceIdx >= 0 ? (argv[sourceIdx + 1] ?? "claude") : "claude";
      // Strip --source <val> before joining the rest as the idea
      const remaining = argv.slice(1).filter((_, i, arr) => {
        if (arr[i] === "--source") return false;
        if (i > 0 && arr[i - 1] === "--source") return false;
        return true;
      });
      const idea = remaining.join(" ");
      const level = levelFromCount(profile.listLearned().length);
      return runPrompt(idea, { out, source, level });
    }
    case "feed": {
      const sourceIdx = argv.indexOf("--source");
      const source = sourceIdx >= 0 ? (argv[sourceIdx + 1] ?? "unknown") : "unknown";
      const input = deps.input ?? "";
      const cache = new JsonFileCache(join(home, "cache.json"));
      const generator = deps.generator ?? generatorForSource(source);
      const lumi = new Lumi({ profile, cache, generator });
      const sig = extractSignals(input);
      const signals = (sig.text || sig.commands?.length || sig.files?.length) ? sig : { text: input };
      const lessons = await lumi.processSignals(signals);
      const level = levelFromCount(profile.listLearned().length);
      const feedFile = join(home, "feed.jsonl");
      for (const l of lessons) {
        appendEvent(feedFile, lessonEvent({ source, concept: l.conceptId, level,
          lesson: {
            title: l.title,
            plainExplanation: l.plainExplanation,
            whyItMatters: l.whyItMatters,
            ...(l.analogy ? { analogy: l.analogy } : {}),
            ...(l.tinyExample ? { tinyExample: l.tinyExample } : {}),
          } }));
        // Record the concept as learned so the overlay/hook pipeline (which uses
        // `lumi feed`) populates the profile just like inline mode does. Without
        // this, progress/stats/next/streaks stay empty and concepts re-teach
        // every turn because processSignals filters on profile.hasLearned().
        profile.markLearned(l.conceptId);
      }
      out(`${lessons.length} lesson event(s) written to feed.`);
      return 0;
    }
    case "setup": {
      const force = argv.includes("--force");
      const tools = argv.slice(1).filter((t) => t !== "--force");
      return runSetup(tools, { out, force });
    }
    case "doctor": {
      const claudeAvailable = deps.claudeAvailable ?? await detectClaude();
      const tools = detectInstalledTools(homedir());
      out(doctorReport({ home, claudeAvailable, tools, tier: ent.tier, expires: ent.expires }));
      return 0;
    }
    case "export": {
      const bundle = exportBundle(home);
      const json = JSON.stringify(bundle, null, 2);
      const outIdx = argv.indexOf("--out");
      if (outIdx >= 0) {
        const file = argv[outIdx + 1];
        if (!file) { out("Usage: lumi export [--out <file>]"); return 1; }
        writeFileSync(file, json);
        out(`Exported ${bundle.profile.length} learned concept(s) to ${file}. Move it to another machine and run \`lumi import <file>\`.`);
      } else {
        out(json);
      }
      return 0;
    }
    case "import": {
      const file = argv[1];
      if (!file) { out("Usage: lumi import <file>"); return 1; }
      if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
        out(`Could not read file: ${file}`); return 1;
      }
      let bundle;
      try {
        bundle = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        out(`That file isn't valid JSON: ${file}`); return 1;
      }
      try {
        const res = importBundle(home, bundle);
        out(`Imported ${res.added} new concept${res.added === 1 ? "" : "s"} (${res.total} total). Your learning is now in sync on this machine.`);
        return 0;
      } catch (e) {
        out((e as Error).message); return 1;
      }
    }
    case "serve": {
      const portIdx = argv.indexOf("--port");
      const portRaw = portIdx >= 0 ? parseInt(argv[portIdx + 1] ?? "4321", 10) : 4321;
      if (!Number.isInteger(portRaw) || isNaN(portRaw)) {
        out("Error: --port must be a valid integer");
        return 1;
      }
      startServer(portRaw, { home, generator: deps.generator }, out);
      return 0;
    }
    case "path": {
      const learnedList = profile.listLearned();
      const learnedIds = learnedList.map((c) => c.id);
      const progressList = allPathsProgress(learnedIds);
      const paths = listPaths();
      const proAllPaths = allowed("all-paths", ent);

      if (proAllPaths) {
        // Pro: show all paths with full progress
        for (const p of paths) {
          const pp = progressList.find((pr) => pr.pathId === p.id) ?? { done: 0, total: p.conceptIds.length, pct: 0 };
          const bar = buildBar(pp.done, pp.total);
          out(`${p.title}: ${pp.done}/${pp.total} (${pp.pct.toFixed(0)}%) ${bar}`);
        }
        out("");

        if (learnedList.length === 0) {
          out("Start building and Lumi will track your path progress here!");
        }

        // Next across all paths
        const next = nextAcrossPaths(learnedIds);
        if (next) {
          const label = CONCEPTS.find((c) => c.id === next.conceptId)?.label ?? next.conceptId;
          out(`Next up: ${label}`);
        }
      } else {
        // Free: show first path in full, lock the rest
        const [firstPath, ...lockedPaths] = paths;
        if (firstPath) {
          const pp = progressList.find((pr) => pr.pathId === firstPath.id) ?? { done: 0, total: firstPath.conceptIds.length, pct: 0 };
          const bar = buildBar(pp.done, pp.total);
          out(`${firstPath.title}: ${pp.done}/${pp.total} (${pp.pct.toFixed(0)}%) ${bar}`);
        }
        for (const p of lockedPaths) {
          out(`${p.title}: 🔒 Pro — unlock all paths`);
        }
        out("");

        if (learnedList.length === 0) {
          out("Start building and Lumi will track your path progress here!");
        }

        // Next up from the first path only
        if (firstPath) {
          const firstProgress = progressList.find((pr) => pr.pathId === firstPath.id);
          const nextConceptId = firstProgress?.nextConceptId ?? null;
          if (nextConceptId) {
            const label = CONCEPTS.find((c) => c.id === nextConceptId)?.label ?? nextConceptId;
            out(`Next up: ${label}`);
          }
        }
      }
      return 0;
    }
    case "card": {
      const outIdx = argv.indexOf("--out");
      // If --out is present but has no following argument, print usage and bail
      if (outIdx >= 0 && (outIdx + 1 >= argv.length || argv[outIdx + 1].startsWith("-"))) {
        out("Usage: lumi card [--out <file>]");
        return 1;
      }
      const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
      const learnedList = profile.listLearned();
      const svg = progressCardFromProfile(learnedList);
      if (outPath) {
        writeFileSync(outPath, svg, "utf8");
        out(`Progress card written to ${outPath}`);
      } else {
        out(svg);
      }
      return 0;
    }
    case "check": {
      const input = deps.input ?? "";
      const risks = detectRisks(input);
      if (risks.length === 0) {
        out("✅ No risky patterns spotted in that output.");
        return 0;
      }
      for (const risk of risks) {
        const marker = risk.severity === "danger" ? "🚨" : risk.severity === "warn" ? "⚠️" : "ℹ️";
        out(`${marker} ${risk.label} (${risk.severity})`);
        out(`   ${riskLessonHint(risk.conceptId)}`);
      }
      return 0;
    }
    case "audit": {
      const verdicts: Record<string, string> = {
        A: "🟢 Looks safe",
        B: "🟡 Minor issues — worth reviewing",
        C: "🟠 Several issues — fix before sharing",
        D: "🔴 Serious issue — fix before sharing",
        F: "🔴 Serious issues — fix before sharing",
      };

      // `--path <dir>`: scan a real project directory instead of piped input.
      const pathIdx = argv.indexOf("--path");
      if (pathIdx >= 0) {
        // Pro gate for project-wide scan
        if (!allowed("project-scan", ent)) {
          out(upgradeMessage("project-scan"));
          return 0;
        }
        const dir = argv[pathIdx + 1];
        if (!dir) {
          out("Usage: lumi audit --path <directory>");
          return 1;
        }
        // Check the directory exists and is readable before running the scan
        try {
          const st = statSync(dir);
          if (!st.isDirectory()) {
            out(`Could not read directory: ${dir}`);
            return 1;
          }
        } catch {
          out(`Could not read directory: ${dir}`);
          return 1;
        }
        const pr = auditPath(dir);
        if (pr.filesScanned === 0) {
          out("No files were scanned (empty or unreadable path).");
          return 0;
        }
        out(`Security Audit — Grade: ${pr.grade}  ${verdicts[pr.grade]}`);
        out(`Scanned ${pr.filesScanned} file${pr.filesScanned === 1 ? "" : "s"}.`);
        if (pr.total === 0) {
          out("No risky patterns detected — this is a fast pattern check, not a full security audit.");
          return 0;
        }
        out(`${pr.total} issue(s) in ${pr.files.length} file${pr.files.length === 1 ? "" : "s"}: ${pr.danger} high, ${pr.warn} medium`);
        for (const f of pr.files) {
          const flagged = f.hits.filter((h) => h.severity !== "info");
          if (flagged.length === 0) continue;
          out(`  ${f.path}`);
          for (const hit of flagged) {
            const marker = hit.severity === "danger" ? "🚨" : "⚠️";
            out(`    ${marker} ${hit.label}`);
          }
        }
        if (pr.topFixes.length > 0) {
          out("");
          out("Fix these first:");
          for (let i = 0; i < pr.topFixes.length; i++) {
            out(`  ${i + 1}. ${pr.topFixes[i].split(/\.\s/)[0]}.`);
          }
        }
        return 0;
      }

      const input = deps.input ?? "";
      const report = auditRisks(input);
      const { grade, total, danger, warn } = report;

      // Verdict line
      out(`Security Audit — Grade: ${grade}  ${verdicts[grade]}`);

      if (total === 0) {
        out("No risky patterns detected — this is a fast pattern check, not a full security audit.");
        return 0;
      }

      // Count line
      out(`${total} issue(s): ${danger} high, ${warn} medium`);

      // Per-hit lines (danger then warn)
      for (const hit of report.hits) {
        if (hit.severity === "info") continue; // info shown only in count, not listed
        const marker = hit.severity === "danger" ? "🚨" : "⚠️";
        out(`  ${marker} ${hit.label}`);
      }

      // topFixes
      if (report.topFixes.length > 0) {
        out("");
        out("Fix these first:");
        for (let i = 0; i < report.topFixes.length; i++) {
          // Trim to first sentence for brevity in the CLI output
          const firstSentence = report.topFixes[i].split(/\.\s/)[0] + ".";
          out(`  ${i + 1}. ${firstSentence}`);
        }
      }
      return 0;
    }
    case "goal": {
      const habitStore = new JsonFileHabitStore(join(home, "habit.json"));
      const arg = argv[1];
      if (arg === undefined) {
        // Show current goal and today's status
        const goal = habitStore.getState().dailyGoal;
        const learnedList = profile.listLearned();
        const gs = dailyGoalStatus(learnedList, goal);
        out(`Daily goal: ${goal} concept${goal === 1 ? "" : "s"} per day`);
        out(`Today: ${gs.todayCount}/${goal}${gs.met ? " ✓ Goal met!" : ` (${gs.remaining} more to go)`}`);
        return 0;
      }
      // Accept only plain positive integers (no floats, no scientific notation, no trailing text)
      const GOAL_CAP = 100;
      const isPlainPositiveInt = /^\d+$/.test(arg);
      const n = isPlainPositiveInt ? parseInt(arg, 10) : NaN;
      if (!isPlainPositiveInt || isNaN(n) || n <= 0 || n > GOAL_CAP) {
        out("Usage: lumi goal [<n>]  — set daily learning goal to a positive integer (1–100)");
        return 1;
      }
      habitStore.setDailyGoal(n);
      out(`Daily goal set to ${n} concept${n === 1 ? "" : "s"} per day.`);
      return 0;
    }
    case "digest": {
      const rich = argv.includes("--rich");
      if (rich) {
        if (!allowed("rich-digest", ent)) {
          out(upgradeMessage("rich-digest"));
          return 0;
        }
        out(renderDigestHtml(weeklyDigest(profile.listLearned())));
        return 0;
      }
      out(renderDigestText(weeklyDigest(profile.listLearned())));
      return 0;
    }
    case "freeze": {
      // Pro gate — both sub-commands require Pro
      if (!allowed("streak-freeze", ent)) {
        out(upgradeMessage("streak-freeze"));
        return 0;
      }
      const habitStore = new JsonFileHabitStore(join(home, "habit.json"));
      const addFreeze = argv.includes("--add");
      if (addFreeze) {
        habitStore.addFreezes(1);
        const newTotal = habitStore.getState().freezes;
        out(`Freeze banked! You now have ${newTotal} streak freeze${newTotal === 1 ? "" : "s"} available.`);
        return 0;
      }
      // Show status: banked count + freeze-protected streak
      const habitState = habitStore.getState();
      const sff = streakWithFreeze(profile.listLearned(), habitState);
      out(`❄️  Streak freezes banked: ${sff.freezesAvailable}`);
      out(`🔥 Freeze-protected streak: ${sff.streakDays} day${sff.streakDays === 1 ? "" : "s"}${sff.savedByFreeze ? " (a freeze is protecting your streak!)" : ""}`);
      return 0;
    }
    case "certificate": {
      const learnedList = profile.listLearned();
      // Eligibility gate first — no point showing upgrade msg for 2 concepts
      if (!isCertificateEligible(learnedList.length)) {
        out(`Keep going! Your Lumi certificate unlocks at 10 concepts — you have ${learnedList.length}.`);
        return 0;
      }
      // Pro gate — eligible but not Pro
      if (!allowed("certificate", ent)) {
        out(upgradeMessage("certificate"));
        return 0;
      }
      const nameIdx = argv.indexOf("--name");
      const nameVal = nameIdx >= 0 ? argv[nameIdx + 1] : undefined;
      const name = nameVal && !nameVal.startsWith("--") ? nameVal : undefined;
      const svg = certificateFromProfile(learnedList, name ? { name } : {});
      const outIdx = argv.indexOf("--out");
      if (outIdx >= 0) {
        const outPath = argv[outIdx + 1];
        if (!outPath || outPath.startsWith("--")) {
          out('Usage: lumi certificate [--out <file>] [--name "<name>"]');
          return 1;
        }
        writeFileSync(outPath, svg);
        out(`Certificate written to ${outPath}`);
      } else {
        out(svg);
      }
      return 0;
    }
    case "upgrade": {
      out(`✨ Lumi Pro — $8/mo or $60/yr (save ~38%)

Lumi will always teach you for free. Pro is for when you want
proof, the full path, and your progress everywhere:

  🎓 Certificates        "Lumi Verified" milestones you can share
  🗺️  All learning paths  the whole curriculum, not just your first
  🔍 lumi audit --path   scan your whole project, not one snippet
  🔥 Streak freeze        protect your streak + set custom goals
  ☁️  Cloud sync          your progress on every machine   (coming)
  📬 Weekly digest email  a rich recap in your inbox        (coming)

What stays free, forever:
  every lesson · cross-tool memory · the security lens ·
  spaced review · streaks · daily goal · the coach · your first path

Students & bootcamp learners: 50% off. Regional pricing available.

  Upgrade →  https://lumi.dev/pro      (cancel anytime)
  Not now →  just keep building; Lumi keeps teaching for free.`);
      return 0;
    }
    case "license": {
      const keyArg = argv[1];
      if (keyArg) {
        // Activate a license key
        const r = verifyLicense(keyArg);
        if (r.valid) {
          new JsonFileLicenseStore(join(home, "license.json")).setKey(keyArg);
          let msg = "✨ Lumi Pro activated — thanks!";
          if (r.email) msg += ` Licensed to: ${r.email}.`;
          if (r.expires) msg += ` Expires: ${r.expires}.`;
          out(msg);
          return 0;
        } else {
          out(`That license key isn't valid (${r.reason ?? "unknown reason"}).`);
          return 1;
        }
      } else {
        // Show current license status
        if (ent.valid && ent.tier === "pro") {
          let msg = "Lumi Pro — active.";
          if (ent.email) msg += ` Licensed to: ${ent.email}.`;
          if (ent.expires) msg += ` Expires: ${ent.expires}.`;
          out(msg);
        } else {
          out("You're on the free plan. Run `lumi upgrade` to see what's in Pro.");
        }
        return 0;
      }
    }
    case "unstuck": {
      out(unstuckAdvice(detectStuck(deps.input ?? "")));
      return 0;
    }
    case "welcome":
      out(onboardingGuide());
      return 0;
    case "":
      // First run (nothing learned yet) → a friendly welcome; returning users → help.
      if (profile.listLearned().length === 0) { out(onboardingGuide()); return 0; }
      out(HELP);
      return 0;
    case "help":
    case "--help":
    case "-h":
      out(HELP);
      return 0;
    default:
      out(`Unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

/** Detect whether the `claude` CLI is available by spawning `claude --version`. */
function detectClaude(bin = "claude"): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const c = spawn(bin, ["--version"], { stdio: "ignore" });
      const t = setTimeout(() => { c.kill(); resolve(false); }, 3000);
      c.on("error", () => { clearTimeout(t); resolve(false); });
      c.on("close", (code) => { clearTimeout(t); resolve(code === 0); });
    } catch { resolve(false); }
  });
}

/** Start the overlay server bound to 127.0.0.1 and return the listening server instance. */
export function startServer(
  port: number,
  deps: CliDeps = {},
  out: (s: string) => void = (s) => console.log(s)
): http.Server {
  const home = deps.home ?? lumiHome();
  const server = createOverlayServer({ home, generator: deps.generator });
  server.listen(port, "127.0.0.1", () => {
    out(`Lumi overlay running at http://localhost:${port}`);
  });
  return server;
}
