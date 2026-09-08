'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '../router.js';
import {
  PageHeader, FilterSelect, StatCard, SectionCard, LineChart, DonutChart, LegendList,
  RankBarList, DataTable, Badge, AlertRow, Button, QuickActionsCard, MapPanel,
  ListRow, IconButton, Tabs, DropdownMenu, Modal, Banner,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { markJobDelivered, cancelJob } from '../mock/api.js';
import { formatNaira } from '../mock/format.js';

const DATE_RANGES = ['Today, Aug 4, 2026', 'Yesterday, Aug 3, 2026', 'Last 7 Days', 'Last 30 Days', 'This Month'];
const PERIODS = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
const PERIOD_MULT = { 'Last 7 days': 1, 'Last 30 days': 4.2, 'Last 90 days': 12.5 };
const ACTIVITY_LABELS = ['Jul 28', 'Jul 29', 'Jul 30', 'Jul 31', 'Aug 1', 'Aug 2', 'Aug 3', 'Aug 4'];
const ACTIVITY = {
  Jobs: { color: '#4c16ac', points: [62, 108, 118, 152, 128, 168, 176, 244] },
  Trips: { color: '#12a150', points: [40, 66, 72, 90, 88, 110, 120, 142] },
  Revenue: { color: '#f5a524', points: [8, 14, 12, 19, 17, 24, 28, 35] },
  Signups: { color: '#2469e8', points: [5, 9, 7, 13, 11, 16, 19, 24] },
};

const ALERTS = [
  { icon: 'wallet', title: 'Payouts awaiting release', description: 'Approved and ready for release', count: 8, route: '/wallets' },
  { icon: 'wrench', tone: 'amber', title: 'Trucks due for maintenance', description: 'Within 7 days', count: 12, route: '/fleet' },
  { icon: 'file-text', tone: 'blue', title: 'Exporter verifications', description: 'Documents pending review', count: 7, route: '/verification' },
  { icon: 'message-square-warning', title: 'Disputes open', description: 'Require admin attention', count: 3, route: '/tickets' },
  { icon: 'lock-open', tone: 'amber', title: 'Provisional releases expiring', description: 'Within 3 days', count: 5, route: '/wallets' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const jobs = useCollection('jobs') || [];
  const [metric, setMetric] = useState('Jobs');
  const [period, setPeriod] = useState('Last 7 days');
  const [dateRange, setDateRange] = useState(DATE_RANGES[0]);
  const [openMenu, setOpenMenu] = useState(null);
  const [rowMenuFor, setRowMenuFor] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 5),
    [jobs],
  );

  const mult = PERIOD_MULT[period];
  const series = [{ name: metric, color: ACTIVITY[metric].color, points: ACTIVITY[metric].points.map((p) => Math.round(p * mult)) }];

  function handleJobAction(job, action) {
    setRowMenuFor(null);
    if (action === 'deliver') {
      markJobDelivered(job.id);
      setToast({ tone: 'success', title: `${job.id} marked as delivered.` });
    } else if (action === 'cancel') {
      cancelJob(job.id);
      setToast({ tone: 'danger', title: `${job.id} cancelled.` });
    }
  }

  return (
    <>
      <PageHeader title="Admin Dashboard"
        description="Complete overview of Trukkas operations, performance and system health."
        actions={
          <span style={{ position: 'relative' }}>
            <FilterSelect label={dateRange} icon="calendar" active={openMenu === 'date'}
              onClick={() => setOpenMenu(openMenu === 'date' ? null : 'date')} />
            {openMenu === 'date' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={210} items={DATE_RANGES.map((r) => ({
                  label: r, icon: r === dateRange ? 'check' : undefined,
                  onClick: () => { setDateRange(r); setOpenMenu(null); },
                }))} />
              </span>
            )}
          </span>
        } />

      {toast && <Banner tone={toast.tone === 'danger' ? 'danger' : toast.tone} title={toast.title} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="package" label="Total Jobs" value="1,842" delta="24%" caption="vs last month" />
        <StatCard icon="truck" tint="green" label="Active Trips" value="687" delta="18%" caption="vs last month" />
        <StatCard icon="building-2" tint="purple" label="Registered Companies" value="326" delta="32%" caption="vs last month" />
        <StatCard icon="user-check" tint="teal" label="Verified Exporters" value="1,124" delta="28%" caption="vs last month" />
        <StatCard icon="banknote" tint="amber" label="Total GMV" value="₦1,24B" delta="41%" caption="vs last month" />
        <StatCard icon="database" tint="navy" label="Platform Revenue" value="₦86.4M" delta="37%" caption="vs last month" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 'var(--tk-grid-gap)' }}>
        <SectionCard title="Operational Activity"
          action={
            <span style={{ position: 'relative' }}>
              <FilterSelect label={period} active={openMenu === 'period'}
                onClick={() => setOpenMenu(openMenu === 'period' ? null : 'period')} />
              {openMenu === 'period' && (
                <span style={{ position: 'absolute', right: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={170} items={PERIODS.map((p) => ({
                    label: p, icon: p === period ? 'check' : undefined,
                    onClick: () => { setPeriod(p); setOpenMenu(null); },
                  }))} />
                </span>
              )}
            </span>
          }>
          <Tabs value={metric} onChange={setMetric} items={['Jobs', 'Trips', 'Revenue', 'Signups']}
                style={{ marginBottom: 14 }} />
          <LineChart area height={210} labels={ACTIVITY_LABELS} series={series} />
        </SectionCard>
        <MapPanel title="Live Fleet Map" status="687 active trips" height={240} onExpand={() => setMapOpen(true)}
          legend={[{ label: 'In Transit', color: 'var(--tk-blue)' },
                   { label: 'Loading', color: 'var(--tk-warning)' },
                   { label: 'Unloading', color: 'var(--tk-success)' }]}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                        textAlign: 'center', padding: 20 }}>
            <span className="tk-meta">Map surface is supplied by the consuming app's tile layer.<br />
              The design system ships the panel chrome only.</span>
          </div>
        </MapPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Recent Jobs" pad="none" action={<a onClick={() => navigate('/jobs')} style={{ cursor: 'pointer' }}>View all</a>}>
          <DataTable rows={recentJobs} rowKey={(r) => r.id} style={{ padding: '0 6px' }}
            columns={[
              { key: 'id', header: 'Job ID', render: (r) => <Link to={`/jobs/${r.id}`}>{r.id}</Link> },
              { key: 'route', header: 'Route' },
              { key: 'cargo', header: 'Cargo' },
              { key: 'cargoType', header: 'Type' },
              { key: 'forwarder', header: 'Company' },
              { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'amount', header: 'Amount', align: 'right',
                render: (r) => <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{formatNaira(r.amount)}</span> },
              { key: 'x', header: '', width: 44, render: (r) => (
                <span style={{ position: 'relative' }}>
                  <IconButton icon="ellipsis-vertical" onClick={(e) => { e.stopPropagation(); setRowMenuFor(rowMenuFor === r.id ? null : r.id); }} />
                  {rowMenuFor === r.id && (
                    <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu width={190} items={[
                        { label: 'View Job', icon: 'eye', onClick: () => { setRowMenuFor(null); navigate(`/jobs/${r.id}`); } },
                        { divider: true },
                        ...(r.status !== 'Delivered' ? [{ label: 'Mark Delivered', icon: 'circle-check', onClick: () => handleJobAction(r, 'deliver') }] : []),
                        { label: 'Cancel Job', icon: 'ban', tone: 'danger', onClick: () => handleJobAction(r, 'cancel') },
                      ]} />
                    </span>
                  )}
                </span>) },
            ]} />
        </SectionCard>
        <SectionCard title="Alerts & Pending Actions" action={<a onClick={() => setAlertsOpen(true)} style={{ cursor: 'pointer' }}>View all</a>}>
          {ALERTS.map((a) => (
            <AlertRow key={a.title} icon={a.icon} tone={a.tone} title={a.title} description={a.description} count={a.count}
              action={<Button size="sm" variant="outline" onClick={() => navigate(a.route)}>Review</Button>} />
          ))}
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <SectionCard title="Fleet Utilization">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <DonutChart size={150} thickness={20} centerValue="72%" centerLabel="Overall Utilization"
              data={[{ label: 'On Trips', value: 687 }, { label: 'Available', value: 214 },
                     { label: 'In Maintenance', value: 48 }, { label: 'Out of Service', value: 21 }]} />
            <LegendList style={{ width: '100%' }} showShare={false}
              items={[{ label: 'On Trips', value: 687 }, { label: 'Available', value: 214 },
                      { label: 'In Maintenance', value: 48 }, { label: 'Out of Service', value: 21 }]} />
          </div>
        </SectionCard>
        <SectionCard title="Top Routes by Volume">
          <RankBarList items={[{ label: 'Lagos → Kano', value: 342 }, { label: 'Apapa → Ibadan', value: 256 },
                               { label: 'Onne → Abuja', value: 198 }, { label: 'Lagos → Kaduna', value: 176 },
                               { label: 'PH → Port Harcourt', value: 142 }]} />
        </SectionCard>
        <SectionCard title="System Health" action={<Badge>Active</Badge>}>
          <ListRow icon="server" title="API Services" value="99.9% uptime" caption="" />
          <ListRow icon="credit-card" title="Payment Gateway" value="99.8% uptime" />
          <ListRow icon="map-pin" title="GPS Tracking" value="99.9% uptime" />
          <ListRow icon="database" title="Database" value="99.9% uptime" />
        </SectionCard>
        <QuickActionsCard layout="grid" items={[
          { icon: 'plus', label: 'Create Job', onClick: () => navigate('/jobs') },
          { icon: 'user-check', label: 'Verify Exporter', onClick: () => navigate('/verification') },
          { icon: 'wallet', label: 'Release Payout', onClick: () => navigate('/payouts') },
          { icon: 'truck', label: 'Add Truck', onClick: () => navigate('/fleet') },
          { icon: 'chart-column', label: 'View Reports', onClick: () => navigate('/reports') },
          { icon: 'send', label: 'Send Notice', onClick: () => navigate('/announcements') },
        ]} />
      </div>

      <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Live Fleet Map" description="687 active trips across the network" width={720}>
        <div style={{ height: 380, borderRadius: 10, border: '1.5px dashed var(--tk-line-strong)', background: 'var(--tk-surface-sunk)',
                      display: 'grid', placeItems: 'center', gap: 8, textAlign: 'center', color: 'var(--tk-ink-300)' }}>
          <span style={{ font: '600 13px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>Map view placeholder</span>
          <span className="tk-meta">Map surface is supplied by the consuming app's tile layer.</span>
        </div>
      </Modal>

      <Modal open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Alerts & Pending Actions" description="Everything currently waiting on admin review." width={560}>
        <div style={{ display: 'grid' }}>
          {ALERTS.map((a) => (
            <AlertRow key={a.title} icon={a.icon} tone={a.tone} title={a.title} description={a.description} count={a.count}
              action={<Button size="sm" variant="outline" onClick={() => { setAlertsOpen(false); navigate(a.route); }}>Review</Button>} />
          ))}
        </div>
      </Modal>
    </>
  );
}
