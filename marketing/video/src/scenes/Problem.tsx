import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO, SPRING, GLOW, useLayout } from "../theme";
import { LumiSpark } from "../components/LumiSpark";
import { LessonCard } from "../components/LessonCard";
import { KineticHeadline, Bloom, TypeOn } from "../components/ui";

// ── Hook + Ignition (0–6s, local frames 0–179) ─────────────────────────────
// Phase 1 (f 0–60):  TypeOn types the hook copy line by line.
//   "You asked AI to build it." → "It worked." → one term sits dimmed.
// Phase 2 (f 62+):   "You have no idea how." punches in via KineticHeadline.
// Phase 3 (f 90–119): Spark drifts in, lands on the dimmed term.
// Phase 4 (f 120+):  Word IGNITES — glow + LessonCard unfolds. One gesture.

const DIMMED_TERM = "environment variable";
const LESSON_CONCEPT = "environment variable";
const LESSON_BODY =
  "A saved note your app reads instead of hard-coding secrets. Keeps your API keys out of the code.";
const LESSON_WHY =
  "So when you share your code, your passwords don't come with it.";

const LINE1 = "You asked AI to build it.";
const LINE2 = "It worked.";
const IDEA_DELAY = 62;
const TERM_APPEAR_START = 78;
const SPARK_DELAY = 90;
const IGNITE_FRAME = 120;

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, width } = useLayout();

  // ── Typing phase ──────────────────────────────────────────────────────────
  // Line 1 starts at f 6 (1.8 chars/f); line 2 at f 50 (2.2 chars/f).
  const line1Visible = frame >= 6;
  const line2Visible = frame >= 50;

  // ── Dimmed term ───────────────────────────────────────────────────────────
  const termAppear = interpolate(frame, [TERM_APPEAR_START, TERM_APPEAR_START + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Gentle flicker before ignition
  const flicker = frame < IGNITE_FRAME ? Math.sin(frame * 0.7) * 0.12 : 0;
  const termBaseOpacity = termAppear * (0.38 + flicker);

  // ── Spark ─────────────────────────────────────────────────────────────────
  const sparkS = spring({ frame: frame - SPARK_DELAY, fps, config: SPRING.glide });
  const sparkX = interpolate(sparkS, [0, 1], [portrait ? 160 : 210, 0]);
  const sparkY = interpolate(sparkS, [0, 1], [-240, 0]);
  const sparkOpacity = Math.min(1, sparkS * 2);
  const sparkVisible = frame >= SPARK_DELAY && frame <= IGNITE_FRAME + 8;

  // ── Ignition ─────────────────────────────────────────────────────────────
  const ignited = frame >= IGNITE_FRAME;
  const wordBright = interpolate(frame, [IGNITE_FRAME, IGNITE_FRAME + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bloomProgress = interpolate(frame, [IGNITE_FRAME, IGNITE_FRAME + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardReveal = interpolate(frame, [IGNITE_FRAME + 6, IGNITE_FRAME + 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardSpring = spring({ frame: frame - (IGNITE_FRAME + 4), fps, config: SPRING.enter });

  // ── Word appearance ───────────────────────────────────────────────────────
  const wordOpacity = ignited ? Math.min(1, termBaseOpacity + wordBright * 0.62) : termBaseOpacity;
  const wordColor = ignited ? COLORS.glow : COLORS.danger;
  const wordBg = ignited
    ? `rgba(255,197,107,${wordBright * 0.18})`
    : "rgba(255,107,129,0.1)";
  const wordBorder = ignited
    ? `1.5px solid rgba(255,197,107,${0.3 + wordBright * 0.5})`
    : `1.5px solid ${COLORS.danger}66`;
  const wordShadow = ignited ? GLOW.event(COLORS.glow) : undefined;

  // ── 59% stat (pre-ignition only) ─────────────────────────────────────────
  const pctIn = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pctValue = Math.round(
    interpolate(frame, [30, 60], [20, 59], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const headFontSize = portrait ? 58 : 66;
  const termFontSize = portrait ? 28 : 32;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* ── Hook copy ── */}
      <div
        style={{
          position: "absolute",
          top: portrait ? 130 : 100,
          width: "100%",
          textAlign: "center",
          padding: "0 60px",
        }}
      >
        {/* Line 1: "You asked AI to build it." */}
        {line1Visible && (
          <div
            style={{
              fontSize: headFontSize,
              fontWeight: 800,
              color: COLORS.ink,
              minHeight: headFontSize * 1.3,
            }}
          >
            <TypeOn text={LINE1} speed={1} />
          </div>
        )}

        {/* Line 2: "It worked." */}
        {line2Visible && (
          <div
            style={{
              fontSize: headFontSize,
              fontWeight: 800,
              color: COLORS.glow,
              minHeight: headFontSize * 1.3,
              marginTop: -8,
            }}
          >
            <TypeOn text={LINE2} speed={1} />
          </div>
        )}

        {/* "You have no idea how." — kinetic headline */}
        <div style={{ marginTop: 6 }}>
          <KineticHeadline
            text="You have no idea how."
            accentWord="idea"
            accentColor={COLORS.danger}
            delay={IDEA_DELAY}
            stagger={5}
            style={{
              fontSize: headFontSize,
              fontWeight: 800,
              justifyContent: "center",
            }}
          />
        </div>

        {/* Dimmed term + spark land-zone */}
        <div
          style={{
            marginTop: portrait ? 28 : 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Bloom behind the word on ignition */}
          {ignited && (
            <div style={{ position: "absolute", left: "50%", top: "50%" }}>
              <Bloom progress={bloomProgress} color={COLORS.glow} size={420} />
            </div>
          )}

          {/* The dimmed / igniting word */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              opacity: wordOpacity,
              fontSize: termFontSize,
              fontFamily: MONO,
              fontWeight: 700,
              color: wordColor,
              padding: "10px 22px",
              borderRadius: 12,
              background: wordBg,
              border: wordBorder,
              boxShadow: wordShadow,
            }}
          >
            {DIMMED_TERM}
          </div>

          {/* Spark — drifts in from offset, disappears at ignition */}
          {sparkVisible && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "-60px",
                transform: `translate(calc(-50% + ${sparkX}px), ${sparkY}px)`,
                opacity: sparkOpacity,
                zIndex: 2,
              }}
            >
              <LumiSpark size={portrait ? 54 : 62} pulse sparkles />
            </div>
          )}
        </div>
      </div>

      {/* ── LessonCard unfolds below on ignition ── */}
      {ignited && (
        <div
          style={{
            position: "absolute",
            bottom: portrait ? 80 : 60,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            opacity: Math.min(1, cardSpring * 1.2),
            transform: `translateY(${(1 - cardSpring) * 50}px)`,
          }}
        >
          <LessonCard
            concept={LESSON_CONCEPT}
            explanation={LESSON_BODY}
            why={LESSON_WHY}
            reveal={cardReveal}
            width={portrait ? width - 80 : 800}
          />
        </div>
      )}

      {/* ── 59% stat — shown pre-ignition ── */}
      {!ignited && (
        <div
          style={{
            position: "absolute",
            bottom: portrait ? 80 : 50,
            width: "100%",
            textAlign: "center",
            opacity: pctIn,
            transform: `translateY(${(1 - pctIn) * 20}px)`,
          }}
        >
          <span style={{ fontSize: 30, color: COLORS.inkSoft, fontWeight: 500 }}>
            <span style={{ color: COLORS.glow, fontWeight: 800, fontSize: 38 }}>
              {pctValue}%
            </span>{" "}
            of devs ship AI code they don&apos;t fully understand.
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
