# Changelog

All notable changes to Lumi are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Lumi Terminal — a real terminal inside the web overlay.** A new `Terminal` tab embeds an
  xterm.js terminal served over a localhost-only `/term` WebSocket, with an optional native
  `node-pty` backend (gracefully degrades when the prebuilt binary is unavailable). Capture of
  terminal output is **consent-gated and default-OFF**; when enabled, output flows through the
  same redaction pipeline as the rest of Lumi before any lesson is generated. The WebSocket
  handshake enforces a same-origin (localhost) policy, caps inbound frame size, and clamps
  resize geometry, so a stray browser tab can't open a shell on your machine.
- **Security lens in the VS Code panel's Paste tab.** Completing parity across all three
  surfaces (CLI, web overlay, VS Code), pasting AI-generated code into the extension now
  runs the security lens and renders flagged risks (clean advice, theme-aware severity
  colors) alongside the extracted lessons.
- **Security lens in the web overlay's Paste tab.** Pasting AI-generated code into the
  overlay now runs the security lens alongside concept detection — the `/api/paste`
  response includes flagged risks (clean "why/how-to-fix" advice, friendly severity), and
  the Paste tab renders them. The product's core "wedge" is no longer CLI-only; it surfaces
  at the exact moment a beginner pastes code they didn't write.

### Fixed
- **Action-based detection covers more common dev actions.** When Lumi sees the commands
  Claude runs / files it writes, it now maps `tsc` → compiling, `npm test` → test suite, and
  `.sql` files → database (all concepts that already existed but had no action rule), so
  these fire reliably from the action signal, not only from prose.
- **`api` detected on "API returns/data" phrasings.** Added returns/data/json/fetch/serve
  anchors so "the API returns JSON data" fires, while non-tech "company API guidelines"
  stays quiet.
- **`caching` detected on common phrasings.** "I cached the response to make it faster" /
  "caching the API result" now fire (added response/result/data/query/performance/speed
  anchors), while "cache in on this opportunity" stays quiet.
- **"array" detected in reverse word order.** Same forward-only gap as `function`: "every
  item in the array" / "the elements of the array" now fire, while "an array of services"
  / "a dazzling array of colors" stay quiet.
- **"function" detected in reverse word order.** The matcher only fired on "function →
  call/return/parameter"; common AI phrasing like "I added a parameter to the function"
  was missed. Added a tight reverse matcher (parameter/argument/return value → function)
  that still ignores everyday "function of the heart" / "function room".
- **Security lens reads plain-English risk descriptions (paste mode), incl. plurals.**
  Browser-builder users (Lovable/Bolt/v0) describe risks in prose, not code. Fixed a
  *systematic* plural-boundary bug where matchers anchored on a singular noun (`\buser\b`,
  `\bpassword\b`, `\bcookie\b`, `\btoken\b`, `\bendpoint\b`) silently missed the common
  plural — so "stack trace shown to **users**", "stores **passwords** in plain text", "the
  **cookies** are missing httpOnly", "auth **tokens** in localStorage", and "the
  **endpoints** have no authentication" are now flagged. Added a prose matcher for "the API
  key is hardcoded" (benign "hardcoded the timeout/keyboard shortcut" stays quiet, and a
  preventive guard keeps "prevent/never hardcode secrets" from false-alarming). Locked
  in with a singular-vs-plural regression test across six concepts.
- **Security lens catches `NODE_ENV=development` on a prod server.** The debug-in-prod
  detector handled `DEBUG=True`+prod but missed the Node-specific signal; it now flags
  `NODE_ENV="development"` when production context is present, while safe local
  `NODE_ENV=development` does not fire.
- **Security lens catches two more real code patterns.** Mass assignment now flags passing
  the whole request body straight into an ORM call (`User.create(req.body)`, `new
  User(req.body)`), not just the spread form — while `res.json(req.body)`/`validate(req.body)`
  stay safe. Verbose-error now flags a stack trace sent to the client
  (`res.send(err.stack)`, `res.json({error: err.stack})`) while safe server-side logging
  (`console.log(err.stack)`) is not flagged.
- **Security lens now catches the real `algorithms: ["none"]` JWT bypass.** The matchers
  flagged the JWT-header form (`alg: "none"`) but missed the common jsonwebtoken options
  form `jwt.verify(token, secret, { algorithms: ["none"] })` — the way the vulnerability
  actually appears in Node code. Added a matcher that fires only when "none" is in the
  algorithms array (the safe `["HS256"]` allowlist is not flagged).
- **`.env` file mentions are now detected.** The env-var matcher `\b\.env\b` never matched a
  space-preceded ".env" (there's no word boundary before a dot), so "add a .env file" — one
  of the most common things an AI tells a beginner — produced no lesson. Fixed to `\.env\b`
  (catches `.env`, `.env.local`, …) without firing on the word "environment".
- **`deploy` no longer false-fires on ordinary English.** Its matcher was unanchored, so
  "deploy the team", "deploy our sales reps", "deploy troops" all triggered a Deploying
  lesson. It's now anchored to a software-deploy context (deploy + app/site/server/
  production/cloud/Vercel/…, "deploy to production", "deployment pipeline", etc.) — real
  deploy mentions still detected, ordinary usage ignored, matching Lumi's anti-false-lesson
  design.
- **Guarded the security lens against false alarms.** Added a regression test asserting the
  lens stays silent on 10 common *safe* patterns (`process.env` keys, parameterized queries,
  `textContent`, `bcrypt.hash`, `httpOnly` cookies, `algorithms: ["HS256"]`, …) so future
  matcher additions can't erode its precision — crying wolf would undermine the wedge.
- **Guarded the security dictionary against silent gaps.** Added integrity tests asserting
  every security-category concept has a severity and curated hint/fix/advice — so a future
  concept added without guidance fails CI instead of silently degrading `check`/`audit`.
- **Guarded detection through markdown formatting.** Added a test confirming concepts are
  detected even when wrapped in inline backticks, bold, code fences, or list markers (AI
  output is always markdown). All current cases verified working.
- **Guarded every lesson's "Learn more" link.** Added a test validating `learnMoreUrl` for
  all 136 concepts (well-formed, encoded, non-empty query) so a future concept/category
  can't ship a broken citation link. (All current links verified valid.)

- **Shareable card pointed at the wrong npm package.** The progress card's footer said
  `npm i -g lumi`, which installs an unrelated package — not Lumi. It now shows the real
  install command, `npm i -g @lumi/core`, so the card actually helps people who scan it.

### Changed
- **Overlay footer shows the "next milestone" nudge.** Between milestones the overlay
  footer went blank; it now shows the same forward goal as `lumi progress` (e.g. "🎯 2 more
  concepts to reach the Growing level") via a new `nextMilestone` field on `/api/progress`.
- **Overlay active-recall reveal now shows the analogy.** The Review tab's "Reveal answer"
  showed only the plain explanation; it now also surfaces the analogy ("Think of it like:")
  — the memory hook that makes a concept stick at exactly the reveal moment.
- **`lumi review --forgot` offers an immediate refresh.** Marking a concept forgotten used
  to just say "you'll see it again soon"; it now points straight to `lumi explain "<term>"`
  so a learner who blanked can re-learn it on the spot instead of waiting for the schedule.
- **`lumi explain` and `lumi learn` now show the analogy and example.** The lesson
  generator always produces a plain-English analogy (and often a tiny example) — the parts
  that most help a non-technical learner — but the CLI was dropping them, showing only the
  explanation and "why it matters". Both now surface "Think of it like:" and "Example:"
  lines, matching what the overlay already showed.
- **`lumi setup` tells you what to do next.** After connecting a tool, setup now closes
  with concrete next steps (`lumi doctor` to verify, `lumi serve` to see lessons) instead
  of leaving a beginner at "…now what?".
- **`lumi review` caps a large backlog.** Instead of dumping every overdue concept, it now
  shows the 5 most overdue plus "…and N more", so a returning learner with a big backlog
  gets a manageable session instead of a wall of questions.
- **Empty states point to a concrete next action.** With nothing learned yet, `lumi next`
  and `lumi glossary` used to say "come back once you've built something". They now offer
  `lumi learn` and `lumi topics` so a brand-new user can start immediately instead of
  hitting a dead end.
- **`lumi doctor` leads with a clear verdict.** Instead of making beginners parse a list
  of checks, it now opens with "✅ You're all set" or "⚠️ Almost there — N things to set
  up", counting only real blockers (⚠️) and not informational notes.
- **Friendlier, consistent glossary headings.** The glossary now groups concepts under
  human-readable topic names ("Git & version control" instead of "git"), matching
  `lumi topics`.

### Added
- **`lumi glossary --out <file>` saves your glossary to Markdown.** Beginners can keep their
  personal glossary as a file in their project or share it — following the same `--out`
  convention as `card`, `certificate`, and `export`.
- **`lumi learn` — proactive, guided learning.** Until now you learned reactively (while
  building), by naming a term (`explain`), or by browsing (`topics`). `lumi learn` teaches
  the next concept on your learning path on demand — a plain-English lesson, recorded to
  your progress, with an "up next" trail — so a beginner who just wants to learn has a
  clear button. Run it again for the next one.
- **Forward "next badge" nudge in `lumi stats`.** Stats listed earned badges but gave no
  sense of what's next; it now shows the nearest concept-count badge to aim for (e.g.
  "🎯 9 more concepts to earn the \"Getting Started\" badge"), kept in lockstep with the
  real badge definitions.
- **Forward "next milestone" nudge in `lumi progress`.** Milestones were only celebrated
  at the moment you hit them; in between there was no sense of how close the next one was.
  Progress now shows a concrete near-term goal (e.g. "🎯 2 more concepts to reach the
  Growing level"), kept in lockstep with the milestone celebrations.
- **Recordable reviews in the CLI (`lumi review --got` / `--forgot`).** The terminal
  review flow used to only *show* recall questions — there was no way to record the
  result, so a CLI-only learner's spaced-repetition clock never advanced and the same
  concepts stayed "due" forever. Now `lumi review --got "<term>"` pushes the next
  refresher further out and `--forgot "<term>"` sends it back to the short queue, with
  the listing showing exactly how to record each result.

### Changed
- **`lumi audit` "Fix these first" now lists real fixes.** It previously showed the
  first sentence of each risk hint — which *describes* the problem rather than telling you
  what to do — and could truncate mid-sentence on fixes containing "e.g.". Each security
  risk now has a curated one-line action (e.g. "Move the secret into a .env file…"), shown
  in both the piped audit and the project scan (`--path`).
- **Cleaner, friendlier `lumi check` output.** The security lens no longer leaks the
  AI-facing "Explain this risk and show…" directive into what the learner reads — it now
  shows just the plain-English why-and-how-to-fix. Added a summary header (e.g. "Found 2
  security issues: 1 high, 1 medium"), beginner-friendly severity words (high/medium
  instead of danger/warn), and next-step pointers to `lumi explain` and `lumi audit`.

### Added
- **Prompt-writing coaching in `lumi prompt`.** After polishing a rough idea, Lumi now
  adds up to two plain-English "to get even better results next time" tips based on what
  the raw idea was missing (too vague, no definition of done, no platform, no tech
  preference). It teaches the #1 AI-coding skill — writing a good prompt — instead of
  only fixing it. Stays quiet on already-detailed ideas so it never nags.
- **"Related" trail after `lumi explain`.** A successful explanation now ends with 2–3
  sibling concepts from the same topic the learner hasn't met yet (most important first),
  so there's always an obvious next thing to learn — closing the explore → learn → explore
  loop alongside `lumi topics` and the "Did you mean?" suggestions.
- **`lumi topics` — browse everything Lumi can teach.** The glossary only shows what
  you've *already* learned, so a new user had no way to see the menu. `lumi topics`
  now maps the full 136-concept dictionary by category with counts and examples, and
  `lumi topics <category>` drills into one, ticking off what you already know. Surfaced
  from onboarding and from `lumi explain` when a term isn't recognized.
- **"Did you mean?" suggestions for `lumi explain`.** When a term doesn't match a
  concept exactly, Lumi now offers the closest matches instead of dead-ending. It
  tolerates typos and plurals (e.g. `lumi explain "comit"` → *Did you mean "Git
  commit"?*), so beginners who don't know the exact jargon still get pointed
  somewhere useful. High-confidence only, to avoid noisy guesses.

## [0.1.0] - 2026-06-14

First public release. Lumi is a friendly mini-teacher for Claude Code: it watches the tech
that Claude Code uses, and the first time a *new* concept appears it gives you one short,
plain-English lesson — once per concept, never repeating. Two faces share one brain: an
inline Claude Code plugin (works on mobile, runs on your Claude subscription) and a VS Code
side-panel with a progress shelf.

This release rolls up three internal development milestones:

### Core teaching ("v1.0")
- Concept detection over Claude's output, a learning profile that teaches each concept only
  once, a lesson cache, and lesson generation via the local `claude` CLI (your subscription —
  no API key).
- Two faces: the inline Claude Code plugin and the VS Code panel, both built on the same
  UI-agnostic `@lumi/core` package.

### Trust & accuracy ("v1.1")
- Ranked detection: Lumi teaches at most **2 concepts per turn** to avoid overwhelm.
- Tightened matchers so ordinary English ("committed to the plan", "branch of the company")
  no longer triggers lessons; dictionary expanded to ~36 concepts.
- Lessons anchor to what Claude *just did*, with anti-hallucination rules and length limits.
- Fixed the panel to read Claude's real reply from the conversation transcript.
- Continuous Integration on every push; "Makes sense ✅ / Still fuzzy 🤔" feedback buttons.

### Depth & packaging ("v1.2")
- Detects concepts from the **actions** Claude takes (commands run, files written), not just
  prose.
- Lessons **adapt to your level** (beginner → growing → confident) with level-aware caching.
- Desktop faces share one progress file under `LUMI_HOME` (default `~/.lumi`).
- The VS Code panel is bundled with esbuild and can be packaged into a publishable `.vsix`.
- The panel falls back to a basic offline lesson when the `claude` CLI isn't available.

### Known limitations
- Mobile progress does not yet sync with desktop (see
  [`docs/business/mobile-limitations.md`](docs/business/mobile-limitations.md)).
- The live VS Code webview and real `claude` CLI generation are best verified on a real
  machine.

[0.1.0]: https://github.com/stefanbogdanmda/lumi/releases/tag/v0.1.0
