import React from 'react';

/** Search and filters on the left; view toggle and actions on the right. */
export function TableToolbar({ search, filters, trailing, viewControl, onClear, style }) {
  return (
    <div className={'tk-table-toolbar' + (viewControl ? ' tk-table-toolbar-views' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '14px var(--tk-card-pad)', ...style }}>
      {search && <div className="tk-table-toolbar-search" style={{ flex: viewControl ? '0 1 300px' : '1 1 280px', minWidth: 200 }}>{search}</div>}
      {filters && <div className="tk-table-toolbar-filters">{filters}{viewControl && onClear && <button type="button" className="tk-clear-filters" onClick={onClear}>Clear all</button>}</div>}
      <div className="tk-table-toolbar-spacer" style={{ flex: 1 }} />
      {(viewControl || trailing) && <div className="tk-table-toolbar-trailing">{viewControl}{trailing}</div>}
      {(!filters || !viewControl) && onClear && <button type="button" className="tk-clear-filters" onClick={onClear}>Clear all</button>}
    </div>
  );
}
