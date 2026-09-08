import React from 'react';
export function CountBadge({ count, tone = 'danger', style }) {
  const map = { danger: ['var(--tk-danger-solid)', '#fff'], blue: ['var(--tk-blue)', '#fff'],
                soft: ['var(--tk-blue-soft)', 'var(--tk-blue)'],
                warning: ['var(--tk-warning-soft)', 'var(--tk-warning)'] };
  const [bg, fg] = map[tone] || map.danger;
  return (
    <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, background: bg, color: fg,
                   font: '600 11px/20px var(--tk-font-sans)', textAlign: 'center',
                   display: 'inline-block', ...style }}>{count}</span>
  );
}
