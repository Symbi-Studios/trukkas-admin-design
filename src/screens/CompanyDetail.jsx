'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  Button, Badge, SectionCard, LabelValue, Card, Breadcrumbs, DropdownMenu, DataTable, Tabs,
  Timeline, QuickActionsCard, Modal, TextField, Textarea, Banner, Icon,
} from '../ds.js';
import './CompanyDetail.css';

const COMPANY = {
  name: 'Global Haulage Ltd', regNo: 'RC 1234567', joined: 'Jan 15, 2026', type: 'Transport & Logistics',
  email: 'info@globalhaulage.com', phone: '0803 123 4567, 0705 987 6543',
  contactPerson: 'Emeka Okafor', contactEmail: 'emeka@globalhaulage.com',
  address: '12 Logistics Avenue, Apapa Lagos, Lagos State, Nigeria',
  accountManager: 'Faith Akpan', notes: 'Reliable partner with strong fleet coverage across major routes.',
  description: "Global Haulage Ltd is a trusted logistics and trucking company providing nationwide container haulage and logistics services. We are committed to safety, reliability, and timely delivery.",
  services: ['Container Haulage', 'General Freight', 'Port Drayage', 'Long Haul Transportation', 'Logistics Support'],
};
const FLEET = { total: 45, owned: 28, rented: 17, capacity: '1,245 TEU', avgAge: '4.2 years', active: 38, inactive: 5, maintenance: 2 };
const TRUCK_TYPES = [
  { label: '40ft High Cube', count: 20, pct: 44, color: 'var(--tk-blue)' },
  { label: '20ft Standard', count: 12, pct: 27, color: 'var(--tk-success)' },
  { label: '40ft Standard', count: 8, pct: 18, color: 'var(--tk-warning)' },
  { label: 'Others', count: 5, pct: 11, color: 'var(--tk-ink-300)' },
];
const RECENT_TRIPS = [
  { id: 'TRK-2026-0456', route: 'Lagos → Kano', status: 'Completed', date: 'Aug 4, 2026', amount: 850000 },
  { id: 'TRK-2026-0455', route: 'Port Harcourt → Lagos', status: 'In Transit', date: 'Aug 4, 2026', amount: 760000 },
  { id: 'TRK-2026-0454', route: 'Kaduna → Onne', status: 'Completed', date: 'Aug 3, 2026', amount: 640000 },
  { id: 'TRK-2026-0453', route: 'Lagos → Abuja', status: 'In Transit', date: 'Aug 3, 2026', amount: 520000 },
  { id: 'TRK-2026-0452', route: 'Ibadan → Lagos', status: 'Completed', date: 'Aug 2, 2026', amount: 430000 },
];
const TRIP_TONE = { Completed: 'success', 'In Transit': 'info' };
const INITIAL_DOCUMENTS = [
  { id: 'd1', name: 'CAC Certificate', validity: 'Valid until Dec 15, 2026', status: 'Valid' },
  { id: 'd2', name: 'Tax Clearance', validity: 'Valid until Nov 30, 2026', status: 'Valid' },
  { id: 'd3', name: 'Insurance Certificate', validity: 'Valid until Oct 20, 2026', status: 'Valid' },
  { id: 'd4', name: 'Fleet Registration', validity: 'Valid until Dec 10, 2026', status: 'Valid' },
  { id: 'd5', name: 'Driver License (Batch)', validity: 'Valid until Sept 5, 2026', status: 'Expiring Soon' },
];
const DOC_TONE = { Valid: 'success', 'Expiring Soon': 'warning', Expired: 'danger' };
const PERFORMANCE = [
  { icon: 'route', label: 'Total Trips', value: '128', delta: '18%', caption: 'vs last 30 days' },
  { icon: 'circle-check', label: 'Completed Trips', value: '116', caption: '90.6% completion rate' },
  { icon: 'timer', label: 'On-Time Delivery', value: '92%', delta: '8%', caption: 'vs last 30 days' },
  { icon: 'gauge', label: 'Utilization Rate', value: '78%', delta: '6%', caption: 'vs last 30 days' },
  { icon: 'wallet', label: 'Total Revenue', value: '₦45.6M', delta: '22%', caption: 'vs last 30 days' },
  { icon: 'star', label: 'Customer Rating', value: '4.7/5', caption: 'Based on 86 reviews' },
];
const INITIAL_ACTIVITY = [
  { text: 'Company profile updated', time: 'Aug 4, 2026 10:15 AM' },
  { text: 'New truck added (LAG-5678-AA)', time: 'Aug 3, 2026 02:40 AM' },
  { text: 'Document uploaded: Insurance Certificate', time: 'Aug 2, 2026 11:30 AM' },
  { text: 'Compliance review completed', time: 'Aug 1, 2026 03:25 PM' },
  { text: 'New driver added (Ahmed Musa)', time: 'Jul 31, 2026 09:10 AM' },
];
const TRUCKS = [
  { plate: 'LAG-5678-AA', type: '40ft High Cube', status: 'Active', driver: 'Ahmed Musa', trips: 24 },
  { plate: 'LAG-2234-BC', type: '20ft Standard', status: 'Active', driver: 'Chinedu Okafor', trips: 19 },
  { plate: 'ABJ-9012-XY', type: '40ft Standard', status: 'In Maintenance', driver: '—', trips: 31 },
  { plate: 'KAN-4471-QT', type: '40ft High Cube', status: 'Active', driver: 'Yusuf Bello', trips: 27 },
  { plate: 'PHC-3390-LR', type: '20ft Standard', status: 'Inactive', driver: '—', trips: 12 },
];
const TRUCK_STATUS_TONE = { Active: 'success', 'In Maintenance': 'warning', Inactive: 'neutral' };
const DRIVERS = [
  { name: 'Ahmed Musa', phone: '0803 111 2233', license: 'Class E', status: 'On Trip', trips: 42 },
  { name: 'Chinedu Okafor', phone: '0805 222 3344', license: 'Class E', status: 'Available', trips: 38 },
  { name: 'Yusuf Bello', phone: '0807 333 4455', license: 'Class D', status: 'On Trip', trips: 35 },
  { name: 'Emeka Nwosu', phone: '0809 444 5566', license: 'Class E', status: 'Off Duty', trips: 29 },
];
const DRIVER_STATUS_TONE = { 'On Trip': 'info', Available: 'success', 'Off Duty': 'neutral' };
const COMPLIANCE_CHECKS = [
  { label: 'Business Registration (CAC)', status: 'Compliant' },
  { label: 'Tax Clearance Certificate', status: 'Compliant' },
  { label: 'Fleet Insurance Coverage', status: 'Compliant' },
  { label: 'Driver License Verification', status: 'Review Needed' },
  { label: 'Safety Inspection Records', status: 'Compliant' },
];
const TAB_ITEMS = ['Overview', 'Trucks (45)', 'Drivers (78)', 'Performance', 'Documents', 'Compliance', 'Activity Log'];
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

export function CompanyDetail() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [company, setCompany] = useState(COMPANY);
  const [status, setStatus] = useState('Active');
  const [verification] = useState('Verified');
  const [period, setPeriod] = useState('Last 30 days');
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [activity, setActivity] = useState(INITIAL_ACTIVITY);
  const [moreOpen, setMoreOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(COMPANY);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);
  function notify(tone, title) { setToast({ tone, title }); }
  function logActivity(text) { setActivity((a) => [{ text, time: 'Just now' }, ...a]); }

  function saveEdit() {
    setCompany(form);
    setEditOpen(false);
    logActivity('Company profile updated');
    notify('success', 'Company details saved.');
  }
  function sendMessage() {
    if (!message.trim()) return;
    setMessageOpen(false); setMessage('');
    notify('success', `Message sent to ${company.contactPerson}.`);
  }
  function toggleSuspend() {
    const next = status === 'Suspended' ? 'Active' : 'Suspended';
    setStatus(next);
    setSuspendOpen(false);
    logActivity(next === 'Suspended' ? 'Company operations suspended' : 'Company reactivated');
    notify(next === 'Suspended' ? 'danger' : 'success', `${company.name} ${next === 'Suspended' ? 'suspended' : 'reactivated'}.`);
  }
  function markDocument(id, newStatus) {
    setDocuments((ds) => ds.map((d) => (d.id === id ? { ...d, status: newStatus } : d)));
    notify('info', 'Document status updated.');
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <div className="cd-head">
        <Breadcrumbs items={[{ label: 'Truck Companies', onClick: () => navigate('/companies') }, company.name]} />
        <div className="cd-head-actions">
          <Button variant="outline" icon="pencil" onClick={() => { setForm(company); setEditOpen(true); }}>Edit Company</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={220} items={[
                  { label: 'Export Company Report', icon: 'download', onClick: () => { setMoreOpen(false); notify('info', 'Exporting company report…'); } },
                  { label: 'Print Profile', icon: 'printer', onClick: () => { setMoreOpen(false); window.print(); } },
                  { label: 'View Audit Log', icon: 'scroll-text', onClick: () => { setMoreOpen(false); setTab('Activity Log'); } },
                  { divider: true },
                  status === 'Suspended'
                    ? { label: 'Reactivate Company', icon: 'circle-check', onClick: () => { setMoreOpen(false); toggleSuspend(); } }
                    : { label: 'Suspend Company', icon: 'circle-alert', tone: 'danger', onClick: () => { setMoreOpen(false); setSuspendOpen(true); } },
                ]} />
              </span>
            )}
          </span>
          <Button icon="arrow-left" onClick={() => navigate('/companies')}>Back to Companies</Button>
        </div>
      </div>

      {toast && <Banner tone={toast.tone} title={toast.title} />}

      <Card>
        <div className="cd-identity">
          <span style={{ width: 72, height: 72, borderRadius: 'var(--tk-r-lg)', flex: '0 0 auto', background: 'var(--tk-navy)',
                         color: '#e8b34a', display: 'grid', placeItems: 'center', textAlign: 'center',
                         font: '800 11px/13px var(--tk-font-sans)', letterSpacing: '.5px' }}>
            GLOBAL<br />HAULAGE
          </span>
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="tk-display" style={{ fontSize: 24 }}>{company.name}</h1>
              <Badge tone={status === 'Suspended' ? 'danger' : 'success'}>{status === 'Suspended' ? 'Suspended' : verification}</Badge>
            </div>
            <span className="tk-meta">{company.regNo}　·　Joined on {company.joined}</span>
          </div>
        </div>
      </Card>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <SectionCard title="Company Information" icon="building-2">
            <div className="cd-info-grid">
              <div className="cd-info-fields">
                <LabelValue layout="stack" label="Company Name" value={company.name} />
                <LabelValue layout="stack" label="Company Type" value={company.type} />
                <LabelValue layout="stack" label="Registration Number" value={company.regNo} />
                <LabelValue layout="stack" label="Date Joined" value={company.joined} />
                <LabelValue layout="stack" label="Email" value={company.email} />
                <LabelValue layout="stack" label="Business Status" value={<Badge tone={status === 'Suspended' ? 'danger' : 'success'}>{status}</Badge>} />
                <LabelValue layout="stack" label="Phone Number" value={company.phone} />
                <LabelValue layout="stack" label="Verification Status" value={<Badge tone="success">{verification}</Badge>} />
                <LabelValue layout="stack" label="Contact Person" value={<span>{company.contactPerson} <Badge tone="info" style={{ marginLeft: 6 }}>Primary</Badge></span>} />
                <LabelValue layout="stack" label="Verification Date" value={company.joined} />
                <LabelValue layout="stack" label="Contact Email" value={company.contactEmail} />
                <LabelValue layout="stack" label="Account Manager" value={company.accountManager} />
                <LabelValue layout="stack" label="Address" value={company.address} />
                <LabelValue layout="stack" label="Notes" value={company.notes} />
              </div>
              <div>
                <span className="tk-meta" style={{ display: 'block', marginBottom: 6 }}>Company Description</span>
                <p style={{ margin: '0 0 14px', font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{company.description}</p>
                <strong style={{ display: 'block', font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', marginBottom: 8 }}>Services Offered</strong>
                <div style={{ display: 'grid', gap: 6 }}>
                  {company.services.map((s) => (
                    <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>
                      <Icon name="circle-check" size={14} color="var(--tk-success)" />{s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Fleet Overview" icon="truck" action={<a onClick={() => setTab('Trucks (45)')} style={{ cursor: 'pointer' }}>View all trucks →</a>}>
            <div className="cd-fleet-stats">
              <div>
                <span className="tk-meta">Total Trucks</span>
                <strong style={{ display: 'block', font: '700 22px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{FLEET.total}</strong>
                <span style={{ font: '500 11px/16px var(--tk-font-sans)' }}>
                  <span style={{ color: 'var(--tk-success)' }}>Active: {FLEET.active}</span>　<span style={{ color: 'var(--tk-warning)' }}>Maintenance: {FLEET.maintenance}</span>
                </span>
              </div>
              <div>
                <span className="tk-meta">Owned Trucks</span>
                <strong style={{ display: 'block', font: '700 22px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{FLEET.owned}</strong>
                <span className="tk-meta">{Math.round((FLEET.owned / FLEET.total) * 100)}% of total fleet</span>
              </div>
              <div>
                <span className="tk-meta">Rented Trucks</span>
                <strong style={{ display: 'block', font: '700 22px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{FLEET.rented}</strong>
                <span className="tk-meta">{Math.round((FLEET.rented / FLEET.total) * 100)}% of total fleet</span>
              </div>
              <div>
                <span className="tk-meta">Total Capacity</span>
                <strong style={{ display: 'block', font: '700 22px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{FLEET.capacity}</strong>
                <span className="tk-meta">Across all trucks</span>
              </div>
              <div>
                <span className="tk-meta">Average Truck Age</span>
                <strong style={{ display: 'block', font: '700 22px/28px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{FLEET.avgAge}</strong>
                <span className="tk-meta">Well maintained fleet</span>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <strong style={{ display: 'block', font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)', marginBottom: 10 }}>Truck Types Distribution</strong>
              <div className="cd-distribution-bar">
                {TRUCK_TYPES.map((t) => <span key={t.label} style={{ width: t.pct + '%', background: t.color }} />)}
              </div>
              <div className="cd-distribution-legend" style={{ marginTop: 10 }}>
                {TRUCK_TYPES.map((t) => (
                  <span key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: t.color }} />{t.label}　<b style={{ color: 'var(--tk-ink-900)' }}>{t.count} ({t.pct}%)</b>
                  </span>
                ))}
              </div>
            </div>
          </SectionCard>

          <div className="cd-main">
            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Recent Trips" pad="none" action={<a onClick={() => notify('info', 'Showing all trips for ' + company.name + '.')} style={{ cursor: 'pointer' }}>View all trips</a>}>
                <DataTable rows={RECENT_TRIPS} rowKey={(r) => r.id}
                  columns={[
                    { key: 'id', header: 'Trip ID', render: (r) => <a onClick={() => navigate('/trips')} style={{ cursor: 'pointer' }}>{r.id}</a> },
                    { key: 'route', header: 'Route' },
                    { key: 'status', header: 'Status', render: (r) => <Badge tone={TRIP_TONE[r.status]}>{r.status}</Badge> },
                    { key: 'date', header: 'Date' },
                    { key: 'amount', header: 'Amount', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.amount)}</strong> },
                  ]} />
              </SectionCard>

              <SectionCard title="Document Status" pad="none" action={<a onClick={() => setTab('Documents')} style={{ cursor: 'pointer' }}>View all documents</a>}>
                {documents.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--tk-line)' }}>
                    <Icon name="file-text" size={16} color="var(--tk-blue)" />
                    <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
                    <span className="tk-meta">{d.validity}</span>
                    <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
                  </div>
                ))}
              </SectionCard>
            </div>

            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Performance Snapshot"
                action={<span style={{ position: 'relative' }}>
                  <Button variant="outline" size="sm" iconRight="chevron-down" onClick={() => setPeriodOpen((o) => !o)}>{period}</Button>
                  {periodOpen && (
                    <span style={{ position: 'absolute', right: 0, top: 36, zIndex: 30 }}>
                      <DropdownMenu width={160} items={['Last 7 days', 'Last 30 days', 'Last 90 days'].map((p) => ({
                        label: p, icon: p === period ? 'check' : undefined, onClick: () => { setPeriod(p); setPeriodOpen(false); } }))} />
                    </span>
                  )}
                </span>}>
                <div className="cd-perf-grid">
                  {PERFORMANCE.map((p) => (
                    <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-success-soft)', color: 'var(--tk-success)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                        <Icon name={p.icon} size={16} />
                      </span>
                      <div style={{ display: 'grid', gap: 1 }}>
                        <span className="tk-meta">{p.label}</span>
                        <strong style={{ font: '700 17px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{p.value}</strong>
                        <span style={{ font: '500 11px/15px var(--tk-font-sans)', color: p.delta ? 'var(--tk-success)' : 'var(--tk-ink-400)' }}>
                          {p.delta ? `↑ ${p.delta} ${p.caption}` : p.caption}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <QuickActionsCard items={[
                { icon: 'message-square', label: 'Send Message', hint: 'Message the company contact', onClick: () => setMessageOpen(true) },
                { icon: 'shield-check', label: 'Assign Compliance Review', hint: 'Review documents & compliance', onClick: () => { setTab('Compliance'); notify('info', 'Compliance review assigned.'); } },
                { icon: 'chart-column', label: 'View Performance Report', hint: 'Detailed performance analytics', onClick: () => setTab('Performance') },
                { icon: 'circle-alert', label: status === 'Suspended' ? 'Reactivate Company' : 'Suspend Company', hint: status === 'Suspended' ? 'Restore normal operations' : 'Temporarily suspend operations', onClick: () => setSuspendOpen(true) },
              ]} />

              <SectionCard title="Recent Activity" action={<a onClick={() => setTab('Activity Log')} style={{ cursor: 'pointer' }}>View all activity</a>}>
                <Timeline items={activity.slice(0, 5).map((a) => ({ title: a.text, time: a.time, state: 'current' }))} />
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {tab === 'Trucks (45)' && (
        <SectionCard title="Fleet" count={TRUCKS.length} pad="none">
          <DataTable rows={TRUCKS} rowKey={(r) => r.plate}
            columns={[
              { key: 'plate', header: 'Plate Number', render: (r) => <span className="tk-mono">{r.plate}</span> },
              { key: 'type', header: 'Truck Type' },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={TRUCK_STATUS_TONE[r.status]}>{r.status}</Badge> },
              { key: 'driver', header: 'Assigned Driver' },
              { key: 'trips', header: 'Trips (30d)', align: 'right' },
            ]} />
        </SectionCard>
      )}

      {tab === 'Drivers (78)' && (
        <SectionCard title="Drivers" count={DRIVERS.length} pad="none">
          <DataTable rows={DRIVERS} rowKey={(r) => r.name}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'license', header: 'License Class' },
              { key: 'status', header: 'Status', render: (r) => <Badge tone={DRIVER_STATUS_TONE[r.status]}>{r.status}</Badge> },
              { key: 'trips', header: 'Trips (30d)', align: 'right' },
            ]} />
        </SectionCard>
      )}

      {tab === 'Performance' && (
        <SectionCard title="Performance Snapshot"
          action={<span style={{ position: 'relative' }}>
            <Button variant="outline" size="sm" iconRight="chevron-down" onClick={() => setPeriodOpen((o) => !o)}>{period}</Button>
            {periodOpen && (
              <span style={{ position: 'absolute', right: 0, top: 36, zIndex: 30 }}>
                <DropdownMenu width={160} items={['Last 7 days', 'Last 30 days', 'Last 90 days'].map((p) => ({
                  label: p, icon: p === period ? 'check' : undefined, onClick: () => { setPeriod(p); setPeriodOpen(false); } }))} />
              </span>
            )}
          </span>}>
          <div className="cd-perf-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
            {PERFORMANCE.map((p) => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 0' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-success-soft)', color: 'var(--tk-success)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                  <Icon name={p.icon} size={18} />
                </span>
                <div style={{ display: 'grid', gap: 1 }}>
                  <span className="tk-meta">{p.label}</span>
                  <strong style={{ font: '700 20px/26px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{p.value}</strong>
                  <span style={{ font: '500 11px/15px var(--tk-font-sans)', color: p.delta ? 'var(--tk-success)' : 'var(--tk-ink-400)' }}>
                    {p.delta ? `↑ ${p.delta} ${p.caption}` : p.caption}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === 'Documents' && (
        <SectionCard title="Documents" count={documents.length} pad="none">
          {documents.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--tk-line)' }}>
              <Icon name="file-text" size={18} color="var(--tk-blue)" />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
              <span className="tk-meta">{d.validity}</span>
              <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
              {d.status === 'Expiring Soon' && (
                <Button size="sm" variant="outline" onClick={() => markDocument(d.id, 'Valid')}>Mark Renewed</Button>
              )}
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Compliance' && (
        <SectionCard title="Compliance Checklist">
          {COMPLIANCE_CHECKS.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--tk-line)' }}>
              <Icon name={c.status === 'Compliant' ? 'badge-check' : 'triangle-alert'} size={17} color={c.status === 'Compliant' ? 'var(--tk-success)' : 'var(--tk-warning)'} />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.label}</span>
              <Badge tone={c.status === 'Compliant' ? 'success' : 'warning'}>{c.status}</Badge>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Activity Log' && (
        <SectionCard title="Activity Log">
          <Timeline items={activity.map((a) => ({ title: a.text, time: a.time, state: 'current' }))} />
        </SectionCard>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Company" description="Update company contact information."
        footer={<><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={saveEdit}>Save Changes</Button></>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField label="Company Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <TextField label="Phone Number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <TextField label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      <Modal open={messageOpen} onClose={() => setMessageOpen(false)} title="Send Message" description={`To ${company.contactPerson} · ${company.contactEmail}`}
        footer={<><Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button><Button icon="send" disabled={!message.trim()} onClick={sendMessage}>Send Message</Button></>}>
        <Textarea label="Message" rows={5} placeholder={`Write a message to ${company.contactPerson}...`} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Modal>

      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title={status === 'Suspended' ? 'Reactivate Company' : 'Suspend Company'}
        description={status === 'Suspended' ? `Restore ${company.name} to active operations?` : `Temporarily suspend ${company.name}'s operations?`}
        footer={<><Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
          <Button variant={status === 'Suspended' ? 'primary' : 'danger'} icon={status === 'Suspended' ? 'circle-check' : 'circle-alert'} onClick={toggleSuspend}>
            {status === 'Suspended' ? 'Reactivate' : 'Suspend Company'}
          </Button></>}>
        <span className="tk-meta">{status === 'Suspended' ? 'The company will regain access to dispatch new jobs immediately.' : 'The company will not be able to receive new job assignments until reactivated.'}</span>
      </Modal>
    </div>
  );
}
