import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT, SPRING, GLOW, useLayout } from "../theme";
import { Terminal, Line } from "../components/Terminal";
import { LessonCard } from "../components/LessonCard";
import { Phone } from "../components/Phone";
import { ProgressShelf } from "../components/ProgressShelf";
import { SparkStar } from "../components/LumiSpark";
import { KineticHeadline, FadeUp, Reveal, Bloom } from "../components/ui";

// ── HowItWorks (11–21s, local 0–299) ────────────────────────────────────────
// Beat A (f 0–119):  "it does this for everything" — terms ignite on the beat.
//   migration → API → race condition each light up with a spark + lesson.
// Beat B (f 120–209): 3D fan-in — Terminal | Mobile | VS Code surfaces.
//   One-frame label: "Terminal · Mobile · VS Code"
// Beat C (f 210–299): Remembers — glowing words fly into glossary shelf;
//   a repeat term stays dark. Copy "Learned once. Never repeated."

// ── CheckSVG: replaces ✓ emoji ───────────────────────────────────────────────
const CheckSVG: React.FC<{ size?: number; color?: string }> = ({
  size = 26,
  color = COLORS.teal,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M4 13L9 18L20 7"
      stroke={color}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Crossfade sub-scene container ────────────────────────────────────────────
const Sub: React.FC<{ start: number; end: number; children: React.ReactNode }> = ({
  start,
  end,
  children,
}) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outP = interpolate(frame, [end - 12, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(inP, outP);
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${0.98 + opacity * 0.02})` }}>
      {children}
    </AbsoluteFill>
  );
};

// ── IgnitingWord: a word that lights up on a beat ────────────────────────────
const IgnitingWord: React.FC<{
  word: string;
  igniteAt: number; // local frame to ignite
  lesson: string;   // plain-English lesson shown inline after ignition
  fontSize?: number;
}> = ({ word, igniteAt, lesson, fontSize = 44 }) => {
  const frame = useCurrentFrame();

  const lit = frame >= igniteAt;
  const progress = interpolate(frame, [igniteAt, igniteAt + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lessonIn = interpolate(frame, [igniteAt + 10, igniteAt + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", position: "relative" }}>
      {/* Bloom behind word on ignition */}
      {lit && (
        <div style={{ position: "absolute", left: "50%", top: "50%" }}>
          <Bloom progress={progress * 0.7} color={COLORS.glow} size={260} />
        </div>
      )}
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: lit ? COLORS.glow : COLORS.inkFaint,
          textShadow: lit ? GLOW.event(COLORS.glow) : undefined,
          transition: "color 0.1s",
          position: "relative",
          zIndex: 1,
          borderBottom: lit ? `2px solid ${COLORS.glow}88` : `2px solid ${COLORS.inkFaint}44`,
          paddingBottom: 2,
        }}
      >
        {word}
      </span>
      {/* Inline lesson — fades in below the word */}
      {lit && (
        <div
          style={{
            opacity: lessonIn,
            transform: `translateY(${(1 - lessonIn) * 16}px)`,
            fontSize: 22,
            color: COLORS.inkSoft,
            marginTop: 6,
            maxWidth: 480,
            lineHeight: 1.45,
            fontWeight: 500,
            borderLeft: `3px solid ${COLORS.glow}88`,
            paddingLeft: 12,
          }}
        >
          {lesson}
        </div>
      )}
    </div>
  );
};

const DETECT_LINES: Line[] = [
  { text: "deploy the app to production", kind: "prompt" },
  { text: "Done — I saved your API key as an environment variable.", kind: "claude" },
  { text: "$ vercel env add API_KEY production", kind: "code" },
];

const SHELF_CONCEPTS = [
  { label: "environment variable" },
  { label: "migration" },
  { label: "API" },
  { label: "git commit" },
  { label: "JSON" },
  { label: "async/await" },
];

// InlineLesson used inside surface panels — no emoji
const InlineLesson: React.FC<{ concept: string; body: string; size?: number }> = ({
  concept,
  body,
  size = 20,
}) => (
  <div style={{ borderLeft: `3px solid ${COLORS.glow}`, paddingLeft: 14, marginTop: 12, fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <SparkStar size={16} color={COLORS.glow} />
      <span style={{ fontSize: size, color: COLORS.glow, fontWeight: 700 }}>Lumi</span>
      <span style={{ fontSize: size * 0.85, color: COLORS.inkFaint }}>— quick lesson</span>
    </div>
    <div style={{ fontSize: size, color: COLORS.ink, fontWeight: 700 }}>{concept}</div>
    <div style={{ fontSize: size * 0.9, color: COLORS.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{body}</div>
  </div>
);

const Surface: React.FC<{ label: string; delay: number; children: React.ReactNode; fanAngle?: number }> = ({
  label,
  delay,
  children,
  fanAngle = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: SPRING.enter });
  const rotate = interpolate(s, [0, 1], [fanAngle * 1.5, fanAngle]);

  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.2),
        transform: `translateY(${(1 - s) * 60}px) rotateY(${rotate}deg)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        perspective: 800,
      }}
    >
      {children}
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.inkSoft,
          padding: "8px 22px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { portrait, width } = useLayout();

  // Beat A: igniting terms on beats
  const aTermLines = Math.max(0, Math.min(DETECT_LINES.length, Math.floor((frame - 14) / 14) + 1));

  // Beat C: shelf
  const shelfRevealed = interpolate(frame, [222, 292], [0, SHELF_CONCEPTS.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const quietIn = interpolate(frame, [266, 284], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rememberedIn = interpolate(frame, [280, 296], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const detectTermLessonCard = (
    <LessonCard
      concept="Environment variable"
      explanation="A setting your app reads from outside the code — like a saved note for secrets such as keys or passwords."
      why="Keeps secrets out of your code so they don't leak when you share it."
      reveal={interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      width={portrait ? width - 120 : 720}
    />
  );

  const cardIn = interpolate(frame, [56, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>

      {/* ── Beat A: "it does this for everything" ── */}
      <Sub start={0} end={120}>
        <div style={{ position: "absolute", top: portrait ? 100 : 72, width: "100%", textAlign: "center", padding: "0 40px" }}>
          <KineticHeadline
            text="It does this for everything."
            accentWord="everything."
            accentColor={COLORS.glow}
            delay={4}
            stagger={5}
            style={{ fontSize: portrait ? 48 : 46, fontWeight: 800, justifyContent: "center" }}
          />
        </div>

        {/* Terms igniting on the beat */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 36,
            paddingTop: portrait ? 160 : 120,
          }}
        >
          <IgnitingWord
            word="migration"
            igniteAt={20}
            lesson="A step-by-step update to your database shape — like a recipe it can re-run."
            fontSize={portrait ? 42 : 48}
          />
          <IgnitingWord
            word="API"
            igniteAt={50}
            lesson="A doorway one app uses to ask another for data or actions."
            fontSize={portrait ? 42 : 48}
          />
          <IgnitingWord
            word="race condition"
            igniteAt={80}
            lesson="Two things run at the same time and stomp on each other's work."
            fontSize={portrait ? 42 : 48}
          />
        </AbsoluteFill>
      </Sub>

      {/* ── Beat B: works everywhere — 3D fan-in ── */}
      <Sub start={120} end={210}>
        <div style={{ position: "absolute", top: portrait ? 100 : 72, width: "100%", textAlign: "center", padding: "0 40px" }}>
          <FadeUp delay={124}>
            <div style={{ fontSize: portrait ? 48 : 44, fontWeight: 800, color: COLORS.ink }}>
              Terminal &middot; Mobile &middot; VS&nbsp;Code
            </div>
          </FadeUp>
        </div>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingTop: portrait ? 150 : 60,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: portrait ? "column" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: portrait ? 22 : 52,
              transform: portrait ? "scale(0.82)" : "none",
            }}
          >
            <Surface label="Terminal" delay={128} fanAngle={-8}>
              <div
                style={{
                  width: 420,
                  height: 390,
                  borderRadius: 16,
                  background: "rgba(8,11,28,0.92)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  padding: 24,
                  fontFamily: FONT,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, color: COLORS.amberDeep }}>
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <circle cx="6" cy="6" r="5" fill={COLORS.amberDeep} />
                  </svg>
                  <span style={{ color: COLORS.ink }}>I added a migration.</span>
                </div>
                <InlineLesson concept="Migration" body="A safe, step-by-step update to your database's shape — like a recipe it can re-run." />
              </div>
            </Surface>

            <Surface label="Mobile" delay={140} fanAngle={0}>
              <Phone width={portrait ? 230 : 280}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, color: COLORS.amberDeep }}>
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <circle cx="5" cy="5" r="4" fill={COLORS.amberDeep} />
                  </svg>
                  <span style={{ color: COLORS.ink }}>Saved as an API.</span>
                </div>
                <InlineLesson concept="API" body="A doorway one app uses to ask another for data or actions." size={15} />
              </Phone>
            </Surface>

            <Surface label="VS Code" delay={152} fanAngle={8}>
              <div
                style={{
                  width: 420,
                  height: 390,
                  borderRadius: 16,
                  background: COLORS.panel,
                  border: "1px solid rgba(255,255,255,0.09)",
                  padding: 18,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <LessonCard
                  concept="Git commit"
                  explanation="A labelled snapshot of your project you can always return to."
                  why="It's your undo button — and a history of what changed."
                  width={384}
                />
              </div>
            </Surface>
          </div>
        </AbsoluteFill>
      </Sub>

      {/* ── Beat C: remembers ── */}
      <Sub start={210} end={300}>
        <div style={{ position: "absolute", top: portrait ? 100 : 72, width: "100%", textAlign: "center", padding: "0 40px" }}>
          <KineticHeadline
            text="Learned once. Never repeated."
            accentWord="Never"
            accentColor={COLORS.teal}
            delay={214}
            stagger={5}
            style={{ fontSize: portrait ? 48 : 46, fontWeight: 800, justifyContent: "center" }}
          />
        </div>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 36,
            paddingTop: portrait ? 120 : 50,
          }}
        >
          <ProgressShelf
            concepts={SHELF_CONCEPTS}
            revealed={shelfRevealed}
            width={portrait ? width - 80 : 1160}
          />

          {/* "API" repeat term stays dark — no repeat */}
          <div
            style={{
              opacity: quietIn,
              transform: `translateY(${(1 - quietIn) * 18}px)`,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 28px",
              borderRadius: 14,
              background: "rgba(94,231,201,0.07)",
              border: `1.5px solid ${COLORS.teal}44`,
              maxWidth: width - 100,
            }}
          >
            <CheckSVG size={26} color={COLORS.teal} />
            <span style={{ fontSize: 26, color: COLORS.inkSoft }}>
              See{" "}
              <b
                style={{
                  color: COLORS.inkFaint,
                  fontStyle: "italic",
                  opacity: 0.55,
                }}
              >
                &ldquo;API&rdquo;
              </b>{" "}
              again?{" "}
              <span style={{ color: COLORS.teal }}>Lumi stays quiet — you already know it.</span>
            </span>
          </div>
        </AbsoluteFill>
      </Sub>
    </AbsoluteFill>
  );
};
