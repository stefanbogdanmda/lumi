import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT, useLayout } from "../theme";
import { Terminal, Line } from "../components/Terminal";
import { FadeUp, Pop } from "../components/ui";

const LINES: Line[] = [
  { text: "build me a login page with a saved database", kind: "prompt" },
  { text: "Done! I added a migration and an environment variable for the secret.", kind: "claude" },
  { text: "export DATABASE_URL=postgres://…", kind: "code", highlight: "DATABASE_URL" },
  { text: "$ npx prisma migrate dev", kind: "code", highlight: "migrate" },
  { text: "// guards the race condition on submit", kind: "comment", highlight: "race condition" },
];

const TERMS = ["environment variable", "migration", "race condition"];

// Scene 1 (0–6s): you ship AI code full of words you've never seen.
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { portrait, width } = useLayout();
  const visible = Math.max(0, Math.min(LINES.length, Math.floor((frame - 26) / 16) + 1));

  const termScale = portrait ? Math.min(1, (width - 80) / 1020) : 1;

  const Chip: React.FC<{ word: string; i: number }> = ({ word, i }) => {
    const d = 70 + i * 16;
    const p = interpolate(frame, [d, d + 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const float = Math.sin((frame - d) / 14) * 6;
    return (
      <div
        style={{
          transform: `translateY(${float - (1 - p) * 20}px)`,
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
          {word}
        </span>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* Headline */}
      <div style={{ position: "absolute", top: portrait ? 150 : 96, width: "100%", textAlign: "center" }}>
        <FadeUp delay={6}>
          <div style={{ fontSize: portrait ? 64 : 56, fontWeight: 800, color: COLORS.ink }}>
            Building with AI is easy.
          </div>
        </FadeUp>
        <FadeUp delay={40}>
          <div style={{ fontSize: portrait ? 64 : 56, fontWeight: 800, marginTop: 6, color: COLORS.danger }}>
            Understanding it isn&apos;t.
          </div>
        </FadeUp>
      </div>

      {portrait ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 60 }}>
          <Pop delay={14} from={0.85}>
            <div style={{ transform: `scale(${termScale})` }}>
              <Terminal lines={LINES} visibleLines={visible} width={1020} />
            </div>
          </Pop>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {TERMS.map((w, i) => (
              <Chip key={w} word={w} i={i} />
            ))}
          </div>
        </AbsoluteFill>
      ) : (
        <>
          <div style={{ position: "absolute", left: 150, top: 300 }}>
            <Pop delay={14} from={0.85}>
              <Terminal lines={LINES} visibleLines={visible} width={1020} />
            </Pop>
          </div>
          <div style={{ position: "absolute", left: 1430, top: 300, display: "flex", flexDirection: "column", gap: 56 }}>
            {TERMS.map((w, i) => (
              <Chip key={w} word={w} i={i} />
            ))}
          </div>
        </>
      )}

      {/* Bottom line */}
      <div style={{ position: "absolute", bottom: portrait ? 150 : 70, width: "100%", textAlign: "center" }}>
        <FadeUp delay={120}>
          <div style={{ fontSize: 30, color: COLORS.inkSoft, fontWeight: 500, padding: "0 40px" }}>
            <span style={{ color: COLORS.glow, fontWeight: 700 }}>59%</span> of people ship
            AI-generated code they don&apos;t fully understand.
          </div>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};
