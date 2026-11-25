import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

// One quiet tile for every row: the title says what it is, and the value carries any urgency.
// `iconTint` is accepted for older call sites and ignored.
const TILE = ['var(--tk-surface-sunk)', 'var(--tk-ink-500)'];

/** Rail list row: neutral icon tile, title + sub-line, trailing value, optional chevron. */
export function ListRow({ icon, iconTint = 'blue', avatar, title, subtitle, value, valueTone,
                          caption, trailing, chevron, onClick, style }) {
  const [bg, fg] = TILE;
  const [hot, setHot] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', margin: '0 -8px',
               borderRadius: 'var(--tk-r-sm)', cursor: onClick ? 'pointer' : 'default',
               background: hot && onClick ? 'var(--tk-surface-sunk)' : 'transparent',
               transition: 'var(--tk-transition)', ...style }}>
      {avatar || (icon && (
        <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: bg, color: fg, boxShadow: 'inset 0 0 0 1px var(--tk-line)',
                       display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={17} />
        </span>
      ))}
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)',
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle && <span className="tk-meta">{subtitle}</span>}
      </div>
      {(value || caption) && (
        <div style={{ textAlign: 'right', display: 'grid', gap: 2 }}>
          {value && <span style={{ font: '600 13px/18px var(--tk-font-sans)',
                                   color: valueTone || 'var(--tk-ink-900)' }}>{value}</span>}
          {caption && <span className="tk-meta">{caption}</span>}
        </div>
      )}
      {trailing}
      {chevron && <Icon name="chevron-right" size={15} color="var(--tk-ink-300)" />}
    </div>
  );
}
