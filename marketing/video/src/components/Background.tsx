import React from "react";
import { useCurrentFrame, AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

// Deep espresso night with slow-drifting glow blobs, subtle grid, animated
// film grain (~3–4% feTurbulence), and a warm top vignette rim.
// `intensity` lifts the warmth for brighter scenes (reveal / CTA).
export const Background: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const frame = useCurrentFrame();
  const drift = (s: number, a: number, base: number) =>
    base + Math.sin((frame / 30) * s) * a;

  // Animated grain: shift the turbulence seed every frame for live noise.
  const grainSeed = frame % 128;
  const grainId = `grain-${grainSeed}`;

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 120% at 50% -10%, ${COLORS.bg2} 0%, ${COLORS.bg1} 45%, ${COLORS.bg0} 100%)`,
        }}
      />

      {/* Warm amber glow blob */}
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

      {/* Warm gold blob */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(34% 40% at ${drift(0.15, 7, 76)}% ${drift(
            0.19,
            7,
            68
          )}%, rgba(201,162,75,${0.18 * intensity}) 0%, transparent 60%)`,
          filter: "blur(8px)",
        }}
      />

      {/* Teal accent */}
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

      {/* Faint grid */}
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

      {/* Animated film grain — ~3–4% via feTurbulence SVG filter */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.038 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.72"
                numOctaves="4"
                seed={grainSeed}
                stitchTiles="stitch"
                result="noise"
              />
              <feColorMatrix
                type="saturate"
                values="0"
                in="noise"
                result="grey"
              />
              <feBlend in="SourceGraphic" in2="grey" mode="overlay" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter={`url(#${grainId})`} />
        </svg>
      </AbsoluteFill>

      {/* Warm top vignette rim — warm amber at top edge */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(255,179,71,${0.07 * intensity}) 0%, transparent 22%)`,
          pointerEvents: "none",
        }}
      />

      {/* Edge vignette (dark edges) */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 320px 80px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
