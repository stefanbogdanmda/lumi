<p align="center">
  <img src="https://raw.githubusercontent.com/stefanbogdanmda/lumi/main/vscode-extension/media/lumi-ide.gif" alt="Lumi teaching a concept and flagging a leaked secret" width="640">
</p>

# Lumi — understand what your AI builds

A friendly side-panel that teaches the concept behind what your AI coding tool just did — **remembers** it across tools, **reviews** it so it sticks, and **flags risky code** before you ship. Built for non-technical builders.

## Setup
1. Install this extension.
2. Register the Lumi hook with Claude Code so it forwards output to Lumi. Add to your Claude Code
   settings `hooks` a Stop hook running `vscode-extension/hook/lumi-hook.sh`.
3. Open the **Lumi** view in the Explorer sidebar. New concepts appear as cards; click **Got it**
   to add them to your progress.
