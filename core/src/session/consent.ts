import { loadConsent } from "./consent-config";

/** Global AI-capture gate used by the watcher to decide whether to do ANY work.
 *  Per-tool / per-project / per-scope filtering happens per event in process.ts.
 *  LUMI_NO_CAPTURE is the always-winning kill switch. Default OFF. */
export function isAiCaptureEnabled(home: string): boolean {
  if (process.env.LUMI_NO_CAPTURE) return false;
  return loadConsent(home).enabled;
}
