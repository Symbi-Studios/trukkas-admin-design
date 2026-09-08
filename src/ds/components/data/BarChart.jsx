import React from 'react';

/** Grouped vertical bars. series = [{ name, color, points:number[] }] */
export function BarChart({ series = [], labels = [], height = 200, format = v => v, style }) {
  const W = 640, H = height, padL = 40, padB = 24, padT = 10;
  const max = Math.max(1, ...series.flatMap(s => s.points));
  const groups = labels.length || series[0]?.points.length || 1;
  const gw = (W - padL - 8) / groups;
  const bw = Math.min(16, (gw - 8) / series.length);
  const y = v => padT + (1 - v / max) * (H - padT - padB);
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" height={H} style={style}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={padL} x2={W - 8} y1={y(max * f)} y2={y(max * f)} stroke="var(--tk-line)" />
          <text x={padL - 8} y={y(max * f) + 4} textAnchor="end"
                style={{ font: '400 10px var(--tk-font-sans)', fill: 'var(--tk-ink-300)' }}>{format(max * f)}</text>
        </g>
      ))}
      {series.map((s, si) => s.points.map((p, i) => (
        <rect key={si + '-' + i}
              x={padL + i * gw + gw / 2 - (series.length * bw) / 2 + si * bw}
              y={y(p)} width={bw - 2} height={Math.max(0, y(0) - y(p))} rx="3"
              fill={s.color || 'var(--tk-viz-' + ((si % 6) + 1) + ')'} />
      )))}
      {labels.map((l, i) => (
        <text key={l + i} x={padL + i * gw + gw / 2} y={H - 6} textAnchor="middle"
              style={{ font: '400 10px var(--tk-font-sans)', fill: 'var(--tk-ink-400)' }}>{l}</text>
      ))}
    </svg>
  );
}
