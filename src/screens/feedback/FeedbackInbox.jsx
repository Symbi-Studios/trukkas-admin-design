'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../../router.js';
import { Button, DropdownMenu, Icon, Skeleton } from '../../ds.js';
import { useGetAdminFeedbackDirectoryQuery } from '../../store/features/feedback/feedbackApi.js';
import { useFeedbackOperations } from '../../store/features/feedback/useFeedbackOperations.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { FeedbackSettingsDialog } from '../FeedbackDialogs.jsx';
import { shortTime, fullTime } from '../support/supportInbox.js';
import { FeedbackPane } from './FeedbackPane.jsx';
import { DEFAULT_QUEUE, QUEUES, STATUS_DOT, TYPES, TYPE_ICON, inQueue, matchesSearch, sortNewest } from './feedbackInbox.js';
import styles from '../support/SupportInbox.module.css';
import local from './Feedback.module.css';

const QUEUE_IDS = QUEUES.filter((q) => q.id).map((q) => q.id);

function QueueMenu({ queue, counts, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const current = QUEUES.find((item) => item.id === queue);
  return (
    <span ref={ref} className={`${styles.menuAnchor} ${styles.queueMenu}`}>
      <button type="button" className={styles.property} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={current?.icon || 'inbox'} size={14} aria-hidden="true" /><span>{current?.label}</span><Icon name="chevron-down" size={13} aria-hidden="true" />
      </button>
      {open && (
        <DropdownMenu width={220} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 'var(--tk-z-dropdown)' }}
          items={QUEUES.map((item) => item.divider ? item : ({ label: `${item.label}${counts[item.id] != null ? ` · ${counts[item.id]}` : ''}`, icon: item.id === queue ? 'check' : item.icon, onClick: () => { setOpen(false); onChange(item.id); } }))} />
      )}
    </span>
  );
}

function FeedbackRow({ row, active, onOpen }) {
  return (
    <li>
      <button type="button" id={`feedback-row-${row.id}`} className={styles.row} data-active={active || undefined} data-unread={row.unread || undefined}
        aria-current={active ? 'true' : undefined} onClick={() => onOpen(row.id)}>
        <span className={styles.rowTop}>
          {row.unread && <span className={styles.unreadDot} aria-label="Unread" />}
          <span className={styles.rowCustomer}>{row.user}</span>
          <time className={styles.rowTime} title={fullTime(row.submittedAtTs)}>{shortTime(row.submittedAtTs)}</time>
        </span>
        <span className={styles.rowSubject}>{row.title}</span>
        {row.excerpt !== '—' && <span className={styles.rowPreview}>{row.excerpt}</span>}
        <span className={styles.rowMeta}>
          <span className={local.rowType}><Icon name={TYPE_ICON[row.type] || 'message-circle'} size={12} aria-hidden="true" />{row.type}</span>
          {row.topic !== '—' && <span>{row.topic}</span>}
          <span className={styles.rowStatus} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className={styles.dot} style={{ background: STATUS_DOT[row.status] }} aria-hidden="true" />{row.status === 'In Progress' ? 'In progress' : row.status}
          </span>
          {row.assignee !== '—' && <span className={styles.rowAssignee}>{row.assignee}</span>}
        </span>
      </button>
    </li>
  );
}

export function FeedbackInbox() {
  const params = useSearchParams();
  const navigate = useNavigate();
  const me = useSelector((state) => state.auth.admin?.id);
  const operations = useFeedbackOperations('');
  const directory = useGetAdminFeedbackDirectoryQuery({ owner: operations.owner }, { skip: !operations.authenticated, pollingInterval: 60_000, refetchOnFocus: true });
  const queue = QUEUE_IDS.includes(params.get('queue')) ? params.get('queue') : DEFAULT_QUEUE;
  const selected = params.get('feedback');
  const [type, setType] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [settings, setSettings] = React.useState(false);
  const listRef = React.useRef(null);

  const setUrl = React.useCallback((next) => {
    const merged = { queue, feedback: selected, ...next };
    const search = new URLSearchParams();
    if (merged.queue && merged.queue !== DEFAULT_QUEUE) search.set('queue', merged.queue);
    if (merged.feedback) search.set('feedback', merged.feedback);
    const query = search.toString();
    navigate('/feedback' + (query ? `?${query}` : ''), { replace: true });
  }, [navigate, queue, selected]);

  const rows = React.useMemo(() => (operations.authenticated && !directory.error ? directory.currentData || [] : []), [operations.authenticated, directory.error, directory.currentData]);
  const loading = directory.isLoading || (directory.isFetching && !directory.currentData);
  const term = q.trim();
  const counts = React.useMemo(() => Object.fromEntries(QUEUE_IDS.map((id) => [id, rows.filter((row) => inQueue(row, id, me)).length])), [rows, me]);
  const visible = React.useMemo(() => sortNewest(rows.filter((row) => inQueue(row, queue, me) && (!type || row.type === type) && matchesSearch(row, term))), [rows, queue, me, type, term]);
  const open = React.useCallback((id) => setUrl({ feedback: id }), [setUrl]);
  const activeQueue = QUEUES.find((item) => item.id === queue);
  const stat = (value) => (loading ? <Skeleton as="span" width={18} height={12} /> : directory.error ? '—' : value.toLocaleString('en-NG'));

  React.useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey || target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const inList = listRef.current?.contains(target);
      const step = event.key === 'j' || inList && event.key === 'ArrowDown' ? 1 : event.key === 'k' || inList && event.key === 'ArrowUp' ? -1 : 0;
      if (step) {
        event.preventDefault();
        const index = visible.findIndex((row) => row.id === selected);
        const next = visible[Math.min(visible.length - 1, Math.max(0, (index < 0 ? -1 : index) + step))];
        if (next) { open(next.id); if (inList) requestAnimationFrame(() => document.getElementById(`feedback-row-${next.id}`)?.focus()); }
      } else if (event.key === '/') { event.preventDefault(); document.getElementById('feedback-inbox-search')?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, selected, open]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className="tk-display">Feedback</h1>
          <p className={styles.headStats}>
            <span><strong>{stat(counts.open)}</strong> open</span>
            <span><strong>{stat(counts.unread)}</strong> unread</span>
            <span><strong>{stat(counts['in-progress'])}</strong> in progress</span>
            <span><strong>{stat(counts.resolved)}</strong> resolved</span>
          </p>
        </div>
        {operations.canManageSettings && <Button variant="outline" icon="settings-2" onClick={() => setSettings(true)}>Settings</Button>}
      </header>

      <div className={styles.inbox} data-has-ticket={selected ? 'true' : undefined}>
        <nav className={styles.queues} aria-label="Feedback queues">
          {QUEUES.map((item, index) => item.divider ? <hr key={'d' + index} /> : (
            <button key={item.id} type="button" className={styles.queue} aria-current={item.id === queue ? 'page' : undefined} onClick={() => setUrl({ queue: item.id, feedback: null })}>
              <Icon name={item.icon} size={15} aria-hidden="true" />
              <span>{item.label}</span>
              <span className={styles.queueCount}>{loading || directory.error ? '' : counts[item.id] || ''}</span>
            </button>
          ))}
        </nav>

        <section className={styles.list} aria-label={`${activeQueue.label} feedback`}>
          <div>
            <div className={styles.listHead}>
              <QueueMenu queue={queue} counts={counts} onChange={(id) => setUrl({ queue: id, feedback: null })} />
              <label className={styles.listSearch}>
                <Icon name="search" size={14} aria-hidden="true" />
                <input id="feedback-inbox-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search feedback…" aria-label="Search feedback"
                  title="Search by title, message, person, email, topic or tag" />
                {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><Icon name="x" size={12} aria-hidden="true" /></button>}
              </label>
            </div>
            <div className={local.typeFilter} role="group" aria-label="Filter by type">
              <button type="button" aria-pressed={!type} onClick={() => setType(null)}>All types</button>
              {TYPES.map((t) => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(type === t ? null : t)}>{t}</button>)}
            </div>
          </div>
          <div className={`${styles.listBody} tk-scroll`}>
            {loading ? (
              <ul className={styles.rows} aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => <li key={i} className={styles.rowSkeleton}><Skeleton width="45%" height={12} /><Skeleton width="80%" height={12} /><Skeleton width="65%" height={11} /></li>)}
              </ul>
            ) : directory.error ? (
              <div className={styles.listEmpty}>
                <span className={styles.emptyIcon} aria-hidden="true"><Icon name="cloud-off" size={18} /></span>
                <strong>Couldn’t load feedback</strong>
                <span>{getApiErrorMessage(directory.error)}</span>
                <Button variant="outline" size="sm" onClick={() => directory.refetch()}>Try again</Button>
              </div>
            ) : visible.length === 0 ? (
              <div className={styles.listEmpty}>
                <span className={styles.emptyIcon} aria-hidden="true"><Icon name={term || type ? 'search-x' : rows.length ? 'circle-check' : 'message-square-heart'} size={18} /></span>
                <strong>{term || type ? 'No matching feedback' : rows.length ? 'Nothing here' : 'No feedback yet'}</strong>
                <span>{term || type ? 'Try another search or type.' : rows.length ? `Nothing in ${activeQueue.label.toLowerCase()} right now.` : 'When people send feedback from the apps (Account › Send feedback), it lands here.'}</span>
                {(term || type) && <Button variant="outline" size="sm" onClick={() => { setQ(''); setType(null); }}>Clear filters</Button>}
              </div>
            ) : (
              <ul ref={listRef} className={styles.rows}>
                {visible.map((row) => <FeedbackRow key={row.id} row={row} active={row.id === selected} onOpen={open} />)}
              </ul>
            )}
          </div>
          <div className={styles.listFoot}>
            <span>{directory.currentData ? `${visible.length} ${visible.length === 1 ? 'item' : 'items'}` : ''}</span>
            <span><kbd>j</kbd><kbd>k</kbd> move · <kbd>/</kbd> search</span>
          </div>
        </section>

        <div className={styles.paneSlot}>
          {selected ? (
            <>
              <button type="button" className={styles.backToList} onClick={() => setUrl({ feedback: null })}>
                <Icon name="arrow-left" size={14} aria-hidden="true" /> {activeQueue.label}
              </button>
              <FeedbackPane key={selected} feedbackId={selected} me={me} onSelect={open} />
            </>
          ) : (
            <div className={styles.paneEmpty}>
              <span className={styles.emptyIcon} aria-hidden="true"><Icon name="mouse-pointer-click" size={18} /></span>
              <strong>{loading ? 'Loading feedback…' : 'Select feedback'}</strong>
              <span>Pick an item from the list, or press <kbd>j</kbd> to open the first. Opening an item marks it read.</span>
            </div>
          )}
        </div>
      </div>

      {settings && <FeedbackSettingsDialog operations={operations} onClose={() => setSettings(false)} onSaved={() => showToast('Feedback settings saved')} />}
    </div>
  );
}
