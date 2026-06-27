import type { SessionEvent } from "./types";
import { parseCodexExecOutput } from "./codex-output";

/** A Codex shell call awaiting its output line, keyed by call_id. */
interface PendingCodexCall {
  command: string;
  cwd: string;
  ts: string;
}

/** Per-file Codex parser state: session cwd/id + pending shell calls. */
export interface CodexState {
  cwd: string;
  sessionId: string;
  pending: Map<string, PendingCodexCall>;
}

export function makeCodexState(): CodexState {
  return { cwd: "", sessionId: "", pending: new Map() };
}

function proseFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b && typeof b.text === "string" && (b.type === "output_text" || b.type === "text"))
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

/**
 * Map a batch of newly-appended Codex rollout JSONL lines to SessionEvents.
 * `state` is owned by the caller so session cwd and pending shell calls persist
 * across batches. Canonical sources only: `response_item` message(role=assistant)
 * for prose, function_call → function_call_output (joined by call_id) for shell.
 * `event_msg` agent_message/user_message duplicates and user prompts are skipped.
 */
export function extractCodexEvents(lines: string[], state: CodexState): SessionEvent[] {
  const events: SessionEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }

    const ts: string = entry?.timestamp ?? entry?.ts ?? "";
    const p = entry?.payload;

    if (entry?.type === "session_meta") {
      if (typeof p?.cwd === "string") state.cwd = p.cwd;
      if (typeof p?.id === "string") state.sessionId = p.id;
      continue;
    }
    if (entry?.type !== "response_item" || !p || typeof p !== "object") continue;

    if (p.type === "message" && p.role === "assistant") {
      const text = proseFromContent(p.content);
      if (text) {
        events.push({ tool: "codex", sessionId: state.sessionId, cwd: state.cwd, ts, role: "assistant", text });
      }
    } else if (p.type === "function_call" && typeof p.call_id === "string") {
      const name = typeof p.name === "string" ? p.name : "";
      let args: any = {};
      try { args = JSON.parse(p.arguments ?? "{}"); } catch { args = {}; }
      const command = typeof args.command === "string" ? args.command.trim() : "";
      // Treat any function_call carrying a `command` arg as shell, covering future
      // Codex tool names we don't know yet. If a non-shell tool ever gains a
      // `command` key, add an explicit exclusion here.
      const isShell = name === "shell" || name === "shell_command" || !!command;
      if (isShell && command) {
        state.pending.set(p.call_id, {
          command,
          cwd: typeof args.workdir === "string" && args.workdir.trim() ? args.workdir.trim() : state.cwd,
          ts,
        });
      }
    } else if (p.type === "function_call_output" && typeof p.call_id === "string") {
      const pend = state.pending.get(p.call_id);
      if (!pend) continue;
      state.pending.delete(p.call_id);
      const { exitCode, stdout } = parseCodexExecOutput(typeof p.output === "string" ? p.output : "");
      events.push({
        tool: "codex",
        sessionId: state.sessionId,
        cwd: pend.cwd,
        ts: ts || pend.ts,
        role: "user",
        command: pend.command,
        ...(stdout ? { stdout } : {}),
        ...(exitCode !== undefined ? { exitCode } : {}),
      });
    }
    // reasoning / web_search_call / unknown payload types are ignored
  }

  return events;
}
