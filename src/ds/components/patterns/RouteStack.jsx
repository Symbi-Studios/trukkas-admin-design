import React from 'react';

/** Origin → destination stacked vertically with a start dot, end dot and a dashed connector. */
export function RouteStack({ from, to, wrap = false, style }) {
  return (
    <span className={'tk-route' + (wrap ? ' wrap' : '')} style={style}>
      <span className="tk-route-dot" /><span className="tk-route-text" title={from || undefined}>{from || '—'}</span>
      <span className="tk-route-dot end" /><span className="tk-route-text" title={to || undefined}>{to || '—'}</span>
    </span>
  );
}
