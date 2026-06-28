# Security Policy

Lumi handles things that deserve care: it can **capture terminal output and AI-session
transcripts**, runs a **localhost WebSocket** that backs a real terminal, and ships a
**security lens** that other people rely on. We take reports seriously.

## Supported versions

Lumi is pre-1.0 and ships from `main`. Security fixes land on `main` and in the next
published `@lumi/core` release. Please test against the latest `main` before reporting.

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab → **Report a vulnerability** (GitHub Private
   Vulnerability Reporting).
2. If that isn't available to you, open a minimal public issue that says only *"security
   report — please open a private channel"* (no details) and the maintainer will follow up,
   or reach the maintainer via the GitHub profile [@stefanbogdanmda](https://github.com/stefanbogdanmda).

Please include: affected surface (CLI / web overlay / `/term` WebSocket / VS Code extension /
inline plugin), version or commit, reproduction steps, and impact.

## Scope — areas worth your attention

These are the most security-relevant parts of Lumi:

- **`/term` WebSocket and the PTY backend** — terminal input/output transport. Origin is
  restricted to localhost and frames are size-capped; report any bypass.
- **Capture & consent** — terminal/session capture is default-OFF and consent-gated. Report
  any path that captures without consent, or that ignores the consent scopes.
- **Redaction** (`core/src/redact.ts`) — strips secrets/PII before anything is written or
  taught. Report secret shapes that slip through, or ReDoS on hostile input.
- **License signing** — report anything that lets Pro features be unlocked without a valid key.

## What to expect

This is a solo-maintained portfolio project, so response is best-effort, but you can expect an
acknowledgement and a good-faith fix timeline. We'll credit you in the release notes unless you
prefer to stay anonymous. Please give us a reasonable window to fix before any public disclosure.
