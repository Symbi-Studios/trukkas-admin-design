import { CustomSelect } from '../forms/Select.jsx';
import React from 'react';
import { Icon } from '../../assets/icons/Icon.jsx';

/** Page numbers to show: first, last, and the current page with one neighbour each side. */
function pageWindow(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, Math.min(page - 1, pageCount - 4));
  const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < pageCount - 1) pages.push('…');
  pages.push(pageCount);
  return pages;
}

/**
 * Table footer: "Showing 1 to 10 of 240", page buttons, page size.
 * With everything on one page it shows the count alone, so short tables stay quiet.
 */
export function Pagination({ page = 1, pageCount = 1, pageSize = 10, total: rawTotal, onPage, onPageSize, style }) {
  // APIs sometimes send the total as a numeric string; '—' or null means it isn't known.
  const total = typeof rawTotal === 'string' && /^\d+$/.test(rawTotal) ? Number(rawTotal) : rawTotal;
  const known = typeof total === 'number' && Number.isFinite(total);
  const singlePage = pageCount <= 1 && (!known || total <= pageSize);
  // The size switch only matters once there is more than the smallest page.
  const showSize = onPageSize && !(known && total <= 10);
  const go = (p) => { if (p >= 1 && p <= pageCount && p !== page) onPage?.(p); };
  if (singlePage && total == null && !showSize) return null;
  return (
    <div className="tk-pagination" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '12px var(--tk-card-pad)', borderTop: '1px solid var(--tk-line)', ...style }}>
      {total != null && (
        <span className="tk-meta tk-pagination-summary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {!known ? 'Showing —'
            : singlePage ? `${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}`
            : `Showing ${total === 0 ? 0 : (page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {!singlePage && (
        <nav className="tk-pagination-pages" aria-label="Pagination" style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="tk-page-btn" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
            <Icon name="chevron-left" size={15} aria-hidden="true" />
          </button>
          {pageWindow(page, pageCount).map((p, i) => p === '…'
            ? <span key={'gap' + i} className="tk-page-gap" aria-hidden="true">…</span>
            : <button type="button" key={p} className="tk-page-btn" aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`} onClick={() => go(p)}>{p}</button>)}
          <button type="button" className="tk-page-btn" disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label="Next page">
            <Icon name="chevron-right" size={15} aria-hidden="true" />
          </button>
        </nav>
      )}
      {showSize && (
        <CustomSelect className="tk-pagination-size" value={pageSize} onChange={e => onPageSize(Number(e.target.value))}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </CustomSelect>
      )}
    </div>
  );
}
