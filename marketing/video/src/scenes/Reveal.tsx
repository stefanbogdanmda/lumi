import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT } from "../theme";
import { LumiSpark } from "../components/LumiSpark";
import { Wordmark } from "../components/Wordmark";
import { FadeUp } from "../components/ui";

// Scene 2 (6–11s): meet Lumi. A burst of light, the spark blooms, the wordmark
// resolves. Synced to the sparkle/riser at the 6s bar.
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opening flash decays quickly.
  const flash = interpolate(frame, [0, 4, 22], [0, 0.85, 0], {
    extrapolateRight: "clamp",
  });

  const sparkIn = spring({ frame, fps, config: { damping: 11, mass: 0.8 } });
  const sparkScale = 0.2 + sparkIn * 0.8;

  // Spark rises and shrinks slightly to make room for the wordmark.
  const settle = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sparkY = interpolate(settle, [0, 1], [0, -90]);
  const sparkSize = interpolate(settle, [0, 1], [260, 190]);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            transform: `translateY(${sparkY}px) scale(${sparkScale})`,
          }}
        >
          <LumiSpark size={sparkSize} pulse sparkles />
        </div>

        <div style={{ marginTop: -40, transform: `translateY(${(1 - settle) * 40}px)`, opacity: settle }}>
          <Wordmark size={150} withSpark={false} />
        </div>

        <FadeUp delay={66} y={26}>
          <div
            style={{
              marginTop: 18,
              fontSize: 40,
              fontWeight: 500,
              color: COLORS.inkSoft,
              textAlign: "center",
            }}
          >
            the mini-teacher inside your AI coding tool
          </div>
        </FadeUp>
      </AbsoluteFill>

      {/* opening flash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(255,235,200,${flash}) 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
