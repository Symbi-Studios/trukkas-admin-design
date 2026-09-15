'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '../router.js';
import {
  Button, Badge, SectionCard, LabelValue, PageHeader, DropdownMenu, DataTable, Tabs,
  Timeline, QuickActionsCard, Icon, Avatar, Pagination, EmptyState, StatCard,
  Card, Textarea, Banner,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { getJobTrips } from '../domain/jobTrips.js';
import { setDriverStatus } from '../mock/api.js';
import './DriverDetail.css';

const TAB_ITEMS = [
  'Overview', 'Documents', 'Trips & Activity', 'Earnings & Wallet', 'Maintenance Log',
  'Compliance', 'Incidents', 'Reviews & Ratings', 'Notes',
];
const STATUS_TONE = { 'Pending Review': 'warning', Rejected: 'danger' };
const VERIFY_TONE = { Verified: 'success', Clear: 'success', Approved: 'success', Pending: 'warning', Failed: 'danger', Rejected: 'danger' };
const ROUTES = [
  'Lagos → Kano', 'Kano → Kaduna', 'Kaduna → Lagos', 'Lagos → Onne', 'Onne → Port Harcourt',
  'Lagos → Ibadan', 'Ibadan → Abuja', 'Abuja → Kano', 'Port Harcourt → Owerri', 'Lagos → Enugu',
];
const CONTAINERS = ['MSCU', 'TCLU', 'MSKU', 'APZU', 'TCNU', 'CMAU', 'HLXU'];
const MAKE_BY_TYPE = {
  '40FT Trailer': 'Volvo FH16', '20FT Container': 'Mercedes Actros', 'Flatbed': 'MAN TGS',
  '40FT High Cube': 'Scania R450', 'Tanker': 'Iveco Trakker', '45FT Container': 'DAF XF',
};
const CAPACITY_BY_TYPE = {
  '40FT Trailer': '30,000 kg', '20FT Container': '20,000 kg', 'Flatbed': '25,000 kg',
  '40FT High Cube': '28,000 kg', 'Tanker': '33,000 kg', '45FT Container': '32,000 kg',
};
const REVIEWERS = ['Bola A.', 'Grace Effiong', 'Michael Osei', 'Fatima Bello', 'Chuka N.', 'Uche Obi', 'Amaka O.', 'Femi Alade'];
const COMMENTS = [
  'Very professional and delivered on time.', 'Handled the cargo with great care.',
  'Communicated clearly throughout the trip.', 'Arrived earlier than expected, great job.',
  'Smooth delivery, no issues at all.', 'Courteous and followed all safety protocols.',
  'Would definitely request this driver again.', 'Kept us updated on the trip status.',
];
const NOW = new Date('2026-05-30');

function seed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmt(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function naira(n) {
  return `₦${Math.round(n || 0).toLocaleString('en-NG')}`;
}
function tenureFrom(dateStr) {
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return '';
  let months = (NOW.getFullYear() - start.getFullYear()) * 12 + (NOW.getMonth() - start.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years <= 0) return `${rem} month${rem === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'}${rem ? `, ${rem} month${rem === 1 ? '' : 's'}` : ''}`;
}
function containerFor(h, i) {
  const code = CONTAINERS[(h + i * 3) % CONTAINERS.length];
  const num = 1000000 + ((h + i * 977) % 8999999);
  const sizes = ['20ft', '40ft', '40ft HC'];
  return `${code} ${num} (${sizes[(h + i) % sizes.length]})`;
}

function generateTrips(d) {
  const n = Math.max(0, d.totalTrips || 0);
  if (!n) return [];
  const h = seed(d.id);
  const rows = [];
  let dayOffset = 1;
  for (let i = 0; i < n; i++) {
    const isActive = !!d.activeTrip && i === 0;
    const routeIdx = (h + i * 7) % ROUTES.length;
    const distance = 90 + ((h >> (i % 24 || 1)) % 30) * 45;
    dayOffset += 1 + ((h + i * 13) % 4);
    const departed = addDays(NOW, -dayOffset);
    const delivered = isActive ? null : addDays(departed, 1 + ((h + i) % 2));
    const earnings = 120000 + ((h + i * 31) % 40) * 20000;
    rows.push({
      n: i + 1,
      id: isActive ? d.activeTrip.id : `TRK-2026-${String(((h + i * 41) % 500) + 400).padStart(4, '0')}`,
      route: isActive ? d.activeTrip.route : ROUTES[routeIdx],
      cargo: containerFor(h, i),
      status: isActive ? 'In Transit' : 'Completed',
      departed: fmt(departed),
      delivered: delivered ? fmt(delivered) : '—',
      distance: `${distance.toLocaleString('en-NG')} km`,
      earnings,
    });
  }
  return rows;
}

function documentsFor(d) {
  const licenseTone = d.licenseStatus === 'Valid' ? 'Verified' : d.licenseStatus;
  return [
    { id: 'lic', name: "Driver's License", detail: d.license, status: licenseTone, expiry: d.licenseExpiry, icon: 'file-text' },
    { id: 'nin', name: 'National ID Card', detail: null, status: d.verification.identity, expiry: null, icon: 'file-text' },
    { id: 'photo', name: 'Passport Photograph', detail: null, status: d.verification.face, expiry: null, icon: 'file-text' },
    { id: 'addr', name: 'Proof of Address', detail: null, status: d.verification.address, expiry: null, icon: 'file-text' },
    { id: 'bg', name: 'Background Check Report', detail: null, status: d.verification.background === 'Clear' ? 'Verified' : d.verification.background, expiry: null, icon: 'shield-check' },
  ];
}

function vehiclesFor(d, trucks) {
  const owned = trucks.filter((t) => t.dr === d.id);
  const list = owned.length ? owned.map((t) => ({ plate: t.plate, type: t.type, status: t.status === 'In Maintenance' ? 'Inactive' : 'Active' }))
    : d.truckPlate ? [{ plate: d.truckPlate, type: d.truckType, status: d.status === 'Inactive' ? 'Inactive' : 'Active' }] : [];
  const h = seed(d.id);
  return list.map((t, i) => ({
    id: t.plate,
    name: `${MAKE_BY_TYPE[t.type] || 'Truck'} ${2018 + ((h + i) % 8)}`,
    plate: t.plate,
    type: t.type,
    capacity: CAPACITY_BY_TYPE[t.type] || '—',
    status: t.status,
    assigned: d.joined,
  }));
}

function reviewsFor(d) {
  const n = Math.min(d.reviews || 0, 8);
  const h = seed(d.id);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const drift = ((h + i * 17) % 3) - 1;
    const rating = Math.max(3, Math.min(5, Math.round(d.rating) + (i === 0 ? 0 : drift)));
    rows.push({
      id: `${d.id}-rv-${i}`,
      reviewer: REVIEWERS[(h + i * 5) % REVIEWERS.length],
      comment: COMMENTS[(h + i * 11) % COMMENTS.length],
      rating,
      date: fmt(addDays(NOW, -(3 + i * 9))),
    });
  }
  return rows;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Stars({ value }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={13} color={i <= value ? 'var(--tk-warning)' : 'var(--tk-line-strong)'} />
      ))}
    </span>
  );
}

function DocRow({ d }) {
  return (
    <div className="dd-doc-row">
      <Icon name={d.icon} size={17} color="var(--tk-blue)" />
      <span style={{ flex: 1, display: 'grid', gap: 1 }}>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.name}</span>
        {d.detail && <span className="tk-meta">{d.detail}</span>}
      </span>
      <Badge tone={VERIFY_TONE[d.status] || 'neutral'}>{d.status}</Badge>
      <span className="tk-meta" style={{ width: 120, textAlign: 'right' }}>
        {d.expiry ? `Expiry: ${d.expiry}` : ''}
      </span>
    </div>
  );
}

function VehiclesTable({ rows }) {
  if (!rows.length) return <EmptyState icon="truck" title="No vehicles assigned" description="This driver does not currently have a vehicle assigned." />;
  return (
    <DataTable rows={rows} rowKey={(r) => r.id}
      columns={[
        { key: 'name', header: 'Truck / Vehicle', render: (r) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="truck" size={15} color="var(--tk-blue)" />
            <span style={{ color: 'var(--tk-blue)', font: '600 13px/18px var(--tk-font-sans)' }}>{r.name}</span>
          </span>) },
        { key: 'plate', header: 'Plate Number', render: (r) => <span className="tk-mono">{r.plate}</span> },
        { key: 'type', header: 'Truck Type' },
        { key: 'capacity', header: 'Capacity' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'Active' ? 'success' : 'neutral'}>{r.status}</Badge> },
        { key: 'assigned', header: 'Assigned On' },
      ]} />
  );
}

function TripsTable({ rows }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.n}
      columns={[
        { key: 'id', header: 'Trip ID', render: (r) => <span className="tk-mono" style={{ color: 'var(--tk-blue)' }}>{r.id}</span> },
        { key: 'route', header: 'Route' },
        { key: 'cargo', header: 'Container / Cargo' },
        { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'In Transit' ? 'info' : 'success'}>{r.status}</Badge> },
        { key: 'departed', header: 'Departed' },
        { key: 'delivered', header: 'Delivered' },
        { key: 'distance', header: 'Distance' },
        { key: 'earnings', header: 'Earnings', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.earnings)}</strong> },
      ]} />
  );
}

export function DriverDetail() {
  const navigate = useNavigate();
  const { driverId } = useParams();
  const drivers = useCollection('drivers') || [];
  const trucks = useCollection('trucks') || [];
  const maintenance = useCollection('maintenance') || [];
  const jobs = useCollection('jobs') || [];
  const d = drivers.find((x) => x.id === decodeURIComponent(driverId || ''));

  const [tab, setTab] = useState('Overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const trips = useMemo(() => {
    if (!d) return [];
    const linked = jobs.flatMap((job) => getJobTrips(job)
      .filter((trip) => trip.driverId === d.id || trip.driverName === d.name)
      .map((trip, index) => ({
        n: `${job.id}-${trip.id}-${index}`,
        id: trip.id,
        route: trip.route || job.route,
        cargo: job.cargo || job.cargoDetails || '—',
        status: trip.status,
        departed: trip.pickupDate || job.pickupDate || '—',
        delivered: ['Delivered', 'Completed'].includes(trip.status) ? trip.deliveryDate || job.deliveryDate || 'Completed' : '—',
        distance: `${trip.distanceKm || job.distanceKm || 0} km`,
        earnings: trip.driverPayment || 0,
      })));
    return linked.length ? linked : generateTrips(d);
  }, [d, jobs]);
  const documents = useMemo(() => (d ? documentsFor(d) : []), [d]);
  const vehicles = useMemo(() => (d ? vehiclesFor(d, trucks) : []), [d, trucks]);
  const reviews = useMemo(() => (d ? reviewsFor(d) : []), [d]);
  const driverMaintenance = useMemo(() => (d ? maintenance.filter((m) => m.plate === d.truckPlate) : []), [d, maintenance]);

  const pageSize = 5;
  const pageRows = trips.slice((page - 1) * pageSize, page * pageSize);

  if (!d) {
    return (
      <Card>
        <span className="tk-body">No driver found with ID {driverId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/drivers')}>Back to Drivers</Button>
        </div>
      </Card>
    );
  }

  function notify(title) {
    setToast(title);
  }

  const compliance = [
    { label: "Driver's License", ok: d.licenseStatus !== 'Expired', hint: d.licenseStatus },
    { label: 'Medical Fitness Certificate', ok: true, hint: 'Valid' },
    { label: 'Insurance', ok: true, hint: 'Valid' },
    { label: 'Background Check', ok: d.verification.background === 'Clear', hint: d.verification.background },
  ];
  const isFullyCompliant = compliance.every((c) => c.ok);

  const initials = d.name;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--tk-grid-gap)' }}>
      <PageHeader
        crumbs={['Fleet Management', 'Drivers', d.id]}
        title="Driver Details"
        description="View driver profile, verification status, documents, trip history, maintenance log and compliance information."
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate('/drivers')}>Back to Drivers</Button>
          <span style={{ position: 'relative' }}>
            <Button variant="outline" iconRight="chevron-down" onClick={() => setMoreOpen((o) => !o)}>More Actions</Button>
            {moreOpen && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={210} items={[
                  { label: 'Edit Driver', icon: 'pencil', onClick: () => setMoreOpen(false) },
                  { label: 'Export Driver Report', icon: 'download', onClick: () => { setMoreOpen(false); download(`${d.id}.txt`, JSON.stringify(d, null, 2)); } },
                  { label: 'Print Profile', icon: 'printer', onClick: () => { setMoreOpen(false); window.print(); } },
                  { divider: true },
                  ...(d.status === 'Pending Review' ? [
                    { label: 'Approve Driver', icon: 'circle-check', onClick: () => { setDriverStatus(d.id, 'Active'); setMoreOpen(false); notify('Driver approved'); } },
                    { label: 'Reject Driver', icon: 'circle-x', tone: 'danger', onClick: () => { setDriverStatus(d.id, 'Rejected'); setMoreOpen(false); notify('Driver rejected'); } },
                  ] : [
                    { label: d.status === 'Inactive' ? 'Mark Active' : 'Suspend Driver', icon: d.status === 'Inactive' ? 'circle-check' : 'user-x', tone: d.status === 'Inactive' ? undefined : 'danger',
                      onClick: () => { setDriverStatus(d.id, d.status === 'Inactive' ? 'Active' : 'Inactive'); setMoreOpen(false); notify(d.status === 'Inactive' ? 'Driver marked active' : 'Driver suspended'); } },
                  ]),
                ]} />
              </span>
            )}
          </span>
        </>} />

      {toast && <Banner tone="success" title={toast} />}

      <Card pad="none">
        <div className="dh-top">
          <div className="dh-left">
            <div className="dd-avatar-col">
              <Avatar name={initials} size={88} />
              <Badge tone={STATUS_TONE[d.status]} dot>{d.status}</Badge>
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="tk-title">{d.name}</h2>
                <Badge tone={STATUS_TONE[d.status]} dot>{d.status}</Badge>
                <Badge tone={d.registrationType === 'Company Driver' ? 'info' : 'neutral'}>{d.registrationType}</Badge>
              </div>
              <div className="dd-fact-row" style={{ marginTop: 4 }}>
                <span className="dd-fact"><Icon name="phone" size={14} color="var(--tk-ink-300)" />{d.phone}</span>
                <span className="dd-fact"><Icon name="badge-check" size={14} color="var(--tk-ink-300)" />Driver ID: <b>{d.id}</b></span>
                <span className="dd-fact"><Icon name="map-pin" size={14} color="var(--tk-ink-300)" />{d.currentLocation}</span>
              </div>
              <div className="dd-fact-row" style={{ marginTop: 0 }}>
                <span className="dd-fact"><Icon name="mail" size={14} color="var(--tk-ink-300)" />{d.email}</span>
                <span className="dd-fact"><Icon name="file-text" size={14} color="var(--tk-ink-300)" />License No: <b>{d.license}</b></span>
                {d.company && <span className="dd-fact">Company: <b>{d.company}</b></span>}
              </div>
            </div>
          </div>
          <div className="dh-facts">
            <div className="dh-fact">
              <span className="tk-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="calendar" size={13} />Joined</span>
              <strong>{d.joined}</strong>
              <span className="tk-meta">{tenureFrom(d.joined)}</span>
            </div>
            <div className="dh-fact">
              <span className="tk-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="star" size={13} />Total Trips</span>
              <strong>{d.totalTrips}</strong>
              <span className="tk-meta">{trips[0] ? `Last trip: ${trips[0].departed}` : 'No trips yet'}</span>
            </div>
            <div className="dh-fact">
              <span className="tk-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="truck" size={13} />Current Status</span>
              <strong style={{ color: d.status === 'On Trip' ? 'var(--tk-blue)' : undefined }}>{d.status}</strong>
              <span className="tk-meta">{d.activeTrip ? d.activeTrip.route : d.currentLocation}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

      {tab === 'Overview' && (
        <div className="dh-layout">
          <div className="dh-main">
            <div className="dh-row1">
              <SectionCard title="Driver Information" pad="tight">
                <div className="dd-info-grid">
                  <LabelValue layout="stack" label="Full Name" value={d.name} />
                  <LabelValue layout="stack" label="Registration Type" value={d.registrationType} />
                  <LabelValue layout="stack" label="Date of Birth" value={d.dob} />
                  <LabelValue layout="stack" label="Gender" value={d.gender} />
                  <LabelValue layout="stack" label="Nationality" value={d.nationality} />
                  <LabelValue layout="stack" label="Phone Number" value={d.phone} />
                  <LabelValue layout="stack" label="Email Address" value={d.email} />
                  <LabelValue layout="stack" label="Current Location" value={d.currentLocation} />
                  <LabelValue layout="stack" label="Language" value={d.language} />
                  <LabelValue layout="stack" label="Emergency Contact" value={<>{d.emergencyContact}<br />{d.emergencyPhone}</>} />
                  <LabelValue layout="stack" label="Marital Status" value={d.maritalStatus} />
                  <LabelValue layout="stack" label="Employment Type" value={d.employmentType} />
                  <LabelValue layout="stack" label="Home Address" value={d.address} style={{ gridColumn: '1 / -1' }} />
                  <LabelValue layout="stack" label="Status" value={<Badge tone={STATUS_TONE[d.status]} dot>{d.status}</Badge>} />
                </div>
              </SectionCard>

              <SectionCard title="License Information" pad="tight"
                action={<Badge tone={d.licenseStatus === 'Valid' ? 'success' : d.licenseStatus === 'Expiring Soon' ? 'warning' : 'danger'}>{d.licenseStatus}</Badge>}>
                <div className="dd-info-grid">
                  <LabelValue layout="stack" label="License Number" value={<span className="tk-mono">{d.license}</span>} />
                  <LabelValue layout="stack" label="License Class" value={d.licenseClass} />
                  <LabelValue layout="stack" label="Date Issued" value={d.licenseIssued} />
                  <LabelValue layout="stack" label="Expiry Date" value={d.licenseExpiry} />
                  <LabelValue layout="stack" label="Issuing Authority" value={d.licenseAuthority} style={{ gridColumn: '1 / -1' }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Button variant="outline" size="sm" icon="file-text" fullWidth onClick={() => notify('License document opened')}>View License Document</Button>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Verification & KYC" pad="tight" action={<Badge tone={VERIFY_TONE[d.kyc] || 'neutral'}>{d.kyc}</Badge>}>
              <div className="dd-info-grid">
                <LabelValue layout="stack" label="Identity Verification" value={<Badge tone={VERIFY_TONE[d.verification.identity]}>{d.verification.identity}</Badge>} />
                <LabelValue layout="stack" label="Address Verification" value={<Badge tone={VERIFY_TONE[d.verification.address]}>{d.verification.address}</Badge>} />
                <LabelValue layout="stack" label="Face Verification" value={<Badge tone={VERIFY_TONE[d.verification.face]}>{d.verification.face}</Badge>} />
                <LabelValue layout="stack" label="Background Check" value={<Badge tone={VERIFY_TONE[d.verification.background] || (d.verification.background === 'Clear' ? 'success' : 'neutral')}>{d.verification.background}</Badge>} />
              </div>
              <div style={{ marginTop: 10 }}>
                <Button variant="outline" size="sm" icon="shield-check" onClick={() => notify('KYC documents opened')}>View KYC Documents</Button>
              </div>
            </SectionCard>

            <SectionCard title="Performance Overview" action={<span className="tk-meta">Last 6 Months</span>}>
              <div className="dd-summary-grid">
                <StatCard icon="route" tint="blue" label="Total Trips" value={d.totalTrips} caption="↑ 12% vs last 6 months" style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                <StatCard icon="circle-check" tint="green" label="Completed Trips" value={d.completedTrips}
                  caption={d.totalTrips ? `${((d.completedTrips / d.totalTrips) * 100).toFixed(1)}% completion rate` : '—'} style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                <StatCard icon="map" tint="purple" label="Total Distance" value={`${d.totalDistance.toLocaleString('en-NG')} km`} caption="↑ 15% vs last 6 months" style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                <StatCard icon="clock" tint="navy" label="On-time Delivery" value={`${d.onTimeDelivery}%`} style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                <StatCard icon="shield-check" tint="green" label="Safety Score" value={`${d.safetyScore}%`} style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
                <StatCard icon="star" tint="amber" label="Customer Rating" value={d.reviews ? `${d.rating.toFixed(1)} / 5` : '—'}
                  caption={d.reviews ? `Based on ${d.reviews} reviews` : 'No reviews yet'} style={{ boxShadow: 'none', border: '1px solid var(--tk-line)' }} />
              </div>
            </SectionCard>

            <SectionCard title="Vehicles Assigned" pad="none" count={vehicles.length}>
              <VehiclesTable rows={vehicles} />
            </SectionCard>

            <SectionCard title="Recent Trips" pad="none"
              action={<a onClick={() => setTab('Trips & Activity')} style={{ cursor: 'pointer' }}>View all trips</a>}
              footer={trips.length > pageSize && (
                <Pagination page={page} pageSize={pageSize} pageCount={Math.ceil(trips.length / pageSize)}
                  total={trips.length} onPage={setPage} onPageSize={() => {}} style={{ border: 0, padding: 0 }} />
              )}>
              {trips.length ? <TripsTable rows={pageRows} /> : <EmptyState icon="route" title="No trips yet" description="This driver has not completed any trips." />}
            </SectionCard>
          </div>

          <div className="dh-rail">
            <SectionCard title="Driver Status">
              <div className="dh-status-banner">
                <Icon name={d.status === 'On Trip' ? 'truck' : d.status === 'Active' ? 'circle-check' : 'circle-minus'} size={20}
                  color={d.status === 'On Trip' ? 'var(--tk-blue)' : d.status === 'Active' ? 'var(--tk-success)' : 'var(--tk-ink-400)'} />
                <span>
                  <strong style={{ display: 'block', font: '700 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.status}</strong>
                  <span className="tk-meta">{d.activeTrip ? d.activeTrip.route : d.currentLocation}</span>
                </span>
              </div>
              {d.activeTrip && (
                <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                  <LabelValue label="Started" value={d.activeTrip.started} />
                  <LabelValue label="Estimated Arrival" value={d.activeTrip.eta} />
                </div>
              )}
            </SectionCard>

            <SectionCard title="Wallet & Earnings" action={<a onClick={() => setTab('Earnings & Wallet')} style={{ cursor: 'pointer' }}>View Transactions →</a>}>
              <div className="dh-wallet-balance">
                <span className="tk-meta">Wallet Balance</span>
                <strong>{naira(d.walletBalance)}</strong>
              </div>
              <div className="dh-wallet-grid">
                <div>
                  <span className="tk-meta">Total Earnings</span>
                  <strong style={{ display: 'block' }}>{naira(d.totalEarnings)}</strong>
                  <span className="tk-meta">All time</span>
                </div>
                <div>
                  <span className="tk-meta">This Month</span>
                  <strong style={{ display: 'block' }}>{naira(d.monthEarnings)}</strong>
                  <span className="tk-meta">May 2026</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Assignment Information">
              <LabelValue label="Current Assignment" value={d.activeTrip ? d.activeTrip.id : '—'} />
              <LabelValue label="Assigned Truck" value={d.truckPlate ? <span className="tk-mono">{d.truckPlate}</span> : 'Not Assigned'} />
              <LabelValue label="Truck Type" value={d.truckType || '—'} />
              <LabelValue label="Trucking Company" value={d.company || '—'} />
              {!d.company && (
                <Banner tone="info" style={{ marginTop: 10 }}>
                  This is an individual driver. The driver is not currently under any trucking company.
                </Banner>
              )}
            </SectionCard>

            <SectionCard title="Compliance Status" action={<a onClick={() => setTab('Compliance')} style={{ cursor: 'pointer' }}>View all</a>}>
              <Banner tone={isFullyCompliant ? 'success' : 'warning'} title={isFullyCompliant ? 'Compliant' : 'Needs Attention'}>
                {isFullyCompliant ? 'All mandatory requirements are up to date.' : 'One or more requirements need review.'}
              </Banner>
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                {compliance.map((c) => (
                  <div key={c.label} className="dh-compliance-row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="shield-check" size={14} color="var(--tk-ink-300)" />{c.label}
                    </span>
                    <Badge tone={c.ok ? 'success' : 'danger'}>{c.ok ? 'Valid' : 'Attention'}</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>

            <QuickActionsCard items={[
              { icon: 'file-text', label: 'View Documents', hint: 'See all uploaded documents', onClick: () => setTab('Documents') },
              { icon: 'route', label: 'View Trip History', hint: 'See past and active trips', onClick: () => setTab('Trips & Activity') },
              { icon: 'wallet', label: 'View Earnings & Wallet', hint: 'Wallet balance and payouts', onClick: () => setTab('Earnings & Wallet') },
              { icon: 'shield-check', label: 'View Compliance Record', hint: 'Licenses, insurance, checks', onClick: () => setTab('Compliance') },
              { icon: 'message-square', label: 'Send Message', hint: 'Message this driver', onClick: () => notify('Message sent to driver') },
            ]} />
          </div>
        </div>
      )}

      {tab === 'Documents' && (
        <SectionCard title="Documents & Verification" count={documents.length}>
          {documents.map((doc) => <DocRow key={doc.id} d={doc} />)}
        </SectionCard>
      )}

      {tab === 'Trips & Activity' && (
        <>
          <SectionCard title="Trips & Activity" pad="none" count={trips.length}
            footer={trips.length > pageSize && (
              <Pagination page={page} pageSize={pageSize} pageCount={Math.max(1, Math.ceil(trips.length / pageSize))}
                total={trips.length} onPage={setPage} onPageSize={() => {}} style={{ border: 0, padding: 0 }} />
            )}>
            {trips.length ? <TripsTable rows={pageRows} /> : <EmptyState icon="route" title="No trips yet" description="This driver has not completed any trips." />}
          </SectionCard>
          <SectionCard title="Activity Log">
            <Timeline items={[
              d.activeTrip && { title: `Trip ${d.activeTrip.id} started`, time: d.activeTrip.started, state: 'current', icon: 'truck' },
              trips[d.activeTrip ? 1 : 0] && { title: `Trip ${trips[d.activeTrip ? 1 : 0].id} delivered`, time: trips[d.activeTrip ? 1 : 0].delivered, state: 'done', icon: 'check' },
              { title: 'KYC verification approved', time: d.kycDate || d.joined, state: 'done', icon: 'shield-check' },
              { title: 'Driver profile created', time: d.joined, state: 'done', icon: 'user' },
            ].filter(Boolean)} />
          </SectionCard>
        </>
      )}

      {tab === 'Earnings & Wallet' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--tk-space-4)' }}>
            <StatCard icon="wallet" tint="green" label="Wallet Balance" value={naira(d.walletBalance)} />
            <StatCard icon="banknote" tint="blue" label="Total Earnings" value={naira(d.totalEarnings)} caption="All time" />
            <StatCard icon="calendar" tint="amber" label="This Month" value={naira(d.monthEarnings)} caption="May 2026" />
            <StatCard icon="route" tint="navy" label="Avg. Earnings / Trip" value={d.totalTrips ? naira(d.totalEarnings / d.totalTrips) : '—'} />
          </div>
          <SectionCard title="Trip Earnings History" pad="none" count={trips.length}
            footer={trips.length > pageSize && (
              <Pagination page={page} pageSize={pageSize} pageCount={Math.max(1, Math.ceil(trips.length / pageSize))}
                total={trips.length} onPage={setPage} onPageSize={() => {}} style={{ border: 0, padding: 0 }} />
            )}>
            <DataTable rows={pageRows} rowKey={(r) => r.n}
              columns={[
                { key: 'id', header: 'Trip ID', render: (r) => <span className="tk-mono">{r.id}</span> },
                { key: 'departed', header: 'Trip Date' },
                { key: 'earnings', header: 'Amount', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.earnings)}</strong> },
                { key: 'status', header: 'Payout Status', render: (r) => <Badge tone={r.status === 'Completed' ? 'success' : 'warning'}>{r.status === 'Completed' ? 'Paid' : 'Pending'}</Badge> },
              ]} />
          </SectionCard>
        </>
      )}

      {tab === 'Maintenance Log' && (
        <SectionCard title="Maintenance Log" pad="none" count={driverMaintenance.length}
          description={d.truckPlate ? `Maintenance history for ${d.truckPlate}` : undefined}>
          {driverMaintenance.length ? (
            <DataTable rows={driverMaintenance} rowKey={(r) => r.id}
              columns={[
                { key: 'id', header: 'Maintenance ID', render: (r) => <span className="tk-mono" style={{ color: 'var(--tk-blue)' }}>{r.id}</span> },
                { key: 'description', header: 'Service' },
                { key: 'serviceCenter', header: 'Service Center' },
                { key: 'dueDate', header: 'Date' },
                { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]} />
          ) : (
            <EmptyState icon="wrench" title="No maintenance records" description={d.truckPlate ? 'No maintenance has been logged for this driver’s assigned truck.' : 'This driver has no assigned truck.'} />
          )}
        </SectionCard>
      )}

      {tab === 'Compliance' && (
        <SectionCard title="Compliance Status">
          <Banner tone={isFullyCompliant ? 'success' : 'warning'} title={isFullyCompliant ? 'Compliant' : 'Needs Attention'} style={{ marginBottom: 12 }}>
            {isFullyCompliant ? 'All mandatory requirements are up to date.' : 'One or more requirements need review.'}
          </Banner>
          {compliance.map((c) => (
            <div key={c.label} className="dh-compliance-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="shield-check" size={16} color="var(--tk-ink-300)" />{c.label}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!c.ok && <span className="tk-meta">{c.hint}</span>}
                <Badge tone={c.ok ? 'success' : 'danger'}>{c.ok ? 'Valid' : 'Attention'}</Badge>
              </span>
            </div>
          ))}
        </SectionCard>
      )}

      {tab === 'Incidents' && (
        <SectionCard title="Incidents">
          <EmptyState icon="shield-check" title="No incidents found" description="This driver has no recorded accidents or incidents." />
        </SectionCard>
      )}

      {tab === 'Reviews & Ratings' && (
        <SectionCard title="Reviews & Ratings" count={reviews.length}
          action={d.reviews ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '700 15px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>
            <Icon name="star" size={16} color="var(--tk-warning)" />{d.rating.toFixed(1)} / 5 <span className="tk-meta">({d.reviews})</span>
          </span> : null}>
          {reviews.length ? reviews.map((r) => (
            <div key={r.id} className="dh-review-row">
              <Avatar name={r.reviewer} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.reviewer}</strong>
                  <Stars value={r.rating} />
                  <span className="tk-meta">{r.date}</span>
                </div>
                <p style={{ margin: '4px 0 0', font: '400 13px/20px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{r.comment}</p>
              </div>
            </div>
          )) : <EmptyState icon="star" title="No reviews yet" description="This driver has not received any reviews." />}
        </SectionCard>
      )}

      {tab === 'Notes' && (
        <SectionCard title="Notes" action={<Button size="sm" icon="plus" onClick={() => setNoteOpen(true)}>Add Note</Button>}>
          {noteOpen && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              <Textarea rows={3} placeholder="Write a note about this driver..." value={note} onChange={(e) => setNote(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" disabled={!note.trim()} onClick={() => {
                  setNotes((prev) => [{ id: Date.now(), text: note.trim(), time: 'Just now' }, ...prev]);
                  setNote('');
                  setNoteOpen(false);
                }}>Save Note</Button>
                <Button size="sm" variant="outline" onClick={() => { setNoteOpen(false); setNote(''); }}>Cancel</Button>
              </div>
            </div>
          )}
          {notes.length === 0 ? (
            <EmptyState icon="file-text" title="No notes yet" description="Notes and internal comments about this driver will appear here." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {notes.map((n) => (
                <div key={n.id} className="dh-note-row">
                  <Avatar name="Super Admin" size={32} />
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>Super Admin</strong>
                      <span className="tk-meta">{n.time}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', font: '400 13px/20px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{n.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
