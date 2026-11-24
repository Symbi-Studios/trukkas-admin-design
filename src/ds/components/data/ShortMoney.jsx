import React from "react";
import { createPortal } from "react-dom";
import { formatNairaAmount, formatNairaShort, parseNairaText } from "../../../lib/money.js";

/**
 * Naira amount for stat tiles: shown short (₦530.7k, -₦1.53m) with the exact figure in a hover/focus tooltip.
 * The tooltip is portalled and fixed-positioned so cards with overflow: hidden can't clip it.
 */
export function ShortMoney({ value }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);
  const amount = typeof value === "number" ? (Number.isFinite(value) ? value : null) : parseNairaText(value);
  if (amount == null) return value ?? "—";
  const full = typeof value === "number" ? formatNairaAmount(value) : value.trim();
  const short = formatNairaShort(amount);
  const show = () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setPos({ x: box.left + box.width / 2, y: box.top });
  };
  const hide = () => setPos(null);
  return (
    <>
      <span ref={ref} tabIndex={0} aria-label={full} className="tk-short-money" style={{ cursor: "help" }}
            onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
        {short}
      </span>
      {pos && typeof document !== "undefined" && createPortal(
        <span role="tooltip" style={{
          position: "fixed", left: pos.x, top: pos.y - 8, transform: "translate(-50%, -100%)",
          background: "var(--tk-navy)", color: "var(--tk-ink-on-navy)", padding: "7px 10px",
          borderRadius: "var(--tk-r-sm)", font: "600 12px/16px var(--tk-font-sans)", letterSpacing: 0,
          whiteSpace: "nowrap", zIndex: "var(--tk-z-popover)", pointerEvents: "none", boxShadow: "var(--tk-shadow-menu)",
          animation: "tk-fade-in var(--tk-dur-fast) var(--tk-ease)",
        }}>{full}</span>,
        document.body,
      )}
    </>
  );
}

/** Shortens a stat value when it's a naira amount; any other value is returned unchanged. */
export function shortMoneyValue(value) {
  return parseNairaText(value) == null ? value : <ShortMoney value={value} />;
}
