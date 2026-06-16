import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO, SPRING, GLOW, useLayout } from "./theme";
import { Background } from "./components/Background";
import { LessonCard } from "./components/LessonCard";
import { LumiSpark, SparkStar } from "./components/LumiSpark";
import { Wordmark } from "./components/Wordmark";
import { Terminal } from "./components/Terminal";
import type { Line } from "./components/Terminal";
import {
  Bloom,
  Camera,
  Reveal,
  TypeOn,
} from "./components/ui";

// ── Timeline constants (15s = 450 frames @ 30fps) ─────────────────────────
//
// Act 1 — Request (f 0–90, 0–3s)
//   f 0–8:   Terminal fades in.
//   f 8–62:  User prompt types on: "set up the database for my app"
//   f 55–90: AI replies "On it —" then starts working.
//
// Act 2 — Scary term sits (f 90–180, 3–6s)
//   f 90–150:  New output line appears: "running migration…"
//   f 110–180: The word "migration" dims/flickers — user wouldn't know what it means.
//   f 150–180: LumiSpark drifts in toward "migration" (arrives ON the drop).
//
// Act 3 — Lumi moment (f 180–300, 6–10s)
//   f 180:     IGNITION — audio drop lands here; term brightens + bloom expands.
//   f 186–300: LessonCard rises with plain-English lesson.
//
// Act 4 — Payoff (f 300–450, 10–15s)
//   f 310–340: "Added to your glossary" tick reveals.
//   f 340–380: Wordmark springs in.
//   f 370–410: Tagline "Understand what you ship." fades in.
//   f 405–450: Everything holds dead-still — thumbnail frame.

const ACT1_END = 90;
const ACT2_START = 90;
const ACT2_END = 180;
const ACT3_START = 180;
const SPARK_ARRIVE = 150; // spark begins drifting at 5s so it LANDS on the f180 drop
const IGNITE_FRAME = 180; // audio-drop beat — ignition fires here
const CARD_REVEAL_START = 186;
const CARD_REVEAL_END = 300;
const ACT4_START = 300;
const TICK_FRAME = 310;
const WORDMARK_FRAME = 340;
const TAGLINE_FRAME = 370;

// ── Terminal content ───────────────────────────────────────────────────────
const TERMINAL_LINES: Line[] = [
  { text: "set up the database for my app", kind: "prompt" },
  { text: "On it — I'll run the migration and configure your connection.", kind: "claude" },
  { text: "", kind: "code" },
  { text: "creating database schema...", kind: "comment" },
  { text: "running migration…", kind: "code", highlight: "migration" },
  { text: "created .env with your DATABASE_URL", kind: "code" },
];

// How many lines become visible at each frame (gated reveals)
const linesAt = (frame: number): number => {
  if (frame < 8)  return 0;
  if (frame < 55) return 1; // user prompt only (types on separately)
  if (frame < 75) return 2; // AI reply
  if (frame < 85) return 3; // blank spacer
  if (frame < 95) return 4; // "creating database schema..."
  if (frame < 110) return 5; // "running migration…" — the scary term
  if (frame < 140) return 6; // "created .env..."
  return 6;
};

// ── Lesson content (genuinely accurate) ───────────────────────────────────
const CONCEPT = "Migration";
const EXPLANATION =
  "A script that safely updates your database's structure as your app changes. Think of it like a careful, reversible renovation — each change is tracked and can be undone.";
const WHY =
  "So your database schema evolves with your code without losing existing data or breaking things for other developers on the team.";

// ── Glossary check mark SVG ────────────────────────────────────────────────
const CheckMark: React.FC<{ progress: number }> = ({ progress }) => {
  // Draw the check path from 0 to progress via stroke-dashoffset
  const pathLength = 36;
  const dashOffset = pathLength * (1 - progress);
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="17" stroke={COLORS.teal} strokeWidth="2" opacity={progress} />
      <path
        d="M10 18 L16 24 L26 12"
        stroke={COLORS.teal}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};

// ── Main composition ───────────────────────────────────────────────────────
export const LumiUseCase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, width } = useLayout();

  // ── Act 1: terminal entrance + typing ─────────────────────────────────
  const terminalIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The first line (user prompt) types on character by character.
  // It starts at f8, with speed of ~1 char per frame.
  const promptText = "set up the database for my app";
  const charsVisible = Math.min(
    promptText.length,
    Math.max(0, frame - 8)
  );
  const typedPrompt = promptText.slice(0, charsVisible);

  // Build visible lines: line 0 uses the typed version, rest are pre-baked.
  const rawVisible = linesAt(frame);
  const visibleLines = Math.max(0, rawVisible);

  // Substitute the typed prompt into line[0].
  const displayLines: Line[] = TERMINAL_LINES.map((line, i) => {
    if (i === 0) return { ...line, text: typedPrompt };
    return line;
  });

  // Show cursor on last visible line while content is still being revealed
  const showCursor = frame < 150;

  // ── Act 2: "migration" sits dimmed (f 110–210) ─────────────────────────
  // The scary term line is visible from f 110. From f 130 it starts to dim
  // to signal it's unknown. This is handled via the Terminal's existing
  // `highlight` prop which renders the word in danger color.
  // Additionally we add a slight opacity pulse to the highlighted portion.
  const termFlicker =
    frame >= 110 && frame < IGNITE_FRAME
      ? 0.65 + Math.sin(frame * 0.55) * 0.12
      : 1;

  // ── Act 3: Spark drifts in ─────────────────────────────────────────────
  const sparkSpring = spring({
    frame: frame - SPARK_ARRIVE,
    fps,
    config: SPRING.glide,
  });
  const sparkVisible = frame >= SPARK_ARRIVE && frame < IGNITE_FRAME + 10;

  // Spark drifts from upper-right toward the terminal "migration" word area.
  const sparkX = interpolate(sparkSpring, [0, 1], [portrait ? 80 : 120, 0]);
  const sparkY = interpolate(sparkSpring, [0, 1], [-180, 0]);
  const sparkOpacity = Math.min(1, sparkSpring * 2.2);

  // ── Act 3: Ignition ────────────────────────────────────────────────────
  const ignited = frame >= IGNITE_FRAME;
  const bloomProgress = interpolate(frame, [IGNITE_FRAME, IGNITE_FRAME + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // LessonCard spring + text reveal
  const cardSpring = spring({
    frame: frame - CARD_REVEAL_START,
    fps,
    config: SPRING.enter,
  });
  const cardReveal = interpolate(
    frame,
    [CARD_REVEAL_START, CARD_REVEAL_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Act 4: glossary tick ───────────────────────────────────────────────
  const tickProgress = interpolate(frame, [TICK_FRAME, TICK_FRAME + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tickOpacity = interpolate(frame, [TICK_FRAME, TICK_FRAME + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Act 4: wordmark + tagline ──────────────────────────────────────────
  const wordmarkSpring = spring({
    frame: frame - WORDMARK_FRAME,
    fps,
    config: SPRING.pop,
  });
  const taglineOpacity = interpolate(frame, [TAGLINE_FRAME, TAGLINE_FRAME + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [TAGLINE_FRAME, TAGLINE_FRAME + 24], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Derived layout values ──────────────────────────────────────────────
  // Portrait (1080×1920): terminal must fit inside 1080px without clipping the
  // "running migration…" line. Leave 40px margin each side → 1000px terminal.
  // Reduce the mono font to 20px so even long lines wrap gracefully.
  const termWidth = portrait ? width - 80 : 860;
  // Portrait mono font size: smaller so no line truncates.
  const termFontSize = portrait ? 20 : 24;
  const cardWidth = portrait ? width - 80 : 780;
  const sparkSize = portrait ? 44 : 60;

  // Portrait spark anchor: "running migration…" is line 4 (0-indexed) in the
  // terminal body. Title bar ≈50px; body padding 26px; each line ≈34px at 20px
  // font (lineHeight 1.7). top = 50+26+4×34 = 212px from terminal top.
  // In landscape at 24px: lineHeight 1.7×24≈41px → top 26+4×41=190px + 54=244
  // but the existing value of 186 works visually for landscape, keep it.
  const sparkTop = portrait ? 212 : 186;
  // "running " prefix in mono: 8 chars × ~12px/char at 20px ≈ 96px + padding 30px = 126px portrait
  // In landscape at 24px: 8 chars × ~14.4px ≈ 115px + 30px = 145px → existing 260 offset (centre of word)
  const sparkLeft = portrait ? 160 : 260;
  // Bloom position mirrors spark left
  const bloomLeft = portrait ? 160 : 310;

  // ── Background intensity: brightens during + after ignition ───────────
  const bgIntensity = interpolate(frame, [IGNITE_FRAME, IGNITE_FRAME + 60, ACT4_START], [1, 1.6, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Terminal dims slightly after Act 3 begins to put focus on lesson card
  const terminalOpacity = interpolate(frame, [ACT3_START + 30, ACT4_START], [1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Hide terminal entirely once Act 4 payoff begins
  const showTerminal = frame < ACT4_START + 20;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg0 }}>
      {/* Soundtrack: play first 15 s of the existing track */}
      <Audio src={staticFile("audio/soundtrack.wav")} endAt={450} />

      {/* Background with dynamic warmth */}
      <Background intensity={bgIntensity} />

      {/* Slow camera push across the whole piece */}
      <Camera push={[1, 1.035]} drift={4}>
        <AbsoluteFill style={{ fontFamily: FONT }}>

          {/* ── ACT 1 + 2: Terminal ─────────────────────────────────────── */}
          {showTerminal && (
            <div
              style={{
                position: "absolute",
                top: portrait ? 100 : (ignited ? 60 : 140),
                width: "100%",
                display: "flex",
                justifyContent: "center",
                opacity: terminalIn * terminalOpacity,
                transform: `translateY(${(1 - terminalIn) * 30}px) translateY(${
                  ignited
                    ? interpolate(frame, [IGNITE_FRAME, IGNITE_FRAME + 30], [0, -40], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      })
                    : 0
                }px)`,
                transition: "none",
              }}
            >
              <div style={{ position: "relative", opacity: termFlicker }}>
                <Terminal
                  title="claude code — project"
                  lines={displayLines}
                  visibleLines={visibleLines}
                  width={termWidth}
                  fontSize={termFontSize}
                  showCursor={showCursor}
                />

                {/* Spark hovers near the "migration" word in the terminal.
                    sparkTop/sparkLeft are computed from the layout block above,
                    accounting for font-size differences between portrait/landscape. */}
                {sparkVisible && (
                  <div
                    style={{
                      position: "absolute",
                      top: sparkTop,
                      left: sparkLeft,
                      transform: `translate(calc(-50% + ${sparkX}px), calc(-50% + ${sparkY}px))`,
                      opacity: sparkOpacity,
                      zIndex: 10,
                    }}
                  >
                    <LumiSpark size={sparkSize} pulse sparkles />
                  </div>
                )}

                {/* Bloom behind "migration" on ignition */}
                {ignited && (
                  <div
                    style={{
                      position: "absolute",
                      top: sparkTop,
                      left: bloomLeft,
                      pointerEvents: "none",
                      zIndex: 5,
                    }}
                  >
                    <Bloom
                      progress={bloomProgress}
                      color={COLORS.glow}
                      size={portrait ? 260 : 340}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ACT 3: LessonCard rises ─────────────────────────────────── */}
          {ignited && frame < ACT4_START + 10 && (
            <div
              style={{
                position: "absolute",
                bottom: portrait ? 70 : 80,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                opacity: Math.min(1, cardSpring * 1.25),
                transform: `translateY(${(1 - cardSpring) * 60}px)`,
                zIndex: 20,
              }}
            >
              <LessonCard
                concept={CONCEPT}
                explanation={EXPLANATION}
                why={WHY}
                reveal={cardReveal}
                learned={frame >= ACT4_START}
                width={cardWidth}
              />
            </div>
          )}

          {/* ── ACT 4: Glossary tick ─────────────────────────────────────── */}
          {frame >= TICK_FRAME && frame < TAGLINE_FRAME + 10 && (
            <div
              style={{
                position: "absolute",
                top: portrait ? 90 : 110,
                width: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                opacity: tickOpacity,
                transform: `translateY(${(1 - tickOpacity) * 18}px)`,
              }}
            >
              <CheckMark progress={tickProgress} />
              <span
                style={{
                  fontSize: portrait ? 22 : 26,
                  color: COLORS.teal,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                Added to your glossary
              </span>
            </div>
          )}

          {/* ── ACT 4: Wordmark + tagline ────────────────────────────────── */}
          {frame >= WORDMARK_FRAME && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: portrait ? 18 : 22,
              }}
            >
              {/* Soft amber glow behind wordmark */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                  }}
                >
                  <Bloom
                    progress={Math.min(1, wordmarkSpring)}
                    color={COLORS.glow}
                    size={portrait ? 360 : 480}
                  />
                </div>
                <div
                  style={{
                    transform: `scale(${0.8 + wordmarkSpring * 0.2})`,
                    opacity: Math.min(1, wordmarkSpring * 1.3),
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  <Wordmark size={portrait ? 100 : 130} withSpark />
                </div>
              </div>

              {/* Tagline */}
              <div
                style={{
                  opacity: taglineOpacity,
                  transform: `translateY(${taglineY}px)`,
                  fontSize: portrait ? 34 : 44,
                  fontWeight: 800,
                  color: COLORS.glow,
                  textAlign: "center",
                  letterSpacing: "-0.01em",
                  textShadow:
                    taglineOpacity > 0.6
                      ? GLOW.ambient(COLORS.glow)
                      : undefined,
                }}
              >
                Understand what you ship.
              </div>
            </div>
          )}

          {/* Corner sparkle accents (subtle, visible through whole piece) */}
          <div
            style={{
              position: "absolute",
              left: portrait ? 40 : 80,
              top: portrait ? 40 : 60,
              opacity: interpolate(frame, [0, 30], [0, 0.6], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <SparkStar size={portrait ? 20 : 26} color={COLORS.teal} />
          </div>
          <div
            style={{
              position: "absolute",
              right: portrait ? 50 : 100,
              bottom: portrait ? 50 : 70,
              opacity: interpolate(frame, [10, 40], [0, 0.5], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <SparkStar size={portrait ? 16 : 20} color={COLORS.lavender} delay={10} />
          </div>

        </AbsoluteFill>
      </Camera>
    </AbsoluteFill>
  );
};
