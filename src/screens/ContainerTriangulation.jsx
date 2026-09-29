'use client';

import { useMemo, useState } from 'react';
import { useNavigate } from '../router.js';
import {
  PageHeader, FilterSelect, DropdownMenu, StatCard, SectionCard, MapPanel,
  DataTable, Badge, Button, Modal, Banner, Pagination, SkeletonRow, LabelValue,
} from '../ds.js';
import {
  useGetAdminTriangulationOpportunitiesQuery,
  useNotifyAdminTriangulationMatchMutation,
} from '../store/features/triangulation/triangulationApi.js';
import { TriangulationGoogleMap } from './TriangulationGoogleMap.jsx';
import './ContainerTriangulation.css';

const PAGE_SIZE = 20;
const naira = (value) => typeof value === 'number' ? `₦${value.toLocaleString('en-NG')}` : '—';
const count = (value) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-NG') : '—';
function summaryNumber(summary, ...keys) {
  for (const key of keys) {
    if (summary?.[key] != null && Number.isFinite(Number(summary[key]))) return Number(summary[key]);
  }
  return null;
}
function requestError(error) {
  const message = error?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join(' ');
  return error?.status === 403 ? 'Your account cannot access triangulation.' : 'The request could not be completed.';
}

function ScoreRing({ value }) {
  if (value == null) return <span className="tk-meta">—</span>;
  const score = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 21;
  const color = score >= 90 ? 'var(--tk-success)' : score >= 75 ? 'var(--tk-warning)' : 'var(--tk-danger)';
  return <svg width="46" height="46" viewBox="0 0 46 46" role="img" aria-label={`${score}% match score`}>
    <g transform="rotate(-90 23 23)">
      <circle cx="23" cy="23" r="21" fill="none" stroke="var(--tk-viz-track)" strokeWidth="4" />
      <circle cx="23" cy="23" r="21" fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${score / 100 * circumference} ${circumference}`} strokeLinecap="round" />
    </g>
    <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
      style={{ font: '700 12px var(--tk-font-sans)', fill: 'var(--tk-ink-900)' }}>{score}%</text>
  </svg>;
}

const filterOptions = (rows, field, label) => [label, ...new Set(rows.map((row) => row[field]).filter(Boolean))];
function inDateRange(value, filter) {
  if (filter === 'All Dates') return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  const days = filter === 'Today' ? 1 : filter === 'Last 7 days' ? 7 : 30;
  return Date.now() - time <= days * 86400000;
}

export function ContainerTriangulation() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    location: 'All Locations', route: 'All Routes', container: 'All Container Types',
    date: 'All Dates', company: 'All Companies', truck: 'All Truck Types',
  });
  const [openFilter, setOpenFilter] = useState(null);
  const [sort, setSort] = useState('Best Match');
  const [radiusKm, setRadiusKm] = useState(150);
  const [selectedId, setSelectedId] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState(null);
  const [notice, setNotice] = useState(null);
  const [notifyCompany, { isLoading: notifying }] = useNotifyAdminTriangulationMatchMutation();
  const { currentData: response, isLoading, isFetching, error, refetch } =
    useGetAdminTriangulationOpportunitiesQuery({ page, limit: PAGE_SIZE, radiusKm });
  const rows = response?.rows || [];
  const summary = response?.summary;
  const loadingRows = isLoading || (isFetching && !response);

  const options = useMemo(() => ({
    location: filterOptions(rows, 'pickupLocation', 'All Locations'),
    route: filterOptions(rows, 'currentRoute', 'All Routes'),
    container: filterOptions(rows, 'container', 'All Container Types'),
    date: rows.some((row) => row.identifiedAt) ? ['All Dates', 'Today', 'Last 7 days', 'Last 30 days'] : ['All Dates'],
    company: filterOptions(rows, 'company', 'All Companies'),
    truck: filterOptions(rows, 'truckType', 'All Truck Types'),
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) =>
    (filters.location === 'All Locations' || row.pickupLocation === filters.location) &&
    (filters.route === 'All Routes' || row.currentRoute === filters.route) &&
    (filters.container === 'All Container Types' || row.container === filters.container) &&
    (filters.company === 'All Companies' || row.company === filters.company) &&
    (filters.truck === 'All Truck Types' || row.truckType === filters.truck) &&
    inDateRange(row.identifiedAt, filters.date)
  ), [rows, filters]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => sort === 'Highest Revenue'
    ? (b.revenue ?? -1) - (a.revenue ?? -1) : (b.score ?? -1) - (a.score ?? -1)), [filtered, sort]);
  const mapPoints = useMemo(() => rows.flatMap((row) => [
    row.position && { ...row.position, title: `${row.currentJobNumber || 'Finishing job'} delivery`, color: '#2563eb', opportunityId: row.id },
    row.pickupPosition && { ...row.pickupPosition, title: `${row.jobId || 'Matched job'} pickup`, color: '#f59e0b', opportunityId: row.id },
  ].filter(Boolean)), [rows]);
  const openDetail = (row) => navigate(`/triangulation/detail?opportunityId=${encodeURIComponent(row.id)}&page=${page}&radiusKm=${radiusKm}`);

  async function sendNotification() {
    if (!notifyTarget?.jobId || !notifyTarget?.truckerId || notifying) return;
    try {
      const result = await notifyCompany({ jobId: notifyTarget.jobId, truckerId: notifyTarget.truckerId }).unwrap();
      setNotice({ tone: 'success', message: result?.message || 'The trucking company was notified about this job.' });
      setNotifyTarget(null);
    } catch (requestFailure) {
      setNotice({ tone: 'danger', message: requestError(requestFailure) });
    }
  }

  const stats = [
    { icon: 'truck', tint: 'blue', label: 'Available Containers', value: count(summaryNumber(summary, 'availableContainers', 'availableTrucks')), caption: 'Trucks/containers available for matching' },
    { icon: 'route', tint: 'green', label: 'Open Opportunities', value: count(summaryNumber(summary, 'openOpportunities', 'totalOpportunities') ?? response?.pagination.total), caption: 'Potential matches across active & upcoming jobs' },
    { icon: 'percent', tint: 'amber', label: 'Potential Revenue', value: naira(summaryNumber(summary, 'potentialRevenue', 'estimatedRevenue')), caption: 'From identified opportunities' },
    { icon: 'repeat', tint: 'purple', label: 'Empty KM Reduced', value: summaryNumber(summary, 'emptyKmAvoidable') == null ? '—' : `${count(summaryNumber(summary, 'emptyKmAvoidable'))} km`, caption: 'Potentially eliminated' },
    { icon: 'layers', tint: 'teal', label: 'Active Hijack opportunities', value: count(summaryNumber(summary, 'activeHijackOpportunities')), caption: 'Trips with viable additional segments' },
    { icon: 'triangle-alert', tint: 'red', label: 'Exceptions', value: count(summaryNumber(summary, 'exceptions')), caption: 'Matches requiring admin attention' },
  ];

  return <>
    <PageHeader title="Triangulation Matching"
      description="Optimize empty capacity by matching trucks, containers and upcoming loads across the Trukkas network."
      actions={<>
        <Button variant="outline" icon="settings" onClick={() => setRulesOpen(true)}>Triangulation Rules</Button>
        <Button icon="play" disabled title="The backend has not exposed a run-engine endpoint.">Run Triangulation Engine</Button>
      </>} />
    {notice && <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.message}</Banner>}
    {isFetching && !isLoading && <Banner tone="info">Refreshing opportunities…</Banner>}

    <div className="triangulation-stats">
      {stats.map((stat) => <StatCard key={stat.label} {...stat} value={isLoading ? '…' : stat.value} />)}
    </div>

    <div className="triangulation-filters">
      {[
        ['location', 'All Locations'], ['route', 'All Routes'], ['container', 'All Container Types'],
        ['date', 'All Dates'], ['company', 'All Companies'], ['truck', 'All Truck Types'],
      ].map(([key, allLabel]) => <span key={key} style={{ position: 'relative' }}>
        <FilterSelect label={filters[key]} active={filters[key] !== allLabel}
          onClick={() => setOpenFilter(openFilter === key ? null : key)} />
        {openFilter === key && <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
          <DropdownMenu width={210} items={options[key].map((option) => ({
            label: option, icon: option === filters[key] ? 'check' : undefined,
            onClick: () => { setFilters((old) => ({ ...old, [key]: option })); setOpenFilter(null); },
          }))} />
        </span>}
      </span>)}
      <span style={{ position: 'relative' }}>
        <FilterSelect label={`Radius: ${radiusKm} km`} active={radiusKm !== 150}
          onClick={() => setOpenFilter(openFilter === 'radius' ? null : 'radius')} />
        {openFilter === 'radius' && <span style={{ position: 'absolute', left: 0, top: 44, zIndex: 30 }}>
          <DropdownMenu width={160} items={[50, 100, 150, 250].map((value) => ({
            label: `${value} km`, icon: value === radiusKm ? 'check' : undefined,
            onClick: () => { setRadiusKm(value); setPage(1); setOpenFilter(null); },
          }))} />
        </span>}
      </span>
    </div>

    <div className="triangulation-main">
      <MapPanel title="Network View" description="Finishing job deliveries and matched job pickups."
        height={480} onExpand={() => setMapExpanded(true)}
        legend={[{ label: 'Finishing delivery', color: '#2563eb' }, { label: 'Matched job pickup', color: '#f59e0b' }]}>
        <TriangulationGoogleMap points={mapPoints} selectedId={selectedId} onSelect={setSelectedId} />
      </MapPanel>

      <SectionCard title="Triangulation Opportunities" description="Identified opportunities for additional load segments."
        count={response?.pagination.total ?? filtered.length} pad="none"
        action={<span style={{ position: 'relative' }}>
          <FilterSelect label={`Sort by: ${sort}`} onClick={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} />
          {openFilter === 'sort' && <span style={{ position: 'absolute', right: 0, top: 40, zIndex: 30 }}>
            <DropdownMenu width={180} items={['Best Match', 'Highest Revenue'].map((value) => ({
              label: value, icon: value === sort ? 'check' : undefined,
              onClick: () => { setSort(value); setOpenFilter(null); },
            }))} />
          </span>}
        </span>}>
        {loadingRows ? <div style={{ padding: '12px 20px' }} role="status" aria-label="Loading triangulation opportunities">
          {Array.from({ length: 5 }, (_, index) => <SkeletonRow key={index} columns={5} />)}
        </div> : error ? <div className="triangulation-message">
          <strong>{error.status === 403 ? 'Access denied' : 'Opportunities unavailable'}</strong>
          <span>{requestError(error)}</span>
          <Button variant="outline" onClick={refetch}>Retry</Button>
        </div> : <>
          <DataTable rows={sorted} rowKey={(row) => row.id} onRowClick={openDetail} columns={[
            { key: 'truck', header: 'Truck / Container', render: (row) => <span className="triangulation-cell"><strong>{row.truckPlate || '—'}</strong><small>{row.containerNumber || row.container || '—'}</small></span> },
            { key: 'current', header: 'Current Route', render: (row) => <span className="triangulation-cell"><strong>{row.currentRoute || '—'}</strong><small>{row.currentEta || '—'}</small></span> },
            { key: 'proposed', header: 'Proposed Next Segment', render: (row) => <span className="triangulation-cell"><strong>{row.proposedRoute || '—'}</strong><small>{[row.proposedCargo, row.container].filter(Boolean).join(' · ') || '—'}</small></span> },
            { key: 'score', header: 'Match Score', align: 'center', render: (row) => <ScoreRing value={row.score} /> },
            { key: 'revenue', header: 'Est. Revenue', render: (row) => <strong>{naira(row.revenue)}</strong> },
            { key: 'status', header: 'Status', render: (row) => row.status ? <Badge tone="info">{row.status}</Badge> : '—' },
            { key: 'action', header: 'Action', render: (row) => <span className="triangulation-row-actions">
              <Button size="sm" onClick={(event) => { event.stopPropagation(); openDetail(row); }}>View</Button>
              <Button size="sm" variant="outline" disabled={!row.jobId || !row.truckerId}
                title={!row.jobId || !row.truckerId ? 'This match needs jobId and truckerId from the API.' : undefined}
                onClick={(event) => { event.stopPropagation(); setNotifyTarget(row); }}>Notify Company</Button>
            </span> },
          ]} />
          {sorted.length === 0 && <div className="triangulation-message">No opportunities match the current filters.</div>}
          <Pagination page={response?.pagination.page || page} pageCount={Math.max(1, response?.pagination.totalPages || 1)}
            pageSize={response?.pagination.limit || PAGE_SIZE} total={response?.pagination.total || 0}
            onPage={(next) => setPage(next)} />
        </>}
      </SectionCard>
    </div>

    <div className="triangulation-activity-row">
      <SectionCard title="Recent Triangulation Activity" pad="none">
        <DataTable rows={[]} coloredHeader columns={[
          { key: 'on', header: 'Date & Time' },
          { key: 'triangulationId', header: 'Triangulation ID' },
          { key: 'truck', header: 'Truck / Company' },
          { key: 'route', header: 'Matched Route' },
          { key: 'hijackRoute', header: 'Hijack Route' },
          { key: 'revenue', header: 'Revenue' },
          { key: 'emptyKm', header: 'Empty KM avoided' },
          { key: 'status', header: 'Status' },
        ]} />
        <div className="triangulation-message">Recent assignments and their outcomes need an activity endpoint.</div>
      </SectionCard>
      <SectionCard title="Triangulation Impact">
        <div className="triangulation-impact-cards">
          <StatCard icon="chart-column-big" tint="green" label="Potential gross trip value"
            value={naira(summaryNumber(summary, 'potentialRevenue', 'estimatedRevenue'))} labelPosition="bottom" />
          <StatCard icon="coins" tint="purple" label="Potential commission"
            value={naira(summaryNumber(summary, 'potentialCommission'))} labelPosition="bottom" />
          <StatCard icon="repeat" tint="blue" label="Potential empty kilometres avoided"
            value={summaryNumber(summary, 'emptyKmAvoidable') == null ? '—' : `${count(summaryNumber(summary, 'emptyKmAvoidable'))} km`} labelPosition="bottom" />
          <StatCard icon="map-pin" tint="amber" label="Additional segments generated"
            value={count(summaryNumber(summary, 'additionalSegments'))} labelPosition="bottom" />
        </div>
      </SectionCard>
    </div>

    <Modal open={!!notifyTarget} onClose={() => setNotifyTarget(null)} title="Notify Trucking Company"
      description={notifyTarget ? `Tell ${notifyTarget.company || 'the trucking company'} about matched job ${notifyTarget.jobId}?` : ''}
      footer={<><Button variant="outline" disabled={notifying} onClick={() => setNotifyTarget(null)}>Cancel</Button>
        <Button icon="send" disabled={notifying} onClick={sendNotification}>{notifying ? 'Sending…' : 'Send notification'}</Button></>}>
      <p className="tk-meta">The company can bid on this job through the normal flow. This notification does not assign the job.</p>
    </Modal>
    <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Triangulation Rules"
      footer={<Button onClick={() => setRulesOpen(false)}>Close</Button>}>
      <div style={{ display: 'grid', gap: 8 }}>
        <LabelValue label="Minimum match score" value="—" />
        <LabelValue label="Maximum detour distance" value="—" />
        <LabelValue label="Maximum chain length" value="—" />
        <LabelValue label="Auto-assign threshold" value="—" />
      </div>
      <p className="tk-meta">The backend needs a triangulation rules endpoint to display and save these thresholds.</p>
    </Modal>
    <Modal open={mapExpanded} onClose={() => setMapExpanded(false)} title="Job Locations" width={860}>
      <div className="triangulation-expanded-map">
        <TriangulationGoogleMap points={mapPoints} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </Modal>
  </>;
}
