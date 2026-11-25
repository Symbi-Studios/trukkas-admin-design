'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Avatar, Badge, Button, Icon, Pagination, Skeleton } from '../../ds.js';
import { Link, useNavigate } from '../../router.js';
import { useGetAdminVerificationDirectoryQuery, verificationDetailUrl } from '../../store/features/verification/verificationApi.js';
import { useVerificationOperations } from '../../store/features/verification/useVerificationOperations.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { NewVerificationDialog } from './VerificationDialogs.jsx';
import {
  DEFAULT_QUEUE, KINDS, QUEUES, STATUS_TONE, ago, expiryLabel, inQueue, matchesSearch, queueStats, sortForQueue, subjectLabel,
} from './verificationQueue.js';
import styles from './Verification.module.css';

const EMPTY = [];
const PAGE_SIZE = 25;

export function VerificationQueue() {
  // Remount on account switch so no rows from another admin linger.
  const scope = useSelector((state) => [state.auth.admin?.id, state.auth.admin?.role, Boolean(state.auth.accessToken)].join(':'));
  return <QueueScreen key={scope} />;
}

function QueueRow({ row }) {
  const p = row.progress;
  const expiry = expiryLabel(row);
  const pct = p && p.total ? Math.round((p.completed / p.total) * 100) : null;
  return (
    <li>
      <Link to={verificationDetailUrl(row)} className={styles.row}>
        <Avatar name={row.entityName} size={28} />
        <span className={styles.entity}>
          <strong>{row.entityName}</strong>
          <span>{subjectLabel(row)}{row.documentType ? <em> · {row.kind}</em> : null}</span>
        </span>
        {row.open && p ? (
          <span className={styles.progress} title={`${p.completed} verified, ${p.inReview} in review, ${p.pending} pending`}>
            <span className={styles.progressText}>{p.completed} of {p.total} checked</span>
            <span className={styles.track} data-done={pct === 100 || undefined}><span style={{ width: `${pct ?? 0}%` }} /></span>
          </span>
        ) : row.open ? <span className={styles.muted}>—</span>
          : <span className={styles.muted} title={row.reviewedOn}>{row.reviewedOn !== '—' ? `Decided ${row.reviewedOn.split(',').slice(0, 2).join(',')}` : 'Decided'}</span>}
        <span className={styles.flags}>
          {expiry && <Badge tone={expiry.tone}>{expiry.text}</Badge>}
          {row.riskCode && row.riskCode !== 'LOW' && <Badge tone={row.riskCode === 'HIGH' ? 'danger' : 'warning'}>{row.riskLevel} risk</Badge>}
          {row.overdue && <Badge tone="danger">Overdue</Badge>}
        </span>
        <span><Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{row.status}</Badge></span>
        <span className={styles.age} title={`Submitted ${row.submittedOn}`}>{ago(row.submittedAtRaw)}</span>
        <Icon name="chevron-right" size={14} className={styles.chev} aria-hidden="true" />
      </Link>
    </li>
  );
}

function QueueScreen() {
  const params = useSearchParams();
  const navigate = useNavigate();
  const operations = useVerificationOperations();
  const queue = QUEUES.some((item) => item.id === params.get('queue')) ? params.get('queue') : DEFAULT_QUEUE;
  const kind = KINDS.includes(params.get('kind')) ? params.get('kind') : null;
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const directory = useGetAdminVerificationDirectoryQuery({ owner: operations.owner, role: operations.role },
    { skip: !operations.authenticated, refetchOnMountOrArgChange: true, refetchOnFocus: true });
  const rows = !operations.authenticated || directory.error ? EMPTY : directory.currentData || EMPTY;
  const loading = directory.isLoading || (directory.isFetching && !directory.currentData);

  const setUrl = (next) => {
    const merged = { queue, kind, ...next };
    const search = new URLSearchParams();
    if (merged.queue && merged.queue !== DEFAULT_QUEUE) search.set('queue', merged.queue);
    if (merged.kind) search.set('kind', merged.kind);
    const query = search.toString();
    navigate('/verification' + (query ? `?${query}` : ''), { replace: true });
    setPage(1);
  };

  const term = q.trim();
  const queueRows = React.useMemo(() => rows.filter((row) => inQueue(row, queue)), [rows, queue]);
  const visible = React.useMemo(() => sortForQueue(queueRows.filter((row) => (!kind || row.kind === kind) && matchesSearch(row, term)), queue), [queueRows, kind, term, queue]);
  const counts = React.useMemo(() => Object.fromEntries(QUEUES.map((item) => [item.id, rows.filter((row) => inQueue(row, item.id)).length])), [rows]);
  const kindCounts = React.useMemo(() => Object.fromEntries(KINDS.map((k) => [k, queueRows.filter((row) => row.kind === k).length])), [queueRows]);
  const stats = React.useMemo(() => queueStats(rows), [rows]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const metric = (value, render = (v) => v.toLocaleString('en-NG')) => (loading ? <Skeleton as="span" width={20} height={12} /> : directory.error || value == null ? '—' : render(value));
  const activeQueue = QUEUES.find((item) => item.id === queue);

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <header className={styles.head}>
        <div>
          <h1 className="tk-display">Verification</h1>
          <p className={styles.headStats}>
            <span><strong>{metric(stats.review)}</strong> need review</span>
            <span><strong>{metric(stats.expiring)}</strong> expiring or expired</span>
            <span><strong>{metric(stats.decidedWeek)}</strong> decided this week</span>
            <span><strong>{metric(stats.medianWait, (d) => `${d}d`)}</strong> median wait</span>
          </p>
        </div>
        <div className={styles.headActions}>
          <Button variant="outline" icon="download" loading={operations.downloading} disabled={!operations.authenticated} onClick={() => operations.download(null, 'report', term ? { search: term } : undefined)}>Export</Button>
          {operations.canManage && <Button icon="plus" onClick={() => setCreating(true)}>Open case</Button>}
        </div>
      </header>

      <section className={styles.frame} aria-label="Verification queue">
        <div className={styles.bar} role="tablist" aria-label="Queues">
          {QUEUES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === queue} className={styles.queueTab} onClick={() => setUrl({ queue: item.id })}>
              {item.label}
              {!loading && !directory.error && <span className={styles.count}>{counts[item.id]}</span>}
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <label className={styles.search}>
            <Icon name="search" size={14} aria-hidden="true" />
            <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Search name, RC number or document…" aria-label="Search verifications" />
            {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><Icon name="x" size={12} aria-hidden="true" /></button>}
          </label>
          <div className={styles.chips} role="group" aria-label="Filter by kind">
            <button type="button" className={styles.chip} aria-pressed={!kind} onClick={() => setUrl({ kind: null })}>All kinds</button>
            {KINDS.map((k) => (
              <button key={k} type="button" className={styles.chip} aria-pressed={kind === k} onClick={() => setUrl({ kind: kind === k ? null : k })}>
                {k}{!loading && <span className={styles.chipCount}>{kindCounts[k]}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.skeletonRow}><Skeleton width={28} height={28} style={{ borderRadius: 999 }} /><Skeleton width="50%" height={12} /><Skeleton width="80%" height={8} /></div>)}
          </div>
        ) : directory.error ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true"><Icon name="cloud-off" size={18} /></span>
            <strong>Couldn’t load verifications</strong>
            <span>{getApiErrorMessage(directory.error)}</span>
            <Button variant="outline" size="sm" onClick={() => directory.refetch()}>Try again</Button>
          </div>
        ) : !visible.length ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true"><Icon name={term ? 'search-x' : queue === 'review' ? 'circle-check' : 'inbox'} size={18} /></span>
            <strong>{term || kind ? 'No matches' : queue === 'review' ? 'Nothing waiting for review' : 'Nothing here'}</strong>
            <span>{term || kind ? `Nothing in ${activeQueue.label.toLowerCase()} matches these filters.` : queue === 'review' ? 'New submissions will show up here.' : 'Items will appear here when they qualify.'}</span>
            {(term || kind) && <Button variant="outline" size="sm" onClick={() => { setQ(''); setUrl({ kind: null }); }}>Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className={styles.colHead} aria-hidden="true">
              <span /><span>Entity</span><span>{queue === 'decided' ? 'Decision' : 'Progress'}</span><span>Flags</span><span>Status</span><span>Age</span><span />
            </div>
            <ul className={styles.rows}>{paged.map((row) => <QueueRow key={row.key} row={row} />)}</ul>
          </>
        )}
        {!loading && !directory.error && visible.length > PAGE_SIZE && (
          <div style={{ borderTop: '1px solid var(--tk-line)' }}>
            <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} pageCount={pageCount} onPage={(next) => setPage(Math.max(1, Math.min(next, pageCount)))} />
          </div>
        )}
        {!loading && !directory.error && visible.length > 0 && visible.length <= PAGE_SIZE && (
          <div className={styles.foot}><span>{visible.length} {visible.length === 1 ? 'item' : 'items'}</span><span>{queue === 'review' ? 'Oldest first' : queue === 'decided' ? 'Most recent decision first' : queue === 'expiring' ? 'Soonest expiry first' : 'Newest first'}</span></div>
        )}
      </section>

      {creating && <NewVerificationDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
