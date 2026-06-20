# Lumi — 30-second marketing video

A polished, fully code-rendered promo for **Lumi**, the friendly mini-teacher for
Claude Code. Built with [Remotion](https://remotion.dev) (React → video), with an
original synthesized soundtrack. No external image, video, or audio assets — the
whole thing renders from this repo.

> ## v2 (current)
> The committed example renders in [`examples/`](examples/) are the **v2** cut.
> What changed from v1:
> - **New hero concept — "the word lights up."** We open cold on real AI output
>   where one scary term sits dimmed/uncertain; Lumi's spark drifts in, lands on it,
>   and the word **ignites** into a plain-English lesson (confusion → comprehension
>   in one continuous motion). The full creative spec lives in [`V2-BRIEF.md`](V2-BRIEF.md).
> - **New soundtrack — melodic future-bass** (gated supersaws, F major, a 3-note
>   "spark" hook, half-time drums, mastered to ~−14 LUFS). Still 120 BPM, so the
>   bar-aligned scene sync is preserved.
> - **Kinetic typography + a real motion system** (`SPRING`/`EASE` in `theme.ts`,
>   a motion kit in `ui.tsx`, soft `TransitionSeries` scene transitions). Emoji UI
>   removed in favor of the spark + monoline glyphs.
> - **Fixed install command.** The CTA now shows the real two-step command:
>   `/plugin marketplace add stefanbogdanmda/lumi` then
>   `/plugin install lumi@lumi` (v1 showed the wrong `/plugin install lumi`).
>
> Re-render anytime with `npm run render` / `npm run render:vertical` (below).

## Watch / render

```bash
cd marketing/video
npm install               # install deps (clean — no flags needed)
npm run soundtrack        # regenerate public/audio/soundtrack.wav (already committed)
npm run dev               # open Remotion Studio to preview & scrub
npm run render            # 16:9 master  → out/lumi-promo.mp4
npm run render:vertical   # 9:16 social  → out/lumi-promo-vertical.mp4
npm run still             # render a single still frame
```

Renders write to `out/` (gitignored). The shipped examples in
[`examples/`](examples/) — `lumi-promo-16x9.mp4` and `lumi-promo-9x16.mp4` — are
copies of those renders and are the **v2** cut. If a render OOMs or runs slowly,
re-run with `--concurrency=1` (e.g. `npx remotion render LumiPromo
out/lumi-promo.mp4 --concurrency=1`).

Two compositions render from the same timeline:

| Composition | Aspect | Resolution | Use |
|-------------|--------|------------|-----|
| `LumiPromo` | 16:9 | 1920×1080 | website, YouTube, presentations |
| `LumiPromoVertical` | 9:16 | 1080×1920 | Reels / TikTok / Shorts / Stories |

Both are **30 fps, 900 frames (30.0s)**, H.264 + AAC. Scenes are layout-aware
(`useLayout()` in [`src/theme.ts`](src/theme.ts)) and reflow for portrait —
side-by-side panels stack, widths fit the frame.

## The story (and why it sells Lumi)

The script follows the positioning in [`docs/business/positioning.md`](../../docs/business/positioning.md):
hook (a word you don't understand) → **ignition** (it lights up into a lesson) →
meet Lumi → it does this for everything, and remembers → the turn → call to action.
Soft `TransitionSeries` dissolves carry between scenes, and content still lands on
the beat. The full v2 creative spec is in [`V2-BRIEF.md`](V2-BRIEF.md).

| Time | Scene | What it shows |
|------|-------|---------------|
| 0–4s | **Hook** | A terminal types a line of working AI output; one scary term sits dimmed/uncertain — "you have no idea how." |
| 4–8s | **Ignition (hero)** | Lumi's spark drifts in, lands on the dimmed word, and it **ignites** into a plain-English lesson — the drop hits on the 6s beat. |
| 8–11s | **Reveal** | The spark blooms into Lumi's mark + wordmark — "your mini-teacher, right inside the AI." |
| 11–21s | **Does it for everything / Remembers** | New words (`migration`, `API`, `race condition`) light up on the beat across terminal · mobile · VS Code; learned words fly into a glossary shelf and a repeat term stays quiet. |
| 21–26s | **The turn** | Three kinetic lines punch in on the beat: "Learn as you build." · "Taught once. Yours forever." · "Build with confidence." |
| 26–30s | **CTA** | Lockup, tagline "Understand what you ship.", and the real two-step install command — `/plugin marketplace add stefanbogdanmda/lumi` then `/plugin install lumi@lumi`. |

## Music sync

The v2 soundtrack (`scripts/make-soundtrack.mjs`) is an original, royalty-free
**melodic future-bass** piece rendered offline through a real Web Audio engine
(`node-web-audio-api`): warm gated supersaws on an **F major** progression
(F add9 – Am7 – Dm7 – B♭ maj9, resolving to F on the CTA), a clean sub + saturated
mid-bass, half-time punchy drums (kick on 1&3, clap on 3, swung hats), convolution
reverb, a tempo delay, and a multi-bus sidechain "pump" so the mix breathes with
the kick. Mastered to roughly **−14 LUFS, −1 dBTP**.

A 3-note rising "spark" hook (A→C→D) is the sound of the mascot — teased in the
intro, landing full on the 6s drop, and returning an octave up on the CTA. A
signature "ignition" transient fires on each word that lights up.

It runs at **120 BPM**, so **1 beat = 15 frames** and **1 bar = 60 frames (2s)**.
Every scene cut in [`src/theme.ts`](src/theme.ts) (`SCENES`) lands on a bar
boundary, and the accents hit on the ignition drop (6s), the hand-off (10s), the
benefits lift (20s), and the final lockup (27s) — so the visuals and music hit
together. The track builds from a near-silent intro through a full groove and
resolves into a soft pad tail under the CTA.

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
