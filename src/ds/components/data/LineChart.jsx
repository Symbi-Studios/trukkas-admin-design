import React from 'react';

/** Multi-series line/area chart with a light dashed grid. series = [{ name, color, points:number[] }]
 *  With no points, or nothing but zeros, it draws the baseline and `emptyLabel` instead of a flat line
 *  over a grid of identical ticks. */
export function LineChart({ series = [], labels = [], height = 200, area = false, yTicks = 5, format = (value) => Math.round(value), emptyLabel = 'No activity in this period', style }) {
  const W = 640, H = height, padL = 34, padB = 24, padT = 10, padR = 6;
  const all = series.flatMap(s => s.points);
  const max = Math.max(1, ...all);
  const step = (W - padL - padR) / Math.max(1, (labels.length || all.length) - 1);
  const y = v => padT + (1 - v / max) * (H - padT - padB);
  const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + (padL + i * step) + ' ' + y(p)).join(' ');
  const empty = !all.some((v) => Number.isFinite(v) && v !== 0);
  if (empty) {
    // Zeros mean a quiet period; no numbers at all means the data didn't arrive.
    const message = all.some(Number.isFinite) ? emptyLabel : 'Data unavailable';
    return (
      <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" height={H} style={style} role="img" aria-label={message}>
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--tk-line-strong)" />
        <text x={(padL + W - padR) / 2} y={(H - padB) / 2 + 4} textAnchor="middle"
              style={{ font: '500 13px var(--tk-font-sans)', fill: 'var(--tk-ink-400)' }}>{message}</text>
        {labels.map((l, i) => (
          <text key={l + i} x={padL + i * step} y={H - 6} textAnchor="middle"
                style={{ font: '400 10px var(--tk-font-sans)', fill: 'var(--tk-ink-400)' }}>{l}</text>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" height={H} style={style}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (max / yTicks) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--tk-line)" strokeDasharray="3 4" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end"
                  style={{ font: '400 10px var(--tk-font-sans)', fill: 'var(--tk-ink-300)' }}>
              {format(v)}
            </text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const col = s.color || 'var(--tk-viz-' + ((i % 6) + 1) + ')';
        return (
          <g key={s.name || i}>
            {area && (
              <path d={path(s.points) + ' L ' + (padL + (s.points.length - 1) * step) + ' ' + y(0) +
                        ' L ' + padL + ' ' + y(0) + ' Z'} fill={col} opacity="0.07" />
            )}
            <path d={path(s.points)} fill="none" stroke={col} strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" />
            {s.points.map((p, j) => <circle key={j} cx={padL + j * step} cy={y(p)} r="2.6" fill={col} />)}
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={l + i} x={padL + i * step} y={H - 6} textAnchor="middle"
              style={{ font: '400 10px var(--tk-font-sans)', fill: 'var(--tk-ink-400)' }}>{l}</text>
      ))}
    </svg>
  );
}
