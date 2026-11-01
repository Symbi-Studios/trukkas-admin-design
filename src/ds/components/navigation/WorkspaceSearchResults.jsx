import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

export function WorkspaceSearchResults({ groups, query, loading, unavailable, active, onActivate, onSelect }) {
  const hits = groups.flatMap(group => group.items);
  return <div id="tk-workspace-search-results" role="listbox" className="tk-scroll" style={{
    position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 100, width: '100%', minWidth: 'min(360px, calc(100vw - 24px))',
    maxHeight: 'min(480px, calc(100dvh - 96px))', overflowY: 'auto', padding: 6, background: '#fff',
    borderRadius: 'var(--tk-r-lg)', border: '1px solid var(--tk-line)', boxShadow: 'var(--tk-shadow-menu)',
  }}>
    {loading ? <div className="tk-meta" role="status" style={{ padding: '14px 10px' }}>Searching…</div> : <>
      {unavailable && <div className="tk-meta" role="status" style={{ padding: '10px' }}>Some results could not be loaded. Please try again.</div>}
      {!hits.length && !unavailable && <div className="tk-meta" style={{ padding: '14px 10px' }}>No results for “{query.trim()}”</div>}
      {groups.map(group => <div key={group.section} role="group" aria-label={group.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 10px 6px', font: '600 10px/14px var(--tk-font-sans)', letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--tk-ink-300)' }}>
          <span>{group.section}</span>{group.total > group.items.length && <span>{group.items.length} of {group.total}</span>}
        </div>
        {group.items.map(item => {
          const index = hits.indexOf(item), selected = index === active;
          return <button id={`tk-workspace-result-${index}`} key={item.key} type="button" role="option" aria-selected={selected}
            onMouseEnter={() => onActivate(index)} onClick={() => onSelect(item)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 0, borderRadius: 'var(--tk-r-sm)', cursor: 'pointer', textAlign: 'left', background: selected ? 'var(--tk-surface-sunk)' : 'transparent' }}>
            <span style={{ width: 30, height: 30, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)', color: 'var(--tk-blue)' }}><Icon name={item.icon} size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'grid' }}>
              <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.meta && <span style={{ font: '400 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.meta}</span>}
            </span>
            {item.tag && <span style={{ flex: '0 0 auto', font: '500 11px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{item.tag}</span>}
          </button>;
        })}
      </div>)}
    </>}
  </div>;
}
