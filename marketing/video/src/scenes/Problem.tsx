import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT } from "../theme";
import { Terminal, Line } from "../components/Terminal";
import { FadeUp, Pop } from "../components/ui";

const LINES: Line[] = [
  { text: "build me a login page with a saved database", kind: "prompt" },
  { text: "Done! I added a migration and an environment variable for the secret.", kind: "claude" },
  { text: "export DATABASE_URL=postgres://…", kind: "code", highlight: "DATABASE_URL" },
  { text: "$ npx prisma migrate dev", kind: "code", highlight: "migrate" },
  { text: "// guards the race condition on submit", kind: "comment", highlight: "race condition" },
];

// Scene 1 (0–6s): you ship AI code full of words you've never seen.
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const visible = Math.max(
    0,
    Math.min(LINES.length, Math.floor((frame - 26) / 16) + 1)
  );

  // The three highlighted terms drift up as floating "unknowns".
  const terms = [
    { word: "environment variable", x: 1480, y: 300, d: 70 },
    { word: "migration", x: 1520, y: 470, d: 86 },
    { word: "race condition", x: 1440, y: 640, d: 102 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* Headline */}
      <div style={{ position: "absolute", top: 96, width: "100%", textAlign: "center" }}>
        <FadeUp delay={6}>
          <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.ink }}>
            Building with AI is easy.
          </div>
        </FadeUp>
        <FadeUp delay={40}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              marginTop: 6,
              color: COLORS.danger,
            }}
          >
            Understanding it isn&apos;t.
          </div>
        </FadeUp>
      </div>

      {/* Terminal */}
      <div style={{ position: "absolute", left: 150, top: 300 }}>
        <Pop delay={14} from={0.85}>
          <Terminal lines={LINES} visibleLines={visible} width={1020} />
        </Pop>
      </div>

      {/* Floating unknown terms */}
      {terms.map((t, i) => {
        const p = interpolate(frame, [t.d, t.d + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const float = Math.sin((frame - t.d) / 14) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y + float - (1 - p) * 20,
              opacity: p,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 30 }}>❓</span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: COLORS.danger,
                padding: "8px 18px",
                borderRadius: 12,
                background: "rgba(255,107,129,0.1)",
                border: `1.5px solid ${COLORS.danger}66`,
              }}
            >
              {t.word}
            </span>
          </div>
        );
      })}

      {/* Bottom line */}
      <div style={{ position: "absolute", bottom: 70, width: "100%", textAlign: "center" }}>
        <FadeUp delay={120}>
          <div style={{ fontSize: 30, color: COLORS.inkSoft, fontWeight: 500 }}>
            <span style={{ color: COLORS.glow, fontWeight: 700 }}>59%</span> of people
            ship AI-generated code they don&apos;t fully understand.
          </div>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
