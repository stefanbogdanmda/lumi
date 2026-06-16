# Installing Lumi

Lumi comes in two forms. Most people should start with **Lumi Inline** — it works everywhere,
including the mobile app, and takes about a minute.

---

## Option A — Lumi Inline (recommended, works on mobile)

This is a Claude Code plugin. It teaches you inline, right inside Claude's replies, using your
own Claude subscription. No coding required.

1. In Claude Code (terminal, desktop, or the mobile app), run:
   ```
   /plugin marketplace add stefanbogdanmda/digitalproduct
   ```
2. Then install Lumi:
   ```
   /plugin install lumi@lumi
   ```
3. That's it. Use Claude Code normally. When a new tech concept comes up, Lumi adds a short
   **"🪄 Lumi — quick lesson"** at the end of the reply.

> Tip: `/plugin` is a command you type **inside Claude Code's input**, not in a regular
> terminal.

---

## Option B — Lumi Panel (VS Code, desktop only)

A side-panel in VS Code that shows lesson cards and a progress shelf. Requires a desktop with
VS Code and the `claude` command installed.

**Once it's published to the VS Code Marketplace**, you'll just search "Lumi" in the
Extensions panel and click Install. Until then, you can build it from source:

```bash
git clone https://github.com/stefanbogdanmda/digitalproduct.git
cd digitalproduct
npm install
npm run build --workspace core
npm run bundle --workspace vscode-extension
```

Then, in VS Code, run the extension (open the folder and press **F5**, or install the built
`.vsix`), register `vscode-extension/hook/lumi-hook.sh` as a **Stop hook** in your Claude Code
settings, and open the **Lumi** view in the Explorer sidebar.

---

## Requirements & troubleshooting

**"I don't have the `claude` command."**
- The **Inline** plugin doesn't need it — it *is* part of Claude Code, so it just works.
- The **Panel** uses your local `claude` command to write lessons. If it isn't installed or
  you're not signed in, the panel still shows a basic built-in explanation and a hint in the
  status bar — it won't break. Install Claude Code and sign in to get full, tailored lessons.

**"Nothing appears."**
- Inline: make sure the plugin installed (`/plugin` list) and that you're doing something
  technical — Lumi only teaches genuinely *new* concepts.
- Panel: confirm the Stop hook is registered and that the **Lumi** view is open.

**Your progress** is stored locally under `LUMI_HOME` (default `~/.lumi`). Set the `LUMI_HOME`
environment variable to move it.
