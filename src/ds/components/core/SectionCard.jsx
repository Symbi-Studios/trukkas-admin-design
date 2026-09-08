import React from 'react';
import { Card } from './Card.jsx';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Card with the standard 16/600 title row: optional icon, count, right-hand link or control. */
export function SectionCard({ title, icon, count, action, footer, children, pad = 'md', style }) {
  return (
    <Card pad="none" style={{ display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '16px var(--tk-card-pad) 0' }}>
        {icon && <Icon name={icon} size={18} color="var(--tk-blue)" />}
        <h3 className="tk-section" style={{ flex: 1 }}>{title}</h3>
        {count != null && (
          <span style={{ font: '600 12px/1 var(--tk-font-sans)', color: 'var(--tk-blue)',
                         background: 'var(--tk-blue-soft)', padding: '4px 8px',
                         borderRadius: 'var(--tk-r-xs)' }}>{count}</span>
        )}
        {action}
      </div>
      <div style={{ padding: pad === 'none' ? 0 : '14px var(--tk-card-pad) var(--tk-card-pad)', flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {footer && (
        <div style={{ borderTop: '1px solid var(--tk-line)', padding: '12px var(--tk-card-pad)',
                      textAlign: 'center' }}>{footer}</div>
      )}
    </Card>
  );
}
