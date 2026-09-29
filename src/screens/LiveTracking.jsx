'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PageHeader, FilterSelect, DropdownMenu, SectionCard, Tabs, Badge, Button, SearchField,
  IconButton, Checkbox, ProgressBar, DonutChart, AlertRow, Modal, Textarea, Banner, Icon,
} from '../ds.js';
import './LiveTracking.css';
import { useCollection } from '../mock/useCollection.js';
import { getJobTrips } from '../domain/jobTrips.js';
import { useGetAdminTripsQuery } from '../store/features/trips/tripsApi.js';
import { TriangulationGoogleMap } from './TriangulationGoogleMap.jsx';

const STATUSES = ['Assigned', 'In Transit', 'At Pickup', 'At Delivery', 'Delivered', 'Delayed', 'Stopped'];
const MAP_STATUS_COLOR = {
  Assigned: '#0241e8', 'In Transit': '#0241e8', 'At Pickup': '#f27602', 'At Delivery': '#0e7c86',
  Delivered: '#12833b', Delayed: '#cb0611', Stopped: '#8a90a8', Maintenance: '#4c16ac',
};
const STATUS_COLOR = {
  Assigned: 'var(--tk-info)',
  'In Transit': 'var(--tk-blue)', 'At Pickup': 'var(--tk-warning)', Delivered: 'var(--tk-success)',
  'At Delivery': 'var(--tk-teal)', Delayed: 'var(--tk-danger)', Stopped: 'var(--tk-ink-300)', Maintenance: 'var(--tk-purple)',
};
const STATUS_BADGE = { Assigned: 'info', 'In Transit': 'info', 'At Pickup': 'warning', 'At Delivery': 'teal', Delivered: 'success', Delayed: 'danger', Stopped: 'neutral', Maintenance: 'purple' };
const LEGEND = [
  { label: 'In Transit', color: STATUS_COLOR['In Transit'] }, { label: 'At Pickup', color: STATUS_COLOR['At Pickup'] },
  { label: 'Delivered', color: STATUS_COLOR.Delivered }, { label: 'Delayed', color: STATUS_COLOR.Delayed },
  { label: 'Stopped', color: STATUS_COLOR.Stopped }, { label: 'Maintenance', color: STATUS_COLOR.Maintenance },
];

const TRIPS = [
  { id: 'TRK-2026-0124', from: 'Lagos Port', to: 'Kano ICD', status: 'In Transit', speed: 65, driver: 'Adewale Musa', driverPhone: '0803 111 2233',
    truck: 'LND 123 XY', truckPhone: '0803 555 1122', company: 'Global Haulage Ltd', companyPhone: '0803 123 4567',
    container: '40FT', cargo: 'Steel Pipes', location: 'Keffi, Nasarawa', distanceCovered: '534.6 km', totalDistance: '1,023 km',
    eta: '2h 14m', nextStop: 'Kano ICD', lastUpdate: '2 mins ago', engine: 'ON', progress: 52, mapPos: { left: 63, top: 15 },
    stops: [{ time: '08:10', label: 'Departed Lagos Port', state: 'done' }, { time: '12:45', label: 'Arrived Ore, Ondo', state: 'done' },
      { time: '15:20', label: 'Departed Ore', state: 'done' }, { time: '18:05', label: 'Arrived Lokoja', state: 'done' },
      { time: '20:30', label: 'Departed Lokoja', state: 'current' }, { time: '--:--', label: 'Arrived Kano ICD', state: 'pending' }] },
  { id: 'TRK-2026-0098', from: 'Apapa Terminal', to: 'Ibadan Depot', status: 'At Pickup', speed: 0, driver: 'Chinedu Okafor', driverPhone: '0805 222 3344',
    truck: 'LAG 456 QP', truckPhone: '0805 666 2233', company: 'SpeedLine Logistics', companyPhone: '0805 987 1234',
    container: '20FT', cargo: 'Rice Bags', location: 'Apapa Terminal, Lagos', distanceCovered: '0 km', totalDistance: '128 km',
    eta: 'Awaiting load', nextStop: 'Ibadan Depot', lastUpdate: '5 mins ago', engine: 'OFF', progress: 2, mapPos: { left: 46, top: 48 },
    stops: [{ time: '09:00', label: 'Arrived Apapa Terminal', state: 'done' }, { time: '--:--', label: 'Loading in progress', state: 'current' }, { time: '--:--', label: 'Departed for Ibadan', state: 'pending' }] },
  { id: 'TRK-2026-0111', from: 'Onne Port', to: 'Abuja Depot', status: 'In Transit', speed: 72, driver: 'Emeka Johnson', driverPhone: '0807 333 4455',
    truck: 'RIV 220 ZT', truckPhone: '0807 111 8899', company: 'D-Line Logistics', companyPhone: '0807 456 7890',
    container: '40FT', cargo: 'Machinery', location: 'Lokoja, Kogi', distanceCovered: '312 km', totalDistance: '610 km',
    eta: '3h 28m', nextStop: 'Abuja Depot', lastUpdate: '1 min ago', engine: 'ON', progress: 51, mapPos: { left: 52, top: 24 },
    stops: [{ time: '06:40', label: 'Departed Onne Port', state: 'done' }, { time: '11:15', label: 'Arrived Lokoja', state: 'current' }, { time: '--:--', label: 'Arrived Abuja Depot', state: 'pending' }] },
  { id: 'TRK-2026-0107', from: 'Lagos Port', to: 'Kaduna Depot', status: 'In Transit', speed: 58, driver: 'Bello Ibrahim', driverPhone: '0809 444 5566',
    truck: 'KAN 771 DF', truckPhone: '0809 222 3300', company: 'Oceanic Transport', companyPhone: '0809 654 3210',
    container: '40FT', cargo: 'Electronics', location: 'Abuja, FCT', distanceCovered: '690 km', totalDistance: '796 km',
    eta: '1h 45m', nextStop: 'Kaduna Depot', lastUpdate: '3 mins ago', engine: 'ON', progress: 87, mapPos: { left: 65, top: 9 },
    stops: [{ time: '05:20', label: 'Departed Lagos Port', state: 'done' }, { time: '14:10', label: 'Arrived Abuja', state: 'done' }, { time: '--:--', label: 'Arrived Kaduna Depot', state: 'current' }] },
  { id: 'TRK-2026-0119', from: 'Port Harcourt Port', to: 'PH Depot', status: 'At Pickup', speed: 0, driver: 'Kingsley Daniel', driverPhone: '0811 555 6677',
    truck: 'PHC 390 LR', truckPhone: '0811 999 1122', company: 'Global Haulage Ltd', companyPhone: '0803 123 4567',
    container: '20FT', cargo: 'General Goods', location: 'Port Harcourt Port', distanceCovered: '0 km', totalDistance: '18 km',
    eta: 'At Depot', nextStop: 'PH Depot', lastUpdate: '45 mins ago', engine: 'OFF', progress: 0, mapPos: { left: 17, top: 63 },
    stops: [{ time: '07:50', label: 'Arrived Port Harcourt Port', state: 'done' }, { time: '--:--', label: 'Loading', state: 'current' }] },
  { id: 'TRK-2026-0091', from: 'Lagos Port', to: 'Aba Depot', status: 'Delayed', speed: 34, driver: 'Sunday James', driverPhone: '0813 666 7788',
    truck: 'ENU 221 TA', truckPhone: '0813 888 4455', company: 'Atlantic Logistics', companyPhone: '0813 321 6549',
    container: '40FT', cargo: 'Cement Bags', location: 'Benin City, Edo', distanceCovered: '320 km', totalDistance: '520 km',
    eta: '4h 10m', nextStop: 'Aba Depot', lastUpdate: '18 mins ago', engine: 'ON', progress: 61, mapPos: { left: 51, top: 72 },
    stops: [{ time: '06:00', label: 'Departed Lagos Port', state: 'done' }, { time: '13:40', label: 'Arrived Benin City', state: 'current' }, { time: '--:--', label: 'Arrived Aba Depot', state: 'pending' }] },
  { id: 'TRK-2026-0103', from: 'Apapa Terminal', to: 'Enugu Depot', status: 'In Transit', speed: 81, driver: 'Ifeanyi Nwosu', driverPhone: '0815 777 8899',
    truck: 'GGE 221 QW', truckPhone: '0815 333 2211', company: 'Zenith Transport', companyPhone: '0815 987 6543',
    container: '20FT', cargo: 'Plastic Raw Material', location: 'Benin City, Edo', distanceCovered: '280 km', totalDistance: '560 km',
    eta: '2h 33m', nextStop: 'Enugu Depot', lastUpdate: '1 min ago', engine: 'ON', progress: 50, mapPos: null,
    stops: [{ time: '07:10', label: 'Departed Apapa Terminal', state: 'done' }, { time: '--:--', label: 'Arrived Enugu Depot', state: 'current' }] },
];

const OVERVIEW = [
  { label: 'In Transit', value: 312, pct: 45, color: STATUS_COLOR['In Transit'] },
  { label: 'At Pickup', value: 68, pct: 10, color: STATUS_COLOR['At Pickup'] },
  { label: 'Delivered Today', value: 204, pct: 30, color: STATUS_COLOR.Delivered },
  { label: 'Delayed', value: 23, pct: 3, color: STATUS_COLOR.Delayed },
  { label: 'Stopped', value: 80, pct: 12, color: STATUS_COLOR.Stopped },
];
const TOTAL_ACTIVE = 687;
const ALERTS = [
  { icon: 'gauge', tone: 'red', title: 'Speeding Alert', trip: 'TRK-2026-0091 exceeding speed limit (105 km/h)', time: '2m ago' },
  { icon: 'shield-alert', tone: 'amber', title: 'Geofence Breach', trip: 'TRK-2026-0107 exited approved route', time: '5m ago' },
  { icon: 'clock', tone: 'amber', title: 'Long Stop', trip: 'TRK-2026-0119 stopped for more than 45 mins', time: '18m ago' },
];
const TOP_DELAYS = [
  { route: 'Lagos → Kaduna', trips: 6, delay: '2h 45m' }, { route: 'Onne → Abuja', trips: 4, delay: '1h 30m' },
  { route: 'Apapa → Enugu', trips: 3, delay: '1h 10m' }, { route: 'PH → Kano', trips: 2, delay: '55m' },
  { route: 'Lagos → Aba', trips: 2, delay: '40m' },
];
const QUICK_ACTIONS = [
  { icon: 'maximize', label: 'Zoom to Fit' }, { icon: 'refresh-cw', label: 'Refresh' },
  { icon: 'shield', label: 'Create Geofence' }, { icon: 'send', label: 'Send Message' },
  { icon: 'download', label: 'Export Tracking' }, { icon: 'share-2', label: 'Share Location' },
  { icon: 'route', label: 'Traffic View' }, { icon: 'flame', label: 'Heat Map' },
];
const LAYERS = ['Trucks', 'Trips', 'Clusters', 'Geofences', 'Traffic'];
const LAYER_ICON = { Trucks: 'truck', Trips: 'route', Clusters: 'shapes', Geofences: 'octagon', Traffic: 'activity' };

function mapApiTrip(trip) {
  const status = trip.statusLabel || trip.status || 'Unknown';
  const latitude = trip.truck?.latitude;
  const longitude = trip.truck?.longitude;
  const position = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    ? { lat: latitude, lng: longitude } : null;
  const statusColor = MAP_STATUS_COLOR[status] || MAP_STATUS_COLOR['In Transit'];

  return {
    id: trip.id,
    jobId: trip.jobId,
    from: trip.origin || '-',
    to: trip.destination || '-',
    status,
    statusColor,
    speed: null,
    driver: trip.driverName || '—',
    driverPhone: '—',
    truck: trip.truck?.plateNumber || '—',
    truckPhone: '—',
    company: '—',
    companyPhone: '—',
    container: trip.containerNumber || '—',
    cargo: '—',
    location: position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : '—',
    distanceCovered: '—',
    totalDistance: '—',
    eta: trip.displayEta || '—',
    nextStop: trip.destination || '—',
    lastUpdate: trip.truck?.displayLastLocationUpdate || '—',
    engine: '—',
    progress: null,
    stops: [],
    position,
  };
}

export function LiveTracking() {
  const jobs = useCollection('jobs') || [];
  const {
    currentData: tripsResponse,
    isLoading: tripsLoading,
    isFetching: tripsFetching,
    error: tripsError,
    refetch: refetchTrips,
  } = useGetAdminTripsQuery({ page: 1, limit: 100 }, { pollingInterval: 30000 });
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [q, setQ] = useState('');
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedId, setSelectedId] = useState('TRK-2026-0124');
  const [visibleCount, setVisibleCount] = useState(6);
  const [layer, setLayer] = useState('Trucks');
  const [zoom, setZoom] = useState(6);
  const [fitVersion, setFitVersion] = useState(0);
  const [mapStyle, setMapStyle] = useState('Standard');
  const [showTraffic, setShowTraffic] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [geofenceOpen, setGeofenceOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  function notify(tone, title) { setToast({ tone, title }); }

  const mockTrips = useMemo(() => {
    const dynamic = jobs.flatMap((job, jobIndex) => getJobTrips(job)
      .filter((trip) => !['Cancelled', 'Completed'].includes(trip.status))
      .map((trip, tripIndex) => ({
        id: trip.id, jobId: job.id, from: trip.origin || job.origin || '—', to: trip.destination || job.destination || '—',
        status: trip.status || 'Assigned', speed: trip.status === 'In Transit' ? 62 + ((jobIndex + tripIndex) % 16) : 0,
        driver: trip.driverName || 'Unassigned', driverPhone: trip.driverPhone || '—', truck: trip.truckPlate || 'Unassigned', truckPhone: '—',
        company: trip.truckingCompany || job.truckingCompany || job.truckCompany || '—', companyPhone: 'Operations contact',
        container: job.cargoDetails?.match(/\d+ft/i)?.[0]?.toUpperCase() || 'General', cargo: job.cargo || job.cargoType || '—',
        location: trip.currentLocation || trip.origin || job.origin || '—', distanceCovered: `${Math.round((trip.distanceKm || job.distanceKm || 0) * ((trip.progress || 0) / 100))} km`,
        totalDistance: `${trip.distanceKm || job.distanceKm || 0} km`, eta: trip.eta || job.deliveryDate || '—', nextStop: trip.destination || job.destination || '—',
        lastUpdate: job.updatedAt || 'Recently', engine: ['In Transit', 'Delayed'].includes(trip.status) ? 'ON' : 'OFF', progress: trip.progress || 0,
        mapPos: { left: 20 + ((jobIndex * 13 + tripIndex * 9) % 65), top: 12 + ((jobIndex * 17 + tripIndex * 11) % 70) },
        stops: [{ time: '—', label: `Pickup at ${trip.origin || job.origin}`, state: trip.progress > 0 ? 'done' : 'current' }, { time: '—', label: `Deliver to ${trip.destination || job.destination}`, state: trip.progress >= 100 ? 'done' : trip.progress > 0 ? 'current' : 'pending' }],
      })));
    const ids = new Set(dynamic.map((trip) => trip.id));
    return [...dynamic, ...TRIPS.filter((trip) => !ids.has(trip.id))];
  }, [jobs]);

  const trackedTrips = useMemo(() => tripsResponse
    ? tripsResponse.rows.map(mapApiTrip)
    : mockTrips, [tripsResponse, mockTrips]);

  useEffect(() => {
    if (selectedId && trackedTrips.length && !trackedTrips.some((trip) => trip.id === selectedId)) {
      setSelectedId(trackedTrips[0].id);
    }
  }, [selectedId, trackedTrips]);

  const filtered = useMemo(() => trackedTrips.filter((t) =>
    (statusFilter === 'All Status' || t.status === statusFilter) &&
    (!q || [t.id, t.driver, t.from, t.to].some((v) => v.toLowerCase().includes(q.toLowerCase())))
  ), [statusFilter, q, trackedTrips]);
  const visible = filtered.slice(0, visibleCount);
  const selected = selectedId ? trackedTrips.find((t) => t.id === selectedId) || null : null;
  const mapPoints = useMemo(() => filtered.filter((trip) => trip.position).map((trip) => ({
    ...trip.position,
    title: `${trip.truck} · ${trip.from} → ${trip.to}`,
    color: trip.statusColor || '#2563eb',
    opportunityId: trip.id,
  })), [filtered]);

  function runQuickAction(label) {
    if (label === 'Zoom to Fit') { setFitVersion((version) => version + 1); notify('success', 'Map zoomed to fit all active trips.'); }
    else if (label === 'Refresh') { refetchTrips(); notify('info', 'Refreshing tracking data.'); }
    else if (label === 'Create Geofence') setGeofenceOpen(true);
    else if (label === 'Send Message') setMessageOpen(true);
    else if (label === 'Export Tracking') notify('info', 'Exporting tracking report…');
    else if (label === 'Share Location') notify('success', 'Live location link copied to clipboard.');
    else if (label === 'Traffic View') { setShowTraffic((s) => !s); notify('info', `Traffic view ${showTraffic ? 'hidden' : 'shown'}.`); }
    else if (label === 'Heat Map') notify('info', 'Heat map overlay is not available in this preview.');
  }

  const mapContent = (big) => (
    <div className="lt-map-wrap" style={big ? { height: 560 } : undefined}>
      <TriangulationGoogleMap points={mapPoints} selectedId={selectedId} onSelect={setSelectedId}
        ariaLabel="Live truck tracking map"
        emptyMessage={tripsLoading ? 'Loading truck locations…' : 'The trips response has no truck coordinates to plot.'}
        mapType={mapStyle} showTraffic={showTraffic} zoom={zoom} fitVersion={fitVersion} fitOnDataChange={false} />

      <div className="lt-layer-rail">
        {LAYERS.map((l) => (
          <button key={l} className={'lt-layer-btn' + (layer === l ? ' active' : '')} onClick={() => {
            setLayer(l);
            if (l === 'Traffic') setShowTraffic(true);
            else if (layer === 'Traffic') setShowTraffic(false);
            notify('info', `Showing ${l} layer.`);
          }}>
            <Icon name={LAYER_ICON[l]} size={16} />{l}
          </button>
        ))}
      </div>

      <div className="lt-zoom-rail">
        <button onClick={() => setZoom((z) => Math.min(z + 1, 18))}>+</button>
        <button onClick={() => setZoom((z) => Math.max(z - 1, 3))}>-</button>
        <button onClick={() => { setFitVersion((version) => version + 1); notify('info', 'Centered on your fleet.'); }}><Icon name="crosshair" size={14} /></button>
      </div>

      <div className="lt-map-toolbar">
        <span style={{ position: 'relative' }}>
          <button className="date-button" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--tk-line-strong)', borderRadius: 8, height: 34, padding: '0 10px', background: '#fff', cursor: 'pointer', font: '500 12px var(--tk-font-sans)' }}
            onClick={() => setOpenFilter(openFilter === 'style' ? null : 'style')}>Map style　{mapStyle}<Icon name="chevron-down" size={13} /></button>
          {openFilter === 'style' && (
            <span style={{ position: 'absolute', left: 0, bottom: 40, zIndex: 30 }}>
              <DropdownMenu width={150} items={['Standard', 'Satellite', 'Terrain'].map((s) => ({ label: s, icon: s === mapStyle ? 'check' : undefined, onClick: () => { setMapStyle(s); setOpenFilter(null); } }))} />
            </span>
          )}
        </span>
        <Checkbox checked={showTraffic} onChange={setShowTraffic} label="Show traffic" />
      </div>

      <div className="lt-legend">
        {LEGEND.map((l) => <span key={l.label}><span style={{ width: 8, height: 8, borderRadius: 999, background: l.color }} />{l.label}</span>)}
      </div>
    </div>
  );

  return (
    <>
      <div className="lt-head">
        <PageHeader title="Live Tracking" description="Real-time visibility of trucks, trips and cargo across all routes." style={{ flex: 1 }} />
        <div className="lt-head-actions">
          <span style={{ position: 'relative' }}>
            <FilterSelect label={statusFilter === 'All Status' ? 'All Status (5)' : statusFilter} active={statusFilter !== 'All Status'} onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')} />
            {openFilter === 'status' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({ label: s, icon: s === statusFilter ? 'check' : undefined, onClick: () => { setStatusFilter(s); setOpenFilter(null); } }))} />
              </span>
            )}
          </span>
          {[['In Transit', 312], ['At Pickup', 68], ['Delivered', 204], ['Delayed', 23]].map(([s, n]) => (
            <button key={s} className={'lt-pill' + (statusFilter === s ? ' active' : '')}
              style={{ color: statusFilter === s ? STATUS_COLOR[s] : undefined }}
              onClick={() => setStatusFilter(statusFilter === s ? 'All Status' : s)}>
              <span className="dot" style={{ background: STATUS_COLOR[s] }} />{s}　<b>{n}</b>
            </button>
          ))}
          <span style={{ position: 'relative' }}>
            <Button variant="outline" icon="list-filter" iconRight="chevron-down" onClick={() => setOpenFilter(openFilter === 'quick' ? null : 'quick')}>Filters</Button>
            {openFilter === 'quick' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={[
                  { section: 'QUICK FILTERS' },
                  { label: 'Speeding Trucks', icon: 'gauge', onClick: () => { setOpenFilter(null); notify('info', 'Showing trucks exceeding speed limits.'); } },
                  { label: 'Long Stops', icon: 'clock', onClick: () => { setOpenFilter(null); notify('info', 'Showing trucks stopped over 30 mins.'); } },
                  { label: 'Reset Filters', icon: 'rotate-cw', onClick: () => { setStatusFilter('All Status'); setQ(''); setOpenFilter(null); } },
                ]} />
              </span>
            )}
          </span>
          <Button variant="outline" icon="maximize" onClick={() => setFullScreen(true)}>Full Screen</Button>
        </div>
      </div>

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {tripsLoading && <Banner tone="info" title="Loading live trips">Showing the existing preview while current truck locations load.</Banner>}
      {tripsFetching && !tripsLoading && <Banner tone="info" title="Refreshing live locations" />}
      {tripsError && <Banner tone="warning" title="Live trip data is unavailable">The tracking map can only plot coordinates returned by GET /api/v1/admin/trips.</Banner>}

      <div className="lt-main">
        <SectionCard title={statusFilter === 'All Status' && !q ? `Active Trips (${tripsResponse ? trackedTrips.filter((trip) => !['Delivered', 'Completed', 'Cancelled'].includes(trip.status)).length : TOTAL_ACTIVE})` : `Active Trips (${filtered.length})`} pad="tight">
          <SearchField placeholder="Search trips, truck no. or driver..." value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          <Tabs value={statusFilter === 'Delivered' || statusFilter === 'Stopped' ? 'All Status' : statusFilter}
            onChange={setStatusFilter}
            items={[{ value: 'All Status', label: 'All' }, { value: 'In Transit', label: 'In Transit', count: 312 }, { value: 'At Pickup', label: 'At Pickup' }, { value: 'Delayed', label: 'Delayed' }]}
            style={{ marginBottom: 10 }} />
          <div className="lt-trip-list">
            {visible.map((t) => (
              <div key={t.id} className={'lt-trip-row' + (t.id === selectedId ? ' active' : '')} onClick={() => setSelectedId(t.id)}>
                <div className="lt-trip-top">
                  <span className="lt-trip-icon" style={{ background: t.statusColor || STATUS_COLOR[t.status] || STATUS_COLOR['In Transit'] }}><Icon name="truck" size={15} color="#fff" /></span>
                  <strong style={{ flex: 1, font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{t.id}</strong>
                  <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: t.status === 'Delayed' ? 'var(--tk-danger)' : 'var(--tk-ink-700)' }}>{t.speed == null ? '—' : `${t.speed} km/h`}</span>
                </div>
                <div className="lt-trip-bottom">
                  <span className="tk-meta">{t.from.split(' ')[0]} → {t.to.split(' ')[0]}　·　{t.driver}</span>
                  <span style={{ font: '500 11px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>{(t.status === 'In Transit' || t.status === 'Delayed') ? `ETA: ${t.eta}` : t.eta}</span>
                </div>
              </div>
            ))}
            {visible.length === 0 && <div style={{ padding: '24px 0', textAlign: 'center' }} className="tk-meta">No trips match your filters.</div>}
          </div>
          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}><a style={{ cursor: 'pointer' }} onClick={() => setVisibleCount((v) => v + 6)}>Load more ⌄</a></div>
          )}
        </SectionCard>

        {mapContent(false)}

        <SectionCard title="Trip Details" action={selected && <IconButton icon="x" label="Close" onClick={() => setSelectedId(null)} />}>
          {!selected ? (
            <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '40px 10px', textAlign: 'center' }}>
              <Icon name="route" size={28} color="var(--tk-ink-300)" />
              <span className="tk-meta">Select a trip from the list or map to view its details.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ font: '700 16px/22px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{selected.id}</strong>
                <Badge tone={STATUS_BADGE[selected.status] || 'neutral'}>{selected.status}</Badge>
              </div>
              <strong style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>{selected.from} → {selected.to}</strong>
              <span className="tk-meta">Container ({selected.container})　·　{selected.cargo}</span>

              <div style={{ borderTop: '1px solid var(--tk-line)', marginTop: 4 }}>
                {[['user', 'Driver', selected.driver, selected.driverPhone], ['truck', 'Truck', selected.truck, selected.truckPhone], ['building-2', 'Company', selected.company, selected.companyPhone]].map(([icon, label, value, phone]) => (
                  <div className="lt-contact-row" key={label} style={{ borderTop: label !== 'Driver' ? '1px solid var(--tk-line)' : 'none' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)', color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><Icon name={icon} size={15} /></span>
                    <div style={{ flex: 1, display: 'grid', gap: 1 }}><span className="tk-meta">{label}</span><strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{value}</strong></div>
                    <IconButton icon="phone" tone="outline" disabled={!phone || phone === '—'} onClick={() => notify('success', `Calling ${value}…`)} />
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', borderTop: '1px solid var(--tk-line)', paddingTop: 10 }}>
                {[['Current Location', selected.location], ['Speed', selected.speed == null ? '—' : `${selected.speed} km/h`], ['Distance Covered', selected.distanceCovered], ['Total Distance', selected.totalDistance],
                  ['ETA', selected.eta, 'var(--tk-warning)'], ['Next Stop', selected.nextStop], ['Last Update', selected.lastUpdate], ['Engine Status', selected.engine, selected.engine === 'ON' ? 'var(--tk-success)' : 'var(--tk-ink-400)']].map(([label, value, tone]) => (
                  <div key={label}><span className="tk-meta" style={{ display: 'block' }}>{label}</span><strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: tone || 'var(--tk-ink-900)' }}>{value}</strong></div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--tk-line)', paddingTop: 12 }}>
                {selected.progress == null
                  ? <span className="tk-meta">Trip progress is not included in GET /api/v1/admin/trips.</span>
                  : <ProgressBar value={selected.progress} label="Trip Progress" caption={`${selected.progress}%`} color="var(--tk-blue)" />}
                <div style={{ marginTop: 10 }}>
                  {selected.stops.length === 0 && <span className="tk-meta">Stop updates are not included in GET /api/v1/admin/trips.</span>}
                  {selected.stops.map((s, i) => (
                    <div className="lt-progress-stop" key={i}>
                      {s.state === 'done' ? <Icon name="circle-check" size={16} color="var(--tk-success)" />
                        : s.state === 'current' ? <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--tk-blue)', flex: '0 0 auto' }} />
                        : <span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid var(--tk-line-strong)', flex: '0 0 auto' }} />}
                      <span className="tk-mono" style={{ width: 44, color: 'var(--tk-ink-400)', fontSize: 11 }}>{s.time}</span>
                      <span style={{ font: '500 12px/17px var(--tk-font-sans)', color: s.state === 'pending' ? 'var(--tk-ink-400)' : 'var(--tk-ink-900)' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="lt-main" style={{ gridTemplateColumns: '1fr' }}>
        <SectionCard title="Quick Actions">
          <div className="lt-quick-grid">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} className="lt-quick-item" onClick={() => runQuickAction(a.label)}>
                <Icon name={a.icon} size={18} color="var(--tk-blue)" /><span>{a.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="lt-bottom">
        <SectionCard title="Live Overview">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <DonutChart size={140} thickness={18} centerValue={TOTAL_ACTIVE} centerLabel="Active Trips" data={OVERVIEW} />
            <div style={{ width: '100%', display: 'grid', gap: 8 }}>
              {OVERVIEW.map((o) => (
                <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color, flex: '0 0 auto' }} />
                  <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{o.label}</span>
                  <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{o.value} ({o.pct}%)</strong>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Alerts (23)" action={<a onClick={() => notify('info', 'Showing all alerts.')} style={{ cursor: 'pointer' }}>View all</a>}
          footer={<a onClick={() => notify('info', 'Showing all alerts.')} style={{ cursor: 'pointer' }}>View all alerts</a>}>
          {ALERTS.map((a) => (
            <AlertRow key={a.title + a.time} icon={a.icon} tone={a.tone} title={a.title} description={a.trip} action={<span className="tk-meta" style={{ whiteSpace: 'nowrap' }}>{a.time}</span>} />
          ))}
        </SectionCard>

        <SectionCard title="Top Delays" action={<a onClick={() => notify('info', 'Showing all delayed routes.')} style={{ cursor: 'pointer' }}>View all</a>}>
          {TOP_DELAYS.map((d, i) => (
            <div key={d.route} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--tk-line)' : 'none' }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--tk-surface-sunk)', display: 'grid', placeItems: 'center', flex: '0 0 auto', font: '600 11px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{i + 1}</span>
              <span style={{ flex: 1, font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{d.route}</span>
              <span className="tk-meta">{d.trips} Trips</span>
              <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-danger)' }}>{d.delay}</strong>
            </div>
          ))}
        </SectionCard>
      </div>

      <Modal open={fullScreen} onClose={() => setFullScreen(false)} title="Live Tracking — Full Screen" width={1100}>
        {mapContent(true)}
      </Modal>

      <Modal open={messageOpen} onClose={() => setMessageOpen(false)} title="Send Message" description={selected ? `To ${selected.driver} · ${selected.id}` : ''}
        footer={<><Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
          <Button icon="send" disabled={!message.trim()} onClick={() => { setMessageOpen(false); setMessage(''); notify('success', `Message sent to ${selected?.driver}.`); }}>Send Message</Button></>}>
        <Textarea label="Message" rows={5} placeholder="Write a message to the driver..." value={message} onChange={(e) => setMessage(e.target.value)} />
      </Modal>

      <Modal open={geofenceOpen} onClose={() => setGeofenceOpen(false)} title="Create Geofence" description="Draw a boundary around a location to get alerts when trucks enter or exit."
        footer={<><Button variant="outline" onClick={() => setGeofenceOpen(false)}>Cancel</Button><Button icon="shield" onClick={() => { setGeofenceOpen(false); notify('success', 'Geofence created around the current map view.'); }}>Create Geofence</Button></>}>
        <div style={{ height: 200, borderRadius: 10, border: '1.5px dashed var(--tk-line-strong)', background: 'var(--tk-surface-sunk)', display: 'grid', placeItems: 'center', gap: 8, textAlign: 'center', color: 'var(--tk-ink-300)' }}>
          <Icon name="shield" size={28} />
          <span className="tk-meta">Geofence drawing tool placeholder</span>
        </div>
      </Modal>
    </>
  );
}
