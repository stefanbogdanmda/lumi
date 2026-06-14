import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

// Lumi's mascot: a warm glowing orb with a soft breathing halo and orbiting
// sparkle particles. Fully code-rendered (radial gradients + transforms).
export const LumiSpark: React.FC<{
  size?: number;
  pulse?: boolean;
  sparkles?: boolean;
}> = ({ size = 200, pulse = true, sparkles = true }) => {
  const frame = useCurrentFrame();
  const breathe = pulse ? 1 + Math.sin(frame / 12) * 0.05 : 1;
  const haloBreathe = pulse ? 1 + Math.sin(frame / 12) * 0.12 : 1;

  const particles = [0, 1, 2, 3, 4, 5];

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* outer halo */}
      <div
        style={{
          position: "absolute",
          width: size * 1.9 * haloBreathe,
          height: size * 1.9 * haloBreathe,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,197,107,0.32) 0%, rgba(255,138,76,0.12) 38%, transparent 70%)`,
          filter: "blur(6px)",
        }}
      />
      {/* core orb */}
      <div
        style={{
          position: "absolute",
          width: size * breathe,
          height: size * breathe,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 32%, #FFF6E6 0%, ${COLORS.glow} 32%, ${COLORS.amberDeep} 72%, #C85C2A 100%)`,
          boxShadow: `0 0 ${size * 0.5}px rgba(255,179,71,0.65), inset 0 0 ${
            size * 0.3
          }px rgba(255,255,255,0.35)`,
        }}
      />
      {/* inner highlight */}
      <div
        style={{
          position: "absolute",
          width: size * 0.34,
          height: size * 0.34,
          left: size * 0.24,
          top: size * 0.2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* orbiting sparkles */}
      {sparkles &&
        particles.map((p) => {
          const a = (frame / 30) * (0.6 + p * 0.12) + (p * Math.PI * 2) / particles.length;
          const radius = size * (0.85 + (p % 3) * 0.12);
          const x = Math.cos(a) * radius;
          const y = Math.sin(a) * radius * 0.7;
          const tw = (Math.sin(frame / 6 + p) + 1) / 2;
          const s = 4 + (p % 3) * 3;
          return (
            <div
              key={p}
              style={{
                position: "absolute",
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                width: s,
                height: s,
                borderRadius: "50%",
                background: p % 2 ? COLORS.teal : COLORS.glow,
                boxShadow: `0 0 ${8 + tw * 10}px ${
                  p % 2 ? COLORS.teal : COLORS.glow
                }`,
                opacity: 0.5 + tw * 0.5,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
    </div>
  );
};

// A tiny 4-point sparkle star, useful as a "magic" accent (Lumi's 🪄).
export const SparkStar: React.FC<{ size?: number; color?: string; delay?: number }> = ({
  size = 28,
  color = COLORS.glow,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const tw = (Math.sin((frame - delay) / 7) + 1) / 2;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: "visible" }}>
      <path
        d="M0,-46 C6,-12 12,-6 46,0 C12,6 6,12 0,46 C-6,12 -12,6 -46,0 C-12,-6 -6,-12 0,-46 Z"
        fill={color}
        style={{
          filter: `drop-shadow(0 0 ${6 + tw * 8}px ${color})`,
          opacity: 0.7 + tw * 0.3,
          transformOrigin: "center",
          transform: `scale(${0.85 + tw * 0.2})`,
        }}
      />
    </svg>
  );
};
