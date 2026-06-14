import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, FONT } from "../theme";
import { FadeUp } from "../components/ui";
import { LumiSpark } from "../components/LumiSpark";

const BENEFITS = [
  {
    icon: "🌊",
    title: "Learn in the flow",
    body: "No tab-switching, no Googling — the right lesson comes to you.",
    color: COLORS.blue,
  },
  {
    icon: "🧠",
    title: "Taught once, remembered forever",
    body: "A personal glossary that grows with you across every session.",
    color: COLORS.lavender,
  },
  {
    icon: "🛡️",
    title: "Understand what you ship",
    body: "Fewer blind spots, less unreviewed AI code, real confidence.",
    color: COLORS.teal,
  },
];

// Scene 4 (21–27s): why you need Lumi.
export const Benefits: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", top: 92, width: "100%", textAlign: "center" }}>
        <FadeUp delay={2}>
          <div style={{ fontSize: 54, fontWeight: 800, color: COLORS.ink }}>
            Why you need <span style={{ color: COLORS.glow }}>Lumi</span>
          </div>
        </FadeUp>
      </div>

      {/* Spark accent */}
      <div style={{ position: "absolute", right: 150, top: 250, opacity: 0.85 }}>
        <FadeUp delay={10}>
          <LumiSpark size={150} pulse sparkles />
        </FadeUp>
      </div>

      <div
        style={{
          position: "absolute",
          left: 180,
          top: 270,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        {BENEFITS.map((b, i) => (
          <FadeUp key={b.title} delay={18 + i * 22} y={50}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                width: 1120,
                padding: "26px 34px",
                borderRadius: 20,
                background:
                  "linear-gradient(120deg, rgba(20,26,68,0.78), rgba(12,16,42,0.78))",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  background: `${b.color}1f`,
                  border: `1.5px solid ${b.color}66`,
                  boxShadow: `0 0 30px ${b.color}33`,
                  flexShrink: 0,
                }}
              >
                {b.icon}
              </div>
              <div>
                <div style={{ fontSize: 38, fontWeight: 800, color: COLORS.ink }}>
                  {b.title}
                </div>
                <div style={{ fontSize: 27, color: COLORS.inkSoft, marginTop: 4 }}>
                  {b.body}
                </div>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </AbsoluteFill>
  );
};
