'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from '../router.js';
import {
  PageHeader, Button, StatCard, SectionCard, TableToolbar, SearchField, FilterSelect,
  DataTable, Pagination, Badge, QuickActionsCard, Card, DropdownMenu, IconButton,
  Avatar, Icon, Tabs, Banner, EmptyState, Modal, Textarea, Skeleton,
} from '../ds.js';
import { DriverLicenseLoading, DriverLoadingNotice, DriverTableLoading, DriversLoading } from './DriversLoading.jsx';
import {
  adminDriverError, useActivateAdminDriverMutation, useGetAdminDriversQuery,
  useGetAdminDriverLicenseQuery, useGetAdminDriverStatsQuery,
  useGetAdminPendingDriversQuery, useReviewAdminDriverMutation,
  useSuspendAdminDriverMutation, useVerifyAdminDriverLicenseMutation,
} from '../store/features/drivers/driversApi.js';

const STATUS_TONE = { 'Pending Review': 'warning', Rejected: 'danger', Active: 'success', 'On Trip': 'info' };
const REG_TYPES = ['Individual Driver', 'Company Driver'];
const LICENSE_STATUSES = ['Valid', 'Expiring Soon', 'Expired', 'Pending Review', 'Rejected'];
const STATUS_QUERY = {
  Active: 'ACTIVE', 'On Trip': 'ACTIVE', Inactive: 'INACTIVE',
  'Pending Profile': 'PENDING_PROFILE', 'Pending Review': 'PENDING_REVIEW',
};
const TAB_QUERY = { Active: 'ACTIVE', 'On Trip': 'ACTIVE', Inactive: 'INACTIVE', 'Pending Review': 'PENDING_REVIEW' };
const naira = (value) => Number.isFinite(value) ? `₦${Math.round(value).toLocaleString('en-NG')}` : '—';

function safeDocumentUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function driverDetailUrl(id) { return `/drivers/detail?id=${encodeURIComponent(id)}`; }

function driverCell(driver) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <Avatar name={driver.name} size={34} />
    <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Link to={driverDetailUrl(driver.id)} style={{ font: '600 13px/18px var(--tk-font-sans)' }}>{driver.name}</Link>
      <span className="tk-meta">{driver.phone || '—'}</span>
    </span>
  </span>;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

function localStatusMatch(driver, value) {
  if (value === 'All Status') return true;
  if (value === 'On Trip') return driver.isOnTrip;
  if (value === 'Inactive') return ['INACTIVE', 'SUSPENDED', 'BANNED'].includes(driver.statusCode);
  return driver.statusCode === STATUS_QUERY[value];
}

export function Drivers() {
  const [tab, setTab] = useState('All Drivers');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [regType, setRegType] = useState('All Types');
  const [status, setStatus] = useState('All Status');
  const [company, setCompany] = useState('All Companies');
  const [licenseStatus, setLicenseStatus] = useState('All');
  const [openMenu, setOpenMenu] = useState(null);
  const [rowMenu, setRowMenu] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [licenseDriverId, setLicenseDriverId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const queryStatus = STATUS_QUERY[status] || TAB_QUERY[tab];
  const driversQuery = useGetAdminDriversQuery(
    { search, status: queryStatus, page, limit: pageSize },
    { skip: tab === 'Rejected' },
  );
  const pendingQuery = useGetAdminPendingDriversQuery();
  const statsQuery = useGetAdminDriverStatsQuery();
  const activeCountQuery = useGetAdminDriversQuery({ status: 'ACTIVE', page: 1, limit: 1 });
  const pendingCountQuery = useGetAdminDriversQuery({ status: 'PENDING_REVIEW', page: 1, limit: 1 });
  const inactiveCountQuery = useGetAdminDriversQuery({ status: 'INACTIVE', page: 1, limit: 1 });
  const suspendedCountQuery = useGetAdminDriversQuery({ status: 'SUSPENDED', page: 1, limit: 1 });
  const bannedCountQuery = useGetAdminDriversQuery({ status: 'BANNED', page: 1, limit: 1 });
  const licenseQuery = useGetAdminDriverLicenseQuery(licenseDriverId, { skip: !licenseDriverId });
  const license = licenseQuery.currentData;
  const [reviewDriver, reviewState] = useReviewAdminDriverMutation();
  const [verifyLicense, licenseActionState] = useVerifyAdminDriverLicenseMutation();
  const [suspendDriver, suspendState] = useSuspendAdminDriverMutation();
  const [activateDriver, activateState] = useActivateAdminDriverMutation();
  const actionBusy = reviewState.isLoading || licenseActionState.isLoading || suspendState.isLoading || activateState.isLoading;

  const pendingById = useMemo(() => new Map((pendingQuery.data?.drivers || []).map((driver) => [driver.id, driver])), [pendingQuery.data]);
  const drivers = useMemo(() => (driversQuery.currentData?.drivers || []).map((driver) => {
    const pending = pendingById.get(driver.id);
    return pending ? { ...driver, license: driver.license || pending.license, licenseStatus: driver.licenseStatus !== '—' ? driver.licenseStatus : pending.licenseStatus, licenseExpiresAt: driver.licenseExpiresAt || pending.licenseExpiresAt } : driver;
  }), [driversQuery.currentData, pendingById]);
  const companies = useMemo(() => [...new Set(drivers.map((driver) => driver.company).filter(Boolean))].sort(), [drivers]);

  const counts = {
    total: statsQuery.data?.total ?? null,
    individual: null,
    company: null,
    pending: pendingCountQuery.data?.pagination.total ?? pendingQuery.data?.count ?? null,
    active: activeCountQuery.data?.pagination.total ?? null,
    onTrip: null,
    inactive: [inactiveCountQuery, suspendedCountQuery, bannedCountQuery].every((query) => query.data?.pagination.total != null)
      ? inactiveCountQuery.data.pagination.total + suspendedCountQuery.data.pagination.total + bannedCountQuery.data.pagination.total
      : null,
    rejected: null,
    expiringDocs: null,
    totalEarnings: null,
    avgRating: null,
    totalReviews: null,
  };
  counts.approved = counts.active;

  const tabMatch = (driver) => {
    if (tab === 'Pending Review') return driver.statusCode === 'PENDING_REVIEW';
    if (tab === 'Active') return driver.statusCode === 'ACTIVE' && !driver.isOnTrip;
    if (tab === 'On Trip') return driver.isOnTrip;
    if (tab === 'Inactive') return ['INACTIVE', 'SUSPENDED', 'BANNED'].includes(driver.statusCode);
    return true;
  };
  const filtered = useMemo(() => drivers.filter((driver) => {
    const matchesType = regType === 'All Types' || driver.registrationType === regType;
    const matchesStatus = localStatusMatch(driver, status);
    const matchesCompany = company === 'All Companies' || driver.company === company;
    const matchesLicense = licenseStatus === 'All' || driver.licenseStatus === licenseStatus;
    return tabMatch(driver) && matchesType && matchesStatus && matchesCompany && matchesLicense;
  }), [drivers, tab, regType, status, company, licenseStatus]);

  const pageCount = driversQuery.currentData?.pagination.totalPages || 1;
  const total = driversQuery.currentData?.pagination.total ?? 0;
  const pendingCountLoading = !pendingCountQuery.data && pendingCountQuery.isFetching && !pendingQuery.data;
  const inactiveCountLoading = [inactiveCountQuery, suspendedCountQuery, bannedCountQuery].some((query) => !query.data && query.isFetching);
  const metricValue = (value, loading) => loading ? <Skeleton as="span" width={54} height={23} /> : value ?? '—';

  function exportRoster() {
    const header = ['Driver', 'Registration Type', 'Company', 'License No.', 'Status', 'License Status', 'Joined', 'Earnings', 'Rating'];
    const rows = filtered.map((driver) => [driver.name, driver.registrationType, driver.company, driver.license, driver.status, driver.licenseStatus, driver.joined, driver.totalEarnings, driver.rating]);
    download('drivers-export.csv', [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  }

  function changeTab(value) {
    setTab(value);
    setStatus('All Status');
    setPage(1);
  }

  function openAction(kind, driver) {
    setAction({ kind, id: driver.id, name: driver.name });
    setReason('');
    setActionError('');
    setRowMenu(null);
  }

  async function applyAction() {
    if (!action) return;
    if (action.kind === 'suspend' && !reason.trim()) {
      setActionError('A reason is required to suspend a driver.');
      return;
    }
    setActionError('');
    try {
      if (action.kind === 'approve' || action.kind === 'reject') await reviewDriver({ id: action.id, decision: action.kind, reason }).unwrap();
      if (action.kind === 'approve-license' || action.kind === 'reject-license') await verifyLicense({ id: action.id, decision: action.kind === 'approve-license' ? 'approve' : 'reject', reason }).unwrap();
      if (action.kind === 'suspend') await suspendDriver({ id: action.id, reason: reason.trim() }).unwrap();
      if (action.kind === 'activate') await activateDriver(action.id).unwrap();
      setToast(`${action.name} ${actionSuccess[action.kind]}.`);
      setAction(null);
      setReason('');
    } catch (error) {
      setActionError(adminDriverError(error));
    }
  }

  const actionTitle = {
    approve: 'Approve driver', reject: 'Reject driver', 'approve-license': 'Verify driver license',
    'reject-license': 'Reject driver license', suspend: 'Suspend driver', activate: 'Reactivate driver',
  };
  const actionSuccess = {
    approve: 'approved', reject: 'rejected', 'approve-license': 'license verified',
    'reject-license': 'license rejected', suspend: 'suspended', activate: 'reactivated',
  };
  const actionNeedsReason = action?.kind === 'suspend' || action?.kind === 'reject' || action?.kind === 'reject-license';
  const actionReasonRequired = action?.kind === 'suspend';

  const filterMenu = (open, setOpen, options, value, onChange, width = 220) => open && (
    <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
      <DropdownMenu width={width} items={options.map((item) => ({
        label: item, icon: item === value ? 'check' : undefined,
        onClick: () => { onChange(item); setOpen(null); setPage(1); },
      }))} />
    </span>
  );

  const pendingRow = pendingQuery.data?.drivers?.[0];
  const verifyDocuments = () => {
    if (pendingRow?.id) setLicenseDriverId(pendingRow.id);
    else setToast('There are no pending driver licenses to review.');
  };
  const quickUnavailable = (feature) => setToast(`${feature} is not available in the admin driver API yet.`);

  if (!driversQuery.data && driversQuery.isFetching && tab !== 'Rejected') return <DriversLoading />;

  return <>
    <PageHeader
      crumbs={['Fleet Management', 'Drivers']}
      title="Drivers"
      description="Monitor, review and manage all drivers on the Trukkas platform — individual drivers and drivers under trucking companies."
      actions={<>
        <Button icon="user-check" onClick={() => changeTab('Pending Review')}>Review Pending Drivers ({counts.pending ?? '—'})</Button>
        <Button variant="outline" icon="download" disabled={driversQuery.isFetching} onClick={exportRoster}>Export Current Page</Button>
        <span style={{ position: 'relative' }}>
          <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((open) => !open)}>More Actions</Button>
          {moreOpen && <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
            <DropdownMenu width={230} items={[
              { label: 'Add Driver', icon: 'user-plus', onClick: () => { setMoreOpen(false); quickUnavailable('Adding drivers'); } },
              { label: 'Import Drivers', icon: 'upload', onClick: () => { setMoreOpen(false); quickUnavailable('Driver import'); } },
              { label: 'Driver Compliance Report', icon: 'shield-check', onClick: () => { setMoreOpen(false); quickUnavailable('The compliance report'); } },
            ]} />
          </span>}
        </span>
      </>}
    />

    {toast && <Banner tone="info" title={toast} style={{ marginBottom: 'var(--tk-space-4)' }} />}
    {driversQuery.isFetching && <DriverLoadingNotice>Loading drivers…</DriverLoadingNotice>}
    {pendingQuery.error && <Banner tone="warning" title="Pending driver review data unavailable">{adminDriverError(pendingQuery.error)}</Banner>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--tk-space-4)' }}>
      <StatCard icon="users" label="Total Drivers" value={metricValue(counts.total, !statsQuery.data && statsQuery.isFetching)} caption={statsQuery.isLoading ? <Skeleton as="span" width={86} height={11} /> : counts.total == null ? 'Not provided by API' : 'All registered drivers'} />
      <StatCard icon="user" tint="green" label="Individual Drivers" value={counts.individual ?? '—'} caption="Not provided by API" />
      <StatCard icon="building-2" tint="navy" label="Company Drivers" value={counts.company ?? '—'} caption="Not provided by API" />
      <StatCard icon="clock" tint="amber" label="Pending Review" value={metricValue(counts.pending, pendingCountLoading)} caption="Pending review queue" />
      <StatCard icon="circle-check" tint="green" label="Approved / Active" value={metricValue(counts.approved, !activeCountQuery.data && activeCountQuery.isFetching)} caption="ACTIVE account status" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--tk-space-4)' }}>
      <StatCard icon="route" label="On Trip" value="—" caption="Not provided as a summary" />
      <StatCard icon="circle-minus" tint="navy" label="Inactive" value={metricValue(counts.inactive, inactiveCountLoading)} caption="INACTIVE, SUSPENDED, and BANNED" />
      <StatCard icon="circle-x" tint="red" label="Rejected" value="—" caption="Cannot be separated from INACTIVE" />
      <StatCard icon="triangle-alert" tint="amber" label="Documents Expiring" value="—" caption="No expiry summary endpoint" />
      <StatCard icon="wallet" tint="green" label="Total Driver Earnings" value={naira(counts.totalEarnings)} caption="No driver earnings endpoint" />
      <StatCard icon="star" tint="amber" label="Average Rating" value="—" caption="No driver rating endpoint" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
      <Card pad="none">
        <TableToolbar
          search={<SearchField placeholder="Search by driver name, license number, phone, or company..." value={q} onChange={(event) => setQ(event.target.value)} />}
          filters={<>
            <span style={{ position: 'relative' }}><FilterSelect label={regType} active={regType !== 'All Types'} onClick={() => setOpenMenu(openMenu === 'reg' ? null : 'reg')} />{filterMenu(openMenu === 'reg', setOpenMenu, ['All Types', ...REG_TYPES], regType, setRegType)}</span>
            <span style={{ position: 'relative' }}><FilterSelect label={status} active={status !== 'All Status'} onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')} />{filterMenu(openMenu === 'status', setOpenMenu, ['All Status', 'Active', 'On Trip', 'Inactive', 'Pending Profile', 'Pending Review'], status, setStatus)}</span>
            <span style={{ position: 'relative' }}><FilterSelect label={company} active={company !== 'All Companies'} onClick={() => setOpenMenu(openMenu === 'company' ? null : 'company')} />{filterMenu(openMenu === 'company', setOpenMenu, ['All Companies', ...companies], company, setCompany)}</span>
            <span style={{ position: 'relative' }}><FilterSelect label={licenseStatus === 'All' ? 'All License Status' : licenseStatus} active={licenseStatus !== 'All'} onClick={() => setOpenMenu(openMenu === 'license' ? null : 'license')} />{filterMenu(openMenu === 'license', setOpenMenu, ['All', ...LICENSE_STATUSES], licenseStatus, setLicenseStatus)}</span>
          </>}
        />
        <Tabs style={{ padding: '0 var(--tk-card-pad)' }} value={tab} onChange={changeTab} items={[
          { value: 'All Drivers', label: 'All Drivers', count: counts.total ?? undefined },
          { value: 'Pending Review', label: 'Pending Review', count: counts.pending ?? undefined },
          { value: 'Active', label: 'Active', count: counts.active ?? undefined },
          { value: 'On Trip', label: 'On Trip' },
          { value: 'Inactive', label: 'Inactive', count: counts.inactive ?? undefined },
          { value: 'Rejected', label: 'Rejected' },
        ]} />

        {tab === 'Rejected' ? <Banner tone="warning" title="Rejected drivers cannot be filtered reliably">
          The reject action sets the account to INACTIVE. This API does not distinguish rejected accounts from other inactive accounts.
        </Banner> : driversQuery.isFetching ? <DriverTableLoading />
          : driversQuery.error ? <div style={{ padding: 'var(--tk-card-pad)' }}><Banner tone="danger" title="Unable to load drivers">{adminDriverError(driversQuery.error)}</Banner><Button variant="outline" onClick={() => driversQuery.refetch()}>Retry</Button></div>
            : filtered.length === 0 ? <EmptyState icon="users" title="No drivers found" description={total ? 'No drivers on this API page match the selected filters.' : 'No drivers match this search or status.'} />
              : <DataTable rows={filtered} rowKey={(driver) => driver.id} columns={[
                { key: 'name', header: 'Driver', render: driverCell },
                { key: 'registrationType', header: 'Registration Type', render: (driver) => <Badge tone={driver.registrationType === 'Company Driver' ? 'info' : 'neutral'}>{driver.registrationType}</Badge> },
                { key: 'company', header: 'Company', render: (driver) => driver.company || '—' },
                { key: 'license', header: 'License No.', render: (driver) => <span className="tk-mono">{driver.license || '—'}</span> },
                { key: 'truckPlate', header: 'Assigned Truck', render: (driver) => driver.truckPlate ? <span className="tk-mono">{driver.truckPlate}</span> : <span className="tk-meta">—</span> },
                { key: 'status', header: 'Status', render: (driver) => <Badge dot tone={STATUS_TONE[driver.status]}>{driver.status}</Badge> },
                { key: 'licenseStatus', header: 'License Status', render: (driver) => <Badge>{driver.licenseStatus}</Badge> },
                { key: 'joined', header: 'Joined', render: (driver) => driver.joined ? new Date(driver.joined).toLocaleDateString() : '—' },
                { key: 'earnings', header: 'Earnings', render: (driver) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(driver.totalEarnings)}</strong> },
                { key: 'rating', header: 'Rating', render: (driver) => driver.rating ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="star" size={13} color="var(--tk-warning)" />{driver.rating.toFixed(1)}</span> : <span className="tk-meta">—</span> },
                { key: 'actions', header: 'Actions', width: 130, render: (driver) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link to={driverDetailUrl(driver.id)}><Button size="sm" variant="outline">View</Button></Link>
                  <span style={{ position: 'relative' }}><IconButton icon="ellipsis-vertical" onClick={() => setRowMenu(rowMenu === driver.id ? null : driver.id)} />
                    {rowMenu === driver.id && <span style={{ position: 'absolute', right: 0, top: 34, zIndex: 30 }}><DropdownMenu width={205} items={[
                      { label: 'Review License', icon: 'file-check', onClick: () => { setRowMenu(null); setLicenseDriverId(driver.id); } },
                      ...(driver.canReview ? [
                        { label: 'Approve Driver', icon: 'circle-check', onClick: () => openAction('approve', driver) },
                        { label: 'Reject Driver', icon: 'circle-x', tone: 'danger', onClick: () => openAction('reject', driver) },
                      ] : []),
                      ...(driver.canSuspend ? [{ label: 'Suspend Driver', icon: 'user-x', tone: 'danger', onClick: () => openAction('suspend', driver) }] : []),
                      ...(driver.canActivate ? [{ label: 'Reactivate Driver', icon: 'circle-check', onClick: () => openAction('activate', driver) }] : []),
                    ]} /></span>}
                  </span>
                </span> },
              ]} />}
        {tab === 'On Trip' && <p className="tk-meta" style={{ padding: '0 var(--tk-card-pad) 10px' }}>On Trip is filtered from the current page of ACTIVE accounts because the API has no on-trip filter or summary.</p>}
        {(regType !== 'All Types' || company !== 'All Companies' || licenseStatus !== 'All') && <p className="tk-meta" style={{ padding: '0 var(--tk-card-pad) 10px' }}>Registration type, company, and license filters apply to the loaded API page.</p>}
        {tab !== 'Rejected' && !driversQuery.isFetching && !driversQuery.error && <Pagination page={page} pageSize={pageSize} pageCount={pageCount} total={total} onPage={(next) => setPage(Math.max(1, Math.min(pageCount, next)))} onPageSize={(size) => { setPageSize(size); setPage(1); }} />}
      </Card>

      <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)', alignContent: 'start' }}>
        <SectionCard title="Driver Status">
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              ['Active', counts.active], ['Pending Review', counts.pending], ['Inactive', counts.inactive], ['On Trip', null],
            ].map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span className="tk-meta">{label}</span><strong style={{ color: 'var(--tk-ink-900)' }}>{value ?? '—'}</strong></div>)}
            <span className="tk-meta">On-trip totals are not provided by this API.</span>
          </div>
        </SectionCard>
        <SectionCard title="Earnings Overview" description="Last 6 months">
          <EmptyState icon="wallet" title="Earnings data unavailable" description="The admin driver APIs do not provide earnings totals or history." style={{ padding: '24px 8px' }} />
        </SectionCard>
        <SectionCard title="Top Rated Drivers">
          <EmptyState icon="star" title="Ratings data unavailable" description="The admin driver APIs do not provide driver ratings or reviews." style={{ padding: '24px 8px' }} />
        </SectionCard>
        <QuickActionsCard items={[
          { icon: 'user-check', label: 'Review Pending Drivers', hint: 'Verify and approve driver registrations', onClick: () => changeTab('Pending Review') },
          { icon: 'shield-check', label: 'Verify Documents', hint: 'Review a pending driver license', onClick: verifyDocuments },
          { icon: 'file-chart-column', label: 'Driver Compliance Report', hint: 'Not provided by the admin driver API', onClick: () => quickUnavailable('The compliance report') },
          { icon: 'download', label: 'Export Driver List', hint: 'Download the loaded API page', onClick: exportRoster },
        ]} />
      </div>
    </div>

    <Modal open={Boolean(action)} onClose={() => { if (!actionBusy) { setAction(null); setActionError(''); } }} title={action ? actionTitle[action.kind] : ''} description={action?.name} footer={<>
      <Button variant="outline" disabled={actionBusy} onClick={() => { setAction(null); setActionError(''); }}>Cancel</Button>
      <Button disabled={actionBusy || (actionReasonRequired && !reason.trim())} onClick={applyAction}>{actionBusy ? 'Saving…' : 'Confirm'}</Button>
    </>}>
      {actionNeedsReason && <Textarea label={`Reason${actionReasonRequired ? ' (required)' : ' (optional)'}`} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter a reason for this action" />}
      {actionError && <Banner tone="danger" title="Action not completed" style={{ marginTop: 12 }}>{actionError}</Banner>}
    </Modal>

    <Modal open={Boolean(licenseDriverId)} onClose={() => setLicenseDriverId(null)} title="Driver License Review" description={licenseDriverId || undefined} footer={<>
      {!licenseQuery.isFetching && safeDocumentUrl(license?.licenseUrl) && <Button variant="outline" onClick={() => window.open(safeDocumentUrl(license.licenseUrl), '_blank', 'noopener,noreferrer')}>Open Document</Button>}
      {!licenseQuery.isFetching && ['PENDING', 'PENDING_REVIEW'].includes(license?.statusCode) && <>
        <Button variant="outline" disabled={licenseActionState.isLoading} onClick={() => openAction('reject-license', { id: licenseDriverId, name: licenseDriverId })}>Reject License</Button>
        <Button disabled={licenseActionState.isLoading} onClick={() => openAction('approve-license', { id: licenseDriverId, name: licenseDriverId })}>Verify License</Button>
      </>}
    </>}>
      {licenseQuery.isFetching ? <DriverLicenseLoading /> : licenseQuery.error ? <Banner tone="danger" title="Unable to load license">{adminDriverError(licenseQuery.error)}</Banner> : license ? <div style={{ display: 'grid', gap: 12 }}>
        <div><span className="tk-meta">License number</span><p className="tk-body tk-mono">{license.licenseNumber || '—'}</p></div>
        <div><span className="tk-meta">Status</span><p><Badge>{license.status}</Badge></p></div>
        <div><span className="tk-meta">Expires</span><p className="tk-body">{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '—'}</p></div>
        {!license.licenseUrl && <EmptyState icon="file-text" title="No license file provided" description="The license endpoint did not return a document URL." style={{ padding: '18px 8px' }} />}
      </div> : null}
    </Modal>
  </>;
}
