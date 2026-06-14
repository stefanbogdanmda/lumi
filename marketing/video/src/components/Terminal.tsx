import React from "react";
import { COLORS, MONO, FONT } from "../theme";

export type Line = {
  text: string;
  kind?: "prompt" | "claude" | "code" | "dim" | "comment";
  highlight?: string; // a substring to mark as "scary jargon"
};

const lineColor = (kind?: Line["kind"]) => {
  switch (kind) {
    case "prompt":
      return COLORS.teal;
    case "claude":
      return COLORS.ink;
    case "code":
      return "#C8D2FF";
    case "comment":
      return COLORS.inkFaint;
    case "dim":
      return COLORS.inkSoft;
    default:
      return COLORS.ink;
  }
};

const renderText = (line: Line) => {
  if (!line.highlight || !line.text.includes(line.highlight)) {
    return line.text;
  }
  const [before, after] = line.text.split(line.highlight);
  return (
    <>
      {before}
      <span
        style={{
          color: COLORS.danger,
          background: "rgba(255,107,129,0.14)",
          borderBottom: `2px solid ${COLORS.danger}`,
          padding: "0 4px",
          borderRadius: 4,
        }}
      >
        {line.highlight}
      </span>
      {after}
    </>
  );
};

// A macOS-style window framing a Claude Code session.
export const Terminal: React.FC<{
  title?: string;
  lines: Line[];
  visibleLines: number; // how many lines are revealed
  width?: number;
  showCursor?: boolean;
}> = ({ title = "claude code", lines, visibleLines, width = 980, showCursor = true }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        overflow: "hidden",
        background: "rgba(8, 11, 28, 0.92)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow:
          "0 40px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 80px rgba(91,168,255,0.08)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 22px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 9 }}>
          <Dot c="#FF5F57" />
          <Dot c="#FEBC2E" />
          <Dot c="#28C840" />
        </div>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: 19,
            color: COLORS.inkFaint,
            fontWeight: 500,
          }}
        >
          {title}
        </div>
        <div style={{ width: 54 }} />
      </div>
      {/* body */}
      <div style={{ padding: "26px 30px", fontFamily: MONO, fontSize: 24, lineHeight: 1.7 }}>
        {lines.slice(0, visibleLines).map((line, i) => (
          <div key={i} style={{ color: lineColor(line.kind), display: "flex" }}>
            {line.kind === "prompt" && (
              <span style={{ color: COLORS.glow, marginRight: 12 }}>›</span>
            )}
            {line.kind === "claude" && (
              <span style={{ color: COLORS.amberDeep, marginRight: 12 }}>⏺</span>
            )}
            <span style={{ whiteSpace: "pre-wrap" }}>{renderText(line)}</span>
            {showCursor && i === visibleLines - 1 && (
              <Cursor />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <div style={{ width: 15, height: 15, borderRadius: "50%", background: c }} />
);

const Cursor: React.FC = () => (
  <span
    style={{
      display: "inline-block",
      width: 11,
      height: 26,
      marginLeft: 4,
      background: COLORS.glow,
      borderRadius: 2,
      transform: "translateY(4px)",
      boxShadow: `0 0 12px ${COLORS.glow}`,
    }}
  />
);
