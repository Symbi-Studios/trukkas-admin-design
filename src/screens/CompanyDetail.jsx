'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../router.js';
import { Avatar, Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, IconButton, Modal, PageHeader, Pagination, SearchField, Select, StatCard, Tabs, Textarea, TextField } from '../ds.js';
import { companyDate, companyError, companyMoney, useGetAdminCompaniesQuery, useGetAdminCompanyProfileQuery, useGetAdminCompanyInfoQuery, useGetAdminCompanyDriversQuery, useGetAdminCompanyPayoutsQuery, useGetAdminCompanyTruckQuery, useUpdateAdminCompanyMutation, useMessageAdminCompanyMutation } from '../store/features/companies/companiesApi.js';
import { useGetAdminCompanyScreenSummaryQuery, useGetAdminCompanyScreenJobsQuery, useGetAdminCompanyScreenActivityQuery, useGetAdminCompanyScreenDriverQuery } from '../store/features/companies/companyScreenApi.js';
import { CompanyActionModal } from './CompanyActionModal.jsx';
import { CompanyDetailLoading } from './CompaniesLoading.jsx';
import { DriverTableLoading } from './DriversLoading.jsx';
import './CompanyDetail.css';

const statusTone = { Active: 'success', Approved: 'success', Available: 'success', 'On Trip': 'info', 'In Maintenance': 'warning', Inactive: 'neutral', Suspended: 'danger', 'Pending Review': 'warning', Pending: 'warning', Delivered: 'success', Completed: 'success', Processing: 'info', Failed: 'danger', Reversed: 'warning', 'In Transit': 'info', Assigned: 'info', Open: 'warning', Verified: 'success', Rejected: 'danger' };
const display = (value) => value ?? '—';
function downloadRows(filename, rows) {
  const fields = Object.keys(rows[0] || {}).filter((field) => !rows.some((row) => row[field] && typeof row[field] === 'object'));
  const csv = [fields.join(','), ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? '').replace(/^[=+@-]/, match => "'"+match).replaceAll('"', '""')}"`).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
function PanelHeader({ title, action, onAction }) { return <div className="company-panel-head"><h2 className="tk-section">{title}</h2>{action && <button onClick={onAction}>{action}</button>}</div>; }
function KeyValues({ rows, className = 'company-key-values' }) { return <div className={className}>{rows.map(([name, value]) => <div key={name}>{className === 'company-info-grid' ? <small>{name}</small> : <span>{name}</span>}<strong>{display(value)}</strong></div>)}</div>; }
function Status({ value }) { return <Badge dot tone={statusTone[value] || 'neutral'}>{value || '—'}</Badge>; }
function StatGrid({ children, five = false }) { return <div className={`company-stats ${five ? 'company-stats-five' : ''}`}>{children}</div>; }
function EmptyRecords({ label }) { return <div className="company-empty"><Icon name="search" size={24} /><strong>{label}</strong></div>; }
function QueryError({ query, title }) { return query.error ? <Banner tone="danger" title={title}>{companyError(query.error)}<Button variant="outline" onClick={query.refetch}>Retry</Button></Banner> : null; }
function ActivityList({ rows, query }) {
  if (query.isFetching) return <DriverTableLoading columns={3} label="Loading company activity" />;
  if (query.error) return <QueryError query={query} title="Unable to load company activity" />;
  if (!rows.length) return <p className="tk-meta">No company account activity found.</p>;
  return <div className="company-activity">{rows.map((row) => <div key={row.id}><span><Icon name={row.icon} size={16} /></span><p><strong>{row.title}</strong><small>{row.sub || '—'}</small></p><time>{row.time}</time></div>)}</div>;
}

export function CompanyDetail() {
  const params = useParams(), search = useSearchParams();
  const id = search.get('id') || params.companyId || '';
  const owner = useSelector(state => state.auth.admin?.id);
  const role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <CompanyScreen key={id+':'+String(owner)+':'+String(role)+':'+authenticated} />;
}
function CompanyScreen() {
  const navigate = useNavigate(), params = useParams(), search = useSearchParams();
  const id = search.get('id') || params.companyId || '';
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  const owner = useSelector(state => state.auth.admin?.id);
  const adminRole = useSelector((state) => state.auth.admin?.role);

  const canEdit = ['SUPER_ADMIN', 'OPS_ADMIN'].includes(adminRole);
  const [editForm, setEditForm] = useState({}), [editError, setEditError] = useState(null), [messageError, setMessageError] = useState(null);
  const [updateCompany, updateState] = useUpdateAdminCompanyMutation();
  const [messageCompany, messageState] = useMessageAdminCompanyMutation();
  const submitting = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [tab, setTab] = useState('Overview'), [query, setQuery] = useState(''), [filter, setFilter] = useState('All Statuses'), [page, setPage] = useState(1), [selectedTruckId, setSelectedTruckId] = useState(null), [selectedDriverId, setSelectedDriverId] = useState(null), [checkedTrucks, setCheckedTrucks] = useState([]), [checkedDrivers, setCheckedDrivers] = useState([]), [menu, setMenu] = useState(false), [editOpen, setEditOpen] = useState(false), [messageOpen, setMessageOpen] = useState(false), [message, setMessage] = useState(''), [action, setAction] = useState(null), [notice, setNotice] = useState(null);
  useEffect(() => { setQuery(''); setFilter('All Statuses'); setMenu(false); setEditOpen(false); setMessageOpen(false); setMessage(''); }, [id]);
  const requestedTab = search.get('tab');
  useEffect(() => { setTab(({ trucks: 'Trucks', drivers: 'Drivers', payouts: 'Payouts' })[requestedTab] || 'Overview'); setPage(1); setSelectedTruckId(null); setSelectedDriverId(null); setCheckedTrucks([]); setCheckedDrivers([]); setNotice(null); setAction(null); }, [id, requestedTab]);
  const profileQuery = useGetAdminCompanyProfileQuery({ id, owner }, { skip: !authenticated || !id, refetchOnMountOrArgChange: true });
  const profile = profileQuery.error ? null : profileQuery.currentData;
  const validCompany = profile?.role === 'TRUCKER' && profile?.truckerType === 'COMPANY';
  const infoQuery = useGetAdminCompanyInfoQuery({ id, owner }, { skip: !authenticated || !id || !validCompany, refetchOnMountOrArgChange: true });
  const directoryQuery = useGetAdminCompaniesQuery(owner, { skip: !authenticated || !validCompany });
  const driversQuery = useGetAdminCompanyDriversQuery({ id, owner }, { skip: !authenticated || !validCompany || !['Overview', 'Drivers'].includes(tab) });
  const payoutsQuery = useGetAdminCompanyPayoutsQuery({ id, owner }, { skip: !authenticated || !validCompany || !['Overview', 'Payouts'].includes(tab) });
  const screenArgs = { id, owner, role: adminRole };
  const jobsQuery = useGetAdminCompanyScreenJobsQuery(screenArgs, { skip: !authenticated || !validCompany || !['Overview', 'Jobs'].includes(tab) });
  const summaryQuery = useGetAdminCompanyScreenSummaryQuery(screenArgs, { skip: !authenticated || !validCompany || !['Overview', 'Payouts'].includes(tab) });
  const activityQuery = useGetAdminCompanyScreenActivityQuery(screenArgs, { skip: !authenticated || !validCompany || !['Overview', 'Activity Log'].includes(tab) });
  const company = useMemo(() => {
    if (!profile) return null;
    const entry = directoryQuery.error ? null : directoryQuery.currentData?.find((row) => row.id === id);
    const info = Object.fromEntries(Object.entries(infoQuery.error ? {} : infoQuery.currentData || {}).filter(([, value]) => value != null && value !== '—'));
    return { ...profile, ...info, trucks: profile.fleet?.length ?? entry?.trucks ?? null, drivers: (driversQuery.error ? null : driversQuery.currentData?.length) ?? entry?.drivers ?? null, completedJobs: entry?.completedJobs ?? (jobsQuery.error ? null : jobsQuery.currentData?.completed) ?? null, activeTrucks: profile.fleetCounts?.active ?? entry?.activeTrucks ?? null };
  }, [profile, id, directoryQuery.currentData, directoryQuery.error, infoQuery.currentData, infoQuery.error, driversQuery.currentData, driversQuery.error, jobsQuery.currentData, jobsQuery.error]);
  const trucks = profile?.fleet || [], drivers = driversQuery.error ? [] : driversQuery.currentData || [], payouts = payoutsQuery.error ? [] : payoutsQuery.currentData || [], jobs = jobsQuery.error ? [] : jobsQuery.currentData?.rows || [], activity = activityQuery.error ? [] : activityQuery.currentData || [];
  const summary = { totalEarned: profile?.totalEarned, available: summaryQuery.error ? null : summaryQuery.currentData?.available, pending: summaryQuery.error ? null : summaryQuery.currentData?.pending, processing: summaryQuery.error ? null : summaryQuery.currentData?.processing,
    paid: payoutsQuery.currentData && !payoutsQuery.error && payouts.every(row => row.paid != null) ? payouts.reduce((total, row) => total + row.paid, 0) : null,
    requests: payoutsQuery.currentData && !payoutsQuery.error ? payouts.length : null };
  const driverGroups = [['ACTIVE'], ['INACTIVE', 'SUSPENDED', 'BANNED'], ['PENDING_PROFILE', 'PENDING_REVIEW']];
  const driverCounts = driversQuery.currentData && !driversQuery.error && drivers.every(driver => driverGroups.flat().includes(driver.statusCode)) ? driverGroups.map(statuses => drivers.filter(driver => statuses.includes(driver.statusCode)).length) : [null, null, null];
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
    try { await updateCompany({ id, form: editForm, original: company }).unwrap(); if (!active.current) return; setEditOpen(false); setNotice('Company details updated.'); }
    catch (error) { if (active.current) setEditError(companyError(error)); }
    finally { submitting.current = false; }
  }
  async function sendMessage() {
    if (submitting.current) return;
    submitting.current = true; setMessageError(null);
    try { await messageCompany({ id, message }).unwrap(); if (!active.current) return; setMessageOpen(false); setMessage(''); setNotice('Message sent.'); }
    catch (error) { if (active.current) setMessageError(companyError(error)); }
    finally { submitting.current = false; }
  }
  return <div className="company-page">
    <PageHeader crumbs={['Companies', { label: 'Trucking Companies', onClick: () => navigate('/companies') }, company.name]} title="Company Details" description="Review the company profile, fleet, drivers, documents and compliance status." actions={<><IconButton icon="ellipsis" onClick={() => setMenu(!menu)} /><Button variant="outline" icon="mail" onClick={() => { setMessageError(null); setMessageOpen(true); }}>Send Message</Button><span className="company-menu-wrap"><Button iconRight="chevron-down" onClick={() => setMenu(!menu)}>Actions</Button>{menu && <span className="company-dropdown"><DropdownMenu width={220} items={[{ label: 'Edit company', icon: 'pencil', onClick: () => { openEditor(); setMenu(false); } }, { label: 'Print profile', icon: 'printer', onClick: () => window.print() }, { divider: true }, ...(company.statusCode === 'SUSPENDED' ? [{ label: 'Reactivate company', icon: 'ban', onClick: () => startAction('activate') }] : company.statusCode === 'ACTIVE' ? [{ label: 'Suspend company', icon: 'ban', tone: 'danger', onClick: () => startAction('suspend') }] : [])]} /></span>}</span></>} />
    {notice && <Banner tone="info" title="Company">{notice}</Banner>}
    <QueryError query={infoQuery} title="Company verification data unavailable" />
    <header className="company-hero"><div className="company-brand"><Avatar name={company.name} size={64} square /><div><div className="company-name"><h2 className="tk-title">{company.name}</h2><Status value={company.verification} /></div><p>{company.regNo || '—'}<span />{company.location || '—'}</p><small>Reliable movement. Greater possibilities.</small></div></div><div className="company-contact"><span><Icon name="phone" size={16} />{company.contactPhone || '—'}</span><span><Icon name="mail" size={16} />{company.contactEmail || '—'}</span><span><Icon name="globe" size={16} />{company.website || '—'}</span><span><Icon name="map-pin" size={16} />{company.location || '—'}</span><span className="company-date"><small>Joined On</small><strong>{company.joined}</strong></span><span className="company-date"><small>Last Updated</small><strong>{company.updated}</strong></span></div></header>
    <Tabs value={tab} onChange={setSection} items={[{ value: 'Overview', label: 'Overview' }, { value: 'Trucks', label: 'Trucks', count: display(company.trucks) }, { value: 'Drivers', label: 'Drivers', count: display(company.drivers) }, { value: 'Documents', label: 'Documents', count: display(company.documentCount) }, { value: 'Jobs', label: 'Jobs', count: display(company.totalJobs) }, { value: 'Payouts', label: 'Payouts', count: display(summary.requests) }, { value: 'Compliance', label: 'Compliance' }, { value: 'Activity Log', label: 'Activity Log' }]} />
    {tab === 'Overview' && <div className="company-tab">
      <StatGrid five><StatCard delta="—" direction={null} caption="from last month" icon="truck" label="Fleet Size" value={display(company.trucks)} /><StatCard delta="—" direction={null} caption="from last month" icon="users" tint="teal" label="Drivers" value={display(company.drivers)} /><StatCard icon="truck" tint="green" label="Active Trucks" value={display(company.activeTrucks)} caption={fleetShare(company.activeTrucks, company.trucks)+' of fleet'} /><StatCard delta="—" direction={null} caption="from last month" icon="clipboard-check" tint="purple" label="Completed Jobs" value={display(company.completedJobs)} /><StatCard caption={summary.requests == null ? '—' : `${summary.requests} payout request${summary.requests === 1 ? '' : 's'}`} icon="wallet" tint="amber" label="Total Earnings" value={companyMoney(company.totalEarned)} /></StatGrid>
      <div className="company-overview-grid"><div className="company-overview-main">
        <Card><PanelHeader title="Company Information" action="Edit" onAction={openEditor} /><KeyValues rows={companyFields} className="company-info-grid" /></Card>
        <Card><PanelHeader title="Fleet Overview" action="View All" onAction={() => setSection('Trucks')} /><div className="company-progress-labels"><span><i className="green" />Active <strong>{display(company.fleetCounts?.active)}</strong></span><span><i className="grey" />Inactive <strong>{display(company.fleetCounts?.inactive)}</strong></span><span><i className="amber" />Under Maintenance <strong>{display(company.fleetCounts?.maintenance)}</strong></span><b>{display(company.trucks)}<small>Total Trucks</small></b></div><div className="company-progress">{['active', 'inactive', 'maintenance'].map(key => <span key={key} style={{ width: percentage(company.fleetCounts?.[key], company.trucks)+'%' }} />)}</div></Card>
        <Card><PanelHeader title="Driver Overview" action="View All" onAction={() => setSection('Drivers')} /><QueryError query={driversQuery} title="Unable to load company drivers" />{driversQuery.isFetching ? <DriverTableLoading columns={3} label="Loading company driver summary" /> : !driversQuery.error && <div className="company-progress-labels">{['Active', 'Inactive', 'Pending'].map((name, index) => <span key={name}><i className={['green','grey','amber'][index]} />{name} <strong>{display(driverCounts[index])}</strong></span>)}<b>{display(company.drivers)}<small>Total Drivers</small></b></div>}<div className="company-progress drivers">{driverCounts.map((count,index) => <span key={index} style={{ width: percentage(count, company.drivers)+'%' }} />)}</div></Card>
        <Card><PanelHeader title="Recent Jobs" action="View All" onAction={() => setSection('Jobs')} /><CompanyJobs query={jobsQuery} rows={jobs.slice(0, 5)} /></Card>
      </div><aside className="company-overview-side">
        <Card><PanelHeader title="Verification & Compliance" action="View All" onAction={() => setSection('Documents')} />{infoQuery.isFetching ? <DriverTableLoading columns={3} label="Loading company documents" /> : documents == null ? '—' : documents.map(document => <div className="company-doc" key={document.rowKey}><Icon name="circle-check" size={17} /><span>{document.name}</span><Badge tone={statusTone[document.status] || 'neutral'}>{document.status || '—'}</Badge><time>{document.date}</time></div>)}</Card>
        <Card><PanelHeader title="Payment & Earnings" action="View All" onAction={() => setSection('Payouts')} /><QueryError query={payoutsQuery} title="Unable to load company payouts" /><QueryError query={summaryQuery} title="Company payout summary unavailable" />{payoutsQuery.isFetching || summaryQuery.isFetching ? <DriverTableLoading columns={2} label="Loading company payouts" /> : <div className="company-payments">{[['wallet', 'Total Earnings', summary.totalEarned], ['building-2', 'Total Paid Out', summary.paid], ['circle-check', 'Pending Payout', summary.pending], ['credit-card', 'Available', summary.available]].map(([icon, name, amount]) => <div key={name}><span><Icon name={icon} size={17} /></span><p><small>{name}</small><strong>{companyMoney(amount)}</strong></p></div>)}</div>}</Card>
        <Card><PanelHeader title="Recent Activity" action="View All" onAction={() => setSection('Activity Log')} /><ActivityList rows={activity.slice(0, 5)} query={activityQuery} /></Card>
      </aside></div>
    </div>}
    {tab === 'Trucks' && <TrucksTab onActivity={() => setSection('Activity Log')} company={company} trucks={trucks} available={profile.fleet != null} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} page={page} setPage={setPage} selected={selectedTruck} setSelected={(row) => setSelectedTruckId(row.id)} checked={checkedTrucks} setChecked={setCheckedTrucks} navigate={navigate} />}
    {tab === 'Drivers' && <DriversTab onActivity={() => setSection('Activity Log')} company={company} drivers={drivers} dataQuery={driversQuery} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} page={page} setPage={setPage} selected={selectedDriver} setSelected={(row) => setSelectedDriverId(row.id)} checked={checkedDrivers} setChecked={setCheckedDrivers} navigate={navigate} />}
    {tab === 'Payouts' && <PayoutsTab company={company} payouts={payouts} query={payoutsQuery} summary={summary} summaryQuery={summaryQuery} />}
    {['Jobs', 'Documents', 'Compliance', 'Activity Log'].includes(tab) && <CompanyRecords tab={tab} jobs={jobs} jobsQuery={jobsQuery} documents={documents} infoQuery={infoQuery} activity={activity} activityQuery={activityQuery} navigate={navigate} />}
    <Modal open={messageOpen} onClose={() => { if (!submitting.current) setMessageOpen(false); }} title={`Message ${company.name}`} description={`Send a message to ${company.contactName || company.name}.`} footer={<><Button variant="outline" disabled={messageState.isLoading} onClick={() => setMessageOpen(false)}>Cancel</Button><Button disabled={messageState.isLoading || !message.trim()} onClick={sendMessage}>Send Message</Button></>}>{messageError && <Banner tone="danger" title="Unable to save">{messageError}</Banner>}<Textarea rows={6} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message..." /></Modal>
    <Modal open={editOpen} onClose={() => { if (!submitting.current) setEditOpen(false); }} title="Edit company profile" footer={<><Button variant="outline" disabled={updateState.isLoading} onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={updateState.isLoading || !canEdit} onClick={saveCompany}>Save changes</Button></>}>{editError && <Banner tone="danger" title="Unable to save">{editError}</Banner>}<div className="company-form">{Object.entries({ name: 'Company name', regNo: 'RC number', contactName: 'Contact person', contactPhone: 'Phone', contactEmail: 'Email', location: 'Location' }).map(([key, name]) => <TextField key={key} label={name} value={editForm[key] || ''} onChange={event => setEditForm({ ...editForm, [key]: event.target.value })} />)}</div></Modal>
    {action && <CompanyActionModal key={`${id}-${action.kind}`} action={action} onClose={() => setAction(null)} onDone={setNotice} />}
  </div>;
}

function percentage(value,total) { return Number.isFinite(value) && Number.isFinite(total) && total > 0 && value >= 0 && value <= total ? value / total * 100 : 0; }
function fleetShare(value,total) { return value == null || total == null || total <= 0 || value > total ? '—' : Math.round(percentage(value,total))+'%'; }
function CompanyRecords({ tab, jobs, jobsQuery, documents, infoQuery, activity, activityQuery, navigate }) {
  const docs = ['Documents', 'Compliance'].includes(tab), query = docs ? infoQuery : tab === 'Jobs' ? jobsQuery : activityQuery;
  const columns = docs ? [{ key: 'name', header: 'Document' }, { key: 'status', header: 'Status', render: row => <Badge tone={statusTone[row.status] || 'neutral'}>{row.status || '—'}</Badge> }, { key: 'date', header: 'Reviewed On' }]
    : tab === 'Jobs' ? [{ key: 'reference', header: 'Job ID', render: row => <button className="company-blue company-button-link" onClick={() => navigate('/jobs/detail?id='+encodeURIComponent(row.id))}>{row.reference}</button> }, { key: 'route', header: 'Route' }, { key: 'status', header: 'Status', render: row => <Status value={row.status} /> }, { key: 'amount', header: 'Value', render: row => companyMoney(row.amount) }]
    : [{ key: 'title', header: tab }, { key: 'sub', header: 'Source' }, { key: 'time', header: 'Updated' }];
  return <Card pad="none"><div className="company-list-head"><div><h2 className="tk-section">{tab}</h2><p className="tk-meta">Current {tab.toLowerCase()} records for this company.</p></div></div><QueryError query={query} title={'Unable to load '+tab.toLowerCase()} />{query.isFetching ? <DriverTableLoading columns={columns.length} label={'Loading company '+tab.toLowerCase()} /> : !query.error && <DataTable rows={(docs ? documents : tab === 'Jobs' ? jobs : activity) || []} rowKey={row => row.rowKey || row.id} coloredHeader columns={columns} />}</Card>;
}
function CompanyJobs({ query, rows }) {
  if (query.error) return <QueryError query={query} title="Unable to load company jobs" />;
  if (query.isFetching) return <DriverTableLoading columns={5} label="Loading company jobs" />;
  return <><DataTable rows={rows} rowKey={(row) => row.id} columns={[{ key: 'id', header: 'Job ID', render: (row) => <strong className="company-blue">{row.reference}</strong> }, { key: 'route', header: 'Route' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'date', header: 'Date' }, { key: 'amount', header: 'Amount', render: (row) => companyMoney(row.amount) }]} />{!rows.length && <EmptyRecords label="No company jobs found" />}</>;
}

function TrucksTab({ onActivity, company, trucks, available, query, setQuery, filter, setFilter, page, setPage, selected, setSelected, checked, setChecked, navigate }) {
  const [type, setType] = useState('All Fleet Types');
  const filtered = trucks.filter((truck) => (!query || [truck.plate, truck.type, truck.ref, truck.vin].some((value) => value?.toLowerCase().includes(query.toLowerCase()))) && (filter === 'All Statuses' || truck.status === filter) && (type === 'All Fleet Types' || truck.type === type));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  return <div className="company-tab">
    <StatGrid><StatCard delta="—" direction={null} caption="from last month" icon="truck" label="Total Trucks" value={display(company.trucks)} /><StatCard delta={fleetShare(company.activeTrucks, company.trucks)} caption="of fleet" icon="truck" tint="green" label="Active Trucks" value={display(company.activeTrucks)} /><StatCard delta={fleetShare(company.fleetCounts?.inactive, company.trucks)} direction="down" caption="of fleet" icon="truck" tint="purple" label="Inactive Trucks" value={display(company.fleetCounts?.inactive)} /><StatCard delta={fleetShare(company.fleetCounts?.maintenance, company.trucks)} direction="down" caption="of fleet" icon="truck" tint="amber" label="Under Maintenance" value={display(company.fleetCounts?.maintenance)} /></StatGrid>
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Trucks ({display(company.trucks)})</h2><p className="tk-meta">All trucks registered under {company.name}.</p></div></div>
      <div className="company-toolbar"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search trucks by plate number, type, VIN..." /><Select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} options={['All Statuses', 'Available', 'On Trip', 'In Maintenance', 'Inactive']} /><Select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} options={['All Fleet Types', 'Trailer', 'Container', 'Flatbed', 'Tanker']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setQuery(''); setFilter('All Statuses'); setType('All Fleet Types'); setPage(1); }}>Reset</Button></div>
      {!available ? <Banner tone="warning" title="Company fleet unavailable">The profile response did not include fleet records.</Banner> : <><DataTable rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)} rowKey={(row) => row.id} selectable selected={checked} onSelect={setChecked} onRowClick={setSelected} coloredHeader columns={[
        { key: 'plate', header: 'Plate Number', render: (row) => <span className="company-vehicle"><span><Icon name="truck" size={20} /></span><strong>{row.plate || '—'}</strong></span> },
        { key: 'type', header: 'Truck Type' }, { key: 'model', header: 'Make / Model', render: (row) => [row.make, row.model].filter(Boolean).join(' ') || '—' }, { key: 'year', header: 'Year' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'date', header: 'Last Active', render: (row) => row.date || '—' }, { key: 'actions', header: 'Actions', render: (row) => <IconButton icon="ellipsis" onClick={(event) => { event.stopPropagation(); setSelected(row); }} /> }
      ]} />{!filtered.length && <EmptyRecords label="No records match these filters" />}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card>{selected && <CompanyTruckRail key={selected.id} companyId={company.id} truck={selected} navigate={navigate} onActivity={onActivity} />}</div>
  </div>;
}
function DriversTab({ onActivity, company, drivers, dataQuery, query, setQuery, filter, setFilter, page, setPage, selected, setSelected, checked, setChecked, navigate }) {
  const [license, setLicense] = useState('All License Types');
  const filtered = drivers.filter((driver) => (!query || [driver.name, driver.license, driver.phone].some((value) => value?.toLowerCase().includes(query.toLowerCase()))) && (filter === 'All Statuses' || driver.status === filter) && (license === 'All License Types' || driver.licenseClass === license || driver.licenseClass === license.match(/\(([^)]+)\)/)?.[1]));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages);
  const count = (statuses) => !dataQuery.currentData || dataQuery.error || drivers.some(driver => !driver.statusCode) ? '—' : drivers.filter((driver) => statuses.includes(driver.statusCode)).length;
  return <div className="company-tab">
    <StatGrid><StatCard delta="—" direction={null} caption="from last month" icon="users" label="Total Drivers" value={display(company.drivers)} /><StatCard delta="—" direction={null} caption="from last month" icon="truck" tint="green" label="Active Drivers" value={count(['ACTIVE'])} /><StatCard delta="—" direction={null} caption="from last month" icon="clock" tint="amber" label="Inactive Drivers" value={count(['INACTIVE', 'BANNED'])} /><StatCard caption="from last month" icon="ban" tint="red" label="Suspended Drivers" value={count(['SUSPENDED'])} /></StatGrid>
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Drivers ({display(company.drivers)})</h2><p className="tk-meta">All drivers registered under {company.name}.</p></div><Button variant="outline" icon="download" disabled={dataQuery.isFetching || Boolean(dataQuery.error)} onClick={() => downloadRows(`${company.name}-drivers.csv`, filtered)}>Export Drivers</Button></div>
      <div className="company-toolbar"><SearchField value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search drivers by name, license number, phone..." /><Select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }} options={['All Statuses', 'Active', 'On Trip', 'Inactive', 'Pending Review']} /><Select value={license} onChange={(event) => setLicense(event.target.value)} options={['All License Types', 'Heavy Vehicle (Class E)', 'Heavy Vehicle (Class D)']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setQuery(''); setFilter('All Statuses'); setLicense('All License Types'); setPage(1); }}>Reset</Button></div>
      <QueryError query={dataQuery} title="Unable to load company drivers" />{dataQuery.isFetching ? <DriverTableLoading columns={7} label="Loading company drivers" /> : !dataQuery.error && <><DataTable rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)} rowKey={(row) => row.id} selectable selected={checked} onSelect={setChecked} onRowClick={setSelected} coloredHeader columns={[
        { key: 'driver', header: 'Driver', render: (row) => <span className="tc-company-cell"><Avatar name={row.name} size={32} /><span><strong>{row.name}</strong><small>{row.id}</small></span></span> }, { key: 'license', header: 'License Number', render: (row) => row.license || '—' }, { key: 'licenseClass', header: 'License Type', render: (row) => row.licenseClass || '—' }, { key: 'phone', header: 'Phone Number' }, { key: 'status', header: 'Status', render: (row) => <Status value={row.status} /> }, { key: 'joined', header: 'Date Joined', render: (row) => companyDate(row.joined) }, { key: 'actions', header: 'Actions', render: (row) => <IconButton icon="ellipsis" onClick={(event) => { event.stopPropagation(); setSelected(row); }} /> }
      ]} />{!filtered.length && <EmptyRecords label="No records match these filters" />}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card>{selected && !dataQuery.isFetching && !dataQuery.error && <CompanyDriverRail key={selected.id} companyId={company.id} driver={selected} navigate={navigate} onActivity={onActivity} />}</div>
  </div>;
}
function PayoutsTab({ company, payouts, query, summary, summaryQuery }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState(''), [status, setStatus] = useState('All Statuses'), [selectedId, setSelectedId] = useState(null), [page, setPage] = useState(1);
  const filtered = payouts.filter(row => (status === 'All Statuses' || row.status === status) && (!search || [row.id, row.reference, row.jobId, ...(row.tripIds || [])].some(value => value?.toLowerCase().includes(search.toLowerCase()))));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)), currentPage = Math.min(page, pages), row = filtered.find(item => item.id === selectedId) || filtered[0];
  const payoutPath = payout => '/payouts/detail?id='+encodeURIComponent(payout.id)+(payout.source ? '&source='+encodeURIComponent(payout.source) : '');
  const eligibility = payout => <Badge tone={payout.approvalReady === true ? 'success' : payout.eligibility === 'Needs Review' ? 'warning' : 'neutral'}>{payout.eligibility}</Badge>;
  return <div className="company-tab">
    <StatGrid five><StatCard icon="wallet" label="Total Earned" value={companyMoney(summary.totalEarned)} caption={summary.requests == null ? '—' : summary.requests+' requests'} /><StatCard icon="circle-check" tint="green" label="Available" value={companyMoney(summary.available)} caption="eligible for approval" /><StatCard icon="clock" tint="amber" label="Pending Review" value={companyMoney(summary.pending)} caption="submitted requests" /><StatCard icon="repeat" tint="blue" label="Processing" value={companyMoney(summary.processing)} caption="approved or processing" /><StatCard icon="banknote" tint="purple" label="Paid Out" value={companyMoney(summary.paid)} caption="completed payouts" /></StatGrid>
    <QueryError query={summaryQuery} title="Company payout summary unavailable" />
    <div className="company-list-layout"><Card pad="none">
      <div className="company-list-head"><div><h2 className="tk-section">Payout ledger ({display(summary.requests)})</h2><p className="tk-meta">Company payouts reconciled to jobs and individual truck trips.</p></div><Button variant="outline" icon="external-link" onClick={() => navigate('/payouts?companyId='+encodeURIComponent(company.id))}>All platform payouts</Button></div>
      <div className="company-toolbar company-payout-toolbar"><SearchField value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search payout, job, or trip ID..." /><Select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} options={['All Statuses', 'Pending Review', 'Approved', 'Processing', 'Completed', 'Rejected']} /><Button variant="outline" icon="sliders-horizontal" onClick={() => { setSearch(''); setStatus('All Statuses'); setPage(1); }}>Reset</Button></div>
      <QueryError query={query} title="Unable to load company payouts" />{query.isFetching ? <DriverTableLoading columns={8} label="Loading company payouts" /> : !query.error && <><DataTable rows={filtered.slice((currentPage-1)*10,currentPage*10)} rowKey={item => item.id} coloredHeader onRowClick={item => setSelectedId(item.id)} columns={[
        { key: 'id', header: 'Payout ID', render: payout => <button className="company-blue company-button-link" onClick={event => { event.stopPropagation(); navigate(payoutPath(payout)); }}>{payout.reference || payout.id}</button> },
        { key: 'jobId', header: 'Job', render: payout => <button className="company-blue company-button-link" disabled={!payout.jobDatabaseId} onClick={event => { event.stopPropagation(); if (payout.jobDatabaseId) navigate('/jobs/detail?id='+encodeURIComponent(payout.jobDatabaseId)); }}>{payout.jobId}</button> },
        { key: 'trips', header: 'Trips', render: payout => payout.tripCount == null ? '—' : payout.tripCount+' included' },
        { key: 'gross', header: 'Gross', render: payout => companyMoney(payout.grossAmount) }, { key: 'deductions', header: 'Deductions', render: payout => companyMoney(payout.deductions) }, { key: 'net', header: 'Net', render: payout => <strong>{companyMoney(payout.netAmount)}</strong> }, { key: 'status', header: 'Status', render: payout => <Status value={payout.status} /> }, { key: 'eligibility', header: 'Eligibility', render: eligibility }
      ]} />{!filtered.length && <div className="company-empty"><Icon name="wallet" size={24} /><strong>No company payouts found</strong><span>Completed trip earnings and payout requests will appear here.</span></div>}<Pagination page={currentPage} pageCount={pages} pageSize={10} total={filtered.length} onPage={setPage} /></>}
    </Card><aside className="company-detail-rail"><Card><PanelHeader title="Payout Details" />{query.isFetching ? <DriverTableLoading columns={2} label="Loading payout details" /> : row && !query.error ? <>
      <div className="company-payout-total"><span className="tk-meta">Net payout</span><strong>{companyMoney(row.netAmount)}</strong><Badge tone={statusTone[row.status] || 'neutral'}>{row.status}</Badge></div>
      <KeyValues rows={[["Payout ID", row.reference || row.id], ['Job', row.jobId], ['Trips included', row.tripCount], ['Gross amount', companyMoney(row.grossAmount)], ['Deductions', companyMoney(row.deductions)], ['Eligibility', row.eligibility], ['Reconciliation', row.reconciliation?.ok == null ? null : row.reconciliation.ok ? 'Balanced' : 'Needs review'], ['Requested', row.dateRequested]]} />
      {row.tripIds?.length > 0 && row.approvalReady === false && <div className="company-payout-warning">Payment is held until every included trip is delivered and the amounts reconcile.</div>}
      <Button fullWidth onClick={() => navigate(payoutPath(row))}>View Full Details</Button>
    </> : <div className="company-empty"><span>Select a payout to inspect it.</span></div>}</Card></aside></div>
  </div>;
}

function CompanyTruckRail({ companyId, truck, navigate, onActivity }) {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const detailQuery = useGetAdminCompanyTruckQuery({ id: truck.id, companyId, owner });
  const activityQuery = useGetAdminCompanyScreenActivityQuery({ id: companyId, owner, role, entityType: 'TRUCK', entityId: truck.id });
  const detail = detailQuery.error ? null : detailQuery.currentData;
  const model = [detail?.make || truck.make, detail?.model || truck.model].filter(Boolean).join(' ') || '—';
  const maintenanceId = detail?.maintenanceRecordId;
  return <aside className="company-detail-rail"><Card><PanelHeader title="Truck Details" /><div className="company-truck-visual"><Icon name="truck" size={72} /></div><h2 className="tk-title">{truck.plate || '—'}</h2><p className="tk-body">{model} <Badge tone="info">{detail?.tag || truck.tag || '—'}</Badge></p><QueryError query={detailQuery} title="Truck details unavailable" />{detailQuery.isFetching ? <DriverTableLoading columns={2} label="Loading truck details" /> : <KeyValues rows={[["VIN Number", detail?.vin || truck.vin], ['Engine Number', detail?.engineNumber || truck.engineNumber], ['Year of Manufacture', detail?.year || truck.year], ['Fleet Type', detail?.type || truck.type], ['Load Capacity', detail?.weight || truck.weight], ['Fuel Type', detail?.fuelType || truck.fuelType], ['Status', <Status value={detail?.status || truck.status} />], ['Last Active', truck.date], ['Current Location', truck.loc], ['Assigned Driver', detail?.driver || truck.driver]]} />}<div style={{ display: 'flex', gap: 6, marginTop: 16 }}><Button onClick={() => navigate('/fleet/detail?id='+encodeURIComponent(truck.id))}>View Full Details</Button><Button variant="outline" icon="wrench" onClick={() => navigate(maintenanceId ? '/maintenance/detail?id='+encodeURIComponent(maintenanceId) : '/maintenance')}>View Maintenance</Button></div></Card><Card><PanelHeader title="Recent Activity" action="View All" onAction={onActivity} /><ActivityList rows={activityQuery.error ? [] : (activityQuery.currentData || []).slice(0,5)} query={activityQuery} /></Card></aside>;
}
function CompanyDriverRail({ companyId, driver, navigate, onActivity }) {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const detailQuery = useGetAdminCompanyScreenDriverQuery({ id: driver.id, companyId, owner, role });
  const activityQuery = useGetAdminCompanyScreenActivityQuery({ id: companyId, owner, role, entityType: 'DRIVER', entityId: driver.id });
  const detail = detailQuery.error ? null : detailQuery.currentData;
  const documentUrl = detail?.documentUrl;
  const rating = Number.isFinite(driver.rating) && driver.rating >= 0 && driver.rating <= 5 ? '⭐ '+driver.rating+' / 5' : '—';
  return <aside className="company-detail-rail"><Card><div className="company-panel-head"><h2 className="tk-section">Driver Details</h2><Status value={driver.status} /></div><div className="company-driver-head"><Avatar name={driver.name} size={76} /><div><h2 className="tk-title">{driver.name}</h2><small>{driver.id}</small><span><Icon name="phone" size={14} />{driver.phone || '—'}</span><span><Icon name="mail" size={14} />{driver.email || '—'}</span><span><Icon name="map-pin" size={14} />{detail?.currentLocation || '—'}</span></div></div><QueryError query={detailQuery} title="Driver profile unavailable" />{detailQuery.isFetching ? <DriverTableLoading columns={2} label="Loading driver details" /> : <KeyValues rows={[["License Number", detail?.license || driver.license], ['License Type', detail?.licenseClass || driver.licenseClass], ['Date of Birth', detail?.dob], ['Address', detail?.address], ['Date Joined', detail?.joined || companyDate(driver.joined)], ['Status', <Status value={driver.status} />], ['Assigned Truck', driver.truckPlate], ['Total Trips', detail?.totalTrips], ['Rating', rating]]} />}<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}><Button fullWidth icon="eye" onClick={() => navigate('/drivers/detail?id='+encodeURIComponent(driver.id))}>View Full Profile</Button><Button variant="outline" icon="file-text" fullWidth disabled={!documentUrl || detailQuery.isFetching || Boolean(detailQuery.error)} onClick={() => { if (documentUrl) window.open(documentUrl, '_blank', 'noopener,noreferrer'); }}>View Documents</Button></div></Card><Card><PanelHeader title="Recent Activity" action="View All" onAction={onActivity} /><ActivityList rows={activityQuery.error ? [] : (activityQuery.currentData || []).slice(0,5)} query={activityQuery} /></Card></aside>;
}
