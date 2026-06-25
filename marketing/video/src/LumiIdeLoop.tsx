import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, GLOW, SPRING } from "./theme";
import { Background } from "./components/Background";
import { Terminal, Line } from "./components/Terminal";
import { LessonCard } from "./components/LessonCard";
import { Wordmark } from "./components/Wordmark";
import { SecurityScan } from "./components/SecurityScan";
import { Center, Reveal } from "./components/ui";

// 14s @ 30fps. Beats tile [0, LOOP].
export const LOOP = 420;
const BEATS = {
  hook:    { from: 0,   dur: 84  },
  teach:   { from: 84,  dur: 108 },
  remember:{ from: 192, dur: 84  },
  safe:    { from: 276, dur: 96  },
  resolve: { from: 372, dur: 48  },
} as const;

const useStage = () => {
  const { width, height } = useVideoConfig();
  return {
    width,
    height,
    portrait: height > width * 1.08,
    square: Math.abs(width - height) < width * 0.08,
  };
};

/** Cross-fades each beat's opacity in then out so the loop rests on COLORS.bg0. */
const fade = (frame: number, dur: number, inN = 8, outN = 10) =>
  Math.min(
    interpolate(frame, [0, inN], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [dur - outN, dur], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

// ── Beat 1: Hook ──────────────────────────────────────────────────────────────
// Shows an AI-generated terminal snippet that leaks a secret, prompting curiosity.
const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width } = useStage();
  const lines: Line[] = [
    { kind: "prompt", text: "> add login" },
    { kind: "claude", text: "Storing the API key…", highlight: "API key" },
    { kind: "code",   text: "const key = process.env.API_KEY" },
  ];
  const visible = Math.min(lines.length, Math.floor(frame / 12) + 1);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 28, padding: 40 }}>
        <Terminal
          lines={lines}
          visibleLines={visible}
          width={Math.min(width * 0.88, 760)}
          fontSize={26}
          title="your AI tool"
        />
        <div
          style={{
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.inkSoft,
          }}
        >
          Your AI just wrote this.
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ── Beat 2: Teach ─────────────────────────────────────────────────────────────
// Lumi's lesson card explains what an environment variable is, simply.
const Teach: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width } = useStage();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ padding: 40 }}>
        <Reveal delay={2} y={28} blur={8}>
          <LessonCard
            concept="Environment variable"
            explanation="A labelled box for secrets, kept out of your code — so keys never live in the app itself."
            why="it keeps your keys safe."
            width={Math.min(width * 0.9, 820)}
            reveal={interpolate(frame, [6, 60], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

// ── Beat 3: Remember ──────────────────────────────────────────────────────────
// Lumi remembers concepts across every AI tool the developer uses.
const TOOLS = ["Claude Code", "Cursor", "Copilot", "Codex"];

const Remember: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 30, padding: 40 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 34,
            fontWeight: 800,
            color: COLORS.ink,
          }}
        >
          Remembered across every tool
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 820,
          }}
        >
          {TOOLS.map((t, i) => {
            const s = spring({ frame: frame - 6 - i * 6, fps, config: SPRING.pop });
            return (
              <span
                key={t}
                style={{
                  transform: `scale(${0.8 + s * 0.2})`,
                  opacity: s,
                  fontFamily: FONT,
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLORS.glow,
                  background: `${COLORS.glow}1F`,
                  border: `1.5px solid ${COLORS.cardBorder}`,
                  borderRadius: 999,
                  padding: "12px 26px",
                }}
              >
                {t}
              </span>
            );
          })}
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ── Beat 4: Safe ──────────────────────────────────────────────────────────────
// Lumi's security lens catches risky patterns before they ship.
const Safe: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width } = useStage();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 22, padding: 40 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 30,
            fontWeight: 800,
            color: COLORS.ink,
          }}
        >
          And catches the risky bits.
        </div>
        <SecurityScan width={Math.min(width * 0.9, 820)} />
      </Center>
    </AbsoluteFill>
  );
};

// ── Beat 5: Resolve ───────────────────────────────────────────────────────────
// Brand lock-up and tagline — the loop ends on espresso background.
const Resolve: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: SPRING.pop });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur, 8, 14) }}>
      <Center style={{ gap: 18 }}>
        <div style={{ transform: `scale(${0.8 + s * 0.2})` }}>
          <Wordmark size={140} withSpark />
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.ink,
          }}
        >
          Understand what you{" "}
          <span
            style={{
              color: COLORS.glow,
              textShadow: GLOW.ambient(COLORS.glow),
            }}
          >
            build.
          </span>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

/** No <Audio> — the loop ships muted on every surface. */
export const LumiIdeLoop: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg0 }}>
    <Background intensity={0.8} />
    <Sequence from={BEATS.hook.from}     durationInFrames={BEATS.hook.dur}     layout="none">
      <Hook     dur={BEATS.hook.dur} />
    </Sequence>
    <Sequence from={BEATS.teach.from}    durationInFrames={BEATS.teach.dur}    layout="none">
      <Teach    dur={BEATS.teach.dur} />
    </Sequence>
    <Sequence from={BEATS.remember.from} durationInFrames={BEATS.remember.dur} layout="none">
      <Remember dur={BEATS.remember.dur} />
    </Sequence>
    <Sequence from={BEATS.safe.from}     durationInFrames={BEATS.safe.dur}     layout="none">
      <Safe     dur={BEATS.safe.dur} />
    </Sequence>
    <Sequence from={BEATS.resolve.from}  durationInFrames={BEATS.resolve.dur}  layout="none">
      <Resolve  dur={BEATS.resolve.dur} />
    </Sequence>
  </AbsoluteFill>
);
