'use client';

import { useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, Tag, DonutChart, LegendList, QuickActionsCard, Card,
  DropdownMenu, IconButton, Icon, Avatar,
} from '../ds.js';

// Forwarders are individuals (people) who arrange freight movement on the platform.
// An exporter is a forwarder who additionally holds a valid export license.
const FORWARDERS = [
  { id: 'FWD-000128', name: 'Michael Okafor', email: 'michael.okafor82@gmail.com', phone: '+234 803 123 4567', location: 'Lagos, Nigeria', status: 'Active', verification: 'Verified', isExporter: true, jobs: 128, spend: 245680000, joined: 'Jan 15, 2024' },
  { id: 'FWD-000129', name: 'Jide Adesina', email: 'jide.adesina@gmail.com', phone: '+234 806 987 6543', location: 'Lagos, Nigeria', status: 'Active', verification: 'Verified', isExporter: false, jobs: 96, spend: 186450000, joined: 'Feb 20, 2024' },
  { id: 'FWD-000130', name: 'Hauwa Muhammad', email: 'hauwa.muhammad@yahoo.com', phone: '+234 802 345 6789', location: 'Kano, Nigeria', status: 'Active', verification: 'Verified', isExporter: true, jobs: 74, spend: 142350000, joined: 'Mar 10, 2024' },
  { id: 'FWD-000131', name: 'Tunde Balogun', email: 'tunde.balogun@gmail.com', phone: '+234 813 456 7890', location: 'Port Harcourt, Nigeria', status: 'Active', verification: 'Verified', isExporter: false, jobs: 63, spend: 98760000, joined: 'Apr 5, 2024' },
  { id: 'FWD-000132', name: 'Amina Yusuf', email: 'amina.yusuf@gmail.com', phone: '+234 805 678 9012', location: 'Kaduna, Nigeria', status: 'Pending', verification: 'Pending', isExporter: false, jobs: 12, spend: 18450000, joined: 'May 8, 2024' },
  { id: 'FWD-000133', name: 'Emeka Nwosu', email: 'emeka.nwosu@gmail.com', phone: '+234 817 234 5678', location: 'Enugu, Nigeria', status: 'Active', verification: 'Verified', isExporter: false, jobs: 55, spend: 76540000, joined: 'Jun 12, 2024' },
  { id: 'FWD-000134', name: 'Blessing Ojo', email: 'blessing.ojo@yahoo.com', phone: '+234 809 876 5432', location: 'Ibadan, Nigeria', status: 'Active', verification: 'Verified', isExporter: true, jobs: 47, spend: 65230000, joined: 'Jul 1, 2024' },
  { id: 'FWD-000135', name: 'Samuel Eze', email: 'samuel.eze@gmail.com', phone: '+234 804 321 0987', location: 'Abuja, Nigeria', status: 'Suspended', verification: 'Verified', isExporter: false, jobs: 0, spend: 0, joined: 'Aug 18, 2024' },
  { id: 'FWD-000136', name: 'Salma Ibrahim', email: 'salma.ibrahim@gmail.com', phone: '+234 816 765 4321', location: 'Jos, Nigeria', status: 'Active', verification: 'Verified', isExporter: false, jobs: 31, spend: 42190000, joined: 'Sep 3, 2024' },
  { id: 'FWD-000137', name: 'Peter Obi', email: 'peter.obi@gmail.com', phone: '+234 812 654 3210', location: 'Warri, Nigeria', status: 'Active', verification: 'Verified', isExporter: true, jobs: 34, spend: 53780000, joined: 'Oct 10, 2024' },
];

const STATS = {
  total: 286, active: 243, pending: 18, suspended: 5, exporters: 64,
  totalDelta: '18%', activeDelta: '16%', pendingDelta: '10%', suspendedDelta: '29%', exportersDelta: '9%',
  totalJobs: 1842, totalJobsDelta: '21%', totalSpend: 3245680000, totalSpendDelta: '23%',
};

const STATUSES = ['Active', 'Pending', 'Suspended'];
const VERIFICATIONS = ['Verified', 'Pending', 'Rejected'];
const STATUS_TONE = { Active: 'success', Pending: 'warning', Suspended: 'danger' };
const VERIFICATION_META = {
  Verified: { tone: 'success', icon: 'circle-check' },
  Pending: { tone: 'warning', icon: 'hourglass' },
  Rejected: { tone: 'danger', icon: 'circle-x' },
};
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

const OVERVIEW = [
  { label: 'Active', value: 243, color: 'var(--tk-success)' },
  { label: 'Pending', value: 18, color: 'var(--tk-warning)' },
  { label: 'Suspended', value: 5, color: 'var(--tk-danger-solid)' },
  { label: 'Inactive', value: 20, color: 'var(--tk-neutral)' },
];

const TOP_SPEND = FORWARDERS.filter((f) => f.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 5);

function ForwarderCell({ f }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Avatar name={f.name} size={32} />
      <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
        <Link to={`/forwarders/${f.id}`} style={{ font: '600 13px/18px var(--tk-font-sans)' }}>{f.name}</Link>
        <span className="tk-meta">{f.id}</span>
      </span>
    </span>
  );
}

export function Forwarders() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All Status');
  const [verification, setVerification] = useState('All Verification Status');
  const [location, setLocation] = useState('All Locations');
  const [type, setType] = useState('All Types');
  const [openFilter, setOpenFilter] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  const locations = useMemo(() => [...new Set(FORWARDERS.map((f) => f.location))], []);

  const filtered = useMemo(() => FORWARDERS.filter((f) => {
    const matchesQ = !q || [f.name, f.id, f.email, f.phone].some((v) => v.toLowerCase().includes(q.toLowerCase()));
    const matchesStatus = status === 'All Status' || f.status === status;
    const matchesVerification = verification === 'All Verification Status' || f.verification === verification;
    const matchesLocation = location === 'All Locations' || f.location === location;
    const matchesType = type === 'All Types' || (type === 'Exporter' ? f.isExporter : !f.isExporter);
    return matchesQ && matchesStatus && matchesVerification && matchesLocation && matchesType;
  }), [q, status, verification, location, type]);

  return (
    <>
      <PageHeader crumbs={['Partners', 'Forwarders / Exporters']} title="Forwarders / Exporters"
        description="Manage and monitor all forwarders and exporters on the platform. Forwarders are individuals; an exporter is a forwarder holding a valid export license."
        actions={<>
          <Button icon="plus">Add Forwarder</Button>
          <Button variant="outline" icon="download" iconRight="chevron-down">Export</Button>
          <Button variant="outline" icon="sliders-horizontal">Filters</Button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="users" label="Total Forwarders" value={STATS.total} delta={STATS.totalDelta} caption="vs last 30 days" />
        <StatCard icon="circle-check" tint="green" label="Active Forwarders" value={STATS.active} delta={STATS.activeDelta} caption="vs last 30 days" />
        <StatCard icon="ship" tint="teal" label="Exporters" value={STATS.exporters} delta={STATS.exportersDelta} caption="hold export license" />
        <StatCard icon="hourglass" tint="amber" label="Pending Verification" value={STATS.pending} delta={STATS.pendingDelta} direction="down" caption="vs last 30 days" />
        <StatCard icon="circle-x" tint="purple" label="Suspended" value={STATS.suspended} delta={STATS.suspendedDelta} direction="down" caption="vs last 30 days" />
        <StatCard icon="wallet" tint="blue" label="Total Spend (₦)" value={naira(STATS.totalSpend)} delta={STATS.totalSpendDelta} caption="vs last 30 days" />
      </div>

      <Card pad="none">
        <TableToolbar
          search={<SearchField placeholder="Search by name, forwarder ID, email, phone..."
            value={q} onChange={(e) => setQ(e.target.value)} />}
          filters={<>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={type} active={type !== 'All Types'} onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')} />
              {openFilter === 'type' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={200} items={['All Types', 'Forwarder', 'Exporter'].map((s) => ({
                    label: s, icon: s === type ? 'check' : undefined,
                    onClick: () => { setType(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={status} active={status !== 'All Status'} onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')} />
              {openFilter === 'status' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({
                    label: s, icon: s === status ? 'check' : undefined,
                    onClick: () => { setStatus(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={location} active={location !== 'All Locations'} onClick={() => setOpenFilter(openFilter === 'location' ? null : 'location')} />
              {openFilter === 'location' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={220} items={['All Locations', ...locations].map((s) => ({
                    label: s, icon: s === location ? 'check' : undefined,
                    onClick: () => { setLocation(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <span style={{ position: 'relative' }}>
              <FilterSelect label={verification} active={verification !== 'All Verification Status'} onClick={() => setOpenFilter(openFilter === 'verification' ? null : 'verification')} />
              {openFilter === 'verification' && (
                <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={200} items={['All Verification Status', ...VERIFICATIONS].map((s) => ({
                    label: s, icon: s === verification ? 'check' : undefined,
                    onClick: () => { setVerification(s); setOpenFilter(null); },
                  }))} />
                </span>
              )}
            </span>
            <FilterSelect label="More Filters" icon="layout-grid" />
          </>} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard pad="none">
          <DataTable rows={filtered} rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Forwarder', render: (r) => <ForwarderCell f={r} /> },
              { key: 'type', header: 'Type', render: (r) => (
                r.isExporter ? <Tag tone="teal" icon={<Icon name="ship" size={11} />}>Exporter</Tag> : <Tag>Forwarder</Tag>) },
              { key: 'email', header: 'Email / Phone', render: (r) => (
                <span style={{ display: 'grid', gap: 1 }}>
                  <span style={{ font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{r.email}</span>
                  <span className="tk-meta">{r.phone}</span>
                </span>) },
              { key: 'location', header: 'Location', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <Icon name="map-pin" size={13} color="var(--tk-ink-300)" style={{ marginTop: 3, flex: '0 0 auto' }} />{r.location}
                </span>) },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
              { key: 'verification', header: 'Verification', render: (r) => (
                <Badge tone={VERIFICATION_META[r.verification].tone}>
                  <Icon name={VERIFICATION_META[r.verification].icon} size={11} />{r.verification}
                </Badge>) },
              { key: 'jobs', header: 'Total Jobs', align: 'right' },
              { key: 'spend', header: 'Total Spend (₦)', align: 'right', render: (r) => (
                <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.spend)}</strong>) },
              { key: 'joined', header: 'Joined On' },
              { key: 'x', header: '', width: 44, render: (r) => (
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)} />
                  {menuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}>
                      <DropdownMenu width={200} items={[
                        { label: 'View Details', icon: 'eye' },
                        { divider: true },
                        ...STATUSES.filter((s) => s !== r.status).map((s) => ({
                          label: `Mark as ${s}`, icon: 'circle-check', onClick: () => setMenuFor(null),
                        })),
                      ]} />
                    </span>
                  )}
                </span>) },
            ]} />
          <Pagination page={page} pageCount={29} total={286} pageSize={10} onPage={setPage} onPageSize={() => {}} />
        </SectionCard>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
          <SectionCard title="Forwarders Overview">
            <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
              <DonutChart size={150} thickness={20} centerValue={STATS.total} centerLabel="Total" data={OVERVIEW} />
              <LegendList style={{ width: '100%' }} items={OVERVIEW.map((o) => ({ ...o, display: `${o.value} (${Math.round((o.value / STATS.total) * 100)}%)` }))} showShare={false} />
            </div>
          </SectionCard>

          <SectionCard title="Top Forwarders by Spend">
            <div style={{ display: 'grid' }}>
              {TOP_SPEND.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                                         borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
                  <span className="tk-meta" style={{ width: 16 }}>{i + 1}</span>
                  <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.name}</span>
                  <span style={{ font: '700 13px/18px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{naira(f.spend)}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <a href="#">View full report →</a>
            </div>
          </SectionCard>

          <QuickActionsCard items={[
            { icon: 'user-plus', label: 'Add Forwarder' },
            { icon: 'shield-check', label: 'Bulk Verify Forwarders' },
            { icon: 'download', label: 'Export Forwarders List' },
            { icon: 'megaphone', label: 'Send Announcement' },
            { icon: 'clipboard-list', label: 'View Verification Requests', hint: '18 pending requests' },
          ]} />
        </div>
      </div>
    </>
  );
}
