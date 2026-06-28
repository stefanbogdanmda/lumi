# Contributing to Lumi

Thanks for your interest in Lumi. This guide gets you from clone to green build, and explains
what a mergeable change looks like.

## Project shape

Lumi is an npm **workspaces** monorepo. Almost all logic lives in **`core/`** (`@lumi/core`) —
a UI-agnostic TypeScript engine. The surfaces (`vscode-extension/`, the inline plugin, the web
overlay served by `core`, the CLI) stay thin and call into `core`. Keep `core`
framework-agnostic; tool-specific code belongs in `adapters/`.

## Prerequisites

- **Node.js >= 18** (CI uses Node 20)
- npm (ships with Node)

`node-pty` is an **optional** native dependency that powers the real Lumi Terminal. If a
prebuilt binary isn't available for your platform, install still succeeds and the terminal
degrades gracefully — you do not need it to work on most of the codebase.

## Setup

```bash
npm install
```

## Everyday commands

```bash
npm test                         # run the core test suite (vitest)
npm run build                    # type-check + build core -> core/dist
npm test  --workspace core       # same suite, explicit workspace form
npm run build --workspace core
```

To run the web overlay from source after a build:

```bash
node core/dist/cli-bin.js serve  # then open http://localhost:4321
```

## Reproduce CI locally

CI (`.github/workflows/ci.yml`) runs more than the core suite. To mirror it before opening a PR:

```bash
npm install
node -e "try{require('node-pty');console.log('node-pty: available')}catch(e){console.log('node-pty: unavailable (optional)')}"
npm test    --workspace core
npm run build   --workspace core
npm run compile --workspace vscode-extension
npm run bundle  --workspace vscode-extension
node -e "require('./.claude-plugin/marketplace.json'); require('./claude-plugin/.claude-plugin/plugin.json'); console.log('manifests ok')"
bash -n vscode-extension/hook/lumi-hook.sh
```

## How we work

- **Test-driven by default.** This repo keeps a large, green suite. Write the test first, watch
  it fail, implement, watch it pass. Never weaken or delete a test to make a change "pass" —
  fix the implementation.
- **Strict TypeScript.** Prefer precise types over `any`/`unknown` casts.
- **Many small, cohesive files** (~400 lines typical) over a few large ones.
- **Immutable patterns** — return new objects rather than mutating in place.
- **Never hard-fail.** The product degrades to an offline/basic fallback rather than crashing.
- **No secrets or personal data** in code, tests, logs, or anything user-visible. This is a
  public repo — treat every commit as if a stranger will read it.

## Branches & commits

- Work on a **descriptive branch** (`add-review-scheduler`), never directly on `main`.
- Use **Conventional Commit** style subjects (`feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `perf:`, `chore:`). Be specific — never `fix` or `wip`.

## Opening a pull request

Before you open a PR:

1. The core suite is green and the build is clean.
2. New behavior has new tests.
3. Docs/README/CHANGELOG are updated if behavior or commands changed.
4. No secrets or personal data introduced.

The PR template will walk you through a short summary, the test plan, and a checklist. Found a
security issue instead? Please follow [SECURITY.md](SECURITY.md) — don't open a public issue.
