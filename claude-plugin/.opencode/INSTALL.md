# Installing Lumi for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed

## Installation

Add lumi to the `plugin` array in your `opencode.json` (global or project-level).
Your `opencode.json` lives at `~/.config/opencode/opencode.json` for a global install,
or at the root of your project for a project-level install.

```json
{
  "plugin": ["lumi@git+https://github.com/stefanbogdanmda/lumi-plugin.git"]
}
```

> **Note:** The plugin must be published as a standalone repo (see "Publishing" below).
> The manifests are built and ready; the `lumi-plugin` repo just needs to be created
> and the `claude-plugin/` folder contents pushed to its root.

Restart OpenCode. The plugin installs through OpenCode's plugin manager and
injects the `lumi-teach` skill into every session.

Verify by asking Gemini or your configured model: "What is Lumi?" — you should see
a `Lumi — quick lesson` block in the response.

## Publishing (founder step — needed before the install above works)

Because Codex, Cursor, Gemini CLI, and OpenCode all load plugins from a **repo root**,
the `claude-plugin/` folder must be published as its own standalone repository, for example
`github.com/stefanbogdanmda/lumi-plugin`. The per-tool manifests inside `claude-plugin/`
are ready; they just need to be at the root of that new repo.

Steps:
1. Create `https://github.com/stefanbogdanmda/lumi-plugin` (public).
2. Copy the contents of `claude-plugin/` to the root of `lumi-plugin`.
3. Push. OpenCode (and Codex, Cursor, Gemini CLI) can then install from that URL.

## Usage

Once installed, Lumi is automatic — just use OpenCode normally. Whenever a new technical
concept appears in a response (a git command, an API call, a JSON file), Lumi adds a short
"Lumi — quick lesson" block at the end.

Learned concepts are stored in `~/.lumi/profile.json` so the same concept is never taught
twice, even across different sessions or different tools.

## Pinning a specific version

```json
{
  "plugin": ["lumi@git+https://github.com/stefanbogdanmda/lumi-plugin.git#v0.1.0"]
}
```

## Troubleshooting

### Plugin not loading

1. Check that the `plugin` line is in the right `opencode.json`.
2. Restart OpenCode after editing the config.
3. Check OpenCode logs: `opencode run --print-logs "hello" 2>&1 | grep -i lumi`

### Lessons not appearing

1. Make sure you are on a recent version of OpenCode that supports
   `experimental.chat.messages.transform`.
2. Ask: "Are you Lumi?" — if the model does not know about Lumi, the plugin
   context did not inject. Re-check the plugin array and restart.

### Windows install issues

Some Windows OpenCode builds have upstream issues with git-backed plugin specs.
If OpenCode cannot install the plugin, try:

```powershell
npm install lumi@git+https://github.com/stefanbogdanmda/lumi-plugin.git --prefix "$HOME\.config\opencode"
```

Then point `opencode.json` at the local path:

```json
{
  "plugin": ["~/.config/opencode/node_modules/lumi"]
}
```

## Getting Help

- Report issues: https://github.com/stefanbogdanmda/digitalproduct/issues
- Full documentation: https://github.com/stefanbogdanmda/digitalproduct/blob/main/docs/integrations.md
