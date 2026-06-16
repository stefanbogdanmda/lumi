import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, FONT, GLOW, useLayout } from "../theme";
import { KineticHeadline, StaggerGroup, StaggerItem, Camera } from "../components/ui";
import { SparkStar } from "../components/LumiSpark";

// The 3 kinetic lines per the brief — no cards, no emoji.
const LINES = [
  { text: "Learn as you build.", accent: "build.", color: COLORS.glow },
  { text: "Taught once. Yours forever.", accent: "forever.", color: COLORS.teal },
  { text: "Build with confidence.", accent: "confidence.", color: COLORS.lavender },
];

// Scene 4 (21–27s, local 0–179): 3 kinetic lines punch in on the beat.
// StaggerGroup staggers each KineticHeadline by 22 frames (matches ~0.7s bar).
// A small SparkStar accent drifts in the upper corner — no emoji.
export const Benefits: React.FC = () => {
  const { portrait } = useLayout();
  const fontSize = portrait ? 62 : 74;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Camera push={[1, 1.03]} drift={4}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: portrait ? 36 : 44,
          }}
        >
          {/* SparkStar accent — top right, no emoji */}
          <div
            style={{
              position: "absolute",
              top: portrait ? 80 : 60,
              right: portrait ? 80 : 120,
              opacity: 0.85,
            }}
          >
            <SparkStar size={portrait ? 36 : 44} color={COLORS.glow} />
          </div>

          {/* Three kinetic lines on the beat */}
          <StaggerGroup each={22} delay={4} spring={{ damping: 14, mass: 0.85, stiffness: 140 }}>
            {LINES.map((line, i) => (
              <StaggerItem key={line.text} index={i} y={50} style={{ textAlign: "center", marginBottom: portrait ? 20 : 24 }}>
                <KineticHeadline
                  text={line.text}
                  accentWord={line.accent}
                  accentColor={line.color}
                  stagger={4}
                  delay={0}
                  style={{
                    fontSize,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    justifyContent: "center",
                    textShadow: undefined,
                  }}
                />
                {/* Underline accent bar beneath each line */}
                <div
                  style={{
                    height: 3,
                    width: "60%",
                    margin: "10px auto 0",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, transparent, ${line.color}88, transparent)`,
                    boxShadow: `0 0 16px ${line.color}55`,
                  }}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
