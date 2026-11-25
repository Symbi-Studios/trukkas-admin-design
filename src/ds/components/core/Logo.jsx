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
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
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
              font: "700 17px/22px var(--tk-font-sans)",
              letterSpacing: "-0.3px",
              color: onDark ? "#fff" : "var(--tk-ink-900)",
            }}
          >
            Trukkas
          </div>
        </div>
      )}
    </div>
  );
}
