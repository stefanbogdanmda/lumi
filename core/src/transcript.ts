import { readFileSync } from "node:fs";
import { OutputSignals } from "./types";

type Reader = (path: string) => string;

/** Concatenate text blocks from one transcript entry's assistant message. */
function assistantText(entry: any): string {
  const content = entry?.message?.content ?? entry?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * Given a Claude Code Stop-hook JSON line (which carries `transcript_path`),
 * read the transcript and return the text of the LATEST assistant message.
 * Returns "" on any problem (bad JSON, missing path, unreadable file).
 */
export function extractLatestAssistantText(
  hookLine: string,
  read: Reader = (p) => readFileSync(p, "utf8"),
): string {
  let payload: any;
  try { payload = JSON.parse(hookLine); } catch { return ""; }
  const path = payload?.transcript_path;
  if (typeof path !== "string" || !path) return "";
  let raw: string;
  try { raw = read(path); } catch { return ""; }

  let latest = "";
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }
    const role = entry?.message?.role ?? entry?.role ?? entry?.type;
    if (role !== "assistant") continue;
    const text = assistantText(entry);
    // Keep the LAST assistant entry that has prose; a final tool-only entry is skipped on purpose.
    if (text) latest = text;
  }
  return latest;
}

/** Pull text + the commands/files from the latest assistant turn's tool calls. */
export function extractSignals(
  hookLine: string,
  read: Reader = (p) => readFileSync(p, "utf8"),
): OutputSignals {
  let payload: any;
  try { payload = JSON.parse(hookLine); } catch { return { text: "" }; }
  const path = payload?.transcript_path;
  if (typeof path !== "string" || !path) return { text: "" };
  let raw: string;
  try { raw = read(path); } catch { return { text: "" }; }

  let text = "";
  const commands: string[] = [];
  const files: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }
    const role = entry?.message?.role ?? entry?.role ?? entry?.type;
    if (role === "assistant") {
      const t = assistantText(entry);
      if (t) text = t; // keep the latest assistant prose
    }
    const content = entry?.message?.content ?? entry?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type !== "tool_use") continue;
        const cmd = block?.input?.command;
        if (typeof cmd === "string" && cmd.trim()) commands.push(cmd.trim());
        const file = block?.input?.file_path ?? block?.input?.path;
        if (typeof file === "string" && file.trim()) files.push(file.trim());
      }
    }
  }
  return { text, commands, files };
}
