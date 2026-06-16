// ── Beat / timing config (data-driven, tunable without touching components) ────
// The soundtrack (public/audio/soundtrack.wav) is 30s, 120 BPM, F major.
// 120 BPM @ 30fps → 15 frames / beat, 60 frames / 2s bar. Scene cuts and the
// big animation hits are pinned to the track's real musical events so the
// motion feels choreographed, not just laid over the music.
//
// Edit THESE numbers to re-sync; the scenes read everything from here.

export const FPS = 30;
export const TOTAL = 900; // exactly 30.000s
export const BEAT = 15; // frames per beat @120 BPM
export const BAR = 60; // frames per 2s bar

// Scene boundaries in frames (must tile [0, TOTAL] with no gaps/overlap).
export const SCENE = {
  hook: { from: 0, dur: 180 }, // 0–6s   build tension
  reveal: { from: 180, dur: 150 }, // 6–11s  the drop / brand reveal
  features: { from: 330, dur: 270 }, // 11–20s montage of hero features
  payoff: { from: 600, dur: 210 }, // 20–27s 4th feature + emotional line
  cta: { from: 810, dur: 90 }, // 27–30s logo + CTA, tail fade
} as const;

// Global frames where the track lands a transient (riser/impact/ignition).
// Sourced from scripts/make-soundtrack.mjs (ignition/riser/impact placements).
export const HIT = {
  reveal: 180, // 6s  — riser + impact + ignition(A5) + full hook (bell). THE drop.
  ig1: 330, // 11s — ignition F5
  ig2: 390, // 13s — ignition A5
  ig3: 450, // 15s — ignition C6
  ig4: 510, // 17s — ignition D6 (rising montage)
  lift: 600, // 20s — riser + impact → benefits lift
  fill: 720, // 24s — snare fill into the CTA
  cta: 810, // 27s — riser + impact + hook(+octave bell) resolving to F
} as const;

// Feature montage sub-beats, RELATIVE to SCENE.features.from (330).
// Three 3s beats, each cut pinned to an ignition.
export const FEATURE_BEATS = [
  { from: 0, dur: 90 }, // 11–14s — teaches you inline (ig1@0, ig2@60)
  { from: 90, dur: 90 }, // 14–17s — works in every AI tool (ig3@120 global)
  { from: 180, dur: 90 }, // 17–20s — remembers what you learn (ig4@180 global)
] as const;

// Payoff sub-beats, RELATIVE to SCENE.payoff.from (600).
export const PAYOFF_BEATS = [
  { from: 0, dur: 120 }, // 20–24s — tells you what to build next
  { from: 120, dur: 90 }, // 24–27s — the emotional one-liner into the CTA
] as const;

/**
 * Beat pulse: returns ~1 exactly on each beat and decays to 0 over `decay`
 * frames. Use to add a tiny synced "breath" (scale/glow) to held elements so
 * static moments still feel locked to the track.
 * `frame` is the GLOBAL frame; `offset` aligns the grid (0 = downbeat at f0).
 */
export function beatPulse(frame: number, period = BEAT, decay = 7, offset = 0): number {
  const since = (frame - offset) % period;
  const s = since < 0 ? since + period : since;
  return Math.max(0, 1 - s / decay);
}

/** True on the exact frame a beat lands (for one-frame flashes). */
export function isOnBeat(frame: number, period = BEAT, offset = 0): boolean {
  return (frame - offset) % period === 0;
}

/**
 * Hit envelope: 1 at the hit frame, decaying over `decay` frames, 0 before.
 * Drives ignition flashes/blooms pinned to a global HIT frame.
 */
export function hitEnv(frame: number, hit: number, decay = 18): number {
  if (frame < hit) return 0;
  return Math.max(0, 1 - (frame - hit) / decay);
}
