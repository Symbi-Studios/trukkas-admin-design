'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from '../../router.js';
import { Avatar, Button, DropdownMenu, Icon, Skeleton } from '../../ds.js';
import {
  useGetAdminSupportTicketDetailQuery, useGetAdminTicketAgentsQuery, useUpdateAdminSupportTicketMutation,
  useUploadAdminTicketReplyAttachmentsMutation, useSendAdminTicketReplyMutation, useAddAdminTicketNoteMutation,
  useMergeAdminSupportTicketMutation, useGetAdminSupportTemplatesQuery,
  emptyTicket, ticketWithAgents, downloadTicketAttachment, TICKET_STATUS_CODES, TICKET_PRIORITY_CODES, TICKET_CATEGORY_CODES, ticketDetailUrl,
} from '../../store/features/tickets/ticketsApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { TicketMergeDialog } from '../TicketMergeDialog.jsx';
import { TicketComposer } from './TicketComposer.jsx';
import {
  RESOLVED, PRIORITY_ICON, ticketLabel, timeAgo, fullTime, duration, shortTime,
  customerProfileUrl, customerRoleLabel, relatedLink,
} from './supportInbox.js';
import styles from './SupportInbox.module.css';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Pending', 'Resolved'];
const PRIORITY_OPTIONS = ['Urgent', 'High', 'Medium', 'Low'];
const CATEGORY_OPTIONS = Object.keys(TICKET_CATEGORY_CODES);
const STATUS_DOT = { Open: 'var(--tk-blue)', 'In Progress': 'var(--tk-purple)', Pending: 'var(--tk-warning)', Escalated: 'var(--tk-danger)', Resolved: 'var(--tk-success)', Closed: 'var(--tk-ink-300)' };
const ACTIVITY_ICON = { CREATED: 'circle-plus', STATUS: 'circle-dot', STATUS_CHANGED: 'circle-dot', ASSIGNED: 'user-round', ASSIGNMENT: 'user-round', PRIORITY: 'flag', PRIORITY_CHANGED: 'flag', MERGED: 'git-merge', MERGE: 'git-merge', EDITED: 'pencil', EDIT: 'pencil' };

/** Compact property chip (status, priority, assignee, category) with a menu of choices. */
export function PropertyPicker({ label, value, display, dot, icon, options, disabled, onChange, width = 200 }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  return (
    <span ref={ref} className={styles.menuAnchor}>
      <button type="button" className={styles.property} disabled={disabled} aria-haspopup="menu" aria-expanded={open}
        aria-label={`${label}: ${display ?? value ?? 'None'}`} onClick={() => setOpen((next) => !next)}>
        {dot && <span className={styles.dot} style={{ background: dot }} aria-hidden="true" />}
        {icon && <Icon name={icon} size={14} aria-hidden="true" />}
        <span>{display ?? value ?? '—'}</span>
      </button>
      {open && (
        <DropdownMenu width={width} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, maxHeight: 300, overflowY: 'auto', zIndex: 'var(--tk-z-dropdown)' }}
          items={[{ section: label }, ...options.map((option) => ({
            label: option.label, icon: option.value === value ? 'check' : option.icon,
            disabled: option.disabled, onClick: () => { setOpen(false); if (option.value !== value) onChange(option.value); },
          }))]} />
      )}
    </span>
  );
}

function Attachments({ files }) {
  if (!files?.length) return null;
  return (
    <div className={styles.messageFiles}>
      {files.map((file) => (
        <button type="button" key={file.url} className={styles.fileCard} onClick={() => downloadTicketAttachment(file)}>
          <Icon name={file.icon} size={15} aria-hidden="true" />
          <span><strong>{file.name}</strong>{file.size !== '—' && <small>{file.size}</small>}</span>
        </button>
      ))}
    </div>
  );
}

/** One conversation: opening request, replies, internal notes and recorded activity, oldest first. */
function Timeline({ ticket }) {
  const entries = [];
  const firstPublic = ticket.messages.find((message) => !message.internal);
  const openingIsFirstMessage = firstPublic && ticket.description !== '—' && firstPublic.body.trim() === ticket.description.trim();
  if (ticket.description !== '—' && !openingIsFirstMessage) {
    entries.push({ kind: 'opening', key: 'opening', timestamp: ticket.createdAt ?? 0 });
  }
  ticket.messages.forEach((message) => entries.push({ kind: 'message', key: message.id, timestamp: message.timestamp ?? 0, message }));
  ticket.activity.filter((item) => item.type !== 'CREATED').forEach((item) => entries.push({ kind: 'activity', key: item.id || `${item.type}-${item.timestamp}`, timestamp: item.timestamp, item }));
  entries.sort((a, b) => a.timestamp - b.timestamp);
  const opened = ticket.activity.find((item) => item.type === 'CREATED');

  return (
    <ol className={styles.timeline}>
      <li className={styles.event}>
        <Icon name="circle-plus" size={14} aria-hidden="true" />
        <span><strong>{opened?.actor || (ticket.createdBy !== '—' ? ticket.createdBy : ticket.customer)}</strong> opened this ticket{ticket.source !== '—' ? ` via ${ticket.source.toLowerCase()}` : ''}</span>
        <time dateTime={ticket.createdAt ? new Date(ticket.createdAt).toISOString() : undefined} title={fullTime(ticket.createdAt)}>{timeAgo(ticket.createdAt)}</time>
      </li>
      {entries.map((entry) => {
        if (entry.kind === 'opening') {
          const byCustomer = ticket.source === 'App';
          return (
            <li key={entry.key} className={styles.message} data-side={byCustomer ? 'customer' : 'agent'}>
              <Avatar name={byCustomer ? ticket.customer : ticket.createdBy} src={byCustomer ? ticket.avatarUrl : undefined} size={28} />
              <div className={styles.bubble}>
                <header><strong>{byCustomer ? ticket.customer : ticket.createdBy}</strong><span>{byCustomer ? 'Customer' : 'Opened on behalf of the customer'}</span>
                  <time title={fullTime(ticket.createdAt)}>{shortTime(ticket.createdAt)}</time></header>
                <p>{ticket.description}</p>
              </div>
            </li>
          );
        }
        if (entry.kind === 'activity') {
          const { item } = entry;
          return (
            <li key={entry.key} className={styles.event}>
              <Icon name={ACTIVITY_ICON[item.type] || 'circle-dot'} size={14} aria-hidden="true" />
              <span>{item.actor && <strong>{item.actor} </strong>}{item.description || (item.toStatus ? `changed the status to ${item.toStatus}` : 'updated the ticket')}</span>
              <time title={fullTime(item.timestamp)}>{timeAgo(item.timestamp)}</time>
            </li>
          );
        }
        const { message } = entry;
        const side = message.internal ? 'note' : message.senderType === 'USER' ? 'customer' : message.senderType === 'SYSTEM' ? 'system' : 'agent';
        return (
          <li key={entry.key} className={styles.message} data-side={side}>
            <Avatar name={message.author !== '—' ? message.author : side === 'customer' ? ticket.customer : 'Trukkas'} size={28}
              src={side === 'customer' ? ticket.avatarUrl : undefined} />
            <div className={styles.bubble}>
              <header>
                <strong>{message.author !== '—' ? message.author : side === 'customer' ? ticket.customer : 'Trukkas'}</strong>
                <span>{side === 'note' ? 'Internal note' : side === 'customer' ? 'Customer' : side === 'system' ? 'System' : 'Support'}</span>
                <time title={fullTime(message.timestamp)}>{shortTime(message.timestamp)}</time>
              </header>
              <p>{message.body}</p>
              <Attachments files={message.files} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }) {
  return <div className={styles.fact}><dt>{label}</dt><dd>{children}</dd></div>;
}

/**
 * The open ticket: header with properties and actions, the conversation, the composer and a
 * details column. Used in the inbox's right pane and as the full page at /tickets/detail.
 *  - siblings: other loaded tickets (for "Other tickets from this customer")
 *  - onSelect(id): open another ticket in place; full page navigates instead
 */
export function TicketPane({ ticketId, layout = 'split', siblings = [], onSelect }) {
  const navigate = useNavigate();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  const query = useGetAdminSupportTicketDetailQuery(ticketId, { skip: !authenticated || !ticketId, refetchOnMountOrArgChange: true });
  const agentsQuery = useGetAdminTicketAgentsQuery(undefined, { skip: !authenticated });
  const templatesQuery = useGetAdminSupportTemplatesQuery(undefined, { skip: !authenticated });
  const agents = React.useMemo(() => authenticated && !agentsQuery.error ? agentsQuery.currentData || [] : [], [authenticated, agentsQuery.currentData, agentsQuery.error]);
  const record = authenticated && !query.error ? query.currentData : undefined;
  const ticket = ticketWithAgents(record || emptyTicket, agents);
  const loading = authenticated && !record && !query.error;
  const [updateTicket] = useUpdateAdminSupportTicketMutation();
  const [uploadAttachments] = useUploadAdminTicketReplyAttachmentsMutation();
  const [sendReply] = useSendAdminTicketReplyMutation();
  const [addNote] = useAddAdminTicketNoteMutation();
  const [mergeTicket] = useMergeAdminSupportTicketMutation();
  const [pending, setPending] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [merge, setMerge] = React.useState(false);
  const lock = React.useRef(null), composer = React.useRef(null), scroller = React.useRef(null), menuRef = React.useRef(null);
  const activeId = React.useRef(ticketId);
  activeId.current = ticketId;

  React.useEffect(() => { lock.current = null; setPending(false); setMenu(false); setMerge(false); }, [ticketId]);
  // Land on the newest message when a ticket opens or a message arrives.
  React.useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [ticketId, ticket.messages.length]);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(false); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); };
  }, [menu]);

  const merged = Boolean(ticket.mergedInto);
  const canManage = Boolean(record) && ticket.canManage && !merged;
  const busy = pending || !record || merged;
  const resolved = RESOLVED.has(ticket.status);
  const paymentOnly = ticket.paymentRestricted;
  const assignable = agents.filter((agent) => agent.isActive === true && (!paymentOnly || ['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(agent.role)));
  const canTakeIt = canManage && admin?.id && ticket.assignedTo !== admin.id && assignable.some((agent) => agent.id === admin.id);

  async function save(changes, { expected = ticket.sourceData.updatedAt, message = 'Ticket updated' } = {}) {
    if (!canManage || lock.current || !Object.keys(changes).length) return false;
    const operation = Symbol(), id = ticketId;
    lock.current = operation; setPending(true);
    try {
      await updateTicket({ id, changes, expectedUpdatedAt: expected }).unwrap();
      if (id === activeId.current && message) showToast(message);
      return true;
    } catch (error) {
      if (id === activeId.current) showToast(getApiErrorMessage(error), { tone: 'info' });
      return false;
    } finally { if (lock.current === operation) { lock.current = null; setPending(false); } }
  }
  const setStatus = (status, message) => TICKET_STATUS_CODES[status] && save({ status: TICKET_STATUS_CODES[status] }, { message: message || `Marked ${status.toLowerCase()}` });

  async function send({ mode, content, files, then }) {
    if (busy || lock.current) return false;
    const operation = Symbol(), id = ticketId;
    lock.current = operation; setPending(true);
    try {
      const urls = files.length ? await uploadAttachments({ id, files }).unwrap() : [];
      await (mode === 'reply' ? sendReply : addNote)({ id, content, attachmentUrls: urls }).unwrap();
      if (id !== activeId.current) return true;
      lock.current = null;
      if (then) await save({ status: TICKET_STATUS_CODES[then] }, { expected: undefined, message: mode === 'reply' ? `Reply sent · ${then === 'Pending' ? 'waiting on customer' : 'resolved'}` : null });
      else showToast(mode === 'reply' ? 'Reply sent' : 'Note added');
      return true;
    } catch (error) {
      if (id === activeId.current) showToast(getApiErrorMessage(error), { tone: 'info' });
      return false;
    } finally { if (lock.current === operation) lock.current = null; setPending(false); }
  }

  async function mergeInto(targetThreadId) {
    if (!canManage || lock.current) return;
    const operation = Symbol(), id = ticketId;
    lock.current = operation; setPending(true);
    try {
      const saved = await mergeTicket({ id, targetThreadId }).unwrap();
      setMerge(false); showToast('Ticket merged');
      if (id === activeId.current) (onSelect ? onSelect(saved.id) : navigate(ticketDetailUrl(saved.id)));
    } catch (error) { showToast(getApiErrorMessage(error), { tone: 'info' }); }
    finally { if (lock.current === operation) { lock.current = null; setPending(false); } }
  }

  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); showToast(done); } catch { showToast('Could not copy to the clipboard.', { tone: 'info' }); }
  }

  // Single-key shortcuts while this ticket is open: r reply, n note, e resolve / reopen, a assign to me.
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'r' && canManage) { event.preventDefault(); composer.current?.focus('reply'); }
      else if (key === 'n' && record && !merged) { event.preventDefault(); composer.current?.focus('note'); }
      else if (key === 'e' && canManage && !pending) { event.preventDefault(); setStatus(resolved ? 'Open' : 'Resolved', resolved ? 'Reopened' : 'Resolved'); }
      else if (key === 'a' && canTakeIt && !pending) { event.preventDefault(); save({ assignedTo: admin.id }, { message: 'Assigned to you' }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!ticketId) return null;
  if (query.error) {
    return (
      <section className={styles.pane} data-layout={layout}>
        <div className={styles.paneEmpty}>
          <span className={styles.emptyIcon} aria-hidden="true"><Icon name="ticket-x" size={18} /></span>
          <strong>{query.error.status === 404 ? 'Ticket not found' : 'Couldn’t load this ticket'}</strong>
          <span>{query.error.status === 404 ? 'It may have been merged or removed.' : getApiErrorMessage(query.error)}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Try again</Button>
        </div>
      </section>
    );
  }

  const statusOptions = STATUS_OPTIONS.map((value) => ({ value, label: value }));
  const priorityOptions = PRIORITY_OPTIONS.map((value) => ({ value, label: value, icon: PRIORITY_ICON[value] }));
  const assigneeOptions = [
    { value: '', label: 'Unassigned', icon: 'user-round-x' },
    ...assignable.map((agent) => ({ value: agent.id, label: agent.id === admin?.id ? `${agent.name} (you)` : agent.name, icon: 'user-round' })),
  ];
  if (ticket.assignedTo && !assigneeOptions.some((option) => option.value === ticket.assignedTo)) assigneeOptions.push({ value: ticket.assignedTo, label: ticket.assignee, disabled: true });
  const categoryOptions = CATEGORY_OPTIONS.map((value) => ({ value, label: value }));
  const others = siblings.filter((row) => row.userId && row.userId === ticket.userId && row.id !== ticket.id).slice(0, 5);
  const profile = customerProfileUrl(ticket);
  const role = customerRoleLabel(ticket.customerRole);
  const openOther = (id) => (onSelect ? onSelect(id) : navigate(ticketDetailUrl(id)));

  return (
    <section className={styles.pane} data-layout={layout} aria-label={`Ticket ${ticketLabel(ticket)}`} aria-busy={loading || undefined}>
      <header className={styles.paneHead}>
        <div className={styles.paneTitleRow}>
          <button type="button" className={styles.reference} onClick={() => copy(ticketLabel(ticket), 'Ticket number copied')} title="Copy ticket number" disabled={!record}>
            {loading ? <Skeleton as="span" width={72} height={12} /> : ticketLabel(ticket)}
            <Icon name="copy" size={12} aria-hidden="true" />
          </button>
          <div className={styles.paneActions}>
            {canTakeIt && <Button variant="outline" size="sm" icon="user-round-plus" disabled={pending} onClick={() => save({ assignedTo: admin.id }, { message: 'Assigned to you' })}>Assign to me</Button>}
            {record && !merged && (resolved
              ? <Button variant="outline" size="sm" icon="rotate-ccw" disabled={!canManage || pending} onClick={() => setStatus('Open', 'Reopened')}>Reopen</Button>
              : <Button size="sm" icon="circle-check" disabled={!canManage || pending} onClick={() => setStatus('Resolved', 'Resolved')}>Resolve</Button>)}
            <span ref={menuRef} className={styles.menuAnchor}>
              <Button variant="ghost" size="sm" icon="ellipsis" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} disabled={!record} onClick={() => setMenu(!menu)} />
              {menu && (
                <DropdownMenu width={220} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }} items={[
                  ...(layout === 'split' ? [{ label: 'Open full page', icon: 'maximize-2', onClick: () => { setMenu(false); navigate(ticketDetailUrl(ticket.id)); } }] : []),
                  { label: 'Copy link', icon: 'link', onClick: () => { setMenu(false); copy(window.location.origin + ticketDetailUrl(ticket.id), 'Link copied'); } },
                  { label: 'Merge into another ticket', icon: 'git-merge', disabled: !canManage || !ticket.userId, onClick: () => { setMenu(false); setMerge(true); } },
                  { label: 'Print', icon: 'printer', onClick: () => { setMenu(false); window.print(); } },
                ]} />
              )}
            </span>
          </div>
        </div>
        <h2 className={styles.paneSubject}>{loading ? <Skeleton as="span" width="60%" height={20} /> : ticket.subject}</h2>
        <div className={styles.properties}>
          <PropertyPicker label="Status" value={ticket.status} dot={STATUS_DOT[ticket.status]} options={statusOptions} disabled={!canManage || pending}
            onChange={(value) => setStatus(value)} width={180} />
          <PropertyPicker label="Priority" value={ticket.priority} icon={PRIORITY_ICON[ticket.priority]} options={priorityOptions} disabled={!canManage || pending}
            onChange={(value) => save({ priority: TICKET_PRIORITY_CODES[value] }, { message: `Priority set to ${value.toLowerCase()}` })} width={180} />
          <PropertyPicker label="Assignee" value={ticket.assignedTo || ''} display={ticket.assignedTo ? (ticket.assignedTo === admin?.id ? 'You' : ticket.assignee) : 'Unassigned'}
            icon={ticket.assignedTo ? 'user-round' : 'user-round-x'} options={assigneeOptions} disabled={!canManage || pending}
            onChange={(value) => save({ assignedTo: value || null }, { message: value ? 'Assignee updated' : 'Unassigned' })} width={240} />
          <PropertyPicker label="Category" value={ticket.category} icon="tag" options={categoryOptions} disabled={!canManage || pending}
            onChange={(value) => save({ category: TICKET_CATEGORY_CODES[value] }, { message: 'Category updated' })} width={200} />
        </div>
        {merged && (
          <p className={styles.notice}><Icon name="git-merge" size={14} aria-hidden="true" />
            This ticket was merged. <button type="button" onClick={() => openOther(ticket.mergedInto)}>Open the ticket it was merged into</button>
          </p>
        )}
        {!merged && record && !ticket.canManage && (
          <p className={styles.notice}><Icon name="lock" size={14} aria-hidden="true" />
            {paymentOnly ? 'Payment tickets are handled by Finance and Technical admins. You can still add internal notes.' : 'You can view this ticket and add internal notes.'}
          </p>
        )}
      </header>

      <div className={styles.paneBody}>
        <div className={styles.conversation}>
          <div ref={scroller} className={`${styles.thread} tk-scroll`}>
            {loading ? (
              <div className={styles.threadLoading}>{[70, 55, 80].map((w, i) => <Skeleton key={i} width={`${w}%`} height={56} radius={10} />)}</div>
            ) : <Timeline ticket={ticket} />}
          </div>
          {!merged && (
            <TicketComposer ref={composer} canReply={canManage} canNote={Boolean(record)} disabled={busy} resolved={resolved}
              templates={templatesQuery.currentData || []} onSend={send} onError={(message) => showToast(message, { tone: 'info' })} />
          )}
        </div>

        <aside className={`${styles.details} tk-scroll`} aria-label="Ticket details">
          <section>
            <h3>Customer</h3>
            <div className={styles.customer}>
              <Avatar name={ticket.customer} src={ticket.avatarUrl} size={36} />
              <div>
                <strong>{loading ? <Skeleton as="span" width={110} height={13} /> : ticket.customer}</strong>
                <span>{[role, ticket.company !== '—' ? ticket.company : null].filter(Boolean).join(' · ') || '—'}</span>
              </div>
            </div>
            <dl className={styles.facts}>
              <Fact label="Email">{ticket.email !== '—' ? <a href={`mailto:${ticket.email}`}>{ticket.email}</a> : '—'}</Fact>
              <Fact label="Phone">{ticket.phone !== '—' ? <a href={`tel:${ticket.phone}`}>{ticket.phone}</a> : '—'}</Fact>
            </dl>
            {profile && <Link className={styles.sideLink} to={profile}>View profile <Icon name="arrow-up-right" size={13} aria-hidden="true" /></Link>}
          </section>

          {ticket.related?.length > 0 && (
            <section>
              <h3>Related</h3>
              <ul className={styles.relatedList}>
                {ticket.related.map((item) => {
                  const link = relatedLink(item);
                  return (
                    <li key={item.kind + item.id}>
                      <Icon name={link.icon} size={14} aria-hidden="true" />
                      {link.href ? <Link to={link.href}>{link.label}</Link> : <span>{link.label}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h3>Details</h3>
            <dl className={styles.facts}>
              <Fact label="Subcategory">{ticket.subcategory}</Fact>
              <Fact label="Source">{ticket.source}</Fact>
              <Fact label="Opened"><span title={fullTime(ticket.createdAt)}>{ticket.created}</span></Fact>
              <Fact label="First response">{ticket.firstResponseAt ? duration(ticket.createdAt, ticket.firstResponseAt) : record ? 'Not yet' : '—'}</Fact>
              {ticket.resolvedAt && <Fact label="Resolved">{duration(ticket.createdAt, ticket.resolvedAt)} after opening</Fact>}
            </dl>
          </section>

          {ticket.mergedFrom.length > 0 && (
            <section>
              <h3>Merged into this ticket</h3>
              <ul className={styles.otherTickets}>
                {ticket.mergedFrom.map((item) => <li key={item.id}><span>{item.subject || item.id}</span></li>)}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h3>Other tickets from {ticket.customer.split(' ')[0]}</h3>
              <ul className={styles.otherTickets}>
                {others.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => openOther(row.id)}>
                      <span className={styles.dot} style={{ background: STATUS_DOT[row.status] || 'var(--tk-ink-300)' }} aria-hidden="true" />
                      <span>{row.subject}</span>
                      <small>{ticketLabel(row)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.shortcuts} aria-label="Keyboard shortcuts">
            <h3>Shortcuts</h3>
            <dl>
              <div><dt><kbd>j</kbd> <kbd>k</kbd></dt><dd>Next / previous ticket</dd></div>
              <div><dt><kbd>r</kbd></dt><dd>Reply</dd></div>
              <div><dt><kbd>n</kbd></dt><dd>Internal note</dd></div>
              <div><dt><kbd>e</kbd></dt><dd>Resolve / reopen</dd></div>
              <div><dt><kbd>a</kbd></dt><dd>Assign to me</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      {merge && <TicketMergeDialog ticket={ticket} authenticated={authenticated} saving={pending} onMerge={mergeInto} onClose={() => setMerge(false)} />}
    </section>
  );
}
