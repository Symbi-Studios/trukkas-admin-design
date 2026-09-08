'use client';

import { useMemo, useState } from 'react';
import {
  PageHeader, FilterSelect, DropdownMenu, StatCard, SectionCard, MapPanel, DataTable, Badge,
  Button, Switch, Tooltip, Modal, LabelValue, Banner, Icon,
} from '../ds.js';
import './ContainerTriangulation.css';

const CITIES = [
  { label: 'Lagos', left: 14, top: 69, size: 12 }, { label: 'Ibadan', left: 17, top: 63 },
  { label: 'Abeokuta', left: 10, top: 51 }, { label: 'Benin City', left: 35, top: 73 },
  { label: 'Port Harcourt', left: 48, top: 92 }, { label: 'Enugu', left: 51, top: 72 },
  { label: 'Abuja', left: 49, top: 51 }, { label: 'Kaduna', left: 52, top: 24 },
  { label: 'Kano', left: 65, top: 9, size: 12 }, { label: 'Jos', left: 73, top: 29 },
  { label: 'Maiduguri', left: 93, top: 18 },
];
const LANDMASS = '6.6% 11.2%,32.8% 3.7%,60.1% 1.9%,82% 7.5%,94% 20.6%,96.2% 46.7%,92.9% 71%,85.2% 87.9%,71% 93.5%,60.1% 89.7%,49.2% 86%,38.3% 80.4%,27.3% 74.8%,16.4% 76.6%,8.7% 71%,6.6% 59.8%,4.4% 37.4%';
const WATER = '0% 60%,6.6% 59.8%,8.7% 71%,16.4% 76.6%,27.3% 74.8%,30% 86%,22% 100%,0% 100%';

const ROUTES = [
  { points: '13,71 19,71 36,65 46,48', color: 'var(--tk-blue)' },
  { points: '46,48 52,24 65,9', color: 'var(--tk-success)' },
  { points: '46,48 17,63', color: 'var(--tk-warning)', dashed: true },
  { points: '46,48 51,72', color: 'var(--tk-warning)', dashed: true },
];
const MARKERS = [
  { id: 'm1', left: 13, top: 71, color: 'var(--tk-blue)', truck: true, label: 'Loaded (On Trip)' },
  { id: 'm2', left: 52, top: 24, color: 'var(--tk-success)', truck: true, label: 'Empty (Available)' },
  { id: 'm3', left: 65, top: 9, color: 'var(--tk-purple)', truck: true, label: 'In Transit' },
  { id: 'm4', left: 17, top: 63, color: 'var(--tk-warning)', truck: false, label: 'Matched Opportunity' },
  { id: 'm5', left: 51, top: 72, color: 'var(--tk-warning)', truck: false, label: 'Matched Opportunity' },
];
const LEGEND = [
  { label: 'Loaded (On Trip)', color: 'var(--tk-blue)' }, { label: 'Empty (Available)', color: 'var(--tk-success)' },
  { label: 'Matched Opportunity', color: 'var(--tk-warning)' }, { label: 'In Transit', color: 'var(--tk-purple)' },
  { label: 'Maintenance', color: 'var(--tk-danger)' },
];

// "Triangulation Opportunities" and "Suggested Triangulation Chains" were two panels showing the
// same idea (a suggested next route for idle capacity) — a single leg vs. several chained legs.
// Merged into one list; `stops` tells them apart and drives which action (Assign vs Review) shows.
const OPPORTUNITIES = [
  { id: 'TRK-2026-0124', kind: 'match', container: 'CONT-CLU-8921', size: '40ft High Cube', location: 'Kano', route: 'Kano → Lagos', detail: 'Arrives Today 14:30', cargo: 'Steel Pipes', stops: 2, score: 98, revenue: 850000 },
  { id: 'TRK-2026-0087', kind: 'match', container: 'CONT-MAU-4452', size: '20ft Standard', location: 'Kaduna', route: 'Kaduna → Onne', detail: 'Arrives Today 16:10', cargo: 'Machinery', stops: 2, score: 94, revenue: 640000 },
  { id: 'TRK-2026-0033', kind: 'match', container: 'CONT-TCLU-7710', size: '40ft High Cube', location: 'Abuja', route: 'Abuja → Ibadan', detail: 'Arrives Today 18:45', cargo: 'Cement Bags', stops: 2, score: 91, revenue: 520000 },
  { id: 'CH-2026-001', kind: 'chain', route: 'Lagos → Kano → Kaduna → Lagos', detail: '2,480 km · 4.2 days', stops: 4, score: 92, revenue: 2150000 },
  { id: 'TRK-2026-0041', kind: 'match', container: 'CONT-APZU-2291', size: '40ft High Cube', location: 'Port Harcourt', route: 'Port Harcourt → Lagos', detail: 'Arrives Tomorrow 09:20', cargo: 'General Goods', stops: 2, score: 89, revenue: 760000 },
  { id: 'CH-2026-002', kind: 'chain', route: 'Onne → Abuja → Kaduna → Onne', detail: '2,260 km · 4.0 days', stops: 4, score: 87, revenue: 1980000 },
  { id: 'TRK-2026-0099', kind: 'match', container: 'CONT-CMAU-1182', size: '20ft Standard', location: 'Ibadan', route: 'Ibadan → Kano', detail: 'Arrives Tomorrow 11:00', cargo: 'Plastic Raw Material', stops: 2, score: 86, revenue: 580000 },
  { id: 'CH-2026-003', kind: 'chain', route: 'Port Harcourt → Enugu → Onitsha → Lagos', detail: '1,950 km · 3.8 days', stops: 4, score: 83, revenue: 1650000 },
];

const INITIAL_RECENT = [
  { id: 'r1', on: 'Aug 4, 2026 10:15 AM', truck: 'TRK-2026-0124', route: 'Kano → Lagos', status: 'Assigned', revenue: 850000 },
  { id: 'r2', on: 'Aug 4, 2026 09:42 AM', truck: 'TRK-2026-0087', route: 'Kaduna → Onne', status: 'Accepted', revenue: 640000 },
  { id: 'r3', on: 'Aug 4, 2026 08:21 AM', truck: 'TRK-2026-0033', route: 'Abuja → Ibadan', status: 'In Transit', revenue: 520000 },
  { id: 'r4', on: 'Aug 3, 2026 06:10 PM', truck: 'TRK-2026-0041', route: 'PH → Lagos', status: 'Delivered', revenue: 760000 },
  { id: 'r5', on: 'Aug 3, 2026 02:05 PM', truck: 'TRK-2026-0099', route: 'Ibadan → Kano', status: 'Delivered', revenue: 480000 },
  { id: 'r6', on: 'Aug 2, 2026 11:30 AM', truck: 'CH-2026-004', route: 'Enugu → Onitsha → Lagos', status: 'Delivered', revenue: 1420000 },
];
const RECENT_TONE = { Assigned: 'info', Accepted: 'purple', 'In Transit': 'success', Delivered: 'teal' };

const LOCATIONS = ['Lagos', 'Kano', 'Kaduna', 'Abuja', 'Ibadan', 'Port Harcourt', 'Onne'];
const ROUTE_FILTERS = ['Kano → Lagos', 'Kaduna → Onne', 'Abuja → Ibadan', 'Port Harcourt → Lagos'];
const CONTAINER_TYPES = ['20ft Standard', '40ft High Cube'];
const DATE_FILTERS = ['Today', 'Tomorrow', 'This Week'];
const TRUCK_TYPES = ['Flatbed', 'Box Truck', 'Reefer', 'Tanker'];
const SORTS = ['Best Match', 'Highest Revenue', 'Most Stops'];
const naira = (n) => `₦${n.toLocaleString('en-NG')}`;

function ScoreRing({ value }) {
  const size = 46, thickness = 4, r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const len = (value / 100) * c;
  const color = value >= 90 ? 'var(--tk-success)' : value >= 75 ? 'var(--tk-warning)' : 'var(--tk-danger)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tk-viz-track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${len} ${c - len}`} strokeLinecap="round" />
      </g>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ font: '700 12px var(--tk-font-sans)', fill: 'var(--tk-ink-900)' }}>{value}%</text>
    </svg>
  );
}

function TriMap({ zoom }) {
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${WATER})`, background: '#dbeafe' }} />
      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${LANDMASS})`, background: '#eef1e7', border: '1px solid var(--tk-line-strong)' }} />
      <span style={{ position: 'absolute', left: '54%', top: '58%', transform: 'translate(-50%,-50%)',
                     font: '700 26px var(--tk-font-sans)', color: 'rgba(15,23,42,.10)' }}>Nigeria</span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {ROUTES.map((r, i) => (
          <polyline key={i} points={r.points} fill="none" stroke={r.color} strokeWidth="0.35"
                    strokeDasharray={r.dashed ? '1.4 1.2' : undefined} />
        ))}
      </svg>
      {CITIES.map((c) => (
        <span key={c.label} style={{ position: 'absolute', left: c.left + '%', top: c.top + '%', transform: 'translate(-50%,-50%)',
                                     font: `${c.size === 12 ? 600 : 500} ${c.size || 10}px var(--tk-font-sans)`,
                                     color: 'var(--tk-ink-700)', whiteSpace: 'nowrap' }}>{c.label}</span>
      ))}
      {MARKERS.map((m) => (
        <span key={m.id} style={{ position: 'absolute', left: m.left + '%', top: m.top + '%', transform: 'translate(-50%,-50%)', zIndex: 2 }}
              title={m.label}>
          {m.truck ? (
            <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999,
                           background: m.color, border: '2px solid #fff', boxShadow: 'var(--tk-shadow-card)' }}>
              <Icon name="truck" size={12} color="#fff" />
            </span>
          ) : (
            <span style={{ width: 14, height: 14, borderRadius: 999, background: m.color, border: '2px solid #fff', boxShadow: 'var(--tk-shadow-card)', display: 'block' }} />
          )}
        </span>
      ))}
    </div>
  );
}

export function ContainerTriangulation() {
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [routeFilter, setRouteFilter] = useState('All Routes');
  const [containerFilter, setContainerFilter] = useState('All Container Types');
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [truckFilter, setTruckFilter] = useState('All Truck Types');
  const [openFilter, setOpenFilter] = useState(null);
  const [autoMatch, setAutoMatch] = useState(false);
  const [sort, setSort] = useState('Best Match');
  const [showAllOpps, setShowAllOpps] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [opportunities, setOpportunities] = useState(OPPORTUNITIES);
  const [recent, setRecent] = useState(INITIAL_RECENT);
  const [toast, setToast] = useState(null);

  function notify(tone, title) { setToast({ tone, title }); setTimeout(() => setToast(null), 2800); }

  const filtered = useMemo(() => opportunities.filter((o) =>
    (locationFilter === 'All Locations' || o.location === locationFilter || o.route.startsWith(locationFilter)) &&
    (routeFilter === 'All Routes' || o.route === routeFilter) &&
    (containerFilter === 'All Container Types' || o.size === containerFilter) &&
    (truckFilter === 'All Truck Types')
  ), [opportunities, locationFilter, routeFilter, containerFilter, truckFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) =>
    sort === 'Highest Revenue' ? b.revenue - a.revenue :
    sort === 'Most Stops' ? b.stops - a.stops :
    b.score - a.score
  ), [filtered, sort]);
  const oppRows = showAllOpps ? sorted : sorted.slice(0, 5);
  const recentRows = showAllRecent ? recent : recent.slice(0, 4);

  function resetFilters() {
    setLocationFilter('All Locations'); setRouteFilter('All Routes'); setContainerFilter('All Container Types');
    setDateFilter('All Dates'); setTruckFilter('All Truck Types'); setOpenFilter(null);
  }
  function runEngine() {
    setScanning(true);
    setOpenFilter(null);
    setTimeout(() => { setScanning(false); notify('success', 'Scan complete — 6 new triangulation opportunities found.'); }, 1200);
  }
  function confirmAssign() {
    const o = assignTarget;
    setOpportunities((os) => os.filter((x) => x.id !== o.id));
    setRecent((rs) => [{ id: 'r' + Date.now(), on: 'Just now', truck: o.id, route: o.route, status: 'Assigned', revenue: o.revenue }, ...rs]);
    setAssignTarget(null);
    notify('success', `${o.id} assigned to ${o.route}.`);
  }
  function confirmReview(approve) {
    const o = reviewTarget;
    if (approve) {
      setOpportunities((os) => os.filter((x) => x.id !== o.id));
      setRecent((rs) => [{ id: 'r' + Date.now(), on: 'Just now', truck: o.id, route: o.route, status: 'Assigned', revenue: o.revenue }, ...rs]);
      notify('success', `${o.id} approved and assigned.`);
    } else {
      notify('warning', `${o.id} chain declined.`);
    }
    setReviewTarget(null);
  }

  return (
    <>
      <PageHeader title="Container Triangulation" description="Find return loads and connect multiple legs to maximize truck/container utilization."
        actions={<>
          <Button variant="outline" icon="settings" onClick={() => setRulesOpen(true)}>Triangulation Rules</Button>
          <Button icon="play" disabled={scanning} onClick={runEngine}>{scanning ? 'Scanning…' : 'Run Triangulation Engine'}</Button>
        </>} />

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {autoMatch && <Banner tone="info" title="Auto Match is on" >Opportunities scoring 90% or higher will be assigned automatically as they appear.</Banner>}

      <div className="triangulation-filters">
        {[
          ['location', locationFilter, ['All Locations', ...LOCATIONS], setLocationFilter],
          ['route', routeFilter, ['All Routes', ...ROUTE_FILTERS], setRouteFilter],
          ['container', containerFilter, ['All Container Types', ...CONTAINER_TYPES], setContainerFilter],
          ['date', dateFilter, ['All Dates', ...DATE_FILTERS], setDateFilter],
          ['truck', truckFilter, ['All Truck Types', ...TRUCK_TYPES], setTruckFilter],
        ].map(([key, val, opts, setter]) => (
          <span key={key} style={{ position: 'relative' }}>
            <FilterSelect label={val} active={val !== opts[0]} onClick={() => setOpenFilter(openFilter === key ? null : key)} />
            {openFilter === key && (
              <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
                <DropdownMenu width={200} items={opts.map((o) => ({ label: o, icon: o === val ? 'check' : undefined,
                  onClick: () => { setter(o); setOpenFilter(null); } }))} />
              </span>
            )}
          </span>
        ))}
        <Switch checked={autoMatch} onChange={setAutoMatch} label={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          Auto Match <Tooltip label="Automatically assign high-confidence matches"><Icon name="info" size={13} color="var(--tk-ink-300)" /></Tooltip>
        </span>} />
        <span style={{ flex: 1 }} />
        <span style={{ position: 'relative' }}>
          <Button variant="outline" icon="list-filter" onClick={() => setOpenFilter(openFilter === 'quick' ? null : 'quick')}>Filters</Button>
          {openFilter === 'quick' && (
            <span style={{ position: 'absolute', right: 0, top: 44, zIndex: 30 }}>
              <DropdownMenu width={210} items={[
                { section: 'QUICK FILTERS' },
                { label: 'Chains Only', icon: 'route', onClick: () => { setOpenFilter(null); notify('info', 'Showing multi-leg chains only.'); } },
                { label: '90%+ Match Score', icon: 'target', onClick: () => { setSort('Best Match'); setOpenFilter(null); } },
                { label: 'Reset All Filters', icon: 'rotate-cw', onClick: () => resetFilters() },
              ]} />
            </span>
          )}
        </span>
      </div>

      <div className="triangulation-stats">
        <StatCard icon="truck" tint="blue" label="Available Containers" value="142" caption="Ready for return load" />
        <StatCard icon="route" tint="green" label="Potential Matches" value="68" caption="High quality opportunities" />
        <StatCard icon="percent" tint="amber" label="Potential Revenue" value="₦23.7M" caption="From suggested matches" />
        <StatCard icon="repeat" tint="purple" label="Empty KM Reduced" value="4,892 km" caption="Equivalent to 18.7%" />
        <StatCard icon="user-check" tint="navy" label="Match Success Rate" value="76%" caption="Last 30 days" />
      </div>

      <div className="triangulation-main">
        <MapPanel title="Truck & Container Positions" status="Live" height={480} onExpand={() => setMapExpanded(true)} legend={LEGEND}>
          <TriMap zoom={zoom} />
          <div className="tri-map-controls">
            <button onClick={() => setZoom((z) => Math.min(z + 20, 180))}>+</button>
            <button onClick={() => setZoom((z) => Math.max(z - 20, 60))}>−</button>
          </div>
        </MapPanel>

        <SectionCard title="Triangulation Opportunities" count={filtered.length}
          action={<span style={{ position: 'relative' }}>
            <FilterSelect label={'Sort by: ' + sort} active={false} onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} />
            {openFilter === 'sort' && (
              <span style={{ position: 'absolute', right: 0, top: 40, zIndex: 30 }}>
                <DropdownMenu width={180} items={SORTS.map((s) => ({ label: s, icon: s === sort ? 'check' : undefined,
                  onClick: () => { setSort(s); setOpenFilter(null); } }))} />
              </span>
            )}
          </span>} pad="none">
          <DataTable rows={oppRows} rowKey={(r) => r.id}
            columns={[
              { key: 'id', header: 'Truck / Container', render: (r) => (
                <span style={{ display: 'grid', gap: 2 }}>
                  <strong style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.id}</strong>
                  <span className="tk-meta">{r.kind === 'chain' ? `${r.stops} stops` : `${r.container} · ${r.size}`}</span>
                </span>) },
              { key: 'route', header: 'Suggested Route', render: (r) => (
                <span style={{ display: 'grid', gap: 2 }}>
                  <strong style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.route}</strong>
                  <span className="tk-meta">{r.kind === 'chain' ? r.detail : `${r.cargo} · ${r.detail}`}</span>
                </span>) },
              { key: 'score', header: 'Match Score', align: 'center', render: (r) => <ScoreRing value={r.score} /> },
              { key: 'revenue', header: 'Est. Revenue', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.revenue)}</strong> },
              { key: 'action', header: 'Action', render: (r) => (
                <span style={{ display: 'grid', gap: 6 }}>
                  {r.kind === 'chain'
                    ? <Button size="sm" onClick={() => setReviewTarget(r)}>Review</Button>
                    : <Button size="sm" onClick={() => setAssignTarget(r)}>Assign</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setViewTarget(r)}>View</Button>
                </span>) },
            ]} />
          {sorted.length === 0 && <div style={{ padding: '32px 20px', textAlign: 'center' }} className="tk-meta">No opportunities match the current filters.</div>}
          {sorted.length > 5 && (
            <div style={{ textAlign: 'center', padding: '14px' }}>
              <a onClick={() => setShowAllOpps((s) => !s)} style={{ cursor: 'pointer' }}>{showAllOpps ? 'Show fewer' : 'View all opportunities'}</a>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Matches" pad="none">
        <DataTable rows={recentRows} rowKey={(r) => r.id} onRowClick={(r) => setViewTarget({ id: r.truck, route: r.route, revenue: r.revenue, kind: 'match', detail: r.on, stops: 2 })}
          columns={[
            { key: 'on', header: 'Matched On' },
            { key: 'truck', header: 'Truck / Container', render: (r) => <span style={{ color: 'var(--tk-blue)', fontWeight: 600 }}>{r.truck}</span> },
            { key: 'route', header: 'Matched Route' },
            { key: 'status', header: 'Status', render: (r) => <Badge tone={RECENT_TONE[r.status]}>{r.status}</Badge> },
            { key: 'revenue', header: 'Revenue', render: (r) => <strong style={{ color: 'var(--tk-ink-900)' }}>{naira(r.revenue)}</strong> },
          ]} />
        <div style={{ textAlign: 'center', padding: '14px' }}>
          <a onClick={() => setShowAllRecent((s) => !s)} style={{ cursor: 'pointer' }}>{showAllRecent ? 'Show fewer' : 'View all matches'}</a>
        </div>
      </SectionCard>

      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign Opportunity"
        description={assignTarget ? `Assign ${assignTarget.id} to ${assignTarget.route}?` : ''}
        footer={<><Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button><Button icon="check" onClick={confirmAssign}>Confirm Assignment</Button></>}>
        {assignTarget && <span className="tk-meta">Estimated revenue {naira(assignTarget.revenue)} at a {assignTarget.score}% match score. This will notify the driver and update the trip plan.</span>}
      </Modal>

      <Modal open={!!reviewTarget} onClose={() => setReviewTarget(null)} title={reviewTarget?.id} description={reviewTarget ? `${reviewTarget.stops}-stop chain · ${reviewTarget.detail}` : ''}
        footer={<><Button variant="outline" onClick={() => confirmReview(false)}>Decline</Button><Button icon="check" onClick={() => confirmReview(true)}>Approve Chain</Button></>}>
        {reviewTarget && (
          <div style={{ display: 'grid', gap: 4 }}>
            {reviewTarget.route.split(' → ').map((stop, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span className="segment-number" style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--tk-purple)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11 }}>{i + 1}</span>
                <strong style={{ color: 'var(--tk-ink-900)' }}>{stop}</strong>
              </div>
            ))}
            <LabelValue label="Est. Revenue" value={naira(reviewTarget.revenue)} valueTone="var(--tk-success)" />
            <LabelValue label="Match Score" value={reviewTarget.score + '%'} />
          </div>
        )}
      </Modal>

      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title={viewTarget?.id} description="Opportunity details" width={480}>
        {viewTarget && (
          <div style={{ display: 'grid' }}>
            <LabelValue label="Route" value={viewTarget.route} />
            <LabelValue label="Detail" value={viewTarget.detail} />
            {viewTarget.container && <LabelValue label="Container" value={`${viewTarget.container} · ${viewTarget.size}`} />}
            {viewTarget.cargo && <LabelValue label="Cargo" value={viewTarget.cargo} />}
            <LabelValue label="Stops" value={viewTarget.stops} />
            <LabelValue label="Est. Revenue" value={naira(viewTarget.revenue)} valueTone="var(--tk-success)" />
          </div>
        )}
      </Modal>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Triangulation Rules" description="Thresholds used to surface and auto-match opportunities."
        footer={<Button onClick={() => { setRulesOpen(false); notify('success', 'Triangulation rules saved.'); }}>Save Rules</Button>}>
        <div style={{ display: 'grid' }}>
          <LabelValue label="Minimum match score" value="75%" />
          <LabelValue label="Maximum detour distance" value="120 km" />
          <LabelValue label="Maximum chain length" value="4 stops" />
          <LabelValue label="Auto-assign threshold" value="90%+" />
        </div>
      </Modal>

      <Modal open={mapExpanded} onClose={() => setMapExpanded(false)} title="Truck & Container Positions" width={860}>
        <div style={{ position: 'relative', height: 520, borderRadius: 'var(--tk-r-lg)', overflow: 'hidden', background: 'var(--tk-surface-sunk)' }}>
          <TriMap zoom={100} />
        </div>
      </Modal>
    </>
  );
}
