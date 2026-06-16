# What Lumi does — and how

**Lumi is a friendly "mini-teacher" that rides *inside* the AI coding tool you already use.** It's
built for **non-technical builders** — founders, career-switchers, bootcamp students, marketers —
who use an AI (Claude Code, Cursor, Codex, and others) to build software but get lost in the
unfamiliar words it uses, and can't tell when the AI has done something risky.

## What it does (in one paragraph)
When the AI does something technical, Lumi spots the new concepts in its work and, the **first
time** each one appears, drops in a short, plain-English lesson — then **remembers** it forever and
never teaches it again. It does this **across every tool you use**, so a concept learned in Cursor
won't be re-taught in Claude Code. Alongside the teaching, a **security lens** flags when the AI
does something risky (a leaked key, a secret in the frontend, missing access control) and turns
each risk into a lesson you keep. You go from *"I shipped it and hope it's fine"* to *"I understand
what I shipped — and I know it's safe."*

## Why this position is unusual
Most tools either **write the code for you** (Copilot, Cursor, the vibe-coding builders) or
**explain a snippet when you ask** (a native "explain" button, a docs chatbot). None of them
proactively **teach the concept**, **remember it across tools**, *and* **flag the unsafe thing** on
your real work. Lumi does all three — and the security lens is the sharp edge, because the
well-documented "vibe-coding disasters" all trace back to non-technical builders shipping code they
couldn't check.

## How it does it (the loop)
1. **Watches the work.** After the AI responds, Lumi reads both what it *says* (its reply) and what
   it *does* (the commands it runs, the files it writes), via your tool's "after the AI responds" hook.
2. **Detects concepts.** A **129-concept dictionary** — including a deep **security** category —
   spots tech terms (`git commit`, `environment variable`, `API key`, `missing access control`, and
   so on) with anchored matching, so ordinary English doesn't trigger false lessons.
3. **Only teaches what's new.** It checks each concept against your saved learning profile and skips
   anything you've already learned — **even if you learned it in a different tool.** It teaches
   **at most 2 per turn** (most important first), so it never floods you.
4. **Writes a tailored lesson.** For a new concept it generates a 2–3 sentence, jargon-free lesson —
   with an everyday analogy — that **adapts to your level** (beginner → growing → confident), and
   includes an honest **"learn more"** link. Lessons are written by the AI tool you're already using
   (your own subscription — **no API key, no extra cost**) and cached so they're instant next time.
5. **Flags the risky stuff.** A security lens checks the AI's output for dangerous patterns
   (hardcoded secrets, secrets exposed in the frontend, missing validation, plaintext HTTP, and the
   like). `lumi check` lists them with "why it's risky / how to fix"; `lumi audit` gives an **A–F
   safety report** with the top fixes to make first.
6. **Remembers across sessions and tools.** Everything you learn is saved locally under `~/.lumi`
   (`profile.json` + a human-readable glossary). This cross-tool memory is Lumi's core
   differentiator — a native "explain" button forgets you; incumbents can't share memory across each
   other's products; Lumi builds a record of *your* learning that follows you everywhere.
7. **Reinforces it.** Spaced **active-recall review** ("Do you remember what X means?" — with a
   guess-before-reveal step in the overlay) brings concepts back before you forget them. **Streaks,
   a daily goal, streak freeze, and badges** keep you motivated.

## Keeps you moving (beyond the core loop)
- **Learning paths** (`lumi path`) — ordered skill ladders over the concepts you meet, with progress bars.
- **"What to build next"** coach (`lumi next`) — a sensible next project for where you're at, and why.
- **Prompt polisher** (`lumi prompt`) — turns a rough idea into a clear, ready-to-paste prompt.
- **Un-stuck coach** (`lumi unstuck`) — spots an AI fix-loop in the output and coaches a better move.
- **Shareable progress card** (`lumi card`), **weekly digest** (`lumi digest`), and a milestone
  **certificate** (`lumi certificate`, unlocking at 10+ concepts).

## Where it shows up (the surfaces)
All driven by one shared **lesson-event feed**, so every surface stays in sync:
- **Inline** — a "🪄 Lumi — quick lesson" appended right inside the AI's reply. Works in the
  terminal, on desktop, and on the **mobile app** via the Claude Code plugin.
- **Web overlay** (`lumi serve`) — a tool-agnostic browser window you pin on top of your work, with
  tabs for **Lessons · Glossary · Review · Explain · Coach · Prompt · Paste · Paths · Digest**.
- **VS Code side-panel** — interactive lesson cards with **"Makes sense ✅ / Still fuzzy 🤔"**
  buttons, plus Glossary, Review, and Explain.
- **CLI** — `lumi progress | stats | glossary | explain | next | prompt | review | path | card |
  check | audit | goal | digest | certificate | unstuck | serve | setup | doctor` (run `lumi help`).

## Which tools it works with
Lumi's brain is **tool-agnostic**.
- **Claude Code** — live-tested across terminal, desktop, and mobile (inline plugin).
- **Codex, Cursor, Gemini CLI, Copilot, OpenCode** — adapter hooks ship today, verified offline;
  live-verify on a machine with that tool installed. `lumi setup` wires them up for you.
- **Any tool, including browser builders** (Lovable, Bolt, v0, Replit) — use **paste mode**: paste
  what the AI did into the overlay's Paste tab (or pipe it to `lumi feed`) and get lessons.

See [`adapters/README.md`](../adapters/README.md) for per-tool setup and exactly what's verified
live vs. offline.

## A note on honesty
Lumi only claims what it actually does. The inline plugin and the CLI/overlay run today. The
non-Claude adapters are verified offline and the overlay's visuals are best confirmed on a real
machine; Marketplace/directory publishing is in progress. We'd rather under-promise than have you
trust a lesson — or a safety grade — that isn't real.

## In one line
**Lumi turns "the AI did it for me" into "I understand what I built — and I know it's safe" — by
teaching you each new concept the moment it appears, remembering it across every tool, and flagging
the risky stuff before it ships.**
