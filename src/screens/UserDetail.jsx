'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../router.js';
import {
  PageHeader, Button, Card, SectionCard, Badge, Tag, Tabs, LabelValue, DataTable, DropdownMenu,
  Avatar, Icon, ProgressBar, StatusDot,
} from '../ds.js';
import { useGetManagedUserProfileQuery, useGetManagedUserActivityQuery, canReadManagedUserActivity, useUpdateManagedAdminMutation } from '../store/features/users/usersApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { DriverDetailLoading, DriverTableLoading } from './DriversLoading.jsx';

import { UserActionDialogs, useManagedUserOperations } from './UserActionDialogs.jsx';
import { ManagedUserSection } from './UserProfileSections.jsx';

const CONTACT_ROWS = [
  { key: 'email', icon: 'mail' },
  { key: 'phone', icon: 'phone' },
  { key: 'entity', icon: 'building-2' },
  { key: 'location', icon: 'map-pin' },
];

function IconLine({ icon, children }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={15} color="var(--tk-ink-300)" />
      <span style={{ font: '400 13px/20px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{children}</span>
    </span>
  );
}

export function UserDetail() {
  const { userId } = useParams();
  const search = useSearchParams();
  const id = search.get('id') || userId;
  const source = search.get('source') || 'user';
  const admin = useSelector((state) => state.auth.admin);
  const role = admin?.role;
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const navigate = useNavigate();
  const permitted = source !== 'admin' || role === 'SUPER_ADMIN';
  const query = useGetManagedUserProfileQuery({ id, source, owner: admin?.id }, { skip: !authenticated || !id || !permitted, refetchOnMountOrArgChange: true });
  const u = authenticated && permitted && !query.error ? query.currentData : null;
  const [editAdmin, editState] = useUpdateManagedAdminMutation();
  const submitting = useRef(false);
  const operations = useManagedUserOperations();
  const [tab, setTab] = useState('Overview');
  const [menu, setMenu] = useState(false);
  const activityAvailable = authenticated && permitted && canReadManagedUserActivity(u, role);
  const activityQuery = useGetManagedUserActivityQuery({ id, source, owner: admin?.id, roleCode: u?.roleCode, truckerType: u?.truckerType, all: tab === 'Activity Log' }, { skip: !activityAvailable, refetchOnMountOrArgChange: true });
  const activityLoading = activityAvailable && (activityQuery.isLoading || (activityQuery.isFetching && !activityQuery.currentData));
  useEffect(() => { if (activityAvailable && activityQuery.error) window.alert(getApiErrorMessage(activityQuery.error)); }, [activityAvailable, activityQuery.error]);
  const unavailable = (action) => { setMenu(false); window.alert(`${action} is not available for this user through this control in the documented API.`); };
  useEffect(() => { setTab('Overview'); setMenu(false); operations.close(); }, [id, source]);

  function updateAccess(operation) {
    setMenu(false);
    if (submitting.current) return;
    void operations.open(operation === 'suspend' ? 'deactivate' : 'activate', u);
  }

  async function editUser(transferRole = false) {
    setMenu(false);
    if (submitting.current || editState.isLoading) return;
    if (transferRole) { operations.open('permissions', u); return; }
    if (u?.source !== 'admin' || role !== 'SUPER_ADMIN') { unavailable('Edit User'); return; }
    const value = window.prompt('Full Name', u.name === '—' ? '' : u.name);
    if (!value?.trim()) return;
    const body = { name: value.trim() };
    if (body.name === u.name) return;
    submitting.current = true;
    try { const result = await editAdmin({ id: u.backendId, ...body }).unwrap(); window.alert(result.message); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { submitting.current = false; }
  }

  const changeStatus = () => updateAccess(u?.statusCode === 'ACTIVE' ? 'suspend' : 'activate');
  const viewActivity = () => { setMenu(false); setTab('Activity Log'); if (!activityAvailable) unavailable('View Activity Log'); else if (tab === 'Activity Log' && activityQuery.error) activityQuery.refetch(); };
  const booleanLabel = (value) => value == null ? '—' : value ? 'Enabled' : 'Disabled';
  const amountLabel = (value, unit) => value == null ? '—' : `${value} ${unit}`;

  if (!authenticated || (permitted && (query.isLoading || (query.isFetching && !query.currentData)))) return <DriverDetailLoading />;

  if (!u) {
    return (
      <Card>
        <span className="tk-body">{!permitted ? 'Only Super Admins can view admin accounts.' : query.error ? getApiErrorMessage(query.error) : `No user found with ID ${id || '—'}.`}</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/users')}>Back to Users</Button>
        </div>
      </Card>
    );
  }

  const activity = activityAvailable && !activityQuery.error ? activityQuery.currentData || [] : [];

  return (
    <>
      <PageHeader crumbs={['Administration', 'User Management', 'View User']} title="User Profile"
        description="View detailed information about this user."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/users')}>Back to Users</Button>
          <Button variant="outline" icon="pencil" onClick={() => editUser()}>Edit User</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="secondary" iconRight="ellipsis-vertical" onClick={() => setMenu((m) => !m)}>More Actions</Button>
            {menu && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
                <DropdownMenu width={260} items={[
                  { label: 'Reset Password', icon: 'rotate-ccw', onClick: () => { setMenu(false); operations.open('password-reset', u); } },
                  { label: 'Force Logout', icon: 'log-out', onClick: () => { setMenu(false); operations.open('force-logout', u); } },
                  { label: 'Impersonate User', icon: 'user-round-cog', onClick: () => unavailable('Impersonate User') },
                  { divider: true },
                  { label: u.status === 'Active' ? 'Deactivate User' : 'Activate User', icon: 'user-x',
                    onClick: changeStatus },
                  { label: 'Lock User Account', icon: 'lock', onClick: () => { setMenu(false); operations.open('lock', u); } },
                  { label: 'Update Permissions', icon: 'shield', onClick: () => { setMenu(false); operations.open('permissions', u); } },
                  { label: 'Transfer Role', icon: 'repeat', onClick: () => editUser(true) },
                  { divider: true },
                  { label: 'View Activity Log', icon: 'history', onClick: viewActivity },
                  { label: 'Download User Report', icon: 'file-down', onClick: () => { setMenu(false); operations.download('report', u); } },
                  { label: 'Send Email', icon: 'mail', onClick: () => { setMenu(false); operations.open('EMAIL', u); } },
                  { label: 'Send SMS', icon: 'message-square', onClick: () => { setMenu(false); operations.open('SMS', u); } },
                  { label: 'Export User Data', icon: 'download', onClick: () => { setMenu(false); operations.download('export', u); } },
                  { divider: true },
                  { label: 'Delete User', icon: 'trash-2', tone: 'danger', onClick: () => { setMenu(false); operations.open('delete', u); } },
                ]} />
              </span>
            )}
          </span>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <Card style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
              <Avatar name={u.name} size={72} />
              <StatusDot tone={u.online ? 'success' : 'neutral'} label={u.online == null ? '—' : u.online ? 'Online' : 'Offline'} />
            </div>
            <div style={{ flex: '1 1 220px', display: 'grid', gap: 8, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="tk-title" style={{ fontSize: 22 }}>{u.name}</h2>
                <Badge dot>{u.status}</Badge>
              </div>
              <div><Badge tone={u.roleTone}>{u.role}</Badge></div>
              <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                {CONTACT_ROWS.map((r) => <IconLine key={r.key} icon={r.icon}>{u[r.key]}</IconLine>)}
              </div>
            </div>
            <div style={{ flex: '1 1 260px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px',
                         borderLeft: '1px solid var(--tk-line)', paddingLeft: 20, minWidth: 240, alignContent: 'start' }}>
              <LabelValue layout="stack" label="User ID" value={u.backendId} />
              <LabelValue layout="stack" label="Last Active" value={u.lastActive} />
              <LabelValue layout="stack" label="Joined On" value={u.joinedOn} style={{ marginTop: 12 }} />
              <LabelValue layout="stack" label="Password Last Changed" value={u.passwordLastChanged} style={{ marginTop: 12 }} />
            </div>
          </div>
        </Card>

        <SectionCard title="Role & Permissions">
          <LabelValue label="Primary Role" value={<Badge tone={u.roleTone}>{u.role}</Badge>} />
          <LabelValue label="Permissions" value={u.permissionsCaption} />
          <Button variant="outline" icon="shield" fullWidth style={{ marginTop: 10 }}
            onClick={() => navigate('/roles')}>View Role &amp; Permissions</Button>
        </SectionCard>
      </div>

      <Card pad="none">
        <Tabs value={tab} onChange={(value) => { setTab(value); }} style={{ padding: '0 var(--tk-card-pad)' }}
          items={['Overview', 'Roles & Permissions', 'Activity Log', 'Sessions', 'Documents', 'Security', 'Notifications']} />
      </Card>

      {tab === 'Overview' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--tk-grid-gap)' }}>
        <SectionCard title="About This User">
          <LabelValue label="Full Name" value={u.name} />
          <LabelValue label="Email Address" value={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{u.email}{u.emailVerified && <Badge tone="success">Verified</Badge>}</span>} />
          <LabelValue label="Phone Number" value={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{u.phone}{u.phoneVerified && <Badge tone="success">Verified</Badge>}</span>} />
          <LabelValue label="Company / Entity" value={u.entity} />
          <LabelValue label="Department" value={u.department} />
          <LabelValue label="Location" value={u.location} />
          <LabelValue label="Status" value={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge dot>{u.status}</Badge>
            <Button variant="danger" size="sm"
              onClick={changeStatus}>
              {u.status === 'Active' ? 'Deactivate User' : 'Activate User'}
            </Button>
          </span>} />
        </SectionCard>

        <SectionCard title="Account Summary">
          <LabelValue label="Total Logins" value={amountLabel(u.totalLogins, 'times')} />
          <LabelValue label="Failed Login Attempts" value={amountLabel(u.failedLogins, 'times')} />
          <LabelValue label="Active Sessions" value={amountLabel(u.activeSessions, `session${u.activeSessions === 1 ? '' : 's'}`)} />
          <LabelValue label="Last Login" value={<span style={{ display: 'grid', gap: 2, textAlign: 'right' }}>
            <span>{u.lastLogin}</span><span className="tk-meta">{u.lastLoginDetail}</span>
          </span>} />
          <LabelValue label="Account Created" value={u.accountCreated} />
          <LabelValue label="Email Notifications" value={<Badge dot tone={u.emailNotifications ? 'success' : 'neutral'}>{booleanLabel(u.emailNotifications)}</Badge>} />
        </SectionCard>

        <SectionCard title="Security Overview">
          <LabelValue label="Two-Factor Authentication" value={<Tag tone={u.twoFactor ? 'success' : 'neutral'}>{booleanLabel(u.twoFactor)}</Tag>} />
          <div style={{ padding: '9px 0' }}>
            <ProgressBar value={u.passwordStrengthPct}
              color={u.passwordStrengthPct == null ? 'var(--tk-viz-track)' : u.passwordStrengthPct >= 75 ? 'var(--tk-success)' : u.passwordStrengthPct >= 45 ? 'var(--tk-warning)' : 'var(--tk-danger)'}
              label="Password Strength" caption={u.passwordStrength} />
          </div>
          <LabelValue label="Password Expires" value={u.passwordExpires} />
          <LabelValue label="Login Notifications" value={<Tag tone={u.loginNotifications ? 'success' : 'neutral'}>{booleanLabel(u.loginNotifications)}</Tag>} />
        </SectionCard>
      </div>

      }
      {!['Overview', 'Activity Log'].includes(tab) && <ManagedUserSection tab={tab} user={u} owner={admin?.id} />}
      {(tab === 'Overview' || tab === 'Activity Log') && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Recent Activity" pad="none" footer={<a href="#" onClick={(event) => { event.preventDefault(); viewActivity(); }}>View All Activity →</a>}>
          {activityLoading ? <DriverTableLoading columns={5} label="Loading user activity" /> : <DataTable rows={activity} rowKey={(r, i) => i}
            columns={[
              { key: 'text', header: 'Activity', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={r.icon} size={14} color={r.tone} />
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.text}</span>
                </span>) },
              { key: 'description', header: 'Description' },
              { key: 'ip', header: 'IP Address', render: (r) => <span className="tk-mono">{r.ip}</span> },
              { key: 'location', header: 'Location' },
              { key: 'time', header: 'Date & Time' },
            ]} />}
          {activityAvailable && !activityQuery.error && activityQuery.currentData ? null : '—'}
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div style={{ display: 'grid', gap: 4 }}>
            {[
              { icon: 'rotate-ccw', label: 'Reset Password', hint: 'Send password reset instructions', onClick: () => { setMenu(false); operations.open('password-reset', u); } },
              { icon: 'log-out', label: 'Force Logout', hint: 'Sign out user from all active sessions' },
              { icon: 'shield', label: 'Update Permissions', hint: 'Modify user roles and permissions' },
              { icon: 'history', label: 'View Activity Log', hint: 'See all user actions and events' },
              { icon: 'user-x', label: 'Deactivate User', hint: 'Temporarily disable user access',
                onClick: () => updateAccess('suspend'), danger: true },
            ].map((a) => (
              <button key={a.label} type="button" onClick={a.onClick || (a.label === 'View Activity Log' ? viewActivity : a.label === 'Force Logout' ? () => operations.open('force-logout', u) : a.label === 'Update Permissions' ? () => operations.open('permissions', u) : () => unavailable(a.label))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 8px', border: 0,
                         background: 'transparent', cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--tk-r-sm)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--tk-surface-sunk)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <Icon name={a.icon} size={16} color={a.danger ? 'var(--tk-danger)' : 'var(--tk-blue)'} style={{ marginTop: 2 }} />
                <span style={{ display: 'grid', gap: 1 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: a.danger ? 'var(--tk-danger)' : 'var(--tk-ink-900)' }}>{a.label}</span>
                  <span className="tk-meta">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>}
      <UserActionDialogs operations={operations} onDeleted={() => navigate('/users')} />
    </>
  );
}
