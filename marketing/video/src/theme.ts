import { Easing, useVideoConfig } from "remotion";

// Layout helper: scenes adapt between the 16:9 master and the 9:16 social cut.
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  return { width, height, portrait: height > width };
};

// Lumi brand design tokens for the promo video.
// Lumi = light / illumination. Warm amber "glow" accent on a deep indigo night,
// friendly and premium. The mascot is a small glowing "spark".

// ── Motion system ──────────────────────────────────────────────────────────
// Spring physics configs — import alongside `spring()` from remotion.
export const SPRING = {
  enter:  { damping: 16, mass: 0.9, stiffness: 130 },
  settle: { damping: 26, mass: 0.8, stiffness: 120 },
  pop:    { damping: 12, mass: 0.7, stiffness: 200 },
  glide:  { damping: 30, mass: 1.2, stiffness: 90  },
} as const;

// Cubic-bezier easing curves — use with interpolate({ easing: EASE.out }).
export const EASE = {
  out:     Easing.bezier(0.16, 1, 0.3, 1),
  inOut:   Easing.bezier(0.65, 0, 0.35, 1),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
};

// Glow tiers — two layers of radial-gradient box-shadow on lit elements.
// ambient: always-on subtle halo; event: bright flash on ignition beats.
export const GLOW = {
  /** Subtle always-on halo — use on anything glowing continuously. */
  ambient: (color: string) =>
    `0 0 24px ${color}55, 0 0 6px ${color}33`,
  /** Bright ignition flash — use on beats and accent-word snaps. */
  event: (color: string) =>
    `0 0 60px ${color}99, 0 0 24px ${color}66, 0 0 8px ${color}aa`,
};

export const FPS = 30;
export const DURATION = 900; // 30s

// Scene boundaries (frames) — all land on 2s musical bars in the soundtrack.
export const SCENES = {
  problem: { from: 0, durationInFrames: 180 },     // 0–6s
  reveal: { from: 180, durationInFrames: 150 },    // 6–11s
  howItWorks: { from: 330, durationInFrames: 300 },// 11–21s
  benefits: { from: 630, durationInFrames: 180 },  // 21–27s
  cta: { from: 810, durationInFrames: 90 },        // 27–30s
};

export const COLORS = {
  bg0: "#070A18",
  bg1: "#0C1130",
  bg2: "#141A44",
  ink: "#F4F6FF",
  inkSoft: "#AEB6DC",
  inkFaint: "#6B74A0",
  glow: "#FFC56B", // Lumi amber
  glowHot: "#FFB347",
  amberDeep: "#FF8A4C",
  teal: "#5EE7C9",
  lavender: "#A78BFA",
  blue: "#5BA8FF",
  danger: "#FF6B81",
  cardBg: "rgba(20, 26, 68, 0.72)",
  cardBorder: "rgba(255, 197, 107, 0.28)",
  panel: "rgba(10, 14, 38, 0.82)",
};

export const FONT =
  '"SF Pro Display", "Inter", -apple-system, "Segoe UI", system-ui, sans-serif';
export const MONO =
  '"SF Mono", "JetBrains Mono", "Fira Code", "Menlo", monospace';

// Lumi glow gradient used for accents and the spark.
export const GLOW_GRADIENT = `linear-gradient(135deg, ${COLORS.glow} 0%, ${COLORS.amberDeep} 60%, ${COLORS.lavender} 120%)`;
