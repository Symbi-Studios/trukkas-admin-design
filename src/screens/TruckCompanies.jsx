'use client';
import { showToast } from '../components/ActionToast.jsx';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';
import { DateRangeFilter, EMPTY_RANGE, inRange } from '../components/DateRangeFilter.jsx';
import { usePageSearchState } from '../components/PageSearch.jsx';
import { FilterMenu } from '../components/FilterMenu.jsx';

import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  DataTable,
  DrawerFacts,
  DrawerSection,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  Pagination,
  SearchField,
  SectionCard,
  SideDrawer,
  Skeleton,
  StatCard,
  StatsPanel,
  TableToolbar,
  ViewToggle,
} from '../ds.js';
import { companyError, useGetAdminCompaniesQuery, useGetAdminCompanyStatsQuery } from '../store/features/companies/companiesApi.js';
import { useResetAdminCompanyScreenVerificationMutation } from '../store/features/companies/companyScreenApi.js';
import { CompaniesLoading } from './CompaniesLoading.jsx';
import { cityOptions, sameCity } from '../store/api/addressCity.js';
import { CompanyActionModal } from './CompanyActionModal.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './Drivers.css';
import './TruckingCompanies.css';

// Account status: can the company use Trukkas right now?
const STATUS_TONE = { Active: 'success', Inactive: 'neutral', Suspended: 'danger', Rejected: 'danger', 'Pending Review': 'warning' };
const STATUSES = ['Active', 'Pending Review', 'Inactive', 'Suspended', 'Rejected'];
// Verification (KYB): have the business documents been checked?
const VERIFICATION_META = {
  Verified: { tone: 'success', icon: 'shield-check' },
  Pending: { tone: 'warning', icon: 'hourglass' },
  Rejected: { tone: 'danger', icon: 'shield-x' },
};
const VERIFICATIONS = ['Verified', 'Pending', 'Rejected'];
const FLEET_SIZES = ['1–15 trucks', '16–30 trucks', '31+ trucks'];

const fmt = (value) => (Number.isFinite(value) ? value.toLocaleString('en-NG') : '—');
const plural = (value, word) => `${fmt(value)} ${word}${value === 1 ? '' : 's'}`;
const detailPath = (id, tab) => `/companies/detail?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;
const isPendingReview = (company) => company.displayStatusCode === 'PENDING_REVIEW';
const isRejected = (company) => company.isRejected === true || company.displayStatusCode === 'REJECTED';

function downloadCsv(rows) {
  const fields = ['name', 'regNo', 'contactName', 'contactPhone', 'contactEmail', 'city', 'location', 'trucks', 'drivers', 'status', 'verification', 'joined'];
  const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? '').replace(/^[=+@-]/, (match) => "'" + match).replaceAll('"', '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'trucking-companies.csv'; anchor.click(); URL.revokeObjectURL(url);
}

function CompanyCell({ company, size = 32 }) {
  return <span className="driver-cell">
    <Avatar name={company.name} size={size} square />
    <span className="driver-cell-text">
      <strong>{company.name}</strong>
      <small>{company.regNo || 'No RC number'}</small>
    </span>
  </span>;
}

function ContactCell({ company }) {
  if (!company.contactName) return <span className="tk-meta">—</span>;
  return <span className="driver-cell">
    <Avatar name={company.contactName} size={28} />
    <span className="driver-cell-text">
      <strong className="tc-contact-name">{company.contactName}</strong>
      <small>{company.contactPhone || company.contactEmail || '—'}</small>
    </span>
  </span>;
}

function VerificationBadge({ value }) {
  const meta = VERIFICATION_META[value];
  if (!value) return <span className="tk-meta">—</span>;
  return <Badge tone={meta?.tone || 'neutral'}><Icon name={meta?.icon || 'shield'} size={11} />{value}</Badge>;
}

function FleetCell({ company }) {
  return <span className="tc-fleet">
    <strong>{company.trucks == null ? '—' : plural(company.trucks, 'truck')}</strong>
    <small>{company.drivers == null ? '—' : plural(company.drivers, 'driver')}</small>
  </span>;
}

function CompanyDrawer({ company: c, canManage, resetting, onClose, onOpen, onOpenFleet, onAction, onMarkPending }) {
  const suspended = c.statusCode === 'SUSPENDED';
  const active = c.statusCode === 'ACTIVE';
  return <SideDrawer
    label="Company details"
    eyebrow="Trucking company"
    onClose={onClose}
    title={<span className="driver-drawer-title"><Avatar name={c.name} size={44} square /><h2 className="tk-title">{c.name}</h2></span>}
    meta={<>
      <Badge tone={STATUS_TONE[c.status] || 'neutral'} dot>{c.status || '—'}</Badge>
      {c.verification && <VerificationBadge value={c.verification} />}
    </>}
    headerActions={<IconButton icon="maximize-2" label="Open full page" onClick={onOpen} />}
    footer={<>
      {(isPendingReview(c) || (canManage && c.verification === 'Verified')) && <div className="tk-drawer-footer-row">
        {isPendingReview(c) && <Button icon="shield-check" onClick={() => onAction('review', c)}>Review Company</Button>}
        {canManage && c.verification === 'Verified' && <Button variant="outline" icon="rotate-ccw" disabled={resetting} onClick={() => onMarkPending(c)}>{resetting ? 'Saving…' : 'Return to Review'}</Button>}
      </div>}
      <div className="tk-drawer-footer-row">
        {active && <Button variant="danger" icon="ban" onClick={() => onAction('suspend', c)}>Suspend</Button>}
        {suspended && <Button variant="outline" icon="circle-check" onClick={() => onAction('activate', c)}>Reactivate</Button>}
        <Button variant="outline" icon="truck" onClick={onOpenFleet}>View Fleet</Button>
        <Button iconRight="maximize-2" onClick={onOpen}>Open Full Page</Button>
      </div>
    </>}
  >
    <DrawerSection title="Contact person">
      {c.contactName ? <div className="tc-drawer-contact">
        <Avatar name={c.contactName} size={36} />
        <span className="driver-cell-text"><strong>{c.contactName}</strong><small>Primary contact</small></span>
      </div> : <p className="tk-meta" style={{ margin: 0 }}>No contact person on file.</p>}
      <DrawerFacts items={[
        { label: 'Phone', value: c.contactPhone },
        { label: 'Joined', value: c.joined },
        { label: 'Email', value: c.contactEmail, wide: true },
      ]} />
    </DrawerSection>

    <DrawerSection title="Business">
      <DrawerFacts items={[
        { label: 'RC number', value: c.regNo ? <span className="tk-mono">{c.regNo}</span> : '—' },
        { label: 'City', value: c.city },
        { label: 'Address', value: c.location, wide: true },
      ]} />
    </DrawerSection>

    <DrawerSection title="Fleet & activity">
      <DrawerFacts items={[
        { label: 'Trucks', value: fmt(c.trucks), sub: c.activeTrucks != null ? `${fmt(c.activeTrucks)} active` : undefined },
        { label: 'Drivers', value: fmt(c.drivers) },
        { label: 'Total jobs', value: fmt(c.totalJobs) },
        { label: 'Completed jobs', value: fmt(c.completedJobs) },
      ]} />
    </DrawerSection>
  </SideDrawer>;
}

export function TruckCompanies() {
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.signedIn));
  return <CompaniesDirectory key={String(owner) + ':' + String(role) + ':' + authenticated} />;
}

function CompaniesDirectory() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.signedIn));
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const canManage = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role);
  const directoryQuery = useGetAdminCompaniesQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const statsQuery = useGetAdminCompanyStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [resetVerification, resetState] = useResetAdminCompanyScreenVerificationMutation();
  const resetting = useRef(false);

  const [tableView, setTableView] = useState('list');
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = usePageSearchState('', () => setPage(1));
  const [status, setStatus] = useState('All Status');
  const [verification, setVerification] = useState('All Verification');
  const [city, setCity] = useState('All Cities');
  const [fleet, setFleet] = useState('All Fleet Sizes');
  const [joined, setJoined] = useState(EMPTY_RANGE);
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [action, setAction] = useState(null);

  const companies = useMemo(() => directoryQuery.error ? [] : directoryQuery.currentData || [], [directoryQuery.currentData, directoryQuery.error]);
  const cities = useMemo(() => cityOptions(companies), [companies]);
  const filtered = useMemo(() => companies.filter((company) => {
    const needle = query.trim().toLowerCase();
    const queryMatch = !needle || [company.name, company.regNo, company.contactName, company.contactPhone, company.contactEmail, company.city].some((value) => value?.toLowerCase().includes(needle));
    const statusMatch = status === 'All Status' || (status === 'Pending Review' ? isPendingReview(company) : status === 'Rejected' ? isRejected(company) : company.status === status);
    const verificationMatch = verification === 'All Verification' || company.verification === verification;
    const fleetMatch = fleet === 'All Fleet Sizes' || (company.trucks != null && (fleet === '1–15 trucks' ? company.trucks >= 1 && company.trucks <= 15 : fleet === '16–30 trucks' ? company.trucks >= 16 && company.trucks <= 30 : company.trucks > 30));
    return queryMatch && statusMatch && verificationMatch && (city === 'All Cities' || sameCity(company.city, city)) && fleetMatch && inRange(company.joinedAt, joined);
  }), [companies, city, fleet, joined, query, status, verification]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = companies.find((company) => company.id === selectedId) || null;
  const filtersActive = Boolean(query.trim()) || status !== 'All Status' || verification !== 'All Verification' || city !== 'All Cities' || fleet !== 'All Fleet Sizes' || Boolean(joined?.from || joined?.to);

  const stats = statsQuery.error ? {} : statsQuery.currentData || {};
  const statsLoading = !statsQuery.currentData && statsQuery.isFetching;
  const metric = (value) => (statsLoading ? <Skeleton as="span" width={54} height={23} /> : fmt(value));

  function resetFilters() {
    setQuery(''); setStatus('All Status'); setVerification('All Verification'); setCity('All Cities'); setFleet('All Fleet Sizes'); setJoined(EMPTY_RANGE); setPage(1);
  }
  const filterChange = (setter) => (value) => { setter(value); setPage(1); };

  async function markPending(company) {
    if (resetting.current || !canManage) return;
    resetting.current = true;
    try { await resetVerification({ id: company.id, owner, role }).unwrap(); showToast(`${company.name} returned to pending review.`); }
    catch (error) { showToast(companyError(error)); }
    finally { resetting.current = false; }
  }

  if (!directoryQuery.currentData && (directoryQuery.isLoading || directoryQuery.isFetching)) return <CompaniesLoading />;

  const columns = [
    { key: 'company', header: 'Company', render: (row) => <CompanyCell company={row} /> },
    { key: 'status', header: 'Status', render: (row) => <Badge dot tone={STATUS_TONE[row.status] || 'neutral'}>{row.status || '—'}</Badge> },
    { key: 'contact', header: 'Contact Person', render: (row) => <ContactCell company={row} /> },
    { key: 'city', header: 'City', render: (row) => row.city || <span className="tk-meta">—</span> },
    { key: 'fleet', header: 'Fleet', render: (row) => <FleetCell company={row} /> },
    { key: 'verification', header: 'Verification', render: (row) => <VerificationBadge value={row.verification} /> },
    { key: 'joined', header: 'Joined', render: (row) => <span className="driver-joined">{row.joined || '—'}</span> },
  ];

  return <div className="tc-page drivers-page">
    <PageHeader crumbs={['Users', 'Truck Companies']} title="Trucking Companies" description="Review, verify and manage all registered trucking companies on Trukkas." />
    {directoryQuery.error && <Banner tone="danger" title="Unable to load companies">{companyError(directoryQuery.error)}<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}
    {statsQuery.error && <Banner tone="warning" title="Company summary unavailable">{companyError(statsQuery.error)}<Button variant="outline" onClick={statsQuery.refetch}>Retry</Button></Banner>}
    {companies.some((company) => company.profileUnavailable) && <Banner tone="warning" title="Some company details unavailable">Some company profiles could not be loaded. RC numbers, addresses, joined dates and verification status may be incomplete.<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}

    <StatsPanel title="Trucking Companies" fixedLabel="All time" fixedHint="Company totals cover all time; the trucking company stats API can’t be filtered by date yet.">
      <StatCard icon="building-2" tint="blue" label="Total Companies" value={metric(stats.total)} caption={stats.active != null ? `${fmt(stats.active)} active` : undefined} />
      <StatCard icon="hourglass" tint="amber" label="Pending Review" value={metric(stats.pending)} caption="Waiting for approval" />
      <StatCard icon="shield-check" tint="green" label="Verified" value={metric(stats.verified)} caption="Documents approved" />
      <StatCard icon="ban" tint="red" label="Suspended" value={metric(stats.suspended)} caption="Can’t take jobs" />
      <StatCard icon="truck" tint="navy" label="Trucks" value={metric(stats.trucks)}
        caption={stats.activeTrucks != null || stats.drivers != null ? `${fmt(stats.activeTrucks)} active · ${fmt(stats.drivers)} drivers` : undefined} />
    </StatsPanel>

    <SectionCard pad="none">
      <TableToolbar
        viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
        search={<SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies…" title="Search by company, RC number, contact or city" />}
        filters={<>
          <FilterMenu name="Status" icon="circle-dot" value={status} allValue="All Status" options={STATUSES} open={openMenu === 'Status'} setOpen={setOpenMenu} onChange={filterChange(setStatus)} />
          <FilterMenu name="Verification" icon="shield-check" value={verification} allValue="All Verification" options={VERIFICATIONS} open={openMenu === 'Verification'} setOpen={setOpenMenu} onChange={filterChange(setVerification)} />
          <FilterMenu name="City" icon="map-pin" value={city} allValue="All Cities" options={cities} open={openMenu === 'City'} setOpen={setOpenMenu} onChange={filterChange(setCity)} />
          <FilterMenu name="Fleet" icon="truck" value={fleet} allValue="All Fleet Sizes" options={FLEET_SIZES} open={openMenu === 'Fleet'} setOpen={setOpenMenu} onChange={filterChange(setFleet)} />
          <DateRangeFilter name="Joined" value={joined} onChange={filterChange(setJoined)} />
          {filtersActive && <Button variant="ghost" icon="rotate-ccw" onClick={resetFilters}>Reset</Button>}
        </>}
        trailing={<Button variant="outline" icon="download" disabled={directoryQuery.isFetching || Boolean(directoryQuery.error) || !filtered.length} onClick={() => downloadCsv(filtered)}>Export</Button>}
      />

      {directoryQuery.isFetching && <DriverLoadingNotice>Refreshing companies…</DriverLoadingNotice>}
      {directoryQuery.isFetching ? <DriverTableLoading columns={columns.length} label="Loading companies" />
        : directoryQuery.error ? null
          : !filtered.length && tableView !== 'board' ? <EmptyState icon="building-2" title="No companies found" description={filtersActive ? 'Try different filters or search terms.' : 'Trucking companies appear here once they register.'} />
            : <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.companies} view={tableView} boardGroupBy={(row) => row.status}
              boardOnRowClick={(row) => setSelectedId(row.id)} onRowClick={(row) => setSelectedId(row.id)}
              rows={visible} rowKey={(row) => row.id} columns={columns} />}
      {!directoryQuery.isFetching && !directoryQuery.error && <Pagination page={currentPage} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />}
    </SectionCard>

    {selected && <CompanyDrawer
      key={selected.id}
      company={selected}
      canManage={canManage}
      resetting={resetState.isLoading}
      onClose={() => setSelectedId(null)}
      onOpen={() => navigate(detailPath(selected.id))}
      onOpenFleet={() => navigate(detailPath(selected.id, 'trucks'))}
      onAction={(kind, company) => setAction({ kind, company })}
      onMarkPending={markPending}
    />}
    {action && <CompanyActionModal key={`${action.company.id}-${action.kind}`} action={action} onClose={() => setAction(null)} onDone={(message) => showToast(message)} />}
  </div>;
}
