'use client';

import { SectionCard, LabelValue, DataTable, Tag, ProgressBar } from '../ds.js';
import { useGetManagedUserSectionsQuery } from '../store/features/users/usersApi.js';
import { DriverTableLoading, DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
const SECTION = {
  'Roles & Permissions': 'permissions',
  Sessions: 'sessions',
  Documents: 'documents',
  Notifications: 'notification-preferences'
};
const bool = v => v == null ? '—' : v ? 'Enabled' : 'Disabled';
export function ManagedUserSection({
  tab,
  user,
  owner
}) {
  const section = SECTION[tab];
  const query = useGetManagedUserSectionsQuery({
    id: user.backendId,
    source: user.source,
    section,
    owner
  }, {
    skip: !section || !user.isAccount,
    refetchOnMountOrArgChange: true
  });
  if (tab === 'Security') return <SectionCard title="Security Overview">
    <LabelValue label="Two-Factor Authentication" value={<Tag tone={user.twoFactor ? 'success' : 'neutral'}>{bool(user.twoFactor)}</Tag>} />
    <div style={{
      padding: '9px 0'
    }}><ProgressBar value={user.passwordStrengthPct} color="var(--tk-viz-track)" label="Password Strength" caption={user.passwordStrength} /></div>
    <LabelValue label="Password Expires" value={user.passwordExpires} />
    <LabelValue label="Password Last Changed" value={user.passwordLastChanged} />
    <LabelValue label="Login Notifications" value={<Tag tone={user.loginNotifications ? 'success' : 'neutral'}>{bool(user.loginNotifications)}</Tag>} />
    <LabelValue label="Locked Until" value={user.lockedUntil} /><LabelValue label="Locked By" value={user.lockedBy} /><LabelValue label="Total Logins" value={user.totalLogins ?? '—'} />
    <LabelValue label="Failed Login Attempts" value={user.failedLogins ?? '—'} />
    <LabelValue label="Active Sessions" value={user.activeSessions ?? '—'} />
  </SectionCard>;
  if (!user.isAccount) return <SectionCard title={tab}>—</SectionCard>;
  if (query.isLoading || query.isFetching) return <SectionCard title={tab}><DriverTableLoading columns={section === 'sessions' ? 5 : section === 'documents' ? 5 : 2} label="Loading user details" /></SectionCard>;
  if (query.error) return <SectionCard title={tab}><DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice></SectionCard>;
  const data = query.currentData;
  if (section === 'notification-preferences') return <SectionCard title={tab}>{data?.values?.map(r => <LabelValue key={r.label} label={r.label} value={r.value} />) || '—'}</SectionCard>;
  if (section === 'permissions') return <SectionCard title={tab}>
    <LabelValue label="Primary Role" value={user.role} />
    {data?.values?.map(r => <LabelValue key={r.label} label={r.label} value={r.value} />)}
    {data?.rows ? <DataTable rows={data.rows} rowKey={r => r.id} columns={[{
      key: 'permission',
      header: 'Permission'
    }]} /> : '—'}
  </SectionCard>;
  const columns = section === 'sessions' ? [{
    key: 'device',
    header: 'Device'
  }, {
    key: 'ip',
    header: 'IP Address'
  }, {
    key: 'status',
    header: 'Status'
  }, {
    key: 'lastActive',
    header: 'Last Active'
  }, {
    key: 'expires',
    header: 'Expires'
  }, {
    key: 'reason',
    header: 'Revoked Reason'
  }] : [{
    key: 'name',
    header: 'Document'
  }, {
    key: 'status',
    header: 'Status'
  }, {
    key: 'uploaded',
    header: 'Uploaded'
  }, {
    key: 'expires',
    header: 'Expires'
  }, {
    key: 'file',
    header: 'File',
    render: r => r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">View</a> : '—'
  }];
  return <SectionCard title={tab} pad="none">{data?.rows ? <DataTable rows={data.rows} rowKey={r => r.id} columns={columns} /> : '—'}</SectionCard>;
}
