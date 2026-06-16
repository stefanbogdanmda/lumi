import React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, EASE, SPRING } from "../theme";

// ── Reveal ────────────────────────────────────────────────────────────────────
// Spring-driven entrance supporting Y/X translation, blur-in, and scale.
// `spring` prop overrides the physics config (defaults to SPRING.enter).
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  /** Vertical distance to travel on entry (px, positive = from below). Default 40. */
  y?: number;
  /** Horizontal distance to travel on entry (px, positive = from right). Default 0. */
  x?: number;
  /** Blur radius at the start of the entrance (px). Default 0. */
  blur?: number;
  /** Starting scale factor (1 = no scale). Default 1. */
  scale?: number;
  /** Spring physics config. Defaults to SPRING.enter. */
  spring?: { damping: number; mass: number; stiffness: number };
  /** Starting opacity. Default 0. */
  from?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  delay = 0,
  y = 40,
  x = 0,
  blur = 0,
  scale = 1,
  spring: springConfig = SPRING.enter,
  from = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: springConfig });

  const opacity = from + (1 - from) * s;
  const ty = (1 - s) * y;
  const tx = (1 - s) * x;
  const sc = scale + (1 - scale) * s;
  const blurVal = blur * (1 - s);

  return (
    <div
      style={{
        opacity,
        transform: `translate(${tx}px, ${ty}px) scale(${sc})`,
        filter: blur > 0 ? `blur(${blurVal}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── KineticHeadline ───────────────────────────────────────────────────────────
// Splits text on spaces; each word springs up with blur-in, staggered by
// `stagger` frames. An optional `accentWord` color-snaps to `accentColor`
// with a 1-frame glow burst when it lands.
export const KineticHeadline: React.FC<{
  text: string;
  accentWord?: string;
  accentColor?: string;
  stagger?: number;
  delay?: number;
  /** Use softer SPRING.settle instead of SPRING.enter for the word springs. */
  soft?: boolean;
  style?: React.CSSProperties;
}> = ({
  text,
  accentWord,
  accentColor = COLORS.glow,
  stagger = 4,
  delay = 0,
  soft = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  const cfg = soft ? SPRING.settle : SPRING.enter;

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.28em", ...style }}>
      {words.map((word, i) => {
        const wordDelay = delay + i * stagger;
        const s = spring({ frame: frame - wordDelay, fps, config: cfg });
        const ty = (1 - s) * 28;
        const blurVal = (1 - s) * 8;
        const isAccent = accentWord && word.replace(/[.,!?]/g, "") === accentWord;

        // 1-frame glow snap: detect the frame when the spring first crosses 0.9
        const sPrev = spring({ frame: frame - wordDelay - 1, fps, config: cfg });
        const snapping = isAccent && sPrev < 0.9 && s >= 0.9;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: Math.min(1, s * 1.3),
              transform: `translateY(${ty}px)`,
              filter: `blur(${blurVal}px)`,
              color: isAccent ? accentColor : undefined,
              textShadow: snapping
                ? `0 0 40px ${accentColor}cc, 0 0 16px ${accentColor}88`
                : isAccent && s > 0.9
                ? `0 0 18px ${accentColor}55`
                : undefined,
              transition: snapping ? "none" : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// ── StaggerGroup / StaggerItem ────────────────────────────────────────────────
// Wraps children in a cascade. Each child is wrapped in StaggerItem which
// receives its index via React.Children.map.
const StaggerCtx = React.createContext<{
  each: number;
  delay: number;
  springConfig: { damping: number; mass: number; stiffness: number };
}>({ each: 6, delay: 0, springConfig: SPRING.enter });

export const StaggerGroup: React.FC<{
  /** Frames between each child's entrance. Default 6. */
  each?: number;
  /** Spring physics config. Defaults to SPRING.enter. */
  spring?: { damping: number; mass: number; stiffness: number };
  /** Overall delay in frames before the first child starts. Default 0. */
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ each = 6, spring: springConfig = SPRING.enter, delay = 0, children, style }) => (
  <StaggerCtx.Provider value={{ each, delay, springConfig }}>
    <div style={style}>{children}</div>
  </StaggerCtx.Provider>
);

export const StaggerItem: React.FC<{
  /** Zero-based index within the group. Required. */
  index: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ index, y = 30, children, style }) => {
  const { each, delay, springConfig } = React.useContext(StaggerCtx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const itemDelay = delay + index * each;
  const s = spring({ frame: frame - itemDelay, fps, config: springConfig });

  return (
    <div
      style={{
        opacity: Math.min(1, s * 1.2),
        transform: `translateY(${(1 - s) * y}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Camera ─────────────────────────────────────────────────────────────────────
// Slow continuous scale push (1.0 → 1.04 by default) plus a gentle drift
// across the whole scene's duration. Uses EASE.inOut so the motion is
// imperceptible at rest and builds smoothly.
export const Camera: React.FC<{
  /** [startScale, endScale]. Default [1, 1.04]. */
  push?: [number, number];
  /** Max drift in px (applied to Y). Default 6. */
  drift?: number;
  children: React.ReactNode;
}> = ({ push = [1, 1.04], drift = 6, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });

  const scale = push[0] + (push[1] - push[0]) * t;
  const dy = drift * Math.sin(t * Math.PI); // arc: 0 → drift → 0

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${dy}px)`,
        transformOrigin: "center center",
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
};

// ── Bloom ─────────────────────────────────────────────────────────────────────
// Radial light cast behind an element. Position absolutely around the target.
export const Bloom: React.FC<{
  /** 0–1 progress driving the bloom size and opacity. */
  progress: number;
  color?: string;
  /** Max diameter of the bloom in px. Default 400. */
  size?: number;
  style?: React.CSSProperties;
}> = ({ progress, color = COLORS.glow, size = 400, style }) => {
  const diameter = size * progress;
  const opacity = 0.55 * progress;

  return (
    <div
      style={{
        position: "absolute",
        width: diameter,
        height: diameter,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}88 0%, ${color}33 40%, transparent 70%)`,
        transform: "translate(-50%, -50%)",
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
};

// ── TypeOn ────────────────────────────────────────────────────────────────────
// Reveals text character-by-character. Optionally shows a blinking glow cursor.
export const TypeOn: React.FC<{
  text: string;
  /** Frames per character. Default 2. */
  speed?: number;
  /** Show a blinking glow cursor after the last typed character. */
  cursor?: boolean;
  style?: React.CSSProperties;
}> = ({ text, speed = 2, cursor = false, style }) => {
  const frame = useCurrentFrame();
  const charsVisible = Math.min(text.length, Math.floor(frame / speed));
  const cursorOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style}>
      {text.slice(0, charsVisible)}
      {cursor && charsVisible >= text.length && (
        <span
          style={{
            display: "inline-block",
            width: "0.5em",
            height: "1em",
            background: COLORS.glow,
            marginLeft: 2,
            verticalAlign: "text-bottom",
            opacity: cursorOn ? 1 : 0,
            boxShadow: cursorOn ? `0 0 12px ${COLORS.glow}cc` : undefined,
          }}
        />
      )}
    </span>
  );
};

// ── ClipReveal ────────────────────────────────────────────────────────────────
// Wipes in content via CSS clipPath inset. `from` controls the direction:
// "top" | "bottom" (default) | "left" | "right".
export const ClipReveal: React.FC<{
  /** 0–1 progress of the wipe. */
  progress: number;
  from?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ progress, from = "bottom", children, style }) => {
  // inset(top right bottom left)
  let clip: string;
  const p = (1 - progress) * 100;
  switch (from) {
    case "top":    clip = `inset(0 0 ${p}% 0)`; break;
    case "left":   clip = `inset(0 ${p}% 0 0)`; break;
    case "right":  clip = `inset(0 0 0 ${p}%)`; break;
    default:       clip = `inset(${p}% 0 0 0)`;
  }

  return (
    <div style={{ clipPath: clip, ...style }}>
      {children}
    </div>
  );
};

// ── CountUp ───────────────────────────────────────────────────────────────────
// Eased number tick from `from` to `to` over `durationInFrames`.
export const CountUp: React.FC<{
  to: number;
  suffix?: string;
  from?: number;
  durationInFrames: number;
  easing?: (t: number) => number;
  style?: React.CSSProperties;
}> = ({ to, suffix = "", from = 0, durationInFrames, easing = EASE.out, style }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

  return (
    <span style={style}>
      {Math.round(value)}
      {suffix}
    </span>
  );
};

// ── FadeUp (back-compat, now uses EASE.out) ───────────────────────────────────
// Fade + rise in, with an optional hold-then-fade out window.
// Props are IDENTICAL to the original — existing scenes compile unchanged.
export const FadeUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  out?: [number, number];
  style?: React.CSSProperties;
}> = ({ children, delay = 0, y = 40, duration = 18, out, style }) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
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

// ── Pop (back-compat, now uses SPRING.pop) ────────────────────────────────────
// Spring-based pop scale, good for emphatic entrances.
// Props are IDENTICAL to the original — existing scenes compile unchanged.
export const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number;
  from?: number;
  style?: React.CSSProperties;
  damping?: number;
}> = ({ children, delay = 0, from = 0.6, style, damping = 12 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Use SPRING.pop as the base but let the `damping` prop override for callers
  // that explicitly pass it (back-compat: Problem.tsx uses default damping=12
  // which matches SPRING.pop.damping so behaviour is unchanged).
  const s = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRING.pop, damping },
  });
  const scale = from + (1 - from) * s;
  return (
    <div style={{ transform: `scale(${scale})`, opacity: Math.min(1, s * 1.4), ...style }}>
      {children}
    </div>
  );
};

// ── Center (unchanged) ────────────────────────────────────────────────────────
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
