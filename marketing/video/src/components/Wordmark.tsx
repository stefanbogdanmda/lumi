import React from "react";
import { COLORS, FONT } from "../theme";

// Bright across the whole word so the thin "i" stays readable on dark.
const WORDMARK_GRADIENT = `linear-gradient(120deg, #FFE7B0 0%, ${COLORS.glow} 40%, ${COLORS.glowHot} 80%, #FFD98A 110%)`;
import { LumiSpark } from "./LumiSpark";

// The "Lumi" wordmark with the glowing-dot on the i replaced by the spark.
export const Wordmark: React.FC<{ size?: number; withSpark?: boolean }> = ({
  size = 120,
  withSpark = true,
}) => {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          background: WORDMARK_GRADIENT,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "0 0 40px rgba(255,179,71,0.25)",
          lineHeight: 1,
        }}
      >
        Lumi
      </div>
      {withSpark && (
        <div
          style={{
            position: "absolute",
            top: -size * 0.34,
            right: size * 0.01,
            transform: "translateX(20%)",
          }}
        >
          <LumiSpark size={size * 0.26} pulse sparkles={false} />
        </div>
      )}
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  color?: string;
  filled?: boolean;
}> = ({ children, color = COLORS.glow, filled = false }) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: 26,
      fontWeight: 600,
      padding: "12px 26px",
      borderRadius: 999,
      color: filled ? "#1A1206" : color,
      background: filled ? color : "rgba(255,255,255,0.04)",
      border: `1.5px solid ${color}`,
      boxShadow: filled ? `0 0 30px ${color}66` : "none",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);
