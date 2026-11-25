'use client';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';
import { DateRangeFilter, EMPTY_RANGE, inRange } from '../components/DateRangeFilter.jsx';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  TableToolbar,
  SearchField,
  FilterSelect,
  DataTable,
  Pagination,
  Badge,
  Avatar,
  Tag,
  DropdownMenu,
  IconButton,
  Modal,
  TextField,
  Select,
  Skeleton,
  StatsPanel,
} from '../ds.js';
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetUserManagementDirectoryQuery, useGetUserManagementStatsQuery, useRenameManagedUserMutation, useCreateManagedAdminMutation,
  managedUserSummary, managedUsersCsv, managedUserMatchesRole,
} from '../store/features/users/usersApi.js';
import { DriverTableLoading, DriverLoadingNotice } from './DriversLoading.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import styles from './UserManagement.module.css';

import { UserActionDialogs, useManagedUserOperations } from './UserActionDialogs.jsx';
import { AdminUserDrawer } from './AdminUserDrawer.jsx';

const PAGE_SIZE = 8;
const ROLES = ['Super Admin', 'Operations Admin', 'Finance Admin'];
const STATUSES = ['Active', 'Inactive', 'Locked', 'Revoked'];
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
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  const query = useGetUserManagementDirectoryQuery({ owner: admin?.id }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const statsQuery = useGetUserManagementStatsQuery({ owner: admin?.id, ...statsRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const directory = !authenticated || query.error ? null : query.currentData;
  const users = useMemo(() => directory?.rows || [], [directory]);
  const usersSummary = managedUserSummary(directory?.rows, !authenticated || statsQuery.error ? null : statsQuery.currentData, true, statsPeriod(statsPeriodKey).vs);
  const [renameUser, editState] = useRenameManagedUserMutation();
  const [createAdmin, createState] = useCreateManagedAdminMutation();
  const operations = useManagedUserOperations();
  const [drawerId, setDrawerId] = useState(null);
  const drawerUser = drawerId ? users.find((user) => user.id === drawerId) : null;
  const submitting = useRef(false);
  const unavailable = (action) => { setMenuFor(null); window.alert(`${action} is not available here.`); };
  const profilePath = (user) => `/users/detail?id=${encodeURIComponent(user.backendId)}&source=${user.source}`;
  const metric = (value) => !authenticated || statsQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : value ?? '—';
  const [q, setQ] = usePageSearchState('', () => setPage(1));
  const [role, setRole] = useState('All Roles');
  const [status, setStatus] = useState('All Statuses');
  const [joined, setJoined] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState([]);
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const formVersion = useRef(0);

  const filterAvailable = Boolean(directory);

  const filtered = useMemo(() => users.filter((u) => (
    managedUserMatchesRole(u, role) &&
    (status === 'All Statuses' || u.status === status) &&
    inRange(u.joinedAt, joined) &&
    (!q || [u.name, u.email].some((s) => s !== '—' && s && s.toLowerCase().includes(q.toLowerCase())))
  )), [users, role, status, joined, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage((value) => Math.max(1, Math.min(value, pageCount)));
    const ids = new Set(filtered.map((user) => user.id));
    setSelected((values) => values.filter((id) => ids.has(id)));
  }, [filtered, pageCount]);

  function resetFilters() {
    setRole('All Roles'); setStatus('All Statuses'); setJoined(EMPTY_RANGE); setQ(''); setPage(1);
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

  function updateAccess(user, action) {
    setMenuFor(null);
    if (submitting.current) return;
    void operations.open(action, user);
  }

  async function editUser(user) {
    setMenuFor(null);
    if (submitting.current || editState.isLoading) return;
    if (!user.isAccount || admin?.role !== 'SUPER_ADMIN') { unavailable('Edit User'); return; }
    const name = window.prompt('Full Name', user.name === '—' ? '' : user.name);
    if (!name?.trim() || name.trim() === user.name) return;
    submitting.current = true;
    try { const result = await renameUser({ id: user.backendId, source: user.source, name, expectedVersion: user.version, owner: admin?.id }).unwrap(); window.alert(result.message); }
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
    // Admin accounts can't be deleted or suspended — revoking access (lock) is the only off-switch.
    if (u.backendId === admin?.id) items.pop();
    else if (u.statusCode === 'REVOKED') items.push({ label: 'Restore Access', icon: 'lock-open', onClick: () => updateAccess(u, 'unlock') });
    else items.push({ label: 'Revoke Access', icon: 'lock', tone: 'danger', onClick: () => updateAccess(u, 'lock') });
    return items;
  }

  return (
    <>
      <PageHeader crumbs={['Administration', 'User Management']} title="User Management"
        description="Manage the people who sign in to this admin dashboard — their roles, access and account security."
        actions={<>
          <Button variant="outline" icon="upload" onClick={() => operations.open('import')}>Import Admins</Button>
          <Button icon="plus" onClick={() => setAddOpen(true)}>Add Admin User</Button>
        </>} />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
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
      </StatsPanel>

      <div>
        <SectionCard title="" pad="none">
          <TableToolbar viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
            search={<SearchField placeholder="Search by name or email…" value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={<>
              <FilterButton value={role} options={['All Roles', ...ROLES]} active={role !== 'All Roles'}
                onChange={(v) => { setRole(v); setPage(1); }} />
              <FilterButton value={status} options={['All Statuses', ...STATUSES]} active={status !== 'All Statuses'}
                onChange={(v) => { setStatus(v); setPage(1); }} />
              <DateRangeFilter name="Joined" value={joined} onChange={(next) => { setJoined(next); setPage(1); }} />
            </>}
            trailing={<Button variant="outline" icon="download" onClick={exportUsers}>Export</Button>}
            onClear={resetFilters} />

          {!authenticated || query.isFetching ? <DriverTableLoading columns={6} label="Loading users" /> : query.error ? <DriverLoadingNotice>{getApiErrorMessage(query.error)}</DriverLoadingNotice> : <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.users} boardOnRowClick={(row) => setDrawerId(row.id)} onRowClick={(row) => setDrawerId(row.id)} view={tableView} boardGroupBy={(row) => row.status} rows={paged} rowKey={(r) => r.id} selectable selected={selected} onSelect={setSelected}
            columns={[
              { key: 'user', header: 'User', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 }}>
                  <Avatar name={r.name} src={r.profileImageUrl} size={36} />
                  <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                      {r.source === 'admin' && r.backendId === admin?.id && <Tag tone="blue">You</Tag>}
                    </span>
                    <span className="tk-meta" style={{ overflowWrap: 'anywhere' }}>{r.email}</span>
                  </span>
                </span>) },
              { key: 'role', header: 'Role', render: (r) => <Badge tone={r.roleTone}>{r.role}</Badge> },
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

      </div>

      {drawerUser && (
        <AdminUserDrawer
          key={drawerUser.id}
          user={drawerUser}
          owner={admin?.id}
          isSelf={drawerUser.backendId === admin?.id}
          onClose={() => setDrawerId(null)}
          onOpen={() => navigate(profilePath(drawerUser))}
          onEdit={editUser}
          onResetPassword={(u) => operations.open('password-reset', u)}
          onAccess={updateAccess}
        />
      )}

      <UserActionDialogs operations={operations} />
      <Modal open={addOpen} onClose={resetForm} title="Add Admin User" description="Give someone access to this dashboard and assign their admin role."
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
