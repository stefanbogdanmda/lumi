import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal Phase-1 consent gate. The full per-tool/per-project/per-scope model
 *  and its UI land in Phase 2; here we only gate AI-session capture as a whole,
 *  default OFF, with the global LUMI_NO_CAPTURE kill switch always winning. */
export function isAiCaptureEnabled(home: string): boolean {
  if (process.env.LUMI_NO_CAPTURE) return false;
  try {
    const raw = readFileSync(join(home, "consent.json"), "utf8");
    const c = JSON.parse(raw);
    return c?.aiSessions === true;
  } catch {
    return false; // no file / unreadable / malformed → not consented
  }
}
