import React from "react";

/**
 * One 100% bar split into segments, with a legend of count and share underneath.
 * Use instead of a donut: it reads at a glance and still works with one category.
 *  - items = [{ key?, label, value:number|null, display?, color }]
 *  - total: optional; defaults to the sum of the values. Segments draw only when every value is known.
 */
export function BreakdownBar({ items = [], total, format = (v) => v.toLocaleString("en-NG"), showZero = true, showShare = true, style }) {
  const known = items.every((i) => Number.isFinite(i.value));
  const sum = total ?? items.reduce((s, i) => s + (Number.isFinite(i.value) ? i.value : 0), 0);
  const visible = items.filter((i) => showZero || i.value !== 0);
  return (
    <div className="tk-breakdown" style={style}>
      <div className="tk-breakdown-bar" role="img" aria-label={visible.map((i) => `${i.label}: ${Number.isFinite(i.value) ? format(i.value) : "unknown"}`).join(", ")}>
        {known && sum > 0 && visible.filter((i) => i.value > 0).map((i) => (
          <span key={i.key ?? i.label} title={`${i.label}: ${format(i.value)}`} style={{ flexGrow: i.value, background: i.color }} />
        ))}
      </div>
      <ul className="tk-breakdown-legend">
        {visible.map((i) => (
          <li key={i.key ?? i.label}>
            <i style={{ background: i.color }} aria-hidden="true" />
            <span className="tk-breakdown-label">{i.label}</span>
            <strong>{i.display ?? (Number.isFinite(i.value) ? format(i.value) : "—")}</strong>
            <span className="tk-breakdown-share">{showShare && known && sum > 0 && Number.isFinite(i.value) ? `${((i.value / sum) * 100).toLocaleString("en-NG", { maximumFractionDigits: 1 })}%` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
