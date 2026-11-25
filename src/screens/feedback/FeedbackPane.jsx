'use client';

import React from 'react';
import { Avatar, Button, DropdownMenu, Icon, Skeleton } from '../../ds.js';
import { Link, useNavigate } from '../../router.js';
import {
  useGetAdminFeedbackAssigneesQuery, useGetAdminFeedbackDetailQuery, useGetAdminFeedbackHistoryQuery, useGetAdminRelatedFeedbackQuery, feedbackReplyMessage,
} from '../../store/features/feedback/feedbackApi.js';
import { useFeedbackOperations } from '../../store/features/feedback/useFeedbackOperations.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { PropertyPicker } from '../support/TicketPane.jsx';
import { fullTime, shortTime } from '../support/supportInbox.js';
import { ROLE_LABEL, STATUS_DOT, STATUS_OPTIONS, TYPE_ICON, feedbackPageUrl, profileUrl } from './feedbackInbox.js';
import styles from '../support/SupportInbox.module.css';
import local from './Feedback.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const EVENT_ICON = { STATUS: 'circle-dot', ASSIGNED: 'user-round', REPLY: 'send', NOTE: 'notebook-pen', TAGS: 'tag', SPAM: 'ban', READ: 'eye', ACKNOWLEDGED: 'mail-check', SUBMITTED: 'inbox' };

function ReplyBox({ disabled, onSend }) {
  const [text, setText] = React.useState('');
  const [menu, setMenu] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const area = React.useRef(null);
  React.useLayoutEffect(() => { const el = area.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'; }, [text]);
  const ready = !disabled && !sending && text.trim().length > 0 && text.trim().length <= 5000;
  async function send(resolve = false) {
    if (!ready) return;
    setMenu(false); setSending(true);
    const ok = await onSend(text.trim(), resolve);
    setSending(false);
    if (ok) setText('');
  }
  return (
    <div className={styles.composer}>
      <textarea ref={area} className={styles.composerInput} rows={3} value={text} disabled={disabled || sending}
        aria-label="Reply to the user" placeholder="Write a reply. It goes to the user in the app, by push and by email."
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); } }} />
      <div className={styles.composerBar}>
        <span className={styles.composerKbd} aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} ↵ to send</span>
        <span className={styles.menuAnchor} style={{ marginLeft: 'auto' }}>
          <span className={styles.sendGroup}>
            <Button size="sm" loading={sending} disabled={!ready} onClick={() => send()}>Send reply</Button>
            <Button size="sm" icon="chevron-down" aria-label="More send options" aria-haspopup="menu" aria-expanded={menu} disabled={!ready} onClick={() => setMenu(!menu)} />
          </span>
          {menu && <DropdownMenu width={200} style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 'var(--tk-z-dropdown)' }}
            items={[{ label: 'Send and resolve', icon: 'circle-check', onClick: () => send(true) }]} />}
        </span>
      </div>
    </div>
  );
}

function NoteEditor({ value, author, at, disabled, onSave }) {
  const [draft, setDraft] = React.useState(value || '');
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setDraft(value || ''), [value]);
  const changed = draft !== (value || '');
  return (
    <div className={local.note}>
      <textarea value={draft} rows={3} disabled={disabled || saving} placeholder="Only admins see this." aria-label="Internal note"
        onChange={(event) => setDraft(event.target.value)} />
      <div className={local.noteBar}>
        <small>{value && author !== '—' ? `${author} · ${at}` : ''}</small>
        {changed && <Button size="sm" variant="outline" loading={saving} disabled={disabled || draft.length > 5000}
          onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); }}>Save note</Button>}
      </div>
    </div>
  );
}

function Tags({ tags, disabled, onAdd }) {
  const [adding, setAdding] = React.useState(false);
  const [value, setValue] = React.useState('');
  return (
    <div className={local.tags}>
      {(tags || []).map((tag) => <span key={tag} className={local.tag}>{tag}</span>)}
      {tags && tags.length < 20 && (adding ? (
        <input autoFocus className={local.tagInput} value={value} maxLength={40} disabled={disabled} placeholder="New tag" aria-label="New tag"
          onChange={(event) => setValue(event.target.value)} onBlur={() => { if (!value.trim()) setAdding(false); }}
          onKeyDown={async (event) => {
            if (event.key === 'Escape') { event.stopPropagation(); setAdding(false); setValue(''); }
            if (event.key === 'Enter' && value.trim()) { event.preventDefault(); if (await onAdd(value.trim())) { setValue(''); setAdding(false); } }
          }} />
      ) : <button type="button" className={local.addTag} disabled={disabled} onClick={() => setAdding(true)}><Icon name="plus" size={12} aria-hidden="true" />Tag</button>)}
      {!tags && <span className="tk-meta">—</span>}
    </div>
  );
}

/** One feedback item: what they said, the history, a reply box, and triage controls. */
export function FeedbackPane({ feedbackId, layout = 'split', me, onSelect }) {
  const navigate = useNavigate();
  const operations = useFeedbackOperations(feedbackId);
  const { owner, authenticated } = operations;
  const query = useGetAdminFeedbackDetailQuery({ owner, id: feedbackId }, { skip: !authenticated || !feedbackId, refetchOnMountOrArgChange: true });
  const f = authenticated && !query.error ? query.currentData : null;
  const history = useGetAdminFeedbackHistoryQuery({ owner, id: feedbackId, all: true }, { skip: !f });
  const related = useGetAdminRelatedFeedbackQuery({ owner, id: feedbackId }, { skip: !f });
  const assignees = useGetAdminFeedbackAssigneesQuery({ owner }, { skip: !authenticated });
  const [menu, setMenu] = React.useState(false);
  const menuRef = React.useRef(null);
  const markedRead = React.useRef(false);

  async function change(action, values, message) {
    if (!f?.version) return false;
    try {
      const result = await operations.perform(action, values, f.version);
      if (result && message) showToast(typeof message === 'function' ? message(result) : message);
      return Boolean(result);
    } catch (failure) { showToast(getApiErrorMessage(failure), { tone: 'info' }); return false; }
  }

  // Opening an item in the inbox marks it read, like email. The backend doesn't do this on GET.
  React.useEffect(() => {
    if (!f || markedRead.current || f.unread !== true || !f.version) return;
    markedRead.current = true;
    operations.perform('read', { isRead: true }, f.version).catch(() => { markedRead.current = false; });
  }, [f, operations]);

  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(false); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); };
  }, [menu]);

  if (query.isLoading || (query.isFetching && !query.currentData)) {
    return <div className={styles.pane} data-layout={layout}><div className={styles.paneHead}><Skeleton width="40%" height={14} /><Skeleton width="70%" height={20} style={{ marginTop: 10 }} /></div></div>;
  }
  if (!f) {
    return (
      <div className={styles.pane} data-layout={layout}>
        <div className={styles.listEmpty}>
          <span className={styles.emptyIcon} aria-hidden="true"><Icon name={query.error ? 'cloud-off' : 'search-x'} size={18} /></span>
          <strong>{query.error ? 'Couldn’t load this feedback' : 'Feedback not found'}</strong>
          <span>{query.error ? getApiErrorMessage(query.error) : 'It may have been removed.'}</span>
          {query.error && <Button variant="outline" size="sm" onClick={() => query.refetch()}>Try again</Button>}
        </div>
      </div>
    );
  }

  const busy = operations.saving;
  const people = assignees.currentData || [];
  const assigneeOptions = [{ value: null, label: 'Unassigned', icon: 'user-round-x' }, ...people.map((p) => ({ value: p.id, label: p.id === me ? `${p.name} (you)` : p.name }))];
  if (f.assignedToId && !people.some((p) => p.id === f.assignedToId)) assigneeOptions.push({ value: f.assignedToId, label: f.assignee });
  const canReply = f.submitterType === 'USER' && f.status !== 'Spam';
  const profile = profileUrl(f);
  const events = [...(history.currentData?.rows || [])].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const relatedRows = related.currentData || [];

  return (
    <div className={styles.pane} data-layout={layout}>
      <div className={styles.paneHead}>
        <div className={styles.paneTitleRow}>
          <span className={local.kind}><Icon name={TYPE_ICON[f.type] || 'message-circle'} size={13} aria-hidden="true" />{f.type}{f.topic !== '—' ? ` · ${f.topic}` : ''}</span>
          <div className={styles.paneActions}>
            {f.status !== 'Resolved' && f.status !== 'Spam' && <Button size="sm" variant="outline" icon="circle-check" disabled={busy} onClick={() => change('update', { status: 'Resolved' }, 'Feedback resolved')}>Resolve</Button>}
            {f.status === 'Resolved' && <Button size="sm" variant="outline" icon="rotate-ccw" disabled={busy} onClick={() => change('update', { status: 'Open' }, 'Feedback reopened')}>Reopen</Button>}
            <span ref={menuRef} className={styles.menuAnchor}>
              <Button size="sm" variant="ghost" icon="ellipsis" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} />
              {menu && <DropdownMenu width={210} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }} items={[
                layout === 'split' && { label: 'Open full page', icon: 'maximize-2', onClick: () => navigate(feedbackPageUrl(f.id)) },
                { label: 'Copy link', icon: 'link', onClick: () => { setMenu(false); navigator.clipboard?.writeText(window.location.origin + feedbackPageUrl(f.id)).then(() => showToast('Link copied')); } },
                f.unread === false && { label: 'Mark as unread', icon: 'mail', onClick: () => { setMenu(false); markedRead.current = true; change('read', { isRead: false }, 'Marked as unread'); } },
                f.status !== 'Spam' && { divider: true },
                f.status !== 'Spam' && { label: 'Mark as spam', icon: 'ban', tone: 'danger', onClick: () => { setMenu(false); change('spam', {}, 'Marked as spam'); } },
              ].filter(Boolean)} />}
            </span>
          </div>
        </div>
        <h2 className={styles.paneSubject}>{f.title}</h2>
        <div className={styles.properties}>
          {f.status === 'Spam' ? <span className={styles.property} aria-label="Status: Spam"><span className={styles.dot} style={{ background: STATUS_DOT.Spam }} aria-hidden="true" /><span>Spam</span></span>
            : <PropertyPicker label="Status" value={f.status} display={STATUS_OPTIONS.find((o) => o.value === f.status)?.label} dot={STATUS_DOT[f.status]} disabled={busy}
              options={STATUS_OPTIONS} onChange={(status) => change('update', { status }, `Marked ${STATUS_OPTIONS.find((o) => o.value === status).label.toLowerCase()}`)} />}
          <PropertyPicker label="Assignee" value={f.assignedToId} display={f.assignedToId ? f.assignee : 'Unassigned'} icon="user-round" disabled={busy || assignees.isLoading}
            options={assigneeOptions} width={220} onChange={(assignedToId) => change('update', { assignedToId }, assignedToId ? 'Assigned' : 'Unassigned')} />
          {!f.assignedToId && me && <button type="button" className={styles.property} disabled={busy} onClick={() => change('update', { assignedToId: me }, 'Assigned to you')}><Icon name="hand" size={14} aria-hidden="true" /><span>Assign to me</span></button>}
        </div>
      </div>

      <div className={styles.paneBody}>
        <div className={styles.conversation}>
          <div className={`${styles.thread} tk-scroll`}>
            <div className={styles.message} data-side="customer">
              <Avatar name={f.user} size={28} />
              <div className={styles.bubble}>
                <header><strong>{f.user}</strong><span>{f.channel !== '—' ? f.channel : ''}</span><time title={fullTime(f.submittedAtTs)}>{shortTime(f.submittedAtTs)}</time></header>
                <p>{f.body}</p>
              </div>
            </div>
            {history.isLoading && <div className={styles.threadLoading}><Skeleton width="50%" height={12} /></div>}
            {events.filter((e) => e.type !== 'SUBMITTED').map((e) => e.type === 'REPLY' && e.reply?.message ? (
              <div key={e.id} className={styles.message} data-side="agent">
                <Avatar name={e.actor} size={28} />
                <div className={styles.bubble}>
                  <header><strong>{e.actor}</strong><span>Reply</span><time title={fullTime(e.timestamp)}>{shortTime(e.timestamp)}</time></header>
                  <p>{e.reply.message}</p>
                </div>
              </div>
            ) : (
              <div key={e.id} className={styles.event}>
                <Icon name={EVENT_ICON[e.type] || 'dot'} size={13} aria-hidden="true" />
                <span><strong>{e.actor !== '—' ? e.actor : 'System'}</strong> {e.title.charAt(0).toLowerCase() + e.title.slice(1)}{e.description !== '—' && e.type !== 'NOTE' ? `: ${e.description}` : ''}</span>
                <time title={fullTime(e.timestamp)}>{shortTime(e.timestamp)}</time>
              </div>
            ))}
          </div>
          {canReply ? (
            <ReplyBox disabled={busy || !f.version} onSend={(message, resolve) => change('reply', { message }, (result) => feedbackReplyMessage(result.delivery))
              .then(async (ok) => { if (ok && resolve) await change('update', { status: 'Resolved' }, 'Feedback resolved'); return ok; })} />
          ) : (
            <p className={styles.notice}><Icon name="info" size={13} aria-hidden="true" />{f.status === 'Spam' ? 'This was marked as spam.' : 'This was sent from the admin console, so there’s no one to reply to.'}</p>
          )}
        </div>

        <aside className={`${styles.details} tk-scroll`}>
          <section>
            <h3>From</h3>
            <div className={styles.customer}>
              <Avatar name={f.user} size={34} />
              <div><strong>{f.user}</strong><span>{ROLE_LABEL[f.roleCode] || f.userType}</span></div>
            </div>
            <dl className={styles.facts}>
              {f.email !== '—' && <div className={styles.fact}><dt>Email</dt><dd><a href={`mailto:${f.email}`}>{f.email}</a></dd></div>}
              {f.totalFeedback !== '—' && <div className={styles.fact}><dt>Feedback sent</dt><dd>{f.totalFeedback}</dd></div>}
            </dl>
            {profile && <Link to={profile} className={styles.sideLink}>View profile <Icon name="arrow-right" size={13} aria-hidden="true" /></Link>}
          </section>
          <section>
            <h3>Details</h3>
            <dl className={styles.facts}>
              <div className={styles.fact}><dt>Sent</dt><dd>{fullTime(f.submittedAtTs)}</dd></div>
              <div className={styles.fact}><dt>Channel</dt><dd>{f.channel}</dd></div>
              {f.device !== '—' && <div className={styles.fact}><dt>Device</dt><dd>{f.device}</dd></div>}
              {f.resolvedOn !== '—' && <div className={styles.fact}><dt>Resolved</dt><dd>{f.resolvedOn}</dd></div>}
            </dl>
          </section>
          <section>
            <h3>Tags</h3>
            <Tags tags={f.tags} disabled={busy} onAdd={(tag) => change('tags', { tag }, 'Tag added')} />
          </section>
          <section>
            <h3>Internal note</h3>
            <NoteEditor value={f.note} author={f.noteAuthor} at={f.noteAt} disabled={busy || !f.noteKnown} onSave={(text) => change('note', { text }, 'Note saved')} />
          </section>
          {relatedRows.length > 0 && (
            <section>
              <h3>Related</h3>
              <ul className={styles.relatedList}>
                {relatedRows.map((row) => (
                  <li key={row.id}>
                    <a href={feedbackPageUrl(row.id)} onClick={(event) => { if (onSelect) { event.preventDefault(); onSelect(row.id); } }}>
                      <Icon name={TYPE_ICON[row.type] || 'message-circle'} size={13} aria-hidden="true" /><span>{row.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
