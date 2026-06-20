import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { runCli, readStdin } from "../src/cli";
import { JsonFileProfile } from "../src/profile";
import { MockGenerator } from "../src/generator";
import { LearnedConcept } from "../src/types";
import { FeedEvent } from "../src/feed";
import { JsonFileHabitStore } from "../src/habit";
import type { LicenseResult } from "../src/license";

const dayMs = 86_400_000;

describe("readStdin", () => {
  it("readStdin concatenates a piped stream", async () => {
    const s = Readable.from([Buffer.from("hello "), Buffer.from("world")]);
    expect(await readStdin(s as any)).toBe("hello world");
  });

  it("readStdin returns empty string for a TTY", async () => {
    const s: any = Readable.from([]); s.isTTY = true;
    expect(await readStdin(s)).toBe("");
  });
});

describe("runCli", () => {
  let home: string;
  let out: string[];
  const sink = (s: string) => out.push(s);
  const text = () => out.join("\n");

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "lumi-cli-"));
    out = [];
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  const seed = (...ids: string[]) => {
    const profile = new JsonFileProfile(join(home, "profile.json"));
    for (const id of ids) profile.markLearned(id);
  };

  it("progress reports the learned count and a level word", async () => {
    seed("git-commit", "git-push");
    const code = await runCli(["progress"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("2 concepts");
    expect(text()).toMatch(/beginner|growing|confident/);
  });

  it("progress singularizes a single concept", async () => {
    seed("git-commit");
    await runCli(["progress"], { home, out: sink });
    expect(text()).toContain("1 concept.");
  });

  it("glossary prints the glossary header", async () => {
    seed("git-commit");
    const code = await runCli(["glossary"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("# My Lumi Glossary");
  });

  it("review lists a concept that is due for a refresher", async () => {
    const old = new Date(Date.now() - 30 * dayMs).toISOString();
    const learned: LearnedConcept[] = [{ id: "git-commit", learnedAt: old, seenCount: 1 }];
    writeFileSync(join(home, "profile.json"), JSON.stringify(learned, null, 2), "utf8");
    const code = await runCli(["review"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Time for a quick refresher on:");
    expect(text()).toContain("Git commit");
  });

  it("review says caught up with a fresh/empty profile", async () => {
    const code = await runCli(["review"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("caught up");
  });

  it("review presents an active-recall prompt using recallQuestion for due concepts", async () => {
    const old = new Date(Date.now() - 30 * dayMs).toISOString();
    const learned: LearnedConcept[] = [{ id: "git-commit", learnedAt: old, seenCount: 1 }];
    writeFileSync(join(home, "profile.json"), JSON.stringify(learned, null, 2), "utf8");
    const code = await runCli(["review"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Do you remember");
    expect(text()).toContain("Git commit");
  });

  it("explain teaches a term and records it in the profile", async () => {
    const code = await runCli(["explain", "git commit"], {
      home,
      out: sink,
      generator: new MockGenerator(),
    });
    expect(code).toBe(0);
    expect(text()).toContain("Git commit");
    const profile = new JsonFileProfile(join(home, "profile.json"));
    expect(profile.listLearned().map((c) => c.id)).toContain("git-commit");
  });

  it("explain shows a Related trail of sibling concepts", async () => {
    const code = await runCli(["explain", "git commit"], {
      home,
      out: sink,
      generator: new MockGenerator(),
    });
    expect(code).toBe(0);
    expect(text()).toContain("Related:");
  });

  it("explain with no term returns 1", async () => {
    const code = await runCli(["explain"], { home, out: sink, generator: new MockGenerator() });
    expect(code).toBe(1);
    expect(text()).toContain("Usage: lumi explain");
  });

  it("explain with an unknown term says it has no lesson", async () => {
    const code = await runCli(["explain", "definitely-not-a-concept"], {
      home,
      out: sink,
      generator: new MockGenerator(),
    });
    expect(code).toBe(0);
    expect(text()).toContain("don't have a lesson");
  });

  it("topics lists all categories with counts", async () => {
    const code = await runCli(["topics"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("What Lumi can teach you");
    expect(text()).toContain("Security & safety");
    expect(text()).toContain("Git & version control");
  });

  it("topics <category> lists concepts and marks learned ones", async () => {
    seed("git-commit");
    const code = await runCli(["topics", "git"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Git & version control");
    expect(text()).toContain("✓ Git commit");
  });

  it("topics with an unknown category returns 1 and points to the list", async () => {
    const code = await runCli(["topics", "nonsense"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toContain("lumi topics");
  });

  it("explain with an unrecognized term points to lumi topics", async () => {
    const code = await runCli(["explain", "zzzzqqqq"], {
      home,
      out: sink,
      generator: new MockGenerator(),
    });
    expect(code).toBe(0);
    expect(text()).toContain("lumi topics");
  });

  it("explain suggests close concepts for a typo", async () => {
    const code = await runCli(["explain", "comit"], {
      home,
      out: sink,
      generator: new MockGenerator(),
    });
    expect(code).toBe(0);
    expect(text()).toContain("Did you mean");
    expect(text()).toContain("Git commit");
  });

  it("an unknown command returns 1 and prints help", async () => {
    const code = await runCli(["wat"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toContain("Unknown command: wat");
    expect(text()).toContain("Usage:");
  });

  it("help returns 0 and prints usage", async () => {
    const helpCode = await runCli(["help"], { home, out: sink });
    expect(helpCode).toBe(0);
    expect(text()).toContain("Usage:");
    expect(text()).not.toContain("Welcome to Lumi");
  });

  it("bare `lumi` on a fresh (empty) profile shows the welcome, not the help dump", async () => {
    const code = await runCli([], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Welcome to Lumi");
    expect(text()).toContain("lumi setup --all");
  });

  it("bare `lumi` for a returning user (has learned) shows usage, not the welcome", async () => {
    seed("git-commit");
    const code = await runCli([], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Usage:");
    expect(text()).not.toContain("Welcome to Lumi");
  });

  it("`lumi welcome` always shows the getting-started guide (even for returning users)", async () => {
    seed("git-commit", "api");
    const code = await runCli(["welcome"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Welcome to Lumi");
    expect(text()).toContain('lumi explain "api"');
  });

  it("feed returns 0, prints lesson event(s) written, and creates feed.jsonl with valid FeedEvents", async () => {
    const code = await runCli(["feed", "--source", "test"], {
      home,
      out: sink,
      generator: new MockGenerator(),
      input: "ran git commit on branch main",
    });
    expect(code).toBe(0);
    expect(text()).toContain("lesson event(s) written");

    const feedFile = join(home, "feed.jsonl");
    expect(existsSync(feedFile)).toBe(true);
    const lines = readFileSync(feedFile, "utf8").split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      const evt: FeedEvent = JSON.parse(line);
      expect(evt.v).toBe(1);
      expect(evt.type).toBe("lesson");
      expect(typeof evt.concept).toBe("string");
      expect(evt.lesson).toBeDefined();
      expect(typeof evt.lesson!.title).toBe("string");
    }
  });

  it("feed writes at least one event for git-commit when input mentions it", async () => {
    await runCli(["feed", "--source", "test"], {
      home,
      out: sink,
      generator: new MockGenerator(),
      input: "ran git commit on branch main",
    });
    const feedFile = join(home, "feed.jsonl");
    const lines = readFileSync(feedFile, "utf8").split("\n").filter(Boolean);
    const events: FeedEvent[] = lines.map((l) => JSON.parse(l));
    const gitCommitEvt = events.find((e) => e.concept === "git-commit");
    expect(gitCommitEvt).toBeDefined();
  });

  it("feed marks taught concepts as learned in the profile (overlay/hook pipeline)", async () => {
    await runCli(["feed", "--source", "cursor"], {
      home,
      out: sink,
      generator: new MockGenerator(),
      input: "ran git commit on branch main",
    });
    const profile = new JsonFileProfile(join(home, "profile.json"));
    expect(profile.listLearned().map((c) => c.id)).toContain("git-commit");
  });

  it("feed does not re-teach a concept already learned (cross-turn dedupe)", async () => {
    const input = "ran git commit on branch main";
    await runCli(["feed", "--source", "cursor"], { home, out: sink, generator: new MockGenerator(), input });
    await runCli(["feed", "--source", "cursor"], { home, out: sink, generator: new MockGenerator(), input });
    // git-commit is taught at most once across the two identical turns.
    const lines = readFileSync(join(home, "feed.jsonl"), "utf8").split("\n").filter(Boolean);
    const events: FeedEvent[] = lines.map((l) => JSON.parse(l));
    const gitCommitEvents = events.filter((e) => e.concept === "git-commit");
    expect(gitCommitEvents.length).toBe(1);
  });

  it("feed with no input writes 0 events", async () => {
    const code = await runCli(["feed", "--source", "test"], {
      home,
      out: sink,
      generator: new MockGenerator(),
      input: "",
    });
    expect(code).toBe(0);
    expect(text()).toContain("0 lesson event(s)");
  });

  it("feed writes analogy and tinyExample to FeedEvent.lesson when the generator provides them", async () => {
    // MockGenerator returns analogy:"Think of Git commit like an everyday tool you already use."
    // and no tinyExample. After this fix, the written event should carry the analogy field.
    await runCli(["feed", "--source", "test"], {
      home,
      out: sink,
      generator: new MockGenerator(),
      input: "ran git commit on branch main",
    });
    const feedFile = join(home, "feed.jsonl");
    const lines = readFileSync(feedFile, "utf8").split("\n").filter(Boolean);
    const events: FeedEvent[] = lines.map((l) => JSON.parse(l));
    const gitCommitEvt = events.find((e) => e.concept === "git-commit");
    expect(gitCommitEvt).toBeDefined();
    // analogy must be carried through from the generator into the feed event
    expect(gitCommitEvt!.lesson!.analogy).toBeDefined();
    expect(typeof gitCommitEvt!.lesson!.analogy).toBe("string");
  });

  it("progress with exactly 5 learned concepts includes the Growing milestone", async () => {
    seed("git-commit", "git-push", "git-branch", "git-merge", "git-clone");
    await runCli(["progress"], { home, out: sink });
    expect(text()).toContain("Growing");
  });

  it("progress with 3 learned concepts does not include a milestone line", async () => {
    seed("git-commit", "git-push", "git-branch");
    await runCli(["progress"], { home, out: sink });
    expect(text()).not.toMatch(/🌱|🎉|🚀|🏆/);
  });

  it("doctor with claudeAvailable:true → output contains 'Lumi setup check' and 'Claude CLI found'", async () => {
    const code = await runCli(["doctor"], { home, out: sink, claudeAvailable: true });
    expect(code).toBe(0);
    expect(text()).toContain("Lumi setup check");
    expect(text()).toContain("Claude CLI found");
  });

  it("doctor with claudeAvailable:false → output contains 'not found'", async () => {
    const code = await runCli(["doctor"], { home, out: sink, claudeAvailable: false });
    expect(code).toBe(0);
    expect(text()).toContain("not found");
  });

  it("stats with 2 learned concepts prints header, total, and a category line", async () => {
    // Seed 2 concepts that exist in CONCEPTS with known categories (git-commit: git, npm-install: node)
    const learned: LearnedConcept[] = [
      { id: "git-commit",  learnedAt: new Date().toISOString(), seenCount: 1 },
      { id: "npm-install", learnedAt: new Date().toISOString(), seenCount: 1 },
    ];
    writeFileSync(join(home, "profile.json"), JSON.stringify(learned, null, 2), "utf8");
    const code = await runCli(["stats"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Your Lumi stats");
    expect(text()).toContain("2");      // total
    expect(text()).toMatch(/git|node/); // at least one category line
  });

  it("stats with empty profile prints encouragement", async () => {
    const code = await runCli(["stats"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("No stats yet");
  });

  it("next with no learned concepts returns 0 (onboarding path, no --source needed)", async () => {
    const code = await runCli(["next"], { home, out: sink });
    expect(code).toBe(0);
  });

  it("prompt --source codex 'build X' parses idea as 'build X' and exits 0", async () => {
    // Use injected polish fn so no live CLI is needed
    const code = await runCli(["prompt", "--source", "codex", "build X"], {
      home,
      out: sink,
    });
    // Without injected polish the FallbackPolisher falls back offline — should still be 0
    expect(code).toBe(0);
    // The idea text "build X" must appear in the polished output
    expect(text()).toContain("build X");
  });

  it("prompt --source gemini strips --source flag from idea text", async () => {
    // The idea should not contain '--source' or 'gemini' (the flag/value)
    const code = await runCli(["prompt", "--source", "gemini", "make a landing page"], {
      home,
      out: sink,
    });
    expect(code).toBe(0);
    expect(text()).toContain("make a landing page");
    // The literal flag tokens must NOT appear as the idea
    expect(text()).not.toContain("--source gemini make a landing page");
  });

  it("prompt with only --source flag and no idea returns exit 1 (flag-stripping leaves empty idea)", async () => {
    // After stripping --source <val>, if nothing remains, runPrompt returns 1.
    // This confirms that --source stripping works correctly.
    const code = await runCli(["prompt", "--source", "codex"], {
      home,
      out: sink,
    });
    expect(code).toBe(1);
    expect(text().toLowerCase()).toContain("usage");
  });

  // ---------------------------------------------------------------------------
  // path command
  // ---------------------------------------------------------------------------

  it("path returns 0 and prints a path title", async () => {
    const code = await runCli(["path"], { home, out: sink });
    expect(code).toBe(0);
    // At least one known path title must appear
    expect(text()).toMatch(/Web basics|Ship your first app|Stay safe online|Understand your AI/);
  });

  it("path shows done/total progress for each path", async () => {
    seed("localhost", "port");
    const code = await runCli(["path"], { home, out: sink });
    expect(code).toBe(0);
    // Should show progress like "2/N"
    expect(text()).toMatch(/\d+\/\d+/);
  });

  it("path with empty profile shows encouraging start-building line", async () => {
    const code = await runCli(["path"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toMatch(/start building|Start building/i);
  });

  it("path shows Next up when concepts remain", async () => {
    // With no learning done, nextAcrossPaths will return a next concept
    const code = await runCli(["path"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Next up:");
  });

  // ---------------------------------------------------------------------------
  // card command
  // ---------------------------------------------------------------------------

  it("card --out <file> writes an SVG file", async () => {
    seed("git-commit", "git-push");
    const outFile = join(home, "card.svg");
    const code = await runCli(["card", "--out", outFile], { home, out: sink });
    expect(code).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    expect(readFileSync(outFile, "utf8")).toContain("<svg");
  });

  it("card --out prints confirmation message", async () => {
    const outFile = join(home, "card.svg");
    const code = await runCli(["card", "--out", outFile], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain(outFile);
  });

  it("card without --out prints SVG to stdout", async () => {
    const code = await runCli(["card"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("<svg");
  });

  // FIX 3 regression: card --out with no following path must print usage and return 1
  it("card --out with no path argument returns 1 and prints usage", async () => {
    const code = await runCli(["card", "--out"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage.*card/i);
  });

  // ---------------------------------------------------------------------------
  // check command
  // ---------------------------------------------------------------------------

  it("check with empty input prints no-risk message", async () => {
    const code = await runCli(["check"], { home, out: sink, input: "" });
    expect(code).toBe(0);
    expect(text()).toContain("No risky patterns");
  });

  it("check with a hardcoded API key prints danger marker and a security label", async () => {
    const apiKeyInput = 'const apiKey = "sk-1234567890abcdef1234567890abcdef";';
    const code = await runCli(["check"], { home, out: sink, input: apiKeyInput });
    expect(code).toBe(0);
    // Should contain danger marker
    expect(text()).toContain("🚨");
    // Should contain some security-related label
    expect(text()).toMatch(/[Hh]ardcoded|[Ss]ecret|[Aa][Pp][Ii]/);
  });

  it("check with risky input prints riskLessonHint text on next line", async () => {
    const apiKeyInput = 'const secret = "sk-1234567890abcdef1234567890abcdef";';
    const code = await runCli(["check"], { home, out: sink, input: apiKeyInput });
    expect(code).toBe(0);
    // The hint text should be present
    expect(text()).toMatch(/[Ee]nvironment variable|[Ss]ecret|[Ss]ecurity/);
  });

  it("check reads deps.input exactly like feed does", async () => {
    // Provide via deps.input (not stdin)
    const code = await runCli(["check"], {
      home, out: sink,
      input: "nothing dangerous here",
    });
    expect(code).toBe(0);
    expect(text()).toContain("No risky patterns");
  });

  // ---------------------------------------------------------------------------
  // goal command
  // ---------------------------------------------------------------------------

  it("goal 3 sets daily goal and confirms", async () => {
    const code = await runCli(["goal", "3"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toMatch(/3/);
  });

  it("goal after setting shows current goal", async () => {
    await runCli(["goal", "3"], { home, out: sink });
    out = [];
    const code = await runCli(["goal"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("3");
  });

  it("goal with bad arg returns 1 and usage", async () => {
    const code = await runCli(["goal", "abc"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage/);
  });

  // FIX 3 regression: goal must reject non-integer and over-cap values
  it("goal 3.7 (float) returns 1 and prints usage", async () => {
    const code = await runCli(["goal", "3.7"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage/);
  });

  it("goal 3abc (mixed) returns 1 and prints usage", async () => {
    const code = await runCli(["goal", "3abc"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage/);
  });

  it("goal 1e3 (scientific notation) returns 1 and prints usage", async () => {
    const code = await runCli(["goal", "1e3"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage/);
  });

  it("goal 101 (over cap) returns 1 and prints usage", async () => {
    const code = await runCli(["goal", "101"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/[Uu]sage/);
  });

  it("goal 100 (at cap) accepts and sets goal", async () => {
    const code = await runCli(["goal", "100"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("100");
  });

  it("goal 1 (min valid) accepts and sets goal", async () => {
    const code = await runCli(["goal", "1"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("1");
  });

  it("goal 5 stores the daily goal in habit.json", async () => {
    await runCli(["goal", "5"], { home, out: sink });
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    expect(store.getState().dailyGoal).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // stats augmentation: daily goal and badges
  // ---------------------------------------------------------------------------

  it("stats shows badge after learning at least 1 concept", async () => {
    seed("git-commit");
    const code = await runCli(["stats"], { home, out: sink });
    expect(code).toBe(0);
    // "First Step" badge is earned after learning 1 concept
    expect(text()).toContain("First Step");
  });

  it("stats shows today's goal progress when daily goal is set", async () => {
    seed("git-commit");
    // Set a daily goal
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    store.setDailyGoal(3);
    const code = await runCli(["stats"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toMatch(/Today:|Today's goal/i);
  });

  it("stats is resilient when habit.json is missing (no crash)", async () => {
    seed("git-commit");
    // Don't create habit.json — stats should still work fine
    const code = await runCli(["stats"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("Your Lumi stats");
  });

  it("digest prints a weekly recap and returns 0", async () => {
    seed("git-commit", "api");
    const code = await runCli(["digest"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toMatch(/this week|getting started/i);
  });

  it("certificate is gated below 10 concepts", async () => {
    seed("git-commit", "api");
    const code = await runCli(["certificate"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("unlocks at 10");
  });

  it("certificate --out writes an SVG once eligible (10+ concepts)", async () => {
    seed("git-commit", "api", "env-var", "json", "port", "localhost", "http-request", "http-status", "cli", "repository");
    const file = join(home, "cert.svg");
    // inject Pro so the paywall is satisfied
    const proEnt: LicenseResult = { valid: true, tier: "pro", email: "test@example.com" };
    const code = await runCli(["certificate", "--out", file], { home, out: sink, entitlement: proEnt });
    expect(code).toBe(0);
    expect(readFileSync(file, "utf8")).toContain("<svg");
  });

  it("unstuck flags a fix-loop from piped input", async () => {
    const input = "Error: Module not found\nlet me try again\nError: Module not found\nstill failing";
    const code = await runCli(["unstuck"], { home, out: sink, input });
    expect(code).toBe(0);
    expect(text()).toContain("fix-loop");
  });

  it("unstuck stays calm when there is no loop", async () => {
    const code = await runCli(["unstuck"], { home, out: sink, input: "Build complete. All good." });
    expect(code).toBe(0);
    expect(text()).toMatch(/no loop detected/i);
  });

  // ---------------------------------------------------------------------------
  // Regression: FIX #2 — audit --path false-all-clear for nonexistent/empty dir
  // ---------------------------------------------------------------------------

  it("audit --path nonexistent directory prints error and returns 1", async () => {
    const nonexistent = join(home, "does-not-exist");
    // inject Pro so we reach the directory-check logic (not the paywall)
    const proEnt: LicenseResult = { valid: true, tier: "pro", email: "test@example.com" };
    const code = await runCli(["audit", "--path", nonexistent], { home, out: sink, entitlement: proEnt });
    expect(code).toBe(1);
    expect(text()).toMatch(/Could not read directory/i);
  });

  it("audit --path empty directory prints no-files message (not 'Looks safe' / 'Nice and clean')", async () => {
    // home is an empty dir (nothing written there yet for this test)
    const emptyDir = mkdtempSync(join(tmpdir(), "lumi-audit-empty-"));
    // inject Pro so we reach the scan logic (not the paywall)
    const proEnt: LicenseResult = { valid: true, tier: "pro", email: "test@example.com" };
    try {
      const code = await runCli(["audit", "--path", emptyDir], { home, out: sink, entitlement: proEnt });
      expect(code).toBe(0);
      expect(text()).toMatch(/No files were scanned/i);
      // Must NOT say "Looks safe" or "Nice and clean"
      expect(text()).not.toMatch(/Looks safe/i);
      expect(text()).not.toMatch(/Nice and clean/i);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Regression: FIX #5 — audit clean-verdict hedging (piped input + --path)
  // ---------------------------------------------------------------------------

  it("audit clean piped input includes hedging text (not 'fully secure')", async () => {
    const code = await runCli(["audit"], { home, out: sink, input: "console.log('hello world')" });
    expect(code).toBe(0);
    // Must contain hedging about being a pattern check
    expect(text()).toMatch(/pattern|fast check|not a full/i);
  });

  it("audit --path clean project includes hedging text", async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), "lumi-audit-clean-"));
    // inject Pro so we reach the scan logic (not the paywall)
    const proEnt: LicenseResult = { valid: true, tier: "pro", email: "test@example.com" };
    try {
      writeFileSync(join(cleanDir, "hello.js"), "console.log('hello world');\n", "utf8");
      const code = await runCli(["audit", "--path", cleanDir], { home, out: sink, entitlement: proEnt });
      expect(code).toBe(0);
      expect(text()).toMatch(/pattern|fast check|not a full/i);
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Entitlement injection helpers
  // ---------------------------------------------------------------------------

  const FREE_ENT: LicenseResult = { valid: false, tier: "free", reason: "No license key stored" };
  const PRO_ENT: LicenseResult = { valid: true, tier: "pro", email: "test@example.com", expires: "2099-01-01" };

  // ---------------------------------------------------------------------------
  // upgrade command
  // ---------------------------------------------------------------------------

  it("upgrade returns 0 and prints the price", async () => {
    const code = await runCli(["upgrade"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("$8/mo");
  });

  it("upgrade prints at least one Pro feature", async () => {
    await runCli(["upgrade"], { home, out: sink, entitlement: FREE_ENT });
    expect(text()).toMatch(/[Cc]ertificate|learning path|audit/);
  });

  it("upgrade prints the lumi.dev/pro URL", async () => {
    await runCli(["upgrade"], { home, out: sink, entitlement: FREE_ENT });
    expect(text()).toContain("https://lumi.dev/pro");
  });

  // ---------------------------------------------------------------------------
  // license command
  // ---------------------------------------------------------------------------

  it("license with a garbage key returns 1 and says isn't valid", async () => {
    const code = await runCli(["license", "totally-garbage-key"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(1);
    expect(text()).toContain("isn't valid");
  });

  it("license with no arg shows free plan status (free ent)", async () => {
    const code = await runCli(["license"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/free plan|You're on the free/i);
  });

  it("license with no arg shows nudge to lumi upgrade when on free plan", async () => {
    await runCli(["license"], { home, out: sink, entitlement: FREE_ENT });
    expect(text()).toContain("lumi upgrade");
  });

  it("license with no arg shows Pro status when pro ent injected", async () => {
    const code = await runCli(["license"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/[Pp]ro/);
    expect(text()).toContain("test@example.com");
  });

  // ---------------------------------------------------------------------------
  // certificate paywall
  // ---------------------------------------------------------------------------

  it("certificate with free ent + 10 concepts prints upgrade message (not SVG)", async () => {
    seed("git-commit", "api", "env-var", "json", "port", "localhost", "http-request", "http-status", "cli", "repository");
    const code = await runCli(["certificate"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).not.toContain("<svg");
    expect(text()).toMatch(/[Pp]ro|upgrade/i);
  });

  it("certificate with pro ent + 10 concepts emits SVG", async () => {
    seed("git-commit", "api", "env-var", "json", "port", "localhost", "http-request", "http-status", "cli", "repository");
    const code = await runCli(["certificate"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("<svg");
  });

  it("certificate with free ent below 10 concepts still shows the count gate (not upgrade msg)", async () => {
    seed("git-commit", "api");
    const code = await runCli(["certificate"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("unlocks at 10");
  });

  // ---------------------------------------------------------------------------
  // audit --path paywall
  // ---------------------------------------------------------------------------

  it("audit --path with free ent prints upgrade message", async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), "lumi-audit-paywall-"));
    try {
      writeFileSync(join(cleanDir, "hello.js"), "console.log('hello');\n", "utf8");
      const code = await runCli(["audit", "--path", cleanDir], { home, out: sink, entitlement: FREE_ENT });
      expect(code).toBe(0);
      expect(text()).toMatch(/[Pp]ro|upgrade/i);
      expect(text()).not.toContain("Security Audit — Grade:");
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });

  it("audit --path with pro ent runs the scan and shows grade", async () => {
    const cleanDir = mkdtempSync(join(tmpdir(), "lumi-audit-pro-"));
    try {
      writeFileSync(join(cleanDir, "hello.js"), "console.log('hello');\n", "utf8");
      const code = await runCli(["audit", "--path", cleanDir], { home, out: sink, entitlement: PRO_ENT });
      expect(code).toBe(0);
      expect(text()).toContain("Security Audit — Grade:");
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });

  it("audit (snippet, no --path) with free ent is still free", async () => {
    const code = await runCli(["audit"], { home, out: sink, input: "console.log('hello')", entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("Security Audit — Grade:");
  });

  it("check with free ent is still free", async () => {
    const code = await runCli(["check"], { home, out: sink, input: "console.log('hello')", entitlement: FREE_ENT });
    expect(code).toBe(0);
    // no upgrade gate
    expect(text()).not.toMatch(/upgrade/i);
  });

  // ---------------------------------------------------------------------------
  // path paywall
  // ---------------------------------------------------------------------------

  it("path with free ent shows first path with full progress, locks others", async () => {
    const code = await runCli(["path"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    // First path (Web basics) should still show with progress bar
    expect(text()).toMatch(/Web basics/);
    // Subsequent paths locked
    expect(text()).toContain("Pro");
  });

  it("path with free ent shows Next up from first path only", async () => {
    const code = await runCli(["path"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("Next up:");
  });

  it("path with pro ent shows all paths with full progress", async () => {
    const code = await runCli(["path"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    // All four paths should appear in detail
    expect(text()).toMatch(/Web basics/);
    expect(text()).toMatch(/Ship your first app/);
    expect(text()).toMatch(/Stay safe online/);
    expect(text()).toMatch(/Understand your AI/);
    // Should NOT show lock line
    expect(text()).not.toContain("Pro — unlock all paths");
  });

  it("path with free ent does NOT show full detail for locked paths", async () => {
    const code = await runCli(["path"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    // Locked paths should show lock line (just one of them suffices)
    expect(text()).toMatch(/unlock all paths/i);
  });

  // ---------------------------------------------------------------------------
  // freeze command — Feature 1
  // ---------------------------------------------------------------------------

  it("freeze with free ent prints upgrade message and returns 0", async () => {
    const code = await runCli(["freeze"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/[Pp]ro|upgrade/i);
    expect(text()).not.toContain("freezes banked");
  });

  it("freeze with pro ent shows freeze count and streak info", async () => {
    seed("git-commit");
    const code = await runCli(["freeze"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/freeze|banked/i);
    expect(text()).toMatch(/streak/i);
  });

  it("freeze --add with pro ent increments the freeze count by 1", async () => {
    // Start with 0 freezes
    const code = await runCli(["freeze", "--add"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    // The store should now have 1 freeze
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    expect(store.getState().freezes).toBe(1);
    // The output should confirm the new total
    expect(text()).toMatch(/1/);
  });

  it("freeze --add with pro ent accumulates across multiple calls", async () => {
    await runCli(["freeze", "--add"], { home, out: sink, entitlement: PRO_ENT });
    out = [];
    await runCli(["freeze", "--add"], { home, out: sink, entitlement: PRO_ENT });
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    expect(store.getState().freezes).toBe(2);
  });

  it("freeze --add with free ent prints upgrade message, does not add freeze", async () => {
    const code = await runCli(["freeze", "--add"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/[Pp]ro|upgrade/i);
    // Store should not exist or still show 0 freezes
    const habitPath = join(home, "habit.json");
    if (existsSync(habitPath)) {
      const store = new JsonFileHabitStore(habitPath);
      expect(store.getState().freezes).toBe(0);
    }
  });

  // ---------------------------------------------------------------------------
  // stats — freeze-protected streak for Pro users (Feature 1 extension)
  // ---------------------------------------------------------------------------

  it("stats with pro ent shows freeze-protected streak line and banked freezes", async () => {
    seed("git-commit");
    // Bank 2 freezes
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    store.addFreezes(2);
    const code = await runCli(["stats"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    // Should show the ice/freeze indicator with banked count
    expect(text()).toMatch(/❄️.*2|2.*❄️/);
  });

  it("stats with free ent does NOT show freeze indicator", async () => {
    seed("git-commit");
    const store = new JsonFileHabitStore(join(home, "habit.json"));
    store.addFreezes(2);
    const code = await runCli(["stats"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).not.toMatch(/❄️/);
  });

  it("stats with pro ent is resilient when habit.json is missing (shows normal streak)", async () => {
    seed("git-commit");
    // No habit.json created
    const code = await runCli(["stats"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("Your Lumi stats");
  });

  // ---------------------------------------------------------------------------
  // digest --rich command — Feature 2
  // ---------------------------------------------------------------------------

  it("digest without --rich flag is unchanged for free users", async () => {
    seed("git-commit", "api");
    const code = await runCli(["digest"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    // Plain text — should NOT contain HTML tags
    expect(text()).not.toContain("<html");
    expect(text()).toMatch(/this week|getting started/i);
  });

  it("digest without --rich flag is unchanged for pro users", async () => {
    seed("git-commit", "api");
    const code = await runCli(["digest"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).not.toContain("<html");
    expect(text()).toMatch(/this week|getting started/i);
  });

  it("digest --rich with free ent prints upgrade message and returns 0", async () => {
    seed("git-commit", "api");
    const code = await runCli(["digest", "--rich"], { home, out: sink, entitlement: FREE_ENT });
    expect(code).toBe(0);
    expect(text()).toMatch(/[Pp]ro|upgrade/i);
    expect(text()).not.toContain("<html");
  });

  it("digest --rich with pro ent prints HTML output containing '<'", async () => {
    seed("git-commit", "api");
    const code = await runCli(["digest", "--rich"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    expect(text()).toContain("<");
    expect(text()).toContain("html");
  });

  it("digest --rich with pro ent HTML contains the weekly digest headline", async () => {
    seed("git-commit");
    const code = await runCli(["digest", "--rich"], { home, out: sink, entitlement: PRO_ENT });
    expect(code).toBe(0);
    // renderDigestHtml always produces a DOCTYPE
    expect(text()).toContain("<!DOCTYPE html>");
  });

  // ---------------------------------------------------------------------------
  // HELP mentions freeze and digest --rich
  // ---------------------------------------------------------------------------

  it("help output mentions freeze command", async () => {
    const code = await runCli(["help"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toContain("freeze");
  });

  it("help output mentions --rich flag for digest", async () => {
    const code = await runCli(["help"], { home, out: sink });
    expect(code).toBe(0);
    expect(text()).toMatch(/digest.*--rich|--rich.*digest/i);
  });

  // ---------------------------------------------------------------------------
  // GAP 2 — export / import / serve (untested routing)
  // ---------------------------------------------------------------------------

  it("export --out <file> returns 0 and writes a file whose JSON parses to { v:1, profile:[] }", async () => {
    // Seed one concept so the bundle has content
    seed("git-commit");
    const outFile = join(home, "export.json");
    const code = await runCli(["export", "--out", outFile], { home, out: sink });
    expect(code).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    const bundle = JSON.parse(readFileSync(outFile, "utf8"));
    expect(bundle.v).toBe(1);
    expect(Array.isArray(bundle.profile)).toBe(true);
    expect(bundle.profile.length).toBeGreaterThanOrEqual(1);
  });

  it("export --out round-trip: export from home A, import into home B → B profile contains the concept", async () => {
    // Seed in home A
    seed("git-commit");
    const outFile = join(home, "export.json");
    const exportCode = await runCli(["export", "--out", outFile], { home, out: sink });
    expect(exportCode).toBe(0);

    // Import into a fresh home B
    const homeB = mkdtempSync(join(tmpdir(), "lumi-cli-b-"));
    try {
      out = [];
      const importCode = await runCli(["import", outFile], { home: homeB, out: sink });
      expect(importCode).toBe(0);
      expect(text()).toMatch(/[Ii]mported\s+1/);
      const profileB = new JsonFileProfile(join(homeB, "profile.json"));
      expect(profileB.listLearned().map((c) => c.id)).toContain("git-commit");
    } finally {
      rmSync(homeB, { recursive: true, force: true });
    }
  });

  it("import <nonexistent-path> returns 1 with a 'could not read' style message", async () => {
    const code = await runCli(["import", join(home, "no-such-file.json")], { home, out: sink });
    expect(code).toBe(1);
    expect(text().toLowerCase()).toMatch(/could not read/);
  });

  it("import <file-with-bad-json> returns 1", async () => {
    const badFile = join(home, "bad.json");
    writeFileSync(badFile, "this is not json at all", "utf8");
    const code = await runCli(["import", badFile], { home, out: sink });
    expect(code).toBe(1);
  });

  it("serve --port notanumber returns 1 (port-validation branch, no server started)", async () => {
    const code = await runCli(["serve", "--port", "notanumber"], { home, out: sink });
    expect(code).toBe(1);
    expect(text()).toMatch(/--port.*integer|integer.*--port/i);
  });
});
