'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, Avatar, Tag, DropdownMenu, IconButton, Modal, TextField, Select,
  DonutChart, LegendList, StatusDot,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  usersSummary, usersByRole, usersByStatus, recentUserActivity,
} from '../mock/fixtures/users.js';
import { addUser, deactivateUser, activateUser, lockUserAccount, unlockUserAccount, deleteUser } from '../mock/api.js';

const PAGE_SIZE = 8;
const ROLES = ['Super Admin', 'Admin', 'Operations Manager', 'Dispatcher', 'Verifier', 'Finance Manager', 'Viewer', 'Driver'];
const STATUSES = ['Active', 'Inactive', 'Locked'];
const EMPTY_FORM = { name: '', email: '', role: '', entity: '' };

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
  const users = useCollection('users') || [];
  const [q, setQ] = useState('');
  const [role, setRole] = useState('All Roles');
  const [status, setStatus] = useState('All Statuses');
  const [entity, setEntity] = useState('All Entities');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [menuFor, setMenuFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const entities = useMemo(() => Array.from(new Set(users.map((u) => u.entity))).sort(), [users]);

  const filtered = useMemo(() => users.filter((u) => (
    (role === 'All Roles' || u.role === role) &&
    (status === 'All Statuses' || u.status === status) &&
    (entity === 'All Entities' || u.entity === entity) &&
    (!q || [u.name, u.email, u.entity].some((s) => s && s.toLowerCase().includes(q.toLowerCase())))
  )), [users, role, status, entity, q]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setRole('All Roles'); setStatus('All Statuses'); setEntity('All Entities'); setQ(''); setPage(1);
  }

  function resetForm() { setAddOpen(false); setForm(EMPTY_FORM); setSaving(false); }

  async function handleSave() {
    setSaving(true);
    await addUser(form);
    resetForm();
  }

  function rowMenuItems(u) {
    const items = [
      { label: 'View Profile', icon: 'eye', onClick: () => { setMenuFor(null); navigate('/users/' + u.id); } },
      { label: 'Edit User', icon: 'pencil', onClick: () => setMenuFor(null) },
      { label: 'Reset Password', icon: 'rotate-ccw', onClick: () => setMenuFor(null) },
      { divider: true },
    ];
    if (u.status === 'Locked') items.push({ label: 'Unlock Account', icon: 'lock-open', onClick: () => { unlockUserAccount(u.id); setMenuFor(null); } });
    else items.push({ label: 'Lock Account', icon: 'lock', onClick: () => { lockUserAccount(u.id); setMenuFor(null); } });
    if (u.status === 'Inactive') items.push({ label: 'Activate User', icon: 'user-check', onClick: () => { activateUser(u.id); setMenuFor(null); } });
    else items.push({ label: 'Deactivate User', icon: 'user-x', onClick: () => { deactivateUser(u.id); setMenuFor(null); } });
    items.push({ divider: true });
    items.push({ label: 'Delete User', icon: 'trash-2', tone: 'danger', onClick: () => { deleteUser(u.id); setMenuFor(null); } });
    return items;
  }

  return (
    <>
      <PageHeader crumbs={['Administration', 'User Management']} title="User Management"
        description="Manage users, view their roles, permissions and account status."
        actions={<>
          <Button variant="outline" icon="upload">Import Users</Button>
          <Button variant="outline" icon="download">Export Users</Button>
          <Button icon="plus" onClick={() => setAddOpen(true)}>Add New User</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users-round" tint="amber" label="Total Users" value={usersSummary.total}
          delta={usersSummary.totalCaption} direction={usersSummary.totalDirection} />
        <StatCard icon="shield-check" tint="green" label="Active Users" value={usersSummary.active}
          delta={usersSummary.activeCaption} direction={usersSummary.activeDirection} />
        <StatCard icon="user-round-x" tint="purple" label="Inactive Users" value={usersSummary.inactive}
          delta={usersSummary.inactiveCaption} direction={usersSummary.inactiveDirection} />
        <StatCard icon="lock" tint="red" label="Locked Users" value={usersSummary.locked}
          delta={usersSummary.lockedCaption} direction={usersSummary.lockedDirection} />
        <StatCard icon="user-round-plus" tint="blue" label="New This Month" value={usersSummary.newThisMonth}
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
              <Button variant="outline" icon="list-filter">More Filters</Button>
            </>}
            onClear={resetFilters} />

          <DataTable rows={paged} rowKey={(r) => r.id} selectable selected={selected} onSelect={setSelected}
            columns={[
              { key: 'user', header: 'User', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onClick={() => navigate('/users/' + r.id)}>
                  <Avatar name={r.name} size={36} />
                  <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                      {r.you && <Tag tone="blue">You</Tag>}
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
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
            pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
            onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Users by Role">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={168} thickness={22} centerValue={usersSummary.total} centerLabel="Total"
                data={usersByRole} />
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
          <SectionCard title="Recent User Activity" action={<a href="#">View All</a>}>
            <div style={{ display: 'grid', gap: 16 }}>
              {recentUserActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <Avatar name={a.name} size={32} />
                  <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{a.name}</span>
                    <span className="tk-meta">{a.action}</span>
                    <span className="tk-meta">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <Modal open={addOpen} onClose={resetForm} title="Add New User" description="Create a new admin user and assign a role."
        footer={<>
          <Button variant="outline" onClick={resetForm}>Cancel</Button>
          <Button disabled={saving || !form.name || !form.email || !form.role}
            onClick={handleSave}>{saving ? 'Adding…' : 'Add User'}</Button>
        </>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Full Name" required placeholder="e.g. James Daniel" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Email Address" required type="email" placeholder="name@company.com" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Role" required options={ROLES} value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
          <TextField label="Entity / Company" placeholder="e.g. Oceanic Logistics" value={form.entity}
            onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}
