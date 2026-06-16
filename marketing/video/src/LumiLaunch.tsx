import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, EASE, FONT, MONO, GLOW, SPRING } from "./theme";
import { SCENE, FEATURE_BEATS, PAYOFF_BEATS, beatPulse, hitEnv } from "./beats";
import { Background } from "./components/Background";
import { Wordmark } from "./components/Wordmark";
import { LumiSpark, SparkStar } from "./components/LumiSpark";
import { LessonCard } from "./components/LessonCard";
import { Terminal, Line } from "./components/Terminal";
import { ProgressShelf } from "./components/ProgressShelf";
import {
  KineticHeadline,
  Reveal,
  Bloom,
  Camera,
  Center,
  TypeOn,
  CountUp,
  StaggerGroup,
  StaggerItem,
} from "./components/ui";

// ── stage helpers ─────────────────────────────────────────────────────────────
// The SAME scene logic drives 16:9, 1:1 and 9:16. Short side is 1080 in all
// three, so px sizes stay consistent — only the *arrangement* responds.
const useStage = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width * 1.08;
  const landscape = width > height * 1.08;
  const square = !portrait && !landscape;
  return { width, height, portrait, landscape, square };
};

const cwOf = (width: number, portrait: boolean) =>
  Math.min(width * 0.9, portrait ? 960 : 1240);

/** Combined fade-in / fade-out envelope for a scene, by LOCAL frame. */
const sceneFade = (frame: number, dur: number, inN = 0, outN = 12) => {
  const fin = inN > 0 ? interpolate(frame, [0, inN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const fout = interpolate(frame, [dur - outN, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(fin, fout);
};

const eyebrowStyle = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  fontWeight: 700,
  letterSpacing: "0.42em",
  textTransform: "uppercase",
  color: COLORS.glow,
});

// ── SCENE 1 — HOOK / PROBLEM (0–6s) ───────────────────────────────────────────
const SceneHook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width, portrait } = useStage();
  const op = sceneFade(frame, dur, 0, 24);

  const lines: Line[] = [
    { kind: "prompt", text: "> build me a login page" },
    { kind: "claude", text: "Adding JWT auth and password hashing…", highlight: "JWT" },
    { kind: "code", text: "const token = jwt.sign(payload, env.SECRET)" },
    { kind: "comment", text: "// running the database migration", highlight: "migration" },
    { kind: "claude", text: "Wiring the OAuth callback + CORS.", highlight: "OAuth" },
  ];
  const visible = Math.min(lines.length, Math.floor(frame / 16));

  const termW = Math.min(width * 0.88, portrait ? 920 : 1060);
  const h1 = portrait ? 70 : 86;

  // tension push at the end → into the near-silence before the drop
  const tension = interpolate(frame, [120, dur], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const calm = interpolate(frame, [120, dur], [1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Center style={{ gap: portrait ? 46 : 54, padding: 40, transform: `scale(${tension})` }}>
        <Reveal delay={2} y={26} blur={6}>
          <div style={{ textAlign: "center" }}>
            <KineticHeadline
              text="You're building with AI."
              accentWord="AI"
              accentColor={COLORS.glow}
              stagger={3}
              style={{ fontFamily: FONT, fontSize: h1, fontWeight: 800, color: COLORS.ink, letterSpacing: "-0.03em", justifyContent: "center" }}
            />
          </div>
        </Reveal>

        <div style={{ opacity: calm }}>
          <Reveal delay={16} y={30} blur={8} scale={0.98}>
            <Terminal lines={lines} visibleLines={visible} width={termW} fontSize={portrait ? 22 : 26} title="claude code" />
          </Reveal>
        </div>

        <Reveal delay={64} y={22} blur={6}>
          <div style={{ textAlign: "center" }}>
            <KineticHeadline
              text="But do you understand it?"
              accentWord="understand"
              accentColor={COLORS.danger}
              stagger={3}
              soft
              style={{ fontFamily: FONT, fontSize: h1 * 0.82, fontWeight: 800, color: COLORS.inkSoft, letterSpacing: "-0.02em", justifyContent: "center" }}
            />
          </div>
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

// ── SCENE 2 — REVEAL "Meet Lumi" (6–11s) — lands on the drop ──────────────────
const SceneReveal: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait } = useStage();
  const op = sceneFade(frame, dur, 0, 16);

  // hard ignition at local f0
  const flash = hitEnv(frame, 0, 14);
  const sparkS = spring({ frame, fps, config: SPRING.pop });
  const markS = spring({ frame: frame - 6, fps, config: SPRING.enter });

  const markSize = portrait ? 150 : 188;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Camera push={[1.03, 1.0]} drift={4}>
        <Center style={{ gap: portrait ? 30 : 36 }}>
          {/* ignition bloom */}
          <Bloom progress={Math.max(flash, 0.35 * markS)} color={COLORS.glow} size={portrait ? 1100 : 1500} style={{ left: "50%", top: "44%" }} />

          <div style={{ transform: `scale(${0.5 + sparkS * 0.5})`, opacity: sparkS, marginBottom: portrait ? 6 : 12 }}>
            <LumiSpark size={portrait ? 120 : 150} pulse sparkles />
          </div>

          <div style={{ transform: `translateY(${(1 - markS) * 40}px) scale(${0.86 + markS * 0.14})`, opacity: Math.min(1, markS * 1.3) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <span style={{ fontFamily: FONT, fontSize: markSize * 0.34, fontWeight: 600, color: COLORS.inkSoft, letterSpacing: "-0.01em" }}>Meet</span>
              <Wordmark size={markSize} withSpark={false} />
            </div>
          </div>

          <Reveal delay={28} y={24} blur={6}>
            <div style={{ fontFamily: FONT, fontSize: portrait ? 40 : 46, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.01em", textAlign: "center" }}>
              Your AI <span style={{ color: COLORS.glow, textShadow: GLOW.ambient(COLORS.glow) }}>mini-teacher.</span>
            </div>
          </Reveal>

          <Reveal delay={48} y={18}>
            <div style={{ fontFamily: FONT, fontSize: portrait ? 27 : 30, fontWeight: 500, color: COLORS.inkFaint, textAlign: "center", maxWidth: portrait ? 700 : 900 }}>
              It teaches you the moment new tech appears — right where you work.
            </div>
          </Reveal>
        </Center>
      </Camera>
    </AbsoluteFill>
  );
};

// ── shared: a feature beat shell (eyebrow + headline + visual, synced flash) ───
const FeatureBeat: React.FC<{
  dur: number;
  index: number;
  eyebrow: string;
  headline: string;
  accentWord: string;
  accentColor?: string;
  children: React.ReactNode;
}> = ({ dur, index, eyebrow, headline, accentWord, accentColor = COLORS.glow, children }) => {
  const frame = useCurrentFrame();
  const { portrait } = useStage();
  const op = sceneFade(frame, dur, 6, 10);
  const flash = hitEnv(frame, 0, 16); // ignition at this beat's downbeat

  const h1 = portrait ? 56 : 70;

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Bloom progress={flash * 0.8} color={accentColor} size={portrait ? 900 : 1200} style={{ left: "50%", top: portrait ? "40%" : "50%" }} />
      <Center style={{ gap: portrait ? 34 : 44, padding: 50 }}>
        <Reveal delay={2} y={18}>
          <div style={eyebrowStyle(portrait ? 19 : 22)}>
            <span style={{ opacity: 0.6 }}>0{index + 1} — </span>
            {eyebrow}
          </div>
        </Reveal>
        <Reveal delay={6} y={24} blur={6}>
          <div style={{ textAlign: "center", maxWidth: portrait ? 900 : 1300 }}>
            <KineticHeadline
              text={headline}
              accentWord={accentWord}
              accentColor={accentColor}
              stagger={3}
              style={{ fontFamily: FONT, fontSize: h1, fontWeight: 800, color: COLORS.ink, letterSpacing: "-0.025em", justifyContent: "center" }}
            />
          </div>
        </Reveal>
        <Reveal delay={16} y={34} blur={8} scale={0.97}>
          {children}
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

// brand-tinted tool chip (name + dot) — no external logo assets
const TOOLS: { name: string; color: string }[] = [
  { name: "Claude Code", color: COLORS.amberDeep },
  { name: "Codex", color: COLORS.ink },
  { name: "Cursor", color: COLORS.blue },
  { name: "Gemini", color: COLORS.lavender },
  { name: "Copilot", color: COLORS.teal },
  { name: "OpenCode", color: COLORS.glow },
];

const ToolChip: React.FC<{ name: string; color: string }> = ({ name, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "16px 28px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.04)",
      border: `1.5px solid ${color}66`,
      boxShadow: `0 0 26px ${color}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
      fontFamily: FONT,
      fontSize: 30,
      fontWeight: 600,
      color: COLORS.ink,
      whiteSpace: "nowrap",
    }}
  >
    <span style={{ width: 14, height: 14, borderRadius: "50%", background: color, boxShadow: `0 0 14px ${color}` }} />
    {name}
  </div>
);

// ── SCENE 3 — FEATURE MONTAGE (11–20s) ────────────────────────────────────────
const SceneFeatures: React.FC = () => {
  const { width, portrait } = useStage();
  const cardW = Math.min(width * 0.86, portrait ? 880 : 820);
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* ① teaches you inline as you build */}
      <Sequence from={FEATURE_BEATS[0].from} durationInFrames={FEATURE_BEATS[0].dur} layout="none">
        <FeatureBeat dur={FEATURE_BEATS[0].dur} index={0} eyebrow="Learn in the flow" headline="It teaches you as you build." accentWord="teaches">
          <LessonCard
            concept="Environment variable"
            explanation="A setting kept outside your code — like a secret note the app reads at startup, so passwords never live in the code itself."
            why="it keeps your keys safe and your app easy to configure."
            width={cardW}
            reveal={1}
          />
        </FeatureBeat>
      </Sequence>

      {/* ② works in every AI tool */}
      <Sequence from={FEATURE_BEATS[1].from} durationInFrames={FEATURE_BEATS[1].dur} layout="none">
        <FeatureBeat dur={FEATURE_BEATS[1].dur} index={1} eyebrow="Wherever you build" headline="Works in every AI tool." accentWord="every" accentColor={COLORS.teal}>
          <StaggerGroup each={4} delay={2} spring={SPRING.pop} style={{ display: "flex", flexWrap: "wrap", gap: portrait ? 16 : 20, justifyContent: "center", maxWidth: portrait ? 900 : 1180 }}>
            {TOOLS.map((t, i) => (
              <StaggerItem key={t.name} index={i} y={26}>
                <ToolChip name={t.name} color={t.color} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </FeatureBeat>
      </Sequence>

      {/* ③ remembers what you learn */}
      <Sequence from={FEATURE_BEATS[2].from} durationInFrames={FEATURE_BEATS[2].dur} layout="none">
        <FeatureBeat dur={FEATURE_BEATS[2].dur} index={2} eyebrow="It remembers" headline="Never re-taught. Always growing." accentWord="growing" accentColor={COLORS.lavender}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
            <ProgressShelf
              concepts={[{ label: "Git commit" }, { label: "API" }, { label: "JWT" }, { label: "Migration" }, { label: "OAuth" }, { label: "Cache" }]}
              revealed={interpolate(frame, [FEATURE_BEATS[2].from + 6, FEATURE_BEATS[2].from + 70], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
              width={Math.min(width * 0.88, portrait ? 920 : 1040)}
            />
            <div style={{ display: "flex", gap: 22, alignItems: "center", fontFamily: FONT }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: portrait ? 60 : 72, fontWeight: 800, color: COLORS.glow, textShadow: GLOW.ambient(COLORS.glow) }}>
                  <CountUp to={92} durationInFrames={70} />
                </span>
                <span style={{ fontSize: portrait ? 26 : 30, fontWeight: 600, color: COLORS.inkSoft }}>concepts learned</span>
              </div>
              <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.12)" }} />
              <div style={{ fontSize: portrait ? 30 : 34, fontWeight: 700, color: COLORS.teal }}>
                <SparkStar size={22} color={COLORS.teal} /> 7-day streak
              </div>
            </div>
          </div>
        </FeatureBeat>
      </Sequence>
    </AbsoluteFill>
  );
};

// ── SCENE 4 — PAYOFF (20–27s): 4th feature + the line ─────────────────────────
const ScenePayoff: React.FC = () => {
  const { width, portrait } = useStage();

  return (
    <AbsoluteFill>
      {/* ④ tells you what to build next */}
      <Sequence from={PAYOFF_BEATS[0].from} durationInFrames={PAYOFF_BEATS[0].dur} layout="none">
        <PayoffNext dur={PAYOFF_BEATS[0].dur} width={width} portrait={portrait} />
      </Sequence>

      {/* the emotional one-liner into the CTA */}
      <Sequence from={PAYOFF_BEATS[1].from} durationInFrames={PAYOFF_BEATS[1].dur} layout="none">
        <PayoffLine dur={PAYOFF_BEATS[1].dur} portrait={portrait} />
      </Sequence>
    </AbsoluteFill>
  );
};

const PayoffNext: React.FC<{ dur: number; width: number; portrait: boolean }> = ({ dur, width, portrait }) => {
  const frame = useCurrentFrame();
  const op = sceneFade(frame, dur, 6, 12);
  const flash = hitEnv(frame, 0, 18); // lands on the 20s lift impact
  const cardW = Math.min(width * 0.86, portrait ? 900 : 880);

  const steps = [
    { t: "Add a few tests", w: "so changes don't break what works" },
    { t: "Save your work with Git", w: "a snapshot you can always return to" },
    { t: "Deploy it", w: "put it online for real people to use" },
  ];

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Bloom progress={flash * 0.7} color={COLORS.glow} size={portrait ? 1000 : 1300} style={{ left: "50%", top: "46%" }} />
      <Center style={{ gap: portrait ? 30 : 38, padding: 50 }}>
        <Reveal delay={2} y={18}>
          <div style={eyebrowStyle(portrait ? 19 : 22)}>
            <span style={{ opacity: 0.6 }}>04 — </span>Keep going
          </div>
        </Reveal>
        <Reveal delay={6} y={24} blur={6}>
          <div style={{ textAlign: "center" }}>
            <KineticHeadline
              text="It tells you what to build next."
              accentWord="next"
              accentColor={COLORS.glow}
              stagger={3}
              style={{ fontFamily: FONT, fontSize: portrait ? 54 : 68, fontWeight: 800, color: COLORS.ink, letterSpacing: "-0.025em", justifyContent: "center" }}
            />
          </div>
        </Reveal>
        <Reveal delay={16} y={30} blur={8} scale={0.97}>
          <div
            style={{
              width: cardW,
              borderRadius: 22,
              padding: portrait ? "28px 30px" : "32px 38px",
              background: "linear-gradient(160deg, rgba(28,34,78,0.92), rgba(16,20,48,0.92))",
              border: `1.5px solid ${COLORS.cardBorder}`,
              boxShadow: "0 30px 90px rgba(0,0,0,0.5), 0 0 60px rgba(255,179,71,0.1)",
              fontFamily: FONT,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <SparkStar size={24} color={COLORS.glow} />
              <span style={{ fontFamily: MONO, fontSize: portrait ? 24 : 27, color: COLORS.teal, fontWeight: 600 }}>lumi next</span>
            </div>
            <StaggerGroup each={7} delay={22} spring={SPRING.enter} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {steps.map((s, i) => (
                <StaggerItem key={s.t} index={i} y={20}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{ color: COLORS.glow, fontSize: portrait ? 26 : 30, fontWeight: 800, lineHeight: 1.2 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: portrait ? 28 : 32, fontWeight: 700, color: COLORS.ink }}>{s.t}</div>
                      <div style={{ fontSize: portrait ? 22 : 24, color: COLORS.inkSoft, marginTop: 2 }}>— {s.w}</div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

const PayoffLine: React.FC<{ dur: number; portrait: boolean }> = ({ dur, portrait }) => {
  const frame = useCurrentFrame();
  const op = sceneFade(frame, dur, 8, 8);
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Camera push={[1.0, 1.04]} drift={3}>
        <Center style={{ padding: 60 }}>
          <div style={{ textAlign: "center", maxWidth: portrait ? 940 : 1500 }}>
            <KineticHeadline
              text="From copy-paste to actually understanding."
              accentWord="understanding"
              accentColor={COLORS.glow}
              stagger={4}
              style={{ fontFamily: FONT, fontSize: portrait ? 58 : 78, fontWeight: 800, color: COLORS.ink, letterSpacing: "-0.03em", lineHeight: 1.06, justifyContent: "center" }}
            />
          </div>
        </Center>
      </Camera>
    </AbsoluteFill>
  );
};

// ── SCENE 5 — LOGO + CTA (27–30s) — final impact + hook resolve ───────────────
const SceneCta: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait } = useStage();
  const op = sceneFade(frame, dur, 0, 8);

  const flash = hitEnv(frame, 0, 16);
  const markS = spring({ frame, fps, config: SPRING.pop });
  const pulse = beatPulse(frame, 15, 7); // synced breath on the held logo

  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Center style={{ gap: portrait ? 30 : 36 }}>
        <Bloom progress={Math.max(flash, 0.3)} color={COLORS.glow} size={portrait ? 1200 : 1600} style={{ left: "50%", top: "42%" }} />

        <div style={{ transform: `scale(${(0.7 + markS * 0.3) * (1 + pulse * 0.012)})`, opacity: markS }}>
          <Wordmark size={portrait ? 168 : 200} withSpark />
        </div>

        <Reveal delay={18} y={20}>
          <div style={{ fontFamily: FONT, fontSize: portrait ? 42 : 50, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.01em" }}>
            Learn as you <span style={{ color: COLORS.glow, textShadow: GLOW.ambient(COLORS.glow) }}>build.</span>
          </div>
        </Reveal>

        <Reveal delay={34} y={16} scale={0.98}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 28px",
              borderRadius: 14,
              background: "rgba(8,11,28,0.85)",
              border: `1px solid ${COLORS.cardBorder}`,
              boxShadow: `0 0 40px ${COLORS.glow}22`,
              fontFamily: MONO,
              fontSize: portrait ? 28 : 32,
            }}
          >
            <span style={{ color: COLORS.glow }}>▸</span>
            <span style={{ color: COLORS.ink }}>
              <TypeOn text="npm i -g lumi" speed={3} cursor />
            </span>
          </div>
        </Reveal>

        <Reveal delay={50} y={14}>
          <div style={{ fontFamily: FONT, fontSize: portrait ? 22 : 24, fontWeight: 500, color: COLORS.inkFaint, textAlign: "center" }}>
            Claude Code · Codex · Cursor · Gemini · Copilot · OpenCode
          </div>
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

// ── MASTER COMPOSITION ────────────────────────────────────────────────────────
// One timeline → registered at 16:9, 1:1 and 9:16 in Root.tsx.
export const LumiLaunch: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg0 }}>
      <Audio src={staticFile("audio/soundtrack.wav")} />

      {/* continuous background (global frame → unbroken drift/grain) */}
      <Background intensity={1} />

      <Sequence from={SCENE.hook.from} durationInFrames={SCENE.hook.dur} layout="none">
        <SceneHook dur={SCENE.hook.dur} />
      </Sequence>
      <Sequence from={SCENE.reveal.from} durationInFrames={SCENE.reveal.dur} layout="none">
        <SceneReveal dur={SCENE.reveal.dur} />
      </Sequence>
      <Sequence from={SCENE.features.from} durationInFrames={SCENE.features.dur} layout="none">
        <SceneFeatures />
      </Sequence>
      <Sequence from={SCENE.payoff.from} durationInFrames={SCENE.payoff.dur} layout="none">
        <ScenePayoff />
      </Sequence>
      <Sequence from={SCENE.cta.from} durationInFrames={SCENE.cta.dur} layout="none">
        <SceneCta dur={SCENE.cta.dur} />
      </Sequence>
    </AbsoluteFill>
  );
};
