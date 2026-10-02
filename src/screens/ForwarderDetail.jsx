'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '../router.js';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  Button, Badge, Tag, SectionCard, LabelValue, Card, PageHeader, DropdownMenu, DataTable, Tabs,
  Timeline, QuickActionsCard, Icon, Avatar, EmptyState, Banner, Pagination,
} from '../ds.js';
import './ForwarderDetail.css';

import { forwarderMoney, forwarderError, forwarderVerification, useGetAdminForwarderProfileQuery, useGetAdminPendingExporterLicensesQuery, useGetAdminForwarderDestinationsQuery, useGetAdminForwarderJobsQuery, useGetAdminForwarderTransactionsQuery, useGetAdminForwarderActivityQuery } from '../store/features/forwarders/forwardersApi.js';
import { ForwarderDetailLoading } from './ForwardersLoading.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { ForwarderActionModal, ForwarderAnnouncementModal, downloadForwarderCsv } from './ForwarderActions.jsx';

function QueryError({ query, title = 'Unable to load data' }) {
  return <Banner tone="danger" title={title} action={<Button variant="outline" onClick={query.refetch}>Retry</Button>}>{forwarderError(query.error)}</Banner>;
}
const DOC_TONE = { Verified: 'success', Pending: 'warning', Rejected: 'danger' };

const JOB_TONE = { 'In Transit': 'info', Delivered: 'success', Completed: 'success' };
const TAB_ITEMS = ['Overview', 'Personal Information', 'Verification', 'Banking & Financial', 'Performance', 'Jobs & Shipments', 'Documents', 'Activity Log', 'Notes'];
const naira = forwarderMoney;

function JobsTable({ rows }) {
  if (!rows.length) return <EmptyState title="No jobs found" description="Jobs for this forwarder will appear here." />;
  return (
    <>{rows.some((row) => row.detailUnavailable) && <Banner>Some job details are unavailable. Cargo, amounts, and detail links are shown only for matching jobs.</Banner>}<DataTable rows={rows} rowKey={(r) => r.id}
      columns={[
        { key: 'id', header: 'Job ID', render: (r) => r.detailId ? <Link to={`/jobs/detail?id=${encodeURIComponent(r.detailId)}`}>{r.id}</Link> : <strong>{r.id || '—'}</strong> },
        { key: 'cargo', header: 'Cargo Type' },
        { key: 'route', header: 'Origin → Destination' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={JOB_TONE[r.status]}>{r.status}</Badge> },
        { key: 'date', header: 'Job Date' },
        { key: 'amount', header: 'Amount (₦)', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.amount)}</strong> },
      ]} /></>
  );
}

export function ForwarderDetail() {
  const navigate = useNavigate(), params = useParams(), search = useSearchParams();
  const id = search.get('id') || params.forwarderId || '';
  const requestedTab = search.get('tab');
  const canViewActivity = useSelector((state) => state.auth.admin?.role) === 'SUPER_ADMIN';
  const [tab, setTab] = useState('Overview');
  const [moreOpen, setMoreOpen] = useState(false);

  const [page, setPage] = useState(1), [jobTab, setJobTab] = useState('all'), [action, setAction] = useState(null), [announcement, setAnnouncement] = useState(false), [notice, setNotice] = useState(null);
  useEffect(() => { setTab(({ verification: 'Verification', documents: 'Documents', jobs: 'Jobs & Shipments' })[requestedTab] || 'Overview'); setPage(1); setJobTab('all'); setAction(null); setAnnouncement(false); setNotice(null); setMoreOpen(false); }, [id, requestedTab]);
  const profileQuery = useGetAdminForwarderProfileQuery(id, { skip: !id });
  const FORWARDER = profileQuery.currentData;
  const valid = FORWARDER?.role === 'FORWARDER';
  const destinationsQuery = useGetAdminForwarderDestinationsQuery(id, { skip: !valid || tab !== 'Overview' });
  const pendingQuery = useGetAdminPendingExporterLicensesQuery(undefined, { skip: !valid || !['Verification', 'Documents'].includes(tab) });
  const pendingLicense = !pendingQuery.error ? pendingQuery.currentData?.rows.find((row) => row.id === id) : null;
  const licenseStatus = pendingLicense?.status || FORWARDER?.exporterLicenseStatus || (FORWARDER?.isExporter ? 'VERIFIED' : null);
  const licenseUrl = pendingLicense?.url || FORWARDER?.exporterLicenseUrl;
  const jobsQuery = useGetAdminForwarderJobsQuery({ id, tab: tab === 'Jobs & Shipments' ? jobTab : 'all', page: tab === 'Jobs & Shipments' ? page : 1, limit: tab === 'Jobs & Shipments' ? 10 : 5 }, { skip: !valid || !['Overview', 'Jobs & Shipments'].includes(tab) });
  const completedQuery = useGetAdminForwarderJobsQuery({ id, tab: 'completed', page: 1, limit: 1 }, { skip: !valid || tab !== 'Performance' });
  const transactionsQuery = useGetAdminForwarderTransactionsQuery({ id, page, limit: 10 }, { skip: !valid || tab !== 'Banking & Financial' });
  const activityQuery = useGetAdminForwarderActivityQuery(id, { skip: !valid || !canViewActivity || tab !== 'Activity Log' });
  const savedDestinations = destinationsQuery.currentData || [], JOBS = jobsQuery.currentData?.rows || [];
  const DOCUMENTS = ['National ID Card', 'Passport Photograph', 'Freight Forwarding License', 'Export License', 'Proof of Address'].map((name, index) => ({ id: name, name, validity: '—', status: index === 3 ? forwarderVerification(licenseStatus) : '—', url: index === 3 ? licenseUrl : null }));
  const VERIFICATION_CHECKS = ['National ID Verification', 'Freight Forwarding License', 'Export License', 'Bank Account Verification', 'Address Verification', 'Background Check'].map((label, index) => ({ label, status: index === 2 ? forwarderVerification(licenseStatus) : '—' }));
  const PERFORMANCE = [
    { icon: 'route', label: 'Total Jobs', value: FORWARDER?.jobs ?? '—', caption: '' },
    { icon: 'circle-check', label: 'Completed Jobs', value: completedQuery.error ? '—' : completedQuery.currentData?.pagination?.total ?? '—', caption: '' },
    { icon: 'timer', label: 'On-Time Delivery', value: '—', caption: '' },
    { icon: 'wallet', label: 'Total Spend', value: naira(FORWARDER?.spend), caption: '' },
    { icon: 'shield-check', label: 'Payment Reliability', value: '—', caption: '' },
    { icon: 'star', label: 'Partner Rating', value: '—', caption: '' },
  ];
  function changeTab(next) { setTab(next); setPage(1); }
  const unavailable = (feature) => setNotice({ tone: 'info', text: `${feature} is not available yet.` });
  function exportProfile() { downloadForwarderCsv('forwarder-profile.csv', [['Field', 'Value'], ['ID', id], ['Name', FORWARDER.name], ['Email', FORWARDER.email], ['Phone', FORWARDER.phone], ['Status', FORWARDER.status], ['Account Type', FORWARDER.isExporter ? 'Exporter' : 'Forwarder'], ['Verification', FORWARDER.verification], ['Total Jobs', FORWARDER.jobs], ['Wallet Balance (NGN)', FORWARDER.balance], ['Joined', FORWARDER.memberSince], ['Last Login', FORWARDER.lastActivity]]); }
  const success = (text) => setNotice({ tone: 'success', text });
  if (profileQuery.isFetching && !FORWARDER) return <ForwarderDetailLoading />;
  if (!id || profileQuery.error || !valid) return <SectionCard title="Forwarder Details">{profileQuery.error ? <QueryError query={profileQuery} title="Unable to load forwarder" /> : <EmptyState title={!id ? 'Select a forwarder' : 'Forwarder not found'} description="Choose a forwarder from the directory." />}<Button variant="outline" onClick={() => navigate('/forwarders')}>Back to Forwarders</Button></SectionCard>;

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
          <Button icon="pencil" onClick={() => unavailable("Editing a forwarder")}>Edit Forwarder</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={220} items={[
                  { label: 'Export Forwarder Report', icon: 'download', onClick: () => { setMoreOpen(false); exportProfile(); } },
                  { label: 'Print Profile', icon: 'file-text', onClick: () => { setMoreOpen(false); window.print(); } },
                  { label: 'View Audit Log', icon: 'scroll-text', onClick: () => { setMoreOpen(false); changeTab('Activity Log'); } },
                  { divider: true },
                  { label: FORWARDER.statusCode === 'SUSPENDED' ? 'Reactivate Forwarder' : 'Suspend Forwarder', icon: 'circle-alert', tone: 'danger', onClick: () => { setMoreOpen(false); setAction({ kind: FORWARDER.statusCode === 'SUSPENDED' ? 'activate' : 'suspend', forwarder: FORWARDER }); } },
                ]} />
              </span>
            )}
          </span>
        </>}
      />

      {notice && <Banner tone={notice.tone} action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Banner>}
      {profileQuery.isFetching && <DriverLoadingNotice>Refreshing forwarder details…</DriverLoadingNotice>}
      <Card>
        <div className="fd-identity">
          <Avatar name={FORWARDER.name} size={56} />
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title">{FORWARDER.name}</h2>
              <Badge tone={FORWARDER.statusCode === 'ACTIVE' ? 'success' : FORWARDER.statusCode === 'SUSPENDED' ? 'danger' : 'neutral'}>{FORWARDER.status}</Badge>
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
            { label: 'Status', value: <Badge tone={FORWARDER.statusCode === 'ACTIVE' ? 'success' : FORWARDER.statusCode === 'SUSPENDED' ? 'danger' : 'neutral'}>{FORWARDER.status}</Badge> },
            { label: 'Verification Status', value: <Badge tone={DOC_TONE[FORWARDER.verification] || 'neutral'}>{FORWARDER.verification}</Badge> },
            { label: 'Total Jobs', value: FORWARDER.jobs ?? '—' },
            { label: 'Total Spend (₦)', value: naira(FORWARDER.spend) },
            { label: 'Current Balance (₦)', value: naira(FORWARDER.balance), hint: 'Wallet balance' },
            { label: 'Member Since', value: FORWARDER.memberSince },
            { label: 'Last Login', value: FORWARDER.lastActivity },
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

      <Tabs items={TAB_ITEMS} value={tab} onChange={changeTab} />

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
                      {!FORWARDER.services.length && <span className="tk-meta">—</span>}{FORWARDER.services.map((s) => <Tag key={s} tone="blue">{s}</Tag>)}
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
                <LabelValue label="Available Credit" value={naira(FORWARDER.availableCredit)} />
                <LabelValue label="Payment Terms" value={FORWARDER.paymentTerms} />
                <LabelValue label="Last Payment" value={`${FORWARDER.lastPaymentDate} · ${naira(FORWARDER.lastPaymentAmount)}`} />
                <LabelValue label="Outstanding Invoices" value={`${FORWARDER.outstandingCount} · ${naira(FORWARDER.outstandingAmount)}`} />
                <Button variant="outline" icon="chart-column" fullWidth style={{ marginTop: 10 }} onClick={() => changeTab('Banking & Financial')}>
                  View Financial Overview →
                </Button>
              </SectionCard>
            </div>

            <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
              <SectionCard title="Address & Service Areas" icon="map-pin">
                <span className="tk-meta" style={{ display: 'block', marginBottom: 4 }}>Base Address</span>
                <p style={{ margin: '0 0 8px', font: '400 13px/19px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{FORWARDER.address}</p>
                <span className="tk-meta">Service coverage is not available yet.</span>
                <div style={{ marginTop: 14, borderTop: '1px solid var(--tk-line)', paddingTop: 10 }}>
                  <span className="tk-meta" style={{ display: 'block', marginBottom: 6 }}>Saved Destinations ({destinationsQuery.currentData ? savedDestinations.length : '—'})</span>
                  {destinationsQuery.isFetching ? <DriverTableLoading columns={2} label="Loading saved destinations" /> : destinationsQuery.error ? <QueryError query={destinationsQuery} title="Unable to load saved destinations" /> : !savedDestinations.length ? <span className="tk-meta">No saved destinations.</span> : savedDestinations.map((b, i) => (
                    <div key={b.id} className="fd-row" style={{ borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
                      <Icon name="map-pin" size={15} color="var(--tk-blue)" />
                      <span style={{ flex: 1, display: 'grid', gap: 1 }}>
                        <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{b.name}</span>
                        <span className="tk-meta">{b.address}</span>
                      </span>
                      {b.mapUrl && <a href={b.mapUrl} target="_blank" rel="noopener noreferrer">Map ↗</a>}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <QuickActionsCard items={[
                { icon: 'plus', label: 'Create Job for this Forwarder', onClick: () => unavailable('Creating a job for a forwarder') },
                { icon: 'shield-check', label: 'Add Verification Request', onClick: () => unavailable('Adding a verification request') },
                { icon: 'megaphone', label: 'Send Announcement', onClick: () => setAnnouncement(true) },
                { icon: 'file-text', label: 'Add Note', onClick: () => { changeTab('Notes'); unavailable('Adding a note'); } },
                { icon: 'download', label: 'Download Forwarder Profile', onClick: exportProfile },
              ]} />
            </div>
          </div>

          <div className="fd-bottom">
            <SectionCard title="Recent Jobs" pad="none" action={<a onClick={() => changeTab('Jobs & Shipments')} style={{ cursor: 'pointer' }}>View all jobs →</a>}>
              {jobsQuery.isFetching ? <DriverTableLoading columns={6} label="Loading recent jobs" /> : jobsQuery.error ? <QueryError query={jobsQuery} title="Unable to load jobs" /> : <JobsTable rows={JOBS} />}
            </SectionCard>

            <SectionCard title="Notes" action={<a onClick={() => changeTab('Notes')} style={{ cursor: 'pointer' }}>View all notes →</a>}>
              <p className="tk-meta">Notes are not available yet.</p>

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
          {pendingQuery.isFetching && <DriverLoadingNotice>Loading exporter license review…</DriverLoadingNotice>}
          {pendingQuery.error && <QueryError query={pendingQuery} title="Unable to load exporter license requests" />}
          <LabelValue label="Account Verification" value={FORWARDER.verification} />
          {VERIFICATION_CHECKS.map((c) => (
            <div key={c.label} className="fd-row">
              <Icon name={c.status === 'Verified' ? 'badge-check' : c.status === 'Pending' ? 'hourglass' : 'info'} size={17}
                color={c.status === 'Verified' ? 'var(--tk-success)' : c.status === 'Pending' ? 'var(--tk-warning)' : 'var(--tk-ink-400)'} />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{c.label}</span>
              <Badge tone={DOC_TONE[c.status] || 'neutral'}>{c.status}</Badge>
            </div>
          ))}
          {licenseUrl && <a href={licenseUrl} target="_blank" rel="noopener noreferrer">Open exporter license ↗</a>}
          {pendingLicense && <Button variant="outline" disabled={pendingQuery.isFetching} onClick={() => setAction({ kind: 'review', forwarder: { ...pendingLicense, name: FORWARDER.name } })}>Review Exporter License</Button>}
        </SectionCard>
      )}

      {tab === 'Banking & Financial' && (
        <><SectionCard title="Account Summary" icon="wallet">
          <div className="fd-info-grid">
            <LabelValue layout="stack" label="Current Balance" value={naira(FORWARDER.balance)} />
            <LabelValue layout="stack" label="Credit Limit" value={naira(FORWARDER.creditLimit)} />
            <LabelValue layout="stack" label="Available Credit" value={naira(FORWARDER.availableCredit)} />
            <LabelValue layout="stack" label="Payment Terms" value={FORWARDER.paymentTerms} />
            <LabelValue layout="stack" label="Last Payment" value={`${FORWARDER.lastPaymentDate} · ${naira(FORWARDER.lastPaymentAmount)}`} />
            <LabelValue layout="stack" label="Outstanding Invoices" value={`${FORWARDER.outstandingCount} · ${naira(FORWARDER.outstandingAmount)}`} />
          </div>
        </SectionCard>
        <SectionCard title="Wallet Transactions" pad="none">
          {transactionsQuery.isFetching ? <DriverTableLoading columns={5} label="Loading transactions" /> : transactionsQuery.error ? <QueryError query={transactionsQuery} title="Unable to load transactions" /> : !transactionsQuery.currentData?.rows.length ? <EmptyState title="No wallet transactions" description="Wallet transactions for this forwarder will appear here." /> : <><DataTable rows={transactionsQuery.currentData.rows} rowKey={(row) => row.id} columns={[{ key: 'label', header: 'Transaction' }, { key: 'type', header: 'Type' }, { key: 'amount', header: 'Amount (₦)', render: (row) => naira(row.amount) }, { key: 'status', header: 'Status' }, { key: 'date', header: 'Date' }]} /><Pagination page={page} pageSize={10} pageCount={Math.max(1, transactionsQuery.currentData?.pagination?.totalPages || 1)} total={transactionsQuery.currentData?.pagination?.total} onPage={(next) => setPage(Math.max(1, Math.min(transactionsQuery.currentData?.pagination?.totalPages || 1, next)))} /></>}
        </SectionCard></>
      )}

      {tab === 'Performance' && (
        <>{completedQuery.isFetching && <DriverLoadingNotice>Loading completed jobs…</DriverLoadingNotice>}{completedQuery.error && <QueryError query={completedQuery} title="Unable to load completed job count" />}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
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
        </div></>
      )}

      {tab === 'Jobs & Shipments' && (
        <SectionCard title="Jobs & Shipments" pad="none" count={!jobsQuery.error ? jobsQuery.currentData?.pagination?.total : undefined}>
          <Tabs items={['all', 'active', 'completed', 'cancelled']} value={jobTab} onChange={(next) => { setJobTab(next); setPage(1); }} />
          {jobsQuery.isFetching ? <DriverTableLoading columns={6} label="Loading jobs" /> : jobsQuery.error ? <QueryError query={jobsQuery} title="Unable to load jobs" /> : <><JobsTable rows={JOBS} /><Pagination page={page} pageSize={10} pageCount={Math.max(1, jobsQuery.currentData?.pagination?.totalPages || 1)} total={jobsQuery.currentData?.pagination?.total} onPage={(next) => setPage(Math.max(1, Math.min(jobsQuery.currentData?.pagination?.totalPages || 1, next)))} /></>}
        </SectionCard>
      )}

      {tab === 'Documents' && (
        <SectionCard title="Documents">
          {pendingQuery.isFetching && <DriverLoadingNotice>Loading exporter license…</DriverLoadingNotice>}
          {pendingQuery.error && <QueryError query={pendingQuery} title="Unable to load exporter license requests" />}
          {DOCUMENTS.map((d) => (
            <div key={d.id} className="fd-row">
              <Icon name="file-text" size={17} color="var(--tk-blue)" />
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
              <span className="tk-meta">{d.validity}</span>
              <Badge tone={DOC_TONE[d.status] || 'neutral'}>{d.status}</Badge>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer">Open ↗</a>}
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Activity Log' && (
        <SectionCard title="Activity Log">
          {!canViewActivity ? <Banner>Account audit logs are available to Super Admins only.</Banner> : activityQuery.isFetching ? <DriverTableLoading columns={3} label="Loading account audit logs" /> : activityQuery.error ? <QueryError query={activityQuery} title="Unable to load account audit logs" /> : activityQuery.currentData?.length ? <Timeline items={activityQuery.currentData} /> : <EmptyState title="No account audit logs" description="Admin actions recorded against this forwarder will appear here." />}
        </SectionCard>
      )}

      {tab === 'Notes' && <SectionCard title="Notes"><EmptyState icon="file-text" title="Notes unavailable" description="Forwarder notes are not available yet." /></SectionCard>}
      {action && <ForwarderActionModal key={`${action.kind}:${id}`} action={action} onClose={() => setAction(null)} onDone={success} />}
      {announcement && <ForwarderAnnouncementModal forwarder={FORWARDER} onClose={() => setAnnouncement(false)} onDone={success} />}
    </div>
  );
}
