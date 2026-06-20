# Changelog

All notable changes to Lumi are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
