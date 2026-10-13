'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, Avatar, Tag, DropdownMenu, IconButton, Modal, TextField, Select,
  DonutChart, LegendList, StatusDot, Skeleton, ActivityFeed,
} from '../ds.js';
import {
  useGetUserManagementDirectoryQuery, useGetUserManagementStatsQuery, useChangeManagedUserAccessMutation, useUpdateManagedAdminMutation, useCreateManagedAdminMutation,
  managedUserSummary, managedUserRoleChart, managedUserStatusChart, managedUsersCsv, managedUserMatchesRole, useGetUserManagementRecentActivityQuery,
} from '../store/features/users/usersApi.js';
import { DriverTableLoading, DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

import { UserActionDialogs, useManagedUserOperations } from './UserActionDialogs.jsx';

const PAGE_SIZE = 8;
const ROLES = ['Super Admin', 'Admin', 'Operations Manager', 'Dispatcher', 'Verifier', 'Finance Manager', 'Viewer', 'Driver'];
const STATUSES = ['Active', 'Inactive', 'Locked'];
const EMPTY_FORM = { name: '', email: '', role: '', password: '' };
const ADMIN_ROLE_OPTIONS = ['Super Admin', 'Operations Admin', 'Finance Admin'];
const ADMIN_ROLE_CODES = { 'Super Admin': 'SUPER_ADMIN', 'Operations Admin': 'OPS_ADMIN', 'Finance Admin': 'FINANCE_ADMIN' };

function FilterButton({ value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <FilterSelect label={value} active={active} onClick={() => setOpen((o) => !o)} />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setOpen(false)}>
          <DropdownMenu width={220} items={options.map((o) => ({
            label: o, icon: o === value ? 'check' : undefined,
            onClick: () => { onChange(o); setOpen(false); },
          }))} />
        </span>
      )}
    </span>
  );
}

export function UserManagement() {
  const navigate = useNavigate();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const includeAdmins = admin?.role === 'SUPER_ADMIN';
  const query = useGetUserManagementDirectoryQuery({ includeAdmins, owner: admin?.id }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const statsQuery = useGetUserManagementStatsQuery({ owner: admin?.id, includeAdmins }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const directory = !authenticated || query.error ? null : query.currentData;
  const users = useMemo(() => directory?.rows || [], [directory]);
  const usersSummary = managedUserSummary(directory?.rows, !authenticated || statsQuery.error ? null : statsQuery.currentData, includeAdmins);
  const usersByRole = managedUserRoleChart(directory?.rows, directory?.adminsIncluded, statsQuery.error ? null : statsQuery.currentData);
  const usersByStatus = managedUserStatusChart(directory?.rows, usersSummary, statsQuery.error ? null : statsQuery.currentData);
  const [changeAccess, accessState] = useChangeManagedUserAccessMutation();
  const [editAdmin, editState] = useUpdateManagedAdminMutation();
  const [createAdmin, createState] = useCreateManagedAdminMutation();
  const operations = useManagedUserOperations();
  const [activityOpen, setActivityOpen] = useState(false);
  const recentQuery = useGetUserManagementRecentActivityQuery({ owner: admin?.id, all: activityOpen }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const submitting = useRef(false);
  const unavailable = (action) => { setMenuFor(null); window.alert(`${action} is not supported through this control by the documented API.`); };
  const profilePath = (user) => `/users/detail?id=${encodeURIComponent(user.backendId)}&source=${user.source}`;
  const metric = (value) => !authenticated || statsQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : value ?? '—';
  const [q, setQ] = useState('');
  const [role, setRole] = useState('All Roles');
  const [status, setStatus] = useState('All Statuses');
  const [entity, setEntity] = useState('All Entities');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState([]);
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const formVersion = useRef(0);

  const entities = useMemo(() => Array.from(new Set(users.map((u) => u.entity).filter((value) => value !== '—'))).sort(), [users]);
  const filterAvailable = Boolean(directory);

  const filtered = useMemo(() => users.filter((u) => (
    managedUserMatchesRole(u, role) &&
    (status === 'All Statuses' || u.status === status) &&
    (entity === 'All Entities' || u.entity === entity) &&
    (!q || [u.name, u.email, u.phone, u.entity].some((s) => s !== '—' && s && s.toLowerCase().includes(q.toLowerCase())))
  )), [users, role, status, entity, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage((value) => Math.max(1, Math.min(value, pageCount)));
    const ids = new Set(filtered.map((user) => user.id));
    setSelected((values) => values.filter((id) => ids.has(id)));
  }, [filtered, pageCount]);

  function resetFilters() {
    setRole('All Roles'); setStatus('All Statuses'); setEntity('All Entities'); setQ(''); setPage(1);
  }

  function resetForm() { formVersion.current += 1; setAddOpen(false); setForm(EMPTY_FORM); setSaving(false); }

  async function handleSave() {
    if (submitting.current || saving || createState.isLoading) return;
    if (admin?.role !== 'SUPER_ADMIN') { unavailable('Creating an admin'); return; }
    const version = formVersion.current;
    submitting.current = true; setSaving(true);
    try {
      const result = await createAdmin({ name: form.name, email: form.email, role: ADMIN_ROLE_CODES[form.role], password: form.password }).unwrap();
      if (formVersion.current === version) resetForm(); window.alert(result.message);
    } catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { submitting.current = false; setSaving(false); }
  }

  async function updateAccess(user) {
    setMenuFor(null);
    if (submitting.current || accessState.isLoading) return;
    if (user.source === 'admin') { operations.open(user.statusCode === 'REVOKED' ? 'unlock' : 'lock', user); return; }
    if (user.statusCode === 'LOCKED') { operations.open('unlock', user); return; }
    const supported = user.isAccount && ['ACTIVE', 'SUSPENDED'].includes(user.statusCode);
    if (!supported) { unavailable('Changing access'); return; }
    const operation = user.statusCode === 'SUSPENDED' ? 'activate' : 'suspend';
    const reason = operation === 'suspend' ? window.prompt('Reason for suspending this user:') : null;
    if (operation === 'suspend' && !reason?.trim()) return;
    submitting.current = true;
    try { const result = await changeAccess({ id: user.backendId, source: user.source, operation, reason }).unwrap(); window.alert(result.message); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { submitting.current = false; }
  }

  async function editUser(user) {
    setMenuFor(null);
    if (submitting.current || editState.isLoading) return;
    if (user.source !== 'admin' || admin?.role !== 'SUPER_ADMIN') { unavailable('Edit User'); return; }
    const name = window.prompt('Full Name', user.name === '—' ? '' : user.name);
    if (!name?.trim() || name.trim() === user.name) return;
    submitting.current = true;
    try { const result = await editAdmin({ id: user.backendId, name }).unwrap(); window.alert(result.message); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { submitting.current = false; }
  }

  function exportUsers() {
    if (!directory || query.isFetching) { window.alert('Load the complete user directory before exporting.'); return; }
    const rows = selected.length ? filtered.filter((user) => selected.includes(user.id)) : filtered;
    if (!rows.length) { window.alert('There are no users to export.'); return; }
    const url = URL.createObjectURL(new Blob([managedUsersCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'users.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function rowMenuItems(u) {
    const items = [
      { label: 'View Profile', icon: 'eye', onClick: () => { setMenuFor(null); navigate(profilePath(u)); } },
      { label: 'Edit User', icon: 'pencil', onClick: () => editUser(u) },
      { label: 'Reset Password', icon: 'rotate-ccw', onClick: () => { setMenuFor(null); operations.open('password-reset', u); } },
      { divider: true },
    ];
    if (u.status === 'Locked' || u.statusCode === 'REVOKED') items.push({ label: 'Unlock Account', icon: 'lock-open', onClick: () => { setMenuFor(null); operations.open('unlock', u); } });
    else items.push({ label: 'Lock Account', icon: 'lock', onClick: () => { setMenuFor(null); operations.open('lock', u); } });
    if (['Inactive', 'Suspended', 'Revoked'].includes(u.status)) items.push({ label: 'Activate User', icon: 'user-check', onClick: () => updateAccess(u) });
    else items.push({ label: 'Deactivate User', icon: 'user-x', onClick: () => updateAccess(u) });
    items.push({ divider: true });
    items.push({ label: 'Delete User', icon: 'trash-2', tone: 'danger', onClick: () => { setMenuFor(null); operations.open('delete', u); } });
    return items;
  }

  return (
    <>
      <PageHeader crumbs={['Administration', 'User Management']} title="User Management"
        description="Manage users, view their roles, permissions and account status."
        actions={<>
          <Button variant="outline" icon="upload" onClick={() => operations.open('import')}>Import Users</Button>
          <Button variant="outline" icon="download" onClick={exportUsers}>Export Users</Button>
          <Button icon="plus" onClick={() => setAddOpen(true)}>Add New User</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users-round" tint="amber" label="Total Users" value={metric(usersSummary.total)}
          delta={usersSummary.totalCaption} direction={usersSummary.totalDirection} />
        <StatCard icon="shield-check" tint="green" label="Active Users" value={metric(usersSummary.active)}
          delta={usersSummary.activeCaption} direction={usersSummary.activeDirection} />
        <StatCard icon="user-round-x" tint="purple" label="Inactive Users" value={metric(usersSummary.inactive)}
          delta={usersSummary.inactiveCaption} direction={usersSummary.inactiveDirection} />
        <StatCard icon="lock" tint="red" label="Locked Users" value={metric(usersSummary.locked)}
          delta={usersSummary.lockedCaption} direction={usersSummary.lockedDirection} />
        <StatCard icon="user-round-plus" tint="blue" label="New This Month" value={metric(usersSummary.newThisMonth)}
          delta={usersSummary.newThisMonthCaption} direction={usersSummary.newThisMonthDirection} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="" pad="none">
          <TableToolbar
            search={<SearchField placeholder="Search by name, email or phone…" value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={<>
              <FilterButton value={role} options={['All Roles', ...ROLES]} active={role !== 'All Roles'}
                onChange={(v) => { setRole(v); setPage(1); }} />
              <FilterButton value={status} options={['All Statuses', ...STATUSES]} active={status !== 'All Statuses'}
                onChange={(v) => { setStatus(v); setPage(1); }} />
              <FilterButton value={entity} options={['All Entities', ...entities]} active={entity !== 'All Entities'}
                onChange={(v) => { setEntity(v); setPage(1); }} />
              <Button variant="outline" icon="list-filter" onClick={() => unavailable('More Filters')}>More Filters</Button>
            </>}
            onClear={resetFilters} />

          {!authenticated || query.isFetching ? <DriverTableLoading columns={7} label="Loading users" /> : query.error ? <DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice> : <DataTable rows={paged} rowKey={(r) => r.id} selectable selected={selected} onSelect={setSelected}
            columns={[
              { key: 'user', header: 'User', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onClick={() => navigate(profilePath(r))}>
                  <Avatar name={r.name} size={36} />
                  <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                      {r.source === 'admin' && r.backendId === admin?.id && <Tag tone="blue">You</Tag>}
                    </span>
                    <span className="tk-meta">{r.email}</span>
                  </span>
                </span>) },
              { key: 'role', header: 'Role', render: (r) => <Badge tone={r.roleTone}>{r.role}</Badge> },
              { key: 'entity', header: 'Entity / Company' },
              { key: 'status', header: 'Status', render: (r) => <Badge dot>{r.status}</Badge> },
              { key: 'lastActive', header: 'Last Active' },
              { key: 'joinedOn', header: 'Joined On' },
              { key: 'actions', header: 'Actions', width: 60, render: (r) => (
                <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
                      <DropdownMenu width={210} items={rowMenuItems(r)} />
                    </span>
                  )}
                </span>) },
            ]} />}
          {!query.isFetching && !query.error && !filterAvailable && '—'}
          <Pagination page={page} pageSize={pageSize} total={directory && filterAvailable ? filtered.length : undefined}
            pageCount={pageCount}
            onPage={(value) => setPage(Math.max(1, Math.min(value, pageCount)))} onPageSize={(value) => { setPageSize(value); setPage(1); }} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Users by Role">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={168} thickness={22} centerValue={query.isFetching ? '—' : usersSummary.total ?? '—'} centerLabel="Total"
                data={directory && users.every((user) => usersByRole.some((item) => item.value != null && item.label === user.role)) ? usersByRole.filter((item) => item.value != null) : []} />
              <LegendList style={{ width: '100%' }} items={usersByRole} showShare={false} />
            </div>
          </SectionCard>
          <SectionCard title="Users by Status">
            <div style={{ display: 'grid', gap: 12 }}>
              {usersByStatus.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot tone={{ Active: 'success', Inactive: 'neutral', Locked: 'danger', 'Pending Invitation': 'warning' }[s.label]} />
                  <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{s.label}</span>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{s.value}</span>
                  <span className="tk-meta" style={{ width: 46, textAlign: 'right' }}>({s.share})</span>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Recent User Activity" action={<a href="#" onClick={(event) => { event.preventDefault(); if (activityOpen) recentQuery.refetch(); else setActivityOpen(true); }}>View All</a>}>
            <div style={{ display: 'grid', gap: 16 }}>
              {recentQuery.isFetching ? <DriverTableLoading columns={1} label="Loading user activity" /> : recentQuery.error ? <DriverLoadingNotice>{getApiErrorMessage(recentQuery.error)}</DriverLoadingNotice> : recentQuery.currentData ? <ActivityFeed items={recentQuery.currentData} /> : '—'}
            </div>
          </SectionCard>
        </div>
      </div>

      <UserActionDialogs operations={operations} />
      <Modal open={addOpen} onClose={resetForm} title="Add New User" description="Create a new admin user and assign a role."
        footer={<>
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button disabled={saving || createState.isLoading || !form.name.trim() || !form.email.trim() || !form.role || Array.from(form.password || '').length < 8}
            onClick={handleSave}>{saving ? 'Adding…' : 'Add User'}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Full Name" required placeholder="e.g. James Daniel" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Email Address" required type="email" placeholder="name@company.com" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Role" required options={ADMIN_ROLE_OPTIONS} value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
          <TextField label="Password" required type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}
