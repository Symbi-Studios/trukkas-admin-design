'use client';

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../../router.js';
import { Avatar, Button, DropdownMenu, Icon, Skeleton } from '../../ds.js';
import {
  useGetAdminSupportTicketDirectoryQuery, useGetAdminSupportTicketStatsQuery, useGetAdminTicketAgentsQuery, ticketWithAgents, ticketsApi,
} from '../../store/features/tickets/ticketsApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { usePageSearchState } from '../../components/PageSearch.jsx';
import { TicketPane } from './TicketPane.jsx';
import { NewTicketDialog } from './NewTicketDialog.jsx';
import {
  QUEUES, QUEUE_IDS, DEFAULT_QUEUE, SORTS, sortTickets, matchesSearch, needsReply, ticketLabel, shortTime, fullTime, hoursLabel, PRIORITY_ICON,
} from './supportInbox.js';
import styles from './SupportInbox.module.css';

const LEGACY_ASSIGNED = { me: 'mine', unassigned: 'unassigned' };

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
        <DropdownMenu width={230} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 'var(--tk-z-dropdown)' }}
          items={QUEUES.map((item) => item.divider ? item : ({
            label: `${item.label}${counts[item.id] != null ? ` · ${counts[item.id]}` : ''}`, icon: item.id === queue ? 'check' : item.icon,
            onClick: () => { setOpen(false); onChange(item.id); },
          }))} />
      )}
    </span>
  );
}

function TicketRow({ ticket, active, me, onOpen }) {
  const last = ticket.lastMessage;
  const fromUs = last && last.senderType !== 'USER';
  const urgent = ticket.priority === 'Urgent' || ticket.priority === 'High';
  return (
    <li>
      <button type="button" id={`ticket-row-${ticket.id}`} className={styles.row} data-active={active || undefined} data-unread={ticket.unread || undefined}
        aria-current={active ? 'true' : undefined} onClick={() => onOpen(ticket.id)}>
        <span className={styles.rowTop}>
          {ticket.unread && <span className={styles.unreadDot} aria-label="Unread" />}
          <span className={styles.rowCustomer}>{ticket.customer}</span>
          <time className={styles.rowTime} title={fullTime(ticket.activityAt)}>{shortTime(ticket.activityAt)}</time>
        </span>
        <span className={styles.rowSubject}>{ticket.subject}</span>
        <span className={styles.rowPreview}>
          {last ? <>{fromUs && <span className={styles.rowYou}>{last.senderType === 'SYSTEM' ? 'System:' : 'Support:'}</span>} {last.content}</> : <em>No messages yet</em>}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.rowRef}>{ticketLabel(ticket)}</span>
          {urgent && <span className={styles.rowPriority} data-priority={ticket.priority}><Icon name={PRIORITY_ICON[ticket.priority]} size={12} aria-hidden="true" />{ticket.priority}</span>}
          {ticket.status !== 'Open' && <span className={styles.rowStatus}>{ticket.status}</span>}
          {needsReply(ticket) && <span className={styles.rowWaiting}>Needs reply</span>}
          <span className={styles.rowAssignee} title={ticket.assignedTo ? `Assigned to ${ticket.assignee}` : 'Unassigned'}>
            {ticket.assignedTo ? <Avatar name={ticket.assignedTo === me ? 'You' : ticket.assignee} size={18} /> : <Icon name="user-round-x" size={13} aria-label="Unassigned" />}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Support inbox: queues, the ticket list and the open ticket side by side. The queue and the open
 *  ticket live in the URL (?queue=&ticket=) so any view can be linked or refreshed; ?q= pre-fills search. */
export function SupportInbox() {
  const navigate = useNavigate();
  const params = useSearchParams();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const queue = QUEUE_IDS.includes(params.get('queue')) ? params.get('queue') : LEGACY_ASSIGNED[params.get('assignedTo')] || DEFAULT_QUEUE;
  const selected = params.get('ticket') || '';
  const [sort, setSort] = React.useState('recent');
  const [sortOpen, setSortOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [q, setQ] = usePageSearchState(params.get('q') || '');
  const [term, setTerm] = React.useState(q.trim());
  React.useEffect(() => { const timer = setTimeout(() => setTerm(q.trim()), 150); return () => clearTimeout(timer); }, [q]);
  const listRef = React.useRef(null), sortRef = React.useRef(null);

  const directory = useGetAdminSupportTicketDirectoryQuery(undefined, { skip: !authenticated, pollingInterval: 60_000, refetchOnFocus: true });
  const stats = useGetAdminSupportTicketStatsQuery(undefined, { skip: !authenticated, pollingInterval: 60_000 });
  const agentsQuery = useGetAdminTicketAgentsQuery(undefined, { skip: !authenticated });
  const tickets = React.useMemo(() => (authenticated && !directory.error && directory.currentData ? directory.currentData : [])
    .map((ticket) => ticketWithAgents(ticket, agentsQuery.currentData || [])), [authenticated, directory.currentData, directory.error, agentsQuery.currentData]);
  const loading = authenticated && !directory.currentData && !directory.error;

  const counts = React.useMemo(() => Object.fromEntries(QUEUES.filter((item) => item.id)
    .map((item) => [item.id, directory.currentData ? tickets.filter((ticket) => item.match(ticket, admin?.id)).length : null])), [tickets, admin?.id, directory.currentData]);
  const activeQueue = QUEUES.find((item) => item.id === queue);
  const visible = React.useMemo(() => sortTickets(tickets.filter((ticket) => activeQueue.match(ticket, admin?.id) && matchesSearch(ticket, term)), sort),
    [tickets, activeQueue, admin?.id, term, sort]);

  const setUrl = React.useCallback((next) => {
    const search = new URLSearchParams(params.toString());
    search.delete('assignedTo');
    Object.entries(next).forEach(([key, value]) => (value ? search.set(key, value) : search.delete(key)));
    if (search.get('queue') === DEFAULT_QUEUE) search.delete('queue');
    const query = search.toString();
    navigate('/tickets' + (query ? `?${query}` : ''), { replace: true });
  }, [params, navigate]);
  const open = React.useCallback((id) => setUrl({ ticket: id }), [setUrl]);

  // No ticket opens by itself: opening one marks the customer's messages as read on the server.
  // Mirror that locally so the row's unread dot clears straight away instead of on the next poll.
  const dispatch = useDispatch();
  React.useEffect(() => {
    if (!selected) return;
    dispatch(ticketsApi.util.updateQueryData('getAdminSupportTicketDirectory', undefined, (draft) => {
      const row = Array.isArray(draft) ? draft.find((item) => item.id === selected) : null;
      if (row && row.unread) row.unread = false;
    }));
  }, [selected, dispatch]);
  React.useEffect(() => {
    document.getElementById(`ticket-row-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  React.useEffect(() => {
    if (!sortOpen) return undefined;
    const close = (event) => { if (!sortRef.current?.contains(event.target)) setSortOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [sortOpen]);

  // j / k (and arrow keys while the list has focus) move through the visible tickets.
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const inList = listRef.current?.contains(target);
      const key = event.key;
      const step = key === 'j' || (inList && key === 'ArrowDown') ? 1 : key === 'k' || (inList && key === 'ArrowUp') ? -1 : 0;
      if (step && visible.length) {
        event.preventDefault();
        const index = visible.findIndex((ticket) => ticket.id === selected);
        const next = visible[Math.min(visible.length - 1, Math.max(0, (index < 0 ? -1 : index) + step))];
        if (next) { open(next.id); if (inList) requestAnimationFrame(() => document.getElementById(`ticket-row-${next.id}`)?.focus()); }
      } else if (key === 'c') { event.preventDefault(); setCreating(true); }
      else if (key === '/') { event.preventDefault(); document.getElementById('support-inbox-search')?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, selected, open]);

  const s = authenticated && !stats.error ? stats.currentData : undefined;
  const metric = (value, render = (v) => v.toLocaleString('en-NG')) => (stats.isLoading ? <Skeleton as="span" width={24} height={12} /> : typeof value === 'number' ? render(value) : '—');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className="tk-display">Support</h1>
          <p className={styles.headStats}>
            <span><strong>{metric(s?.needResponseCount)}</strong> need a reply</span>
            <span><strong>{metric(s?.unresolvedThreads)}</strong> open</span>
            <span><strong>{metric(s?.avgResponseTimeHours, hoursLabel)}</strong> avg. first response</span>
            <span><strong>{metric(s?.resolvedToday)}</strong> resolved today</span>
          </p>
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>New ticket</Button>
      </header>

      <div className={styles.inbox} data-has-ticket={selected ? 'true' : undefined}>
        <nav className={styles.queues} aria-label="Ticket queues">
          {QUEUES.map((item, index) => item.divider ? <hr key={'d' + index} /> : (
            <button key={item.id} type="button" className={styles.queue} aria-current={item.id === queue ? 'page' : undefined}
              onClick={() => setUrl({ queue: item.id, ticket: null })}>
              <Icon name={item.icon} size={15} aria-hidden="true" />
              <span>{item.label}</span>
              <span className={styles.queueCount}>{counts[item.id] ?? ''}</span>
            </button>
          ))}
        </nav>

        <section className={styles.list} aria-label={`${activeQueue.label} tickets`}>
          <div className={styles.listHead}>
            <QueueMenu queue={queue} counts={counts} onChange={(id) => setUrl({ queue: id, ticket: null })} />
            <label className={styles.listSearch}>
              <Icon name="search" size={14} aria-hidden="true" />
              <input id="support-inbox-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search tickets…"
                aria-label="Search tickets" title="Search by ticket number, subject, customer name or email" />
              {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><Icon name="x" size={12} aria-hidden="true" /></button>}
            </label>
            <span ref={sortRef} className={styles.menuAnchor}>
              <Button variant="ghost" size="sm" icon="arrow-down-up" aria-label={`Sort: ${SORTS.find((item) => item.id === sort).label}`}
                title={`Sort: ${SORTS.find((item) => item.id === sort).label}`} aria-haspopup="menu" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)} />
              {sortOpen && (
                <DropdownMenu width={200} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }}
                  items={[{ section: 'Sort by' }, ...SORTS.map((item) => ({ label: item.label, icon: item.id === sort ? 'check' : undefined, onClick: () => { setSort(item.id); setSortOpen(false); } }))]} />
              )}
            </span>
          </div>
          <div className={`${styles.listBody} tk-scroll`}>
            {loading ? (
              <ul className={styles.rows} aria-busy="true">
                {Array.from({ length: 7 }, (_, i) => <li key={i} className={styles.rowSkeleton}><Skeleton width="45%" height={12} /><Skeleton width="80%" height={12} /><Skeleton width="65%" height={11} /></li>)}
              </ul>
            ) : directory.error ? (
              <div className={styles.listEmpty}>
                <span className={styles.emptyIcon} aria-hidden="true"><Icon name="cloud-off" size={18} /></span>
                <strong>Couldn’t load tickets</strong>
                <span>{getApiErrorMessage(directory.error)}</span>
                <Button variant="outline" size="sm" onClick={() => directory.refetch()}>Try again</Button>
              </div>
            ) : visible.length === 0 ? (
              <div className={styles.listEmpty}>
                <span className={styles.emptyIcon} aria-hidden="true"><Icon name={term ? 'search-x' : 'inbox'} size={18} /></span>
                <strong>{term ? 'No matching tickets' : queue === 'needs-reply' ? 'All caught up' : 'Nothing here'}</strong>
                <span>{term ? `Nothing in ${activeQueue.label.toLowerCase()} matches “${term}”.` : queue === 'needs-reply' ? 'Every customer has had a reply.' : 'Tickets in this queue will appear here.'}</span>
                {term && <Button variant="outline" size="sm" onClick={() => setQ('')}>Clear search</Button>}
              </div>
            ) : (
              <ul ref={listRef} className={styles.rows}>
                {visible.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} me={admin?.id} active={ticket.id === selected} onOpen={open} />)}
              </ul>
            )}
          </div>
          <div className={styles.listFoot}>
            <span>{directory.currentData ? `${visible.length} ${visible.length === 1 ? 'ticket' : 'tickets'}` : ''}</span>
            <span><kbd>j</kbd><kbd>k</kbd> move · <kbd>/</kbd> search · <kbd>c</kbd> new</span>
          </div>
        </section>

        <div className={styles.paneSlot}>
          {selected ? (
            <>
              <button type="button" className={styles.backToList} onClick={() => setUrl({ ticket: null })}>
                <Icon name="arrow-left" size={14} aria-hidden="true" /> {activeQueue.label}
              </button>
              <TicketPane key={selected} ticketId={selected} layout="split" siblings={tickets} onSelect={open} />
            </>
          ) : (
            <div className={styles.paneEmpty}>
              <span className={styles.emptyIcon} aria-hidden="true"><Icon name="mouse-pointer-click" size={18} /></span>
              <strong>{loading ? 'Loading tickets…' : 'Select a ticket'}</strong>
              <span>Pick one from the list, or press <kbd>j</kbd> to open the first. Opening a ticket marks its messages as read.</span>
            </div>
          )}
        </div>
      </div>

      {creating && <NewTicketDialog agents={agentsQuery.currentData || []} me={admin?.id} onClose={() => setCreating(false)}
        onCreated={(ticket) => { setCreating(false); setUrl({ queue: 'all', ticket: ticket.id }); }} />}
    </div>
  );
}
