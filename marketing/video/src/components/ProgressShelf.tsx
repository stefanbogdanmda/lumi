import React from "react";
import { interpolate } from "remotion";
import { COLORS, FONT } from "../theme";

// A "trophy shelf" of concepts the learner has mastered. Badges pop in one by
// one as `revealed` grows. Lumi remembers — so each is taught only once.
export const ProgressShelf: React.FC<{
  concepts: { label: string; icon: string }[];
  revealed: number; // float; fractional value animates the next badge popping in
  width?: number;
}> = ({ concepts, revealed, width = 1100 }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 22,
        padding: "30px 34px",
        background: COLORS.panel,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.ink }}>
          Your progress
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.glow,
            background: "rgba(255,197,107,0.1)",
            border: `1px solid ${COLORS.cardBorder}`,
            borderRadius: 999,
            padding: "6px 18px",
          }}
        >
          {Math.min(Math.floor(revealed), concepts.length)} learned
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {concepts.map((c, i) => {
          const local = interpolate(revealed - i, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 22px",
                borderRadius: 14,
                background:
                  "linear-gradient(150deg, rgba(94,231,201,0.12), rgba(255,197,107,0.08))",
                border: `1.5px solid ${COLORS.teal}55`,
                boxShadow: local > 0.5 ? `0 0 24px ${COLORS.teal}33` : "none",
                opacity: local,
                transform: `scale(${0.6 + local * 0.4}) translateY(${
                  (1 - local) * 20
                }px)`,
              }}
            >
              <span style={{ fontSize: 30 }}>{c.icon}</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: COLORS.ink }}>
                {c.label}
              </span>
              <span style={{ fontSize: 22, color: COLORS.teal }}>✓</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
