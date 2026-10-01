'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from '../router.js';
import { Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, Modal, PageHeader, Select, StatCard, Tabs, TextField } from '../ds.js';
import { fleetDate, fleetError, mergeFleetInspection, useGetAdminFleetTruckQuery, useGetAdminFleetPendingInspectionsQuery } from '../store/features/fleet/fleetApi.js';
import { FleetReviewModal, fleetReviewItems } from './FleetReviewModal.jsx';
import './TruckDetail.css';
import './AdminFleetTruckDetail.css';

const tone = { 'Pending Review': 'warning', Active: 'success', Approved: 'success', Rejected: 'danger' };
const TAB_COLUMNS = {
  Maintenance: [{ key: 'id', header: 'Record ID' }, { key: 'description', header: 'Service' }, { key: 'serviceCenter', header: 'Service Center' }, { key: 'dueDate', header: 'Due Date' }, { key: 'priority', header: 'Priority' }, { key: 'status', header: 'Status' }],
  Trips: [{ key: 'id', header: 'Job / Trip ID' }, { key: 'route', header: 'Route' }, { key: 'cargo', header: 'Cargo' }, { key: 'pickupDate', header: 'Pickup' }, { key: 'status', header: 'Status' }],
  Documents: [{ key: 'name', header: 'Document' }, { key: 'date', header: 'Validity' }, { key: 'status', header: 'Status' }],
  'Activity Log': [{ key: 'title', header: 'Activity Log' }, { key: 'time', header: 'Updated' }],
};
const RECENT_TRIP_COLUMNS = [{ key: 'id', header: 'Trip ID' }, { key: 'route', header: 'Route' }, { key: 'pickupDate', header: 'Start Date' }, { key: 'deliveryDate', header: 'End Date' }, { key: 'distanceKm', header: 'Distance' }, { key: 'status', header: 'Status' }];
function Header({ title, action, onAction }) {
  return <div className="truck-card-head"><h2 className="tk-section">{title}</h2>{action && <button onClick={onAction}>{action}</button>}</div>;
}
function Unavailable({ title }) { return <p className="tk-meta">{title} is not available for this truck yet.</p>; }
function Photo({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} {...props} /> : <Icon name="truck" size={48} />;
}

export function AdminFleetTruckDetail() {
  const navigate = useNavigate(), id = useSearchParams().get('id');
  const query = useGetAdminFleetTruckQuery(id, { skip: !id });
  const inspections = useGetAdminFleetPendingInspectionsQuery(undefined, { skip: !id });
  const truck = mergeFleetInspection(query.currentData, inspections.data);
  const [tab, setTab] = useState('Overview'), [menu, setMenu] = useState(false), [review, setReview] = useState(null);
  const [edit, setEdit] = useState(false), [draft, setDraft] = useState({}), [gallery, setGallery] = useState(false), [photo, setPhoto] = useState(0), [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { setPhoto(0); setTab('Overview'); setMenu(false); setEdit(false); setGallery(false); setReview(null); }, [id]);
  function notify(message) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  function unavailable(action) { setMenu(false); notify(`${action} is not available for this truck yet.`); }
  function refresh() { query.refetch(); inspections.refetch(); }
  function openReview(value) { setMenu(false); setReview(value); }
  if (!id || query.isLoading || (!truck && !query.error)) return <Card>
    <p className="tk-body" role="status">{!id ? 'Select a truck from Fleet Management.' : 'Loading truck details…'}</p><Button onClick={() => navigate('/fleet')}>Back to Fleet</Button>
  </Card>;
  if (query.error || !truck) return <Card><Banner tone="danger" title="Unable to load truck">{fleetError(query.error)}</Banner>
    <Button variant="outline" onClick={refresh}>Retry</Button><Button onClick={() => navigate('/fleet')}>Back to Fleet</Button>
  </Card>;
  const status = <Badge dot tone={tone[truck.status]}>{truck.status}</Badge>;
  return <div className="truck-detail-page admin-fleet-detail">
    <PageHeader crumbs={['Fleet', { label: 'Fleet Management', onClick: () => navigate('/fleet') }, truck.plate]} title="Truck Details" description="View vehicle information, assignments, maintenance, trips and compliance records." actions={<>
      <Button variant="outline" icon="arrow-left" onClick={() => navigate('/fleet')}>Back to Trucks</Button>
      <span className="truck-detail-actions"><span><Button iconRight="chevron-down" onClick={() => setMenu(!menu)}>Actions</Button>{menu && <span><DropdownMenu width={225} items={[
        ...fleetReviewItems(truck, openReview), { label: 'Refresh profile', icon: 'rotate-ccw', onClick: () => { refresh(); setMenu(false); } },
        { label: 'Schedule maintenance', icon: 'wrench', onClick: () => unavailable('Scheduling maintenance') }, { divider: true }, { label: 'Print profile', icon: 'printer', onClick: () => { setMenu(false); window.print(); } },
      ]} /></span>}</span></span>
    </>} />
    {query.isFetching && <p className="tk-meta" role="status">Refreshing truck details…</p>}
    {inspections.error && <Banner tone="warning" title="Inspection data unavailable" action={<Button variant="outline" onClick={() => inspections.refetch()}>Retry</Button>}>{fleetError(inspections.error)}</Banner>}
    <header className="truck-detail-hero">
      <div className="truck-detail-visual"><Photo src={truck.photos[0]} alt={`${truck.plate} truck`} /></div>
      <div className="truck-detail-title"><div><h2 className="tk-title">{truck.plate}</h2>{status}</div>
        <p>{[truck.make, truck.model].filter(Boolean).join(' ') || '—'} <span /> {truck.type || '—'} <span /> {truck.year || '—'}</p>
        <p><Icon name="building-2" size={15} /> {truck.company || '—'}</p>
      </div>
      <div className="truck-detail-meta">
        <span><Icon name="power" size={16} />—</span><span><Icon name="cpu" size={16} />—</span>
        <span><Icon name="badge" size={16} />{truck.plate}</span><span><Icon name="map-pin" size={16} />—</span>
        <span className="truck-registered"><small>Date Registered</small><strong>{fleetDate(truck.createdAt)}</strong></span>
        <span className="truck-registered"><small>Last Updated</small><strong>—</strong></span>
      </div>
    </header>
    <Banner title="Registration details">Registration status and vehicle information are shown. Operational records, assignments and compliance history are not available yet.</Banner>
    <Tabs value={tab} onChange={setTab} items={['Overview', 'Documents', 'Maintenance', 'Trips', 'Jobs', 'Insurance', 'Activity Log']} />
    {tab === 'Overview' ? <div className="truck-overview-page">
      <div className="truck-stats"><StatCard icon="shield-check" label="Total Trips" value="—" caption="Not available yet" /><StatCard icon="gauge" tint="teal" label="Total Distance" value="—" caption="Not available yet" /><StatCard icon="trending-up" label="Uptime (Last 30 days)" value="—" caption="Not available yet" /></div>
      <div className="truck-overview-grid"><div className="truck-main">
        <Card><Header title="Truck Information" action="Edit" onAction={() => { setDraft({ status: '—', type: truck.type || '', loc: '', state: '' }); setEdit(true); }} />
          <div className="truck-info-grid">{[
            ['Plate Number', truck.plate], ['Fuel Type', null], ['VIN Number', null], ['Load Capacity', null], ['Engine Number', null], ['Body Color', null],
            ['Make', truck.make], ['Chassis Number', null], ['Model', truck.model], ['Emission Standard', null], ['Year of Manufacture', truck.year], ['Current Location', null],
            ['Truck Type', truck.type], ['Status', status], ['Fleet Type', null], ['Owning Company', truck.company], ['Container Size', truck.tag], ['Container Weight (unit unspecified)', truck.containerWeight],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div>
        </Card>
        <Card><Header title="Recent Trips" action="View All" onAction={() => setTab('Trips')} /><DataTable rows={[]} rowKey={(row) => row.id} columns={RECENT_TRIP_COLUMNS} /><Unavailable title="Trip history" /></Card>
      </div><aside className="truck-side">
        <Card><Header title="Truck Images" action={truck.photos.length ? `View All (${truck.photos.length})` : undefined} onAction={() => setGallery(true)} />
          <div className="truck-image-main"><Photo src={truck.photos[photo] || truck.photos[0]} alt={`${truck.plate} photo ${photo + 1}`} /></div>
          {truck.photos.length ? <div className="truck-thumbs">{truck.photos.slice(0, 5).map((url, index) => <button key={`${url}-${index}`} aria-label={`View truck photo ${index + 1}`} onClick={() => setPhoto(index)}><Photo src={url} alt={`${truck.plate} thumbnail ${index + 1}`} /></button>)}</div> : <Unavailable title="Truck photos" />}
        </Card>
        <Card><Header title="Compliance & Insurance" action="View All" onAction={() => setTab('Documents')} /><Unavailable title="Compliance and insurance records" /></Card>
        <Card><Header title="Recent Activity" action="View All" onAction={() => setTab('Activity Log')} /><Unavailable title="Activity history" /></Card>
      </aside></div>
    </div> : <Card pad="none"><div className="truck-panel-title"><div><h2 className="tk-section">{tab}</h2><p className="tk-meta">Records and activity for this truck.</p></div>{tab === 'Maintenance' && <Button icon="plus" onClick={() => unavailable('Scheduling maintenance')}>Schedule Maintenance</Button>}</div>
      <DataTable rows={[]} rowKey={(row) => row.id} columns={TAB_COLUMNS[tab] || TAB_COLUMNS[tab === 'Jobs' ? 'Trips' : 'Documents']} coloredHeader />
      <div className="truck-empty"><Icon name="clipboard-list" size={28} /><Unavailable title={`${tab} records`} /></div>
    </Card>}
    <Modal open={edit} onClose={() => setEdit(false)} title="Edit truck" footer={<><Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button><Button disabled>Save Changes</Button></>}>
      <div className="truck-detail-form"><Banner title="Editing unavailable">Editing vehicle details and operational status is not available here yet.</Banner>
        <Select label="Status" value={draft.status || '—'} options={['—', 'Available', 'On Trip', 'In Maintenance', 'Inactive']} onChange={(event) => setDraft({ ...draft, status: event.target.value })} />
        <Select label="Truck Type" value={draft.type || ''} options={['', ...new Set([truck.type, '40FT Trailer', '20FT Container', 'Flatbed', '40FT High Cube', 'Tanker'].filter(Boolean))]} onChange={(event) => setDraft({ ...draft, type: event.target.value })} />
        <TextField label="Current location" value={draft.loc || ''} onChange={(event) => setDraft({ ...draft, loc: event.target.value })} /><TextField label="State" value={draft.state || ''} onChange={(event) => setDraft({ ...draft, state: event.target.value })} />
      </div>
    </Modal>
    <Modal open={gallery} onClose={() => setGallery(false)} title="Truck Images" description={truck.plate} width={760}><div className="fleet-photo-gallery">{truck.photos.map((url, index) => <Photo key={`${url}-${index}`} src={url} alt={`${truck.plate} photo ${index + 1}`} />)}</div></Modal>
    <FleetReviewModal review={review} onClose={() => setReview(null)} onSuccess={notify} />
    {toast && <div className="admin-fleet-toast" role="status">{toast}</div>}
  </div>;
}
