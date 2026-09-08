import React from 'react';
import { Breadcrumbs } from './Breadcrumbs.jsx';

/** Title block: breadcrumbs, 28/700 title, one-line description, right-hand actions. */
export function PageHeader({ crumbs, title, description, actions, meta, style }) {
  return (
    <div style={{ display: 'grid', gap: 10, ...style }}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="tk-display">{title}</h1>
            {meta}
          </div>
          {description && (
            <p style={{ margin: 0, font: '400 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </div>
  );
}
