import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, SPRING, GLOW } from "../theme";
import { LumiSpark } from "../components/LumiSpark";
import { Wordmark } from "../components/Wordmark";
import { ClipReveal, Bloom, FadeUp } from "../components/ui";

// Scene 2 (6–11s, local 0–149): spark blooms into Lumi mark + wordmark.
// Opening flash from transition, spark scales up with Bloom, Wordmark wipes
// in via ClipReveal, then tagline fades up.
// Copy: "Meet Lumi." / "Your mini-teacher — right inside the AI."
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Opening flash decays quickly (from incoming light-bloom fade transition).
  const flash = interpolate(frame, [0, 4, 24], [0, 0.9, 0], {
    extrapolateRight: "clamp",
  });

  // Spark blooms in on spring.
  const sparkIn = spring({ frame, fps, config: SPRING.pop });
  const sparkScale = 0.1 + sparkIn * 0.9;

  // After f 20 spark settles into position, then rises slightly.
  const settle = interpolate(frame, [28, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sparkY = interpolate(settle, [0, 1], [0, -100]);
  const sparkSize = interpolate(settle, [0, 1], [280, 200]);

  // Bloom progress behind spark
  const bloomProgress = interpolate(frame, [4, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Meet Lumi." — types on / kinetic reveal at f 18
  const meetIn = interpolate(frame, [18, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Wordmark wipe: ClipReveal progress f 32 → 60
  const wordmarkReveal = interpolate(frame, [32, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline fades in at f 72
  const taglineIn = interpolate(frame, [72, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        {/* Bloom layer behind spark */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", left: "50%", top: "50%" }}>
            <Bloom progress={bloomProgress} color={COLORS.glow} size={560} />
          </div>

          {/* Spark */}
          <div
            style={{
              transform: `translateY(${sparkY}px) scale(${sparkScale})`,
              position: "relative",
              zIndex: 2,
            }}
          >
            <LumiSpark size={sparkSize} pulse sparkles />
          </div>
        </div>

        {/* "Meet Lumi." headline — appears as spark settles */}
        <div
          style={{
            opacity: meetIn,
            transform: `translateY(${(1 - meetIn) * 20}px)`,
            fontSize: 52,
            fontWeight: 800,
            color: COLORS.ink,
            marginTop: -20,
            letterSpacing: "-0.02em",
          }}
        >
          Meet{" "}
          <span
            style={{
              color: COLORS.glow,
              textShadow: GLOW.ambient(COLORS.glow),
            }}
          >
            Lumi.
          </span>
        </div>

        {/* Wordmark — ClipReveal wipe from bottom */}
        <div style={{ marginTop: 10 }}>
          <ClipReveal progress={wordmarkReveal} from="bottom">
            <Wordmark size={130} withSpark={false} />
          </ClipReveal>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 24,
            opacity: taglineIn,
            transform: `translateY(${(1 - taglineIn) * 18}px)`,
            fontSize: 38,
            fontWeight: 500,
            color: COLORS.inkSoft,
            textAlign: "center",
            maxWidth: 780,
            lineHeight: 1.4,
          }}
        >
          Your mini-teacher — right inside the AI.
        </div>
      </AbsoluteFill>

      {/* Opening flash overlay */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(255,235,200,${flash}) 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
