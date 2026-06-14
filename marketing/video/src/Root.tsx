import React from "react";
import { Composition } from "remotion";
import { LumiPromo } from "./LumiPromo";
import { DURATION, FPS } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LumiPromo"
      component={LumiPromo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
