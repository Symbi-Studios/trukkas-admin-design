import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, StatCard, SectionCard, TableToolbar, SearchField, DataTable,
  Pagination, Badge, Tag, DonutChart, LegendList, QuickActionsCard, Card,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';

const CATEGORY_TONE = { Hazardous: 'danger', 'Temp. Sensitive': 'teal', 'Break-bulk': 'orange', Bulk: 'blue', 'Value Chain': 'purple' };

function two(a, b) {
  return (
    <span style={{ display: 'grid', gap: 2 }}>
      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{a}</span>
      <span className="tk-meta">{b}</span>
    </span>
  );
}

export function CargoManagement() {
  const cargo = useCollection('cargo') || [];
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => !q ? cargo : cargo.filter(
    (c) => [c.id, c.desc, c.job].some((v) => v.toLowerCase().includes(q.toLowerCase())),
  ), [cargo, q]);

  const counts = useMemo(() => ({
    total: cargo.length,
    hazardous: cargo.filter((c) => c.category === 'Hazardous').length,
    tempSensitive: cargo.filter((c) => c.category === 'Temp. Sensitive').length,
    active: cargo.filter((c) => c.status === 'Active').length,
  }), [cargo]);

  const byCategory = useMemo(() => {
    const map = {};
    cargo.forEach((c) => { map[c.category] = (map[c.category] || 0) + 1; });
    return Object.entries(map).map(([label, value]) => ({ label, value, color: `var(--tk-viz-${(Object.keys(map).indexOf(label) % 6) + 1})` }));
  }, [cargo]);

  return (
    <>
      <PageHeader crumbs={['Cargo', 'Cargo Management']} title="Cargo Management"
        description="Oversee cargo records attached to jobs across the platform." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="container" label="Active Cargo Records" value={counts.active} caption="across open jobs" />
        <StatCard icon="triangle-alert" tint="red" label="Hazardous" value={counts.hazardous}
          caption={`${((counts.hazardous / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="thermometer" tint="teal" label="Temp. Sensitive" value={counts.tempSensitive}
          caption={`${((counts.tempSensitive / counts.total) * 100).toFixed(1)}% of total`} />
        <StatCard icon="clipboard-list" tint="amber" label="Total Records" value={counts.total} caption="all cargo entries" />
      </div>

      <Card pad="none">
        <TableToolbar search={<SearchField placeholder="Search by cargo ID, description or job ID..."
          value={q} onChange={(e) => setQ(e.target.value)} />} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Cargo Records" count={filtered.length} pad="none">
          <DataTable rows={filtered} rowKey={(r) => r.id}
            columns={[
              { key: 'desc', header: 'Cargo', render: (r) => two(r.desc, r.id) },
              { key: 'category', header: 'Category', render: (r) => <Tag tone={CATEGORY_TONE[r.category] || 'neutral'}>{r.category}</Tag> },
              { key: 'job', header: 'Job ID', render: (r) => <Link to={`/jobs/${r.job}`}>{r.job}</Link> },
              { key: 'weight', header: 'Weight', align: 'right' },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]} />
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(filtered.length / 10))}
            total={filtered.length} onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Cargo by Category">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={140} thickness={18} centerValue={counts.total} centerLabel="Total Records" data={byCategory} />
              <LegendList style={{ width: '100%' }} items={byCategory} />
            </div>
          </SectionCard>
          <QuickActionsCard items={[
            { icon: 'plus', label: 'Add Cargo Type', hint: 'Define a new cargo type' },
            { icon: 'triangle-alert', label: 'Flag Hazardous Cargo', hint: 'Mark a record for special handling' },
          ]} />
        </div>
      </div>
    </>
  );
}
