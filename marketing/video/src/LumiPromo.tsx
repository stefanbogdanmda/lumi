import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { SCENES } from "./theme";
import { Background } from "./components/Background";
import { Problem } from "./scenes/Problem";
import { Reveal } from "./scenes/Reveal";
import { HowItWorks } from "./scenes/HowItWorks";
import { Benefits } from "./scenes/Benefits";
import { CTA } from "./scenes/CTA";

// 30-second Lumi marketing promo. Scene cuts land on 2-second musical bars in
// the original soundtrack (120 BPM): problem → reveal → how it works →
// benefits → call to action.
export const LumiPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#070A18" }}>
      <Audio src={staticFile("audio/soundtrack.wav")} />

      <Background />

      <Sequence name="Problem" from={SCENES.problem.from} durationInFrames={SCENES.problem.durationInFrames}>
        <Problem />
      </Sequence>
      <Sequence name="Reveal" from={SCENES.reveal.from} durationInFrames={SCENES.reveal.durationInFrames}>
        <Reveal />
      </Sequence>
      <Sequence name="HowItWorks" from={SCENES.howItWorks.from} durationInFrames={SCENES.howItWorks.durationInFrames}>
        <HowItWorks />
      </Sequence>
      <Sequence name="Benefits" from={SCENES.benefits.from} durationInFrames={SCENES.benefits.durationInFrames}>
        <Benefits />
      </Sequence>
      <Sequence name="CTA" from={SCENES.cta.from} durationInFrames={SCENES.cta.durationInFrames}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
