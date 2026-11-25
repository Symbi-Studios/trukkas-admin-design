'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, Badge, Button, Card, DropdownMenu, Icon, Pagination, Skeleton } from '../../ds.js';
import { Link, useNavigate, useParams } from '../../router.js';
import {
  announcementCopyUrl, announcementEditUrl, useGetAdminAnnouncementOptionsQuery, useGetAdminAnnouncementQuery, useGetAdminAnnouncementRecipientsQuery,
} from '../../store/features/announcements/announcementsApi.js';
import { useAnnouncementOperations } from '../../store/features/announcements/useAnnouncementOperations.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { DriverDetailLoading } from '../DriversLoading.jsx';
import { AnnouncementReasonDialog } from '../AnnouncementDialogs.jsx';
import { ROLE_LABEL, audienceSentence, channelList, deliverySummary, formatLagos } from './announcementView.js';
import styles from './Announcements.module.css';

const STATUS_TONE = { Published: 'success', Scheduled: 'info', Draft: 'neutral', Expired: 'neutral' };
const FILTERS = [
  { id: null, label: 'Everyone' }, { id: 'seen', label: 'Seen' }, { id: 'unseen', label: 'Not seen' },
  { id: 'acknowledged', label: 'Confirmed' }, { id: 'pending', label: 'Not confirmed' },
];
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function Recipients({ id, owner, acknowledgement }) {
  const [filter, setFilter] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const query = useGetAdminAnnouncementRecipientsQuery({ id, owner, filter, page }, { refetchOnMountOrArgChange: true });
  const data = query.error ? null : query.currentData;
  const filters = acknowledgement ? FILTERS : FILTERS.slice(0, 3);
  return (
    <section className={styles.card} aria-label="Recipients">
      <div className={styles.cardHead} style={{ paddingBottom: 6 }}><h2>Recipients</h2>{data?.total != null && <span>{data.total.toLocaleString('en-NG')}</span>}</div>
      <div className={styles.filters} role="tablist" aria-label="Filter recipients">
        {filters.map((f) => <button key={f.label} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label}</button>)}
      </div>
      {query.isLoading || (query.isFetching && !query.currentData) ? (
        <div style={{ display: 'grid', gap: 12, padding: 18 }}><Skeleton height={12} width="50%" /><Skeleton height={12} width="40%" /><Skeleton height={12} width="60%" /></div>
      ) : query.error ? (
        <div className={styles.empty}><strong>Couldn’t load recipients</strong><span>{getApiErrorMessage(query.error)}</span><Button size="sm" variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
      ) : !data.rows.length ? (
        <div className={styles.empty}><strong>{filter ? 'No one here' : 'No recipients yet'}</strong><span>{filter ? 'Nobody matches this filter.' : 'Recipients are listed once it’s sent.'}</span></div>
      ) : (
        <ul className={styles.people2}>
          {data.rows.map((row) => (
            <li key={row.id}>
              <div className={styles.recipient}>
                <Avatar name={row.name} size={28} />
                <span><strong>{row.name}</strong><small>{[ROLE_LABEL[row.role] || row.role, row.email].filter(Boolean).join(' · ')}</small></span>
                <span className={styles.recipientState}>
                  {acknowledgement && row.acknowledgedAt ? <Badge tone="success">Confirmed</Badge> : row.seenAt ? <Badge tone="info">Seen</Badge> : row.deliveredAt ? <Badge>Delivered</Badge> : <Badge>Pending</Badge>}
                  <span title={formatLagos(row.acknowledgedAt || row.seenAt || row.deliveredAt)}>{formatLagos(row.acknowledgedAt || row.seenAt || row.deliveredAt, false)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.pageCount > 1 && <div style={{ borderTop: '1px solid var(--tk-line)' }}><Pagination page={page} pageSize={25} total={data.total} pageCount={data.pageCount} onPage={setPage} /></div>}
    </section>
  );
}

export function AnnouncementView() {
  const navigate = useNavigate();
  const params = useParams();
  const search = useSearchParams();
  const id = search.get('announcementId') || params.announcementId;
  const operations = useAnnouncementOperations();
  const { owner, authenticated } = operations;
  const query = useGetAdminAnnouncementQuery({ id, owner }, { skip: !authenticated || !id, refetchOnMountOrArgChange: true });
  const options = useGetAdminAnnouncementOptionsQuery({ owner }, { skip: !authenticated });
  const a = authenticated && !query.error ? query.currentData : null;
  const [menu, setMenu] = React.useState(false);
  const [reason, setReason] = React.useState(null);
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const escape = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(false); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape, true); };
  }, [menu]);

  async function run(action) {
    setMenu(false);
    try {
      const result = await operations.perform({ action, id: a.id });
      if (!result) return;
      if (action === 'duplicate') { showToast('Copy created as a draft'); navigate(announcementCopyUrl(result.announcement.id)); }
      else showToast(result.message?.replace(/\.$/, '') || 'Done');
    } catch (failure) { showToast(getApiErrorMessage(failure), { tone: 'info' }); }
  }

  if (query.isLoading || (query.isFetching && !query.currentData)) return <DriverDetailLoading label="Loading announcement…" />;
  if (!a) {
    return <Card><div className={styles.empty}><strong>{query.error ? 'Couldn’t load this announcement' : 'Announcement not found'}</strong>
      <span>{query.error ? getApiErrorMessage(query.error) : 'It may have been removed.'}</span>
      <Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate('/announcements')}>Back to announcements</Button></div></Card>;
  }

  const sent = a.sentCount ?? a.delivery?.recipients ?? 0, seen = a.v ?? 0, acked = a.acknowledgedCount ?? 0;
  const live = a.statusCode === 'PUBLISHED';
  const editable = ['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(a.statusCode);
  const audience = audienceSentence({ audience: a.form.audience, targeting: a.form.targeting }, options.currentData);
  const when = a.statusCode === 'SCHEDULED' ? `Sends ${formatLagos(a.displayAt)}` : a.statusCode === 'PUBLISHED' ? `Sent ${formatLagos(a.displayAt)}` : a.statusCode === 'DRAFT' ? 'Not sent' : a.st;
  const menuItems = [
    { label: 'Duplicate', icon: 'copy', onClick: () => run('duplicate') },
    live && { label: 'Unpublish', icon: 'eye-off', onClick: () => { setMenu(false); setReason('unpublish'); } },
    a.statusCode !== 'SCHEDULED' && a.statusCode !== 'ARCHIVED' && { divider: true },
    a.statusCode !== 'SCHEDULED' && a.statusCode !== 'ARCHIVED' && { label: 'Archive', icon: 'archive', tone: 'danger', onClick: () => { setMenu(false); setReason('archive'); } },
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <header>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to="/announcements">Announcements</Link><Icon name="chevron-right" size={12} aria-hidden="true" /><span>{a.t}</span>
        </nav>
        <div className={styles.titleRow}>
          <div style={{ minWidth: 0 }}>
            <h1 className="tk-display">{a.t}</h1>
            <p className={styles.subtitle} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={STATUS_TONE[a.st] || 'neutral'} dot>{a.st}</Badge>
              <span>{a.type}</span><span aria-hidden="true">·</span><span>{when}</span>
              {a.pinned && <><span aria-hidden="true">·</span><span>Pinned</span></>}
            </p>
          </div>
          <div className={styles.actions}>
            <span ref={menuRef} className={styles.menuAnchor}>
              <Button variant="outline" icon="ellipsis" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} disabled={operations.saving} onClick={() => setMenu(!menu)} />
              {menu && <DropdownMenu width={200} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 'var(--tk-z-dropdown)' }} items={menuItems} />}
            </span>
            {editable && <Button variant="outline" icon="pencil" onClick={() => navigate(announcementEditUrl(a.id))}>Edit</Button>}
            {['DRAFT', 'SCHEDULED'].includes(a.statusCode) && <Button icon="send" loading={operations.saving} onClick={() => run('publish')}>Send now</Button>}
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', minWidth: 0 }}>
          {['PUBLISHED', 'EXPIRED', 'UNPUBLISHED', 'ARCHIVED'].includes(a.statusCode) && (
            <section className={styles.card} aria-label="Delivery">
              <div className={styles.funnel}>
                <div><span>Delivered</span><strong>{sent.toLocaleString('en-NG')}</strong><small>{deliverySummary(a.delivery, a.channels || []) || '—'}</small></div>
                <div><span>Seen</span><strong>{seen.toLocaleString('en-NG')}</strong><span className={styles.track}><span style={{ width: `${pct(seen, sent)}%` }} /></span><small>{pct(seen, sent)}% of delivered</small></div>
                <div><span>{a.acknowledgement ? 'Confirmed read' : 'Read confirmation'}</span>
                  {a.acknowledgement ? <><strong>{acked.toLocaleString('en-NG')}</strong><span className={styles.track}><span style={{ width: `${pct(acked, sent)}%` }} /></span><small>{pct(acked, sent)}% of delivered</small></>
                    : <><strong style={{ color: 'var(--tk-ink-300)' }}>Off</strong><small>Not requested</small></>}</div>
              </div>
            </section>
          )}
          <section className={styles.card} aria-label="Message">
            <div className={styles.cardHead}><h2>Message</h2></div>
            <div className={styles.cardBody}><p className={styles.messageBlock}>{a.p}</p></div>
          </section>
          {a.statusCode !== 'DRAFT' && a.statusCode !== 'SCHEDULED' && <Recipients id={a.id} owner={owner} acknowledgement={a.acknowledgement === true} />}
        </div>
        <aside className={styles.side}>
          <section className={styles.card} aria-label="Details">
            <div className={styles.cardHead}><h2>Details</h2></div>
            <dl className={`${styles.facts} ${styles.cardBody}`}>
              <div><dt>To</dt><dd>{audience}</dd></div>
              <div><dt>Channels</dt><dd>{channelList(a.channels || []) || '—'}</dd></div>
              <div><dt>Priority</dt><dd>{a.priority}</dd></div>
              <div><dt>Read confirmation</dt><dd>{a.acknowledgement ? 'Required' : 'Off'}</dd></div>
              <div><dt>Expires</dt><dd>{a.state.expiresAt ? formatLagos(Date.parse(a.state.expiresAt)) : 'Doesn’t expire'}</dd></div>
              <div><dt>Created</dt><dd>{formatLagos(a.createdAt)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      {reason && <AnnouncementReasonDialog action={reason} announcement={a} operations={operations} onClose={() => setReason(null)}
        onSaved={(result) => showToast(result.message?.replace(/\.$/, '') || 'Done')} />}
    </div>
  );
}
