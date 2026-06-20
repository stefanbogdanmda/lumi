# Lumi

A friendly **mini-teacher** that rides inside your AI coding tool and teaches you the concept behind what the AI just did — in plain English — then **remembers** it across tools, **reviews** it so it sticks, and **flags risky code** before you ship it. Built for non-technical builders.

Runs on your AI tool's **own** model (no separate login, API key, or cost), with an offline fallback.

## Install

```sh
npm install -g @lumi/core      # provides the `lumi` command
lumi setup --all               # connect Lumi to your installed AI tools
lumi serve                     # open the web overlay
```

## A few commands

```sh
lumi explain "<term>"   # teach a concept now (+ a "learn more" link)
lumi check              # flag risky patterns in piped AI output
lumi audit --path .     # grade your whole project A–F for security (Pro)
lumi path               # your learning-path progress and what's next
lumi next               # what to build next, and why
lumi prompt "<idea>"    # turn a rough idea into a clear prompt
lumi review             # spaced-repetition refresher
lumi stats              # streak, topics, badges
lumi upgrade            # what's in Lumi Pro
```

Works with **Claude Code, Codex, Cursor, Gemini, Copilot, and OpenCode**, across the CLI, a web overlay, a VS Code panel, and inline on mobile.

Full docs, surfaces, and the complete command list: **[github.com/stefanbogdanmda/lumi](https://github.com/stefanbogdanmda/lumi)**.

MIT licensed.
