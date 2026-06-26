import type { SessionEvent } from "./types";

/** A tool_use awaiting its result line, keyed by tool_use_id. */
export interface PendingToolUse {
  command?: string;
  files: string[];
  cwd: string;
  sessionId: string;
  gitBranch?: string;
  ts: string;
}

function assistantProse(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

/**
 * Map a batch of newly-appended Claude transcript JSONL lines to SessionEvents.
 *
 * - assistant `text` blocks → a prose SessionEvent.
 * - assistant `tool_use` blocks (Bash command / file_path) are held in `pending`
 *   until the following `user` line's top-level `toolUseResult` arrives, then
 *   emitted as a command SessionEvent carrying {command, stdout, stderr, files}.
 * `pending` is owned by the caller so a tool_use in one batch can join its result
 * in a later batch. Unknown line types and malformed JSON are skipped defensively.
 */
export function extractClaudeEvents(
  lines: string[],
  pending: Map<string, PendingToolUse>,
): SessionEvent[] {
  const events: SessionEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }

    const type = entry?.type;
    const sessionId: string = entry?.sessionId ?? "";
    const cwd: string = entry?.cwd ?? "";
    const gitBranch: string | undefined = entry?.gitBranch;
    const ts: string = entry?.timestamp ?? entry?.ts ?? "";
    const content = entry?.message?.content ?? entry?.content;

    if (type === "assistant") {
      const text = assistantProse(content);
      if (text) {
        events.push({ tool: "claude-code", sessionId, cwd, gitBranch, ts, role: "assistant", text });
      }
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type !== "tool_use" || typeof block.id !== "string") continue;
          const command = typeof block?.input?.command === "string" ? block.input.command.trim() : undefined;
          const file = block?.input?.file_path ?? block?.input?.path;
          const files: string[] = typeof file === "string" && file.trim() ? [file.trim()] : [];
          if (command) {
            // Bash-style: hold in pending until toolUseResult arrives on the user line.
            pending.set(block.id, { command, files, cwd, sessionId, gitBranch, ts });
          } else {
            // File-operation (Read/Write/Edit): emit immediately — no stdout to wait for.
            events.push({
              tool: "claude-code",
              sessionId, cwd, gitBranch, ts,
              role: "assistant",
              ...(files.length ? { files } : {}),
            });
          }
        }
      }
    } else if (type === "user") {
      // Join tool results back to their tool_use by id.
      const resultBlocks = Array.isArray(content)
        ? content.filter((b: any) => b?.type === "tool_result" && typeof b.tool_use_id === "string")
        : [];
      const tur = entry?.toolUseResult;
      for (const rb of resultBlocks) {
        const p = pending.get(rb.tool_use_id);
        if (!p) continue;
        pending.delete(rb.tool_use_id);
        events.push({
          tool: "claude-code",
          sessionId: p.sessionId || sessionId,
          cwd: p.cwd || cwd,
          gitBranch: p.gitBranch ?? gitBranch,
          ts: ts || p.ts,
          role: "user",
          ...(p.command ? { command: p.command } : {}),
          ...(p.files.length ? { files: p.files } : {}),
          ...(tur && typeof tur.stdout === "string" ? { stdout: tur.stdout } : {}),
          ...(tur && typeof tur.stderr === "string" ? { stderr: tur.stderr } : {}),
          ...(tur && typeof tur.exitCode === "number" ? { exitCode: tur.exitCode } : {}),
        });
      }
    }
    // all other types (system, mode, bridge-session, ai-title, …) are ignored
  }

  return events;
}
