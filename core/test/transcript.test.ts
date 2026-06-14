import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractLatestAssistantText } from "../src/transcript";

function withTranscript(lines: object[]): { hookLine: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "lumi-tx-"));
  const file = join(dir, "transcript.jsonl");
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  return { hookLine: JSON.stringify({ hook_event_name: "Stop", transcript_path: file }), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("extractLatestAssistantText", () => {
  it("returns the last assistant message's text", () => {
    const { hookLine, cleanup } = withTranscript([
      { type: "user", message: { role: "user", content: "hi" } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "First answer about git commit" }] } },
      { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Latest answer about npm install" }] } },
    ]);
    try { expect(extractLatestAssistantText(hookLine)).toBe("Latest answer about npm install"); }
    finally { cleanup(); }
  });

  it("handles string content", () => {
    const { hookLine, cleanup } = withTranscript([
      { role: "assistant", content: "plain string reply" },
    ]);
    try { expect(extractLatestAssistantText(hookLine)).toBe("plain string reply"); }
    finally { cleanup(); }
  });

  it("returns empty string for a bad hook line or missing path", () => {
    expect(extractLatestAssistantText("not json")).toBe("");
    expect(extractLatestAssistantText(JSON.stringify({ hook_event_name: "Stop" }))).toBe("");
  });
});
