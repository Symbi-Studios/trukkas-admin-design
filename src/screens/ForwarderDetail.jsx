'use client';

import { useState } from 'react';
import { useNavigate } from '../router.js';
import {
  Button, Badge, Tag, SectionCard, LabelValue, Card, PageHeader, DropdownMenu, DataTable, Tabs,
  Timeline, QuickActionsCard, Icon, Avatar, EmptyState,
} from '../ds.js';
import './ForwarderDetail.css';

// A forwarder is an individual, not a company. isExporter marks a forwarder who
// additionally holds a valid export license.
const FORWARDER = {
  name: 'Michael Okafor', status: 'Active', customerId: 'FWD-000128', isExporter: true,
  jobs: 128, spend: 245680000, balance: 12450000, memberSince: 'Jan 15, 2024',
  lastActivity: 'May 8, 2026 10:45 AM',
  dob: 'Mar 22, 1985 (41 years)', gender: 'Male', nationality: 'Nigerian',
  nin: '2345 6789 0123', phone: '+234 803 123 4567', altPhone: '+234 809 876 5432',
  email: 'michael.okafor82@gmail.com', address: '12 Logistics Avenue, Apapa, Lagos State, Nigeria',
  license: 'FWD/LAS/2021/03456', licenseExpiry: 'Aug 12, 2027',
  exportLicense: 'EXP/NG/2022/01187', exportLicenseExpiry: 'Jan 30, 2027',
  yearsExperience: '9 years', languages: 'English, Igbo',
  services: ['Freight Forwarding', 'Customs Clearance', 'Container Haulage', 'Warehousing Coordination', 'Export Documentation'],
  coverage: 'Nigeria (Nationwide)', cargoTypes: 'General Cargo, Break-bulk, Containers, Machinery, Vehicles',
  routes: 'Apapa – Kano, Apapa – Port Harcourt, Apapa – Onne, Apapa – Kaduna',
  network: 'Coordinates with 15+ partner truck companies and 100+ trucks',
  other: 'Independent freight forwarder with a strong track record across nationwide haulage and export documentation, focused on safety, compliance and timely delivery.',
  emergencyContact: 'Ngozi Okafor (Wife)', emergencyPhone: '+234 812 345 6789',
  creditLimit: 50000000, lastPaymentDate: 'Apr 28, 2026', lastPaymentAmount: 35000000,
  outstandingCount: 2, outstandingAmount: 18450000, paymentTerms: '30 Days',
};

const SERVICE_AREAS = [
  { name: 'Lagos (Base)', state: 'Lagos State, Nigeria' },
  { name: 'Port Harcourt', state: 'Rivers State, Nigeria' },
  { name: 'Kano', state: 'Kano State, Nigeria' },
];

const JOBS = [
  { id: 'JB-2026-0842', cargo: 'General Cargo', route: 'Apapa Port → Kano', status: 'In Transit', date: 'May 8, 2026', amount: 36450000 },
  { id: 'JB-2026-0784', cargo: 'Break-bulk', route: 'Apapa Port → Port Harcourt', status: 'Delivered', date: 'Apr 30, 2026', amount: 28760000 },
  { id: 'JB-2026-0711', cargo: 'Machinery', route: 'Lagos → Kaduna', status: 'Completed', date: 'Apr 22, 2026', amount: 24180000 },
  { id: 'JB-2026-0662', cargo: 'General Cargo', route: 'Apapa Port → Onne Port', status: 'Completed', date: 'Apr 15, 2026', amount: 19850000 },
  { id: 'JB-2026-0591', cargo: 'Containers', route: 'Apapa Port → Kano', status: 'Completed', date: 'Apr 5, 2026', amount: 42500000 },
];

const NOTES = [
  { text: 'Credit limit increased to ₦50,000,000', author: 'Trukkas Admin', time: 'Apr 20, 2026 02:15 PM' },
  { text: 'Requested additional trucks for the Kano route', author: 'Michael Okafor', time: 'Apr 12, 2026 11:35 AM' },
  { text: 'Export license re-verified', author: 'Trukkas Admin', time: 'Mar 28, 2026 09:10 AM' },
];

const DOCUMENTS = [
  { id: 'd1', name: 'National ID Card', validity: 'NIN: 2345 6789 0123', status: 'Valid' },
  { id: 'd2', name: 'Passport Photograph', validity: 'Verified on file', status: 'Valid' },
  { id: 'd3', name: 'Freight Forwarding License', validity: 'Valid until Aug 12, 2027', status: 'Valid' },
  { id: 'd4', name: 'Export License', validity: 'Valid until Jan 30, 2027', status: 'Valid' },
  { id: 'd5', name: 'Proof of Address', validity: 'Valid until Sept 5, 2026', status: 'Expiring Soon' },
];
const DOC_TONE = { Valid: 'success', 'Expiring Soon': 'warning', Expired: 'danger' };

const ACTIVITY = [
  { title: 'Credit limit increased to ₦50,000,000', time: 'Apr 20, 2026 02:15 PM', state: 'done', icon: 'wallet' },
  { title: 'Job JB-2026-0842 dispatched', time: 'May 8, 2026 09:20 AM', state: 'current', icon: 'route' },
  { title: 'Export license re-verified', time: 'Mar 28, 2026 09:10 AM', state: 'done', icon: 'ship' },
  { title: 'Forwarder profile onboarded', time: 'Jan 15, 2024 10:00 AM', state: 'done', icon: 'user' },
];

const VERIFICATION_CHECKS = [
  { label: 'National ID Verification', status: 'Verified' },
  { label: 'Freight Forwarding License', status: 'Verified' },
  { label: 'Export License', status: 'Verified' },
  { label: 'Bank Account Verification', status: 'Verified' },
  { label: 'Address Verification', status: 'Verified' },
  { label: 'Background Check', status: 'Review Needed' },
];

const PERFORMANCE = [
  { icon: 'route', label: 'Total Jobs', value: '128', delta: '18%', caption: 'vs last 30 days' },
  { icon: 'circle-check', label: 'Completed Jobs', value: '119', caption: '93% completion rate' },
  { icon: 'timer', label: 'On-Time Delivery', value: '94%', delta: '6%', caption: 'vs last 30 days' },
  { icon: 'wallet', label: 'Total Spend', value: '₦245.7M', delta: '23%', caption: 'vs last 30 days' },
  { icon: 'shield-check', label: 'Payment Reliability', value: '98%', caption: 'On-time settlements' },
  { icon: 'star', label: 'Partner Rating', value: '4.8 / 5', caption: 'Based on 42 reviews' },
];

const JOB_TONE = { 'In Transit': 'info', Delivered: 'success', Completed: 'success' };
const TAB_ITEMS = ['Overview', 'Personal Information', 'Verification', 'Banking & Financial', 'Performance', 'Jobs & Shipments', 'Documents', 'Activity Log', 'Notes'];
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

function JobsTable({ rows }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.id}
      columns={[
        { key: 'id', header: 'Job ID', render: (r) => <a style={{ color: 'var(--tk-blue)', font: '600 13px/18px var(--tk-font-sans)', cursor: 'pointer' }}>{r.id}</a> },
        { key: 'cargo', header: 'Cargo Type' },
        { key: 'route', header: 'Origin → Destination' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={JOB_TONE[r.status]}>{r.status}</Badge> },
        { key: 'date', header: 'Job Date' },
        { key: 'amount', header: 'Amount (₦)', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.amount)}</strong> },
      ]} />
  );
}

export function ForwarderDetail() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Overview');
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <PageHeader
        crumbs={[
          { label: 'Forwarders / Exporters', onClick: () => navigate('/forwarders') },
          FORWARDER.name,
        ]}
        title="Forwarder Details"
        description="Review the forwarder profile, verification, jobs, financial standing and activity."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/forwarders')}>Back to Forwarders</Button>
          <Button icon="pencil">Edit Forwarder</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={220} items={[
                  { label: 'Export Forwarder Report', icon: 'download', onClick: () => setMoreOpen(false) },
                  { label: 'Print Profile', icon: 'file-text', onClick: () => { setMoreOpen(false); window.print(); } },
                  { label: 'View Audit Log', icon: 'scroll-text', onClick: () => { setMoreOpen(false); setTab('Activity Log'); } },
                  { divider: true },
                  { label: 'Suspend Forwarder', icon: 'circle-alert', tone: 'danger', onClick: () => setMoreOpen(false) },
                ]} />
              </span>
            )}
          </span>
        </>}
      />

      <Card>
        <div className="fd-identity">
          <Avatar name={FORWARDER.name} size={56} />
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title">{FORWARDER.name}</h2>
              <Badge tone="success">{FORWARDER.status}</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Tag>Forwarder</Tag>
              {FORWARDER.isExporter && <Tag tone="teal" icon={<Icon name="ship" size={11} />}>Exporter</Tag>}
              <span className="tk-meta">Customer ID: {FORWARDER.customerId}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--tk-line)', marginTop: 18, paddingTop: 16 }}>
          {[
            { label: 'Status', value: <Badge tone="success">{FORWARDER.status}</Badge> },
            { label: 'Verification Status', value: <Badge tone="success">Verified</Badge> },
            { label: 'Total Jobs', value: FORWARDER.jobs },
            { label: 'Total Spend (₦)', value: naira(FORWARDER.spend) },
            { label: 'Current Balance (₦)', value: naira(FORWARDER.balance), hint: 'Available credit' },
            { label: 'Member Since', value: FORWARDER.memberSince },
            { label: 'Last Activity', value: FORWARDER.lastActivity },
          ].map((f, i) => (
            <div key={f.label} style={{ flex: '1 1 140px', padding: '0 18px', borderLeft: i ? '1px solid var(--tk-line)' : 'none' }}>
              <div className="tk-meta" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                {f.label}{f.hint && <Icon name="info" size={12} color="var(--tk-ink-300)" />}
              </div>
              <div style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <>
          <div className="fd-main">
            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Personal Information" icon="user">
                <div className="fd-info-grid">
                  <LabelValue layout="stack" label="Full Name" value={FORWARDER.name} />
                  <LabelValue layout="stack" label="Date of Birth" value={FORWARDER.dob} />
                  <LabelValue layout="stack" label="Gender" value={FORWARDER.gender} />
                  <LabelValue layout="stack" label="Nationality" value={FORWARDER.nationality} />
                  <LabelValue layout="stack" label="National ID (NIN)" value={FORWARDER.nin} />
                  <LabelValue layout="stack" label="Language(s)" value={FORWARDER.languages} />
                  <LabelValue layout="stack" label="Phone" value={FORWARDER.phone} />
                  <LabelValue layout="stack" label="Alt Phone" value={FORWARDER.altPhone} />
                  <LabelValue layout="stack" label="Email" value={FORWARDER.email} />
                  <LabelValue layout="stack" label="Years of Experience" value={FORWARDER.yearsExperience} />
                  <LabelValue layout="stack" label="Forwarding License No." value={FORWARDER.license} />
                  <LabelValue layout="stack" label="License Expiry" value={FORWARDER.licenseExpiry} />
                  {FORWARDER.isExporter && (
                    <>
                      <LabelValue layout="stack" label="Export License No." value={FORWARDER.exportLicense} />
                      <LabelValue layout="stack" label="Export License Expiry" value={FORWARDER.exportLicenseExpiry} />
                    </>
                  )}
                  <LabelValue layout="stack" label="Home Address" value={FORWARDER.address} style={{ gridColumn: '1 / -1' }} />
                </div>
              </SectionCard>

              <SectionCard title="Business & Service Details" icon="briefcase-business">
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <span className="tk-meta" style={{ display: 'block', marginBottom: 6 }}>Services Offered</span>
                    <div className="fd-tag-row">
                      {FORWARDER.services.map((s) => <Tag key={s} tone="blue">{s}</Tag>)}
                    </div>
                  </div>
                  <LabelValue label="Coverage Area" value={FORWARDER.coverage} />
                  <LabelValue label="Preferred Cargo Types" value={FORWARDER.cargoTypes} />
                  <LabelValue label="Preferred Routes" value={FORWARDER.routes} />
                  <LabelValue label="Partner Network" value={FORWARDER.network} />
                  <div>
                    <span className="tk-meta" style={{ display: 'block', marginBottom: 4 }}>Other Information</span>
                    <p style={{ margin: 0, font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{FORWARDER.other}</p>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Emergency Contact" icon="user">
                <LabelValue label="Name" value={FORWARDER.emergencyContact} />
                <LabelValue label="Phone" value={FORWARDER.emergencyPhone} />
              </SectionCard>

              <SectionCard title="Account Summary" icon="wallet">
                <LabelValue label="Current Balance" value={naira(FORWARDER.balance)} />
                <LabelValue label="Credit Limit" value={naira(FORWARDER.creditLimit)} />
                <LabelValue label="Available Credit" value={naira(FORWARDER.creditLimit - FORWARDER.balance)} />
                <LabelValue label="Payment Terms" value={FORWARDER.paymentTerms} />
                <LabelValue label="Last Payment" value={`${FORWARDER.lastPaymentDate} · ${naira(FORWARDER.lastPaymentAmount)}`} />
                <LabelValue label="Outstanding Invoices" value={`${FORWARDER.outstandingCount} · ${naira(FORWARDER.outstandingAmount)}`} />
                <Button variant="outline" icon="chart-column" fullWidth style={{ marginTop: 10 }} onClick={() => setTab('Banking & Financial')}>
                  View Financial Overview →
                </Button>
              </SectionCard>
            </div>

            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Address & Service Areas" icon="map-pin">
                <span className="tk-meta" style={{ display: 'block', marginBottom: 4 }}>Base Address</span>
                <p style={{ margin: '0 0 8px', font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{FORWARDER.address}</p>
                <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="map-pin" size={13} />View on Map
                </a>
                <div style={{ marginTop: 14, borderTop: '1px solid var(--tk-line)', paddingTop: 10 }}>
                  <span className="tk-meta" style={{ display: 'block', marginBottom: 6 }}>Also Active In ({SERVICE_AREAS.length - 1})</span>
                  {SERVICE_AREAS.map((b, i) => (
                    <div key={b.name} className="fd-row" style={{ borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
                      <Icon name="map-pin" size={15} color="var(--tk-blue)" />
                      <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                        <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{b.name}</span>
                        <span className="tk-meta">{b.state}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <QuickActionsCard items={[
                { icon: 'plus', label: 'Create Job for this Forwarder', onClick: () => setTab('Jobs & Shipments') },
                { icon: 'shield-check', label: 'Add Verification Request', onClick: () => setTab('Verification') },
                { icon: 'megaphone', label: 'Send Announcement' },
                { icon: 'file-text', label: 'Add Note', onClick: () => setTab('Notes') },
                { icon: 'download', label: 'Download Forwarder Profile' },
              ]} />
            </div>
          </div>

          <div className="fd-bottom">
            <SectionCard title="Recent Jobs" pad="none" action={<a onClick={() => setTab('Jobs & Shipments')} style={{ cursor: 'pointer' }}>View all jobs →</a>}>
              <JobsTable rows={JOBS} />
            </SectionCard>

            <SectionCard title="Notes" action={<a onClick={() => setTab('Notes')} style={{ cursor: 'pointer' }}>View all notes →</a>}>
              {NOTES.map((n, i) => (
                <div key={i} style={{ padding: i ? '10px 0' : '0 0 10px', borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
                  <p style={{ margin: '0 0 4px', font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{n.text}</p>
                  <span className="tk-meta">{n.author} · {n.time}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        </>
      )}

      {tab === 'Personal Information' && (
        <div className="fd-bottom">
          <SectionCard title="Personal Information" icon="user">
            <div className="fd-info-grid">
              <LabelValue layout="stack" label="Full Name" value={FORWARDER.name} />
              <LabelValue layout="stack" label="Date of Birth" value={FORWARDER.dob} />
              <LabelValue layout="stack" label="Gender" value={FORWARDER.gender} />
              <LabelValue layout="stack" label="Nationality" value={FORWARDER.nationality} />
              <LabelValue layout="stack" label="National ID (NIN)" value={FORWARDER.nin} />
              <LabelValue layout="stack" label="Years of Experience" value={FORWARDER.yearsExperience} />
            </div>
          </SectionCard>
          <SectionCard title="Contact Details" icon="phone">
            <LabelValue label="Phone" value={FORWARDER.phone} />
            <LabelValue label="Alt Phone" value={FORWARDER.altPhone} />
            <LabelValue label="Email" value={FORWARDER.email} />
            <LabelValue label="Address" value={FORWARDER.address} />
            <LabelValue label="Emergency Contact" value={`${FORWARDER.emergencyContact} · ${FORWARDER.emergencyPhone}`} />
          </SectionCard>
        </div>
      )}

      {tab === 'Verification' && (
        <SectionCard title="Verification Checklist">
          {VERIFICATION_CHECKS.map((c) => (
            <div key={c.label} className="fd-row">
              <Icon name={c.status === 'Verified' ? 'badge-check' : 'triangle-alert'} size={17}
                color={c.status === 'Verified' ? 'var(--tk-success)' : 'var(--tk-warning)'} />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.label}</span>
              <Badge tone={c.status === 'Verified' ? 'success' : 'warning'}>{c.status}</Badge>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Banking & Financial' && (
        <SectionCard title="Account Summary" icon="wallet">
          <div className="fd-info-grid">
            <LabelValue layout="stack" label="Current Balance" value={naira(FORWARDER.balance)} />
            <LabelValue layout="stack" label="Credit Limit" value={naira(FORWARDER.creditLimit)} />
            <LabelValue layout="stack" label="Available Credit" value={naira(FORWARDER.creditLimit - FORWARDER.balance)} />
            <LabelValue layout="stack" label="Payment Terms" value={FORWARDER.paymentTerms} />
            <LabelValue layout="stack" label="Last Payment" value={`${FORWARDER.lastPaymentDate} · ${naira(FORWARDER.lastPaymentAmount)}`} />
            <LabelValue layout="stack" label="Outstanding Invoices" value={`${FORWARDER.outstandingCount} · ${naira(FORWARDER.outstandingAmount)}`} />
          </div>
        </SectionCard>
      )}

      {tab === 'Performance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
          {PERFORMANCE.map((p) => (
            <Card key={p.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-success-soft)',
                             color: 'var(--tk-success)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <Icon name={p.icon} size={18} />
              </span>
              <div style={{ display: 'grid', gap: 1 }}>
                <span className="tk-meta">{p.label}</span>
                <strong style={{ font: '700 20px/26px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{p.value}</strong>
                <span style={{ font: '500 11px/15px var(--tk-font-sans)', color: p.delta ? 'var(--tk-success)' : 'var(--tk-ink-400)' }}>
                  {p.delta ? `↑ ${p.delta} ${p.caption}` : p.caption}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'Jobs & Shipments' && (
        <SectionCard title="Jobs & Shipments" pad="none" count={JOBS.length}>
          <JobsTable rows={JOBS} />
        </SectionCard>
      )}

      {tab === 'Documents' && (
        <SectionCard title="Documents" count={DOCUMENTS.length}>
          {DOCUMENTS.map((d) => (
            <div key={d.id} className="fd-row">
              <Icon name="file-text" size={17} color="var(--tk-blue)" />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
              <span className="tk-meta">{d.validity}</span>
              <Badge tone={DOC_TONE[d.status]}>{d.status}</Badge>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Activity Log' && (
        <SectionCard title="Activity Log">
          <Timeline items={ACTIVITY} />
        </SectionCard>
      )}

      {tab === 'Notes' && (
        NOTES.length ? (
          <SectionCard title="Notes" count={NOTES.length}>
            {NOTES.map((n, i) => (
              <div key={i} className="fd-row" style={{ alignItems: 'flex-start' }}>
                <Icon name="file-text" size={16} color="var(--tk-blue)" style={{ marginTop: 2 }} />
                <div>
                  <p style={{ margin: '0 0 4px', font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{n.text}</p>
                  <span className="tk-meta">{n.author} · {n.time}</span>
                </div>
              </div>
            ))}
          </SectionCard>
        ) : (
          <SectionCard title="Notes">
            <EmptyState icon="file-text" title="No notes yet" description="Notes added about this forwarder will appear here." />
          </SectionCard>
        )
      )}
    </div>
  );
}
