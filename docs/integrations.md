# Using Lumi with any AI coding tool

Lumi is a mini-teacher that rides along inside your AI coding tool and teaches you each new
technical concept the first time it appears — in plain English, never repeating a concept you
already know. This guide explains how Lumi reaches different tools and how to add Lumi to any
tool you use today.

---

## The two ways Lumi reaches a tool

### Path A — Inline teaching skill (where the tool supports Claude-style skills)

Some AI coding tools let you install a *skill* or *plugin* that adds instructions to every
response. When a skill is active, the model itself outputs the lesson inline — right inside
the tool's normal reply.

Lumi ships this as `claude-plugin/skills/lumi-teach/SKILL.md`. When Claude Code loads it,
every response that touches a technical concept ends with a `🪄 Lumi — quick lesson` block.
The skill reads and writes `~/.lumi/profile.json` (using Claude Code's file tools) so the
same profile persists across sessions — a concept you learned on Monday is never re-taught on
Tuesday.

This path requires no separate process. The lesson generation, concept detection, and profile
updates all happen inside the model's response cycle. It is the richest, lowest-friction
experience for tools that support the model.

**Note on the packaged hook:** The post-tool hook that pipes Claude Code output through `lumi feed` requires the `lumi` CLI to be reachable on your PATH — set `LUMI_BIN=/path/to/core/dist/cli-bin.js` or install `lumi` globally before enabling it. If the binary is not found the hook exits silently, so lessons simply will not appear rather than breaking your session.

### Path B — Feed and companion (works with any tool that produces text output)

The second path is completely tool-agnostic. It works like a Unix pipe:

1. Your AI tool produces text — a response, a transcript, a terminal session.
2. That text is passed to `lumi feed --source <tool-name>`.
3. `lumi feed` runs concept detection using the `@lumi/core` library, then writes one
   *lesson event* per new concept to `~/.lumi/feed.jsonl` as an append-only log line.
4. Any Lumi surface — the CLI, a VS Code panel, or the planned desktop overlay — tails that
   feed file and renders the lessons.

The feed format is a versioned JSONL file where each line looks like:

```json
{
  "v": 1,
  "id": "evt_<uuid>",
  "ts": "2026-06-14T12:00:00Z",
  "source": "gemini-cli",
  "type": "lesson",
  "concept": "environment-variable",
  "level": "beginner",
  "lesson": {
    "title": "Environment variable",
    "plainExplanation": "...",
    "whyItMatters": "..."
  }
}
```

Writers detect concepts once and write structured events. Readers — panels, overlays, the
CLI — only render those events; they contain zero detection logic. This keeps every surface
in sync and means a new surface (say, a mobile companion) requires no changes to how
detection works.

The feed file lives at `~/.lumi/feed.jsonl` by default. Set the `LUMI_HOME` environment
variable to move it somewhere else (useful in CI or multi-user setups).

---

## Generic adapter — add Lumi to any tool today

If your tool prints its output to the terminal, you can pipe that output to Lumi right now:

```sh
your-ai-tool | lumi feed --source your-tool
```

`lumi feed` reads the text passed in, runs Lumi's concept detector, generates lessons (using
whatever AI CLI is configured — see "Model-agnostic lesson generation" below), and appends
lesson events to the feed.

A reference implementation of this shell adapter is at
`adapters/generic/lumi-pipe.sh`. Run it as:

```sh
your-ai-tool | bash adapters/generic/lumi-pipe.sh your-tool
```

**Honest note on stdin wiring:** `lumi feed` currently receives text through the `input`
field in its programmatic API (used by tests and hooks). Reading from stdin in the installed
binary (`dist/cli-bin.js`) is a small, self-contained follow-up that needs to be wired and
confirmed on the founder's machine. The adapter script in this repo documents the intended
pattern; the stdin path will be confirmed once the build is run and end-to-end tested live.

---

## Per-tool install

> **Important — standalone repo requirement for Codex, Cursor, Gemini CLI, and OpenCode:**
> These four tools load plugins from a repository root. The per-tool manifests are built and
> live inside `claude-plugin/` in this repo, ready to go. Before the install commands below
> will work, the founder must publish `claude-plugin/`'s contents as a standalone repository
> (for example `github.com/stefanbogdanmda/lumi-plugin`) so each tool can point at its root.
> Creating that repo and verifying each live install is a founder/PC step — it cannot be
> confirmed in this sandbox.

### Claude Code (shipped)

```
/plugin marketplace add stefanbogdanmda/digitalproduct
/plugin install lumi@lumi
```

Then use Claude Code normally. The `lumi-teach` skill activates in every session and the
`~/.lumi/profile.json` profile persists across sessions via Claude Code's file tools.

### GitHub Copilot (shipped)

```
copilot plugin marketplace add stefanbogdanmda/digitalproduct
copilot plugin install lumi
```

Lumi works inside VS Code through Copilot's plugin system with the same `lumi-teach` skill.

### Codex (manifests built — live install needs standalone repo)

In the Codex interface, run:

```
/plugins
```

Then search for `lumi` or add the plugin from `https://github.com/stefanbogdanmda/lumi-plugin`
once that repository is published. The manifest at `.codex-plugin/plugin.json` is ready.

### Cursor (manifests built — live install needs standalone repo)

In the Cursor command palette or Cursor settings, run:

```
/add-plugin lumi
```

Or add via the Cursor plugin marketplace by pointing at
`https://github.com/stefanbogdanmda/lumi-plugin`. The manifest at `.cursor-plugin/plugin.json`
is ready.

### Gemini CLI (manifests built — live install needs standalone repo)

```sh
gemini extensions install https://github.com/stefanbogdanmda/lumi-plugin
```

The extension manifest (`gemini-extension.json`) tells Gemini CLI to load `GEMINI.md`, which
imports the `lumi-teach` skill via `@./skills/lumi-teach/SKILL.md`. This `@`-import pattern
injects the skill as context in every Gemini CLI session.

### OpenCode (manifests built — live install needs standalone repo)

Add to the `plugin` array in your `opencode.json` (at `~/.config/opencode/opencode.json` for
a global install, or at your project root for a project-level install):

```json
{
  "plugin": ["lumi@git+https://github.com/stefanbogdanmda/lumi-plugin.git"]
}
```

Restart OpenCode. The `LumiPlugin` in `.opencode/plugins/lumi.js` injects the `lumi-teach`
skill into every session's first user message. Verify by asking: "What is Lumi?"

To pin a specific version:

```json
{
  "plugin": ["lumi@git+https://github.com/stefanbogdanmda/lumi-plugin.git#v0.1.0"]
}
```

---

## Per-tool status

| Tool | Status | How it works |
|---|---|---|
| Claude Code | Shipped (inline skill) | Install via `/plugin marketplace add`. The `lumi-teach` skill is active in every session. Profile stored in `~/.lumi/profile.json` via Claude Code's file tools. |
| GitHub Copilot | Shipped (inline skill) | Install via `copilot plugin marketplace add`. Same `lumi-teach` skill, same `~/.lumi/profile.json` profile. |
| Codex | Manifests built — live-verify at PC | `.codex-plugin/plugin.json` is ready with the full `interface` block. Needs `lumi-plugin` standalone repo published, then `/plugins` search to confirm. |
| Cursor | Manifests built — live-verify at PC | `.cursor-plugin/plugin.json` is ready. Needs `lumi-plugin` standalone repo published, then `/add-plugin` or marketplace install to confirm. |
| Gemini CLI | Manifests built — live-verify at PC | `gemini-extension.json` + `GEMINI.md` with `@`-import are ready. Needs `lumi-plugin` standalone repo published, then `gemini extensions install <url>` to confirm. |
| OpenCode | Manifests built — live-verify at PC | `.opencode/plugins/lumi.js` (`LumiPlugin`) is ready. Needs `lumi-plugin` standalone repo published, then `opencode.json` plugin array install to confirm. |
| Generic (any tool) | Adapter pattern documented | `adapters/generic/lumi-pipe.sh` — pipe any tool's output to `lumi feed`. Stdin wiring in the CLI binary is a small follow-up (see above). |

---

## Model-agnostic lesson generation via CliGenerator

Lumi does not require Claude to generate lessons. The `CliGenerator` class in
`core/src/generator.ts` takes two things: a binary name and a function that turns a prompt
string into the argument list for that binary. Any AI CLI that accepts a prompt and returns
text can power Lumi's lessons.

Three presets ship today:

- `ClaudeCliGenerator` — runs `claude -p "<prompt>"` (the default).
- `CodexCliGenerator` — runs `codex exec "<prompt>"`.
- `GeminiCliGenerator` — runs `gemini -p "<prompt>"`.

You can construct your own for any CLI:

```ts
import { CliGenerator } from "@lumi/core";

const myGenerator = new CliGenerator({
  bin: "my-ai-cli",
  buildArgs: (prompt) => ["--prompt", prompt, "--format", "json"],
});
```

The generator calls `buildLessonPrompt(concept, context, level)` to build a structured
prompt, then parses the JSON response. If the primary generator fails (network down, CLI not
installed), `FallbackGenerator` falls back to an offline `MockGenerator` automatically, so
Lumi never hard-crashes the user's session.

The lesson prompt asks the model to reply with a strict JSON block
(`title`, `plainExplanation`, `whyItMatters`, optional `analogy`, `tinyExample`, `learnMore`)
in a `json` fenced code block. This format is the same regardless of which AI tool generates
the lesson.

---

## The shared state contract

All tools share the same files under `~/.lumi/` (or `$LUMI_HOME/`):

| File | Contents |
|---|---|
| `profile.json` | JSON array of learned concepts — `{ "id", "learnedAt", "seenCount" }` per entry. Read before teaching; written after. |
| `cache.json` | Cached lesson text keyed by concept ID, so the same concept is not regenerated every time. |
| `feed.jsonl` | Append-only JSONL event log. Every lesson event from every tool lands here. |

Because all tools read the same `profile.json`, a concept you learned through Gemini CLI will
not be re-taught when you switch to Claude Code, and vice versa.

---

## Next steps (roadmap item 9)

The multi-tool packaging tracked as roadmap item 9 has reached the following state:

- Per-tool manifests built and validated: Codex (`.codex-plugin/plugin.json`), Cursor
  (`.cursor-plugin/plugin.json`), Gemini CLI (`gemini-extension.json` + `GEMINI.md`),
  OpenCode (`.opencode/plugins/lumi.js` + `.opencode/INSTALL.md`). All JSON parses clean;
  the OpenCode JS plugin passes `node --check`.

Remaining steps (all require the founder's machine):

1. **Publish `claude-plugin/` as `github.com/stefanbogdanmda/lumi-plugin`** — create a new
   public repo, copy the contents of `claude-plugin/` to its root, and push. This is the
   prerequisite for every root-manifest tool below.
2. **Verify Codex live install** — run `/plugins` in Codex, confirm the plugin loads and
   lessons appear.
3. **Verify Cursor live install** — run `/add-plugin` or use the marketplace, confirm the
   skill activates.
4. **Verify Gemini CLI live install** — run `gemini extensions install
   https://github.com/stefanbogdanmda/lumi-plugin`, start a session, confirm `@`-import
   injects the skill.
5. **Verify OpenCode live install** — add to `opencode.json`, restart OpenCode, ask "What is
   Lumi?", confirm the `LumiPlugin` bootstrap message appears.
6. **Wire stdin reading** into `core/dist/cli-bin.js` so `tool | lumi feed` works end-to-end
   in a real shell (small change in `core/src/cli.ts`, needs live test).
7. **Verify `CodexCliGenerator` and `GeminiCliGenerator`** against their live CLIs — confirm
   exact argv, auth flow, and timeout behavior.
