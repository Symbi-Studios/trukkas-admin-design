import React from 'react';

/** The filter strip above a table: search on the left, filter dropdowns, then a clear link. */
export function TableToolbar({ search, filters, trailing, onClear, style }) {
  return (
    <div className="tk-table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '14px var(--tk-card-pad)', ...style }}>
      {search && <div className="tk-table-toolbar-search" style={{ flex: '1 1 280px', minWidth: 200 }}>{search}</div>}
      {filters && <div className="tk-table-toolbar-filters">{filters}</div>}
      <div className="tk-table-toolbar-spacer" style={{ flex: 1 }} />
      {trailing && <div className="tk-table-toolbar-trailing">{trailing}</div>}
      {onClear && (
        <button type="button" className="tk-clear-filters" onClick={onClear}>
          Clear all
        </button>
      )}
    </div>
  );
}
