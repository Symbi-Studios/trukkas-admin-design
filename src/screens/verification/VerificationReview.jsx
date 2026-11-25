'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Avatar, Badge, Banner, Button, Card, DropdownMenu, Icon, Skeleton } from '../../ds.js';
import { Link, useNavigate, useParams } from '../../router.js';
import {
  canManageVerification, canReviewVerification, useChangeAdminVerificationMutation, useGetAdminVerificationDetailQuery,
  useGetAdminVerificationEntriesQuery, useGetAdminVerificationHistoryQuery, verificationDate,
} from '../../store/features/verification/verificationApi.js';
import { useVerificationOperations } from '../../store/features/verification/useVerificationOperations.js';
import { useGetAdminCompanyDocumentsQuery } from '../../store/features/companies/companyDocumentsApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { CompanyDocumentDialog } from '../CompanyDocumentDialog.jsx';
import { DriverDetailLoading } from '../DriversLoading.jsx';
import { VerificationActionDialog } from './VerificationDialogs.jsx';
import { REQUIREMENT_TONE, STATUS_TONE, expiryLabel, profileUrl, subjectLabel, waitingLabel } from './verificationQueue.js';
import styles from './Verification.module.css';

const REQ_ICON = { success: 'circle-check', danger: 'circle-x', warning: 'circle-dashed', info: 'circle-dot', neutral: 'circle' };
const ROLE_LABEL = { TRUCKER: 'Trucker', DRIVER: 'Driver', FORWARDER: 'Forwarder', EXPORTER: 'Forwarder' };
const CASE_MANAGERS = ['SUPER_ADMIN', 'OPS_ADMIN'];
const sentence = (value) => { const t = typeof value === 'string' ? value.trim() : ''; return t ? t.charAt(0).toUpperCase() + t.slice(1) : null; };
const actorName = (actor) => (actor?.type === 'SYSTEM' ? 'System' : actor?.name || null);

export function VerificationReview() {
  const { verificationId } = useParams();
  const search = useSearchParams();
  const scope = useSelector((state) => [state.auth.admin?.id, state.auth.admin?.role, Boolean(state.auth.signedIn)].join(':'));
  return <ReviewScreen key={[scope, search.get('id') || verificationId, search.get('source')].join(':')} />;
}

function Requirement({ item, companyDocument, onOpenDocument }) {
  const tone = REQUIREMENT_TONE[item.status] || 'neutral';
  const expired = item.statusCode === 'EXPIRED';
  const details = [
    item.sub !== '—' && item.sub !== 'Company document' ? item.sub : null,
    item.cat !== '—' ? item.cat : null,
    item.expiresAt !== '—' ? `${expired ? 'Expired' : 'Expires'} ${item.expiresAt}` : null,
  ].filter(Boolean);
  const reviewed = item.by !== '—' ? `${item.status === 'Expired' ? 'Last reviewed' : 'Reviewed'} by ${item.by}${item.on !== '—' ? ` · ${item.on}` : ''}` : null;
  const note = item.note !== '—' ? item.note : null;
  const file = item.fileName || (item.url ? 'View file' : null);
  return (
    <li className={styles.req}>
      <Icon name={REQ_ICON[tone]} size={16} className={styles.reqIcon} data-tone={tone} aria-hidden="true" />
      <span className={styles.reqText}>
        <strong>{item.name}</strong>
        {details.length > 0 && <span>{details.join(' · ')}</span>}
        {(reviewed || note) && <span>{[reviewed, note].filter(Boolean).join(' · ')}</span>}
      </span>
      <span className={styles.reqEnd}>
        {file && (companyDocument
          ? <button type="button" className={styles.fileButton} onClick={() => onOpenDocument(companyDocument)} title={item.fileName || undefined}>
              <Icon name="file-search" size={13} aria-hidden="true" /><span>Review file</span>
            </button>
          : item.url && <a className={styles.fileButton} href={item.url} target="_blank" rel="noopener noreferrer" title={item.fileName || undefined}>
              <Icon name="external-link" size={13} aria-hidden="true" /><span>{file}</span>
            </a>)}
        <Badge tone={tone}>{item.status}</Badge>
      </span>
    </li>
  );
}

function ActivityCard({ id, owner, role, canPost, events, loading }) {
  const [mode, setMode] = React.useState('comment');
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState('');
  const [change, state] = useChangeAdminVerificationMutation();
  async function post() {
    if (!text.trim() || state.isLoading) return;
    setError('');
    try {
      await change({ action: mode, id, body: { body: text.trim() }, owner, role }).unwrap();
      setText(''); showToast(mode === 'note' ? 'Note added' : 'Comment added');
    } catch (failure) { setError(getApiErrorMessage(failure)); }
  }
  return (
    <section className={styles.card} aria-label="Activity">
      <div className={styles.cardHead}><h2>Activity</h2>{!loading && <span>{events.length} {events.length === 1 ? 'event' : 'events'}</span>}</div>
      {loading ? <div className={styles.cardBody}><Skeleton height={12} width="60%" /><Skeleton height={12} width="40%" style={{ marginTop: 10 }} /></div>
        : !events.length ? <div className={styles.cardBody}><span className="tk-meta">No activity yet.</span></div>
          : <ol className={styles.feed}>
            {events.map((event) => (
              <li key={event.id} className={styles.event} data-kind={event.kind}>
                <span className={styles.eventIcon} aria-hidden="true"><Icon name={event.icon} size={12} /></span>
                <span>
                  <span className={styles.eventMeta}>{event.actor && <strong>{event.actor}</strong>}{event.actor && ' · '}{event.kind === 'note' ? 'Internal note · ' : event.kind === 'comment' ? 'Comment · ' : ''}{event.time}</span>
                  <span className={styles.eventBody}>{event.text}</span>
                </span>
              </li>
            ))}
          </ol>}
      {canPost && (
        <div className={styles.composer} data-note={mode === 'note' || undefined}>
          <div className={styles.composerTabs} role="tablist" aria-label="Entry type">
            <button type="button" role="tab" aria-selected={mode === 'comment'} onClick={() => setMode('comment')}>Comment</button>
            <button type="button" role="tab" aria-selected={mode === 'note'} onClick={() => setMode('note')}>Internal note</button>
          </div>
          {error && <Banner tone="danger" inline>{error}</Banner>}
          <textarea value={text} disabled={state.isLoading} aria-label={mode === 'note' ? 'Internal note' : 'Comment'}
            placeholder={mode === 'note' ? 'Add a note for other admins…' : 'Add a comment to the case…'}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); post(); } }} />
          <div className={styles.composerBar}>
            <span>⌘ ↵ to post</span>
            <Button size="sm" variant={mode === 'note' ? 'outline' : 'primary'} loading={state.isLoading} disabled={!text.trim()} onClick={post}>
              {mode === 'note' ? 'Add note' : 'Comment'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewScreen() {
  const { verificationId } = useParams();
  const search = useSearchParams();
  const id = search.get('id') || verificationId;
  const source = search.get('source');
  const navigate = useNavigate();
  const operations = useVerificationOperations();
  const { owner, role } = operations;
  const query = useGetAdminVerificationDetailQuery({ source, id, owner, role }, { skip: !id || !operations.authenticated, refetchOnMountOrArgChange: true });
  const v = !operations.authenticated || query.error ? null : query.currentData;
  const ready = Boolean(v?.id);
  const scoped = { id: v?.id, owner, role };
  const subOptions = { skip: !operations.authenticated || !ready, refetchOnMountOrArgChange: true };
  const history = useGetAdminVerificationHistoryQuery(scoped, subOptions);
  const comments = useGetAdminVerificationEntriesQuery({ ...scoped, kind: 'comments' }, subOptions);
  const notes = useGetAdminVerificationEntriesQuery({ ...scoped, kind: 'notes' }, subOptions);
  const isCompany = ['TRUCKING_COMPANY', 'TRUCKER'].includes(v?.entityTypeCode);
  const companyDocs = useGetAdminCompanyDocumentsQuery({ id: v?.entityId, owner }, { skip: !operations.authenticated || !isCompany || !v?.entityId });
  const docsById = React.useMemo(() => new Map((companyDocs.currentData?.documents || []).filter((d) => d.id).map((d) => [d.id, d])), [companyDocs.currentData]);

  const [dialog, setDialog] = React.useState(null);
  const [menu, setMenu] = React.useState(false);
  const [document, setDocument] = React.useState(null);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(false); } };
    window.document.addEventListener('pointerdown', close); window.document.addEventListener('keydown', escape, true);
    return () => { window.document.removeEventListener('pointerdown', close); window.document.removeEventListener('keydown', escape, true); };
  }, [menu]);

  const events = React.useMemo(() => {
    const list = [];
    for (const e of history.currentData || []) list.push({ id: 'h' + e.id, kind: 'event', icon: e.stage === 'APPLICATION_SUBMITTED' ? 'send' : e.outcome === 'VERIFIED' ? 'check' : ['EXPIRED', 'REJECTED', 'NON_COMPLIANT'].includes(e.outcome) ? 'x' : 'dot', text: sentence(e.description) || sentence(e.stage?.toLowerCase().replaceAll('_', ' ')) || 'Updated', actor: actorName(e.actor), at: Date.parse(e.timestamp) });
    for (const e of comments.currentData || []) list.push({ id: 'c' + e.id, kind: 'comment', icon: 'message-square', text: e.body, actor: actorName(e.author), at: Date.parse(e.createdAt) });
    for (const e of notes.currentData || []) list.push({ id: 'n' + e.id, kind: 'note', icon: 'lock', text: e.body, actor: actorName(e.author), at: Date.parse(e.createdAt) });
    return list.filter((e) => e.text).sort((a, b) => (b.at || 0) - (a.at || 0)).map((e) => ({ ...e, time: Number.isNaN(e.at) ? '—' : verificationDate(new Date(e.at).toISOString(), true) }));
  }, [history.currentData, comments.currentData, notes.currentData]);

  if (query.isLoading || (query.isFetching && !query.currentData)) return <DriverDetailLoading label="Loading verification…" />;
  if (!v) {
    return (
      <Card>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true"><Icon name={query.error ? 'cloud-off' : 'search-x'} size={18} /></span>
          <strong>{query.error ? 'Couldn’t load this verification' : 'Verification not found'}</strong>
          <span>{query.error ? getApiErrorMessage(query.error) : `Nothing matches ${id || 'this link'}.`}</span>
          <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate('/verification')}>Back to queue</Button>
            {query.error && <Button variant="outline" size="sm" onClick={() => query.refetch()}>Try again</Button>}
          </span>
        </div>
      </Card>
    );
  }

  const canDecide = canReviewVerification(role, v.source);
  const canManage = operations.canManage && canManageVerification(role);
  const canCase = canManage && CASE_MANAGERS.includes(role);
  const p = v.progress;
  const pct = p && p.total ? Math.round((p.completed / p.total) * 100) : null;
  const profile = profileUrl(v);
  const expiry = expiryLabel(v);
  const waiting = v.open ? waitingLabel(v.submittedAtRaw) : null;
  const unresolvedAtDecision = !v.open && v.statusCode === 'VERIFIED' && p && p.completed < p.total ? p.total - p.completed : 0;
  const open = (action) => { setMenu(false); setDialog(action); };

  const menuItems = [
    canCase && v.open && { label: 'Request information', icon: 'message-square-reply', onClick: () => open('information') },
    canCase && { label: v.assignedAdminId ? 'Reassign' : 'Assign', icon: 'user-round-plus', onClick: () => open('reassign') },
    canCase && v.open && { label: 'Priority and due date', icon: 'calendar', onClick: () => open('edit') },
    canCase && { divider: true },
    { label: 'Download documents (ZIP)', icon: 'download', onClick: () => { setMenu(false); operations.download(v.id, 'documents'); } },
    { label: 'Export report (PDF)', icon: 'file-text', onClick: () => { setMenu(false); operations.download(v.id, 'report'); } },
    canManage && canDecide && v.open && { divider: true },
    canManage && canDecide && v.open && { label: 'Mark non-compliant', icon: 'circle-slash', tone: 'danger', onClick: () => open('noncompliant') },
    canCase && v.open && { label: 'Cancel case', icon: 'ban', tone: 'danger', onClick: () => open('cancel') },
  ].filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <header>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/verification">Verification</Link><Icon name="chevron-right" size={12} aria-hidden="true" /><span>{v.entityName}</span>
        </nav>
        <div className={styles.titleRow}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            <Avatar name={v.entityName} size={44} />
            <div style={{ minWidth: 0 }}>
              <h1 className="tk-display">{v.entityName}</h1>
              <p className={styles.subtitle}>{subjectLabel(v)}{v.documentType ? ` · ${v.kind}` : ''}{v.regNo !== '—' ? ` · ${v.regNo}` : ''}</p>
            </div>
          </div>
          <div className={styles.actions}>
            <span ref={menuRef} className={styles.menuAnchor}>
              <Button variant="outline" icon="ellipsis" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} />
              {menu && <DropdownMenu width={230} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }} items={menuItems} />}
            </span>
            {v.open && canDecide && <>
              <Button variant="outline" icon="x" disabled={!v.canReject} title={v.canReject ? undefined : 'The backend didn’t offer a reject action for this item'} onClick={() => open('reject')}>Reject</Button>
              <Button icon="check" disabled={!v.canApprove} title={v.canApprove ? undefined : 'The backend didn’t offer an approve action for this item'} onClick={() => open('approve')}>Approve</Button>
            </>}
          </div>
        </div>
        <div className={styles.metaRow}>
          <Badge tone={STATUS_TONE[v.status] || 'neutral'} dot>{v.status}</Badge>
          {expiry && <Badge tone={expiry.tone}>{expiry.text}</Badge>}
          {v.riskCode && v.riskCode !== 'LOW' && <Badge tone={v.riskCode === 'HIGH' ? 'danger' : 'warning'}>{v.riskLevel} risk</Badge>}
          <span>Submitted {v.submittedOn}</span>
          {waiting && <><span className={styles.dot} /><span>{waiting}</span></>}
          {profile && <><span className={styles.dot} /><Link to={profile.url}>{profile.label} →</Link></>}
        </div>
        {v.open && !canDecide && <Banner tone="info" inline style={{ marginTop: 12 }}>Only Super Admins and Operations Admins can decide on company documents.</Banner>}
      </header>

      <div className={styles.review}>
        <div className={styles.main}>
          {!v.open && (
            <Banner inline tone={v.statusCode === 'VERIFIED' ? 'success' : v.statusCode === 'CANCELLED' ? 'info' : 'danger'}
              title={`${v.status}${v.reviewedOn !== '—' ? ` on ${v.reviewedOn}` : ''}`}>
              {[v.reason, unresolvedAtDecision ? `${unresolvedAtDecision} of ${p.total} requirements were still open at the time.` : null].filter(Boolean).join(' ') || 'No reason was recorded.'}
            </Banner>
          )}
          {v.open && v.riskSignals.length > 0 && (
            <Banner inline tone="warning" title="Check before approving">
              {v.riskSignals.length === 1 ? v.riskSignals[0] : <ul className={styles.signals}>{v.riskSignals.map((s) => <li key={s}>{s}</li>)}</ul>}
            </Banner>
          )}

          <section className={styles.card} aria-label="Requirements">
            <div className={styles.cardHead}>
              <h2>Requirements</h2>
              {p && <span className={styles.reqProgress}>
                <span>{p.completed} of {p.total} verified</span>
                <span className={styles.track} data-done={pct === 100 || undefined}><span style={{ width: `${pct ?? 0}%` }} /></span>
              </span>}
            </div>
            {v.requirements.length
              ? <ul className={styles.reqs}>{v.requirements.map((item) => (
                <Requirement key={item.key} item={item} companyDocument={item.documentId ? docsById.get(item.documentId) : null} onOpenDocument={setDocument} />
              ))}</ul>
              : <div className={styles.cardBody}><span className="tk-meta">No requirements were returned for this item.</span></div>}
          </section>

          <ActivityCard id={v.id} owner={owner} role={role} canPost={canManage}
            events={events} loading={history.isLoading || comments.isLoading || notes.isLoading} />
        </div>

        <aside className={styles.side}>
          <section className={styles.card} aria-label="Case">
            <div className={styles.cardHead}><h2>Case</h2></div>
            <dl className={`${styles.facts} ${styles.cardBody}`}>
              <div><dt>Check</dt><dd>{v.type}</dd></div>
              <div><dt>Assigned to</dt><dd>{v.assignedTo !== '—' ? v.assignedTo : <span className="tk-meta">Unassigned</span>}{canCase && <> · <button type="button" className={styles.linkButton} onClick={() => open('reassign')}>{v.assignedAdminId ? 'Change' : 'Assign'}</button></>}</dd></div>
              <div><dt>Priority</dt><dd>{v.priority}</dd></div>
              <div><dt>Due</dt><dd style={v.overdue ? { color: 'var(--tk-danger)' } : undefined}>{v.dueDate !== '—' ? v.dueDate : <span className="tk-meta">No due date</span>}</dd></div>
              {v.expiresAt !== '—' && <div><dt>{v.expired ? 'Expired' : 'Expires'}</dt><dd>{v.expiresAt}</dd></div>}
              <div><dt>Reference</dt><dd style={{ fontFamily: 'var(--tk-font-mono)', fontSize: 12, fontWeight: 400 }}>{v.id}</dd></div>
            </dl>
          </section>

          <section className={styles.card} aria-label="Submitted by">
            <div className={styles.cardHead}><h2>Submitted by</h2>{v.submittedByRole && <span>{ROLE_LABEL[v.submittedByRole] || v.submittedByRole}</span>}</div>
            <dl className={`${styles.facts} ${styles.cardBody}`}>
              <div><dt>Name</dt><dd>{v.submittedBy}</dd></div>
              {v.email && <div><dt>Email</dt><dd><a href={`mailto:${v.email}`}>{v.email}</a></dd></div>}
              {v.phone && <div><dt>Phone</dt><dd><a href={`tel:${v.phone}`}>{v.phone}</a></dd></div>}
              {v.address && <div><dt>Address</dt><dd>{v.address}</dd></div>}
              <div><dt>Entity</dt><dd>{v.entityType}{v.country !== '—' ? ` · ${v.country}` : ''}</dd></div>
              {v.joined !== '—' && <div><dt>Joined</dt><dd>{v.joined}</dd></div>}
            </dl>
          </section>

          <section className={styles.card} aria-label="Risk">
            <div className={styles.cardHead}><h2>Risk</h2><span>{v.riskLevel}</span></div>
            <div className={styles.cardBody}>
              {v.riskSignals.length
                ? <ul className={styles.signals} style={{ margin: 0 }}>{v.riskSignals.map((s) => <li key={s}>{s}</li>)}</ul>
                : <span className="tk-meta">No risk signals.</span>}
              {!v.screeningChecked && <p className={styles.note}>Sanctions, PEP, adverse-media and credit screening aren’t connected, so risk comes only from the signals above.</p>}
            </div>
          </section>
        </aside>
      </div>

      {dialog && <VerificationActionDialog key={dialog} action={dialog} model={v} onClose={() => setDialog(null)} />}
      {document && <CompanyDocumentDialog companyId={v.entityId} document={document} onClose={() => setDocument(null)}
        onDone={(message) => { showToast(message); query.refetch(); }} />}
    </div>
  );
}
