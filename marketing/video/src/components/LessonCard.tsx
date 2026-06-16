import React from "react";
import { COLORS, FONT } from "../theme";
import { SparkStar } from "./LumiSpark";

// The signature Lumi lesson card: spark icon + "Lumi — quick lesson", concept
// title, plain-English explanation, "why it matters". No emoji.
// `progress` (0–1) reveals content with a typed feel; `learned` shows the
// confirmed state.
export const LessonCard: React.FC<{
  concept: string;
  explanation: string;
  why: string;
  reveal?: number; // 0..1 how much of the body is shown
  learned?: boolean;
  width?: number;
  scale?: number;
}> = ({ concept, explanation, why, reveal = 1, learned = false, width = 720, scale = 1 }) => {
  const clip = (s: string) => s.slice(0, Math.ceil(s.length * reveal));
  return (
    <div
      style={{
        width,
        transform: `scale(${scale})`,
        transformOrigin: "center",
        borderRadius: 22,
        padding: "30px 34px",
        background:
          "linear-gradient(160deg, rgba(28,34,78,0.92) 0%, rgba(16,20,48,0.92) 100%)",
        border: `1.5px solid ${COLORS.cardBorder}`,
        boxShadow:
          "0 30px 90px rgba(0,0,0,0.5), 0 0 60px rgba(255,179,71,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* top glow strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${COLORS.glow}, ${COLORS.amberDeep}, ${COLORS.lavender})`,
        }}
      />
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        {/* spark glyph instead of emoji */}
        <SparkStar size={24} color={COLORS.glow} />
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.glow,
            letterSpacing: "0.01em",
          }}
        >
          Lumi
        </span>
        <span style={{ fontSize: 22, color: COLORS.inkFaint, fontWeight: 500 }}>
          — quick lesson
        </span>
      </div>

      <div style={{ fontSize: 34, fontWeight: 800, color: COLORS.ink, marginBottom: 14 }}>
        {concept}
      </div>

      <div style={{ fontSize: 25, lineHeight: 1.55, color: COLORS.inkSoft, minHeight: 84 }}>
        {clip(explanation)}
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 23,
          lineHeight: 1.5,
          color: COLORS.teal,
        }}
      >
        <span style={{ fontStyle: "italic", color: COLORS.inkFaint }}>Why it matters: </span>
        {clip(why)}
      </div>

      {/* footer button — no emoji */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            padding: "12px 24px",
            borderRadius: 12,
            color: learned ? "#0C2A14" : COLORS.glow,
            background: learned ? COLORS.teal : "rgba(255,197,107,0.12)",
            border: `1.5px solid ${learned ? COLORS.teal : COLORS.cardBorder}`,
            boxShadow: learned ? `0 0 26px ${COLORS.teal}66` : "none",
          }}
        >
          {learned ? "Learned" : "Got it"}
        </div>
        <div style={{ fontSize: 20, color: COLORS.inkFaint }}>Still fuzzy?</div>
      </div>
    </div>
  );
};
