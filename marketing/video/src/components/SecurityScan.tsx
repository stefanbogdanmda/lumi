import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT, MONO, GLOW, EASE, SPRING, cardSurface } from "../theme";

/**
 * Security lens beat: a leaked-secret line, a shield "scan" sweep across it,
 * a plain-English risk flag, and an A–F grade that settles from C to A.
 * `from` is the LOCAL frame the beat starts (default 0). Self-contained.
 */
export const SecurityScan: React.FC<{ width?: number; from?: number }> = ({
  width = 820,
  from = 0,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();

  const cardS = spring({ frame, fps, config: SPRING.enter });
  // scan sweep 0→1 across frames 10..40
  const sweep = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });
  // flag appears after the sweep
  const flag = interpolate(frame, [42, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // grade lifts C(0)→A(1) late in the beat
  const fix = interpolate(frame, [64, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const grade = fix < 0.5 ? "C" : fix < 0.9 ? "B" : "A";
  const gradeColor = fix < 0.5 ? COLORS.danger : fix < 0.9 ? COLORS.glowHot : COLORS.teal;

  return (
    <div
      style={{
        width,
        transform: `translateY(${(1 - cardS) * 30}px) scale(${0.96 + cardS * 0.04})`,
        opacity: cardS,
        borderRadius: 22,
        padding: "30px 34px",
        background: cardSurface(),
        border: `1.5px solid ${COLORS.cardBorder}`,
        boxShadow: "0 30px 90px rgba(0,0,0,0.5), 0 0 60px rgba(255,194,75,0.10)",
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* code line with the leaked secret */}
      <div
        style={{
          position: "relative",
          fontFamily: MONO,
          fontSize: 28,
          color: COLORS.danger,
          background: "rgba(42,18,12,0.9)",
          border: "1px solid rgba(255,107,87,0.3)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 22,
          overflow: "hidden",
        }}
      >
        apiKey = "sk-live-9f2a7c…"
        {/* scan sweep bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep * 100}%`,
            width: 90,
            transform: "translateX(-50%)",
            background: `linear-gradient(90deg, transparent, ${COLORS.glow}88, transparent)`,
            opacity: sweep > 0 && sweep < 1 ? 1 : 0,
          }}
        />
      </div>

      {/* flag row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: flag, transform: `translateY(${(1 - flag) * 10}px)` }}>
        <span style={{ fontSize: 34 }}>🛡️</span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.danger,
            background: "rgba(255,107,87,0.14)",
            border: "1px solid rgba(255,107,87,0.3)",
            borderRadius: 999,
            padding: "8px 18px",
          }}
        >
          Secret exposed in frontend code
        </span>
        <span style={{ marginLeft: "auto", fontSize: 22, color: COLORS.inkFaint }}>safety grade</span>
        <span style={{ fontSize: 56, fontWeight: 800, color: gradeColor, textShadow: GLOW.ambient(gradeColor), minWidth: 56, textAlign: "center" }}>
          {grade}
        </span>
      </div>

      <div style={{ marginTop: 16, fontSize: 22, color: COLORS.inkSoft, opacity: flag }}>
        Move it to an environment variable — out of the browser, off the repo.
      </div>
    </div>
  );
};
