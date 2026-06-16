import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO, SPRING, GLOW, useLayout } from "../theme";
import { Wordmark } from "../components/Wordmark";
import { LumiSpark, SparkStar } from "../components/LumiSpark";
import { FadeUp, Bloom } from "../components/ui";

// ── CTA (27–30s, local 0–89) ─────────────────────────────────────────────────
// Lockup + tagline "Understand what you ship." + real two-step install command
// typed on with a glow pulse, then holds dead-still ~20f (readable thumbnail).
//
// REAL install command (two lines, mono):
//   /plugin marketplace add stefanbogdanmda/digitalproduct
//   /plugin install lumi@lumi

// Character-by-character reveal at `speed` chars/frame from `startFrame`.
const typeChars = (text: string, frame: number, startFrame: number, speed: number): string =>
  text.slice(0, Math.min(text.length, Math.max(0, Math.floor((frame - startFrame) * speed))));

// Blinking block cursor rendered inline
const Cursor: React.FC<{ visible: boolean; frame: number }> = ({ visible, frame }) => {
  if (!visible) return null;
  const on = Math.floor(frame / 15) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.45em",
        height: "1em",
        background: COLORS.glow,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        opacity: on ? 1 : 0,
        boxShadow: on ? `0 0 12px ${COLORS.glow}cc` : undefined,
      }}
    />
  );
};

const CMD1 = "/plugin marketplace add stefanbogdanmda/digitalproduct";
const CMD2 = "/plugin install lumi@lumi";

// Speed in chars/frame — retimed so both lines finish by local f48 (~f62 worst-case),
// leaving ≥42 frames of dead-still hold through the end of the 90f scene.
//
// Timing summary:
//   CMD1: starts f8, speed 2.2 ch/f → 54 chars → done at f8 + ceil(54/2.2) = f33
//   CMD2: starts f36, speed 2.2 ch/f → 25 chars → done at f36 + ceil(25/2.2) = f48
//   Glow pulse: f48–62 (14 frames of animated glow, then static)
//   Hold still: f62–89 (28 frames, readable thumbnail)
const CMD1_SPEED = 2.2;
const CMD1_START = 8;
// CMD2 starts 3 frames after CMD1 finishes
const CMD2_START = CMD1_START + Math.ceil(CMD1.length / CMD1_SPEED) + 3;
const CMD2_SPEED = 2.2;
const CMD_DONE_FRAME = CMD2_START + Math.ceil(CMD2.length / CMD2_SPEED);

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait } = useLayout();

  // Opening flash
  const flash = interpolate(frame, [0, 3, 18], [0, 0.65, 0], { extrapolateRight: "clamp" });

  // Lockup spring-in
  const lock = spring({ frame, fps, config: SPRING.pop });

  // Tagline fades in at f 16
  const taglineIn = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Capability line at f 30
  const capIn = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Command box springs in at f 4 (early, so CMD1 can start typing at f8)
  const boxIn = spring({ frame: frame - 4, fps, config: SPRING.enter });

  // Bloom behind command box: ramps in f4–30 to be fully present before typing starts
  const bloomProgress = interpolate(frame, [4, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typed characters
  const cmd1Text = typeChars(CMD1, frame, CMD1_START, CMD1_SPEED);
  const cmd2Text = typeChars(CMD2, frame, CMD2_START, CMD2_SPEED);

  const cmd1Done = cmd1Text.length >= CMD1.length;
  const cmd2Done = cmd2Text.length >= CMD2.length;
  const allDone = cmd2Done;

  // Glow pulse once typing finishes: animate f48–62, then hold static at peak.
  // After f62 all motion freezes — clean thumbnail, no flicker.
  const PULSE_END = 62;
  const pulseT = allDone
    ? frame < PULSE_END
      ? (Math.sin(frame * 0.45) + 1) / 2  // active pulse during f48–62
      : 0.5                                  // freeze at mid-value → static glow
    : 0;
  const cmdGlowOpacity = allDone ? 0.12 + pulseT * 0.14 : bloomProgress * 0.1;

  const sparkSize = portrait ? 90 : 120;
  const wordmarkSize = portrait ? 100 : 130;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>

        {/* Lockup: spark + wordmark */}
        <div
          style={{
            transform: `scale(${0.7 + lock * 0.3})`,
            opacity: Math.min(1, lock * 1.4),
            marginBottom: 6,
          }}
        >
          <LumiSpark size={sparkSize} pulse sparkles />
        </div>
        <div
          style={{
            transform: `scale(${0.85 + lock * 0.15})`,
            opacity: Math.min(1, lock * 1.4),
          }}
        >
          <Wordmark size={wordmarkSize} withSpark={false} />
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 14,
            opacity: taglineIn,
            transform: `translateY(${(1 - taglineIn) * 24}px)`,
            fontSize: portrait ? 38 : 46,
            fontWeight: 800,
            color: COLORS.glow,
            textShadow: taglineIn > 0.8 ? GLOW.ambient(COLORS.glow) : undefined,
            textAlign: "center",
          }}
        >
          Understand what you ship.
        </div>

        {/* Capability line */}
        <div
          style={{
            marginTop: 10,
            opacity: capIn,
            transform: `translateY(${(1 - capIn) * 16}px)`,
            fontSize: portrait ? 22 : 27,
            color: COLORS.inkSoft,
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          Free on your own Claude plan &middot; mobile + VS&nbsp;Code
        </div>

        {/* Install command box */}
        <div
          style={{
            marginTop: 26,
            position: "relative",
            opacity: Math.min(1, boxIn * 1.3),
            transform: `scale(${0.92 + boxIn * 0.08}) translateY(${(1 - boxIn) * 24}px)`,
          }}
        >
          {/* Bloom behind box */}
          <div style={{ position: "absolute", left: "50%", top: "50%" }}>
            <Bloom progress={bloomProgress * 0.8} color={COLORS.glow} size={portrait ? 440 : 520} />
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: portrait ? 20 : 24,
              color: COLORS.ink,
              padding: "18px 28px",
              borderRadius: 14,
              background: "rgba(8,11,28,0.9)",
              border: `1.5px solid rgba(255,197,107,${0.28 + cmdGlowOpacity * 1.5})`,
              boxShadow: `0 0 ${44 + pulseT * 28}px rgba(255,179,71,${cmdGlowOpacity}), 0 0 80px rgba(255,179,71,${cmdGlowOpacity * 0.5})`,
              position: "relative",
              zIndex: 2,
              lineHeight: 2,
              minWidth: portrait ? 500 : 680,
            }}
          >
            {/* Line 1: /plugin marketplace add stefanbogdanmda/digitalproduct */}
            <div>
              <span style={{ color: COLORS.glow }}>
                {cmd1Text.startsWith("/plugin") ? "/plugin" : cmd1Text}
              </span>
              {cmd1Text.length > "/plugin".length && (
                <span style={{ color: COLORS.teal }}>
                  {cmd1Text.slice("/plugin".length).startsWith(" marketplace add ")
                    ? " marketplace add "
                    : cmd1Text.slice("/plugin".length)}
                </span>
              )}
              {cmd1Text.length > "/plugin marketplace add ".length && (
                <span style={{ color: COLORS.ink }}>
                  {cmd1Text.slice("/plugin marketplace add ".length)}
                </span>
              )}
              <Cursor visible={!cmd1Done} frame={frame} />
            </div>

            {/* Line 2: /plugin install lumi@lumi — visible once line 1 done */}
            {cmd1Done && (
              <div>
                <span style={{ color: COLORS.glow }}>
                  {cmd2Text.startsWith("/plugin") ? "/plugin" : cmd2Text}
                </span>
                {cmd2Text.length > "/plugin".length && (
                  <span style={{ color: COLORS.lavender }}>
                    {cmd2Text.slice("/plugin".length).startsWith(" install ")
                      ? " install "
                      : cmd2Text.slice("/plugin".length)}
                  </span>
                )}
                {cmd2Text.length > "/plugin install ".length && (
                  <span style={{ color: COLORS.ink }}>
                    {cmd2Text.slice("/plugin install ".length)}
                  </span>
                )}
                <Cursor visible={!cmd2Done} frame={frame} />
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>

      {/* Corner sparkles */}
      <div style={{ position: "absolute", left: portrait ? 80 : 360, top: portrait ? 200 : 300 }}>
        <SparkStar size={portrait ? 28 : 34} color={COLORS.teal} />
      </div>
      <div style={{ position: "absolute", right: portrait ? 80 : 380, bottom: portrait ? 200 : 240 }}>
        <SparkStar size={portrait ? 22 : 26} color={COLORS.lavender} delay={8} />
      </div>
      <div style={{ position: "absolute", right: portrait ? 120 : 420, top: portrait ? 160 : 280 }}>
        <SparkStar size={portrait ? 18 : 22} color={COLORS.glow} delay={14} />
      </div>

      {/* Opening flash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(255,235,200,${flash}) 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
