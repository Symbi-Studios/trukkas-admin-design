'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../router.js';
import { Avatar, Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, IconButton, Modal, PageHeader, Pagination, SearchField, Select, StatCard, Tabs, Textarea, TextField } from '../ds.js';
import { companyDate, companyError, companyMoney, useGetAdminCompaniesQuery, useGetAdminCompanyProfileQuery, useGetAdminCompanyInfoQuery, useGetAdminCompanyDriversQuery, useGetAdminCompanyJobsQuery, useGetAdminCompanyPayoutsQuery, useGetAdminCompanyActivityQuery, useGetAdminCompanyTruckQuery, useUpdateAdminCompanyMutation, useMessageAdminCompanyMutation } from '../store/features/companies/companiesApi.js';
import { useGetAdminDriverProfileQuery, useGetAdminDriverLicenseQuery } from '../store/features/drivers/driversApi.js';
import { useGetAdminTripsQuery } from '../store/features/trips/tripsApi.js';
import { CompanyActionModal } from './CompanyActionModal.jsx';
import { CompanyDetailLoading } from './CompaniesLoading.jsx';
import { DriverTableLoading } from './DriversLoading.jsx';
import './CompanyDetail.css';

const statusTone = { Active: 'success', Approved: 'success', Available: 'success', 'On Trip': 'info', 'In Maintenance': 'warning', Inactive: 'neutral', Suspended: 'danger', 'Pending Review': 'warning', Pending: 'warning', Delivered: 'success', Completed: 'success', Processing: 'info', Failed: 'danger', Reversed: 'warning', 'In Transit': 'info', Assigned: 'info', Open: 'warning', Verified: 'success', Rejected: 'danger' };
const display = (value) => value ?? '—';
function downloadRows(filename, rows) {
  const fields = Object.keys(rows[0] || {}).filter((field) => !rows.some((row) => row[field] && typeof row[field] === 'object'));
  const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
function PanelHeader({ title, action, onAction }) { return <div className="company-panel-head"><h2 className="tk-section">{title}</h2>{action && <button onClick={onAction}>{action}</button>}</div>; }
function KeyValues({ rows, className = 'company-key-values' }) { return <div className={className}>{rows.map(([name, value]) => <div key={name}>{className === 'company-info-grid' ? <small>{name}</small> : <span>{name}</span>}<strong>{display(value)}</strong></div>)}</div>; }
function Status({ value }) { return <Badge dot tone={statusTone[value] || 'neutral'}>{value || '—'}</Badge>; }
function StatGrid({ children, five = false }) { return <div className={`company-stats ${five ? 'company-stats-five' : ''}`}>{children}</div>; }
function EmptyRecords({ label }) { return <div className="company-empty"><Icon name="search" size={24} /><strong>{label}</strong></div>; }
function QueryError({ query, title }) { return query.error ? <Banner tone="danger" title={title}>{companyError(query.error)}<Button variant="outline" onClick={query.refetch}>Retry</Button></Banner> : null; }
function ActivityList({ rows, allowed, query }) {
  if (!allowed) return <p className="tk-meta">Company account activity is available to Super Admins.</p>;
  if (query.isFetching) return <DriverTableLoading columns={3} label="Loading company activity" />;
  if (query.error) return <QueryError query={query} title="Unable to load company activity" />;
  if (!rows.length) return <p className="tk-meta">No company account activity found.</p>;
  return <div className="company-activity">{rows.map((row) => <div key={row.id}><span><Icon name="clipboard-check" size={16} /></span><p><strong>{row.title}</strong><small>{row.sub || '—'}</small></p><time>{row.time}</time></div>)}</div>;
}

export function CompanyDetail() {
  const navigate = useNavigate(), params = useParams(), search = useSearchParams();
  const id = search.get('id') || params.companyId || '';
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const adminRole = useSelector((state) => state.auth.admin?.role);
  const canViewActivity = adminRole === 'SUPER_ADMIN';
  const canEdit = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(adminRole);
  const [editForm, setEditForm] = useState({}), [editError, setEditError] = useState(null), [messageError, setMessageError] = useState(null);
  const [updateCompany, updateState] = useUpdateAdminCompanyMutation();
  const [messageCompany, messageState] = useMessageAdminCompanyMutation();
  const submitting = useRef(false);
  const [tab, setTab] = useState('Overview'), [query, setQuery] = useState(''), [filter, setFilter] = useState('All Statuses'), [page, setPage] = useState(1), [selectedTruckId, setSelectedTruckId] = useState(null), [selectedDriverId, setSelectedDriverId] = useState(null), [checkedTrucks, setCheckedTrucks] = useState([]), [checkedDrivers, setCheckedDrivers] = useState([]), [menu, setMenu] = useState(false), [editOpen, setEditOpen] = useState(false), [messageOpen, setMessageOpen] = useState(false), [message, setMessage] = useState(''), [action, setAction] = useState(null), [notice, setNotice] = useState(null), [jobTab, setJobTab] = useState('all');
  useEffect(() => { setQuery(''); setFilter('All Statuses'); setJobTab('all'); setMenu(false); setEditOpen(false); setMessageOpen(false); setMessage(''); }, [id]);
  const requestedTab = search.get('tab');
  useEffect(() => { setTab(({ trucks: 'Trucks', drivers: 'Drivers', payouts: 'Payouts' })[requestedTab] || 'Overview'); setPage(1); setSelectedTruckId(null); setSelectedDriverId(null); setCheckedTrucks([]); setCheckedDrivers([]); setNotice(null); setAction(null); }, [id, requestedTab]);
  const profileQuery = useGetAdminCompanyProfileQuery({ id, owner }, { skip: !authenticated || !id, refetchOnMountOrArgChange: true });
  const profile = profileQuery.error ? null : profileQuery.currentData;
  const validCompany = profile?.role === 'TRUCKER' && profile?.truckerType === 'COMPANY';
  const infoQuery = useGetAdminCompanyInfoQuery({ id, owner }, { skip: !authenticated || !id || !validCompany, refetchOnMountOrArgChange: true });
  const directoryQuery = useGetAdminCompaniesQuery(owner, { skip: !authenticated || !validCompany });
  const driversQuery = useGetAdminCompanyDriversQuery({ id, owner }, { skip: !authenticated || !validCompany || !['Overview', 'Drivers'].includes(tab) });
  const payoutsQuery = useGetAdminCompanyPayoutsQuery({ id, owner }, { skip: !authenticated || !validCompany || !['Overview', 'Payouts'].includes(tab) });
  const jobsQuery = useGetAdminCompanyJobsQuery({ id, owner, tab: tab === 'Jobs' ? jobTab : 'all', page: tab === 'Jobs' ? page : 1, limit: tab === 'Jobs' ? 10 : 5 }, { skip: !authenticated || !validCompany || !['Overview', 'Jobs'].includes(tab) });
  const completedQuery = useGetAdminCompanyJobsQuery({ id, owner, tab: 'completed', page: 1, limit: 1 }, { skip: !authenticated || !validCompany || tab !== 'Overview' });
  const activityQuery = useGetAdminCompanyActivityQuery({ id, owner }, { skip: !authenticated || !validCompany || !canViewActivity || !['Overview', 'Activity Log'].includes(tab) });
  const company = useMemo(() => {
    if (!profile) return null;
    const entry = directoryQuery.error ? null : directoryQuery.currentData?.find((row) => row.id === id);
    const info = Object.fromEntries(Object.entries(infoQuery.error ? {} : infoQuery.currentData || {}).filter(([, value]) => value != null));
    return { ...profile, ...info, trucks: entry?.trucks ?? profile.fleet?.length ?? null, drivers: entry?.drivers ?? (driversQuery.error ? null : driversQuery.currentData?.length) ?? null, completedJobs: entry?.completedJobs ?? (completedQuery.error ? null : completedQuery.currentData?.pagination?.total) ?? null, activeTrucks: entry?.activeTrucks ?? profile.fleetCounts?.active ?? null };
  }, [profile, id, directoryQuery.currentData, directoryQuery.error, infoQuery.currentData, infoQuery.error, driversQuery.currentData, driversQuery.error, completedQuery.currentData, completedQuery.error]);
  const trucks = profile?.fleet || [], drivers = driversQuery.error ? [] : driversQuery.currentData || [], payouts = payoutsQuery.error ? [] : payoutsQuery.currentData || [], jobs = jobsQuery.error ? [] : jobsQuery.currentData?.rows || [], activity = activityQuery.error ? [] : activityQuery.currentData || [];
  const summary = { totalEarned: profile?.totalEarned, available: profile?.walletBalance, pending: null, processing: null,
    paid: payoutsQuery.currentData && !payoutsQuery.error && payouts.every(row => row.paid != null) ? payouts.reduce((total, row) => total + row.paid, 0) : null,
    requests: payoutsQuery.currentData && !payoutsQuery.error ? payouts.length : null };
  const documents = infoQuery.error ? null : infoQuery.currentData?.documents;
  const selectedTruck = trucks.find((row) => row.id === selectedTruckId) || trucks[0];
  const selectedDriver = drivers.find((row) => row.id === selectedDriverId) || drivers[0];
  const setSection = (next) => { setTab(next); setPage(1); setQuery(''); setFilter('All Statuses'); };
  const startAction = (kind) => { setMenu(false); setAction({ company, kind }); };
  if (!id) return <Card><Banner tone="warning" title="No company selected">Open a company from the Companies list.</Banner><Button onClick={() => navigate('/companies')}>Back to companies</Button></Card>;
  if (!profile && (profileQuery.isLoading || profileQuery.isFetching)) return <CompanyDetailLoading />;
  if (profileQuery.error) return <Card><QueryError query={profileQuery} title="Unable to load company" /><Button onClick={() => navigate('/companies')}>Back to companies</Button></Card>;
  if (!company || !validCompany) return <Card><Banner tone="warning" title="Company not found">This record is not a company trucker account.</Banner><Button onClick={() => navigate('/companies')}>Back to companies</Button></Card>;
  const companyFields = [['Company Name', company.name], ['Contact Person', company.contactName], ['RC Number', company.regNo], ['Phone Number', company.contactPhone], ['Business Type', company.businessType], ['Email Address', company.contactEmail], ['Date Registered', company.joined], ['Location', company.location], ['Address', company.location], ['Tax Identification Number (TIN)', company.taxId], ['Website', company.website], ['Status', <Status value={company.status} />]];
  function openEditor() {
    setEditForm({ name: company.name === '—' ? '' : company.name, regNo: company.regNo || '', contactName: company.contactName || '', contactPhone: company.contactPhone || '', contactEmail: company.contactEmail || '', location: company.location || '' });
    setEditError(null); setEditOpen(true);
  }
  async function saveCompany() {
    if (submitting.current) return;
    if (!canEdit) return setEditError('Your account cannot edit companies.');
    submitting.current = true; setEditError(null);
    try { await updateCompany({ id, form: editForm, original: company }).unwrap(); setEditOpen(false); setNotice('Company details updated.'); }
    catch (error) { setEditError(companyError(error)); }
    finally { submitting.current = false; }
  }
  async function sendMessage() {
    if (submitting.current) return;
    submitting.current = true; setMessageError(null);
    try { await messageCompany({ id, message }).unwrap(); setMessageOpen(false); setMessage(''); setNotice('Message sent.'); }
    catch (error) { setMessageError(companyError(error)); }
    finally { submitting.current = false; }
  }
  return <div className="company-page">
    <PageHeader crumbs={['Companies', { label: 'Trucking Companies', onClick: () => navigate('/companies') }, company.name]} title="Company Details" description="Review the company profile, fleet, drivers, documents and compliance status." actions={<><IconButton icon="ellipsis" onClick={() => setMenu(!menu)} /><Button variant="outline" icon="mail" onClick={() => { setMessageError(null); setMessageOpen(true); }}>Send Message</Button><span className="company-menu-wrap"><Button iconRight="chevron-down" onClick={() => setMenu(!menu)}>Actions</Button>{menu && <span className="company-dropdown"><DropdownMenu width={220} items={[{ label: 'Edit company', icon: 'pencil', onClick: () => { openEditor(); setMenu(false); } }, { label: 'Print profile', icon: 'printer', onClick: () => window.print() }, ...(company.kycStatusCode === 'IN_REVIEW' ? [{ label: 'Review company', icon: 'shield-check', onClick: () => startAction('review') }] : []), ...(company.statusCode === 'SUSPENDED' ? [{ label: 'Reactivate company', icon: 'ban', onClick: () => startAction('activate') }] : company.statusCode === 'ACTIVE' ? [{ label: 'Suspend company', icon: 'ban', tone: 'danger', onClick: () => startAction('suspend') }] : [])]} /></span>}</span></>} />
    {notice && <Banner tone="info" title="Company">{notice}</Banner>}
    <QueryError query={infoQuery} title="Company verification data unavailable" />
    <header className="company-hero"><div className="company-brand"><Avatar name={company.name} size={64} square /><div><div className="company-name"><h2 className="tk-title">{company.name}</h2><Status value={company.verification} /></div><p>{company.regNo || '—'}<span />{company.location || '—'}</p><small>Reliable movement. Greater possibilities.</small></div></div><div className="company-contact"><span><Icon name="phone" size={16} />{company.contactPhone || '—'}</span><span><Icon name="mail" size={16} />{company.contactEmail || '—'}</span><span><Icon name="globe" size={16} />{company.website || '—'}</span><span><Icon name="map-pin" size={16} />{company.location || '—'}</span><span className="company-date"><small>Joined On</small><strong>{company.joined}</strong></span><span className="company-date"><small>Last Updated</small><strong>{company.updated}</strong></span></div></header>
    <Tabs value={tab} onChange={setSection} items={[{ value: 'Overview', label: 'Overview' }, { value: 'Trucks', label: 'Trucks', count: display(company.trucks) }, { value: 'Drivers', label: 'Drivers', count: display(company.drivers) }, { value: 'Documents', label: 'Documents', count: display(company.documentCount) }, { value: 'Jobs', label: 'Jobs', count: display(company.totalJobs) }, { value: 'Payouts', label: 'Payouts', count: display(summary.requests) }, { value: 'Compliance', label: 'Compliance' }, { value: 'Activity Log', label: 'Activity Log' }]} />
    {tab === 'Overview' && <div className="company-tab">
      <StatGrid five><StatCard icon="truck" label="Fleet Size" value={display(company.trucks)} /><StatCard icon="users" tint="teal" label="Drivers" value={display(company.drivers)} /><StatCard icon="truck" tint="green" label="Active Trucks" value={display(company.activeTrucks)} /><StatCard icon="clipboard-check" tint="purple" label="Completed Jobs" value={display(company.completedJobs)} /><StatCard icon="wallet" tint="amber" label="Total Earnings" value={companyMoney(company.totalEarned)} /></StatGrid>
      <div className="company-overview-grid"><div className="company-overview-main">
        <Card><PanelHeader title="Company Information" action="Edit" onAction={openEditor} /><KeyValues rows={companyFields} className="company-info-grid" /></Card>
        <Card><PanelHeader title="Fleet Overview" action="View All" onAction={() => setSection('Trucks')} /><div className="company-progress-labels"><span><i className="green" />Active <strong>{display(company.fleetCounts?.active)}</strong></span><span><i className="grey" />Inactive <strong>{display(company.fleetCounts?.inactive)}</strong></span><span><i className="amber" />Under Maintenance <strong>{display(company.fleetCounts?.maintenance)}</strong></span><b>{display(company.trucks)}<small>Total Trucks</small></b></div><div className="company-progress" aria-label="Active trucks"><span style={{ width: `${trucks.length && company.fleetCounts?.active != null ? company.fleetCounts.active / trucks.length * 100 : 0}%`, background: 'var(--tk-line)' }} /></div></Card>
        <Card><PanelHeader title="Driver Overview" action="View All" onAction={() => setSection('Drivers')} /><QueryError query={driversQuery} title="Unable to load company drivers" />{driversQuery.isFetching ? <DriverTableLoading columns={3} label="Loading company driver summary" /> : !driversQuery.error && <div className="company-progress-labels"><span><i className="green" />Active <strong>{driversQuery.currentData && drivers.every(driver => driver.statusCode) ? drivers.filter((driver) => driver.statusCode === 'ACTIVE').length : '—'}</strong></span><span><i className="grey" />Inactive <strong>{driversQuery.currentData && drivers.every(driver => driver.statusCode) ? drivers.filter((driver) => ['INACTIVE', 'SUSPENDED', 'BANNED'].includes(driver.statusCode)).length : '—'}</strong></span><span><i className="amber" />Pending <strong>{driversQuery.currentData && drivers.every(driver => driver.statusCode) ? drivers.filter((driver) => ['PENDING_PROFILE', 'PENDING_REVIEW'].includes(driver.statusCode)).length : '—'}</strong></span><b>{display(company.drivers)}<small>Total Drivers</small></b></div>}{driversQuery.currentData && !driversQuery.error && <div className="company-progress drivers" aria-label="Company driver status distribution">{[['ACTIVE'], ['INACTIVE', 'SUSPENDED', 'BANNED'], ['PENDING_PROFILE', 'PENDING_REVIEW']].map((statuses, index) => <span key={index} style={{ width: `${drivers.length ? drivers.filter((driver) => statuses.includes(driver.statusCode)).length / drivers.length * 100 : 0}%` }} />)}</div>}</Card>
        <Card><PanelHeader title="Recent Jobs" action="View All" onAction={() => setSection('Jobs')} /><CompanyJobs query={jobsQuery} rows={jobs} /></Card>
      </div><aside className="company-overview-side">
        <Card><PanelHeader title="Verification & Compliance" action="View All" onAction={() => setSection('Documents')} /><KeyValues rows={[["KYB Status", <Status value={company.verification} />], ['Registration Status', company.registrationStatus]]} />{infoQuery.isFetching ? <DriverTableLoading columns={3} label="Loading company documents" /> : documents == null ? '—' : documents.map(document => <div className="company-doc" key={document.rowKey}><Icon name="file-text" size={17} /><span>{document.name}</span><Badge tone={statusTone[document.status] || 'neutral'}>{document.status || '—'}</Badge><time>{document.date}</time></div>)}</Card>
        <Card><PanelHeader title="Payment & Earnings" action="View All" onAction={() => setSection('Payouts')} /><QueryError query={payoutsQuery} title="Unable to load company payouts" />{payoutsQuery.isFetching ? <DriverTableLoading columns={2} label="Loading company payouts" /> : <div className="company-payments">{[['wallet', 'Total Earnings', summary.totalEarned], ['building-2', 'Total Paid Out', summary.paid], ['circle-check', 'Pending Payout', summary.pending], ['credit-card', 'Available', summary.available]].map(([icon, name, amount]) => <div key={name}><span><Icon name={icon} size={17} /></span><p><small>{name}</small><strong>{companyMoney(amount)}</strong></p></div>)}</div>}</Card>
        <Card><PanelHeader title="Recent Activity" action="View All" onAction={() => setSection('Activity Log')} /><ActivityList rows={activity.slice(0, 5)} allowed={canViewActivity} query={activityQuery} /></Card>
      </aside></div>
    </div>}
    {tab === 'Trucks' && <TrucksTab company={company} trucks={trucks} available={profile.fleet != null} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} page={page} setPage={setPage} selected={selectedTruck} setSelected={(row) => setSelectedTruckId(row.id)} checked={checkedTrucks} setChecked={setCheckedTrucks} navigate={navigate} />}
    {tab === 'Drivers' && <DriversTab company={company} drivers={drivers} dataQuery={driversQuery} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} page={page} setPage={setPage} selected={selectedDriver} setSelected={(row) => setSelectedDriverId(row.id)} checked={checkedDrivers} setChecked={setCheckedDrivers} navigate={navigate} />}
    {tab === 'Payouts' && <PayoutsTab company={company} payouts={payouts} query={payoutsQuery} summary={summary} />}
    {tab === 'Jobs' && <Card pad="none"><div className="company-list-head"><h2 className="tk-section">Jobs</h2><Select value={jobTab} onChange={(event) => { setJobTab(event.target.value); setPage(1); }} options={[{ label: 'All Jobs', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }]} /></div><CompanyJobs query={jobsQuery} rows={jobs} />{jobsQuery.currentData?.pagination && !jobsQuery.error && <Pagination page={page} pageSize={10} pageCount={Math.max(1, jobsQuery.currentData.pagination.totalPages)} total={jobsQuery.currentData.pagination.total} onPage={setPage} />}</Card>}
    {['Documents', 'Compliance'].includes(tab) && <Card pad="none"><div className="company-list-head"><div><h2 className="tk-section">{tab}</h2><p className="tk-meta">Current {tab.toLowerCase()} records for this company.</p></div>{company.kycStatusCode === 'IN_REVIEW' && <Button icon="shield-check" onClick={() => startAction('review')}>Review company</Button>}</div><div style={{ padding: 'var(--tk-space-4)' }}><KeyValues rows={[["KYB Status", <Status value={company.verification} />], ['RC Number', company.regNo], ['Tax Identification Number (TIN)', company.taxId], ['Registration Status', company.registrationStatus]]} />{infoQuery.error && <QueryError query={infoQuery} title="Company verification data unavailable" />}</div><>{infoQuery.isFetching ? <DriverTableLoading columns={3} label="Loading company documents" /> : <DataTable rows={documents || []} rowKey={(row) => row.rowKey} coloredHeader columns={[{ key: 'name', header: 'Document' }, { key: 'status', header: 'Status', render: row => row.status || '—' }, { key: 'date', header: 'Reviewed On', render: row => row.date }]} />}</></Card>}
    {tab === 'Activity Log' && <Card><PanelHeader title="Activity Log" /><ActivityList rows={activity} allowed={canViewActivity} query={activityQuery} /><p className="tk-meta">These are admin actions on this company account. Fleet and driver activity is not included.</p></Card>}
    <Modal open={messageOpen} onClose={() => setMessageOpen(false)} title={`Message ${company.name}`} description={`Send a message to ${company.contactName || company.name}.`} footer={<><Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button><Button disabled={messageState.isLoading || !message.trim()} onClick={sendMessage}>Send Message</Button></>}>{messageError && <Banner tone="danger" title="Unable to save">{messageError}</Banner>}<Textarea rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message..." /></Modal>
    <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit company profile" footer={<><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={updateState.isLoading || !canEdit} onClick={saveCompany}>Save changes</Button></>}>{editError && <Banner tone="danger" title="Unable to save">{editError}</Banner>}<div className="company-form">{Object.entries({ name: 'Company name', regNo: 'RC number', contactName: 'Contact person', contactPhone: 'Phone', contactEmail: 'Email', location: 'Location' }).map(([key, name]) => <TextField key={key} label={name} value={editForm[key] || ''} onChange={event => setEditForm({ ...editForm, [key]: event.target.value })} />)}</div></Modal>
    {action && <CompanyActionModal key={`${id}-${action.kind}`} action={action} onClose={() => setAction(null)} onDone={setNotice} />}
  </div>;
}

function CompanyJobs({ query, rows }) {
  if (query.error) return <QueryError query={query} title="Unable to load company jobs" />;
  if (query.isFetching) return <DriverTableLoading columns={5} label="Loading company jobs" />;
  return <><DataTable rows={rows} rowKey={(row) => row.id} columns={[{ key: 'id', header: 'Job ID', render: (row) => <strong className="company-blue">{row.reference}</strong> }, { key: 'route', header: 'Route' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'date', header: 'Date' }, { key: 'amount', header: 'Amount', render: (row) => companyMoney(row.amount) }]} />{!rows.length && <EmptyRecords label="No company jobs found" />}</>;
}

function TrucksTab({ company, trucks, available, query, setQuery, filter, setFilter, page, setPage, selected, setSelected, checked, setChecked, navigate }) {
  const [type, setType] = useState('All Fleet Types');
  const filtered = trucks.filter((truck) => (!query || [truck.plate, truck.type, truck.ref, truck.vin].some((value) => value?.toLowerCase().includes(query.toLowerCase()))) && (filter === 'All Statuses' || truck.status === filter) && (type === 'All Fleet Types' || truck.type === type));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  return <div className="company-tab">
    <StatGrid><StatCard icon="truck" label="Total Trucks" value={display(company.trucks)} /><StatCard icon="truck" tint="green" label="Active Trucks" value={display(company.activeTrucks)} /><StatCard icon="truck" tint="purple" label="Inactive Trucks" value={display(company.fleetCounts?.inactive)} /><StatCard icon="truck" tint="amber" label="Under Maintenance" value={display(company.fleetCounts?.maintenance)} /></StatGrid>
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Trucks ({display(company.trucks)})</h2><p className="tk-meta">All trucks registered under {company.name}.</p></div></div>
      <div className="company-toolbar"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search trucks by plate number, type, VIN..." /><Select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} options={['All Statuses', ...new Set(trucks.map((truck) => truck.status).filter(Boolean))]} /><Select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} options={['All Fleet Types', ...new Set(trucks.map((truck) => truck.type).filter(Boolean))]} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setQuery(''); setFilter('All Statuses'); setType('All Fleet Types'); setPage(1); }}>Reset</Button></div>
      {!available ? <Banner tone="warning" title="Company fleet unavailable">The profile response did not include fleet records.</Banner> : <><DataTable rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)} rowKey={(row) => row.id} selectable selected={checked} onSelect={setChecked} onRowClick={setSelected} coloredHeader columns={[
        { key: 'plate', header: 'Plate Number', render: (row) => <span className="company-vehicle"><span><Icon name="truck" size={20} /></span><strong>{row.plate || '—'}</strong></span> },
        { key: 'type', header: 'Truck Type' }, { key: 'model', header: 'Make / Model', render: (row) => [row.make, row.model].filter(Boolean).join(' ') || '—' }, { key: 'year', header: 'Year' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'date', header: 'Last Active', render: (row) => row.date || '—' }, { key: 'actions', header: 'Actions', render: (row) => <IconButton icon="ellipsis" onClick={(event) => { event.stopPropagation(); setSelected(row); }} /> }
      ]} />{!filtered.length && <EmptyRecords label="No records match these filters" />}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card>{selected && <CompanyTruckRail key={selected.id} companyId={company.id} truck={selected} navigate={navigate} />}</div>
  </div>;
}
function DriversTab({ company, drivers, dataQuery, query, setQuery, filter, setFilter, page, setPage, selected, setSelected, checked, setChecked, navigate }) {
  const [license, setLicense] = useState('All License Types');
  const filtered = drivers.filter((driver) => (!query || [driver.name, driver.license, driver.phone].some((value) => value?.toLowerCase().includes(query.toLowerCase()))) && (filter === 'All Statuses' || driver.status === filter) && (license === 'All License Types' || driver.licenseClass === license));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  const count = (statuses) => !dataQuery.currentData || dataQuery.error ? '—' : drivers.filter((driver) => statuses.includes(driver.statusCode)).length;
  return <div className="company-tab">
    <StatGrid><StatCard icon="users" label="Total Drivers" value={display(company.drivers)} /><StatCard icon="truck" tint="green" label="Active Drivers" value={count(['ACTIVE'])} /><StatCard icon="clock" tint="amber" label="Inactive Drivers" value={count(['INACTIVE', 'BANNED'])} /><StatCard icon="ban" tint="red" label="Suspended Drivers" value={count(['SUSPENDED'])} /></StatGrid>
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Drivers ({display(company.drivers)})</h2><p className="tk-meta">All drivers registered under {company.name}.</p></div><Button variant="outline" icon="download" disabled={dataQuery.isFetching || Boolean(dataQuery.error)} onClick={() => downloadRows(`${company.name}-drivers.csv`, filtered)}>Export Drivers</Button></div>
      <div className="company-toolbar"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search drivers by name, license number, phone..." /><Select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} options={['All Statuses', 'Active', 'On Trip', 'Inactive', 'Pending Review']} /><Select value={license} onChange={(event) => setLicense(event.target.value)} options={['All License Types', 'Heavy Vehicle (Class E)', 'Heavy Vehicle (Class D)']} disabled /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setQuery(''); setFilter('All Statuses'); setLicense('All License Types'); setPage(1); }}>Reset</Button></div>
      <QueryError query={dataQuery} title="Unable to load company drivers" />{dataQuery.isFetching ? <DriverTableLoading columns={7} label="Loading company drivers" /> : !dataQuery.error && <><DataTable rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)} rowKey={(row) => row.id} selectable selected={checked} onSelect={setChecked} onRowClick={setSelected} coloredHeader columns={[
        { key: 'driver', header: 'Driver', render: (row) => <span className="tc-company-cell"><Avatar name={row.name} size={32} /><span><strong>{row.name}</strong><small>{row.id}</small></span></span> }, { key: 'license', header: 'License Number', render: (row) => row.license || '—' }, { key: 'licenseClass', header: 'License Type', render: (row) => row.licenseClass || '—' }, { key: 'phone', header: 'Phone Number' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'joined', header: 'Date Joined', render: (row) => companyDate(row.joined) }, { key: 'actions', header: 'Actions', render: (row) => <IconButton icon="ellipsis" onClick={(event) => { event.stopPropagation(); setSelected(row); }} /> }
      ]} />{!filtered.length && <EmptyRecords label="No records match these filters" />}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card>{selected && !dataQuery.isFetching && !dataQuery.error && <CompanyDriverRail key={selected.id} driver={selected} navigate={navigate} />}</div>
  </div>;
}
function PayoutsTab({ company, payouts, query, summary }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState(''), [status, setStatus] = useState('All Statuses'), [selectedId, setSelectedId] = useState(null), [page, setPage] = useState(1);
  const filtered = payouts.filter((row) => (status === 'All Statuses' || row.status === status) && (!search || [row.id, row.reference, row.jobId].some((value) => value?.toLowerCase().includes(search.toLowerCase()))));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages), selected = filtered.find((row) => row.id === selectedId) || filtered[0];
  return <div className="company-tab">
    <StatGrid five><StatCard icon="wallet" label="Total Earned" value={companyMoney(summary.totalEarned)} /><StatCard icon="circle-check" tint="green" label="Available" value={companyMoney(summary.available)} /><StatCard icon="clock" tint="amber" label="Pending Review" value={companyMoney(summary.pending)} /><StatCard icon="repeat" tint="blue" label="Processing" value={companyMoney(summary.processing)} /><StatCard icon="banknote" tint="purple" label="Paid Out" value={companyMoney(summary.paid)} /></StatGrid>
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Payout ledger ({display(summary.requests)})</h2><p className="tk-meta">Company payouts reconciled to jobs and individual truck trips.</p></div><Button variant="outline" icon="external-link" onClick={() => navigate('/payouts')}>All platform payouts</Button></div>
      <div className="company-toolbar company-payout-toolbar"><SearchField value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search payout, job, or trip ID..." /><Select value={status} onChange={(event) => { if (['Failed', 'Reversed'].includes(event.target.value)) { window.alert('Failed/Reversed bank withdrawal filters are unavailable for job settlements.'); return; } setStatus(event.target.value); setPage(1); }} options={['All Statuses', 'Pending', 'Processing', 'Completed', 'Failed', 'Reversed']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setSearch(''); setStatus('All Statuses'); setPage(1); }}>Reset</Button></div>
      <QueryError query={query} title="Unable to load company payouts" />{query.isFetching ? <DriverTableLoading columns={8} label="Loading company payouts" /> : !query.error && <><DataTable rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)} rowKey={(row) => row.id} coloredHeader onRowClick={(row) => setSelectedId(row.id)} columns={[
        { key: 'id', header: 'Payout ID', render: (row) => <button className="company-blue company-button-link" onClick={() => setSelectedId(row.id)}>{row.reference || row.id}</button> }, { key: 'jobId', header: 'Job', render: row => row.jobId || '—' }, { key: 'trips', header: 'Trips', render: row => display(row.tripCount) }, { key: 'gross', header: 'Gross', render: row => companyMoney(row.grossAmount) }, { key: 'deductions', header: 'Deductions', render: row => companyMoney(row.deductions) }, { key: 'net', header: 'Net', render: row => companyMoney(row.netAmount) }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'eligibility', header: 'Eligibility', render: row => row.eligibility || '—' }
      ]} />{!filtered.length && <EmptyRecords label="No records match these filters" />}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card><aside className="company-detail-rail"><Card><PanelHeader title="Payout Details" />{query.isFetching ? <DriverTableLoading columns={2} label="Loading payout details" /> : selected && !query.error ? <>
      <div className="company-payout-total"><span className="tk-meta">Payout amount</span><strong>{companyMoney(selected.amount)}</strong><Status value={selected.status} /></div>
      <KeyValues rows={[["Payout ID", selected.payoutId], ['Reference', selected.reference], ['Amount', companyMoney(selected.amount)], ['Fee', companyMoney(selected.fee)], ['Source', selected.source], ['Requested By', selected.requestedBy], ['Job', selected.jobId], ['Trips included', selected.tripCount], ['Gross amount', companyMoney(selected.grossAmount)], ['Deductions', companyMoney(selected.deductions)], ['Eligibility', selected.eligibility], ['Reconciliation', selected.reconciled == null ? null : selected.reconciled ? 'Reconciled' : 'Mismatch'], ['Requested', selected.dateRequested]]} /><Button fullWidth disabled>View Full Details</Button>
    </> : <p className="tk-meta">Select a payout to inspect it.</p>}</Card></aside></div>
  </div>;
}

function CompanyTruckRail({ companyId, truck, navigate }) {
  const owner = useSelector(state => state.auth.admin?.id);
  const detailQuery = useGetAdminCompanyTruckQuery({ id: truck.id, companyId, owner });
  const detail = detailQuery.error ? null : detailQuery.currentData;
  const model = [detail?.make || truck.make, detail?.model || truck.model].filter(Boolean).join(' ') || '—';
  return <aside className="company-detail-rail"><Card><PanelHeader title="Truck Details" /><div className="company-truck-visual"><Icon name="truck" size={72} /></div><h2 className="tk-title">{truck.plate}</h2><p className="tk-body">{model} <Badge tone="info">{detail?.tag || truck.tag || '—'}</Badge></p><QueryError query={detailQuery} title="Truck details unavailable" />{detailQuery.isFetching ? <DriverTableLoading columns={2} label="Loading truck details" /> : <KeyValues rows={[["VIN Number", detail?.vin || truck.vin], ['Engine Number', detail?.engineNumber || truck.engineNumber], ['Year of Manufacture', detail?.year || truck.year], ['Fleet Type', detail?.type || truck.type], ['Load Capacity', detail?.containerWeight || truck.weight], ['Fuel Type', detail?.fuelType || truck.fuelType], ['Status', <Status value={detail?.status || truck.status} />], ['Last Active', truck.date], ['Current Location', truck.loc], ['Assigned Driver', detail?.driver || truck.driver]]} />}<div style={{ display: 'flex', gap: 6, marginTop: 16 }}><Button onClick={() => navigate(`/fleet/detail?id=${encodeURIComponent(truck.id)}`)}>View Full Details</Button><Button variant="outline" icon="wrench" onClick={() => navigate('/maintenance')}>View Maintenance</Button></div></Card><Card><PanelHeader title="Recent Activity" /><p className="tk-meta">Truck activity history is unavailable.</p></Card></aside>;
}
function CompanyDriverRail({ driver, navigate }) {
  const profileQuery = useGetAdminDriverProfileQuery(driver.id);
  const licenseQuery = useGetAdminDriverLicenseQuery(driver.id);
  const tripsQuery = useGetAdminTripsQuery({ driverId: driver.id, page: 1, limit: 1 });
  const profile = profileQuery.error ? null : profileQuery.currentData, license = licenseQuery.error ? null : licenseQuery.currentData;
  let documentUrl = null;
  try { const url = new URL(license?.licenseUrl); if (['https:', 'http:'].includes(url.protocol)) documentUrl = url.href; } catch { /* A missing or unsafe document URL has no link. */ }
  return <aside className="company-detail-rail"><Card><div className="company-panel-head"><h2 className="tk-section">Driver Details</h2><Status value={driver.status} /></div><div className="company-driver-head"><Avatar name={driver.name} size={76} /><div><h2 className="tk-title">{driver.name}</h2><small>{driver.id}</small><span><Icon name="phone" size={14} />{driver.phone || '—'}</span><span><Icon name="mail" size={14} />{driver.email || '—'}</span><span><Icon name="map-pin" size={14} />—</span></div></div><QueryError query={profileQuery} title="Driver profile unavailable" /><QueryError query={licenseQuery} title="Driver license unavailable" /><QueryError query={tripsQuery} title="Driver trips unavailable" />{profileQuery.isFetching || licenseQuery.isFetching ? <DriverTableLoading columns={2} label="Loading driver details" /> : <KeyValues rows={[["License Number", license?.licenseNumber || driver.license], ['License Type', null], ['Date of Birth', null], ['Address', null], ['Date Joined', companyDate(profile?.joined || driver.joined)], ['Status', <Status value={driver.status} />], ['Assigned Truck', driver.truckPlate], ['Total Trips', tripsQuery.error ? null : tripsQuery.currentData?.pagination?.total], ['Rating', driver.rating]]} />}<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}><Button fullWidth icon="eye" onClick={() => navigate(`/drivers/detail?id=${encodeURIComponent(driver.id)}`)}>View Full Profile</Button><Button variant="outline" icon="file-text" fullWidth disabled={!documentUrl || licenseQuery.isFetching || Boolean(licenseQuery.error)} onClick={() => { if (documentUrl) window.open(documentUrl, '_blank', 'noopener,noreferrer'); }}>View Documents</Button></div></Card><Card><PanelHeader title="Recent Activity" /><p className="tk-meta">Driver activity history is unavailable.</p></Card></aside>;
}
