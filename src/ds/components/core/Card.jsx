import React from "react";

/** The r14 white surface with a hairline border. Everything on a page sits in one. */
export function Card({ pad = "md", tone = "white", children, style, ...rest }) {
  const pads = {
    none: 0,
    tight: "var(--tk-card-pad-tight)",
    md: "var(--tk-card-pad)",
  };
  const tones = {
    white: {
      background: "var(--tk-surface)",
      border: "1px solid var(--tk-line)",
    },
    sunk: {
      background: "var(--tk-surface-sunk)",
      border: "1px solid transparent",
    },
    cool: {
      background: "var(--tk-surface-cool)",
      border: "1px solid transparent",
    },
    navy: {
      background: "var(--tk-navy)",
      border: "1px solid transparent",
      color: "#fff",
    },
  };
  return (
    <div
      {...rest}
      style={{
        borderRadius: "var(--tk-r-xl)",
        padding: pads[pad] ?? pads.md,
        boxShadow: "var(--tk-shadow-card)",
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
