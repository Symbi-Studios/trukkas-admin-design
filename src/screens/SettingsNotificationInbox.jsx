'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Badge, Button, DataTable, EmptyState, Pagination, SectionCard } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { useGetAdminSettingsInboxQuery, useMarkAdminSettingsInboxReadMutation } from '../store/features/settings/settingsInboxApi.js';

export function SettingsNotificationInbox() {
  const admin = useSelector(state => state.auth.admin), authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <Inbox key={[admin?.id, admin?.role, authenticated].join(':')} owner={admin?.id} role={admin?.role} authenticated={authenticated} />;
}
function Inbox({ owner, role, authenticated }) {
  const [page, setPage] = useState(1), [error, setError] = useState(null);
  const args = { owner, role, page, limit: 20 };
  const query = useGetAdminSettingsInboxQuery(args, { skip: !owner || !authenticated, refetchOnMountOrArgChange: true });
  const [markRead, mutation] = useMarkAdminSettingsInboxReadMutation();
  const pending = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const data = !authenticated || query.error ? null : query.currentData;
  useEffect(() => { if (data && page > Math.max(1, data.pages)) setPage(Math.max(1, data.pages)); }, [data, page]);
  async function mark(id, all = false) {
    if (pending.current || query.isFetching || !data || !authenticated) return;
    pending.current = true; setError(null);
    try { await markRead({ ...args, id, all }).unwrap(); }
    catch (failure) { if (mounted.current) setError(getApiErrorMessage(failure)); }
    finally { pending.current = false; }
  }
  return <SectionCard title="In-App Notifications" pad="none" action={<Button size="sm" variant="outline" disabled={!data || data.unreadCount == null || data.unreadCount === 0 || query.isFetching || mutation.isLoading} onClick={() => mark(null, true)}>Mark all as read</Button>}>
    {(error || query.error) && <div style={{ padding: 'var(--tk-card-pad)' }}><Banner tone="danger">{error || getApiErrorMessage(query.error)}</Banner></div>}
    {query.isFetching ? <><DriverLoadingNotice>Loading notifications…</DriverLoadingNotice><DriverTableLoading columns={4} label="Loading notifications" /></>
      : query.error ? <div style={{ padding: 'var(--tk-card-pad)' }}><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>
        : !data ? <div style={{ padding: 'var(--tk-card-pad)' }}>—</div>
          : data.rows.length ? <DataTable rows={data.rows} rowKey={row => row.id} columns={[
            { key: 'notification', header: 'Notification', render: row => <div style={{ display: 'grid', gap: 4, minWidth: 160, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>{row.title}</strong><span className="tk-meta">{row.body}</span></div> },
            { key: 'created', header: 'Date' },
            { key: 'status', header: 'Status', render: row => <Badge tone={row.read === false ? 'info' : 'neutral'}>{row.status}</Badge> },
            { key: 'actions', header: 'Actions', render: row => <Button size="sm" variant="outline" disabled={row.read !== false || mutation.isLoading} onClick={() => mark(row.id)}>Mark as read</Button> },
          ]} /> : <EmptyState icon="bell" title="No notifications found" />}
    {data && !query.isFetching && <Pagination page={page} pageSize={20} total={data.total} pageCount={Math.max(1, data.pages)} onPage={next => setPage(Math.max(1, Math.min(Math.max(1, data.pages), next)))} />}
  </SectionCard>;
}
