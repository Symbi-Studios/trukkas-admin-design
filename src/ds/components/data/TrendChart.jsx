import React from "react";

const H_PAD = { top: 10, right: 8, bottom: 26 };

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

function useWidth(ref, fallback = 640) {
  const [width, setWidth] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * Time-series chart drawn at its real pixel width, so axis text stays 11px.
 * Hover (or arrow keys when focused) shows a crosshair and one tooltip listing every series.
 *  - series = [{ name, color, points:number[] }]; labels = one per point (short, for the axis)
 *  - tooltipLabels: longer labels for the tooltip (falls back to labels)
 *  - type: "line" | "area" | "bar"
 *  - format: tooltip value; axisFormat: y-axis ticks (defaults to format)
 *  - With no numbers it says "Data unavailable"; with only zeros it shows `emptyLabel`.
 */
export function TrendChart({
  series = [],
  labels = [],
  tooltipLabels,
  type = "line",
  height = 220,
  format = (value) => Math.round(value).toLocaleString("en-NG"),
  axisFormat,
  emptyLabel = "No activity in this period",
  legend = series.length > 1,
  dimmed = false,
  style,
}) {
  const box = React.useRef(null);
  const width = useWidth(box);
  const [hover, setHover] = React.useState(null);
  const tickFormat = axisFormat || format;
  const count = labels.length || Math.max(0, ...series.map((s) => s.points.length));
  const values = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  const empty = !values.some((v) => v !== 0);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const step = niceStep((max - min) / 4 || 1);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const bottom = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  const longest = Math.max(...ticks.map((t) => String(tickFormat(t)).length));
  const left = Math.min(72, 12 + longest * 6.4);
  const plotW = Math.max(1, width - left - H_PAD.right);
  const plotH = Math.max(1, height - H_PAD.top - H_PAD.bottom);
  const y = (v) => H_PAD.top + (1 - (v - bottom) / (top - bottom || 1)) * plotH;
  const bars = type === "bar";
  const band = plotW / Math.max(1, count);
  const x = (i) => (bars ? left + band * i + band / 2 : left + (count <= 1 ? plotW / 2 : (plotW * i) / (count - 1)));
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(plotW / 72))));

  const indexAt = (clientX) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !count) return null;
    const px = clientX - rect.left;
    const raw = bars ? Math.floor((px - left) / band) : Math.round(((px - left) / plotW) * (count - 1));
    return Math.max(0, Math.min(count - 1, raw));
  };

  const onKey = (event) => {
    if (!count) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setHover((h) => Math.max(0, Math.min(count - 1, (h ?? (event.key === "ArrowRight" ? -1 : count)) + (event.key === "ArrowRight" ? 1 : -1))));
    } else if (event.key === "Escape") setHover(null);
  };

  const groupW = Math.min(28, band * 0.7);
  const barW = Math.max(2, (groupW - 2 * (series.length - 1)) / Math.max(1, series.length));
  const path = (points) => points.map((p, i) => (Number.isFinite(p) ? `${i && Number.isFinite(points[i - 1]) ? "L" : "M"}${x(i)} ${y(p)}` : "")).join(" ");
  const tooltipLeft = hover == null ? 0 : Math.min(Math.max(x(hover), 90), width - 90);

  return (
    <div className="tk-trend" style={{ opacity: dimmed ? 0.55 : 1, ...style }}>
      {legend && !empty && (
        <div className="tk-trend-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color, height: bars ? 8 : 2, borderRadius: bars ? 2 : 1 }} aria-hidden="true" />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={box} className="tk-trend-plot" tabIndex={empty ? -1 : 0} onKeyDown={onKey} onBlur={() => setHover(null)}
        onPointerMove={(e) => !empty && setHover(indexAt(e.clientX))} onPointerLeave={() => setHover(null)}
        role="img" aria-label={empty ? (values.length ? emptyLabel : "Data unavailable") : series.map((s) => s.name).join(", ") + " chart. Use arrow keys to read values."}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
          {!empty && ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - H_PAD.right} y1={y(t)} y2={y(t)} stroke="var(--tk-line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={left - 8} y={y(t) + 4} textAnchor="end" className="tk-trend-tick">{tickFormat(t)}</text>
            </g>
          ))}
          {empty && <line x1={left} x2={width - H_PAD.right} y1={height - H_PAD.bottom} y2={height - H_PAD.bottom} stroke="var(--tk-line-strong)" />}
          {labels.map((l, i) => (i % labelEvery === 0 || i === count - 1) && l ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 && !bars ? "start" : i === count - 1 && !bars ? "end" : "middle"} className="tk-trend-tick">{l}</text>
          ) : null)}
          {!empty && hover != null && (bars
            ? <rect x={left + band * hover} y={H_PAD.top} width={band} height={plotH} fill="var(--tk-surface-sunk)" />
            : <line x1={x(hover)} x2={x(hover)} y1={H_PAD.top} y2={H_PAD.top + plotH} stroke="var(--tk-line-strong)" />)}
          {!empty && bars && series.map((s, si) => s.points.map((p, i) => Number.isFinite(p) && p !== 0 ? (
            <rect key={s.name + i} x={x(i) - groupW / 2 + si * (barW + 2)} width={barW}
              y={Math.min(y(p), y(0))} height={Math.max(1, Math.abs(y(0) - y(p)))} rx={Math.min(3, barW / 2)} fill={s.color} />
          ) : null))}
          {!empty && !bars && series.map((s, si) => (
            <g key={s.name}>
              {type === "area" && si === 0 && s.points.every(Number.isFinite) && s.points.length > 1 && (
                <path d={`${path(s.points)} L${x(s.points.length - 1)} ${y(Math.max(0, bottom))} L${x(0)} ${y(Math.max(0, bottom))} Z`} fill={s.color} opacity="0.1" />
              )}
              <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.length === 1 && Number.isFinite(s.points[0]) && <circle cx={x(0)} cy={y(s.points[0])} r="4" fill={s.color} />}
              {hover != null && Number.isFinite(s.points[hover]) && (
                <circle cx={x(hover)} cy={y(s.points[hover])} r="4" fill={s.color} stroke="var(--tk-surface)" strokeWidth="2" />
              )}
            </g>
          ))}
          {empty && (
            <text x={left + plotW / 2} y={H_PAD.top + plotH / 2} textAnchor="middle" className="tk-trend-empty">
              {values.length ? emptyLabel : "Data unavailable"}
            </text>
          )}
        </svg>
        {!empty && hover != null && (
          <div className="tk-trend-tooltip" style={{ left: tooltipLeft }} role="presentation">
            <div className="tk-trend-tooltip-title">{(tooltipLabels || labels)[hover]}</div>
            {series.map((s) => (
              <div key={s.name} className="tk-trend-tooltip-row">
                <i style={{ background: s.color }} aria-hidden="true" />
                <span>{s.name}</span>
                <strong>{Number.isFinite(s.points[hover]) ? format(s.points[hover]) : "—"}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
