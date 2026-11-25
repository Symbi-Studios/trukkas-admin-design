import React from "react";
import { Card } from "../core/Card.jsx";
import { Icon } from "../../assets/icons/Icon.jsx";
import { shortMoneyValue } from "./ShortMoney.jsx";

/**
 * The KPI tile that opens every console page: a quiet label (with an optional muted glyph),
 * the figure, then the change and a caption. The number carries the card; colour is kept for
 * the change alone, so it means something when it appears.
 *  - `tint` is accepted for older call sites and ignored.
 *  - `labelPosition="bottom"` is the minimal variant: label under the value, no caption.
 */
export function StatCard({
  icon,
  tint: _tint,
  label,
  value,
  delta,
  direction = "up",
  higherIsBetter = true,
  caption,
  sparkline,
  layout: _layout,
  labelPosition = "top",
  style,
}) {
  // Naira amounts are shortened (₦750.6k, ₦25.6m) so tiles fit smaller desktops; the full figure stays on hover.
  const shown = shortMoneyValue(value);
  // Colour says whether the change is good, not which way it moved: a rise in cancellations is bad.
  const flat = direction == null || /^[+-]?0+(\.0+)?\s*(%|pts?)?$/i.test(String(delta ?? "").trim());
  const good = (direction !== "down") === higherIsBetter;
  const deltaColor = flat ? "var(--tk-ink-400)" : good ? "var(--tk-success)" : "var(--tk-danger)";
  const labelBelow = labelPosition === "bottom";

  const labelEl = (
    <span className="tk-stat-label">
      {icon && !labelBelow && <Icon name={icon} size={14} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );

  return (
    <Card className="tk-stat-card" style={style}>
      {!labelBelow && labelEl}
      <span className="tk-metric tk-stat-value">{shown}</span>
      {labelBelow && labelEl}
      {!labelBelow && (delta || caption) && (
        <span className="tk-stat-foot">
          {delta && (
            <span className="tk-stat-delta" style={{ color: deltaColor }}>
              {direction != null && !flat && <Icon name={direction === "down" ? "arrow-down" : "arrow-up"} size={12} aria-hidden="true" />}
              {delta}
            </span>
          )}
          {caption && <span className="tk-stat-caption">{caption}</span>}
        </span>
      )}
      {sparkline}
    </Card>
  );
}
