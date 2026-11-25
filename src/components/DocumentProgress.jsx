'use client';
import './DocumentProgress.css';

/**
 * Segmented approval bar: green approved, amber pending, red rejected.
 * `label` toggles the "5 of 12 approved" caption.
 */
export function DocumentProgress({ counts, label = true, size = 'md', style = undefined }) {
  const total = counts?.total || 0;
  const pct = (value) => (total ? (value / total) * 100 : 0);
  const caption = total ? `${counts.approved} of ${total} approved` : 'No documents';
  return (
    <span className={'tk-docprog tk-docprog-' + size} style={style}>
      <span className="tk-docprog-bar" role="img" aria-label={`${caption}, ${counts?.pending || 0} pending, ${counts?.rejected || 0} rejected`}>
        <span className="is-approved" style={{ width: pct(counts?.approved || 0) + '%' }} />
        <span className="is-pending" style={{ width: pct(counts?.pending || 0) + '%' }} />
        <span className="is-rejected" style={{ width: pct(counts?.rejected || 0) + '%' }} />
      </span>
      {label && <span className="tk-docprog-label"><strong>{counts?.approved ?? 0}</strong> of {total} approved</span>}
    </span>
  );
}
