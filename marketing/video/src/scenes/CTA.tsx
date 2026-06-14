import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT, MONO } from "../theme";
import { Wordmark } from "../components/Wordmark";
import { LumiSpark } from "../components/LumiSpark";
import { FadeUp } from "../components/ui";
import { SparkStar } from "../components/LumiSpark";

// Scene 5 (27–30s): the lockup + tagline + how to get it. A sparkle lands on
// the bar at 27s.
export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flash = interpolate(frame, [0, 3, 18], [0, 0.6, 0], { extrapolateRight: "clamp" });
  const lock = spring({ frame, fps, config: { damping: 13, mass: 0.8 } });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ transform: `scale(${0.7 + lock * 0.3})`, opacity: lock, marginBottom: 6 }}>
          <LumiSpark size={150} pulse sparkles />
        </div>
        <div style={{ transform: `scale(${0.85 + lock * 0.15})`, opacity: lock }}>
          <Wordmark size={150} withSpark={false} />
        </div>

        <FadeUp delay={16} y={24}>
          <div style={{ fontSize: 46, fontWeight: 700, color: COLORS.glow, marginTop: 10 }}>
            Understand what you ship.
          </div>
        </FadeUp>

        <FadeUp delay={30} y={20}>
          <div style={{ fontSize: 27, color: COLORS.inkSoft, marginTop: 22 }}>
            Inline plugin · VS&nbsp;Code panel · runs on your Claude subscription
          </div>
        </FadeUp>

        <FadeUp delay={42} y={18}>
          <div
            style={{
              marginTop: 24,
              fontFamily: MONO,
              fontSize: 28,
              color: COLORS.ink,
              padding: "14px 28px",
              borderRadius: 12,
              background: "rgba(8,11,28,0.85)",
              border: `1.5px solid ${COLORS.cardBorder}`,
              boxShadow: `0 0 40px rgba(255,179,71,0.15)`,
            }}
          >
            <span style={{ color: COLORS.glow }}>/plugin install</span> lumi
          </div>
        </FadeUp>
      </AbsoluteFill>

      {/* corner sparkles */}
      <div style={{ position: "absolute", left: 360, top: 300 }}>
        <SparkStar size={34} color={COLORS.teal} />
      </div>
      <div style={{ position: "absolute", right: 380, top: 760 }}>
        <SparkStar size={26} color={COLORS.lavender} delay={8} />
      </div>
      <div style={{ position: "absolute", right: 420, top: 280 }}>
        <SparkStar size={22} color={COLORS.glow} delay={14} />
      </div>

      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(255,235,200,${flash}) 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
