'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PageHeader, FilterSelect, DropdownMenu, SectionCard, Tabs, Badge, Button, SearchField,
  IconButton, Checkbox, ProgressBar, DonutChart, Modal, Textarea, Banner, Icon,
} from '../ds.js';
import './LiveTracking.css';
import {
  useGetAdminTripsQuery,
  useLazyGetAdminTripsQuery,
  useGetAdminTripStatsQuery,
  useGetAdminTripDetailQuery,
  useLazyExportAdminTripsQuery,
  useMessageAdminTripDriverMutation,
} from '../store/features/trips/tripsApi.js';
import { TriangulationGoogleMap } from './TriangulationGoogleMap.jsx';

const STATUSES = ['Assigned', 'In Transit', 'At Pickup', 'At Delivery', 'Delivered', 'Delayed'];
const STATUS_FILTERS = {
  Assigned: 'assigned', 'In Transit': 'inTransit', 'At Pickup': 'atPickup',
  'At Delivery': 'atDelivery', Delivered: 'completed', Delayed: 'delayed',
};
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
  const status = trip.status || 'Unknown';
  const latitude = trip.truck?.latitude;
  const longitude = trip.truck?.longitude;
  const position = trip.hasGpsPosition && Number.isFinite(latitude) && Number.isFinite(longitude)
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
    driverPhone: trip.driverPhone || '—',
    truck: trip.truck?.plateNumber || '—',
    truckPhone: '—',
    company: trip.truckingCompanyName || '—',
    companyPhone: trip.truckingCompanyPhone || '—',
    container: trip.container.size || trip.containerNumber || '—',
    cargo: trip.cargoDescription || '—',
    location: trip.currentLocation.description
      ? `${trip.currentLocation.description}${trip.currentLocation.source === 'TRIP_STATUS' ? ' (status based)' : ''}`
      : position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : '—',
    distanceCovered: trip.distance.totalKm != null && trip.distance.remainingKm != null
      ? `${Math.max(0, trip.distance.totalKm - trip.distance.remainingKm).toFixed(1)} km` : '—',
    totalDistance: trip.distance.totalKm == null ? '—' : `${trip.distance.totalKm} km`,
    eta: trip.displayEta || '—',
    nextStop: trip.destination || '—',
    lastUpdate: trip.truck?.displayLastLocationUpdate || (trip.dates.updatedAt ? new Date(trip.dates.updatedAt).toLocaleString('en-NG') : '—'),
    engine: '—',
    progress: trip.progressPercent,
    stops: trip.milestones.map((milestone) => ({
      time: milestone.at ? new Date(milestone.at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '—',
      label: milestone.label,
      state: milestone.completed ? 'done' : 'pending',
    })),
    position,
    driverId: trip.driverId,
  };
}

function downloadCsv(csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `trips-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function apiErrorMessage(error, fallback) {
  const detail = error?.data?.message || error?.data?.error || error?.message || error?.error;
  return Array.isArray(detail) ? detail.join(', ') : typeof detail === 'string' && detail.trim() ? detail : fallback;
}

export function LiveTracking() {
  const [page, setPage] = useState(1);
  const [loadedTrips, setLoadedTrips] = useState([]);
  const [refreshingTrips, setRefreshingTrips] = useState(false);
  const filterVersion = useRef(0);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [q, setQ] = useState('');
  const {
    currentData: tripsResponse,
    isLoading: tripsLoading,
    isFetching: tripsFetching,
    error: tripsError,
  } = useGetAdminTripsQuery({
    page, limit: 100, statusFilter: STATUS_FILTERS[statusFilter], search: q.trim() || undefined,
  }, { pollingInterval: 30000 });
  const [fetchTripsPage] = useLazyGetAdminTripsQuery();
  const { currentData: statsResponse, refetch: refetchStats } = useGetAdminTripStatsQuery(undefined, { pollingInterval: 30000 });
  const { currentData: assignedCountResponse, refetch: refetchAssignedCount } = useGetAdminTripsQuery({ page: 1, limit: 1, statusFilter: 'assigned' }, { pollingInterval: 30000 });
  const { currentData: completedCountResponse, refetch: refetchCompletedCount } = useGetAdminTripsQuery({ page: 1, limit: 1, statusFilter: 'completed' }, { pollingInterval: 30000 });
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
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
  const { currentData: selectedDetail, refetch: refetchSelectedDetail } = useGetAdminTripDetailQuery(selectedId, {
    skip: !selectedId,
    pollingInterval: 30000,
  });
  const [messageDriver, { isLoading: sendingMessage }] = useMessageAdminTripDriverMutation();
  const [exportTripsCsv, { isFetching: exportingTrips }] = useLazyExportAdminTripsQuery();

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);
  function notify(tone, title) { setToast({ tone, title }); }

  useEffect(() => {
    filterVersion.current += 1;
    setPage(1);
    setVisibleCount(6);
    setLoadedTrips([]);
  }, [statusFilter, q]);
  useEffect(() => {
    if (!tripsResponse) return;
    setLoadedTrips((previous) => page === 1 ? tripsResponse.rows : [
      ...new Map([...previous, ...tripsResponse.rows].map((trip) => [trip.id, trip])).values(),
    ]);
  }, [tripsResponse, page]);

  const trackedTrips = useMemo(() => loadedTrips.map(mapApiTrip), [loadedTrips]);

  useEffect(() => {
    if (selectedId && trackedTrips.length && !trackedTrips.some((trip) => trip.id === selectedId)) {
      setSelectedId(trackedTrips[0].id);
    }
  }, [selectedId, trackedTrips]);

  const filtered = useMemo(() => trackedTrips.filter((trip) => statusFilter === 'All Status'
    ? !['Delivered', 'Disputed'].includes(trip.status) : trip.status === statusFilter), [statusFilter, trackedTrips]);
  const visible = filtered.slice(0, visibleCount);
  const selectedLiveTrip = useMemo(() => selectedId && selectedDetail?.id === selectedId
    ? mapApiTrip(selectedDetail) : null, [selectedId, selectedDetail]);
  const selected = selectedId
    ? (selectedLiveTrip || trackedTrips.find((t) => t.id === selectedId) || null)
    : null;
  const mapPoints = useMemo(() => {
    const points = filtered.filter((trip) => trip.position && trip.id !== selectedLiveTrip?.id).map((trip) => ({
      ...trip.position,
      title: `${trip.truck} · ${trip.from} → ${trip.to}`,
      color: trip.statusColor || '#2563eb',
      opportunityId: trip.id,
    }));
    if (selectedLiveTrip?.position) points.push({
      ...selectedLiveTrip.position,
      title: `${selectedLiveTrip.truck} · ${selectedLiveTrip.from} → ${selectedLiveTrip.to}`,
      color: selectedLiveTrip.statusColor || '#2563eb',
      opportunityId: selectedLiveTrip.id,
    });
    return points;
  }, [filtered, selectedLiveTrip]);
  const count = (key) => statsResponse?.cards[key]?.value;
  const assignedCount = assignedCountResponse?.pagination.total;
  const activeCount = [assignedCount, count('inTransit'), count('atPickup'), count('atDelivery'), count('returningContainer')]
    .every((value) => typeof value === 'number')
    ? assignedCount + count('inTransit') + count('atPickup') + count('atDelivery') + count('returningContainer') : null;
  const overview = [
    { label: 'Assigned', value: assignedCount, color: STATUS_COLOR.Assigned },
    { label: 'In Transit', value: count('inTransit'), color: STATUS_COLOR['In Transit'] },
    { label: 'At Pickup', value: count('atPickup'), color: STATUS_COLOR['At Pickup'] },
    { label: 'At Delivery', value: count('atDelivery'), color: STATUS_COLOR['At Delivery'] },
    { label: 'Returning Container', value: count('returningContainer'), color: 'var(--tk-teal)' },
  ].filter((item) => typeof item.value === 'number').map((item) => ({
    ...item, pct: activeCount ? Math.round((item.value / activeCount) * 100) : 0,
  }));
  const hasMorePages = page < (tripsResponse?.pagination.totalPages || 1);

  async function refreshTracking() {
    if (refreshingTrips) return;
    const currentFilterVersion = filterVersion.current;
    setRefreshingTrips(true);
    try {
      const refreshed = [];
      for (let nextPage = 1; nextPage <= page; nextPage += 1) {
        const response = await fetchTripsPage({
          page: nextPage, limit: 100, statusFilter: STATUS_FILTERS[statusFilter], search: q.trim() || undefined,
        }, false).unwrap();
        refreshed.push(...response.rows);
        if (nextPage >= response.pagination.totalPages) break;
      }
      if (currentFilterVersion === filterVersion.current) {
        setLoadedTrips([...new Map(refreshed.map((trip) => [trip.id, trip])).values()]);
      }
      await Promise.allSettled([
        refetchStats(), refetchAssignedCount(), refetchCompletedCount(),
        ...(selectedId ? [refetchSelectedDetail()] : []),
      ]);
      if (currentFilterVersion === filterVersion.current) notify('success', 'Trip locations refreshed.');
    } catch (error) {
      notify('danger', apiErrorMessage(error, 'Unable to refresh trip locations.'));
    } finally {
      setRefreshingTrips(false);
    }
  }

  async function runQuickAction(label) {
    if (label === 'Zoom to Fit') { setFitVersion((version) => version + 1); notify(mapPoints.length ? 'success' : 'warning', mapPoints.length ? 'Map zoomed to fit available truck positions.' : 'No truck GPS positions are available.'); }
    else if (label === 'Refresh') await refreshTracking();
    else if (label === 'Create Geofence') setGeofenceOpen(true);
    else if (label === 'Send Message') { if (selected?.driverId) setMessageOpen(true); else notify('warning', 'Select a trip with an assigned driver first.'); }
    else if (label === 'Export Tracking') {
      try {
        downloadCsv(await exportTripsCsv({ statusFilter: STATUS_FILTERS[statusFilter], search: q.trim() || undefined }).unwrap());
        notify('success', 'Trips CSV exported.');
      } catch (error) { notify('danger', apiErrorMessage(error, 'Unable to export trips.')); }
    }
    else if (label === 'Share Location') notify('warning', 'A shareable live location link is not available from the Trips API.');
    else if (label === 'Traffic View') { setShowTraffic((s) => !s); notify('info', `Traffic view ${showTraffic ? 'hidden' : 'shown'}.`); }
    else if (label === 'Heat Map') notify('warning', 'Heat map data is not available from the Trips API.');
  }

  async function sendDriverMessage() {
    if (!selected?.driverId || !message.trim() || sendingMessage) return;
    try {
      await messageDriver({ id: selected.id, message }).unwrap();
      setMessageOpen(false);
      setMessage('');
      notify('success', 'Message sent to driver.');
    } catch (error) {
      notify('danger', apiErrorMessage(error, 'Unable to message the driver.'));
    }
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
            if (['Trips', 'Clusters', 'Geofences'].includes(l)) {
              notify('warning', `${l} map data is not available from the Trips API.`);
              return;
            }
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
            <FilterSelect label={statusFilter === 'All Status' ? 'All Status' : statusFilter} active={statusFilter !== 'All Status'} onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')} />
            {openFilter === 'status' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={180} items={['All Status', ...STATUSES].map((s) => ({ label: s, icon: s === statusFilter ? 'check' : undefined, onClick: () => { setStatusFilter(s); setOpenFilter(null); } }))} />
              </span>
            )}
          </span>
          {[['In Transit', count('inTransit')], ['At Pickup', count('atPickup')], ['Delivered', completedCountResponse?.pagination.total], ['Delayed', count('delayed')]].map(([s, n]) => (
            <button key={s} className={'lt-pill' + (statusFilter === s ? ' active' : '')}
              style={{ color: statusFilter === s ? STATUS_COLOR[s] : undefined }}
              onClick={() => setStatusFilter(statusFilter === s ? 'All Status' : s)}>
              <span className="dot" style={{ background: STATUS_COLOR[s] }} />{s}　<b>{n ?? '—'}</b>
            </button>
          ))}
          <span style={{ position: 'relative' }}>
            <Button variant="outline" icon="list-filter" iconRight="chevron-down" onClick={() => setOpenFilter(openFilter === 'quick' ? null : 'quick')}>Filters</Button>
            {openFilter === 'quick' && (
              <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={[
                  { section: 'QUICK FILTERS' },
                  { label: 'Speeding Trucks', icon: 'gauge', onClick: () => { setOpenFilter(null); notify('warning', 'Truck speed is not available from the Trips API.'); } },
                  { label: 'Long Stops', icon: 'clock', onClick: () => { setOpenFilter(null); notify('warning', 'Stop duration is not available from the Trips API.'); } },
                  { label: 'Reset Filters', icon: 'rotate-cw', onClick: () => { setStatusFilter('All Status'); setQ(''); setOpenFilter(null); } },
                ]} />
              </span>
            )}
          </span>
          <Button variant="outline" icon="maximize" onClick={() => setFullScreen(true)}>Full Screen</Button>
        </div>
      </div>

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {tripsLoading && <Banner tone="info" title="Loading trips…" />}
      {(tripsFetching || refreshingTrips) && !tripsLoading && <Banner tone="info" title="Refreshing trips" />}
      {tripsError && <Banner tone="warning" title="Live trip data is unavailable">The tracking map can only plot coordinates returned by GET /api/v1/admin/trips.</Banner>}

      <div className="lt-main">
        <SectionCard title={statusFilter === 'All Status' && !q ? `Active Trips (${activeCount ?? '—'})` : `Trips (${tripsResponse?.pagination.total ?? '—'})`} pad="tight">
          <SearchField placeholder="Search trips, truck no. or driver..." value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
          <Tabs value={['Delivered', 'Assigned', 'At Delivery'].includes(statusFilter) ? 'All Status' : statusFilter}
            onChange={setStatusFilter}
            items={[{ value: 'All Status', label: 'All' }, { value: 'In Transit', label: 'In Transit', count: count('inTransit') }, { value: 'At Pickup', label: 'At Pickup' }, { value: 'Delayed', label: 'Delayed' }]}
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
          {(visibleCount < filtered.length || hasMorePages) && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}><a style={{ cursor: 'pointer' }} onClick={() => {
              setVisibleCount((value) => value + 6);
              if (visibleCount >= filtered.length && hasMorePages) setPage((value) => value + 1);
            }}>Load more ⌄</a></div>
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
                  ? <span className="tk-meta">Trip progress is unavailable.</span>
                  : <ProgressBar value={selected.progress} label="Trip Progress" caption={`${selected.progress}%`} color="var(--tk-blue)" />}
                <div style={{ marginTop: 10 }}>
                  {selected.stops.length === 0 && <span className="tk-meta">No trip milestones are available.</span>}
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
              <button key={a.label} className="lt-quick-item"
                disabled={(a.label === 'Refresh' && refreshingTrips) || (a.label === 'Export Tracking' && exportingTrips)}
                onClick={() => void runQuickAction(a.label)}>
                <Icon name={a.icon} size={18} color="var(--tk-blue)" /><span>{a.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="lt-bottom">
        <SectionCard title="Live Overview">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 14 }}>
            <DonutChart size={140} thickness={18} centerValue={activeCount ?? '—'} centerLabel="Active Trips" data={overview} />
            <div style={{ width: '100%', display: 'grid', gap: 8 }}>
              {overview.map((o) => (
                <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: o.color, flex: '0 0 auto' }} />
                  <span style={{ flex: 1, font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{o.label}</span>
                  <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{o.value} ({o.pct}%)</strong>
                </div>
              ))}
            </div>
            <span className="tk-meta">Delayed: {count('delayed') ?? '—'} trips (included in the segments above)</span>
          </div>
        </SectionCard>

        <SectionCard title="Alerts">
          <span className="tk-meta">Tracking alerts are unavailable from the current Trips API.</span>
        </SectionCard>

        <SectionCard title="Top Delays">
          <span className="tk-meta">Route delay rankings are unavailable from the current Trips API.</span>
        </SectionCard>
      </div>

      <Modal open={fullScreen} onClose={() => setFullScreen(false)} title="Live Tracking — Full Screen" width={1100}>
        {mapContent(true)}
      </Modal>

      <Modal open={messageOpen} onClose={() => setMessageOpen(false)} title="Send Message" description={selected ? `To ${selected.driver} · ${selected.id}` : ''}
        footer={<><Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
          <Button icon="send" disabled={!message.trim() || sendingMessage} onClick={() => void sendDriverMessage()}>{sendingMessage ? 'Sending…' : 'Send Message'}</Button></>}>
        <Textarea label="Message" rows={5} maxLength={2000} placeholder="Write a message to the driver..." value={message} onChange={(e) => setMessage(e.target.value)} />
      </Modal>

      <Modal open={geofenceOpen} onClose={() => setGeofenceOpen(false)} title="Create Geofence" description="Draw a boundary around a location to get alerts when trucks enter or exit."
        footer={<><Button variant="outline" onClick={() => setGeofenceOpen(false)}>Close</Button><Button icon="shield" disabled>Create Geofence</Button></>}>
        <div style={{ height: 200, borderRadius: 10, border: '1.5px dashed var(--tk-line-strong)', background: 'var(--tk-surface-sunk)', display: 'grid', placeItems: 'center', gap: 8, textAlign: 'center', color: 'var(--tk-ink-300)' }}>
          <Icon name="shield" size={28} />
          <span className="tk-meta">The Trips API has no geofence create endpoint yet.</span>
        </div>
      </Modal>
    </>
  );
}
