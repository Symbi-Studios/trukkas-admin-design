'use client';

import { useState } from 'react';
import { useNavigate } from '../router.js';
import {
  Button, Badge, SectionCard, LabelValue, Breadcrumbs, DropdownMenu, DataTable, Tabs,
  Timeline, QuickActionsCard, Icon, Avatar, ProgressBar, Pagination, EmptyState, StatCard,
} from '../ds.js';
import './DriverDetail.css';

const DRIVER = {
  name: 'Ahmed Musa', status: 'Active', phone: '0803 123 4567', id: 'DRV-2026-00124',
  company: 'Global Haulage Ltd', email: 'ahmed.musa@email.com', license: 'LAS/DRV/20/123456',
  joined: 'Feb 10, 2025', dob: 'May 12, 1988 (36 years)', nationality: 'Nigerian',
  gender: 'Male', stateOfOrigin: 'Kano State', bloodGroup: 'O+', maritalStatus: 'Married',
  language: 'Hausa, English', employmentType: 'Full Time', emergencyContact: 'Hauwa Musa (Wife)',
  emergencyPhone: '0812 345 6789', address: '12 Unity Estate, Ipeja, Lagos State, Nigeria',
};

const DOCUMENTS = [
  { id: 'd1', name: "Driver's License", detail: 'LAS/DRV/20/123456', status: 'Verified', expiry: 'Dec 15, 2026', icon: 'file-text' },
  { id: 'd2', name: 'National ID Card', detail: 'NIN: 1234 5678 9012', status: 'Verified', expiry: 'Dec 31, 2026', icon: 'file-text' },
  { id: 'd3', name: 'Passport Photograph', detail: null, status: 'Verified', expiry: 'Dec 31, 2026', icon: 'file-text' },
  { id: 'd4', name: 'Medical Report', detail: null, status: 'Verified', expiry: 'Jun 20, 2026', icon: 'shield-check' },
  { id: 'd5', name: 'Police Clearance', detail: null, status: 'Verified', expiry: 'Nov 10, 2026', icon: 'shield-check' },
  { id: 'd6', name: 'Driving Experience', detail: '8 years', status: 'Verified', expiry: null, icon: 'badge-check' },
];

const VEHICLES = [
  { id: 'v1', name: 'Volvo FH16 2020', plate: 'LAG 234 XY', type: '40ft High Cube', capacity: '30,000 kg', status: 'Active', assigned: 'Feb 10, 2025' },
  { id: 'v2', name: 'Mercedes Actros 2019', plate: 'LAG 912 AB', type: '40ft Standard', capacity: '28,000 kg', status: 'Active', assigned: 'Mar 5, 2025' },
  { id: 'v3', name: 'MAN TGS 2021', plate: 'KJA 781 GH', type: '20ft Standard', capacity: '20,000 kg', status: 'Inactive', assigned: 'Dec 12, 2024' },
];

const TRIPS = [
  { id: 'TRK-2026-0456', route: 'Lagos → Kano', cargo: 'MSCU 1234567 (40ft HC)', status: 'Completed', departed: 'May 5, 2026', delivered: 'May 7, 2026', distance: '1,285 km', earnings: 850000 },
  { id: 'TRK-2026-0448', route: 'Kano → Kaduna', cargo: 'TCLU 9876543 (20ft DC)', status: 'Completed', departed: 'May 2, 2026', delivered: 'May 3, 2026', distance: '213 km', earnings: 320000 },
  { id: 'TRK-2026-0441', route: 'Kaduna → Lagos', cargo: 'MSKU 5678912 (40ft HC)', status: 'In Transit', departed: 'Apr 30, 2026', delivered: '—', distance: '1,285 km', earnings: 900000 },
  { id: 'TRK-2026-0432', route: 'Lagos → Onne', cargo: 'APZU 1239876 (20ft)', status: 'Completed', departed: 'Apr 28, 2026', delivered: 'Apr 29, 2026', distance: '475 km', earnings: 750000 },
  { id: 'TRK-2026-0425', route: 'Onne → Port Harcourt', cargo: 'TCNU 7654321 (20ft)', status: 'Completed', departed: 'Apr 25, 2026', delivered: 'Apr 25, 2026', distance: '90 km', earnings: 180000 },
];

const SUMMARY = [
  { icon: 'route', tint: 'blue', label: 'Total Trips', value: '84', delta: '12%', caption: 'vs last 30 days' },
  { icon: 'circle-check', tint: 'green', label: 'Completed Trips', value: '78', caption: '92.9% completion rate' },
  { icon: 'truck', tint: 'green', label: 'Total Distance', value: '42,560 km', delta: '15%', caption: 'vs last 30 days' },
  { icon: 'wallet', tint: 'amber', label: 'Total Earnings', value: '₦4,250,000', delta: '18%', caption: 'vs last 30 days' },
  { icon: 'shield-check', tint: 'red', label: 'Average Rating', value: '4.7 / 5', caption: 'Based on 56 reviews' },
  { icon: 'shield-alert', tint: 'red', label: 'Accident / Incidents', value: '0', caption: 'Last 12 months' },
];

const PERFORMANCE = [
  { label: 'On-time Delivery', value: 92, display: '92%', color: 'var(--tk-blue)' },
  { label: 'Safety Score', value: 98, display: '98%', color: 'var(--tk-success)' },
  { label: 'Customer Rating', value: 94, display: '4.7 / 5', color: 'var(--tk-blue)' },
  { label: 'Document Compliance', value: 100, display: '100%', color: 'var(--tk-success)' },
];

const ACTIVITY = [
  { title: 'Trip TRK-2026-0456 delivered', time: 'May 7, 2026 04:10 PM', state: 'done', icon: 'check' },
  { title: 'Vehicle Volvo FH16 2020 reassigned', time: 'Feb 10, 2025 09:00 AM', state: 'current', icon: 'truck' },
  { title: 'Medical report renewed and verified', time: 'Jun 21, 2025 11:20 AM', state: 'done', icon: 'shield-check' },
  { title: 'Driver profile created', time: 'Feb 10, 2025 08:45 AM', state: 'done', icon: 'user' },
];

const STATUS_TONE = { Completed: 'success', 'In Transit': 'info', Active: 'success', Inactive: 'neutral' };
const TAB_ITEMS = ['Overview', 'Trips & Activity', 'Performance', 'Documents', 'Vehicles Assigned', 'Incidents', 'Payouts', 'Activity Log'];
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

function VehiclesTable({ rows }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id}
      columns={[
        { key: 'name', header: 'Truck / Vehicle', render: (r) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="truck" size={15} color="var(--tk-blue)" />
            <a style={{ color: 'var(--tk-blue)', font: '600 13px/18px var(--tk-font-sans)', cursor: 'pointer' }}>{r.name}</a>
          </span>) },
        { key: 'plate', header: 'Plate Number', render: (r) => <span className="tk-mono">{r.plate}</span> },
        { key: 'type', header: 'Truck Type' },
        { key: 'capacity', header: 'Capacity' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
        { key: 'assigned', header: 'Assigned On' },
      ]} />
  );
}

function TripsTable({ rows }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id}
      columns={[
        { key: 'id', header: 'Trip ID', render: (r) => <a style={{ color: 'var(--tk-blue)', font: '600 13px/18px var(--tk-font-sans)', cursor: 'pointer' }}>{r.id}</a> },
        { key: 'route', header: 'Route' },
        { key: 'cargo', header: 'Container / Cargo' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
        { key: 'departed', header: 'Departed' },
        { key: 'delivered', header: 'Delivered' },
        { key: 'distance', header: 'Distance' },
        { key: 'earnings', header: 'Earnings', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.earnings)}</strong> },
        { key: 'x', header: '', width: 40, render: () => <Icon name="eye" size={15} color="var(--tk-ink-300)" /> },
      ]} />
  );
}

export function DriverDetail() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(1);

  const initials = DRIVER.name.split(' ').map((w) => w[0]).slice(0, 2).join('');

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <div className="dd-head">
        <Breadcrumbs items={[
          { label: 'Truck Companies', onClick: () => navigate('/companies') },
          { label: DRIVER.company, onClick: () => navigate('/companies') },
          { label: 'Drivers', onClick: () => navigate('/drivers') },
          'Driver Details',
        ]} />
      </div>

      <div className="dd-identity">
        <div className="dd-identity-left">
          <div className="dd-avatar-col">
            <Avatar name={DRIVER.name} size={88} />
            <span className="dd-online-dot" />
            <Badge tone="success" dot>{DRIVER.status}</Badge>
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="tk-display" style={{ fontSize: 24 }}>{DRIVER.name}</h1>
              <Badge tone="success" dot>{DRIVER.status}</Badge>
            </div>
            <div className="dd-fact-row" style={{ marginTop: 4 }}>
              <span className="dd-fact"><Icon name="phone" size={14} color="var(--tk-ink-300)" />{DRIVER.phone}</span>
              <span className="dd-fact"><Icon name="badge-check" size={14} color="var(--tk-ink-300)" />Driver ID: <b>{DRIVER.id}</b></span>
              <span className="dd-fact">Company: <b>{DRIVER.company}</b></span>
            </div>
            <div className="dd-fact-row" style={{ marginTop: 0 }}>
              <span className="dd-fact"><Icon name="file-text" size={14} color="var(--tk-ink-300)" />{DRIVER.email}</span>
              <span className="dd-fact"><Icon name="file-text" size={14} color="var(--tk-ink-300)" />License No: <b>{DRIVER.license}</b></span>
              <span className="dd-fact">Joined: <b>{DRIVER.joined}</b></span>
            </div>
          </div>
        </div>
        <div className="dd-head-actions">
          <Button variant="outline" icon="pencil">Edit Driver</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={[
                  { label: 'Export Driver Report', icon: 'download', onClick: () => setMoreOpen(false) },
                  { label: 'Print Profile', icon: 'file-text', onClick: () => { setMoreOpen(false); window.print(); } },
                  { divider: true },
                  { label: 'Suspend Driver', icon: 'user-x', tone: 'danger', onClick: () => setMoreOpen(false) },
                ]} />
              </span>
            )}
          </span>
          <Button icon="arrow-left" onClick={() => navigate('/drivers')}>Back to Drivers</Button>
        </div>
      </div>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <div className="dd-overview">
            <SectionCard title="Driver Information" pad="tight">
              <div className="dd-info-grid">
                <LabelValue layout="stack" label="Full Name" value={DRIVER.name} />
                <LabelValue layout="stack" label="Nationality" value={DRIVER.nationality} />
                <LabelValue layout="stack" label="Date of Birth" value={DRIVER.dob} />
                <LabelValue layout="stack" label="State of Origin" value={DRIVER.stateOfOrigin} />
                <LabelValue layout="stack" label="Gender" value={DRIVER.gender} />
                <LabelValue layout="stack" label="Blood Group" value={DRIVER.bloodGroup} />
                <LabelValue layout="stack" label="Phone Number" value={DRIVER.phone} />
                <LabelValue layout="stack" label="Marital Status" value={DRIVER.maritalStatus} />
                <LabelValue layout="stack" label="Email Address" value={DRIVER.email} />
                <LabelValue layout="stack" label="Language" value={DRIVER.language} />
                <LabelValue layout="stack" label="Emergency Contact" value={<>{DRIVER.emergencyContact}<br />{DRIVER.emergencyPhone}</>} />
                <LabelValue layout="stack" label="Employment Type" value={DRIVER.employmentType} />
                <LabelValue layout="stack" label="Home Address" value={DRIVER.address} style={{ gridColumn: '1 / -1' }} />
                <LabelValue layout="stack" label="Status" value={<Badge tone="success">{DRIVER.status}</Badge>} />
              </div>
            </SectionCard>

            <SectionCard title="Documents & Verification" pad="tight"
              action={<a onClick={() => setTab('Documents')} style={{ cursor: 'pointer' }}>View all documents</a>}>
              <div>
                {DOCUMENTS.map((d) => (
                  <div key={d.id} className="dd-doc-row">
                    <Icon name={d.icon} size={17} color="var(--tk-blue)" />
                    <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                      <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
                      {d.detail && <span className="tk-meta">{d.detail}</span>}
                    </span>
                    <Badge tone="success">{d.status}</Badge>
                    <span className="tk-meta" style={{ width: 108, textAlign: 'right' }}>
                      {d.expiry ? `Expiry: ${d.expiry}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Driver Summary" pad="tight">
                <div className="dd-summary-grid">
                  {SUMMARY.map((s) => (
                    <StatCard key={s.label} icon={s.icon} tint={s.tint} label={s.label} value={s.value}
                      delta={s.delta} caption={s.caption} style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Performance Overview">
                <div className="dd-perf-grid">
                  {PERFORMANCE.map((p) => (
                    <ProgressBar key={p.label} value={p.value} color={p.color} label={p.label} caption={p.display} />
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <a onClick={() => setTab('Performance')} style={{ cursor: 'pointer' }}>View detailed performance →</a>
                </div>
              </SectionCard>

              <QuickActionsCard items={[
                { icon: 'message-square', label: 'Send Message', hint: 'Message this driver' },
                { icon: 'route', label: 'Assign to Trip', hint: 'Assign driver to a new trip' },
                { icon: 'wallet', label: 'View Payouts', hint: 'View driver payout history', onClick: () => setTab('Payouts') },
                { icon: 'circle-alert', label: 'Report an Issue', hint: 'Report incident or concern', onClick: () => setTab('Incidents') },
              ]} />
            </div>
          </div>

          <SectionCard title="Vehicles Assigned" pad="none" count={VEHICLES.length}>
            <VehiclesTable rows={VEHICLES} />
          </SectionCard>

          <SectionCard title="Recent Trips" pad="none"
            action={<a onClick={() => setTab('Trips & Activity')} style={{ cursor: 'pointer' }}>View all trips</a>}
            footer={<Pagination page={page} pageCount={17} pageSize={5} total={84} onPage={setPage} onPageSize={() => {}} style={{ border: 0, padding: 0 }} />}>
            <TripsTable rows={TRIPS} />
          </SectionCard>
        </>
      )}

      {tab === 'Trips & Activity' && (
        <SectionCard title="Trips & Activity" pad="none" count={84}
          footer={<Pagination page={page} pageCount={17} pageSize={5} total={84} onPage={setPage} onPageSize={() => {}} style={{ border: 0, padding: 0 }} />}>
          <TripsTable rows={TRIPS} />
        </SectionCard>
      )}

      {tab === 'Performance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--tk-space-4)' }}>
          {SUMMARY.map((s) => (
            <StatCard key={s.label} icon={s.icon} tint={s.tint} label={s.label} value={s.value}
              delta={s.delta} caption={s.caption} />
          ))}
          <SectionCard title="Performance Overview" style={{ gridColumn: '1 / -1' }}>
            <div className="dd-perf-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {PERFORMANCE.map((p) => (
                <ProgressBar key={p.label} value={p.value} color={p.color} label={p.label} caption={p.display} />
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'Documents' && (
        <SectionCard title="Documents & Verification" count={DOCUMENTS.length}>
          {DOCUMENTS.map((d) => (
            <div key={d.id} className="dd-doc-row">
              <Icon name={d.icon} size={17} color="var(--tk-blue)" />
              <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
                {d.detail && <span className="tk-meta">{d.detail}</span>}
              </span>
              <Badge tone="success">{d.status}</Badge>
              <span className="tk-meta" style={{ width: 130, textAlign: 'right' }}>
                {d.expiry ? `Expiry: ${d.expiry}` : ''}
              </span>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Vehicles Assigned' && (
        <SectionCard title="Vehicles Assigned" pad="none" count={VEHICLES.length}>
          <VehiclesTable rows={VEHICLES} />
        </SectionCard>
      )}

      {tab === 'Incidents' && (
        <SectionCard title="Incidents">
          <EmptyState icon="shield-check" title="No incidents on record"
            description="This driver has had no reported accidents or incidents in the last 12 months." />
        </SectionCard>
      )}

      {tab === 'Payouts' && (
        <SectionCard title="Payout History" pad="none" count={TRIPS.length}>
          <DataTable rows={TRIPS} rowKey={(r) => r.id}
            columns={[
              { key: 'id', header: 'Trip ID', render: (r) => <span className="tk-mono">{r.id}</span> },
              { key: 'departed', header: 'Trip Date' },
              { key: 'earnings', header: 'Amount', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.earnings)}</strong> },
              { key: 'status', header: 'Payout Status', render: (r) => <Badge tone={r.status === 'Completed' ? 'success' : 'warning'}>{r.status === 'Completed' ? 'Paid' : 'Pending'}</Badge> },
            ]} />
        </SectionCard>
      )}

      {tab === 'Activity Log' && (
        <SectionCard title="Activity Log">
          <Timeline items={ACTIVITY} />
        </SectionCard>
      )}
    </div>
  );
}
