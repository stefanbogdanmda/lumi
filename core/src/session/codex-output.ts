/** Parsed Codex `function_call_output.output` string. */
export interface CodexExecResult {
  exitCode?: number;
  stdout: string;
}

/**
 * Codex serializes shell results as:
 *   "Exit code: <n>\nWall time: <t> seconds\nOutput:\n---\n<body>"
 * Extract the exit code and the body. If the markers are absent, treat the whole
 * string as stdout with no exit code. CRLF tolerated.
 */
export function parseCodexExecOutput(output: string): CodexExecResult {
  if (typeof output !== "string") return { stdout: "" };
  const exitMatch = output.match(/^Exit code:\s*(-?\d+)/m);
  const exitCode = exitMatch ? Number(exitMatch[1]) : undefined;
  const sep = output.indexOf("Output:");
  if (sep === -1) return { stdout: output, ...(exitCode !== undefined ? { exitCode } : {}) };
  // Body starts after the "---" fence following "Output:".
  const afterOutput = output.slice(sep);
  const fence = afterOutput.indexOf("---");
  const body = fence === -1 ? "" : afterOutput.slice(fence + 3).replace(/^\r?\n/, "");
  return { stdout: body, ...(exitCode !== undefined ? { exitCode } : {}) };
}
