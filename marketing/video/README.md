# Lumi — 30-second marketing video

A polished, fully code-rendered promo for **Lumi**, the friendly mini-teacher for
Claude Code. Built with [Remotion](https://remotion.dev) (React → video), with an
original synthesized soundtrack. No external image, video, or audio assets — the
whole thing renders from this repo.

## Watch / render

```bash
cd marketing/video
npm install
npm run soundtrack   # regenerate public/audio/soundtrack.wav (already committed)
npm run dev          # open Remotion Studio to preview & scrub
npm run render       # render out/lumi-promo.mp4 (1920×1080, 30fps, with audio)
npm run still        # render a single still frame
```

Output: `out/lumi-promo.mp4` — **1920×1080, 30 fps, 900 frames (30.0s)**, H.264 + AAC.

## The story (and why it sells Lumi)

The script follows the positioning in [`docs/business/positioning.md`](../../docs/business/positioning.md):
problem (comprehension debt) → meet Lumi → how it works → benefits → call to action.

| Time | Scene | What it shows |
|------|-------|---------------|
| 0–6s | **Problem** | Claude Code ships working code full of unfamiliar words ("environment variable", "migration", "race condition"). *59% ship AI code they don't fully understand.* |
| 6–11s | **Reveal** | Lumi's glowing "spark" mascot blooms; wordmark + "the mini-teacher inside your AI coding tool". |
| 11–21s | **How it works** | (a) Lumi detects a new concept and drops an inline lesson card; (b) it works everywhere — terminal, mobile, VS Code panel; (c) a progress shelf fills, and Lumi stays quiet on repeats. |
| 21–27s | **Benefits** | Learn in the flow · Taught once, remembered forever · Understand what you ship. |
| 27–30s | **CTA** | Lockup, tagline "Understand what you ship.", and `/plugin install lumi`. |

## Music sync

The soundtrack (`scripts/make-soundtrack.mjs`) is an original, royalty-free piece
generated as raw PCM — a warm, hopeful electronic bed (pad chords on an uplifting
I–V–vi–IV progression, sub kick, hats, a bright arpeggio, and bell "sparkles").

It runs at **120 BPM**, so **1 beat = 15 frames** and **1 bar = 60 frames (2s)**.
Every scene cut in [`src/theme.ts`](src/theme.ts) (`SCENES`) lands on a bar
boundary, and the audio places bell sparkles + risers exactly on the reveal (6s),
the "how it works" hand-off (10s), the benefits lift (20s), and the final lockup
(27s) — so the visuals and music hit together. The track builds from a sparse
intro through a full groove and resolves into a soft pad tail under the CTA.

To swap in licensed/produced music later, drop a 30s file at
`public/audio/soundtrack.wav` (or update the `<Audio>` src in
[`src/LumiPromo.tsx`](src/LumiPromo.tsx)); keeping it at 120 BPM preserves the sync.

## Structure

```
src/
  index.ts            registerRoot
  Root.tsx            <Composition id="LumiPromo">
  LumiPromo.tsx       timeline: Background + Audio + 5 scene Sequences
  theme.ts            colors, fonts, scene boundaries (bar-aligned)
  components/         Background, LumiSpark, Wordmark, Terminal,
                      LessonCard, Phone, ProgressShelf, ui (FadeUp/Pop)
  scenes/             Problem, Reveal, HowItWorks, Benefits, CTA
scripts/
  make-soundtrack.mjs original soundtrack generator → public/audio/soundtrack.wav
```

Everything is rendered from React/CSS/SVG and procedural audio, so the video is
self-contained and reproducible from source.
