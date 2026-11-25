import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';
import { CountBadge } from '../feedback/CountBadge.jsx';

// Neutral tile; only the glyph of a red or amber alert keeps its colour, since that is the message.
const TINT = { red: ['var(--tk-surface-sunk)', 'var(--tk-danger)'],
               amber: ['var(--tk-surface-sunk)', 'var(--tk-warning-ink)'],
               blue: ['var(--tk-surface-sunk)', 'var(--tk-ink-500)'],
               green: ['var(--tk-surface-sunk)', 'var(--tk-ink-500)'] };

/** "Alerts & Pending Actions": tinted glyph, what needs doing, the count, the permitted action. */
export function AlertRow({ icon = 'triangle-alert', tone = 'red', title, description, count, action, style }) {
  const [bg, fg] = TINT[tone] || TINT.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', ...style }}>
      <span style={{ width: 32, height: 32, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg, boxShadow: 'inset 0 0 0 1px var(--tk-line)',
                     display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <Icon name={icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{title}</span>
        {description && <span className="tk-meta">{description}</span>}
      </div>
      {count != null && <CountBadge count={count} tone={tone === 'amber' ? 'warning' : 'danger'} />}
      {action}
    </div>
  );
}
