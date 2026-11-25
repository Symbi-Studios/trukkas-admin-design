import React from 'react';

/** Ranked horizontal bars — "Top Routes by Volume".
 *  Each row is a grid with shrinkable tracks, so a long label truncates instead of pushing the
 *  bar and count out of the card. The full label is on hover. */
export function RankBarList({ items = [], numbered = true, color = 'var(--tk-blue)', style }) {
  const max = Math.max(...items.map(i => i.value), 1);
  const columns = (numbered ? '18px ' : '') + 'minmax(0, 40%) minmax(48px, 1fr) auto';
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0, ...style }}>
      {items.map((it, i) => (
        <div key={it.label} style={{ display: 'grid', gridTemplateColumns: columns, alignItems: 'center', gap: 10, minWidth: 0 }}>
          {numbered && <span className="tk-meta" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>}
          <span title={typeof it.label === 'string' ? it.label : undefined}
                style={{ minWidth: 0, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)',
                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ minWidth: 0, height: 6, borderRadius: 999, background: 'var(--tk-viz-track)', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: Math.max(0, Math.min(100, (it.value / max) * 100)) + '%', height: '100%',
                           borderRadius: 999, background: it.color || color }} />
          </span>
          <span style={{ minWidth: 28, textAlign: 'right', font: '600 13px/18px var(--tk-font-sans)',
                         color: 'var(--tk-ink-900)', fontVariantNumeric: 'tabular-nums' }}>{it.display ?? it.value}</span>
        </div>
      ))}
    </div>
  );
}
