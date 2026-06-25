# Lumi Dark Warm Glow Refresh + Two Remotion Videos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin Lumi to a "Dark Warm Glow" brand (espresso + amber + cream) across the VS Code panel welcome, the Marketplace README, and a new standalone web landing page — each fronted by a looping Remotion video produced from the existing `marketing/video/` project.

**Architecture:** One shared token set drives all surfaces. The existing Remotion project is re-themed (indigo→espresso) and extended with a new short **IDE loop** composition plus a re-themed/re-timed **web hero** that adds a dedicated security beat. Rendered assets are committed into `vscode-extension/media/` (panel + marketplace GIF) and `web-landing/assets/` (web hero). The panel/README/web-landing markup is rebuilt on the shared tokens.

**Tech Stack:** Remotion 4 (React 19), TypeScript, esbuild (extension bundle), vitest, plain HTML/CSS/JS (web landing).

**Spec:** `docs/superpowers/specs/2026-06-25-lumi-dark-warm-refresh-and-videos-design.md`

**Branch:** `feat/dark-warm-refresh-videos` (already created).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `marketing/video/src/theme.ts` | Dark-warm `COLORS` + new `cardSurface()`/`panelSurface()` helpers (single source for the video). |
| `marketing/video/src/components/SecurityScan.tsx` | NEW. Reusable "leaked secret → shield sweep → A–F grade" visual (used by IDE loop + web hero). |
| `marketing/video/src/LumiIdeLoop.tsx` | NEW. 5-beat ~14s seamless loop composition. |
| `marketing/video/src/Root.tsx` | Register `LumiIdeLoopSquare` (1080²) + `LumiIdeLoopWide` (1920×1080). |
| `marketing/video/src/LumiLaunch.tsx`, `components/LessonCard.tsx` | Replace hardcoded indigo `rgba()` literals with token helpers; insert security beat. |
| `marketing/video/package.json` | Render scripts for both videos + GIF. |
| `marketing/video/scripts/copy-assets.mjs` | NEW. Copy rendered assets into the consuming surfaces. |
| `vscode-extension/media/tokens.css` | NEW. Shared dark-warm CSS custom properties. |
| `vscode-extension/media/panel.css` | Re-skin whole panel to tokens + welcome hero. |
| `vscode-extension/media/panel.html` | Welcome hero markup + CSP `media-src`. |
| `vscode-extension/media/panel.js` | Welcome "Get started" interaction. |
| `vscode-extension/src/panelView.ts` | CSP already built in `panelUtils`; assert `media-src` (see Task 9). |
| `vscode-extension/src/panelUtils.ts` | Add `media-src` to CSP. |
| `vscode-extension/README.md` | Hero GIF + dark-warm copy. |
| `web-landing/{index.html,tokens.css,styles.css,main.js,assets/}` | NEW standalone landing page. |

**Token values (authoritative — use everywhere):**

```
bg0   #1F160A   bg1 #2E2113   bg2 #3A2A12
ink   #FFF1D6   inkSoft #D8C49A   inkFaint #9A865E
glow  #FFC24B   glowHot #E89A1C   amberDeep #FF8A4C
teal  #5EE7C9   lavender #C9A24B   blue #E0A93E
danger #FF6B57
cardBg    rgba(51,38,15,0.72)
cardBorder rgba(255,194,75,0.22)
panel     rgba(20,14,6,0.82)
```

(Note: `teal` is kept for the existing "learned/streak" accents; `lavender`/`blue` are repurposed to warm ambers so no cold hues remain.)

---

## Phase 1 — Shared theme tokens

### Task 1: Re-theme the Remotion color tokens

**Files:**
- Modify: `marketing/video/src/theme.ts`

- [ ] **Step 1: Replace the `COLORS` object and add surface helpers**

Replace the existing `export const COLORS = {…}` block (and the `GLOW_GRADIENT` line) with:

```ts
export const COLORS = {
  bg0: "#1F160A",
  bg1: "#2E2113",
  bg2: "#3A2A12",
  ink: "#FFF1D6",
  inkSoft: "#D8C49A",
  inkFaint: "#9A865E",
  glow: "#FFC24B",      // Lumi amber
  glowHot: "#E89A1C",
  amberDeep: "#FF8A4C",
  teal: "#5EE7C9",      // kept for "learned"/streak success accents
  lavender: "#C9A24B",  // warmed (was cold violet)
  blue: "#E0A93E",      // warmed (was cold blue)
  danger: "#FF6B57",
  cardBg: "rgba(51, 38, 15, 0.72)",
  cardBorder: "rgba(255, 194, 75, 0.22)",
  panel: "rgba(20, 14, 6, 0.82)",
} as const;

/** Card surface gradient — derive from tokens so re-themes touch one place. */
export const cardSurface = () =>
  "linear-gradient(160deg, rgba(51,38,15,0.94) 0%, rgba(31,22,10,0.94) 100%)";

export const GLOW_GRADIENT = `linear-gradient(135deg, ${COLORS.glow} 0%, ${COLORS.amberDeep} 60%, ${COLORS.glowHot} 120%)`;
```

- [ ] **Step 2: Verify the studio still compiles**

Run: `cd marketing/video && npx remotion compositions`
Expected: lists `LumiLaunch`, `LumiPromo`, etc. with no TypeScript error.

- [ ] **Step 3: Commit**

```bash
git add marketing/video/src/theme.ts
git commit -m "feat(video): re-theme tokens to dark warm glow"
```

### Task 2: Replace hardcoded indigo literals in components

**Files:**
- Modify: `marketing/video/src/components/LessonCard.tsx:27-28`
- Modify: `marketing/video/src/LumiLaunch.tsx` (PayoffNext card bg ~line 369; SceneCta code-chip bg ~line 455)

- [ ] **Step 1: Point LessonCard at the token helper**

In `LessonCard.tsx`, add `cardSurface` to the import from `../theme`:
```ts
import { COLORS, FONT, cardSurface } from "../theme";
```
Replace the `background: "linear-gradient(160deg, rgba(28,34,78,0.92) 0%, rgba(16,20,48,0.92) 100%)",` line with:
```ts
        background: cardSurface(),
```

- [ ] **Step 2: Replace the two indigo literals in LumiLaunch.tsx**

Add `cardSurface` to the `./theme` import line. Then:
- In `PayoffNext`, replace `background: "linear-gradient(160deg, rgba(28,34,78,0.92), rgba(16,20,48,0.92))",` with `background: cardSurface(),`.
- In `SceneCta`, replace `background: "rgba(8,11,28,0.85)",` with `background: COLORS.panel,`.

- [ ] **Step 3: Grep for any remaining cold literals**

Run: `cd marketing/video && grep -rEn "rgba\(([0-9]+),\s*([0-9]+),\s*([0-9]+)" src | grep -viE "255|0,0,0|cardSurface"`
Expected: review hits; any `rgb` where blue ≫ red (cold indigo, e.g. `28,34,78`) must be gone. Replace stragglers in `components/Background.tsx`, `ProgressShelf.tsx`, `Terminal.tsx`, `ui.tsx` with `COLORS.bg1`/`COLORS.panel`/`cardSurface()` as appropriate.

- [ ] **Step 4: Render one still to eyeball the palette**

Run: `cd marketing/video && npx remotion still LumiLaunch out/check.png --frame=200`
Expected: `out/check.png` exists and is warm espresso/amber (no blue). Open it to confirm.

- [ ] **Step 5: Commit**

```bash
git add marketing/video/src
git commit -m "refactor(video): drive component surfaces from theme tokens"
```

---

## Phase 2 — The reusable security visual

### Task 3: Build the `SecurityScan` component

**Files:**
- Create: `marketing/video/src/components/SecurityScan.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT, MONO, GLOW, EASE, SPRING, cardSurface } from "../theme";

/**
 * Security lens beat: a leaked-secret line, a shield "scan" sweep across it,
 * a plain-English risk flag, and an A–F grade that settles from C to A.
 * `from` is the LOCAL frame the beat starts (default 0). Self-contained.
 */
export const SecurityScan: React.FC<{ width?: number; from?: number }> = ({
  width = 820,
  from = 0,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();

  const cardS = spring({ frame, fps, config: SPRING.enter });
  // scan sweep 0→1 across frames 10..40
  const sweep = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });
  // flag appears after the sweep
  const flag = interpolate(frame, [42, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // grade lifts C(0)→A(1) late in the beat
  const fix = interpolate(frame, [64, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const grade = fix < 0.5 ? "C" : fix < 0.9 ? "B" : "A";
  const gradeColor = fix < 0.5 ? COLORS.danger : fix < 0.9 ? COLORS.glowHot : COLORS.teal;

  return (
    <div
      style={{
        width,
        transform: `translateY(${(1 - cardS) * 30}px) scale(${0.96 + cardS * 0.04})`,
        opacity: cardS,
        borderRadius: 22,
        padding: "30px 34px",
        background: cardSurface(),
        border: `1.5px solid ${COLORS.cardBorder}`,
        boxShadow: "0 30px 90px rgba(0,0,0,0.5), 0 0 60px rgba(255,194,75,0.10)",
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* code line with the leaked secret */}
      <div
        style={{
          position: "relative",
          fontFamily: MONO,
          fontSize: 28,
          color: COLORS.danger,
          background: "rgba(42,18,12,0.9)",
          border: "1px solid rgba(255,107,87,0.3)",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 22,
          overflow: "hidden",
        }}
      >
        apiKey = "sk-live-9f2a7c…"
        {/* scan sweep bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweep * 100}%`,
            width: 90,
            transform: "translateX(-50%)",
            background: `linear-gradient(90deg, transparent, ${COLORS.glow}88, transparent)`,
            opacity: sweep > 0 && sweep < 1 ? 1 : 0,
          }}
        />
      </div>

      {/* flag row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: flag, transform: `translateY(${(1 - flag) * 10}px)` }}>
        <span style={{ fontSize: 34 }}>🛡️</span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.danger,
            background: "rgba(255,107,87,0.14)",
            border: "1px solid rgba(255,107,87,0.3)",
            borderRadius: 999,
            padding: "8px 18px",
          }}
        >
          Secret exposed in frontend code
        </span>
        <span style={{ marginLeft: "auto", fontSize: 22, color: COLORS.inkFaint }}>safety grade</span>
        <span style={{ fontSize: 56, fontWeight: 800, color: gradeColor, textShadow: GLOW.ambient(gradeColor), minWidth: 56, textAlign: "center" }}>
          {grade}
        </span>
      </div>

      <div style={{ marginTop: 16, fontSize: 22, color: COLORS.inkSoft, opacity: flag }}>
        Move it to an environment variable — out of the browser, off the repo.
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify it type-checks via a still**

Add a throwaway use is unnecessary; instead just confirm the project compiles:
Run: `cd marketing/video && npx tsc --noEmit -p tsconfig.json`
Expected: no errors (the file is imported in Task 4/6).

- [ ] **Step 3: Commit**

```bash
git add marketing/video/src/components/SecurityScan.tsx
git commit -m "feat(video): reusable SecurityScan beat component"
```

---

## Phase 3 — The IDE loop composition

### Task 4: Create `LumiIdeLoop`

**Files:**
- Create: `marketing/video/src/LumiIdeLoop.tsx`

- [ ] **Step 1: Write the composition (5 beats, fade in/out to bg0 for a seamless loop, muted)**

```tsx
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
import { LumiSpark } from "./components/LumiSpark";
import { Wordmark } from "./components/Wordmark";
import { SecurityScan } from "./components/SecurityScan";
import { Center, Reveal } from "./components/ui";

// 14s @ 30fps. Beats tile [0, LOOP].
export const LOOP = 420;
const BEATS = {
  hook: { from: 0, dur: 84 },
  teach: { from: 84, dur: 108 },
  remember: { from: 192, dur: 84 },
  safe: { from: 276, dur: 96 },
  resolve: { from: 372, dur: 48 },
} as const;

const useStage = () => {
  const { width, height } = useVideoConfig();
  return { width, height, portrait: height > width * 1.08, square: Math.abs(width - height) < width * 0.08 };
};

const fade = (frame: number, dur: number, inN = 8, outN = 10) =>
  Math.min(
    interpolate(frame, [0, inN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [dur - outN, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width } = useStage();
  const lines: Line[] = [
    { kind: "prompt", text: "> add login" },
    { kind: "claude", text: "Storing the API key…", highlight: "API key" },
    { kind: "code", text: 'const key = process.env.API_KEY' },
  ];
  const visible = Math.min(lines.length, Math.floor(frame / 12) + 1);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 28, padding: 40 }}>
        <Terminal lines={lines} visibleLines={visible} width={Math.min(width * 0.88, 760)} fontSize={26} title="your AI tool" />
        <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, color: COLORS.inkSoft }}>Your AI just wrote this.</div>
      </Center>
    </AbsoluteFill>
  );
};

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
            reveal={interpolate(frame, [6, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};

const TOOLS = ["Claude Code", "Cursor", "Copilot", "Codex"];
const Remember: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 30, padding: 40 }}>
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: COLORS.ink }}>Remembered across every tool</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 820 }}>
          {TOOLS.map((t, i) => {
            const s = spring({ frame: frame - 6 - i * 6, fps, config: SPRING.pop });
            return (
              <span key={t} style={{
                transform: `scale(${0.8 + s * 0.2})`, opacity: s,
                fontFamily: FONT, fontSize: 28, fontWeight: 600, color: COLORS.glow,
                background: "rgba(255,194,75,0.12)", border: `1.5px solid ${COLORS.cardBorder}`,
                borderRadius: 999, padding: "12px 26px",
              }}>{t}</span>
            );
          })}
        </div>
      </Center>
    </AbsoluteFill>
  );
};

const Safe: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width } = useStage();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur) }}>
      <Center style={{ gap: 22, padding: 40 }}>
        <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 800, color: COLORS.ink }}>And catches the risky bits.</div>
        <SecurityScan width={Math.min(width * 0.9, 820)} />
      </Center>
    </AbsoluteFill>
  );
};

const Resolve: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: SPRING.pop });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, dur, 8, 14) }}>
      <Center style={{ gap: 18 }}>
        <div style={{ transform: `scale(${0.8 + s * 0.2})` }}><Wordmark size={140} withSpark /></div>
        <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 600, color: COLORS.ink }}>
          Understand what you <span style={{ color: COLORS.glow, textShadow: GLOW.ambient(COLORS.glow) }}>build.</span>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

/** No <Audio> — the loop ships muted on every surface. */
export const LumiIdeLoop: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg0 }}>
    <Background intensity={0.8} />
    <Sequence from={BEATS.hook.from} durationInFrames={BEATS.hook.dur} layout="none"><Hook dur={BEATS.hook.dur} /></Sequence>
    <Sequence from={BEATS.teach.from} durationInFrames={BEATS.teach.dur} layout="none"><Teach dur={BEATS.teach.dur} /></Sequence>
    <Sequence from={BEATS.remember.from} durationInFrames={BEATS.remember.dur} layout="none"><Remember dur={BEATS.remember.dur} /></Sequence>
    <Sequence from={BEATS.safe.from} durationInFrames={BEATS.safe.dur} layout="none"><Safe dur={BEATS.safe.dur} /></Sequence>
    <Sequence from={BEATS.resolve.from} durationInFrames={BEATS.resolve.dur} layout="none"><Resolve dur={BEATS.resolve.dur} /></Sequence>
  </AbsoluteFill>
);
```

> If `Terminal`'s `Line.kind` union or `LessonCard`/`Wordmark`/`LumiSpark` props differ from the above, open each component and adjust prop names to match — do not invent props.

- [ ] **Step 2: Commit**

```bash
git add marketing/video/src/LumiIdeLoop.tsx
git commit -m "feat(video): LumiIdeLoop short looping composition"
```

### Task 5: Register the IDE loop in two crops

**Files:**
- Modify: `marketing/video/src/Root.tsx`

- [ ] **Step 1: Add imports + compositions**

Add near the other imports:
```tsx
import { LumiIdeLoop, LOOP } from "./LumiIdeLoop";
```
Add inside the `<>` fragment (before `LumiPromo`):
```tsx
      {/* ── LumiIdeLoop — short seamless loop for the VS Code panel / marketplace ── */}
      <Composition id="LumiIdeLoopSquare" component={LumiIdeLoop} durationInFrames={LOOP} fps={FPS} width={1080} height={1080} />
      <Composition id="LumiIdeLoopWide" component={LumiIdeLoop} durationInFrames={LOOP} fps={FPS} width={1920} height={1080} />
```

- [ ] **Step 2: Verify both compositions are listed**

Run: `cd marketing/video && npx remotion compositions`
Expected: output includes `LumiIdeLoopSquare` and `LumiIdeLoopWide`.

- [ ] **Step 3: Commit**

```bash
git add marketing/video/src/Root.tsx
git commit -m "feat(video): register IDE loop in square + wide crops"
```

---

## Phase 4 — Web hero (re-theme + security beat)

### Task 6: Insert the security beat into the web hero

**Files:**
- Modify: `marketing/video/src/LumiLaunch.tsx`

The existing `ScenePayoff` runs two sub-beats (`PayoffNext`, `PayoffLine`) over `SCENE.payoff` (frames 600–810). Replace the **first** payoff sub-beat ("what to build next") with the security beat so "Stay Safe" gets prime, late-video screen time (the wedge). Keep `PayoffLine`.

- [ ] **Step 1: Import SecurityScan**

Add to the top imports:
```tsx
import { SecurityScan } from "./components/SecurityScan";
```

- [ ] **Step 2: Replace the `PayoffNext` sequence body**

In `ScenePayoff`, replace the first `<Sequence>` block (the one rendering `<PayoffNext .../>`) with:
```tsx
      {/* ④ catches the risky bits — the security wedge */}
      <Sequence from={PAYOFF_BEATS[0].from} durationInFrames={PAYOFF_BEATS[0].dur} layout="none">
        <PayoffSafe dur={PAYOFF_BEATS[0].dur} width={width} portrait={portrait} />
      </Sequence>
```

- [ ] **Step 3: Add the `PayoffSafe` component**

Add this near `PayoffNext` (you may delete `PayoffNext` if now unused, or leave it — but remove its import usage):
```tsx
const PayoffSafe: React.FC<{ dur: number; width: number; portrait: boolean }> = ({ dur, width, portrait }) => {
  const frame = useCurrentFrame();
  const op = sceneFade(frame, dur, 6, 12);
  const flash = hitEnv(frame, 0, 18);
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Bloom progress={flash * 0.7} color={COLORS.danger} size={portrait ? 1000 : 1300} style={{ left: "50%", top: "46%" }} />
      <Center style={{ gap: portrait ? 30 : 38, padding: 50 }}>
        <Reveal delay={2} y={18}>
          <div style={eyebrowStyle(portrait ? 19 : 22)}><span style={{ opacity: 0.6 }}>04 — </span>Stay safe</div>
        </Reveal>
        <Reveal delay={6} y={24} blur={6}>
          <div style={{ textAlign: "center" }}>
            <KineticHeadline text="It catches the risky bits." accentWord="risky" accentColor={COLORS.danger} stagger={3}
              style={{ fontFamily: FONT, fontSize: portrait ? 54 : 68, fontWeight: 800, color: COLORS.ink, letterSpacing: "-0.025em", justifyContent: "center" }} />
          </div>
        </Reveal>
        <Reveal delay={16} y={30} blur={8} scale={0.97}>
          <SecurityScan width={Math.min(width * 0.86, portrait ? 900 : 880)} from={0} />
        </Reveal>
      </Center>
    </AbsoluteFill>
  );
};
```

> `SecurityScan`'s internal animation reads its own local frame; wrapping it in a `Sequence`/`Reveal` is fine because `useCurrentFrame()` is sequence-local.

- [ ] **Step 4: Render the payoff window to verify the beat reads**

Run: `cd marketing/video && npx remotion still LumiLaunch out/safe.png --frame=660`
Expected: `out/safe.png` shows the security card with the red flag + grade. Open to confirm.

- [ ] **Step 5: Commit**

```bash
git add marketing/video/src/LumiLaunch.tsx
git commit -m "feat(video): swap web-hero payoff for the security wedge beat"
```

---

## Phase 5 — Render + distribute assets

### Task 7: Add render + copy scripts

**Files:**
- Modify: `marketing/video/package.json`
- Create: `marketing/video/scripts/copy-assets.mjs`

- [ ] **Step 1: Add scripts to `package.json`**

Add these entries to the `"scripts"` object:
```json
    "ide:square": "remotion render LumiIdeLoopSquare out/lumi-ide-1x1.mp4 --concurrency=4",
    "ide:wide": "remotion render LumiIdeLoopWide out/lumi-ide-16x9.mp4 --concurrency=4",
    "ide:webm": "remotion render LumiIdeLoopSquare out/lumi-ide-1x1.webm --codec=vp9 --concurrency=4",
    "ide:poster": "remotion still LumiIdeLoopSquare out/lumi-ide-poster.jpg --frame=120",
    "ide:gif": "remotion render LumiIdeLoopWide out/lumi-ide.gif --codec=gif --every-nth-frame=2 --concurrency=4",
    "hero:mp4": "remotion render LumiLaunch out/lumi-hero-16x9.mp4 --concurrency=4",
    "hero:webm": "remotion render LumiLaunch out/lumi-hero-16x9.webm --codec=vp9 --concurrency=4",
    "hero:poster": "remotion still LumiLaunch out/lumi-hero-poster.jpg --frame=210",
    "render:all": "npm run ide:square && npm run ide:webm && npm run ide:poster && npm run ide:gif && npm run hero:mp4 && npm run hero:webm && npm run hero:poster",
    "assets:copy": "node scripts/copy-assets.mjs"
```

- [ ] **Step 2: Write the copy script**

```js
// marketing/video/scripts/copy-assets.mjs
// Copy rendered media into the surfaces that ship them.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repo = resolve(root, "..", "..");

const jobs = [
  ["out/lumi-ide-1x1.mp4", "vscode-extension/media/lumi-ide-1x1.mp4"],
  ["out/lumi-ide-1x1.webm", "vscode-extension/media/lumi-ide-1x1.webm"],
  ["out/lumi-ide-poster.jpg", "vscode-extension/media/lumi-ide-poster.jpg"],
  ["out/lumi-ide.gif", "vscode-extension/media/lumi-ide.gif"],
  ["out/lumi-hero-16x9.mp4", "web-landing/assets/lumi-hero-16x9.mp4"],
  ["out/lumi-hero-16x9.webm", "web-landing/assets/lumi-hero-16x9.webm"],
  ["out/lumi-hero-poster.jpg", "web-landing/assets/lumi-hero-poster.jpg"],
];

let missing = 0;
for (const [src, dest] of jobs) {
  const s = resolve(root, src);
  const d = resolve(repo, dest);
  if (!existsSync(s)) { console.warn("MISSING (run render first):", src); missing++; continue; }
  mkdirSync(dirname(d), { recursive: true });
  copyFileSync(s, d);
  console.log("copied", dest);
}
process.exit(missing ? 1 : 0);
```

- [ ] **Step 3: Render everything (long-running) then copy**

Run: `cd marketing/video && npm install && npm run render:all && npm run assets:copy`
Expected: all `out/*` files produced; copy step prints "copied …" for all 7 targets and exits 0. (If a render is slow, render `ide:*` first — those unblock the panel work.)

- [ ] **Step 4: Confirm panel asset size is sane**

Run: `ls -lh marketing/video/out/lumi-ide-1x1.mp4`
Expected: well under ~3 MB. If larger, lower bitrate: append `--crf=30` to the `ide:square` script and re-render.

- [ ] **Step 5: Commit the committed assets + scripts**

```bash
git add marketing/video/package.json marketing/video/scripts/copy-assets.mjs
git add vscode-extension/media/lumi-ide-1x1.mp4 vscode-extension/media/lumi-ide-1x1.webm vscode-extension/media/lumi-ide-poster.jpg vscode-extension/media/lumi-ide.gif
git commit -m "feat(video): render scripts + commit panel/marketplace assets"
```

> `web-landing/assets/*` are committed in Task 13 with the rest of the landing page.

---

## Phase 6 — VS Code panel re-skin + welcome hero

### Task 8: Shared CSS tokens

**Files:**
- Create: `vscode-extension/media/tokens.css`

- [ ] **Step 1: Write the tokens file**

```css
/* Lumi — Dark Warm Glow design tokens (shared with the web landing). */
:root {
  --lumi-bg0: #1F160A;
  --lumi-bg1: #2E2113;
  --lumi-bg2: #3A2A12;
  --lumi-ink: #FFF1D6;
  --lumi-ink-soft: #D8C49A;
  --lumi-ink-faint: #9A865E;
  --lumi-glow: #FFC24B;
  --lumi-glow-hot: #E89A1C;
  --lumi-amber-deep: #FF8A4C;
  --lumi-teal: #5EE7C9;
  --lumi-danger: #FF6B57;
  --lumi-card-bg: rgba(51, 38, 15, 0.72);
  --lumi-card-border: rgba(255, 194, 75, 0.22);
  --lumi-radius: 12px;
  --lumi-ease: cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2: Commit**

```bash
git add vscode-extension/media/tokens.css
git commit -m "feat(panel): shared dark warm glow css tokens"
```

### Task 9: Add `media-src` to the CSP (test-first)

**Files:**
- Test: `vscode-extension/test/panelView.test.ts`
- Modify: `vscode-extension/src/panelUtils.ts`

- [ ] **Step 1: Read the current CSP builder**

Run: `cat vscode-extension/src/panelUtils.ts`
Expected: a `buildHtml(...)` that injects `__CSP_SOURCE__`/`__NONCE__`. Note how CSP is templated (it lives in `panel.html`'s `<meta>` — `panelUtils` substitutes the source). Confirm whether `media-src` must be added in `panel.html` (Task 10) or assembled here.

- [ ] **Step 2: Write a failing test asserting media-src is allowed**

Add to `vscode-extension/test/panelView.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildHtml } from "../src/panelUtils";

describe("panel CSP", () => {
  it("allows media from the webview source so the welcome video can play", () => {
    const raw = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src __CSP_SOURCE__; style-src __CSP_SOURCE__; script-src 'nonce-__NONCE__';"><link href="__CSS__"><script src="__JS__"></script>`;
    const html = buildHtml(raw, "css:uri", "js:uri", "vscode-resource://abc", "NONCE123");
    expect(html).toContain("media-src vscode-resource://abc");
  });
});
```

- [ ] **Step 3: Run it — expect pass already (buildHtml just substitutes __CSP_SOURCE__)**

Run: `cd vscode-extension && npx vitest run test/panelView.test.ts`
Expected: PASS — this test pins the behaviour. (If `buildHtml` does NOT substitute `__CSP_SOURCE__` in `media-src`, fix `panelUtils.ts` so it replaces ALL `__CSP_SOURCE__` occurrences, e.g. `.replaceAll("__CSP_SOURCE__", cspSource)`, then re-run to green.)

- [ ] **Step 4: Commit**

```bash
git add vscode-extension/test/panelView.test.ts vscode-extension/src/panelUtils.ts
git commit -m "test(panel): pin media-src in CSP for the welcome video"
```

### Task 10: Welcome hero markup + CSP in `panel.html`

**Files:**
- Modify: `vscode-extension/media/panel.html`

- [ ] **Step 1: Update the CSP meta to allow media + link the tokens stylesheet**

Replace the `<meta http-equiv="Content-Security-Policy" …>` line with:
```html
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; media-src __CSP_SOURCE__; img-src __CSP_SOURCE__; style-src __CSP_SOURCE__; script-src 'nonce-__NONCE__';">
  <link rel="stylesheet" href="__TOKENS__">
```

- [ ] **Step 2: Add the welcome hero above the tabs**

Immediately inside `<div id="body" class="body">`, before `<nav class="tabs" …>`, insert:
```html
    <section id="welcomeHero" class="welcome-hero">
      <video class="hero-video" autoplay muted loop playsinline
             poster="__HERO_POSTER__" aria-hidden="true">
        <source src="__HERO_WEBM__" type="video/webm">
        <source src="__HERO_MP4__" type="video/mp4">
      </video>
      <div class="hero-copy">
        <h1 class="hero-title">Understand what your AI builds.</h1>
        <p class="hero-sub">Lumi teaches the concept behind each new thing your AI tool does — remembers it, reviews it, and flags risky code.</p>
        <button id="heroStart" class="hero-cta">Get started</button>
      </div>
    </section>
```

- [ ] **Step 3: Note the new template tokens for `panelView.ts`**

This adds `__TOKENS__`, `__HERO_POSTER__`, `__HERO_WEBM__`, `__HERO_MP4__`. They are wired in Task 12.

- [ ] **Step 4: Commit**

```bash
git add vscode-extension/media/panel.html
git commit -m "feat(panel): welcome hero markup + media CSP"
```

### Task 11: Re-skin `panel.css` to dark warm + style the hero

**Files:**
- Modify: `vscode-extension/media/panel.css`

- [ ] **Step 1: Prepend a dark-warm base that overrides the editor theme**

Add at the very top of `panel.css`:
```css
/* Whole panel adopts Lumi's dark warm glow, independent of the editor theme. */
body {
  background: radial-gradient(120% 80% at 80% -10%, var(--lumi-bg2), var(--lumi-bg0) 60%);
  color: var(--lumi-ink);
}
.header { border-bottom: 1px solid var(--lumi-card-border); }
.header .title { color: var(--lumi-ink); }
.tab { color: var(--lumi-ink-soft); }
.tab.active { color: var(--lumi-glow); border-bottom-color: var(--lumi-glow); }
.card { background: var(--lumi-card-bg); border-color: var(--lumi-card-border); }
.action-btn, .actions .ok, .qc-reveal-btn { background: var(--lumi-glow); color: var(--lumi-bg0); border: none; }
.action-btn:hover { background: var(--lumi-glow-hot); }
.tier-pill { background: rgba(255,194,75,0.12); color: var(--lumi-glow); border-color: var(--lumi-card-border); }
```

- [ ] **Step 2: Add the welcome-hero styles**

Append:
```css
/* ── Welcome hero ─────────────────────────────────────────── */
.welcome-hero { position: relative; border-radius: var(--lumi-radius); overflow: hidden; margin: 4px 0 12px; border: 1px solid var(--lumi-card-border); background: var(--lumi-bg1); }
.hero-video { display: block; width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; background: var(--lumi-bg0); }
.hero-copy { padding: 12px 14px 14px; }
.hero-title { font-size: 16px; font-weight: 800; margin: 0 0 6px; color: var(--lumi-ink); letter-spacing: -0.01em; }
.hero-sub { font-size: 12px; line-height: 1.5; margin: 0 0 12px; color: var(--lumi-ink-soft); }
.hero-cta { background: var(--lumi-glow); color: var(--lumi-bg0); font-weight: 700; font-size: 13px; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; transition: background var(--lumi-ease) 150ms; }
.hero-cta:hover { background: var(--lumi-glow-hot); }
.welcome-hero.collapsed { display: none; }
@media (prefers-reduced-motion: reduce) { .hero-video { display: none; } .welcome-hero { background: radial-gradient(120% 120% at 50% 0%, var(--lumi-bg2), var(--lumi-bg0)); } }
```

- [ ] **Step 3: Commit**

```bash
git add vscode-extension/media/panel.css
git commit -m "feat(panel): dark warm glow skin + welcome hero styles"
```

### Task 12: Wire new template tokens + "Get started" behaviour

**Files:**
- Modify: `vscode-extension/src/panelView.ts`
- Modify: `vscode-extension/media/panel.js`

- [ ] **Step 1: Resolve and substitute the new URIs in `panelView.ts`**

In the `html(webview)` method, after the existing `css`/`js` URIs, add:
```ts
    const tokens = webview.asWebviewUri(vscode.Uri.joinPath(media, "tokens.css"));
    const heroMp4 = webview.asWebviewUri(vscode.Uri.joinPath(media, "lumi-ide-1x1.mp4"));
    const heroWebm = webview.asWebviewUri(vscode.Uri.joinPath(media, "lumi-ide-1x1.webm"));
    const heroPoster = webview.asWebviewUri(vscode.Uri.joinPath(media, "lumi-ide-poster.jpg"));
```
Then extend the returned `buildHtml(...)` call to also replace the new placeholders. If `buildHtml` has a fixed signature, do the extra substitutions inline:
```ts
    let out = buildHtml(rawHtml, css.toString(), js.toString(), webview.cspSource, nonce);
    out = out
      .replaceAll("__TOKENS__", tokens.toString())
      .replaceAll("__HERO_MP4__", heroMp4.toString())
      .replaceAll("__HERO_WEBM__", heroWebm.toString())
      .replaceAll("__HERO_POSTER__", heroPoster.toString());
    return out;
```

- [ ] **Step 2: Add the "Get started" handler in `panel.js`**

Append (inside the existing DOM-ready/init flow — match the file's existing pattern for `addEventListener`):
```js
  const heroStart = document.getElementById("heroStart");
  if (heroStart) {
    heroStart.addEventListener("click", () => {
      const firstTab = document.querySelector('.tab[data-tab="lessons"]');
      if (firstTab) firstTab.click();
      document.getElementById("welcomeHero")?.classList.add("collapsed");
    });
  }
```

- [ ] **Step 3: Build + run the panel tests**

Run: `cd vscode-extension && npm run bundle && npm test`
Expected: bundle prints "bundled"; vitest suites pass (incl. the CSP test from Task 9).

- [ ] **Step 4: Manual check in the Extension Host**

Run: open the repo in VS Code, press F5, open the Lumi panel.
Expected: dark-warm panel; the square loop video autoplays + loops in the hero; "Get started" reveals the tabs and hides the hero. With reduced-motion on, the hero shows the gradient (no video), no errors in the webview devtools console.

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/src/panelView.ts vscode-extension/media/panel.js
git commit -m "feat(panel): wire hero video URIs + get-started interaction"
```

---

## Phase 7 — Marketplace README + web landing

### Task 13: Standalone web landing page

**Files:**
- Create: `web-landing/index.html`, `web-landing/tokens.css`, `web-landing/styles.css`, `web-landing/main.js`
- Add: `web-landing/assets/*` (rendered in Task 7)

- [ ] **Step 1: Copy tokens**

Create `web-landing/tokens.css` with the **same content** as `vscode-extension/media/tokens.css` (Task 8, Step 1).

- [ ] **Step 2: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lumi — understand what your AI builds</title>
  <meta name="description" content="Lumi teaches the concept behind what your AI coding tool just did, remembers it across tools, reviews it, and flags risky code. For non-technical builders.">
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="nav">
    <span class="brand">🪄 Lumi</span>
    <a class="nav-cta" href="#install">Add to VS Code</a>
  </header>

  <main>
    <section class="hero">
      <video class="hero-bg" autoplay muted loop playsinline
             poster="assets/lumi-hero-poster.jpg" preload="metadata">
        <source src="assets/lumi-hero-16x9.webm" type="video/webm">
        <source src="assets/lumi-hero-16x9.mp4" type="video/mp4">
      </video>
      <div class="hero-overlay">
        <h1>Build with AI — and understand what you shipped.</h1>
        <p>Lumi rides inside your AI coding tool. It teaches each new concept in plain English, remembers it across tools, reviews it so it sticks, and flags risky code before you ship.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#install">Add to VS Code</a>
          <a class="btn ghost" href="#install">Get the CLI</a>
          <button id="unmute" class="btn icon" aria-pressed="false" aria-label="Unmute the video">🔊 Sound</button>
        </div>
      </div>
    </section>

    <section class="features">
      <article class="feature reveal"><h2>Learn</h2><p>A plain-English lesson the moment a concept appears — once, analogy-led, adapted to your level.</p></article>
      <article class="feature reveal"><h2>Remember</h2><p>Cross-tool memory. Learn it in Cursor, and it's never re-taught in Claude Code.</p></article>
      <article class="feature reveal"><h2>Review</h2><p>Spaced repetition with guess-before-reveal recall, so it actually sticks.</p></article>
      <article class="feature reveal accent"><h2>Stay safe</h2><p>A security lens flags leaked keys, secrets in the frontend, and missing access control — and grades your AI's output A–F with fixes.</p></article>
      <article class="feature reveal"><h2>Every surface</h2><p>One feed across inline, the web overlay, the VS Code panel, and the CLI.</p></article>
      <article class="feature reveal"><h2>Keep going</h2><p>Streaks, badges, a shareable progress card, and a certificate.</p></article>
    </section>

    <section id="install" class="install">
      <h2>Start in two minutes</h2>
      <pre><code>npm install -g @lumi/core
lumi setup --all</code></pre>
      <a class="btn primary" href="https://marketplace.visualstudio.com/items?itemName=lumi-app.lumi-panel">Add to VS Code</a>
    </section>
  </main>

  <footer class="foot">Local-first · runs on your existing AI subscription · MIT</footer>
  <script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `styles.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: "Inter", -apple-system, "Segoe UI", system-ui, sans-serif;
  background: radial-gradient(120% 80% at 70% -10%, var(--lumi-bg2), var(--lumi-bg0) 55%);
  color: var(--lumi-ink); }
.nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 28px; position: sticky; top: 0; backdrop-filter: blur(8px); background: rgba(31,22,10,0.6); z-index: 10; }
.brand { font-weight: 800; font-size: 20px; }
.nav-cta, .btn { text-decoration: none; border-radius: 10px; font-weight: 700; }
.nav-cta { background: var(--lumi-glow); color: var(--lumi-bg0); padding: 8px 16px; }

.hero { position: relative; min-height: 78vh; display: grid; align-items: center; overflow: hidden; }
.hero-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.hero-overlay { position: relative; z-index: 1; max-width: 760px; padding: 0 28px;
  background: linear-gradient(90deg, rgba(31,22,10,0.86), rgba(31,22,10,0.2)); }
.hero h1 { font-size: clamp(2.2rem, 1rem + 5vw, 4.5rem); line-height: 1.04; letter-spacing: -0.03em; margin: 0 0 16px; }
.hero p { font-size: clamp(1rem, 0.9rem + 0.6vw, 1.3rem); color: var(--lumi-ink-soft); max-width: 56ch; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
.btn { padding: 12px 22px; cursor: pointer; border: 1px solid transparent; font-size: 1rem; transition: transform 150ms var(--lumi-ease), background 150ms var(--lumi-ease); }
.btn:hover { transform: translateY(-2px); }
.btn.primary { background: var(--lumi-glow); color: var(--lumi-bg0); }
.btn.primary:hover { background: var(--lumi-glow-hot); }
.btn.ghost { background: transparent; color: var(--lumi-ink); border-color: var(--lumi-card-border); }
.btn.icon { background: rgba(255,194,75,0.12); color: var(--lumi-ink); border-color: var(--lumi-card-border); }

.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; padding: clamp(3rem, 6vw, 7rem) 28px; max-width: 1200px; margin: 0 auto; }
.feature { background: var(--lumi-card-bg); border: 1px solid var(--lumi-card-border); border-radius: 16px; padding: 24px; }
.feature h2 { margin: 0 0 8px; font-size: 1.4rem; color: var(--lumi-glow); }
.feature p { margin: 0; color: var(--lumi-ink-soft); line-height: 1.55; }
.feature.accent { border-color: rgba(255,107,87,0.4); box-shadow: 0 0 50px rgba(255,107,87,0.12); }
.feature.accent h2 { color: var(--lumi-danger); }
.reveal { opacity: 0; transform: translateY(20px); transition: opacity 500ms var(--lumi-ease), transform 500ms var(--lumi-ease); }
.reveal.in { opacity: 1; transform: none; }

.install { text-align: center; padding: 0 28px clamp(3rem, 6vw, 7rem); }
.install h2 { font-size: clamp(1.8rem, 1rem + 3vw, 3rem); }
.install pre { display: inline-block; text-align: left; background: var(--lumi-bg1); border: 1px solid var(--lumi-card-border); border-radius: 12px; padding: 18px 24px; color: var(--lumi-glow); font-size: 1rem; }
.foot { text-align: center; padding: 28px; color: var(--lumi-ink-faint); border-top: 1px solid var(--lumi-card-border); }

@media (prefers-reduced-motion: reduce) {
  .hero-bg { display: none; }
  .hero { background: radial-gradient(120% 120% at 60% 0%, var(--lumi-bg2), var(--lumi-bg0)); }
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

- [ ] **Step 4: Write `main.js`**

```js
// Unmute toggle for the hero video.
const video = document.querySelector(".hero-bg");
const unmute = document.getElementById("unmute");
if (video && unmute) {
  unmute.addEventListener("click", () => {
    video.muted = !video.muted;
    const on = !video.muted;
    unmute.setAttribute("aria-pressed", String(on));
    unmute.textContent = on ? "🔇 Mute" : "🔊 Sound";
    if (on) video.play().catch(() => {});
  });
}
// Scroll reveal.
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
```

- [ ] **Step 5: Open it locally and verify**

Run: `cd web-landing && python -m http.server 8080` then open `http://localhost:8080`.
Expected: hero video autoplays muted + loops; "Sound" toggles audio; feature cards fade in on scroll; reduced-motion shows poster gradient; no console errors.

- [ ] **Step 6: Commit (incl. assets from Task 7)**

```bash
git add web-landing/index.html web-landing/tokens.css web-landing/styles.css web-landing/main.js
git add web-landing/assets/lumi-hero-16x9.mp4 web-landing/assets/lumi-hero-16x9.webm web-landing/assets/lumi-hero-poster.jpg
git commit -m "feat(web): standalone dark warm glow landing page"
```

### Task 14: Marketplace README hero + copy

**Files:**
- Modify: `vscode-extension/README.md`

- [ ] **Step 1: Read the current README to preserve install/sections**

Run: `cat vscode-extension/README.md`
Expected: note existing sections to keep (install, features).

- [ ] **Step 2: Add the hero GIF at the very top**

Insert as the first content lines (Marketplace requires an absolute HTTPS image URL):
```markdown
<p align="center">
  <img src="https://raw.githubusercontent.com/stefanbogdanmda/lumi/main/vscode-extension/media/lumi-ide.gif" alt="Lumi teaching a concept and flagging a leaked secret" width="640">
</p>

# Lumi — understand what your AI builds

A friendly side-panel that teaches the concept behind what your AI coding tool just did — **remembers** it across tools, **reviews** it so it sticks, and **flags risky code** before you ship. Built for non-technical builders.
```

- [ ] **Step 3: Verify the GIF path is committed at that exact path**

Run: `git ls-files vscode-extension/media/lumi-ide.gif`
Expected: prints the path (committed in Task 7). The raw URL resolves once the repo is public on `main`.

- [ ] **Step 4: Commit**

```bash
git add vscode-extension/README.md
git commit -m "docs(marketplace): dark warm glow README + hero gif"
```

---

## Phase 8 — Final verification

### Task 15: Full build, package, and smoke test

- [ ] **Step 1: Core + extension build green**

Run: `cd vscode-extension && npm run bundle && npm test`
Expected: "bundled"; all vitest pass.

- [ ] **Step 2: Package the VSIX and confirm media is included**

Run: `cd vscode-extension && npm run package && unzip -l *.vsix | grep -E "lumi-ide-1x1|tokens.css|panel"`
Expected: the `.vsix` lists `media/lumi-ide-1x1.mp4`, `media/tokens.css`, `media/panel.*`.

- [ ] **Step 3: Confirm no cold-hue regressions in the video**

Run: `cd marketing/video && npx remotion still LumiLaunch out/final-check.png --frame=400`
Expected: warm frame; open to confirm the CTA/brand reads in espresso + amber.

- [ ] **Step 4: Final commit / branch ready for PR**

```bash
git status   # working tree clean
git log --oneline feat/dark-warm-refresh-videos
```

---

## Self-review notes (author)

- **Spec coverage:** tokens (T1,T8,T13) · two videos (T4–T6) · two crops (T5) · render+GIF+webm+muted (T7) · panel hero+CSP+dark skin (T9–T12) · marketplace GIF w/ absolute URL (T14) · web landing w/ unmute+reduced-motion+perf (T13) · tests stay green (T9,T12,T15) · vsix bundling (T15). All spec sections map to a task.
- **No placeholders:** every code step shows real code; render steps give exact commands + expected output.
- **Type consistency:** `LOOP`/`BEATS` defined in T4 and consumed in T5; `cardSurface()` defined in T1, used in T2/T3; `SecurityScan` props (`width`, `from`) consistent across T3/T4/T6; new HTML tokens `__TOKENS__/__HERO_*__` defined in T10, substituted in T12.
- **Known adapt-points (flagged inline):** exact prop names of existing components (`Terminal`/`LessonCard`/`Wordmark`) and the precise `buildHtml` signature must be confirmed against source during T4/T9/T12 — the plan says to match, not invent.
