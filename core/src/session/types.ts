/** A single normalized event from any AI coding tool's on-disk session. */
export interface SessionEvent {
  tool: "claude-code" | "codex" | "lumi-terminal";
  sessionId: string;
  cwd: string;
  gitBranch?: string;
  ts: string;                 // ISO-8601
  role: "assistant" | "user" | "system";
  text?: string;              // assistant prose
  command?: string;           // shell command the tool ran
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  files?: string[];           // files the tool read/wrote
}
