'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../router.js';
import { PageHeader, Button, StatCard, SectionCard, Card, SearchField, DataTable, Pagination, Badge, DonutChart, LegendList, RankBarList, ListRow, QuickActionsCard, IconButton, DropdownMenu, Modal, TextField, Select, Banner } from '../ds.js';
import { fleetError, mergeFleetInspection, useGetAdminFleetTrucksQuery, useGetAdminFleetPendingInspectionsQuery } from '../store/features/fleet/fleetApi.js';
import { useGetAdminOverviewQuery } from '../store/features/overview/overviewApi.js';
import { FleetReviewModal, fleetReviewItems } from './FleetReviewModal.jsx';
import './FleetManagement.css';

const STATUSES = ['Available', 'On Trip', 'In Maintenance', 'Inactive'];
const TYPES = ['40FT Trailer', '20FT Container', 'Flatbed', '40FT High Cube', '45FT Container', 'Tanker'];
const EMPTY = { plate: '', type: TYPES[0], company: '', driver: '' };
const tone = { 'Pending Review': 'warning', Active: 'success', Approved: 'success', Rejected: 'danger' };
function dual(a, b) { return <span className="fleet-dual"><strong>{a ?? '—'}</strong><small>{b ?? '—'}</small></span>; }
function exportCsv(rows) {
  const cell = (value) => {
    const text = String(value ?? '');
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const data = [['Plate', 'Reference', 'Type', 'Company', 'Driver', 'Registration Status', 'Location', 'Last Trip'], ...rows.map((r) => [r.plate, r.ref, r.type, r.company, r.driver, r.status, r.loc, r.trip])].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'trukkas-fleet-page.csv'; a.click(); URL.revokeObjectURL(url);
}

export function FleetManagement() {
  const navigate = useNavigate(), upload = useRef(null), toastTimer = useRef(null);
  const [q, setQ] = useState(''), [search, setSearch] = useState(''), [sort, setSort] = useState('Newest');
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [menu, setMenu] = useState(null);
  const [addOpen, setAddOpen] = useState(false), [form, setForm] = useState(EMPTY), [toast, setToast] = useState(''), [review, setReview] = useState(null);
  useEffect(() => { const timer = setTimeout(() => { setSearch(q); setPage(1); }, 300); return () => clearTimeout(timer); }, [q]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const query = useGetAdminFleetTrucksQuery({ search, page, limit: pageSize });
  const inspections = useGetAdminFleetPendingInspectionsQuery();
  const overview = useGetAdminOverviewQuery();
  const rows = useMemo(() => {
    const trucks = (query.currentData?.trucks || []).map((truck) => mergeFleetInspection(truck, inspections.data));
    if (sort === 'Newest') trucks.sort((a, b) => (Date.parse(b.submittedAt || b.createdAt) || 0) - (Date.parse(a.submittedAt || a.createdAt) || 0));
    if (sort === 'Plate A–Z') trucks.sort((a, b) => a.plate.localeCompare(b.plate));
    if (sort === 'Company A–Z') trucks.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
    return trucks;
  }, [query.currentData, inspections.data, sort]);
  const pagination = query.currentData?.pagination;
  const pageCount = Math.max(1, pagination?.totalPages ?? 1);
  useEffect(() => { if (pagination && page > pageCount) setPage(pageCount); }, [page, pageCount, pagination]);
  function notify(message) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  function unavailable(action) { setMenu(null); notify(`${action} is not available for these trucks yet.`); }
  function openTruck(truck) { navigate(`/fleet/detail?id=${encodeURIComponent(truck.id)}`); }
  function openReview(value) { setMenu(null); setReview(value); }
  function download() { if (!rows.length) { notify('No trucks to export on this page.'); return; } exportCsv(rows); setMenu(null); notify('The displayed page has been exported.'); }
  function refresh() { query.refetch(); inspections.refetch(); overview.refetch(); }
  return <div className="fleet-page">
    <PageHeader crumbs={['Fleet', 'Fleet Management']} title="Fleet Management" description="Monitor and manage all trucks and fleet assets on the platform." actions={<>
      <Button icon="plus" onClick={() => setAddOpen(true)}>Add Truck</Button>
      <Button variant="outline" icon="download" onClick={() => upload.current?.click()}>Import Trucks</Button>
      <input ref={upload} hidden type="file" accept=".csv,.xlsx" onChange={(event) => { if (event.target.files?.[0]) notify('Bulk import is not available yet. No trucks were imported.'); event.target.value = ''; }} />
      <span className="fleet-menu-wrap"><Button variant="outline" iconRight="chevron-down" onClick={() => setMenu(menu === 'top' ? null : 'top')}>More Actions</Button>{menu === 'top' && <span className="fleet-dropdown"><DropdownMenu width={210} items={[
        { label: 'Export Fleet', icon: 'download', onClick: download }, { label: 'Refresh Fleet', icon: 'rotate-ccw', onClick: () => { refresh(); setMenu(null); } },
        { label: 'Schedule Maintenance', icon: 'wrench', onClick: () => unavailable('Scheduling maintenance') }, { label: 'Print Fleet List', icon: 'printer', onClick: () => { setMenu(null); window.print(); } },
      ]} /></span>}</span>
    </>} />
    <div className="fleet-stats">
      <StatCard icon="truck" label="Total Trucks" value={overview.data?.fleet.trucksTotal ?? '—'} caption={overview.data?.fleet.trucksActive != null ? `${overview.data.fleet.trucksActive} Active registrations` : 'All registered trucks'} />
      <StatCard icon="circle-check" tint="green" label="Available" value="—" caption="Not available yet" />
      <StatCard icon="route" label="On Trip" value="—" caption="Not available yet" />
      <StatCard icon="wrench" tint="amber" label="In Maintenance" value="—" caption="Not available yet" />
      <StatCard icon="circle-x" tint="navy" label="Inactive" value="—" caption="Not available yet" />
    </div>
    <Banner title="Truck registration records">Registration status is shown below. Availability, assignments, location and trip history are not available yet. Sorting and export apply to the displayed page.</Banner>
    {query.error && <Banner tone="danger" title="Unable to load trucks" action={<Button variant="outline" onClick={refresh}>Retry</Button>}>{fleetError(query.error)}</Banner>}
    {overview.error && <Banner tone="warning" title="Fleet summary unavailable" action={<Button variant="outline" onClick={() => overview.refetch()}>Retry</Button>}>{fleetError(overview.error)}</Banner>}
    {inspections.error && <Banner tone="warning" title="Inspection data unavailable" action={<Button variant="outline" onClick={() => inspections.refetch()}>Retry</Button>}>{fleetError(inspections.error)} Registration records can still be reviewed.</Banner>}
    <Card pad="none"><div className="fleet-toolbar">
      <SearchField placeholder="Search by truck no., plate number, or company..." value={q} onChange={(event) => setQ(event.target.value)} />
      <select aria-label="Status" disabled title="Operational status is not available yet">{['All Status', ...STATUSES].map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Truck type" disabled title="Truck type filtering is not available yet">{['All Types', ...TYPES].map((x) => <option key={x}>{x}</option>)}</select>
      <select aria-label="Company" disabled title="Use the search field to find a company"><option>All Companies</option></select>
      <select aria-label="Location" disabled title="Location is not available yet"><option>All Locations</option></select>
      <Button variant="outline" icon="rotate-ccw" onClick={() => { setQ(''); setSearch(''); setSort('Newest'); setPage(1); }}>Reset</Button>
    </div></Card>
    <div className="fleet-layout"><SectionCard title="Trucks" count={pagination?.total ?? undefined} pad="none" action={<select className="fleet-sort" aria-label="Sort displayed trucks" value={sort} onChange={(event) => setSort(event.target.value)}>{['Newest', 'Plate A–Z', 'Company A–Z'].map((x) => <option key={x}>{x}</option>)}</select>}>
      {query.isFetching && <div className="fleet-empty" role="status">{query.currentData ? 'Refreshing trucks…' : 'Loading trucks…'}</div>}
      <DataTable rows={rows} rowKey={(r) => r.id} onRowClick={openTruck} columns={[
        { key: 'plate', header: 'Truck / Plate No.', render: (r) => <span className="fleet-truck-cell"><span className="fleet-thumb">🚚</span>{dual(<span className="fleet-link">{r.plate}</span>, r.ref)}</span> },
        { key: 'type', header: 'Truck Type', render: (r) => dual(r.type, r.tag) },
        { key: 'company', header: 'Truck Company', render: (r) => dual(r.company, r.tc) },
        { key: 'driver', header: 'Driver', render: (r) => dual(r.driver, r.dr) },
        { key: 'status', header: 'Status', render: (r) => <Badge dot tone={tone[r.status]}>{r.status}</Badge> },
        { key: 'loc', header: 'Location', render: (r) => dual(r.loc, r.state) },
        { key: 'trip', header: 'Last Trip', render: (r) => dual(r.trip, r.date) },
        { key: 'x', header: 'Actions', render: (r) => <span className="fleet-row-actions" onClick={(event) => event.stopPropagation()}>
          <IconButton icon="eye" tone="outline" onClick={() => openTruck(r)} />
          <IconButton icon="ellipsis-vertical" tone="outline" onClick={() => setMenu(menu === r.id ? null : r.id)} />
          {menu === r.id && <span className="fleet-dropdown"><DropdownMenu width={225} items={[
            { label: 'View Truck', icon: 'eye', onClick: () => openTruck(r) }, ...fleetReviewItems(r, openReview),
            { label: 'Schedule Maintenance', icon: 'wrench', onClick: () => unavailable('Scheduling maintenance') }, { divider: true },
            ...STATUSES.map((x) => ({ label: `Mark as ${x}`, icon: 'check', onClick: () => unavailable('Changing operational status') })),
          ]} /></span>}
        </span> },
      ]} />
      {!query.isFetching && !query.error && !rows.length && <div className="fleet-empty">No trucks match the selected filters.</div>}
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={pagination?.total ?? 0} onPage={(next) => setPage(Math.max(1, Math.min(next, pageCount)))} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
    </SectionCard>
    <aside className="fleet-rail">
      <SectionCard title="Fleet Overview"><div className="fleet-chart"><DonutChart size={145} thickness={20} centerValue="—" centerLabel="Not available" data={[]} /><LegendList showShare={false} items={STATUSES.map((label) => ({ label, value: null, display: '—' }))} /></div><p className="tk-meta">Operational fleet breakdown is not available yet.</p></SectionCard>
      <SectionCard title="Truck Types" action={<button className="fleet-text-btn" onClick={() => unavailable('Truck type summaries')}>View all</button>}><RankBarList numbered={false} items={TYPES.slice(0, 5).map((label) => ({ label, value: 0, display: '—' }))} /><p className="tk-meta">Fleet-wide truck type counts are not available yet.</p></SectionCard>
      <SectionCard title="Maintenance Alerts" action={<button className="fleet-text-btn" onClick={() => unavailable('Maintenance alerts')}>View all</button>}>
        <ListRow icon="clock" iconTint="amber" title="— Trucks" subtitle="Maintenance due in next 7 days" onClick={() => unavailable('Maintenance alerts')} />
        <ListRow icon="circle-alert" iconTint="red" title="— Trucks" subtitle="Maintenance overdue" onClick={() => unavailable('Maintenance alerts')} />
        <ListRow icon="wrench" title="— Trucks" subtitle="Currently in maintenance" onClick={() => unavailable('Maintenance alerts')} />
      </SectionCard>
      <QuickActionsCard items={[
        { icon: 'truck', label: 'Add Truck', hint: 'Register a new truck to the fleet', onClick: () => setAddOpen(true) },
        { icon: 'wrench', label: 'Schedule Maintenance', hint: 'Plan maintenance for a truck', onClick: () => unavailable('Scheduling maintenance') },
        { icon: 'upload', label: 'Bulk Upload', hint: 'Upload truck data in bulk', onClick: () => upload.current?.click() },
        { icon: 'download', label: 'Export Fleet', hint: 'Download fleet data report', onClick: download },
      ]} />
    </aside></div>
    <Modal open={addOpen} onClose={() => { setAddOpen(false); setForm(EMPTY); }} title="Add Truck" description="Register a new truck to the fleet." footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button disabled>Save Truck</Button></>}>
      <div className="fleet-form"><Banner title="Registration unavailable">Adding trucks from the admin console is not available yet.</Banner>
        <TextField label="Plate Number" required placeholder="e.g. KJA-123-XD" value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} />
        <Select label="Truck Type" value={form.type} options={TYPES} onChange={(event) => setForm({ ...form, type: event.target.value })} />
        <TextField label="Truck Company" required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
        <TextField label="Driver Name" required value={form.driver} onChange={(event) => setForm({ ...form, driver: event.target.value })} />
      </div>
    </Modal>
    <FleetReviewModal review={review} onClose={() => setReview(null)} onSuccess={notify} />
    {toast && <div className="maint-toast" role="status">{toast}</div>}
  </div>;
}
