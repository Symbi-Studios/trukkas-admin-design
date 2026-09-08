'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, Card, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, Tag, DropdownMenu, IconButton, Icon, Tabs, LabelValue,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { rolesSummary } from '../mock/fixtures/roles.js';
import { deleteRole } from '../mock/api.js';

const PAGE_SIZE = 8;
const STATUSES = ['Active', 'Inactive'];

function FilterButton({ value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <FilterSelect label={value} active={active} onClick={() => setOpen((o) => !o)} />
      {open && (
        <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }} onMouseLeave={() => setOpen(false)}>
          <DropdownMenu width={180} items={options.map((o) => ({
            label: o, icon: o === value ? 'check' : undefined,
            onClick: () => { onChange(o); setOpen(false); },
          }))} />
        </span>
      )}
    </span>
  );
}

function ModuleRow({ mod, open, onToggle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--tk-line)' }}>
      <button type="button" onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 4px',
                 border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} color="var(--tk-ink-300)" />
        <span style={{ width: 28, height: 28, borderRadius: 'var(--tk-r-sm)', display: 'grid', placeItems: 'center',
                       background: 'var(--tk-blue-soft)', color: 'var(--tk-blue)', flex: '0 0 auto' }}>
          <Icon name={mod.icon} size={15} />
        </span>
        <span style={{ flex: 1, font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{mod.name}</span>
        <span className="tk-meta">{mod.granted} of {mod.total}</span>
      </button>
      {open && (
        <div style={{ padding: '0 4px 14px 52px', display: 'grid', gap: 12 }}>
          {(mod.actions || []).map((a) => (
            <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, flex: '0 0 auto', marginTop: 1,
                             display: 'grid', placeItems: 'center',
                             background: a.granted ? 'var(--tk-success-soft)' : 'var(--tk-neutral-soft)',
                             color: a.granted ? 'var(--tk-success)' : 'var(--tk-ink-300)' }}>
                <Icon name="check" size={11} />
              </span>
              <span style={{ display: 'grid', gap: 1 }}>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{a.name}</span>
                <span className="tk-meta">{a.description}</span>
              </span>
            </div>
          ))}
          {!mod.actions && <span className="tk-meta">Full access to this module.</span>}
        </div>
      )}
    </div>
  );
}

export function RolesPermissions() {
  const navigate = useNavigate();
  const roles = useCollection('roles') || [];
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All Status');
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panelTab, setPanelTab] = useState('Permissions');
  const [openModule, setOpenModule] = useState('Jobs & Trips');
  const [permQ, setPermQ] = useState('');

  const filtered = useMemo(() => roles.filter((r) => (
    (status === 'All Status' || r.status === status) &&
    (!q || [r.name, r.description].some((s) => s && s.toLowerCase().includes(q.toLowerCase())))
  )), [roles, status, q]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = roles.find((r) => r.id === selectedId) || roles[2] || roles[0];

  const visibleModules = useMemo(() => {
    if (!selected) return [];
    if (!permQ) return selected.modules;
    return selected.modules.filter((m) => m.name.toLowerCase().includes(permQ.toLowerCase()));
  }, [selected, permQ]);

  function resetFilters() { setStatus('All Status'); setQ(''); setPage(1); }

  return (
    <>
      <PageHeader crumbs={['Administration', 'Roles & Permissions']} title="Roles & Permissions"
        description="Create, manage and configure roles and their permissions."
        actions={<>
          <Button variant="outline" icon="grid-2x2">Permissions Matrix</Button>
          <Button icon="plus" onClick={() => navigate('/roles/new')}>Create New Role</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users-round" tint="blue" label="Total Roles" value={rolesSummary.totalRoles} caption={rolesSummary.totalCaption} />
        <StatCard icon="file-text" tint="blue" label="System Roles" value={rolesSummary.systemRoles} caption={rolesSummary.systemCaption} />
        <StatCard icon="user-round-cog" tint="blue" label="Custom Roles" value={rolesSummary.customRoles} caption={rolesSummary.customCaption} />
        <StatCard icon="shield-check" tint="blue" label="Permissions" value={rolesSummary.permissions} caption={rolesSummary.permissionsCaption} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Roles" pad="none">
          <div style={{ padding: '0 var(--tk-card-pad)', marginTop: -4 }}>
            <span className="tk-meta">Manage roles and assign permissions to control user access.</span>
          </div>
          <TableToolbar
            search={<SearchField placeholder="Search roles by name…" value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={<FilterButton value={status} options={['All Status', ...STATUSES]} active={status !== 'All Status'}
              onChange={(v) => { setStatus(v); setPage(1); }} />}
            onClear={resetFilters} />

          <DataTable rows={paged} rowKey={(r) => r.id} onRowClick={(r) => setSelectedId(r.id)}
            columns={[
              { key: 'name', header: 'Role Name', render: (r) => (
                <span style={{ display: 'grid', gap: 2 }}>
                  <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                  <span className="tk-meta">{r.description}</span>
                </span>) },
              { key: 'type', header: 'Type', render: (r) => <Tag tone={r.type === 'Custom' ? 'blue' : 'neutral'}>{r.type}</Tag> },
              { key: 'users', header: 'Users' },
              { key: 'status', header: 'Status', render: (r) => <Badge dot>{r.status}</Badge> },
              { key: 'lastUpdated', header: 'Last Updated' },
              { key: 'actions', header: 'Actions', width: 60, render: (r) => (
                <span style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onMouseLeave={() => setMenuFor(null)}>
                      <DropdownMenu width={200} items={[
                        { label: 'View Role', icon: 'eye', onClick: () => { setSelectedId(r.id); setMenuFor(null); } },
                        { label: 'Edit Role', icon: 'pencil', onClick: () => setMenuFor(null) },
                        { label: 'Duplicate Role', icon: 'copy', onClick: () => setMenuFor(null) },
                        { divider: true },
                        { label: 'Delete Role', icon: 'trash-2', tone: 'danger', onClick: () => { deleteRole(r.id); setMenuFor(null); } },
                      ]} />
                    </span>
                  )}
                </span>) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
            pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
            onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        {selected && (
          <Card style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 'var(--tk-r-lg)', flex: '0 0 auto',
                             display: 'grid', placeItems: 'center', background: selected.color + '1a', color: selected.color }}>
                <Icon name={selected.icon} size={20} />
              </span>
              <div style={{ flex: 1, display: 'grid', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 className="tk-section">{selected.name}</h3>
                  <Badge dot>{selected.status}</Badge>
                </div>
                <span className="tk-meta">{selected.type} Role · Created on {selected.createdOn}</span>
              </div>
              <IconButton icon="pencil" tone="outline" label="Edit Role" />
            </div>
            <span style={{ font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{selected.permissionSummary}</span>

            <div style={{ borderTop: '1px solid var(--tk-line)', paddingTop: 4 }}>
              <LabelValue label="Role ID" value={selected.id} />
              <LabelValue label="Role Name" value={selected.name} />
              <LabelValue label="Role Type" value={selected.type} />
              <LabelValue label="Created By" value={selected.createdBy} />
              <LabelValue label="Last Updated" value={selected.lastUpdated} />
            </div>

            <Tabs value={panelTab} onChange={setPanelTab}
              items={[{ value: 'Permissions', label: 'Permissions', count: selected.permissionsCount },
                      { value: 'Users', label: 'Users', count: selected.users },
                      'Activity Log']} />

            {panelTab === 'Permissions' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <SearchField placeholder="Search permissions…" value={permQ}
                  onChange={(e) => setPermQ(e.target.value)} />
                <div>
                  {visibleModules.map((m) => (
                    <ModuleRow key={m.name} mod={m} open={openModule === m.name}
                      onToggle={() => setOpenModule(openModule === m.name ? null : m.name)} />
                  ))}
                </div>
                <a href="#" style={{ textAlign: 'center', font: '600 13px/1 var(--tk-font-sans)' }}>View All Modules</a>
              </div>
            )}
            {panelTab === 'Users' && (
              <span className="tk-meta">{selected.users} users currently hold the {selected.name} role.</span>
            )}
            {panelTab === 'Activity Log' && (
              <span className="tk-meta">Role last updated {selected.lastUpdated} by {selected.createdBy}.</span>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
