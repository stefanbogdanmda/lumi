/**
 * Lumi plugin for OpenCode.ai
 *
 * Two responsibilities:
 *   1. Inject the lumi-teach skill as context so Lumi's inline mini-lessons
 *      appear in every OpenCode session (unchanged behaviour).
 *   2. After each assistant message, pipe the assistant text to the Lumi CLI
 *      (`lumi feed --source opencode`) so lesson events are written to
 *      ~/.lumi/feed.jsonl and the Lumi overlay auto-populates.
 *
 * Dependency-free: uses only Node built-ins (path, fs, os, url, child_process).
 * The feed-write is wrapped in try/catch and is fully fire-and-forget so it
 * can never break or slow down the OpenCode session.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple frontmatter extraction — avoids any external dependency for bootstrap
const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

// Normalize a path: trim whitespace, expand ~, resolve to absolute
const normalizePath = (p, homeDir) => {
  if (!p || typeof p !== 'string') return null;
  let normalized = p.trim();
  if (!normalized) return null;
  if (normalized.startsWith('~/')) {
    normalized = path.join(homeDir, normalized.slice(2));
  } else if (normalized === '~') {
    normalized = homeDir;
  }
  return path.resolve(normalized);
};

// Module-level cache for bootstrap content.
// SKILL.md does not change during a session, so we read and parse it once.
let _bootstrapCache = undefined; // undefined = not yet loaded, null = file missing

// Resolve how to invoke the Lumi CLI, mirroring vscode-extension/hook/lumi-hook.sh:
//   1. LUMI_BIN env var  -> node <LUMI_BIN>
//   2. bundled core/dist/cli-bin.js relative to this plugin
//   3. global `lumi` on PATH
// Returns { cmd, baseArgs } where baseArgs precede the feed arguments.
const resolveLumiInvocation = () => {
  const envBin = process.env.LUMI_BIN && process.env.LUMI_BIN.trim();
  if (envBin) {
    return { cmd: process.execPath, baseArgs: [envBin] };
  }
  // Fallback bundled CLI: this plugin lives at
  //   <repo>/claude-plugin/.opencode/plugins/lumi.js
  // and the CLI is at <repo>/core/dist/cli-bin.js  (../../../core/dist/cli-bin.js)
  const bundled = path.resolve(__dirname, '../../../core/dist/cli-bin.js');
  if (fs.existsSync(bundled)) {
    return { cmd: process.execPath, baseArgs: [bundled] };
  }
  // Last resort: a globally installed `lumi` on PATH.
  return { cmd: 'lumi', baseArgs: [] };
};

// Fire-and-forget write of assistant text to the Lumi feed. Never throws.
const writeToFeed = (text) => {
  try {
    if (!text || !text.trim()) return;
    const { cmd, baseArgs } = resolveLumiInvocation();
    const child = spawn(cmd, [...baseArgs, 'feed', '--source', 'opencode'], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: false,
    });
    // Swallow spawn errors (e.g. binary not found) so they never surface.
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.write(text);
    child.stdin.end();
  } catch {
    // Any synchronous failure is intentionally ignored.
  }
};

// Concatenate the text parts of a message into a single string.
const textFromParts = (parts) => {
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
    .trim();
};

export const LumiPlugin = async ({ client, directory }) => {
  const homeDir = os.homedir();
  const lumiSkillsDir = path.resolve(__dirname, '../../skills');
  const envConfigDir = normalizePath(process.env.OPENCODE_CONFIG_DIR, homeDir);
  const configDir = envConfigDir || path.join(homeDir, '.config/opencode');

  // Track assistant messages we've already fed so we only write once per
  // completed message (message.updated can fire multiple times per message).
  const fedMessages = new Set();

  // Helper to generate bootstrap content (cached after first call)
  const getBootstrapContent = () => {
    // Return cached result on subsequent calls
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    // Load the lumi-teach skill
    const skillPath = path.join(lumiSkillsDir, 'lumi-teach', 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      _bootstrapCache = null;
      return null;
    }

    const fullContent = fs.readFileSync(skillPath, 'utf8');
    const { content } = extractAndStripFrontmatter(fullContent);

    const toolMapping = `**Tool Mapping for OpenCode:**
When the lumi-teach skill references tools you don't have, substitute OpenCode equivalents:
- \`Read\` / \`Write\` / \`Edit\` → Your native file tools
- \`Bash\` → Your native shell tool
- File path \`~/.lumi/profile.json\` → read/write exactly that path to persist learned concepts across sessions`;

    _bootstrapCache = `<EXTREMELY_IMPORTANT>
Lumi is active in this session.

**IMPORTANT: The lumi-teach skill content is included below. It is ALREADY LOADED — you are currently following it. Do NOT try to load it again; that would be redundant.**

${content}

${toolMapping}
</EXTREMELY_IMPORTANT>`;

    return _bootstrapCache;
  };

  return {
    // Inject the lumi skills path into live config so OpenCode can discover
    // lumi-teach without manual symlinks or config file edits.
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(lumiSkillsDir)) {
        config.skills.paths.push(lumiSkillsDir);
      }
    },

    // Inject bootstrap into the first user message of each session.
    // Using a user message avoids token bloat from repeated system messages
    // and keeps compatibility with models that reject multiple system messages.
    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find(m => m.info.role === 'user');
      if (!firstUser || !firstUser.parts.length) return;

      // Guard: skip if already injected this session to prevent double-injection.
      if (firstUser.parts.some(p => p.type === 'text' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    },

    // After the assistant finishes a message, pipe its text to `lumi feed`
    // so lesson events land in ~/.lumi/feed.jsonl and the overlay populates.
    //
    // The `event` hook subscribes to OpenCode's event bus. We listen for
    // `message.updated`, which carries `properties.info` (the message). When
    // that message is an assistant message that has completed
    // (`info.time.completed` set), we fetch its parts via the client and
    // feed the concatenated text. The whole handler is defensive: any error
    // is swallowed so it can never break the session.
    event: async ({ event }) => {
      try {
        if (!event || event.type !== 'message.updated') return;
        const info = event.properties && event.properties.info;
        if (!info || info.role !== 'assistant') return;
        // Only act once the assistant message is complete.
        if (!info.time || !info.time.completed) return;

        const messageID = info.id;
        const sessionID = info.sessionID;
        if (!messageID || fedMessages.has(messageID)) return;
        fedMessages.add(messageID);

        // Fetch the full message (info + parts) to get the assistant text.
        let text = '';
        try {
          const res = await client.session.message({
            path: { id: sessionID, messageID },
          });
          const data = res && (res.data || res);
          text = textFromParts(data && data.parts);
        } catch {
          // If the client read fails, there's nothing more we can do.
          return;
        }

        writeToFeed(text);
      } catch {
        // Never let feed bookkeeping affect the OpenCode session.
      }
    },
  };
};
