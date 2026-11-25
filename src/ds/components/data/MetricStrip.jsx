import React from "react";
import { Icon } from "../../assets/icons/Icon.jsx";

/**
 * A row of headline metrics in one bordered panel, split by hairlines (no per-metric cards).
 * When `onSelect` is given each metric is a toggle that picks what the chart below shows.
 *  - items = [{ key, label, value, change?, direction?: "up"|"down"|null, higherIsBetter?, caption?, definition? }]
 *  - change: already formatted ("12%", "+2"); coloured only when direction is set and it isn't zero.
 */
export function MetricStrip({ items = [], selected, onSelect, columns, dimmed = false, style }) {
  const interactive = typeof onSelect === "function";
  return (
    <div className="tk-metric-strip" role={interactive ? "tablist" : undefined}
      style={{ ...(columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : null), opacity: dimmed ? 0.6 : 1, ...style }}>
      {items.map((item) => {
        const on = interactive && item.key === selected;
        const flat = item.direction == null || /^[+−-]?0+(\.0+)?\s*%?$/.test(String(item.change ?? "").trim());
        const good = (item.direction !== "down") === (item.higherIsBetter !== false);
        const tone = flat ? "flat" : good ? "good" : "bad";
        const body = (
          <>
            <span className="tk-metric-strip-label">
              <span className={item.definition ? "tk-defined" : undefined} title={item.definition || undefined}>{item.label}</span>
            </span>
            <span className="tk-metric-strip-value">{item.value}</span>
            <span className="tk-metric-strip-foot">
              {item.change && (
                <span className="tk-metric-strip-change" data-tone={tone}>
                  {!flat && <Icon name={item.direction === "down" ? "arrow-down-right" : "arrow-up-right"} size={12} aria-hidden="true" />}
                  {item.change}
                </span>
              )}
              {item.caption && <span>{item.caption}</span>}
            </span>
          </>
        );
        return interactive ? (
          <button key={item.key} type="button" role="tab" aria-selected={on} className={"tk-metric-strip-item" + (on ? " active" : "")}
            onClick={() => onSelect(item.key)}>{body}</button>
        ) : <div key={item.key} className="tk-metric-strip-item">{body}</div>;
      })}
    </div>
  );
}
