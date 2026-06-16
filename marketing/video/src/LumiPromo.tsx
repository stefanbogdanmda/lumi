import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import {
  TransitionSeries,
  springTiming,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { SPRING } from "./theme";
import { Background } from "./components/Background";
import { Problem } from "./scenes/Problem";
import { Reveal as RevealScene } from "./scenes/Reveal";
import { HowItWorks } from "./scenes/HowItWorks";
import { Benefits } from "./scenes/Benefits";
import { CTA } from "./scenes/CTA";

// ── Transition overlap ─────────────────────────────────────────────────────────
// Each scene's Sequence durationInFrames is extended by OVERLAP so the
// outgoing frame dissolves into the incoming one over 12 frames.
// Total = (192+162+312+192+90) - 4*12 = 948 - 48 = 900 frames (30s). ✓
//
// Content within each scene starts at local frame 0 — unchanged — so all
// kinetic beats still land on/near the original 60-frame (2s) bars.
const OVERLAP = 12;

// 30-second Lumi marketing promo. Scene cuts dissolve over 12 frames via
// @remotion/transitions. The <Audio> and <Background> span the full 900f
// timeline unchanged; only the scene stack moves to TransitionSeries.
export const LumiPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#070A18" }}>
      {/* Soundtrack: always-on, full 900f. */}
      <Audio src={staticFile("audio/soundtrack.wav")} />

      {/* Background: always-on, full 900f. */}
      <Background />

      {/*
       * TransitionSeries places scenes consecutively, overlapping each pair
       * by OVERLAP frames. Transition timing + presentation are independent:
       *   - presentation = how the pixels dissolve (fade / slide / …)
       *   - timing       = how fast the progress eases (spring / linear)
       *
       * Sequence durations (with OVERLAP added to all but the last):
       *   Problem      192f  → content 0–179  (bar at 180)
       *   RevealScene  162f  → content 0–149  (bar at 150)
       *   HowItWorks   312f  → content 0–299  (bar at 300)
       *   Benefits     192f  → content 0–179  (bar at 180)
       *   CTA           90f  → content 0–89
       *   ─ 4 × 12f overlaps ──────────────────────────
       *   Net = 948 – 48 = 900f ✓
       */}
      <TransitionSeries>
        {/* ── Problem (0–6s) ── */}
        <TransitionSeries.Sequence durationInFrames={180 + OVERLAP} name="Problem">
          <Problem />
        </TransitionSeries.Sequence>

        {/* Problem → Reveal: light-bloom fade */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: SPRING.glide, durationInFrames: OVERLAP })}
        />

        {/* ── Reveal (6–11s) ── */}
        <TransitionSeries.Sequence durationInFrames={150 + OVERLAP} name="Reveal">
          <RevealScene />
        </TransitionSeries.Sequence>

        {/* Reveal → HowItWorks: slide up */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={springTiming({ config: SPRING.glide, durationInFrames: OVERLAP })}
        />

        {/* ── HowItWorks (11–21s) ── */}
        <TransitionSeries.Sequence durationInFrames={300 + OVERLAP} name="HowItWorks">
          <HowItWorks />
        </TransitionSeries.Sequence>

        {/* HowItWorks → Benefits: fade (reads as fade+scale once scenes add their own scale) */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: OVERLAP })}
        />

        {/* ── Benefits (21–27s) ── */}
        <TransitionSeries.Sequence durationInFrames={180 + OVERLAP} name="Benefits">
          <Benefits />
        </TransitionSeries.Sequence>

        {/* Benefits → CTA: fade-through-light (bookends the open) */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: SPRING.glide, durationInFrames: OVERLAP })}
        />

        {/* ── CTA (27–30s) ── */}
        <TransitionSeries.Sequence durationInFrames={90} name="CTA">
          <CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
