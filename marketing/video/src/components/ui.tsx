import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Fade + rise in, with an optional hold-then-fade out window.
export const FadeUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  out?: [number, number]; // [outStart, outEnd] frames (local) to fade away
  style?: React.CSSProperties;
}> = ({ children, delay = 0, y = 40, duration = 18, out, style }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  let opacity = inP;
  if (out) {
    const outP = interpolate(frame, out, [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    opacity = Math.min(opacity, outP);
  }
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${(1 - inP) * y}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Spring-based pop scale, good for emphatic entrances.
export const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number;
  from?: number;
  style?: React.CSSProperties;
  damping?: number;
}> = ({ children, delay = 0, from = 0.6, style, damping = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
  const scale = from + (1 - from) * s;
  return (
    <div style={{ transform: `scale(${scale})`, opacity: Math.min(1, s * 1.4), ...style }}>
      {children}
    </div>
  );
};

export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      ...style,
    }}
  >
    {children}
  </div>
);
