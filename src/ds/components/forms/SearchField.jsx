import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Wide search input. variant="global" is the top-bar field with the ⌘K hint. */
export function SearchField({ placeholder = 'Search…', variant = 'panel', shortcut = '⌘ K', style, className, ...rest }) {
  const [f, setF] = React.useState(false);
  const global = variant === 'global';
  return (
    <div className={className} style={{
      display: 'flex', alignItems: 'center', gap: 10, height: 'var(--tk-h-search)',
      padding: '0 12px', background: global ? 'var(--tk-surface-sunk)' : '#fff',
      border: '1px solid ' + (f ? 'var(--tk-blue)' : global ? 'transparent' : 'var(--tk-line-strong)'),
      borderRadius: 'var(--tk-r-md)', boxShadow: f ? 'var(--tk-focus-ring)' : 'none',
      transition: 'var(--tk-transition)', ...style,
    }}>
      <Icon name="search" size={16} color="var(--tk-ink-300)" />
      <input placeholder={placeholder} onFocus={() => setF(true)} onBlur={() => setF(false)} {...rest}
             style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', minWidth: 0,
                      font: '400 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }} />
      {global && (
        <kbd style={{ font: '500 11px/1 var(--tk-font-sans)', color: 'var(--tk-ink-400)',
                      background: '#fff', border: '1px solid var(--tk-line-strong)',
                      borderRadius: 6, padding: '4px 6px' }}>{shortcut}</kbd>
      )}
    </div>
  );
}
