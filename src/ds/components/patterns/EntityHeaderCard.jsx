import React from 'react';
import { Card } from '../core/Card.jsx';
import { Avatar } from '../core/Avatar.jsx';

/** Identity block at the top of a detail page: avatar, name, badges, then a row of fact columns. */
export function EntityHeaderCard({ name, avatar, initials, badges, subtitle, facts = [], actions, style }) {
  return (
    <Card style={{ display: 'grid', gap: 18, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        {avatar || <Avatar name={initials || (typeof name === 'string' ? name : '')} size={56} square />}
        <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 className="tk-title" style={{ fontSize: 22 }}>{name}</h2>
            {badges}
          </div>
          {subtitle && <span className="tk-meta">{subtitle}</span>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {facts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          {facts.map((f, i) => (
            <div key={i} style={{ flex: '1 1 150px', padding: '0 18px',
                                  borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4 }}>{f.label}</div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: f.tone || 'var(--tk-ink-900)' }}>
                {f.value}
              </div>
              {f.hint && <div className="tk-meta" style={{ marginTop: 2 }}>{f.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
