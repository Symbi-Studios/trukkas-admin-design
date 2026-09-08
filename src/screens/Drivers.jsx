import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, DonutChart, LegendList, QuickActionsCard, Card,
  DropdownMenu, IconButton,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { setDriverStatus } from '../mock/api.js';

const STATUSES = ['Active', 'On Trip', 'Inactive'];

function two(a, b) {
  return (
    <span style={{ display: 'grid', gap: 2 }}>
      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{a}</span>
      <span className="tk-meta">{b}</span>
    </span>
  );
}

export function Drivers() {
  const drivers = useCollection('drivers') || [];
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All Status');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  const filtered = useMemo(() => drivers.filter((d) => {
    const matchesQ = !q || [d.name, d.license, d.phone].some((v) => v.toLowerCase().includes(q.toLowerCase()));
    const matchesStatus = status === 'All Status' || d.status === status;
    return matchesQ && matchesStatus;
  }), [drivers, q, status]);

  const counts = useMemo(() => ({
    total: drivers.length,
    active: drivers.filter((d) => d.status === 'Active').length,
    onTrip: drivers.filter((d) => d.status === 'On Trip').length,
    inactive: drivers.filter((d) => d.status === 'Inactive').length,
  }), [drivers]);

  return (
    <>
      <PageHeader crumbs={['Fleet', 'Drivers']} title="Drivers"
        description="Manage driver profiles, licenses and trip assignments."
        actions={<Button icon="user-plus">Add Driver</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="user" label="Total Drivers" value={counts.total} caption="registered" />
        <StatCard icon="circle-check" tint="green" label="Active" value={counts.active}
          caption={`${((counts.active / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="route" label="On Trip" value={counts.onTrip}
          caption={`${((counts.onTrip / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="circle-x" tint="navy" label="Inactive" value={counts.inactive}
          caption={`${((counts.inactive / counts.total) * 100).toFixed(1)}% of total`} />
      </div>

      <Card pad="none">
        <TableToolbar
          search={<SearchField placeholder="Search by driver name, license or phone..."
            value={q} onChange={(e) => setQ(e.target.value)} />}
          filters={<span style={{ position: 'relative' }}>
            <FilterSelect label={status} active={status !== 'All Status'}
              onClick={() => setStatusMenuOpen((o) => !o)} />
            {statusMenuOpen && (
              <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({
                  label: s, icon: s === status ? 'check' : undefined,
                  onClick: () => { setStatus(s); setStatusMenuOpen(false); },
                }))} />
              </span>
            )}
          </span>} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Drivers" count={filtered.length} pad="none">
          <DataTable rows={filtered} rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Driver', render: (r) => two(<Link to={`/drivers/${r.id}`}>{r.name}</Link>, r.id) },
              { key: 'license', header: 'License No.', render: (r) => <span className="tk-mono">{r.license}</span> },
              { key: 'truckPlate', header: 'Truck Assigned', render: (r) => r.truckPlate || '—' },
              { key: 'company', header: 'Company' },
              { key: 'status', header: 'Status', render: (r) => <Badge dot>{r.status}</Badge> },
              { key: 'joined', header: 'Joined' },
              { key: 'x', header: '', width: 44, render: (r) => (
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}>
                      <DropdownMenu width={180} items={STATUSES.filter((s) => s !== r.status).map((s) => ({
                        label: `Mark as ${s}`, icon: 'check',
                        onClick: () => { setDriverStatus(r.id, s); setMenuFor(null); },
                      }))} />
                    </span>
                  )}
                </span>) },
            ]} />
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            total={filtered.length} onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Driver Status">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={140} thickness={18} centerValue={counts.total} centerLabel="Total"
                data={[{ label: 'Active', value: counts.active, color: 'var(--tk-success)' },
                       { label: 'On Trip', value: counts.onTrip, color: 'var(--tk-blue)' },
                       { label: 'Inactive', value: counts.inactive, color: 'var(--tk-neutral)' }]} />
              <LegendList style={{ width: '100%' }}
                items={[{ label: 'Active', value: counts.active, color: 'var(--tk-success)' },
                        { label: 'On Trip', value: counts.onTrip, color: 'var(--tk-blue)' },
                        { label: 'Inactive', value: counts.inactive, color: 'var(--tk-neutral)' }]} />
            </div>
          </SectionCard>
          <QuickActionsCard items={[
            { icon: 'user-plus', label: 'Add Driver', hint: 'Register a new driver' },
            { icon: 'shield-check', label: 'Verify License', hint: 'Check a license against the registry' },
            { icon: 'download', label: 'Export Roster', hint: 'Download driver data report' },
          ]} />
        </div>
      </div>
    </>
  );
}
