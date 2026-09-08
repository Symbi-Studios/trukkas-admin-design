import React from 'react';

/** The filter strip above a table: search on the left, filter dropdowns, then a clear link. */
export function TableToolbar({ search, filters, trailing, onClear, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '14px var(--tk-card-pad)', ...style }}>
      {search && <div style={{ flex: '1 1 280px', minWidth: 200 }}>{search}</div>}
      {filters}
      <div style={{ flex: 1 }} />
      {trailing}
      {onClear && (
        <button type="button" onClick={onClear}
          style={{ border: 0, background: 'transparent', cursor: 'pointer',
                   font: '600 13px/1 var(--tk-font-sans)', color: 'var(--tk-orange)' }}>
          Clear All
        </button>
      )}
    </div>
  );
}
