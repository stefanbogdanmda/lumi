import { loadConsent } from "./session/consent-config";
import { detectActiveSessions } from "./session/ai-monitor";

/** One tool's roots for activity detection. */
export interface StatusSource {
  tool: string;
  roots: string[];
}

export interface CaptureStatus {
  recording: boolean;
  tool: string | null;
  project: string | null;
  scopes: { commands: boolean; output: boolean; aiText: boolean };
}

/** A session is "active" if its file mtime advanced within this window. */
const ACTIVE_WINDOW_MS = 90_000;

/**
 * Compute the recording indicator from the SAME consent the capture path reads,
 * plus mtime-based activity detection. recording=true only when consent is
 * enabled AND some source has a fresh session. Names the most-recently-active
 * tool/project. FS reads only; `now` is injectable for tests.
 */
export function captureStatus(
  home: string,
  sources: StatusSource[],
  now: () => number = () => Date.now(),
): CaptureStatus {
  const consent = loadConsent(home);
  const scopes = consent.scopes;
  if (!consent.enabled || process.env.LUMI_NO_CAPTURE) {
    return { recording: false, tool: null, project: null, scopes };
  }
  let best: { tool: string; project: string; mtimeMs: number } | null = null;
  for (const src of sources) {
    // A tool explicitly set to false in the consent is skipped (missing key = allowed).
    if (consent.tools[src.tool] === false) continue;
    for (const a of detectActiveSessions(src.roots, ACTIVE_WINDOW_MS, now, src.tool)) {
      if (!best || a.mtimeMs > best.mtimeMs) {
        best = { tool: a.tool, project: a.project, mtimeMs: a.mtimeMs };
      }
    }
  }
  return best
    ? { recording: true, tool: best.tool, project: best.project, scopes }
    : { recording: false, tool: null, project: null, scopes };
}
