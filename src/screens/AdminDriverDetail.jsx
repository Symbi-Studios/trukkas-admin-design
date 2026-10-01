'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate, useParams } from '../router.js';
import { Avatar, Badge, Banner, Button, Card, DataTable, EmptyState, LabelValue, PageHeader, Pagination, SectionCard, StatCard, Tabs } from '../ds.js';
import { adminDriverError, useGetAdminDriverJobsQuery, useGetAdminDriverLicenseQuery, useGetAdminDriverProfileQuery, useGetAdminDriverTransactionsQuery } from '../store/features/drivers/driversApi.js';
import { useGetAdminTripsQuery } from '../store/features/trips/tripsApi.js';
import { DriverDetailLoading, DriverLicenseLoading, DriverTableLoading } from './DriversLoading.jsx';

const TAB_ITEMS = ['Overview', 'Documents', 'Trips & Activity', 'Earnings & Wallet', 'Maintenance Log', 'Compliance', 'Incidents', 'Reviews & Ratings', 'Notes'];
const SUPPORTED_TABS = new Set(['Overview', 'Documents', 'Trips & Activity', 'Earnings & Wallet', 'Compliance']);

const naira = (value) => Number.isFinite(value) ? `₦${value.toLocaleString('en-NG')}` : '—';
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—';
}

function safeDocumentUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function HistorySection({ title, query, columns, page, limit, onPage, onLimit, children }) {
  const data = query.currentData;
  const pagination = data?.pagination;
  const pages = Math.max(1, pagination?.totalPages || 1);
  return <SectionCard title={title} pad="none">
    {children}
    {query.isFetching ? <DriverTableLoading columns={columns.length} label={`Loading ${title.toLowerCase()}`} />
      : query.error ? <div style={{ padding: 'var(--tk-card-pad)' }}><Banner tone="danger" title={`Unable to load ${title.toLowerCase()}`}>{adminDriverError(query.error)}</Banner><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div>
        : data?.rows.length ? <DataTable rows={data.rows} rowKey={(row) => row.id} columns={columns} />
          : <EmptyState icon="clipboard-list" title={`No ${title.toLowerCase()} found`} />}
    {!query.isFetching && !query.error && pagination && <Pagination page={page} pageSize={limit} total={pagination.total} pageCount={pages} onPage={(next) => onPage(Math.max(1, Math.min(pages, next)))} onPageSize={(size) => { onLimit(size); onPage(1); }} />}
  </SectionCard>;
}

export function AdminDriverDetail() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const routeParams = useParams();
  const id = searchParams.get('id') || routeParams.driverId || null;
  const [tab, setTab] = useState('Overview');
  const [tripPage, setTripPage] = useState(1), [tripLimit, setTripLimit] = useState(10);
  const [jobPage, setJobPage] = useState(1), [jobLimit, setJobLimit] = useState(10), [jobFilter, setJobFilter] = useState('all');
  const [transactionPage, setTransactionPage] = useState(1), [transactionLimit, setTransactionLimit] = useState(10);
  useEffect(() => { setTab('Overview'); setTripPage(1); setJobPage(1); setJobFilter('all'); setTransactionPage(1); }, [id]);
  const profileQuery = useGetAdminDriverProfileQuery(id, { skip: !id });
  const licenseQuery = useGetAdminDriverLicenseQuery(id, { skip: !id });
  const tripsQuery = useGetAdminTripsQuery({ driverId: id, page: tripPage, limit: tripLimit }, { skip: !id || tab !== 'Trips & Activity' });
  const jobsQuery = useGetAdminDriverJobsQuery({ id, tab: jobFilter, page: jobPage, limit: jobLimit }, { skip: !id || tab !== 'Trips & Activity' });
  const transactionsQuery = useGetAdminDriverTransactionsQuery({ id, page: transactionPage, limit: transactionLimit }, { skip: !id || tab !== 'Earnings & Wallet' });
  const profile = profileQuery.currentData;
  const license = licenseQuery.currentData;
  const fullName = profile?.name || 'Driver';
  const licenseUrl = safeDocumentUrl(license?.licenseUrl);

  if (!id) return <Card><Banner tone="warning" title="No driver selected">Open a driver from the Drivers list to view their details.</Banner><Button onClick={() => navigate('/drivers')}>Back to Drivers</Button></Card>;
  if (!profile && (profileQuery.isLoading || profileQuery.isFetching)) return <DriverDetailLoading />;

  return <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
    <PageHeader
      crumbs={['Fleet Management', { label: 'Drivers', onClick: () => navigate('/drivers') }, id]}
      title="Driver Details"
      description="View the driver profile and license data currently available from the admin API."
      actions={<Button variant="outline" icon="arrow-left" onClick={() => navigate('/drivers')}>Back to Drivers</Button>}
    />
    {profileQuery.error && <Banner tone="danger" title="Unable to load driver profile">{adminDriverError(profileQuery.error)}</Banner>}
    {licenseQuery.error && <Banner tone="warning" title="License data unavailable">{adminDriverError(licenseQuery.error)}</Banner>}
    {!profileQuery.error && profile && <>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={fullName} size={64} />
          <div style={{ display: 'grid', gap: 5 }}>
            <h2 className="tk-title">{fullName}</h2>
            <span className="tk-meta">Driver ID: <span className="tk-mono">{profile.id || id}</span></span>
          </div>
          {profile.status && <Badge dot>{profile.status}</Badge>}
        </div>
      </Card>
    </>}
    <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
    {tab === 'Overview' && !profileQuery.error && profile && <SectionCard title="Driver Information">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          <LabelValue layout="stack" label="Full Name" value={fullName} />
          <LabelValue layout="stack" label="Phone Number" value={profile.phone || '—'} />
          <LabelValue layout="stack" label="Email Address" value={profile.email || '—'} />
          <LabelValue layout="stack" label="Account Status" value={profile.status || '—'} />
          <LabelValue layout="stack" label="Account Type" value={profile.registrationType || '—'} />
          <LabelValue layout="stack" label="Company" value={profile.company || '—'} />
          <LabelValue layout="stack" label="Total Jobs" value={Number.isFinite(profile.totalJobs) ? profile.totalJobs : '—'} />
          <LabelValue layout="stack" label="Failed Jobs" value={profile.failedJobs ?? '—'} />
          <LabelValue layout="stack" label="Total Earnings" value={naira(profile.totalEarnings)} />
          <LabelValue layout="stack" label="Wallet Balance" value={naira(profile.walletBalance)} />
          <LabelValue layout="stack" label="Joined" value={dateLabel(profile.joined)} />
          <LabelValue layout="stack" label="Last Login" value={dateLabel(profile.lastLoginAt)} />
          <LabelValue layout="stack" label="Registration Status" value={profile.registrationStatus || '—'} />
          <LabelValue layout="stack" label="KYC Status" value={profile.kycStatus ? <Badge>{profile.kycStatus}</Badge> : '—'} />
        </div>
      </SectionCard>
    }
    {(tab === 'Overview' || tab === 'Documents') && <SectionCard title="Driver License" description="License verification and document information.">
      {licenseQuery.isFetching ? <DriverLicenseLoading /> : license ? <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          <LabelValue layout="stack" label="License Number" value={<span className="tk-mono">{license.licenseNumber || '—'}</span>} />
          <LabelValue layout="stack" label="Verification Status" value={<Badge>{license.status}</Badge>} />
          <LabelValue layout="stack" label="Expiry Date" value={dateLabel(license.expiresAt)} />
        </div>
        {licenseUrl ? <Button variant="outline" icon="file-text" onClick={() => window.open(licenseUrl, '_blank', 'noopener,noreferrer')}>Open License Document</Button> : <EmptyState icon="file-text" title="No license document available" description="The admin API did not return a valid HTTP or HTTPS license URL." style={{ padding: '22px 8px' }} />}
      </div> : <EmptyState icon="file-text" title="License information unavailable" description="No license record was returned for this driver." />}
    </SectionCard>}
    {tab === 'Overview' && profile?.trucks && <SectionCard title="Assigned Vehicles" pad="none">
      {profile.trucks.length ? <DataTable rows={profile.trucks} rowKey={(truck) => truck.id || truck.plate} columns={[
        { key: 'plate', header: 'Plate Number', render: (truck) => truck.plate || '—' },
        { key: 'type', header: 'Truck Type', render: (truck) => truck.type || '—' },
        { key: 'size', header: 'Container Size', render: (truck) => truck.size || '—' },
        { key: 'year', header: 'Year', render: (truck) => truck.year || '—' },
        { key: 'status', header: 'Status', render: (truck) => <Badge>{truck.status || '—'}</Badge> },
      ]} /> : <EmptyState icon="truck" title="No vehicles assigned" />}
    </SectionCard>}
    {tab === 'Trips & Activity' && <>
      <HistorySection title="Trip History" query={tripsQuery} page={tripPage} limit={tripLimit} onPage={setTripPage} onLimit={setTripLimit} columns={[
        { key: 'id', header: 'Trip ID' }, { key: 'containerNumber', header: 'Container', render: (trip) => trip.containerNumber || '—' },
        { key: 'route', header: 'Route', render: (trip) => trip.route || '—' },
        { key: 'status', header: 'Status', render: (trip) => <Badge>{trip.status}</Badge> },
        { key: 'departed', header: 'Assigned', render: (trip) => dateLabel(trip.dates.assignedAt) },
        { key: 'delivered', header: 'Completed', render: (trip) => dateLabel(trip.dates.completedAt) },
        { key: 'distance', header: 'Distance', render: (trip) => Number.isFinite(trip.distance.totalKm) ? `${trip.distance.totalKm.toLocaleString()} km` : '—' },
      ]} />
      <HistorySection title="Job History" query={jobsQuery} page={jobPage} limit={jobLimit} onPage={setJobPage} onLimit={setJobLimit} columns={[
        { key: 'id', header: 'Job ID' }, { key: 'route', header: 'Route' },
        { key: 'forwarder', header: 'Forwarder' }, { key: 'trucker', header: 'Trucking Company' },
        { key: 'status', header: 'Status', render: (job) => <Badge>{job.status}</Badge> },
        { key: 'createdAt', header: 'Created', render: (job) => dateLabel(job.createdAt) },
        { key: 'completedAt', header: 'Completed', render: (job) => dateLabel(job.completedAt) },
      ]}>
        <Tabs style={{ padding: '0 var(--tk-card-pad)' }} value={jobFilter} onChange={(value) => { setJobFilter(value); setJobPage(1); }} items={[
          { value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
        ]} />
      </HistorySection>
    </>}
    {tab === 'Earnings & Wallet' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--tk-space-4)' }}>
        <StatCard icon="wallet" tint="green" label="Wallet Balance" value={naira(profile?.walletBalance)} />
        <StatCard icon="banknote" tint="blue" label="Total Earnings" value={naira(profile?.totalEarnings)} caption="All time" />
      </div>
      <HistorySection title="Wallet Transactions" query={transactionsQuery} page={transactionPage} limit={transactionLimit} onPage={setTransactionPage} onLimit={setTransactionLimit} columns={[
        { key: 'id', header: 'Transaction ID' }, { key: 'label', header: 'Description' }, { key: 'type', header: 'Type' },
        { key: 'amount', header: 'Amount', render: (transaction) => naira(transaction.amount) },
        { key: 'status', header: 'Status', render: (transaction) => <Badge>{transaction.status}</Badge> },
        { key: 'createdAt', header: 'Date', render: (transaction) => dateLabel(transaction.createdAt) },
      ]} />
    </>}
    {tab === 'Compliance' && <SectionCard title="Compliance Status">
      <div style={{ display: 'grid', gap: 16 }}>
        <LabelValue label="KYC Status" value={profile?.kycStatus ? <Badge>{profile.kycStatus}</Badge> : '—'} />
        <LabelValue label="Registration Status" value={profile?.registrationStatus || '—'} />
        {licenseQuery.isFetching ? <DriverLicenseLoading /> : <>
          <LabelValue label="License Status" value={license ? <Badge>{license.status}</Badge> : '—'} />
          <LabelValue label="License Expiry" value={dateLabel(license?.expiresAt)} />
        </>}
      </div>
    </SectionCard>}
    {!SUPPORTED_TABS.has(tab) && <SectionCard title={tab}><EmptyState icon="clipboard-list" title={`${tab} unavailable`} description="These records are not available for this driver yet." /></SectionCard>}
  </div>;
}
