import React from "react";
import { useCurrentFrame, AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

// Deep indigo night with slow-drifting glow blobs, a subtle grid, grain and a
// vignette. Code-rendered, no assets. `intensity` lifts the warmth for brighter
// scenes (reveal / CTA).
export const Background: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const drift = (s: number, a: number, base: number) =>
    base + Math.sin((frame / 30) * s) * a;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 120% at 50% -10%, ${COLORS.bg2} 0%, ${COLORS.bg1} 45%, ${COLORS.bg0} 100%)`,
        }}
      />
      {/* warm glow blob */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(38% 42% at ${drift(0.21, 8, 28)}% ${drift(
            0.17,
            6,
            32
          )}%, rgba(255,179,71,${0.22 * intensity}) 0%, transparent 60%)`,
          filter: "blur(8px)",
        }}
      />
      {/* lavender blob */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(34% 40% at ${drift(0.15, 7, 76)}% ${drift(
            0.19,
            7,
            68
          )}%, rgba(167,139,250,${0.18 * intensity}) 0%, transparent 60%)`,
          filter: "blur(8px)",
        }}
      />
      {/* teal accent */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(28% 32% at ${drift(0.13, 6, 82)}% ${drift(
            0.11,
            5,
            22
          )}%, rgba(94,231,201,${0.1 * intensity}) 0%, transparent 60%)`,
          filter: "blur(10px)",
        }}
      />
      {/* faint grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(120% 100% at 50% 40%, black 35%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(120% 100% at 50% 40%, black 35%, transparent 80%)",
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 320px 80px rgba(0,0,0,0.55)",
        }}
      />
    </AbsoluteFill>
  );
};
