'use client';
import { showToast } from '../components/ActionToast.jsx';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';
import { usePageSearchState } from '../components/PageSearch.jsx';
import { FilterMenu } from '../components/FilterMenu.jsx';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../router.js';
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  TableToolbar,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  IconButton,
  Avatar,
  Icon,
  Banner,
  EmptyState,
  Modal,
  Textarea,
  Skeleton,
  StatsPanel,
  Tabs,
  ViewToggle,
  SideDrawer,
  DrawerSection,
  DrawerFacts,
} from '../ds.js';
import { DriverLicenseLoading, DriverLoadingNotice, DriverTableLoading, DriversLoading } from './DriversLoading.jsx';
import {
  DRIVER_LICENSE_FILTERS,
  adminDriverError, useActivateAdminDriverMutation, useGetAdminDriversQuery, useGetAdminDriverTabStatsQuery,
  useGetAdminDriverLicenseQuery, useGetAdminDriverStatsQuery,
  useReviewAdminDriverMutation,
  useSuspendAdminDriverMutation, useVerifyAdminDriverLicenseMutation,
  useGetAdminDriverCompaniesQuery,
} from '../store/features/drivers/driversApi.js';
import './Drivers.css';

const TABS = {
  company: { label: 'Company Drivers', single: 'company driver', query: 'company' },
  individual: { label: 'Individual Drivers', single: 'individual driver', query: 'individual' },
};
const STATUS_TONE = { 'Pending Review': 'warning', 'Pending Profile': 'warning', Rejected: 'danger', Active: 'success', 'On Trip': 'info', Inactive: 'neutral' };
const STATUSES = ['Active', 'On Trip', 'Pending Review', 'Pending Profile', 'Inactive', 'Rejected'];
const STATUS_QUERY = {
  Active: 'ACTIVE', 'On Trip': 'ON_TRIP', Inactive: 'INACTIVE',
  'Pending Profile': 'PENDING_PROFILE', 'Pending Review': 'PENDING_REVIEW', Rejected: 'REJECTED',
};
const LICENSE_OPTIONS = Object.keys(DRIVER_LICENSE_FILTERS);
const fmt = (value) => (Number.isFinite(value) ? value.toLocaleString('en-NG') : '—');
const day = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};

function safeDocumentUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const driverDetailUrl = (id) => `/drivers/detail?id=${encodeURIComponent(id)}`;
const companyDetailUrl = (id) => `/companies/detail?id=${encodeURIComponent(id)}`;
const truckDetailUrl = (id) => `/fleet/detail?id=${encodeURIComponent(id)}`;

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function DriverCell({ driver }) {
  return <span className="driver-cell">
    <Avatar name={driver.name} src={driver.avatarUrl || undefined} size={32} />
    <span className="driver-cell-text">
      <strong>{driver.name}</strong>
      <small>{driver.phone || driver.email || '—'}</small>
    </span>
  </span>;
}

function CompanyChip({ name, size = 24 }) {
  if (!name) return <span className="tk-meta">—</span>;
  return <span className="driver-company"><Avatar name={name} size={size} square /><span>{name}</span></span>;
}

function TruckPlate({ plate }) {
  if (!plate) return <span className="driver-no-truck">No truck</span>;
  return <span className="driver-plate"><Icon name="truck" size={12} /><span>{plate}</span></span>;
}

function LicenseBadge({ driver, showExpiry = true }) {
  const state = driver.licenseState;
  return <span className="driver-license">
    <Badge tone={state.tone}><Icon name={state.icon} size={11} />{state.label}</Badge>
    {showExpiry && driver.licenseExpiresAt && <small>Exp. {day(driver.licenseExpiresAt)}</small>}
  </span>;
}

function Rating({ driver }) {
  if (driver.rating == null) return <span className="tk-meta">No ratings</span>;
  return <span className="driver-rating"><span aria-hidden="true">★</span>{driver.rating.toFixed(1)}<small>({fmt(driver.reviews)})</small></span>;
}

function DriverDrawer({ driver: d, companyTab, onClose, onOpen, onAction, onReviewLicense, navigate }) {
  const licenseAwaiting = d.licenseState.label === 'Awaiting review';
  return <SideDrawer
    label="Driver details"
    eyebrow={companyTab ? 'Company driver' : 'Individual driver'}
    onClose={onClose}
    title={<span className="driver-drawer-title"><Avatar name={d.name} src={d.avatarUrl || undefined} size={44} /><h2 className="tk-title">{d.name}</h2></span>}
    meta={<>
      <Badge tone={STATUS_TONE[d.status] || 'neutral'} dot>{d.status}</Badge>
      <Badge tone={d.licenseState.tone}><Icon name={d.licenseState.icon} size={11} />License {d.licenseState.label.toLowerCase()}</Badge>
    </>}
    headerActions={<IconButton icon="maximize-2" label="Open full page" onClick={onOpen} />}
    footer={<>
      {(d.canReview || licenseAwaiting) && <div className="tk-drawer-footer-row">
        {licenseAwaiting && <Button variant={d.canReview ? 'outline' : 'primary'} icon="file-check" onClick={onReviewLicense}>Review License</Button>}
        {d.canReview && <>
          <Button variant="outline" icon="circle-x" onClick={() => onAction('reject', d)}>Reject</Button>
          <Button icon="circle-check" onClick={() => onAction('approve', d)}>Approve Driver</Button>
        </>}
      </div>}
      <div className="tk-drawer-footer-row">
        {d.canSuspend && <Button variant="danger" icon="ban" onClick={() => onAction('suspend', d)}>Suspend</Button>}
        {d.canActivate && <Button variant="outline" icon="circle-check" onClick={() => onAction('activate', d)}>Reactivate</Button>}
        <Button iconRight="maximize-2" onClick={onOpen}>Open Full Page</Button>
      </div>
    </>}
  >
    {d.rejectionReason && <Banner inline tone="danger" title="Application rejected">{d.rejectionReason}</Banner>}

    <DrawerSection title="Contact">
      <DrawerFacts items={[
        { label: 'Phone', value: d.phone },
        { label: 'Joined', value: day(d.joined) },
        { label: 'Email', value: d.email, wide: true },
      ]} />
    </DrawerSection>

    {companyTab && <DrawerSection title="Company">
      {d.company ? <button type="button" className="driver-drawer-link" disabled={!d.linkedCompanyId} onClick={() => navigate(companyDetailUrl(d.linkedCompanyId))}>
        <CompanyChip name={d.company} size={32} />
        {d.companyEmail && <small>{d.companyEmail}</small>}
        {d.linkedCompanyId && <Icon name="chevron-right" size={14} />}
      </button> : <p className="tk-meta" style={{ margin: 0 }}>Not linked to a company.</p>}
    </DrawerSection>}

    <DrawerSection title="Assigned truck">
      <div className="driver-drawer-truck">
        <TruckPlate plate={d.truckPlate} />
        {d.truckId && <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => navigate(truckDetailUrl(d.truckId))}>View truck</Button>}
      </div>
    </DrawerSection>

    <DrawerSection title="License">
      <DrawerFacts items={[
        { label: 'Status', value: <LicenseBadge driver={d} showExpiry={false} /> },
        { label: 'Expires', value: day(d.licenseExpiresAt) },
        { label: 'License number', value: d.license ? <span className="tk-mono">{d.license}</span> : '—' },
        { label: 'Class', value: d.licenseClass },
      ]} />
    </DrawerSection>

    <DrawerSection title="At a glance">
      <DrawerFacts items={[
        { label: 'Total jobs', value: fmt(d.totalJobs) },
        { label: 'Rating', value: <Rating driver={d} /> },
      ]} />
    </DrawerSection>
  </SideDrawer>;
}

export function Drivers() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('type') === 'individual' ? 'individual' : 'company');
  const [tableView, setTableView] = useState('list');
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = usePageSearchState('', () => setPage(1));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [company, setCompany] = useState('All Companies');
  const [licenseFilter, setLicenseFilter] = useState('All Licenses');
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [licenseDriverId, setLicenseDriverId] = useState(null);
  const actionLock = useRef(false);
  const companyTab = tab === 'company';

  const companiesQuery = useGetAdminDriverCompaniesQuery();
  const companyRecords = companiesQuery.currentData || [];
  const companyOptions = companyRecords.map((item) => ({ ...item, label: companyRecords.filter((other) => other.name === item.name).length > 1 ? `${item.name} · ${item.email || item.id}` : item.name }));
  const filters = {
    search,
    registrationType: TABS[tab].query,
    status: STATUS_QUERY[status],
    onTrip: status === 'Active' ? false : undefined,
    companyId: companyTab ? companyOptions.find((item) => item.label === company)?.id : undefined,
    ...(DRIVER_LICENSE_FILTERS[licenseFilter] || {}),
  };

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const driversQuery = useGetAdminDriversQuery({ ...filters, page, limit: pageSize });
  const tabStatsQuery = useGetAdminDriverTabStatsQuery(TABS[tab].query);
  const statsQuery = useGetAdminDriverStatsQuery();
  const licenseQuery = useGetAdminDriverLicenseQuery(licenseDriverId, { skip: !licenseDriverId });
  const license = licenseQuery.currentData;
  const [reviewDriver, reviewState] = useReviewAdminDriverMutation();
  const [verifyLicense, licenseActionState] = useVerifyAdminDriverLicenseMutation();
  const [suspendDriver, suspendState] = useSuspendAdminDriverMutation();
  const [activateDriver, activateState] = useActivateAdminDriverMutation();
  const actionBusy = reviewState.isLoading || licenseActionState.isLoading || suspendState.isLoading || activateState.isLoading;

  const drivers = useMemo(() => driversQuery.currentData?.drivers || [], [driversQuery.currentData]);
  const selected = drivers.find((driver) => driver.id === selectedId) || null;
  const pageCount = driversQuery.currentData?.pagination.totalPages || 1;
  const total = driversQuery.currentData?.pagination.total;
  const tabStats = tabStatsQuery.currentData;
  const tabStatsLoading = !tabStats && tabStatsQuery.isFetching;
  const tabCounts = { company: statsQuery.data?.company, individual: statsQuery.data?.individual };
  const metric = (value) => (tabStatsLoading ? <Skeleton as="span" width={54} height={23} /> : fmt(value));
  const licenseIssues = tabStats && tabStats.expired != null && tabStats.expiringSoon != null ? tabStats.expired + tabStats.expiringSoon : null;
  const filtersActive = Boolean(q.trim()) || status !== 'All Status' || company !== 'All Companies' || licenseFilter !== 'All Licenses';

  function switchTab(value) {
    setTab(value);
    setCompany('All Companies');
    setPage(1);
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'individual') params.set('type', 'individual'); else params.delete('type');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }
  function resetFilters() {
    setQ(''); setStatus('All Status'); setCompany('All Companies'); setLicenseFilter('All Licenses'); setPage(1);
  }

  function exportRoster() {
    const header = ['Driver', 'Phone', 'Email', ...(companyTab ? ['Company'] : []), 'Truck', 'Status', 'License', 'License Expiry', 'Total Jobs', 'Rating', 'Joined'];
    const rows = drivers.map((d) => [d.name, d.phone, d.email, ...(companyTab ? [d.company] : []), d.truckPlate, d.status, d.licenseState.label, d.licenseExpiresAt?.slice(0, 10), d.totalJobs, d.rating, d.joined?.slice(0, 10)]);
    download(`${tab}-drivers.csv`, [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n'));
  }

  function openAction(kind, driver) {
    setAction({ kind, id: driver.id, name: driver.name, reviewPath: driver.reviewPath });
    setReason('');
    setActionError('');
  }

  async function applyAction() {
    if (!action || actionBusy || actionLock.current) return;
    if (action.kind === 'suspend' && !reason.trim()) {
      setActionError('A reason is required to suspend a driver.');
      return;
    }
    setActionError('');
    actionLock.current = true;
    try {
      if (action.kind === 'approve' || action.kind === 'reject') await reviewDriver({ id: action.id, decision: action.kind, reason, reviewPath: action.reviewPath }).unwrap();
      if (action.kind === 'approve-license' || action.kind === 'reject-license') await verifyLicense({ id: action.id, decision: action.kind === 'approve-license' ? 'approve' : 'reject', reason }).unwrap();
      if (action.kind === 'suspend') await suspendDriver({ id: action.id, reason: reason.trim() }).unwrap();
      if (action.kind === 'activate') await activateDriver(action.id).unwrap();
      showToast(`${action.name} ${actionSuccess[action.kind]}.`);
      setAction(null);
      setReason('');
      if (action.kind.endsWith('license')) setLicenseDriverId(null);
    } catch (error) {
      setActionError(adminDriverError(error));
    } finally {
      actionLock.current = false;
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
  const licenseDriver = drivers.find((driver) => driver.id === licenseDriverId);

  if (!driversQuery.data && driversQuery.isFetching) return <DriversLoading />;

  const columns = [
    { key: 'name', header: 'Driver', render: (d) => <DriverCell driver={d} /> },
    ...(companyTab ? [{ key: 'company', header: 'Company', render: (d) => <CompanyChip name={d.company} /> }] : []),
    { key: 'truckPlate', header: 'Truck', render: (d) => <TruckPlate plate={d.truckPlate} /> },
    { key: 'status', header: 'Status', render: (d) => <Badge dot tone={STATUS_TONE[d.status] || 'neutral'}>{d.status}</Badge> },
    { key: 'licenseStatus', header: 'License', render: (d) => <LicenseBadge driver={d} /> },
    { key: 'totalJobs', header: 'Jobs', align: 'right', render: (d) => fmt(d.totalJobs) },
    { key: 'rating', header: 'Rating', render: (d) => <Rating driver={d} /> },
    { key: 'joined', header: 'Joined', render: (d) => <span className="driver-joined">{day(d.joined)}</span> },
  ];

  return <div className="drivers-page">
    <PageHeader
      crumbs={['Users', 'Drivers']}
      title="Drivers"
      description="Company drivers and independent drivers, with their license status."
    />


    <StatsPanel title={TABS[tab].label} fixedLabel="All time" fixedHint="Counts cover every driver of this type; driver stats can’t be filtered by date yet.">
      <StatCard icon={companyTab ? 'building-2' : 'user-round'} tint="blue" label="Total Drivers" value={metric(tabStats?.total)}
        caption={tabStats?.active != null ? `${fmt(tabStats.active)} active` : undefined} />
      <StatCard icon="route" tint="teal" label="On a Trip" value={metric(tabStats?.onTrip)} caption="Driving right now" />
      <StatCard icon="user-check" tint="amber" label="Pending Review" value={metric(tabStats?.pendingReview)} caption="Waiting for approval" />
      <StatCard icon="file-check" tint="purple" label="License Awaiting Review" value={metric(tabStats?.awaitingLicense)} caption="Submitted, not yet checked" />
      <StatCard icon="calendar-x" tint="red" label="License Issues" value={metric(licenseIssues)}
        caption={tabStats?.expired != null ? `${fmt(tabStats.expired)} expired · ${fmt(tabStats.expiringSoon)} expiring soon` : undefined} />
    </StatsPanel>

    <SectionCard pad="none">
      <Tabs
        value={tab}
        onChange={switchTab}
        items={Object.entries(TABS).map(([value, meta]) => ({ value, label: meta.label, count: tabCounts[value] ?? undefined }))}
        style={{ padding: '0 16px' }}
      />
      <TableToolbar
        viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
        search={<SearchField placeholder={companyTab ? 'Search name, phone, plate, company...' : 'Search name, phone or plate...'} value={q} onChange={(event) => setQ(event.target.value)} />}
        filters={<>
          <FilterMenu name="Status" icon="circle-dot" value={status} allValue="All Status" options={STATUSES} open={openMenu === 'Status'} setOpen={setOpenMenu} onChange={(value) => { setStatus(value); setPage(1); }} />
          {companyTab && <FilterMenu name="Company" icon="building-2" value={company} allValue="All Companies" options={companyOptions.map((item) => item.label).sort()} open={openMenu === 'Company'} setOpen={setOpenMenu} onChange={(value) => { setCompany(value); setPage(1); }} />}
          <FilterMenu name="License" icon="id-card" value={licenseFilter} allValue="All Licenses" options={LICENSE_OPTIONS} open={openMenu === 'License'} setOpen={setOpenMenu} onChange={(value) => { setLicenseFilter(value); setPage(1); }} />
          {filtersActive && <Button variant="ghost" icon="rotate-ccw" onClick={resetFilters}>Reset</Button>}
        </>}
        trailing={<Button variant="outline" icon="download" disabled={driversQuery.isFetching || !drivers.length} onClick={exportRoster}>Export</Button>}
      />

      {driversQuery.isFetching && driversQuery.data && <DriverLoadingNotice>Loading drivers…</DriverLoadingNotice>}
      {driversQuery.isFetching ? <DriverTableLoading columns={columns.length} />
        : driversQuery.error ? <div style={{ padding: 'var(--tk-card-pad)' }}><Banner tone="danger" title="Unable to load drivers">{adminDriverError(driversQuery.error)}</Banner><Button variant="outline" onClick={() => driversQuery.refetch()}>Retry</Button></div>
          : drivers.length === 0 && tableView !== 'board' ? <EmptyState icon="users" title={`No ${TABS[tab].label.toLowerCase()} found`} description={filtersActive ? 'Try different filters or search terms.' : `${TABS[tab].label} appear here once they register.`} />
            : <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.drivers} view={tableView} boardGroupBy={(row) => row.status}
              boardOnRowClick={(row) => setSelectedId(row.id)} onRowClick={(row) => setSelectedId(row.id)}
              rows={drivers} rowKey={(driver) => driver.id} columns={columns} />}
      {!driversQuery.isFetching && !driversQuery.error && <Pagination page={page} pageSize={pageSize} pageCount={pageCount} total={total} onPage={(next) => setPage(Math.max(1, Math.min(pageCount, next)))} onPageSize={(size) => { setPageSize(size); setPage(1); }} />}
    </SectionCard>

    {selected && <DriverDrawer
      key={selected.id}
      driver={selected}
      companyTab={companyTab}
      navigate={navigate}
      onClose={() => setSelectedId(null)}
      onOpen={() => navigate(driverDetailUrl(selected.id))}
      onAction={openAction}
      onReviewLicense={() => setLicenseDriverId(selected.id)}
    />}

    <Modal open={Boolean(action)} onClose={() => { if (!actionBusy) { setAction(null); setActionError(''); } }} title={action ? actionTitle[action.kind] : ''} description={action?.name} footer={<>
      <Button variant="outline" disabled={actionBusy} onClick={() => { setAction(null); setActionError(''); }}>Cancel</Button>
      <Button disabled={actionBusy || (actionReasonRequired && !reason.trim())} onClick={applyAction}>{actionBusy ? 'Saving…' : 'Confirm'}</Button>
    </>}>
      {actionNeedsReason && <Textarea label={`Reason${actionReasonRequired ? ' (required)' : ' (optional)'}`} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter a reason for this action" />}
      {actionError && <Banner tone="danger" title="Action not completed" style={{ marginTop: 12 }}>{actionError}</Banner>}
    </Modal>

    <Modal open={Boolean(licenseDriverId)} onClose={() => setLicenseDriverId(null)} title="Driver License Review" description={licenseDriver?.name || undefined} footer={<>
      {!licenseQuery.isFetching && safeDocumentUrl(license?.licenseUrl) && <Button variant="outline" onClick={() => window.open(safeDocumentUrl(license.licenseUrl), '_blank', 'noopener,noreferrer')}>Open Document</Button>}
      {!licenseQuery.isFetching && ['PENDING', 'PENDING_REVIEW', 'SUBMITTED'].includes(license?.statusCode) && <>
        <Button variant="outline" disabled={licenseActionState.isLoading} onClick={() => openAction('reject-license', { id: licenseDriverId, name: licenseDriver?.name || 'Driver' })}>Reject License</Button>
        <Button disabled={licenseActionState.isLoading} onClick={() => openAction('approve-license', { id: licenseDriverId, name: licenseDriver?.name || 'Driver' })}>Verify License</Button>
      </>}
    </>}>
      {licenseQuery.isFetching ? <DriverLicenseLoading /> : licenseQuery.error ? <Banner tone="danger" title="Unable to load license">{adminDriverError(licenseQuery.error)}</Banner> : license ? <div style={{ display: 'grid', gap: 12 }}>
        <div><span className="tk-meta">License number</span><p className="tk-body tk-mono">{license.licenseNumber || '—'}</p></div>
        <div><span className="tk-meta">Status</span><p><Badge>{license.status}</Badge></p></div>
        <div><span className="tk-meta">Expires</span><p className="tk-body">{day(license.expiresAt)}</p></div>
        {!license.licenseUrl && <EmptyState icon="file-text" title="No license file provided" description="The license document is not available." style={{ padding: '18px 8px' }} />}
      </div> : null}
    </Modal>
  </div>;
}
