# Lumi Promo v2 — Unified Build Brief

Synthesis of the 4-agent creative swarm (direction · copy · music · motion). 30s @ 30fps,
16:9 + 9:16, music-synced (cuts on 60-frame bars), 120 BPM, fully code-rendered.
**Render verified here:** `npm run still` and `npm run soundtrack` both work.

## The concept — "The word lights up"
Open cold on real AI output where one scary word (`environment variable`) sits **dimmed/uncertain**.
Lumi's spark drifts in, lands on it, and the word **ignites into a plain-English lesson** —
confusion→comprehension in one continuous motion. That ignition is the **hero moment**, repeated at
scale. Through-line: the quiet relief of finally understanding. Luminance arc: the frame literally
gets brighter as the user understands more.

## Hard rules (marketability)
- **No emoji as UI** (the #1 amateur tell). Replace ❓🪄🌊🧠🛡️ with the spark + 2–3 monoline glyphs.
- **~50% less on-screen text** — one idea per beat.
- **One motion language:** drift-in → land → **ignite** → glow rises. Physics-based snaps on the beat;
  soft scene transitions (no hard cuts).
- **One CTA, one (correct) command.**

## Storyboard (60f bars @ 30fps)
| Time | Frames | Scene | Visual | Music |
|---|---|---|---|---|
| 0–4s | 0–120 | **Hook** | terminal types a line; one term dimmed/flickering | sparse, lone hook note teased, no drums |
| 4–8s | 120–240 | **Ignition (HERO)** | spark drifts in, lands, word **ignites** → inline lesson unfolds | **the drop** @6s: kick+sub+full hook |
| 8–11s | 240–330 | **Reveal** | spark blooms into Lumi mark + wordmark | groove settles, ride fill |
| 11–17s | 330–510 | **Does it for everything** | `migration`→`API`→`race condition` each ignite on the beat; phone slides in 1 frame | hook in call-and-response, rising |
| 17–21s | 510–630 | **Remembers** | glowing words fly into a glossary shelf; a repeat term stays dark | steady |
| 21–26s | 630–780 | **The turn** | 3 kinetic lines punch in on the beat (no cards/emoji) | benefits lift / 2nd-drop bump @20s |
| 26–30s | 780–900 | **CTA** | lockup + tagline + the real install command, glowing | impact @27s → resolve to F tonic, pad tail |

## Final copy (locked, accurate)
- **Hook (0–4s):** "You asked AI to build it." → "It **worked.**" → (dimmed term) → "You have **no idea** how."
- **Ignition lesson:** real plain-English, e.g. *"environment variable — a saved note for secrets; keeps your keys out of the code."*
- **Reveal:** "Meet **Lumi.**" / "Your mini-teacher — right inside the AI."
- **Everything:** new word? → it lights up (no caption needed); one frame: `Terminal · Mobile · VS Code`.
- **Remembers:** "Learned once. **Never repeated.**"
- **The turn (3 lines):** "Learn as you build." → "Taught once. Yours forever." → "Build with confidence."
- **CTA:** tagline **"Understand what you ship."** + one line "Free on your own Claude plan · mobile + VS Code" + the **REAL** command (two lines, mono):
  `/plugin marketplace add stefanbogdanmda/lumi`
  `/plugin install lumi@lumi`
- ⚠️ **Bug to fix:** current `CTA.tsx` shows the WRONG command `/plugin install lumi`. Replace with the real two-step above.
- Accuracy: 92-concept dictionary (don't imply infinite); learner-voice = hopeful (no security-fear framing); only real concepts shown.

## Music direction (rewrite `scripts/make-soundtrack.mjs`)
Modern **melodic future-bass**, warm/optimistic, **120 BPM** (sync preserved), key **F major**.
- Progression **F(add9) – Am7 – Dm7 – Bb(maj9)** (I–iii–vi–IV), resolves to F on the CTA.
- **Gated supersaws** (7+ voices, ±20–30c, hard-panned for width; octave "air" layer; rhythmic gating — the genre signature), light waveshaper saturation.
- **The hook:** a 3-note rising "spark" motif **A→C→D** (dotted feel) — teased in intro, lands full on the 6s drop, answers the arp through the groove, returns +octave on the CTA. It's the sound of the mascot.
- **Bass:** clean sine sub + saturated mid-bass (audible on phones); sidechained to kick.
- **Drums:** half-time (kick 1&3, clap/snare on 3), punchy kick (~55–60Hz + 200Hz body), layered snare, swung velocity-varied hats, ghost shaker 11–20s.
- **Mix:** multi-bus sidechain (deep/slow on pads, fast/shallow on bass); widen pads/arp, **mono bass+kick**; HPF pads/arp/hook ~150–200Hz; tighter reverb (~1.8s IR, gain ~0.3–0.4, HPF the return); proper limiter → **~−14 LUFS**, −1 dBTP.
- A **signature "ignition" transient** (soft bell+pluck ~150ms) on every word that lights up; a **~1.5s near-silence drop** right before the 8s ignition.
- Keep accent hits at 6/10/20/27s; keep the 30s fade-out.

## Motion system (build the kit, then migrate scenes)
Add to `theme.ts`:
```ts
export const SPRING = {
  enter:  { damping: 16, mass: 0.9, stiffness: 130 },
  settle: { damping: 26, mass: 0.8, stiffness: 120 },
  pop:    { damping: 12, mass: 0.7, stiffness: 200 },
  glide:  { damping: 30, mass: 1.2, stiffness: 90 },
} as const;
import { Easing } from "remotion";
export const EASE = {
  out:    Easing.bezier(0.16, 1, 0.3, 1),
  inOut:  Easing.bezier(0.65, 0, 0.35, 1),
  outBack:Easing.bezier(0.34, 1.56, 0.64, 1),
};
```
Grow `ui.tsx` into a kit: `Reveal` (spring + blur + scale + direction), `KineticHeadline` (word-staggered, blur-in, optional accent color-snap), `StaggerGroup`/`StaggerItem`, `Camera` (slow 1.0→1.04 push + drift), `Bloom` (radial light cast), `TypeOn` (char-by-char + glow cursor), `ClipReveal` (clipPath wipe), `CountUp` (eased number). `FadeUp` becomes a thin alias defaulting to `EASE.out`; `Pop` → `SPRING.pop`.
- **`LumiPromo.tsx` → `@remotion/transitions` `TransitionSeries`**, overlapping ~12f into the bar (content still lands on the beat): Problem→Reveal = light-bloom dissolve; Reveal→How = slide-up; How→Benefits = fade+scale-down; Benefits→CTA = fade-through-light (bookends the open).
- **No naked-linear visible motion** — drive from `spring()` or pass `{easing: EASE.out}`.
- Per-scene: kinetic hook headline (color-snap "isn't"/dimmed word); the **ignition** is one continuous shot (spark lands → word brightens → lesson unfolds, no cut); 3D fan-in for the surfaces; cascade-within-cascade benefits; CTA **hero**: install command **types on** with a glow-ripple, then holds dead-still ~20f (readable thumbnail).
- Polish: film grain (~3–4% animated `feTurbulence`), warm top vignette rim, two glow tiers (ambient + event), shadows offset down-right (light from top-left), tightened display typography.

## Build order (each verified by `npm run still`, final by full render)
1. **Music** — rewrite `make-soundtrack.mjs`; `npm run soundtrack` → new 30s `soundtrack.wav`.
2. **Motion foundation** — `theme.ts` SPRING/EASE/glow + `ui.tsx` kit + `LumiPromo.tsx` TransitionSeries + add `@remotion/transitions`. Still renders.
3. **Scenes + copy + components** — rewrite 5 scenes per storyboard/copy (fix command, kill emoji) using the kit; upgrade LessonCard/LumiSpark/Wordmark/Terminal/ProgressShelf; grain/vignette in Background. Still renders.
4. **Render + ship** — `npm run render` + `render:vertical`; replace `examples/*.mp4`; update README; push.
