import React from "react";
import { COLORS, FONT } from "../theme";

// A minimal phone frame to show the Lumi inline lesson on the Claude mobile app.
export const Phone: React.FC<{
  width?: number;
  children?: React.ReactNode;
}> = ({ width = 360, children }) => {
  const height = width * 2.05;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.13,
        background: "linear-gradient(160deg, #1B2150, #0B0F26)",
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow: "0 40px 110px rgba(0,0,0,0.6), 0 0 60px rgba(167,139,250,0.12)",
        padding: width * 0.035,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* notch */}
      <div
        style={{
          position: "absolute",
          top: width * 0.05,
          left: "50%",
          transform: "translateX(-50%)",
          width: width * 0.32,
          height: width * 0.05,
          borderRadius: 999,
          background: "rgba(0,0,0,0.6)",
          zIndex: 5,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.1,
          background: "rgba(7,10,24,0.96)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* app header */}
        <div
          style={{
            padding: `${width * 0.08}px ${width * 0.06}px ${width * 0.03}px`,
            fontFamily: FONT,
            fontSize: width * 0.05,
            fontWeight: 700,
            color: COLORS.inkSoft,
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }}>
              <circle cx="7" cy="7" r="6" fill={COLORS.amberDeep} />
            </svg> Claude
        </div>
        <div style={{ flex: 1, padding: width * 0.045 }}>{children}</div>
      </div>
    </div>
  );
};
