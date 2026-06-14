# Lumi

**Lumi is a friendly mini-teacher for Claude Code.** It watches the tech that Claude Code
uses on your behalf and, the first time a *new* concept shows up, gives you one short,
plain-English lesson — so you learn as you build, without being overwhelmed.

Lumi only teaches each concept **once**, and only concepts you haven't already learned. The
goal is gentle, just-in-time learning for people who are new to coding.

## How lessons are generated

Lumi generates lessons using **your existing Claude subscription** through the local
[`claude` CLI](https://docs.claude.com/en/docs/claude-code/overview) — no API key and no extra
cost. The inline plugin uses Claude Code directly; the VS Code panel shells out to the
`claude` command via `ClaudeCliGenerator`.

## Architecture: one brain, two faces

Lumi is a UI-agnostic **Core** plus two user-facing surfaces ("faces").

### 1. Core — the brain (`core/`)

A TypeScript/Node library published as the `@lumi/core` workspace package. It:

- detects tech concepts in text (`detectConcepts`),
- tracks a learning profile so each concept is taught only once
  (`InMemoryProfile` / `JsonFileProfile`),
- caches generated lessons for reuse (`InMemoryCache` / `JsonFileCache`),
- generates lessons (`MockGenerator` for tests, `ClaudeCliGenerator` for real use), and
- orchestrates all of the above behind a small `Lumi` API (`processOutput`,
  `teachAndRemember`).

**Setup**

```bash
npm install
npm test --workspace core      # run the unit tests
npm run build --workspace core # produce core/dist
```

### 2. Lumi Inline — Claude Code plugin (`claude-plugin/`)

A pure files/JSON Claude Code plugin (no build step) that appends a short "🪄 Lumi — quick
lesson" to replies the first time a new concept appears in a conversation. Because it runs
inside Claude Code, it works in the terminal, on desktop, and on **the mobile app**, using
your subscription.

**Setup**

```
/plugin marketplace add <your-org>/lumi
/plugin install lumi@lumi
```

### 3. Lumi Panel — VS Code extension (`vscode-extension/`)

A VS Code side-panel that renders lesson cards with a "Got it ✅" button and a running
progress count. A Claude Code **Stop hook** (`vscode-extension/hook/lumi-hook.sh`) appends
Claude's output to a feed file; the extension's `HookBridge` watches that file, feeds new
text to `@lumi/core`, and shows a card for each new concept.

**Setup**

```bash
npm install                                  # links the @lumi/core workspace dependency
npm run build --workspace core
npm run compile --workspace vscode-extension # produces vscode-extension/out
```

Then register `vscode-extension/hook/lumi-hook.sh` as a Stop hook in your Claude Code
settings and open the **Lumi** view in the Explorer sidebar. See
[`vscode-extension/README.md`](vscode-extension/README.md) for details.

## Design

For the full design and rationale, see
[`docs/superpowers/specs/2026-06-14-lumi-design.md`](docs/superpowers/specs/2026-06-14-lumi-design.md).
