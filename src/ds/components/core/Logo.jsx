import React from "react";
import trukkasIcon from "../../assets/icons/trukkas-icon.png";

/** Trukkas mark + wordmark. */
export function Logo({
  showWordmark = true,
  size = 38,
  onDark = false,
  style,
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      <img
        src={trukkasIcon.src || trukkasIcon}
        alt="Trukkas"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          flex: "0 0 auto",
        }}
      />
      {showWordmark && (
        <div style={{ lineHeight: 1.1 }}>
          <div
            style={{
              font: "700 20px/24px var(--tk-font-sans)",
              letterSpacing: "-0.3px",
              color: onDark ? "#fff" : "var(--tk-ink-900)",
            }}
          >
            Trukkas
          </div>
          <div
            style={{
              font: "400 12px/16px var(--tk-font-sans)",
              color: onDark ? "var(--tk-ink-on-navy-dim)" : "var(--tk-ink-400)",
            }}
          >
            Move. Earn. Grow.
          </div>
        </div>
      )}
    </div>
  );
}
