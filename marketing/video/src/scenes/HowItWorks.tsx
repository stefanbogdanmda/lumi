import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT, useLayout } from "../theme";
import { Terminal, Line } from "../components/Terminal";
import { LessonCard } from "../components/LessonCard";
import { Phone } from "../components/Phone";
import { ProgressShelf } from "../components/ProgressShelf";
import { FadeUp } from "../components/ui";

// A crossfading sub-scene window with a gentle scale.
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
  return <AbsoluteFill style={{ opacity, transform: `scale(${0.98 + opacity * 0.02})` }}>{children}</AbsoluteFill>;
};

const Caption: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const { portrait } = useLayout();
  return (
    <div style={{ position: "absolute", top: portrait ? 150 : 90, width: "100%", textAlign: "center", padding: "0 40px" }}>
      <FadeUp delay={delay}>
        <div style={{ fontSize: portrait ? 50 : 46, fontWeight: 800, color: COLORS.ink, fontFamily: FONT }}>
          {children}
        </div>
      </FadeUp>
    </div>
  );
};

const InlineLesson: React.FC<{ concept: string; body: string; size?: number }> = ({
  concept,
  body,
  size = 20,
}) => (
  <div style={{ borderLeft: `3px solid ${COLORS.glow}`, paddingLeft: 14, marginTop: 12, fontFamily: FONT }}>
    <div style={{ fontSize: size, color: COLORS.glow, fontWeight: 700, marginBottom: 4 }}>
      🪄 Lumi — quick lesson
    </div>
    <div style={{ fontSize: size, color: COLORS.ink, fontWeight: 700 }}>{concept}</div>
    <div style={{ fontSize: size * 0.92, color: COLORS.inkSoft, lineHeight: 1.45, marginTop: 2 }}>{body}</div>
  </div>
);

const DETECT_LINES: Line[] = [
  { text: "deploy the app to production", kind: "prompt" },
  { text: "Done — I saved your API key as an environment variable.", kind: "claude" },
  { text: "$ vercel env add API_KEY production", kind: "code" },
];

const SHELF = [
  { label: "Environment variable", icon: "🔑" },
  { label: "Migration", icon: "🗂️" },
  { label: "API", icon: "🔌" },
  { label: "Git commit", icon: "💾" },
  { label: "JSON", icon: "📦" },
  { label: "Async", icon: "⏳" },
];

const Surface: React.FC<{ label: string; delay: number; children: React.ReactNode }> = ({
  label,
  delay,
  children,
}) => (
  <FadeUp delay={delay} y={50} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
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
  </FadeUp>
);

// Scene 3 (11–21s): how Lumi works — detect & teach, everywhere, remembers.
export const HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { portrait, width } = useLayout();

  const aTermLines = Math.max(0, Math.min(DETECT_LINES.length, Math.floor((frame - 14) / 14) + 1));
  const cardIn = interpolate(frame, [56, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cardReveal = interpolate(frame, [70, 104], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const shelfRevealed = interpolate(frame, [222, 286], [0, SHELF.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const quietIn = interpolate(frame, [262, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const detectTermLessonCard = (
    <LessonCard
      concept="Environment variable"
      explanation="A setting your app reads from outside the code — like a saved note for secrets such as keys or passwords."
      why="It keeps secrets out of your code, so they don't leak when you share it."
      reveal={cardReveal}
      width={portrait ? width - 120 : 760}
    />
  );

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      {/* ── Beat A: detect & teach ── */}
      <Sub start={0} end={120}>
        <Caption delay={4}>Lumi spots every new concept — and explains it.</Caption>
        {portrait ? (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50, paddingTop: 90 }}>
            <Terminal title="claude code" lines={DETECT_LINES} visibleLines={aTermLines} width={Math.min(900, width - 90)} />
            <div style={{ opacity: cardIn, transform: `translateY(${(1 - cardIn) * 40}px)` }}>{detectTermLessonCard}</div>
          </AbsoluteFill>
        ) : (
          <>
            <div style={{ position: "absolute", left: 110, top: 360 }}>
              <Terminal title="claude code" lines={DETECT_LINES} visibleLines={aTermLines} width={780} />
            </div>
            <div style={{ position: "absolute", right: 120, top: 320, opacity: cardIn, transform: `translateX(${(1 - cardIn) * 60}px)` }}>
              {detectTermLessonCard}
            </div>
          </>
        )}
      </Sub>

      {/* ── Beat B: works everywhere ── */}
      <Sub start={120} end={210}>
        <Caption delay={124}>One learning layer — terminal, mobile, and VS&nbsp;Code.</Caption>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: portrait ? 150 : 60 }}>
          <div
            style={{
              display: "flex",
              flexDirection: portrait ? "column" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: portrait ? 22 : 56,
              transform: portrait ? "scale(0.82)" : "none",
            }}
          >
            <Surface label="Terminal" delay={130}>
              <div style={{ width: 440, height: 420, borderRadius: 16, background: "rgba(8,11,28,0.92)", border: "1px solid rgba(255,255,255,0.09)", padding: 24, fontFamily: FONT }}>
                <div style={{ fontSize: 20, color: COLORS.amberDeep }}>
                  ⏺ <span style={{ color: COLORS.ink }}>I added a migration.</span>
                </div>
                <InlineLesson concept="Migration" body="A safe, step-by-step update to your database's shape — like a recipe it can re-run." />
              </div>
            </Surface>

            <Surface label="Mobile" delay={142}>
              <Phone width={portrait ? 250 : 300}>
                <div style={{ fontSize: 16, color: COLORS.amberDeep }}>
                  ⏺ <span style={{ color: COLORS.ink }}>Saved as an API.</span>
                </div>
                <InlineLesson concept="API" body="A doorway one app uses to ask another for data or actions." size={15} />
              </Phone>
            </Surface>

            <Surface label="VS Code panel" delay={154}>
              <div style={{ width: 440, height: 420, borderRadius: 16, background: COLORS.panel, border: "1px solid rgba(255,255,255,0.09)", padding: 18, display: "flex", alignItems: "center" }}>
                <LessonCard
                  concept="Git commit"
                  explanation="A labelled snapshot of your project you can always return to."
                  why="It's your undo button — and a history of what changed."
                  width={404}
                />
              </div>
            </Surface>
          </div>
        </AbsoluteFill>
      </Sub>

      {/* ── Beat C: remembers ── */}
      <Sub start={210} end={300}>
        <Caption delay={214}>It remembers — so you only learn each thing once.</Caption>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40, paddingTop: portrait ? 120 : 40 }}>
          <ProgressShelf concepts={SHELF} revealed={shelfRevealed} width={portrait ? width - 80 : 1180} />
          <div
            style={{
              opacity: quietIn,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 28px",
              borderRadius: 14,
              background: "rgba(94,231,201,0.08)",
              border: `1.5px solid ${COLORS.teal}55`,
              maxWidth: width - 100,
            }}
          >
            <span style={{ fontSize: 28 }}>✓</span>
            <span style={{ fontSize: 26, color: COLORS.inkSoft }}>
              Seen <b style={{ color: COLORS.teal }}>“API”</b> again? Lumi stays quiet — no repeats, no overwhelm.
            </span>
          </div>
        </AbsoluteFill>
      </Sub>
    </AbsoluteFill>
  );
};
