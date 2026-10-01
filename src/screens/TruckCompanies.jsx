'use client';
import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import { Avatar, Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, IconButton, Modal, PageHeader, Pagination, SearchField, Select, Skeleton, StatCard, Tabs, TextField } from '../ds.js';
import { companyError, useGetAdminCompaniesQuery, useGetAdminPendingCompaniesQuery, useGetAdminCompanyPayoutsQuery } from '../store/features/companies/companiesApi.js';
import { CompaniesLoading } from './CompaniesLoading.jsx';
import { CompanyActionModal } from './CompanyActionModal.jsx';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import './TruckingCompanies.css';

const tone = { Active: 'success', Inactive: 'neutral', Suspended: 'danger', Verified: 'success', Pending: 'warning', Rejected: 'danger', 'Pending Review': 'warning' };
const blank = { name: '', regNo: '', contactName: '', contactPhone: '', contactEmail: '', location: '' };
function downloadCsv(rows) {
  const fields = ['name', 'regNo', 'contactName', 'contactPhone', 'contactEmail', 'location', 'trucks', 'drivers', 'status', 'verification'];
  const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'trucking-companies.csv'; anchor.click(); URL.revokeObjectURL(url);
}
const detailPath = (id, tab) => `/companies/detail?id=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;

export function TruckCompanies() {
  const navigate = useNavigate();
  const directoryQuery = useGetAdminCompaniesQuery();
  const pendingQuery = useGetAdminPendingCompaniesQuery();
  const payoutsQuery = useGetAdminCompanyPayoutsQuery();
  const [tab, setTab] = useState('All Companies'), [query, setQuery] = useState(''), [status, setStatus] = useState('All Statuses'), [location, setLocation] = useState('All Locations'), [fleet, setFleet] = useState('All Fleet Sizes'), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [selected, setSelected] = useState([]), [menuFor, setMenuFor] = useState(null), [addOpen, setAddOpen] = useState(false), [form, setForm] = useState(blank), [action, setAction] = useState(null), [notice, setNotice] = useState(null);
  const companies = useMemo(() => (directoryQuery.data || []).map((company) => {
    const pending = pendingQuery.data?.find((item) => item.id === company.id);
    return pending && company.statusCode === 'PENDING_REVIEW' ? { ...company, name: pending.name, regNo: pending.regNo, location: pending.location, contactName: pending.contactName, joined: pending.joined, joinedAt: pending.joinedAt } : company;
  }), [directoryQuery.data, pendingQuery.data]);
  const locations = useMemo(() => [...new Set(companies.map((company) => company.location).filter(Boolean))], [companies]);
  const filtered = useMemo(() => companies.filter((company) => {
    const needle = query.toLowerCase();
    const queryMatch = !needle || [company.name, company.regNo, company.contactName, company.contactPhone, company.contactEmail].some((value) => value?.toLowerCase().includes(needle));
    const tabMatch = tab === 'All Companies' || (tab === 'Pending Review' ? company.statusCode === 'PENDING_REVIEW' : tab === 'Suspended' ? company.statusCode === 'SUSPENDED' : company.verification === tab);
    const fleetMatch = fleet === 'All Fleet Sizes' || (company.trucks != null && (fleet === '1–15 trucks' ? company.trucks >= 1 && company.trucks <= 15 : fleet === '16–30 trucks' ? company.trucks >= 16 && company.trucks <= 30 : company.trucks > 30));
    return queryMatch && tabMatch && (status === 'All Statuses' || company.status === status) && (location === 'All Locations' || company.location === location) && fleetMatch;
  }), [companies, fleet, location, query, status, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const sum = (field) => companies.every((company) => company[field] != null) ? companies.reduce((total, company) => total + company[field], 0) : null;
  const verifiedKnown = companies.every((company) => company.verification != null && !company.profileUnavailable);
  const companyIds = new Set(companies.map((company) => company.id));
  const companyPayouts = payoutsQuery.data?.filter((row) => companyIds.has(row.companyId) && row.statusCode === 'COMPLETED');
  const paidOut = !payoutsQuery.error && companyPayouts?.every((row) => row.amount != null) ? companyPayouts.reduce((total, row) => total + row.amount, 0) : null;
  const recent = companies.every((company) => company.joinedAt) ? [...companies].sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt)).slice(0, 5) : null;
  const stats = { verified: verifiedKnown ? companies.filter((company) => company.verification === 'Verified').length : null, total: companies.length, active: companies.filter((company) => company.statusCode === 'ACTIVE').length, pending: companies.filter((company) => company.statusCode === 'PENDING_REVIEW').length, suspended: companies.filter((company) => company.statusCode === 'SUSPENDED').length, trucks: sum('trucks'), drivers: sum('drivers') };
  const tabs = [{ value: 'All Companies', label: 'All Companies', count: stats.total }, { value: 'Pending Review', label: 'Pending Review', count: stats.pending }, { value: 'Verified', label: 'Verified', count: stats.verified ?? '—' }, { value: 'Suspended', label: 'Suspended', count: stats.suspended }, { value: 'Rejected', label: 'Rejected', count: '—' }];
  const value = (number) => number == null ? '—' : number.toLocaleString();
  const startAction = (company, kind) => { setMenuFor(null); setAction({ company, kind }); };
  if (!directoryQuery.data && (directoryQuery.isLoading || directoryQuery.isFetching)) return <CompaniesLoading />;
  return <div className="tc-page">
    <PageHeader crumbs={['Companies', 'Trucking Companies']} title="Trucking Companies" description="Review, verify and manage all registered trucking companies on Trukkas." actions={<><Button variant="outline" icon="download" disabled={directoryQuery.isFetching || Boolean(directoryQuery.error)} onClick={() => downloadCsv(filtered)}>Export</Button><Button icon="plus" onClick={() => setAddOpen(true)}>Add Company</Button></>} />
    {directoryQuery.error && <Banner tone="danger" title="Unable to load companies">{companyError(directoryQuery.error)}<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}
    {pendingQuery.error && <Banner tone="warning" title="Pending company information unavailable">{companyError(pendingQuery.error)}<Button variant="outline" onClick={pendingQuery.refetch}>Retry</Button></Banner>}
    {payoutsQuery.error && <Banner tone="warning" title="Company payout summary unavailable">{companyError(payoutsQuery.error)}<Button variant="outline" onClick={payoutsQuery.refetch}>Retry</Button></Banner>}
    {companies.some((company) => company.profileUnavailable) && <Banner tone="warning" title="Some company details unavailable">Some company profiles could not be loaded. RC numbers, addresses, joined dates and verification status may be incomplete.<Button variant="outline" onClick={directoryQuery.refetch}>Retry</Button></Banner>}
    {notice && <Banner tone="info" title="Companies">{notice}</Banner>}
    {directoryQuery.isFetching && <DriverLoadingNotice>Refreshing companies…</DriverLoadingNotice>}
    <div className="tc-stat-grid tc-stat-grid-primary">
      <StatCard icon="building-2" label="Total Companies" value={directoryQuery.error ? '—' : value(stats.total)} /><StatCard icon="truck" tint="green" label="Active Companies" value={directoryQuery.error ? '—' : value(stats.active)} /><StatCard icon="shield-check" label="Verified Companies" value={directoryQuery.error ? '—' : value(stats.verified)} /><StatCard icon="hourglass" tint="amber" label="Pending Review" value={directoryQuery.error ? '—' : value(stats.pending)} /><StatCard icon="ban" tint="red" label="Suspended Companies" value={directoryQuery.error ? '—' : value(stats.suspended)} />
    </div>
    <div className="tc-stat-grid tc-stat-grid-secondary"><StatCard icon="truck" tint="navy" label="Total Trucks" value={directoryQuery.error ? '—' : value(stats.trucks)} /><StatCard icon="users" label="Total Drivers" value={directoryQuery.error ? '—' : value(stats.drivers)} /><StatCard icon="truck" tint="green" label="Active Trucks" value="—" /><StatCard icon="wallet" tint="amber" label="Paid Out Amount" value={payoutsQuery.isFetching ? <Skeleton as="span" width={90} height={23} /> : paidOut == null || directoryQuery.error ? '—' : `₦${paidOut.toLocaleString('en-NG')}`} /></div>
    <Tabs value={tab} onChange={(next) => { setTab(next); setPage(1); setSelected([]); }} items={tabs} />
    {tab === 'Rejected' && <Banner tone="warning" title={`${tab} companies unavailable`}>The API does not distinguish rejected applications from other inactive accounts.</Banner>}
    <Card style={{ padding: 'var(--tk-space-3)' }}><div className="tc-filters"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by company name, RC number, email, phone..." /><Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={['All Statuses', 'Active', 'Inactive', 'Suspended']} /><Select value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} options={['All Locations', ...locations]} /><Select value={fleet} onChange={(event) => { setFleet(event.target.value); setPage(1); }} options={['All Fleet Sizes', '1–15 trucks', '16–30 trucks', '31+ trucks']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setStatus('All Statuses'); setLocation('All Locations'); setFleet('All Fleet Sizes'); setPage(1); }}>Filters</Button></div></Card>
    <div className="tc-content-grid"><Card pad="none">{directoryQuery.isFetching ? <DriverTableLoading columns={9} label="Loading companies" /> : !directoryQuery.error && tab !== 'Rejected' && <DataTable rows={visible} rowKey={(row) => row.id} selectable selected={selected} onSelect={setSelected} onRowClick={(row) => navigate(detailPath(row.id))} coloredHeader columns={[
      { key: 'company', header: 'Company', render: (row) => <span className="tc-company-cell"><Avatar name={row.name} size={36} square /><span><strong>{row.name}</strong><small>{row.regNo || '—'}</small></span></span> },
      { key: 'contact', header: 'Contact Person', render: (row) => <span className="tc-two-line"><strong>{row.contactName || '—'}</strong><small>{row.contactPhone || '—'}</small></span> }, { key: 'location', header: 'Location', render: (row) => row.location || '—' },
      { key: 'trucks', header: 'Fleet', render: (row) => <button className="tc-link" onClick={(event) => { event.stopPropagation(); navigate(detailPath(row.id, 'trucks')); }}>{value(row.trucks)}</button> }, { key: 'drivers', header: 'Drivers', render: (row) => value(row.drivers) },
      { key: 'status', header: 'Status', render: (row) => <Badge dot tone={tone[row.status] || 'neutral'}>{row.status || '—'}</Badge> }, { key: 'verification', header: 'Verification', render: (row) => <Badge dot tone={tone[row.verification] || 'neutral'}>{row.verification || '—'}</Badge> }, { key: 'joined', header: 'Joined On' },
      { key: 'actions', header: 'Actions', width: 66, render: (row) => <span className="tc-menu" onClick={(event) => event.stopPropagation()}><IconButton icon="ellipsis" onClick={() => setMenuFor(menuFor === row.id ? null : row.id)} />{menuFor === row.id && <span className="tc-dropdown"><DropdownMenu width={210} items={[{ label: 'View company', icon: 'eye', onClick: () => navigate(detailPath(row.id)) }, { label: 'Open fleet', icon: 'truck', onClick: () => navigate(detailPath(row.id, 'trucks')) }, { divider: true }, { label: 'Verify company', icon: 'shield-check', onClick: () => row.statusCode === 'PENDING_REVIEW' ? startAction(row, 'review') : (setNotice('Only companies awaiting review can be approved through the current API.'), setMenuFor(null)) }, ...(row.statusCode === 'SUSPENDED' ? [{ label: 'Reactivate', icon: 'ban', onClick: () => startAction(row, 'activate') }] : row.statusCode === 'ACTIVE' ? [{ label: 'Suspend', icon: 'ban', tone: 'danger', onClick: () => startAction(row, 'suspend') }] : [])]} /></span>}</span> }
    ]} />}{!directoryQuery.error && tab !== 'Rejected' && <Pagination page={currentPage} pageCount={pageCount} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />}{!directoryQuery.isFetching && !directoryQuery.error && tab !== 'Rejected' && !filtered.length && <div className="company-empty"><strong>No companies match these filters.</strong></div>}</Card>
      <aside className="tc-rail"><Card><h2 className="tk-section">Company Overview</h2><div className="tc-rail-intro"><span><Icon name="building-2" size={22} /></span><p className="tk-meta">Review company registration, fleet, drivers, documents and compliance in one place.</p></div><div className="tc-summary-list">{[['building-2', 'Total Companies', value(stats.total)], ['truck', 'Active Companies', value(stats.active)], ['shield-check', 'Verified Companies', value(stats.verified)], ['hourglass', 'Pending Review', value(stats.pending)], ['ban', 'Suspended Companies', value(stats.suspended)], ['truck', 'Total Trucks', value(stats.trucks)], ['users', 'Total Drivers', value(stats.drivers)], ['wallet', 'Paid Out Amount', paidOut == null ? '—' : `₦${paidOut.toLocaleString('en-NG')}`]].map(([icon, label, count]) => <div key={label}><Icon name={icon} size={15} /><span>{label}</span><strong>{directoryQuery.error ? '—' : count}</strong></div>)}</div></Card>
      <Card><div className="tc-card-head"><h2 className="tk-section">Top Performing Companies</h2><button onClick={() => setNotice('Company performance rankings are not returned by the current API.')}>View All</button></div><p className="tk-meta">Company performance data is unavailable.</p></Card>
      <Card><div className="tc-card-head"><h2 className="tk-section">Recent Registrations</h2><button onClick={() => { setTab('All Companies'); setQuery(''); setPage(1); }}>View All</button></div>{recent ? <div className="tc-recent">{recent.map((company) => <button key={company.id} onClick={() => navigate(detailPath(company.id))}><Avatar name={company.name} size={28} /><span><strong>{company.name}</strong><small>{company.joined}</small></span><Badge tone={tone[company.verification] || 'neutral'}>{company.verification || '—'}</Badge></button>)}</div> : <p className="tk-meta">Registration dates could not be loaded for every company.</p>}</Card></aside>
    </div>
    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add trucking company" description="Create a new company record." footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled>Add Company</Button></>}><Banner tone="warning" title="Company creation unavailable">There is no documented admin API for creating a company.</Banner><div className="tc-form">{Object.entries({ name: 'Company name', regNo: 'RC number', contactName: 'Contact person', contactPhone: 'Phone', contactEmail: 'Email', location: 'Location' }).map(([key, label]) => <TextField key={key} label={label} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}</div></Modal>
    {action && <CompanyActionModal key={`${action.company.id}-${action.kind}`} action={action} onClose={() => setAction(null)} onDone={setNotice} />}
  </div>;
}
