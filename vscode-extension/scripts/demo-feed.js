#!/usr/bin/env node
// Appends sample Lumi lesson events to the feed file so you can SEE the panel
// populate without wiring up the real Claude Code hook yet.
//
// Usage: run this AFTER pressing F5 (while the Extension Development Host is open).
//   node scripts/demo-feed.js
// The panel polls the feed every ~2s, so cards appear within a couple of seconds.
//
// Honors LUMI_HOME (same as the extension); defaults to <home>/.lumi/feed.jsonl.

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const home = (process.env.LUMI_HOME && process.env.LUMI_HOME.trim())
  ? process.env.LUMI_HOME.trim()
  : path.join(os.homedir(), ".lumi");
const feed = path.join(home, "feed.jsonl");

// concept ids below match the built-in catalog in @lumi/core (core/src/concepts.ts).
const lessons = [
  {
    concept: "git-commit",
    lesson: {
      title: "Git commit",
      plainExplanation:
        "A commit is a labelled snapshot of your project at a moment in time. It records exactly what changed and a short message explaining why.",
      whyItMatters:
        "Commits are your save points. If something breaks later, you can look back — or jump back — to any commit.",
      analogy: "Like saving a numbered draft of an essay, with a note on what you changed in that draft.",
      tinyExample: "git commit -m \"Add login button\"",
    },
  },
  {
    concept: "npm-install",
    lesson: {
      title: "Installing packages (npm)",
      plainExplanation:
        "`npm install` downloads the third-party code your project depends on into a local node_modules folder.",
      whyItMatters:
        "It lets you reuse battle-tested libraries instead of writing everything yourself, and it pins which versions your project uses.",
      analogy: "Like ordering the pre-made ingredients a recipe calls for instead of growing them yourself.",
      tinyExample: "npm install react",
    },
  },
  {
    concept: "env-var",
    lesson: {
      title: "Environment variable",
      plainExplanation:
        "An environment variable is a named value kept outside your code — set by the system or a .env file — that your program reads at runtime.",
      whyItMatters:
        "It keeps secrets (API keys, passwords) and per-machine settings out of your source code, so they never get committed.",
      analogy: "Like a sticky note on the fridge the app checks, instead of hard-coding the value into the recipe.",
      tinyExample: "const key = process.env.OPENAI_API_KEY",
    },
  },
];

fs.mkdirSync(home, { recursive: true });
for (const item of lessons) {
  const event = {
    v: 1,
    id: `evt_${crypto.randomUUID()}`,
    ts: new Date().toISOString(),
    source: "lumi-demo",
    type: "lesson",
    concept: item.concept,
    lesson: item.lesson,
  };
  fs.appendFileSync(feed, JSON.stringify(event) + "\n", "utf8");
}

console.log(`Appended ${lessons.length} demo lesson(s) to ${feed}`);
console.log("Open the Lumi view in the Explorer sidebar of the Extension Development Host — cards appear within ~2s.");
