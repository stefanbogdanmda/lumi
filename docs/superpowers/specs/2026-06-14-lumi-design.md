# Lumi — Design Spec (v1)

**Date:** 2026-06-14
**Status:** Approved for planning
**Author:** brainstormed with the project owner

> **Repo note:** This project is named **Lumi**. The GitHub repository is currently
> `digitalproduct`; renaming it to `lumi` is a GitHub Settings action the owner will do
> (or we create a fresh `lumi` repo on request). All code, packages, and branding use
> the name **Lumi** regardless.

---

## 1. One-line summary

Lumi is a friendly "mini-teacher" that rides along with Claude Code. The **first time** a
new tech concept shows up in Claude's work, Lumi gives you a short, plain-English mini-lesson
— and quietly tracks what you've learned. It works **everywhere** as inline lessons (including
the mobile app) and adds a **rich, interactive side-panel** with a persistent progress shelf
in VS Code/desktop. Lessons are generated using your **Claude Code subscription** (no API key
required).

## 2. Who it's for

Non-technical (or learning) people who use Claude Code a lot, feel overwhelmed by its output,
and want to *understand and learn* the tech as they go — not just get results.

## 3. Goals (v1)

1. When Claude Code produces output, detect the tech **concepts** involved (git, npm, Docker,
   APIs, environment variables, etc.).
2. For a concept the user **hasn't learned yet**, show a **short beginner-friendly lesson**.
3. Stay **quiet** for concepts already learned — fight overwhelm, never repeat.
4. Track learned concepts as **progress**.
5. Work **inline everywhere** (incl. mobile) and as a **rich panel** in VS Code/desktop.
6. Generate lessons via the user's **Claude Code subscription** (API key optional).

## 4. Non-goals (explicitly NOT in v1)

- ❌ Suggesting the next input / better prompts (a planned *later* layer).
- ❌ Flagging errors/risks in plain language (a planned *later* layer).
- ❌ Accounts, cloud sync, billing, or any "selling" infrastructure.
- ❌ A visual overlay on the mobile app (technically impossible — closed client; mobile gets
  inline lessons instead).
- ❌ Full AI-based concept detection (v1 uses a curated dictionary; AI is used only to *write*
  lessons).

## 5. Architecture — "one brain, two faces"

```
                         ┌─────────────────────────────┐
                         │         LUMI CORE            │
                         │         (the brain)          │
                         │                              │
   Claude Code output ──▶│  1. Concept detector         │
                         │  2. Learning profile (store) │
                         │  3. Lesson generator ────────┼──▶ Claude subscription
                         │  4. Lesson cache             │     (via `claude` CLI)
                         └──────────────┬───────────────┘
                                        │ emits "lesson cards"
                        ┌───────────────┴────────────────┐
                        ▼                                 ▼
          ┌───────────────────────┐         ┌───────────────────────────┐
          │   FACE 1: Lumi Inline │         │   FACE 2: Lumi Panel       │
          │  (Claude Code plugin) │         │  (VS Code extension)       │
          │  works EVERYWHERE,    │         │  rich card UI + persistent │
          │  incl. mobile.        │         │  progress shelf.           │
          │  Lessons appear inline│         │  VS Code / desktop only.   │
          └───────────────────────┘         └───────────────────────────┘
```

### Why two faces

- **Mobile reality:** the Claude mobile app is a closed client — no extensions, no overlay.
  The only way to reach mobile is to make the lesson part of Claude's *reply text*. So Lumi
  Inline is a Claude Code plugin/skill that teaches inline; that text shows up on mobile,
  desktop, and terminal alike.
- **VS Code richness:** in VS Code we *can* render an interactive panel and persist data, so
  that face gets the pretty cards + the permanent progress shelf.

Both faces consume the **same Core**, so concept-detection and lesson logic are written once.

## 6. Lumi Core (the brain)

A standalone, UI-agnostic TypeScript/Node module. UI faces depend on it; it depends on nothing
UI-specific. This isolation is deliberate so the same brain powers inline + panel (+ future
faces).

### 6.1 Concept detector
- Input: a chunk of Claude Code output (text) plus light context (e.g., which tools/commands
  ran, if available).
- Method (v1): a **curated dictionary** of ~40 common concepts. Each entry has:
  `{ id, label, matchers (keywords/regex), category }`.
- Output: a deduplicated list of detected concept IDs.
- Rationale: dictionary detection is fast, free, predictable, and easy to test. AI-based
  detection is a future upgrade.
- Unknown concepts (no dictionary match) are **ignored** in v1 but logged so the dictionary
  can grow.

### 6.2 Learning profile (store)
- Records which concept IDs the user has learned, with timestamps and a seen-count.
- **Storage differs by face** (see §9):
  - Desktop/VS Code: persistent local JSON file → full cross-session history ("trophy shelf").
  - Mobile/inline: no persistent storage available → "learned" = already taught *in the current
    conversation* (Claude tracks within-thread).
- Interface is identical (`hasLearned(id)`, `markLearned(id)`, `listLearned()`); only the
  backing implementation changes.

### 6.3 Lesson generator
- For each **new** concept, produce a short beginner lesson tailored to what the user was doing.
- **Default generation = Claude Code subscription** (see §7) — no API key.
- Lesson shape (structured):
  `{ conceptId, title, plainExplanation (2–3 sentences), whyItMatters (1 sentence), tinyExample (optional), learnMore (optional longer text) }`.

### 6.4 Lesson cache
- First generation of a concept's lesson is saved (keyed by concept ID) so it is instant and
  free on any later appearance. Lives alongside the profile store (desktop). On mobile the
  conversation itself is the cache.

## 7. Generation via the Claude subscription (not the API)

Default behavior uses the user's existing Claude Code subscription — free, no key, no per-lesson
cost.

- **Lumi Inline (everywhere, incl. mobile):** Lumi is a Claude Code **plugin** (a skill +
  output-style/system instruction). Claude *itself* writes the mini-lesson as part of its reply,
  following the Lumi instructions ("when you use a tech concept the user hasn't seen in this
  conversation, append a short 🪄 Lumi lesson in this format; never repeat a concept already
  taught"). This runs on the subscription with zero setup and reaches mobile because it's just
  reply text.
- **Lumi Panel (VS Code):** the extension generates lessons by invoking the local **`claude`
  CLI in headless/print mode** (e.g. `claude -p "<lesson prompt>"`), which is authenticated with
  the user's subscription. The result is rendered as a card.
- **Optional:** a power user may supply an Anthropic API key as an alternative generation backend.

## 8. The Claude Code hook (how the Panel "sees" output)

For the VS Code Panel, Lumi registers an official Claude Code **hook** (the same mechanism
plugins like Superpowers use) that fires after each finished response and hands the output to
Lumi Core. This gives a clean, exact copy of what Claude did — no fragile terminal screen-scraping.
(The Inline face doesn't need this hook: it teaches from *within* Claude's own turn.)

## 9. Data flow

**Inline (everywhere / mobile):**
`Claude works on a task → Lumi skill instructions are active → if a concept is new in this
conversation, Claude appends a short 🪄 Lumi lesson to its reply → user reads it inline.`

**Panel (VS Code / desktop):**
`Claude Code finishes a response → hook sends output to Lumi Core → Core detects concepts →
filters to NEW ones (not in persistent profile) → generates/loads lesson via subscription →
emits a lesson card → Panel renders it → user hits "Got it ✅" → profile + progress update.`

## 10. The VS Code Panel (Face 2)

- A **Lumi sidebar** (webview) next to the terminal.
- New lessons appear as friendly **cards**: title, plain explanation, "why it matters", optional
  tiny example, and an **"expand for more"**.
- Buttons: **"Got it ✅"** (marks learned) and a **"My Progress"** view — a collectible shelf of
  concepts learned over time.
- Settings: on/off, teaching pace, generation backend (subscription default / optional API key).

## 11. Error handling (graceful, never scary)

| Situation | Behavior |
|---|---|
| `claude` CLI not found / not logged in | Panel shows a friendly one-time setup prompt; no crash. |
| Generation fails / offline | Gentle "couldn't load that lesson right now"; use cached lesson if available. |
| Concept not in dictionary | Stay quiet (no noise); log it to grow the dictionary later. |
| Hook not firing / Claude Code not detected | Panel shows status + simple setup steps. |
| API-key mode selected but key missing/invalid | Clear message pointing to settings; fall back to subscription if possible. |

## 12. Testing strategy

- **Core is pure and highly testable:** feed sample Claude outputs → assert detected concepts,
  profile updates, "new vs. already-learned" filtering, and cache hits (generation backend mocked).
- **Lesson generator:** test against a mocked Claude response to assert the structured lesson shape.
- **Inline skill:** validate the instruction/output-style produces correctly-formatted inline
  lessons and respects "don't repeat within conversation" (prompt-level tests / manual checks).
- **Panel:** lighter integration/manual testing of card rendering, "Got it" → progress update,
  and the setup/error states.

## 13. Tech stack

- **Language:** TypeScript (Node) for Core; TypeScript for the VS Code extension.
- **Core:** plain Node module, no UI dependencies.
- **Panel:** VS Code Extension API + a simple HTML/CSS/JS webview.
- **Inline:** a Claude Code plugin (skill + output-style/instructions) + a hook for the Panel.
- **Generation:** the local `claude` CLI (subscription) by default; Anthropic SDK only for the
  optional API-key path.
- **Storage:** small local JSON files (desktop); within-conversation memory (mobile).

## 14. Suggested build order (for the implementation plan)

1. **Lumi Core** — concept dictionary + detector + profile interface + lesson types (with a
   mocked generator). Fully unit-tested.
2. **Subscription generator** — wire the lesson generator to the `claude` CLI.
3. **Lumi Inline** — the Claude Code plugin/skill that teaches inline (reaches mobile). This is
   the smallest end-to-end slice that delivers value everywhere.
4. **Lumi Panel** — VS Code extension: hook intake → Core → card UI → "Got it" → progress shelf.
5. **Polish** — settings, error/empty states, persistent profile, progress view.

## 15. Open questions / future layers

- Grow the concept dictionary; later, optional AI-based concept *detection*.
- Later layers (post-v1): "suggest next input" and "flag problems in plain language".
- Possible future: light persistent progress on mobile if a storage path becomes available.
- Possible future productization (accounts, hosted generation) — intentionally out of scope now.
