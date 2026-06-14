import React from "react";
import { Composition } from "remotion";
import { LumiPromo } from "./LumiPromo";
import { DURATION, FPS } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 master */}
      <Composition
        id="LumiPromo"
        component={LumiPromo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 9:16 social cut — same timeline, portrait-aware layouts */}
      <Composition
        id="LumiPromoVertical"
        component={LumiPromo}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
