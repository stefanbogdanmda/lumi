# Lumi Panel (VS Code)

A friendly side-panel that teaches you each NEW tech concept Claude Code uses, with a progress
shelf of everything you've learned. Lessons are generated with your Claude subscription via the
local `claude` command.

## Setup
1. Install this extension.
2. Register the Lumi hook with Claude Code so it forwards output to Lumi. Add to your Claude Code
   settings `hooks` a Stop hook running `vscode-extension/hook/lumi-hook.sh`.
3. Open the **Lumi** view in the Explorer sidebar. New concepts appear as cards; click **Got it**
   to add them to your progress.
