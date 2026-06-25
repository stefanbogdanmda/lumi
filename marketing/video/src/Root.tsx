import React from "react";
import { Composition } from "remotion";
import { LumiPromo } from "./LumiPromo";
import { LumiUseCase } from "./LumiUseCase";
import { LumiLaunch } from "./LumiLaunch";
import { LumiIdeLoop, LOOP } from "./LumiIdeLoop";
import { AppIcon } from "./AppIcon";
import { DURATION, FPS } from "./theme";
import { TOTAL } from "./beats";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Square app icon (static) — render with: remotion still AppIcon out/icon.png */}
      <Composition
        id="AppIcon"
        component={AppIcon}
        durationInFrames={1}
        fps={FPS}
        width={512}
        height={512}
      />
      {/* ── LumiLaunch — premium 30s launch promo (one timeline, 3 aspect ratios) ── */}
      {/* 9:16 — primary social cut (Reels / TikTok / Shorts) */}
      <Composition
        id="LumiLaunchVertical"
        component={LumiLaunch}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* 1:1 — square (feed) */}
      <Composition
        id="LumiLaunchSquare"
        component={LumiLaunch}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1080}
        height={1080}
      />
      {/* 16:9 — landscape (YouTube / site hero) */}
      <Composition
        id="LumiLaunch"
        component={LumiLaunch}
        durationInFrames={TOTAL}
        fps={FPS}
        width={1920}
        height={1080}
      />

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
      {/* 15-second real-use-case demo */}
      <Composition
        id="LumiUseCase"
        component={LumiUseCase}
        durationInFrames={450}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 9:16 vertical cut of the use-case demo */}
      <Composition
        id="LumiUseCaseVertical"
        component={LumiUseCase}
        durationInFrames={450}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* ── LumiIdeLoop — 14s seamless loop for VS Code panel + marketplace ── */}
      {/* 16:9 — VS Code panel / marketplace hero */}
      <Composition
        id="LumiIdeLoop"
        component={LumiIdeLoop}
        durationInFrames={LOOP}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* 1:1 — square feed crop */}
      <Composition
        id="LumiIdeLoopSquare"
        component={LumiIdeLoop}
        durationInFrames={LOOP}
        fps={FPS}
        width={1080}
        height={1080}
      />
    </>
  );
};
