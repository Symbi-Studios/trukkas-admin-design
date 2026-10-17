'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from '../router.js';
import { Avatar, Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, IconButton, Modal, PageHeader, Pagination, SearchField, Select, Skeleton, StatCard, Tabs, TextField } from '../ds.js';
import { companyError, useGetAdminCompaniesQuery, useGetAdminPendingCompaniesQuery, useGetAdminCompanyStatsQuery, useGetAdminCompanyPerformanceQuery, useCreateAdminCompanyMutation } from '../store/features/companies/companiesApi.js';
import { useResetAdminCompanyScreenVerificationMutation } from '../store/features/companies/companyScreenApi.js';
import { CompaniesLoading } from './CompaniesLoading.jsx';
import { CompanyActionModal } from './CompanyActionModal.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './TruckingCompanies.css';

const tone = { Active: 'success', Inactive: 'neutral', Suspended: 'danger', Verified: 'success', Pending: 'warning', Rejected: 'danger', 'Pending Review': 'warning' };
const blank = { name: '', regNo: '', contactName: '', contactPhone: '', contactEmail: '', location: '' };
function downloadCsv(rows) {
  const fields = ['name', 'regNo', 'contactName', 'contactPhone', 'contactEmail', 'location', 'trucks', 'drivers', 'status', 'verification'];
  const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? '').replace(/^[=+@-]/, match => "'"+match).replaceAll('"', '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'trucking-companies.csv'; anchor.click(); URL.revokeObjectURL(url);
}
const detailPath = (id, tab) => `/companies/detail?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;

export function TruckCompanies() {
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <CompaniesDirectory key={String(owner)+':'+String(role)+':'+authenticated} />;
}
function CompaniesDirectory() {
  const navigate = useNavigate();
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const canCreate = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role);
  const directoryQuery = useGetAdminCompaniesQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const pendingQuery = useGetAdminPendingCompaniesQuery(owner, { skip: !authenticated });
  const payoutsQuery = useGetAdminCompanyStatsQuery(owner, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [allRankings, setAllRankings] = useState(false);
  const rankingsQuery = useGetAdminCompanyPerformanceQuery({ owner, role, all: allRankings }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [createCompany, createState] = useCreateAdminCompanyMutation();
  const [createError, setCreateError] = useState(null);
  const creating = useRef(false), active = useRef(true), menuRoot = useRef(null);
  const [menuPosition, setMenuPosition] = useState({});
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [resetVerification, resetState] = useResetAdminCompanyScreenVerificationMutation();
  async function markPending(company) {
    setMenuFor(null);
    if (creating.current || !canCreate) return;
    creating.current = true;
    try { await resetVerification({ id: company.id, owner, role }).unwrap(); if (active.current) setNotice('Company returned to pending review.'); }
    catch (error) { if (active.current) setNotice(companyError(error)); }
    finally { creating.current = false; }
  }
  const [tab, setTab] = useState('All Companies'), [query, setQuery] = useState(''), [status, setStatus] = useState('All Statuses'), [location, setLocation] = useState('All Locations'), [fleet, setFleet] = useState('All Fleet Sizes'), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [selected, setSelected] = useState([]), [menuFor, setMenuFor] = useState(null), [addOpen, setAddOpen] = useState(false), [form, setForm] = useState(blank), [action, setAction] = useState(null), [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    const outside = event => { if (!menuRoot.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [menuFor]);
  const companies = directoryQuery.error ? [] : directoryQuery.currentData || [];
  const locations = useMemo(() => [...new Set(companies.map((company) => company.location).filter(Boolean))], [companies]);
  const filtered = useMemo(() => companies.filter((company) => {
    const needle = query.toLowerCase();
    const queryMatch = !needle || [company.name, company.regNo, company.contactName, company.contactPhone, company.contactEmail].some((value) => value?.toLowerCase().includes(needle));
    const tabMatch = tab === 'All Companies' || (tab === 'Pending Review' ? company.displayStatusCode === 'PENDING_REVIEW' : tab === 'Suspended' ? company.statusCode === 'SUSPENDED' : tab === 'Rejected' ? company.isRejected === true || company.displayStatusCode === 'REJECTED' : company.verification === tab);
    const fleetMatch = fleet === 'All Fleet Sizes' || (company.trucks != null && (fleet === '1–15 trucks' ? company.trucks >= 1 && company.trucks <= 15 : fleet === '16–30 trucks' ? company.trucks >= 16 && company.trucks <= 30 : company.trucks > 30));
    return queryMatch && tabMatch && (status === 'All Statuses' || company.status === status) && (location === 'All Locations' || company.location === location) && fleetMatch;
  }), [companies, fleet, location, query, status, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const stats = payoutsQuery.error ? {} : payoutsQuery.currentData || {};
  const paidOut = stats.paidOut;
  const comparison = key => stats.changes?.[key] || { delta: '—', direction: null };
  const rankings = authenticated && !rankingsQuery.error ? rankingsQuery.currentData : null;
  const recent = directoryQuery.currentData && !directoryQuery.error && companies.every(company => company.joinedAt && Number.isFinite(Date.parse(company.joinedAt))) ? [...companies].sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt)).slice(0, 5) : null;
  const tabs = [{ value: 'All Companies', label: 'All Companies', count: stats.total ?? '—' }, { value: 'Pending Review', label: 'Pending Review', count: stats.pending ?? '—' }, { value: 'Verified', label: 'Verified', count: stats.verified ?? '—' }, { value: 'Suspended', label: 'Suspended', count: stats.suspended ?? '—' }, { value: 'Rejected', label: 'Rejected', count: stats.rejected ?? '—' }];
  const value = (number) => number == null ? '—' : number.toLocaleString();
  const startAction = (company, kind) => { setMenuFor(null); setAction({ company, kind }); };
  async function addCompany() {
    if (creating.current) return;
    if (!canCreate) return setCreateError('Your account cannot create companies.');
    creating.current = true; setCreateError(null);
    try {
      const created = await createCompany(form).unwrap();
      if (!active.current) return;
      setAddOpen(false); setForm(blank);
      const delivery = v => v === true ? 'sent' : v === false ? 'failed' : 'unconfirmed';
      setNotice(`Company created and queued for review. Invitation SMS: ${delivery(created.sms)}; email: ${delivery(created.email)}.`);
    } catch (error) { if (active.current) setCreateError(companyError(error)); }
    finally { creating.current = false; }
  }
  if (!directoryQuery.currentData && (directoryQuery.isLoading || directoryQuery.isFetching)) return <CompaniesLoading />;
  return <div className="tc-page">
    <PageHeader crumbs={['Companies', 'Trucking Companies']} title="Trucking Companies" description="Review, verify and manage all registered trucking companies on Trukkas." actions={<><Button variant="outline" icon="download" disabled={directoryQuery.isFetching || Boolean(directoryQuery.error)} onClick={() => downloadCsv(filtered)}>Export</Button><Button icon="plus" onClick={() => { setCreateError(null); setAddOpen(true); }}>Add Company</Button></>} />
    {directoryQuery.error && <Banner tone="danger" title="Unable to load companies">{companyError(directoryQuery.error)}<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}
    {pendingQuery.error && <Banner tone="warning" title="Pending company information unavailable">{companyError(pendingQuery.error)}<Button variant="outline" onClick={pendingQuery.refetch}>Retry</Button></Banner>}
    {payoutsQuery.error && <Banner tone="warning" title="Company payout summary unavailable">{companyError(payoutsQuery.error)}<Button variant="outline" onClick={payoutsQuery.refetch}>Retry</Button></Banner>}
    {companies.some((company) => company.profileUnavailable) && <Banner tone="warning" title="Some company details unavailable">Some company profiles could not be loaded. RC numbers, addresses, joined dates and verification status may be incomplete.<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}
    {notice && <Banner tone="info" title="Companies">{notice}</Banner>}
    {directoryQuery.isFetching && <DriverLoadingNotice>Refreshing companies…</DriverLoadingNotice>}
    <div className="tc-stat-grid tc-stat-grid-primary">
      <StatCard icon="building-2" label="Total Companies" value={value(stats.total)} delta={comparison('total').delta} direction={comparison('total').direction} caption="vs last month" /><StatCard icon="truck" tint="green" label="Active Companies" value={value(stats.active)} delta={comparison('active').delta} direction={comparison('active').direction} caption="vs last month" /><StatCard icon="shield-check" label="Verified Companies" value={value(stats.verified)} delta={comparison('verified').delta} direction={comparison('verified').direction} caption="vs last month" /><StatCard icon="hourglass" tint="amber" label="Pending Review" value={value(stats.pending)} delta={comparison('pending').delta} direction={comparison('pending').direction} caption="vs last month" /><StatCard icon="ban" tint="red" label="Suspended Companies" value={value(stats.suspended)} delta={comparison('suspended').delta} direction={comparison('suspended').direction} caption="vs last month" />
    </div>
    <div className="tc-stat-grid tc-stat-grid-secondary"><StatCard icon="truck" tint="navy" label="Total Trucks" value={value(stats.trucks)} delta={comparison('trucks').delta} direction={comparison('trucks').direction} caption="vs last month" /><StatCard icon="users" label="Total Drivers" value={value(stats.drivers)} delta={comparison('drivers').delta} direction={comparison('drivers').direction} caption="vs last month" /><StatCard icon="truck" tint="green" label="Active Trucks" value={value(stats.activeTrucks)} delta={comparison('activeTrucks').delta} direction={comparison('activeTrucks').direction} caption="vs last month" /><StatCard icon="wallet" tint="amber" label="Paid Out Amount" value={payoutsQuery.isFetching ? <Skeleton as="span" width={90} height={23} /> : paidOut == null ? '—' : `₦${paidOut.toLocaleString('en-NG')}`} delta={comparison('paidOut').delta} direction={comparison('paidOut').direction} caption="vs last month" /></div>
    <Tabs value={tab} onChange={(next) => { setTab(next); setPage(1); setSelected([]); }} items={tabs} />
    <Card style={{ padding: 'var(--tk-space-3)' }}><div className="tc-filters"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by company name, RC number, email, phone..." /><Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={['All Statuses', 'Active', 'Inactive', 'Suspended']} /><Select value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} options={['All Locations', ...locations]} /><Select value={fleet} onChange={(event) => { setFleet(event.target.value); setPage(1); }} options={['All Fleet Sizes', '1–15 trucks', '16–30 trucks', '31+ trucks']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setStatus('All Statuses'); setLocation('All Locations'); setFleet('All Fleet Sizes'); setPage(1); }}>Filters</Button></div></Card>
    <div className="tc-content-grid"><Card pad="none">{directoryQuery.isFetching ? <DriverTableLoading columns={9} label="Loading companies" /> : !directoryQuery.error && <DataTable rows={visible} rowKey={(row) => row.id} selectable selected={selected} onSelect={setSelected} onRowClick={(row) => navigate(detailPath(row.id))} coloredHeader columns={[
      { key: 'company', header: 'Company', render: (row) => <span className="tc-company-cell"><Avatar name={row.name} size={36} square /><span><strong>{row.name}</strong><small>{row.regNo || '—'}</small></span></span> },
      { key: 'contact', header: 'Contact Person', render: (row) => <span className="tc-two-line"><strong>{row.contactName || '—'}</strong><small>{row.contactPhone || '—'}</small></span> }, { key: 'location', header: 'Location', render: (row) => row.location || '—' },
      { key: 'trucks', header: 'Fleet', render: (row) => <button className="tc-link" onClick={(event) => { event.stopPropagation(); navigate(detailPath(row.id, 'trucks')); }}>{value(row.trucks)}</button> }, { key: 'drivers', header: 'Drivers', render: (row) => value(row.drivers) },
      { key: 'status', header: 'Status', render: (row) => <Badge dot tone={tone[row.status] || 'neutral'}>{row.status || '—'}</Badge> }, { key: 'verification', header: 'Verification', render: (row) => <Badge dot tone={tone[row.verification] || 'neutral'}>{row.verification || '—'}</Badge> }, { key: 'joined', header: 'Joined On' },
      { key: 'actions', header: 'Actions', width: 66, render: (row) => <span ref={menuFor === row.id ? menuRoot : undefined} className="tc-menu" onClick={(event) => event.stopPropagation()}><IconButton icon="ellipsis" onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect(), height = 210;
        setMenuPosition({ position: 'fixed', top: rect.bottom + height > window.innerHeight ? Math.max(8, rect.top-height) : rect.bottom+4, left: Math.max(8, Math.min(rect.right-210, window.innerWidth-218)), right: 'auto', zIndex: 1000, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' });
        setMenuFor(menuFor === row.id ? null : row.id);
      }} />{menuFor === row.id && <span className="tc-dropdown" style={menuPosition}><DropdownMenu width={210} items={[{ label: 'View company', icon: 'eye', onClick: () => navigate(detailPath(row.id)) }, { label: 'Open fleet', icon: 'truck', onClick: () => navigate(detailPath(row.id, 'trucks')) }, { divider: true }, { label: row.verification === 'Verified' ? 'Mark pending' : 'Verify company', icon: 'shield-check', disabled: resetState.isLoading, onClick: () => row.verification === 'Verified' ? markPending(row) : row.displayStatusCode === 'PENDING_REVIEW' ? startAction(row, 'review') : (setNotice('Only companies awaiting review can be approved through the current API.'), setMenuFor(null)) }, ...(row.statusCode === 'SUSPENDED' ? [{ label: 'Reactivate', icon: 'ban', onClick: () => startAction(row, 'activate') }] : row.statusCode === 'ACTIVE' ? [{ label: 'Suspend', icon: 'ban', tone: 'danger', onClick: () => startAction(row, 'suspend') }] : [])]} /></span>}</span> }
    ]} />}{!directoryQuery.error && <Pagination page={currentPage} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />}{!directoryQuery.isFetching && !directoryQuery.error && !filtered.length && <div className="company-empty"><strong>No companies match these filters.</strong></div>}</Card>
      <aside className="tc-rail"><Card><h2 className="tk-section">Company Overview</h2><div className="tc-rail-intro"><span><Icon name="building-2" size={22} /></span><p className="tk-meta">Review company registration, fleet, drivers, documents and compliance in one place.</p></div><div className="tc-summary-list">{[['building-2', 'Total Companies', value(stats.total)], ['truck', 'Active Companies', value(stats.active)], ['shield-check', 'Verified Companies', value(stats.verified)], ['hourglass', 'Pending Review', value(stats.pending)], ['ban', 'Suspended Companies', value(stats.suspended)], ['truck', 'Total Trucks', value(stats.trucks)], ['users', 'Total Drivers', value(stats.drivers)], ['wallet', 'Paid Out Amount', paidOut == null ? '—' : `₦${paidOut.toLocaleString('en-NG')}`]].map(([icon, label, count]) => <div key={label}><Icon name={icon} size={15} /><span>{label}</span><strong>{count}</strong></div>)}</div></Card>
      <Card><div className="tc-card-head"><h2 className="tk-section">Top Performing Companies</h2><button disabled={!authenticated || rankingsQuery.isFetching} onClick={() => { setAllRankings(true); if (allRankings) rankingsQuery.refetch(); }}>View All</button></div><ol className="tc-ranked">{!rankingsQuery.isFetching && rankings?.map(company => <li key={company.id} value={company.rank}><button onClick={() => navigate(detailPath(company.id))}>{company.name}</button><strong>{company.performance == null ? '—' : company.performance.toLocaleString('en-NG', { maximumFractionDigits: 2 })+'%'}</strong></li>)}</ol>{rankingsQuery.isFetching ? <p className="tk-meta"><Skeleton height={14} /></p> : rankingsQuery.error ? <p className="tk-meta">{companyError(rankingsQuery.error)}</p> : !rankings?.length && <p className="tk-meta">—</p>}</Card>
      <Card><div className="tc-card-head"><h2 className="tk-section">Recent Registrations</h2><button onClick={() => { setTab('All Companies'); setQuery(''); setPage(1); }}>View All</button></div>{recent ? <div className="tc-recent">{recent.map((company) => <button key={company.id} onClick={() => navigate(detailPath(company.id))}><Avatar name={company.name} size={28} /><span><strong>{company.name}</strong><small>{company.regNo || '—'}</small></span><Badge tone={tone[company.verification] || 'neutral'}>{company.verification || '—'}</Badge></button>)}</div> : <p className="tk-meta">Registration dates could not be loaded for every company.</p>}</Card></aside>
    </div>
    <Modal open={addOpen} onClose={() => { if (!creating.current) setAddOpen(false); }} title="Add trucking company" description="Create a new company record." footer={<><Button variant="outline" disabled={createState.isLoading} onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled={createState.isLoading || !canCreate || Object.values(form).some(value => !value.trim())} onClick={addCompany}>Add Company</Button></>}>{createError && <Banner tone="danger" title="Unable to save">{createError}</Banner>}<div className="tc-form">{Object.entries({ name: 'Company name', regNo: 'RC number', contactName: 'Contact person', contactPhone: 'Phone', contactEmail: 'Email', location: 'Location' }).map(([key, label]) => <TextField key={key} label={label} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}</div></Modal>
    {action && <CompanyActionModal key={`${action.company.id}-${action.kind}`} action={action} onClose={() => setAction(null)} onDone={setNotice} />}
  </div>;
}
