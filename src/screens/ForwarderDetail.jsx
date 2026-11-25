'use client';

import { ToastRelay } from '../components/ActionToast.jsx';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import {
  Button, Badge, SectionCard, LabelValue, Card, PageHeader, DropdownMenu, DataTable, Tabs,
  Timeline, Icon, Avatar, EmptyState, Banner, Pagination, StatCard, TableToolbar,
} from '../ds.js';
import './ForwarderDetail.css';

import { forwarderMoney, forwarderError, useGetAdminForwarderProfileQuery, useGetAdminForwarderDestinationsQuery, useGetAdminForwarderDocumentsQuery, useGetAdminForwarderJobsQuery, useGetAdminForwarderTransactionsQuery, useGetAdminForwarderActivityQuery } from '../store/features/forwarders/forwardersApi.js';
import { ForwarderDetailLoading } from './ForwardersLoading.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { ForwarderActionModal, ForwarderAnnouncementModal, downloadForwarderCsv } from './ForwarderActions.jsx';
import { ForwarderProfileModal, ForwarderNoteModal, ForwarderVerificationRequestModal } from './ForwarderForms.jsx';
import { ForwarderNotes } from './ForwarderNotes.jsx';
import { FORWARDER_STATUS_TONE, VERIFICATION_TONE, ForwarderActivity, ForwarderJobsTable, ForwarderJobDrawer, JobStatusFilter, NotSubmitted } from './ForwarderShared.jsx';

function QueryError({ query, title = 'Unable to load data' }) {
  return <Banner tone="danger" title={title} action={<Button variant="outline" onClick={query.refetch}>Retry</Button>}>{forwarderError(query.error)}</Banner>;
}

const TAB_ITEMS = ['Overview', 'KYC', 'Jobs', 'Saved Addresses', 'Financial', 'Activity Log'];
const naira = forwarderMoney;
const KYC_ICON = { Verified: ['badge-check', 'var(--tk-success)'], Pending: ['hourglass', 'var(--tk-warning)'], Rejected: ['circle-x', 'var(--tk-danger-solid)'] };
const present = (value) => value != null && value !== '—' && value !== '';

function KycRow({ icon, title, optional, detail, status, url, action, onRequest }) {
  const [statusIcon, statusColor] = KYC_ICON[status] || [icon, 'var(--tk-ink-400)'];
  return (
    <div className="fd-kyc-row">
      <span className="fd-kyc-icon" style={{ color: statusColor }}><Icon name={statusIcon} size={18} /></span>
      <span className="fd-kyc-text">
        <strong>{title}{optional && <span className="tk-meta"> · Optional</span>}</strong>
        <span className="tk-meta">{detail}</span>
      </span>
      <span className="fd-kyc-actions">
        {url && <a href={url} target="_blank" rel="noopener noreferrer">View ↗</a>}
        {action}
        {onRequest && <Button size="sm" variant="ghost" icon="rotate-ccw" onClick={onRequest}>Request</Button>}
        {status === 'Not submitted' ? <NotSubmitted /> : <Badge tone={VERIFICATION_TONE[status] || 'neutral'}>{status}</Badge>}
      </span>
    </div>
  );
}

export function ForwarderDetail() {
  const navigate = useNavigate(), params = useParams(), search = useSearchParams();
  const id = search.get('id') || params.forwarderId || '';
  const requestedTab = search.get('tab');
  const authenticated = useSelector(state => Boolean(state.auth.signedIn));
  const owner = useSelector(state => state.auth.admin?.id);
  const canViewActivity = useSelector((state) => state.auth.admin?.role) === 'SUPER_ADMIN';
  const [tab, setTab] = useState('Overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingForwarder, setEditingForwarder] = useState(null), [openJob, setOpenJob] = useState(null), [noteOpen, setNoteOpen] = useState(false), [verificationOpen, setVerificationOpen] = useState(null);

  const [page, setPage] = useState(1), [jobTab, setJobTab] = useState('all'), [action, setAction] = useState(null), [announcement, setAnnouncement] = useState(false), [notice, setNotice] = useState(null);
  useEffect(() => { setTab(({ verification: 'KYC', documents: 'KYC', kyc: 'KYC', jobs: 'Jobs', addresses: 'Saved Addresses' })[requestedTab] || 'Overview'); setPage(1); setJobTab('all'); setAction(null); setAnnouncement(false); setNotice(null); setMoreOpen(false); setEditingForwarder(null); setNoteOpen(false); setVerificationOpen(null); setOpenJob(null); }, [id, requestedTab]);
  const profileQuery = useGetAdminForwarderProfileQuery({ id, owner }, { skip: !authenticated || !id, refetchOnMountOrArgChange: true });
  const FORWARDER = profileQuery.error ? null : profileQuery.currentData;
  const valid = FORWARDER?.role === 'FORWARDER';
  const documentsQuery = useGetAdminForwarderDocumentsQuery({ id, owner }, { skip: !authenticated || !valid || tab !== 'KYC' });
  const onJobs = tab === 'Jobs';
  const jobsQuery = useGetAdminForwarderJobsQuery({ id, owner, tab: onJobs ? jobTab : 'all', page: onJobs ? page : 1, limit: onJobs ? 10 : 6 }, { skip: !authenticated || !valid || !['Overview', 'Jobs'].includes(tab) });
  const completedQuery = useGetAdminForwarderJobsQuery({ id, owner, tab: 'completed', page: 1, limit: 1 }, { skip: !authenticated || !valid });
  const transactionsQuery = useGetAdminForwarderTransactionsQuery({ id, owner, page, limit: 10 }, { skip: !authenticated || !valid || tab !== 'Financial' });
  const destinationsQuery = useGetAdminForwarderDestinationsQuery({ id, owner }, { skip: !authenticated || !valid || tab !== 'Saved Addresses' });
  const activityQuery = useGetAdminForwarderActivityQuery({ id, owner }, { skip: !authenticated || !valid || !canViewActivity || tab !== 'Activity Log' });
  const JOBS = jobsQuery.error ? [] : jobsQuery.currentData?.rows || [];
  const docs = documentsQuery.error ? {} : documentsQuery.currentData || {};
  const checks = FORWARDER?.verificationChecks || {};
  const checkStatus = (key) => present(checks[key]) ? checks[key] : null;

  const PERFORMANCE = [
    { icon: 'route', label: 'Total Jobs', value: FORWARDER?.jobs ?? '—' },
    { icon: 'circle-check', label: 'Completed Jobs', value: completedQuery.error ? '—' : completedQuery.currentData?.pagination?.total ?? '—' },
    { icon: 'timer', label: 'On-Time Delivery', value: FORWARDER?.onTimeDelivery == null ? '—' : FORWARDER.onTimeDelivery + '%' },
    { icon: 'wallet', label: 'Total Spend', value: naira(FORWARDER?.spend) },
    { icon: 'shield-check', label: 'Payment Reliability', value: FORWARDER?.paymentReliability == null ? '—' : FORWARDER.paymentReliability + '%' },
    { icon: 'star', label: 'Partner Rating', value: FORWARDER?.partnerRating ? FORWARDER.partnerRating.average + ' / ' + FORWARDER.partnerRating.scale : '—', caption: FORWARDER?.partnerRating?.count == null ? null : FORWARDER.partnerRating.count + ' ratings' },
  ];
  function changeTab(next) { setTab(next); setPage(1); }
  function exportProfile() { downloadForwarderCsv('forwarder-profile.csv', [['Field', 'Value'], ['ID', id], ['Name', FORWARDER.name], ['Email', FORWARDER.email], ['Phone', FORWARDER.phone], ['Status', FORWARDER.status], ['KYC', FORWARDER.verification], ['Total Jobs', FORWARDER.jobs], ['Wallet Balance (NGN)', FORWARDER.balance], ['Joined', FORWARDER.memberSince], ['Last Login', FORWARDER.lastActivity]]); }
  const success = (text, tone = 'success') => setNotice({ tone, text });
  if (profileQuery.isFetching && !FORWARDER) return <ForwarderDetailLoading />;
  if (!id || profileQuery.error || !valid) return <SectionCard title="Forwarder Details">{profileQuery.error ? <QueryError query={profileQuery} title="Unable to load forwarder" /> : <EmptyState title={!id ? 'Select a forwarder' : 'Forwarder not found'} description="Choose a forwarder from the directory." />}<Button variant="outline" onClick={() => navigate('/forwarders')}>Back to Forwarders</Button></SectionCard>;

  const suspended = FORWARDER.statusCode === 'SUSPENDED';
  const licenseState = checkStatus('forwardingLicense') || (present(FORWARDER.license) ? '—' : 'Not submitted');
  const KYC_ITEMS = [
    { key: 'nin', icon: 'id-card', title: 'National ID (NIN)', detail: present(FORWARDER.nin) ? FORWARDER.nin : 'No NIN on file', status: checkStatus('nationalId') || (present(FORWARDER.nin) ? '—' : 'Not submitted') },
    { key: 'passport', icon: 'image', title: 'Passport Photograph', detail: docs.passport ? `Expires ${docs.passport.validity}` : 'Photo of the account holder', status: docs.passport?.status && docs.passport.status !== '—' ? docs.passport.status : documentsQuery.currentData ? 'Not submitted' : '—', url: docs.passport?.url },
    { key: 'address', icon: 'map-pin', title: 'Proof of Address', detail: present(FORWARDER.address) ? FORWARDER.address : 'Utility bill or bank statement', status: docs.address?.status && docs.address.status !== '—' ? docs.address.status : checkStatus('address') || (documentsQuery.currentData ? 'Not submitted' : '—'), url: docs.address?.url },
    { key: 'bank', icon: 'landmark', title: 'Bank Account', detail: 'Payout account verification', status: checkStatus('bankAccount') || '—' },
    { key: 'license', icon: 'file-badge', title: 'Forwarding License', optional: true, detail: present(FORWARDER.license) ? `License no. ${FORWARDER.license}` : 'Not required to use Trukkas', status: licenseState },
  ];

  return (
    <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
      <PageHeader
        crumbs={[
          { label: 'Forwarders', onClick: () => navigate('/forwarders') },
          FORWARDER.name,
        ]}
        title="Forwarder Details"
        description="Review the forwarder's profile, KYC, jobs and financial standing."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/forwarders')}>Back to Forwarders</Button>
          <Button icon="pencil" onClick={() => setEditingForwarder(FORWARDER)}>Edit Forwarder</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 'var(--tk-z-dropdown)' }}>
                <DropdownMenu width={230} items={[
                  { label: 'Request Verification', icon: 'shield-check', onClick: () => { setMoreOpen(false); changeTab('KYC'); setVerificationOpen({}); } },
                  { label: 'Send Message', icon: 'megaphone', onClick: () => { setMoreOpen(false); setAnnouncement(true); } },
                  { divider: true },
                  { label: 'Export Forwarder Report', icon: 'download', onClick: () => { setMoreOpen(false); exportProfile(); } },
                  { label: 'Print Profile', icon: 'file-text', onClick: () => { setMoreOpen(false); window.print(); } },
                  { divider: true },
                  { label: suspended ? 'Reactivate Forwarder' : 'Suspend Forwarder', icon: 'circle-alert', tone: suspended ? undefined : 'danger', onClick: () => { setMoreOpen(false); setAction({ kind: suspended ? 'activate' : 'suspend', forwarder: FORWARDER }); } },
                ]} />
              </span>
            )}
          </span>
        </>}
      />

      {notice && <ToastRelay message={notice.text} tone={notice.tone} onShown={() => setNotice(null)}><Banner tone={notice.tone} action={<Button variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>}>{notice.text}</Banner></ToastRelay>}
      {profileQuery.isFetching && <DriverLoadingNotice>Refreshing forwarder details…</DriverLoadingNotice>}
      <Card>
        <div className="fd-identity">
          <Avatar name={FORWARDER.name} size={56} />
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="tk-title">{FORWARDER.name}</h2>
              <Badge tone={FORWARDER_STATUS_TONE[FORWARDER.status] || 'neutral'} dot>{FORWARDER.status}</Badge>
              <Badge tone={VERIFICATION_TONE[FORWARDER.verification] || 'neutral'}>KYC {FORWARDER.verification}</Badge>
            </div>
            <div className="fd-identity-meta">
              <span><Icon name="mail" size={13} />{FORWARDER.email}</span>
              <span><Icon name="phone" size={13} />{FORWARDER.phone}</span>
              <span><Icon name="calendar" size={13} />Joined {FORWARDER.memberSince}</span>
              <span><Icon name="log-in" size={13} />Last login {FORWARDER.lastActivity}</span>
            </div>
          </div>
          <div className="fd-balance">
            <span className="tk-meta">Wallet balance</span>
            <strong>{naira(FORWARDER.balance)}</strong>
          </div>
        </div>
        {completedQuery.error && <div style={{ marginTop: 14 }}><QueryError query={completedQuery} title="Unable to load completed job count" /></div>}
        <div className="fd-perf">
          {PERFORMANCE.map((p) => (
            <div key={p.label} className="fd-perf-item">
              <span className="fd-perf-icon"><Icon name={p.icon} size={16} /></span>
              <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                <span className="tk-meta">{p.label}</span>
                <strong>{p.value}</strong>
                {p.caption && <span className="tk-meta" style={{ fontSize: 11 }}>{p.caption}</span>}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Tabs items={TAB_ITEMS} value={tab} onChange={changeTab} />

      {tab === 'Overview' && (
        <>
          <div className="fd-bottom fd-overview">
            <SectionCard title="Personal Information" icon="user">
              <div className="fd-info-grid">
                <LabelValue layout="stack" label="Full Name" value={FORWARDER.name} />
                <LabelValue layout="stack" label="Date of Birth" value={FORWARDER.dob} />
                <LabelValue layout="stack" label="Gender" value={FORWARDER.gender} />
                <LabelValue layout="stack" label="Nationality" value={FORWARDER.nationality} />
                <LabelValue layout="stack" label="National ID (NIN)" value={FORWARDER.nin} />
                <LabelValue layout="stack" label="Phone" value={FORWARDER.phone} />
                <LabelValue layout="stack" label="Email" value={FORWARDER.email} />
                <LabelValue layout="stack" label="Language(s)" value={FORWARDER.languages} />
                <LabelValue layout="stack" label="Forwarding License No." value={present(FORWARDER.license) ? FORWARDER.license : <NotSubmitted />} />
                <LabelValue layout="stack" label="Home Address" value={FORWARDER.address} />
              </div>
            </SectionCard>

            <SectionCard title="Recent Activity" icon="activity" action={<a onClick={() => changeTab('Jobs')} style={{ cursor: 'pointer' }}>All jobs →</a>}>
              {jobsQuery.isFetching && !jobsQuery.currentData ? <DriverTableLoading columns={2} label="Loading recent activity" /> : jobsQuery.error ? <QueryError query={jobsQuery} title="Unable to load recent activity" /> : <ForwarderActivity jobs={JOBS} />}
            </SectionCard>
          </div>

          <SectionCard title="Notes" icon="notebook-pen" action={<Button size="sm" variant="outline" icon="plus" onClick={() => setNoteOpen(true)}>Add Note</Button>}>
            <ForwarderNotes key={id} id={id} owner={owner} />
          </SectionCard>
        </>
      )}

      {tab === 'KYC' && (
        <SectionCard title="KYC" icon="shield-check" action={<Button size="sm" variant="outline" icon="shield-check" onClick={() => setVerificationOpen({})}>Request Verification</Button>}>
          {documentsQuery.isFetching && <DriverLoadingNotice>Loading KYC records…</DriverLoadingNotice>}
          {documentsQuery.error && <QueryError query={documentsQuery} title="Unable to load documents" />}
          <div className="fd-kyc-summary">
            <span className="tk-meta">Overall KYC status</span>
            <Badge tone={VERIFICATION_TONE[FORWARDER.verification] || 'neutral'}>{FORWARDER.verification}</Badge>
          </div>
          {KYC_ITEMS.map(({ key, ...item }) => <KycRow key={key} {...item} onRequest={['nin', 'address'].includes(key) ? () => setVerificationOpen({ key }) : undefined} />)}
        </SectionCard>
      )}

      {tab === 'Financial' && (
        <><div className="fd-fin-stats">
          <StatCard icon="wallet" tint="blue" label="Current Balance" value={naira(FORWARDER.balance)} caption="Wallet balance" />
          <StatCard icon="credit-card" tint="purple" label="Credit Limit" value={naira(FORWARDER.creditLimit)} caption={present(FORWARDER.paymentTerms) ? `Terms: ${FORWARDER.paymentTerms}` : 'Payment terms —'} />
          <StatCard icon="circle-check" tint="green" label="Available Credit" value={naira(FORWARDER.availableCredit)} />
          <StatCard icon="receipt" tint="teal" label="Last Payment" value={naira(FORWARDER.lastPaymentAmount)} caption={FORWARDER.lastPaymentDate} />
          <StatCard icon="file-warning" tint="amber" label="Outstanding Invoices" value={naira(FORWARDER.outstandingAmount)} caption={FORWARDER.outstandingCount == null || FORWARDER.outstandingCount === '—' ? '—' : `${FORWARDER.outstandingCount} invoice${FORWARDER.outstandingCount === 1 ? '' : 's'}`} direction="down" />
        </div>
        <SectionCard title="Wallet Transactions" pad="none">
          <div className="fd-table-gap">
          {transactionsQuery.isFetching ? <DriverTableLoading columns={5} label="Loading transactions" /> : transactionsQuery.error ? <QueryError query={transactionsQuery} title="Unable to load transactions" /> : !transactionsQuery.currentData?.rows.length ? <EmptyState title="No wallet transactions" description="Wallet transactions for this forwarder will appear here." /> : <><DataTable rows={transactionsQuery.currentData.rows} rowKey={(row) => row.id} columns={[{ key: 'label', header: 'Transaction' }, { key: 'type', header: 'Type' }, { key: 'amount', header: 'Amount (₦)', render: (row) => naira(row.amount) }, { key: 'status', header: 'Status' }, { key: 'date', header: 'Date' }]} /><Pagination page={page} pageSize={10} pageCount={Math.max(1, transactionsQuery.currentData?.pagination?.totalPages || 1)} total={transactionsQuery.currentData?.pagination?.total} onPage={(next) => setPage(Math.max(1, Math.min(transactionsQuery.currentData?.pagination?.totalPages || 1, next)))} /></>}</div>
        </SectionCard></>
      )}

      {tab === 'Jobs' && (
        <SectionCard title="Jobs" pad="none" count={!jobsQuery.error ? jobsQuery.currentData?.pagination?.total : undefined}>
          <TableToolbar filters={<JobStatusFilter value={jobTab} onChange={(next) => { setJobTab(next); setPage(1); }} />} />
          {jobsQuery.isFetching ? <DriverTableLoading columns={4} label="Loading jobs" /> : jobsQuery.error ? <QueryError query={jobsQuery} title="Unable to load jobs" /> : <><ForwarderJobsTable rows={JOBS} onRowClick={setOpenJob} /><Pagination page={page} pageSize={10} pageCount={Math.max(1, jobsQuery.currentData?.pagination?.totalPages || 1)} total={jobsQuery.currentData?.pagination?.total} onPage={(next) => setPage(Math.max(1, Math.min(jobsQuery.currentData?.pagination?.totalPages || 1, next)))} /></>}
        </SectionCard>
      )}

      {tab === 'Saved Addresses' && (
        <SectionCard title="Saved Addresses" icon="map-pin" description="Delivery and pickup locations this forwarder has saved in the app." count={destinationsQuery.currentData && !destinationsQuery.error ? destinationsQuery.currentData.length : undefined}>
          {destinationsQuery.isFetching ? <DriverTableLoading columns={2} label="Loading saved addresses" />
            : destinationsQuery.error ? <QueryError query={destinationsQuery} title="Unable to load saved addresses" />
            : !destinationsQuery.currentData?.length ? <EmptyState icon="map-pin" title="No saved addresses" description="Addresses this forwarder saves when creating jobs will appear here." />
            : <div className="fd-addresses">
              {destinationsQuery.currentData.map((place) => (
                <div key={place.id} className="fd-address">
                  <span className="fd-address-icon"><Icon name="map-pin" size={16} /></span>
                  <span className="fd-address-text">
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </span>
                  {place.mapUrl && <a className="fd-address-map" href={place.mapUrl} target="_blank" rel="noopener noreferrer"><Icon name="map" size={14} />View on map</a>}
                </div>
              ))}
            </div>}
        </SectionCard>
      )}

      {tab === 'Activity Log' && (
        <SectionCard title="Activity Log">
          {!canViewActivity ? <Banner>Account audit logs are available to Super Admins only.</Banner> : activityQuery.isFetching ? <DriverTableLoading columns={3} label="Loading account audit logs" /> : activityQuery.error ? <QueryError query={activityQuery} title="Unable to load account audit logs" /> : activityQuery.currentData?.length ? <Timeline items={activityQuery.currentData} /> : <EmptyState title="No account audit logs" description="Admin actions recorded against this forwarder will appear here." />}
        </SectionCard>
      )}

      {editingForwarder && <ForwarderProfileModal key={id} forwarder={editingForwarder} onClose={() => setEditingForwarder(null)} onDone={success} />}
      {noteOpen && <ForwarderNoteModal key={id} forwarder={FORWARDER} onClose={() => setNoteOpen(false)} onDone={success} />}
      {verificationOpen && <ForwarderVerificationRequestModal key={id} forwarder={FORWARDER} statuses={Object.fromEntries(KYC_ITEMS.map((item) => [item.key, item.status]))} initialKey={verificationOpen.key} onClose={() => setVerificationOpen(null)} onDone={success} />}
      {openJob && <ForwarderJobDrawer key={openJob.detailId || openJob.id} job={openJob} onClose={() => setOpenJob(null)} onOpen={() => openJob.detailId && navigate(`/jobs/detail?id=${encodeURIComponent(openJob.detailId)}`)} />}
      {action && <ForwarderActionModal key={`${action.kind}:${id}`} action={action} onClose={() => setAction(null)} onDone={success} />}
      {announcement && <ForwarderAnnouncementModal forwarder={FORWARDER} onClose={() => setAnnouncement(false)} onDone={success} />}
    </div>
  );
}
