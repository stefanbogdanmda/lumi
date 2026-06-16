import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "./theme";
import { LumiSpark } from "./components/LumiSpark";

// Square app icon: the Lumi amber "spark" on the deep-indigo brand background.
// Rendered to PNG for the VS Code Marketplace tile + npm/social avatar.
// Use a static (non-animated) frame — `remotion still AppIcon out/icon.png`.
export const AppIcon: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 120% at 50% 30%, ${COLORS.bg2} 0%, ${COLORS.bg1} 50%, ${COLORS.bg0} 100%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* soft rounded-square inner vignette for a polished tile */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 120px 40px rgba(0,0,0,0.45)",
          pointerEvents: "none",
        }}
      />
      <div style={{ transform: "translateY(-2%)" }}>
        <LumiSpark size={300} pulse={false} sparkles />
      </div>
    </AbsoluteFill>
  );
};
