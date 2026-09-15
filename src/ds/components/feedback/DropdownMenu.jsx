import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/**
 * The "More Actions" sheet. items = [{ label, icon, tone, onClick } | { section: 'MANAGE RULE' } | { divider: true }]
 */
export function DropdownMenu({ items = [], width = 240, open = true, style }) {
  if (!open) return null;
  return (
    <div className="tk-dropdown-menu" role="menu" style={{
      width, padding: 6, background: '#fff', borderRadius: 'var(--tk-r-lg)',
      border: '1px solid var(--tk-line)', boxShadow: 'var(--tk-shadow-menu)',
      animation: 'tk-menu-in var(--tk-dur) var(--tk-ease)', ...style,
    }}>
      {items.map((it, i) => {
        if (it.divider) return <div key={i} style={{ height: 1, background: 'var(--tk-line)', margin: '6px 0' }} />;
        if (it.section) return (
          <div key={i} style={{ padding: '10px 10px 6px', font: '600 10px/14px var(--tk-font-sans)',
                                letterSpacing: '0.6px', textTransform: 'uppercase',
                                color: 'var(--tk-ink-300)' }}>{it.section}</div>
        );
        const danger = it.tone === 'danger';
        return <MenuRow key={i} item={it} danger={danger} />;
      })}
    </div>
  );
}

function MenuRow({ item, danger }) {
  const [hot, setHot] = React.useState(false);
  return (
    <button type="button" role="menuitem" onClick={item.onClick}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
               border: 0, borderRadius: 'var(--tk-r-sm)', cursor: 'pointer', textAlign: 'left',
               background: hot ? (danger ? 'var(--tk-danger-soft)' : 'var(--tk-surface-sunk)') : 'transparent',
               color: danger ? 'var(--tk-danger)' : 'var(--tk-ink-700)',
               font: '500 13px/18px var(--tk-font-sans)', transition: 'var(--tk-transition)' }}>
      {item.icon && <Icon name={item.icon} size={16} />}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.trailing}
    </button>
  );
}
