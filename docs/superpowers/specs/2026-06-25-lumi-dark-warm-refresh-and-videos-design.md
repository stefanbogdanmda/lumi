# Lumi — Dark Warm Glow refresh + two Remotion videos

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Owner:** Stefan

## Summary

Give Lumi a single, opinionated brand look — **"Warm Glow, dark mode"** (deep espresso
base, amber glow, cream text) — and apply it across three "landing" surfaces, each
fronted by a looping Remotion video:

1. **In-VS-Code panel welcome** — the Lumi side-panel's first screen.
2. **Marketplace listing** — `vscode-extension/README.md`.
3. **Standalone web landing page** — a new static page.

Two videos are produced from **one** Remotion project (extending the existing
`marketing/video/` project, re-themed):

- **IDE loop** — short (~14s) seamless loop, 5 beats. Rendered square + wide.
- **Web hero** — detailed (~35–40s) 9-beat film. 16:9.

## Goals

- One shared visual system used by video, panel, marketplace, and web landing.
- A polished, robust, beat-synced video on each surface with clean motion.
- Reuse the existing Remotion project rather than rebuild.
- Keep the extension's existing functionality and tests green.

## Non-goals (explicitly out of scope)

- Publishing to npm / VS Code Marketplace.
- Hosting/deploying the web landing page (built deploy-ready; not deployed).
- New soundtrack production (reuse existing audio assets; ship videos muted).
- Changing Lumi's core engine (`@lumi/core`) or any lesson logic.

## Design decisions (resolved)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Panel theme | **Whole panel** adopts dark-warm palette (own theme, independent of editor theme). |
| 2 | Web hero length | ~35–40s; priority is **beat-sync + robustness**, not exact runtime. |
| 3 | Audio | **Muted** autoplay everywhere; web hero gets an optional unmute button. |
| 4 | Visual direction | **A · Warm Glow**, rendered **dark** (espresso + amber + cream). |
| 5 | Video source | Extend existing `marketing/video/` Remotion project (re-theme indigo→espresso). |

## The shared theme (single source of truth)

Dark Warm Glow tokens — defined once, mirrored into each surface's native format:

```
bg0      #1F160A   (deepest espresso)
bg1      #2E2113
bg2      #3A2A12
ink      #FFF1D6   (cream text)
inkSoft  #D8C49A
inkFaint #9A865E
glow     #FFC24B   (Lumi amber)
glowHot  #E89A1C
amberDeep#FF8A4C
danger   #FF6B57   (security alert accent)
cardBg   rgba(51, 38, 15, 0.72)
cardBorder rgba(255, 194, 75, 0.22)
```

Consumed by:
- `marketing/video/src/theme.ts` — `COLORS` re-themed to the above (keep SPRING/EASE/GLOW motion system as-is).
- `vscode-extension/media/panel.css` — as CSS custom properties (`--lumi-bg0`, …).
- `web-landing/` CSS — same custom properties (copied tokens file).

Glow rule (from web/design-quality): amber glow used semantically (lit/active elements),
not decoratively everywhere.

## Video architecture (Remotion)

Extend `marketing/video/`:

- **New composition `LumiIdeLoop`** (`src/LumiIdeLoop.tsx`) — 5 beats, designed to loop
  seamlessly (last frame state resolves back into the first; cross-fade the wordmark into
  the opener). ~14s @ 30fps (~420 frames). Reuses existing components: `LumiSpark`,
  `LessonCard`, `Terminal`, `Wordmark`, `Background`.
  - Beats: Hook (AI writes code) → Teach (lesson card) → Remember (cross-tool chips +
    glossary) → Stay-safe (leaked secret → shield sweep → A–F grade) → Resolve (logo +
    tagline, dissolves into Hook).
  - Registered in `Root.tsx` at **two sizes**: `LumiIdeLoopSquare` 1080×1080 and
    `LumiIdeLoopWide` 1920×1080.
- **Web hero** — restyle the existing `LumiLaunch` timeline into the approved 9-beat dark
  cut (Opener → Enter Lumi → Learn → Remember → Review → **Stay-safe ★** → Every-surface →
  Proof → Close). Stay-safe gets the most screen time. 16:9 1920×1080. Keep the existing
  `LumiLaunch` scene files (`scenes/Problem|Reveal|HowItWorks|Benefits|CTA`) but re-theme
  and re-time to the 9-beat plan.

### Render pipeline

New npm scripts in `marketing/video/package.json`:

```
ide:square  → remotion render LumiIdeLoopSquare out/lumi-ide-1x1.mp4
ide:wide    → remotion render LumiIdeLoopWide   out/lumi-ide-16x9.mp4
ide:webm    → remotion render LumiIdeLoopWide   out/lumi-ide-16x9.webm  (vp9)
ide:gif     → remotion render LumiIdeLoopWide   out/lumi-ide.gif        (for marketplace)
hero:mp4    → remotion render LumiLaunch         out/lumi-hero-16x9.mp4
hero:webm   → remotion render LumiLaunch         out/lumi-hero-16x9.webm
```

Outputs land in the git-ignored `marketing/video/out/`. A small copy step moves the
**panel** assets into `vscode-extension/media/` (these are committed — they ship in the
`.vsix`). Web-hero assets are copied into `web-landing/assets/`.

## Surface A — in-VS-Code panel welcome

Files: `vscode-extension/media/panel.html`, `panel.css`, `panel.js`,
`src/panelView.ts` (CSP), tests under `test/`.

- Welcome/empty state becomes a **dark-warm hero**: `LumiIdeLoopSquare` video
  (`<video autoplay muted loop playsinline>`) at top, headline, one-line pitch, and a
  "Get started" affordance that scrolls/focuses the tabs.
- The entire panel re-skins to dark-warm tokens (header, tabs, cards, buttons) — overriding
  VS Code theme variables with Lumi's own palette per decision #1. Keep focus/hover/active
  states intentional (design-quality checklist).
- **CSP**: add `media-src ${webview.cspSource};` to the `<meta>` policy in `panel.html`
  and ensure the video file is under `localResourceRoots` (already the extension root).
- Video files bundled in `media/`: `lumi-ide-1x1.mp4` (+ `.webm` fallback). Poster image
  (first frame still) for instant paint before the video loads.
- Graceful degradation: if the video element fails, the hero falls back to a static
  poster + gradient (never a blank box).

## Surface B — Marketplace listing (`vscode-extension/README.md`)

- Hero **animated GIF** at the very top (`lumi-ide.gif`).
- **Constraint:** the VS Code Marketplace requires **absolute HTTPS** image URLs in
  README. The GIF is referenced via the GitHub raw URL
  (`https://raw.githubusercontent.com/stefanbogdanmda/lumi/main/marketing/video/out/...`)
  — so the GIF must be committed at a stable path and the repo public. The GIF therefore
  lives at a committed path (e.g. `vscode-extension/media/lumi-ide.gif`) and is referenced
  by its raw URL.
- Rewrite README copy in dark-warm brand voice, leading with the security wedge; add 2–3
  panel screenshots after the GIF.

## Surface C — standalone web landing (`web-landing/`)

New static site (no framework; plain HTML/CSS, tiny JS for unmute + scroll reveal):

```
web-landing/
  index.html
  styles.css        (imports shared dark-warm tokens)
  tokens.css        (copied from the shared token set)
  main.js           (unmute toggle, IntersectionObserver reveals)
  assets/
    lumi-hero-16x9.mp4 / .webm
    poster.jpg
```

- Hero: full-bleed dark-warm section with the **web hero** video autoplaying muted+looping,
  headline, subhead, "Add to VS Code" + "Get the CLI" CTAs, unmute button.
- Sections mirror the beats: Learn / Remember / Review / **Stay-safe** / Every-surface /
  Proof, then footer CTA.
- Performance (web/performance rules): explicit media dimensions, `poster`,
  `preload="metadata"`, lazy-load below-the-fold, compositor-only animations
  (`transform`/`opacity`), no layout-shifting hero.
- Accessibility: respects `prefers-reduced-motion` (pause video / show poster), semantic
  landmarks, sufficient contrast on cream/espresso.

## Testing & verification

- `cd marketing/video && npm run ide:square` and `hero:mp4` render headless without error
  and produce non-empty files (smoke test both compositions).
- `npm test --workspace vscode-extension` (`messageHandler`, `panelView`) stays green after
  welcome-hero + CSP changes; add a `panelView` assertion that the CSP includes `media-src`.
- `npm run bundle --workspace vscode-extension` succeeds; `vsce package --no-dependencies`
  produces a `.vsix` that includes the bundled video + poster in `media/`.
- Web landing: open locally; verify autoplay-muted-loop, unmute toggle, reduced-motion
  fallback, and no console errors. Lighthouse pass against the CWV targets.
- Manual: load the extension (F5) and confirm the hero video autoplays and loops in the
  panel, with the poster fallback when video is blocked.

## Risks / mitigations

- **Webview autoplay blocked** → always `muted` + `playsinline`; poster fallback.
- **`.vsix` size** from bundling video → keep the IDE loop short, encode efficiently
  (target the square mp4 well under ~2–3 MB); prefer mp4 over webm if size forces a choice.
- **Marketplace relative-image limitation** → use committed asset + raw GitHub URL; note the
  dependency on the repo being public.
- **Forced dark panel clashing with light editor themes** → accepted per decision #1; ensure
  contrast and that the panel still reads as intentional (branded), not broken.

## File-change inventory

- `marketing/video/src/theme.ts` (re-theme), `Root.tsx` (register new comps),
  `src/LumiIdeLoop.tsx` (new), `src/LumiLaunch.tsx` + `scenes/*` (re-theme/re-time),
  `package.json` (render scripts).
- `vscode-extension/media/panel.html`, `panel.css`, `panel.js`; `src/panelView.ts` (CSP);
  `media/lumi-ide-1x1.mp4` (+`.webm`, poster, `lumi-ide.gif`) — committed.
- `vscode-extension/README.md` (rewrite + hero GIF).
- `web-landing/*` (new).
- `.gitignore` (already updated: ignore `.superpowers/`).
