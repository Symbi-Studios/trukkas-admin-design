"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle, TableToolbar, SearchField } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';
import { DateRangeFilter, EMPTY_RANGE, isRangeSet, rangeParams } from '../components/DateRangeFilter.jsx';

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import { Avatar, Badge, Banner, Button, Card, CopyableId, DataTable, DrawerFacts, DrawerSection, DropdownMenu, FilterSelect, Icon, IconButton, Modal, PageHeader, Pagination, RouteStack, SideDrawer, Skeleton, Sparkline, StatsPanel, Textarea } from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from "../domain/statsPeriod.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { TriangulationGoogleMap } from "./TriangulationGoogleMap.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { useGetAdminTripScreenListQuery, useGetAdminTripScreenStatsQuery, useGetAdminTripScreenFiltersQuery,
  useGetAdminTripScreenDetailQuery, useLazyExportAdminTripScreenQuery, useChangeAdminTripScreenMutation } from "../store/features/trips/tripScreenApi.js";
import "./Operations.css";
import "./Trips.css";

const PAGE_SIZE = 10;
const TRIP_STATUSES = ["Assigned", "In Transit", "At Pickup", "At Delivery", "Returning Container", "Delayed", "Delivered"];
const STATUS_TO_API = { Assigned: "assigned", "In Transit": "inTransit", "At Pickup": "atPickup", "At Delivery": "atDelivery", "Returning Container": "returningContainer", Delayed: "delayed", Delivered: "completed" };
const tones = { Assigned: "info", "In Transit": "success", "At Pickup": "purple", "At Delivery": "orange", "Returning Container": "teal", Delayed: "danger", Delivered: "success" };
const issueLabel = (value) => typeof value === "string" && value.trim() ? value.trim().toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "—";
const issueDate = (value) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; };
const safeUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; } };
const present = (value) => value && value !== "—" ? value : null;

// Trips carried by an individual trucker (owner-operator) have no separate DRIVER
// account, so the API returns `driver: null`. Show the trucking company instead
// of a bare dash, and say why there's no driver.
function driverInfo(trip) {
  const name = present(trip?.driverName);
  if (name) return { name, detail: present(trip.driverPhone) || present(trip.truckingCompanyName) || "Driver", empty: false };
  const company = present(trip?.truckingCompanyName);
  if (company) return { name: company, detail: "No separate driver", empty: false };
  return { name: "Not assigned", detail: "No driver or trucker yet", empty: true };
}
function DriverCell({ trip }) {
  const info = driverInfo(trip);
  return <span className={"tk-cell-person" + (info.empty ? " empty" : "")}>
    {info.empty ? <span className="tk-cell-placeholder"><Icon name="user" size={14} /></span> : <Avatar name={info.name} src={trip.driverAvatarUrl || undefined} size={32} />}
    <span><strong title={info.name}>{info.name}</strong><small title={info.detail}>{info.detail}</small></span>
  </span>;
}

function downloadCsv(csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "trips-export-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function Metric({ label, card, comparison, icon, color = "#4c16ac", loading = false }) {
  const direction = card?.direction;
  return <Card className="metric-card">
    <label>{label}</label><strong>{loading ? <Skeleton as="span" width={72} height={27} /> : card?.displayValue ?? "—"}</strong>
    <span className={"delta " + (direction === "DOWN" ? "down" : "")}>
      {loading ? <Skeleton as="span" width={55} height={14} /> : card?.displayChange !== "—" && direction ? (direction === "DOWN" ? "↓ " : direction === "UP" ? "↑ " : "") + card.displayChange : "—"}
    </span>
    <small>{loading ? <Skeleton as="span" width={90} height={12} /> : comparison && comparison !== "—" ? "vs " + comparison : "—"}</small>
    <i className="metric-icon" style={{ color, background: color + "12" }}><Icon name={icon} size={20} /></i>
    {!loading && <Sparkline points={card?.sparkline || []} color={color} />}
  </Card>;
}
function FilterChip({ icon, label, value, active, onOpen, onClear }) {
  return <FilterSelect icon={icon} prefix={label} label={value} active={active} onClick={onOpen} onClear={onClear} />;
}
function TripScreenMenu({ anchor, items, onClose }) {
  const menuRef = useRef(null), [position, setPosition] = useState(null);
  useEffect(() => {
    const update = () => {
      if (!anchor?.isConnected || !menuRef.current) { onClose(null); return; }
      const a = anchor.getBoundingClientRect(), m = menuRef.current.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(a.right - m.width, window.innerWidth - m.width - 8)),
        top: a.bottom + 6 + m.height <= window.innerHeight - 8 ? a.bottom + 6 : Math.max(8, a.top - m.height - 6) });
    };
    const outside = (e) => { if (!anchor?.contains(e.target) && !menuRef.current?.contains(e.target)) onClose(null); };
    const escape = (e) => { if (e.key === "Escape") onClose(null); };
    update();
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);
    };
  }, [anchor, items.length, onClose]);
  return <div ref={menuRef} onClick={(e) => e.stopPropagation()} style={{ position: "fixed", zIndex: 95, top: position?.top ?? -10000, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}>
    <DropdownMenu width={220} items={items} style={{ maxHeight: "calc(100vh - 16px)", overflowY: "auto" }} />
  </div>;
}

export function TripsSegments() {
  const owner = useSelector((s) => s.auth.admin?.id), role = useSelector((s) => s.auth.admin?.role);
  const authenticated = useSelector((s) => Boolean(s.auth.accessToken && s.auth.admin?.id));
  return <TripsSegmentsContent key={[owner, role, authenticated].join(":")} owner={owner} role={role} authenticated={authenticated} />;
}
function TripsSegmentsContent({ owner, role, authenticated }) {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  useEffect(() => { if (window.location.pathname === '/tracking' || new URLSearchParams(window.location.search).get('view') === 'map') setTableView('map'); }, []);
  const [page, setPage] = useState(1), [statusFilter, setStatusFilter] = useState("All Trips");
  const [searchInput, setSearchInput] = usePageSearchState('', () => setPage(1));
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [searchInput]);
  const [originFilter, setOriginFilter] = useState("All Locations"), [destFilter, setDestFilter] = useState("All Locations");
  const [driverFilter, setDriverFilter] = useState("All Drivers"), [driverId, setDriverId] = useState(null);
  const [dateFilter, setDateFilter] = useState(EMPTY_RANGE), [menu, setMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null), [zoom, setZoom] = useState(100), [fitVersion, setFitVersion] = useState(0);
  const [contactOpen, setContactOpen] = useState(false), [message, setMessage] = useState("");
  const [delayTarget, setDelayTarget] = useState(null), [reason, setReason] = useState(""), [actionError, setActionError] = useState("");
  const [toast, setToast] = useState(null);
  const active = useRef(true), actionLock = useRef(false), selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const selectedRange = useMemo(() => rangeParams(dateFilter), [dateFilter]);
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const session = { owner, role };
  const listFilters = { ...selectedRange, search, statusFilter: STATUS_TO_API[statusFilter],
    origin: originFilter === "All Locations" ? undefined : originFilter,
    destination: destFilter === "All Locations" ? undefined : destFilter, driverId };
  const list = useGetAdminTripScreenListQuery({ ...session, ...listFilters, page }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const statsQuery = useGetAdminTripScreenStatsQuery({ ...session, ...statsRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const optionsQuery = useGetAdminTripScreenFiltersQuery({ ...session, ...selectedRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const detailQuery = useGetAdminTripScreenDetailQuery({ ...session, id: selectedId }, {
    skip: !authenticated || !selectedId, refetchOnMountOrArgChange: true, pollingInterval: selectedId && !contactOpen && !delayTarget ? 30000 : 0 });
  const [exportTripsCsv, { isFetching: exporting }] = useLazyExportAdminTripScreenQuery();
  const [changeTrip, { isLoading: actionBusy }] = useChangeAdminTripScreenMutation();
  const tripsResponse = list.error ? null : list.currentData;
  const trips = tripsResponse?.rows || [], paged = trips;
  const total = tripsResponse?.pagination.total ?? null;
  const stats = statsQuery.error ? null : statsQuery.currentData;
  const statsLoading = authenticated && !statsQuery.error && !statsQuery.currentData;
  const listLoading = authenticated && !list.error && !list.currentData;
  const options = optionsQuery.error ? null : optionsQuery.currentData;
  const selectedRow = trips.find((t) => t.id === selectedId);
  const selectedTrip = detailQuery.error ? null : detailQuery.currentData || selectedRow || null;
  const selectedPayout = selectedTrip?.payout || null;
  const siblingTrips = selectedTrip?.multipleTruckAssignmentsKnown ? selectedTrip.siblingIds.map((id) => ({ id })) : [];
  const selectedMapPoints = useMemo(() => {
    if (!selectedTrip?.hasGpsPosition) return [];
    return [{ lat: selectedTrip.truckData.latitude, lng: selectedTrip.truckData.longitude, opportunityId: selectedTrip.id,
      title: selectedTrip.truck + " · " + (selectedTrip.truckData.displayLastLocationUpdate || "—"), color: "#0241e8" }];
  }, [selectedTrip?.id, selectedTrip?.hasGpsPosition, selectedTrip?.truckData.latitude, selectedTrip?.truckData.longitude, selectedTrip?.truck, selectedTrip?.truckData.displayLastLocationUpdate]);
  const mapPoints = useMemo(() => trips.filter((trip) => trip.hasGpsPosition).map((trip) => ({
    lat: trip.truckData.latitude, lng: trip.truckData.longitude, opportunityId: trip.id,
    title: trip.job + ' · ' + trip.truck + ' · ' + trip.status, color: '#0241e8',
  })), [trips]);
  const canManage = ["SUPER_ADMIN", "OPS_ADMIN"].includes(role);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tripId");
    if (id?.trim()) setSelectedId(id.trim());
    const select = event => { if (typeof event.detail === 'string' && event.detail.trim()) setSelectedId(event.detail.trim()); };
    window.addEventListener('trukkas:select-trip', select);
    return () => window.removeEventListener('trukkas:select-trip', select);
  }, []);
  useEffect(() => { if (optionsQuery.error) setToast({ tone: "warning", title: "Unable to load trip filter options. Refresh to try again." }); }, [optionsQuery.error]);
  useEffect(() => { if (tripsResponse?.pagination.totalPages && page > tripsResponse.pagination.totalPages) setPage(tripsResponse.pagination.totalPages); }, [page, tripsResponse?.pagination.totalPages]);
  function notify(tone, title) { if (active.current) setToast({ tone, title }); }
  function openMenu(event, key, trip) {
    event.stopPropagation();
    const anchor = event.currentTarget;
    setMenu((previous) => previous?.key === key && previous?.trip?.id === trip?.id ? null : { key, anchor, trip });
  }
  function choose(setter, value) { setter(value); setPage(1); setMenu(null); }
  function selectTrip(t) { setSelectedId(t.id); setZoom(100); setFitVersion(0); setContactOpen(false); setMessage(""); setActionError(""); setMenu(null); }
  function closeTrip() { if (actionBusy) return; setSelectedId(null); setContactOpen(false); setMessage(""); setActionError(""); }
  const filtersActive = statusFilter !== "All Trips" || originFilter !== "All Locations" || destFilter !== "All Locations" || driverFilter !== "All Drivers" || isRangeSet(dateFilter) || Boolean(search);
  function resetFilters() {
    setSearchInput(''); setSearch('');
    setStatusFilter("All Trips"); setOriginFilter("All Locations"); setDestFilter("All Locations");
    setDriverFilter("All Drivers"); setDriverId(null); setDateFilter(EMPTY_RANGE); setMenu(null); setPage(1);
  }
  async function exportTrips() {
    if (exporting || !authenticated) return;
    try { const csv = await exportTripsCsv({ ...session, ...listFilters }).unwrap(); if (active.current) { downloadCsv(csv); notify(total > 5000 ? "warning" : "success", total > 5000 ? "Trips exported. This filter matches more than 5,000 trips; up to 5,000 were exported. Narrow the filters for smaller groups." : "Trips exported."); } }
    catch (e) { notify("danger", getApiErrorMessage(e)); }
  }
  async function perform(action, trip, details = {}) {
    if (actionLock.current || !authenticated || !trip) return;
    actionLock.current = true; setActionError("");
    try {
      await changeTrip({ ...session, id: trip.id, jobId: trip.jobId, expectedStatus: trip.statusCode, driverId: trip.driverId, action, ...details }).unwrap();
      if (!active.current) return;
      if (selectedRef.current === trip.id) { setContactOpen(false); setMessage(""); setDelayTarget(null); setReason(""); }
      notify("success", action === "message" ? "Message sent to " + trip.driver + "." : action === "delay" ? "Job and its trips marked delayed." : action === "clearDelay" ? "Manual delay cleared for the job and its trips." : "Job and its trips marked at delivery.");
    } catch (e) { if (active.current) { setActionError(getApiErrorMessage(e)); notify("danger", getApiErrorMessage(e)); } }
    finally { actionLock.current = false; }
  }
  function updateTripStatus(id, status) {
    const trip = selectedTrip?.id === id ? selectedTrip : trips.find((t) => t.id === id);
    if (!trip || !canManage) return;
    setMenu(null);
    if (status === "Delayed") { setReason(""); setActionError(""); setDelayTarget(trip); }
    if (status === "At Delivery") void perform("arrival", trip);
  }
  function sendMessage() { if (message.trim()) void perform("message", selectedTrip, { message }); }
  const menuItems = menu?.key === "status" ? ["All Trips", ...TRIP_STATUSES].map((s) => ({ label: s, icon: s === statusFilter ? "check" : undefined, onClick: () => choose(setStatusFilter, s) }))
    : menu?.key === "origin" || menu?.key === "destination" ? ["All Locations", ...(menu.key === "origin" ? options?.origins || [] : options?.destinations || [])].map((s) => ({
      label: s, icon: s === (menu.key === "origin" ? originFilter : destFilter) ? "check" : undefined,
      onClick: () => choose(menu.key === "origin" ? setOriginFilter : setDestFilter, s) }))
    : menu?.key === "driver" ? [{ label: "All Drivers", onClick: () => { setDriverId(null); choose(setDriverFilter, "All Drivers"); } },
      ...(options?.drivers || []).map((d) => ({ label: d.label, icon: d.id === driverId ? "check" : undefined, onClick: () => { setDriverId(d.id); choose(setDriverFilter, d.label); } }))]
    : [];

  const cols = [
    { key: "job", header: "Trip", width: "15%", render: (r) => <span className="tk-cell-id"><strong>{r.job}</strong><small>{r.containerNumber || "No container"}</small></span> },
    { key: "route", header: "Route", width: "27%", render: (r) => <RouteStack from={r.from} to={r.to} /> },
    { key: "type", header: "Type", width: "10%", render: (r) => r.tripType ? <Badge tone="purple">{r.tripType}</Badge> : "—" },
    { key: "driver", header: "Driver", width: "19%", render: (r) => <DriverCell trip={r} /> },
    { key: "truck", header: "Truck", width: "10%", render: (r) => r.truck && r.truck !== "—" ? <span className="tk-plate"><Icon name="truck" size={13} />{r.truck}</span> : "—" },
    { key: "status", header: "Status", width: "10%", render: (r) => <Badge tone={tones[r.status] || "neutral"} dot>{r.status}</Badge> },
    { key: "eta", header: "ETA", width: "9%", render: (r) => <span className="tk-cell-two"><strong>{r.etaLabel}</strong>{r.distanceLabel !== "—" && <small>{r.distanceLabel + " left"}</small>}</span> },
  ];
  return (
    <div className="operations-screen">
      <PageHeader
        crumbs={["Jobs & Trips", "Trips"]}
        title="Trips"
        description="Monitor every trip in real time."
      />

      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      {list.error && <Banner tone="danger" title={getApiErrorMessage(list.error)} action={<Button variant="outline" size="sm" onClick={list.refetch}>Retry</Button>} />}
      {statsQuery.error && <Banner tone="warning" title="Unable to load trip totals." action={<Button variant="outline" size="sm" onClick={statsQuery.refetch}>Retry</Button>} />}


      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <Metric
          loading={statsLoading}
          label="All Trips" card={stats?.cards.allTrips} comparison={stats?.comparisonLabel}
          icon="briefcase-business"
        />
        <Metric
          loading={statsLoading}
          label="In Transit" card={stats?.cards.inTransit} comparison={stats?.comparisonLabel}
          icon="route"
          color="#12a150"
        />
        <Metric
          loading={statsLoading}
          label="At Pickup" card={stats?.cards.atPickup} comparison={stats?.comparisonLabel}
          icon="truck"
          color="#2469e8"
        />
        <Metric
          loading={statsLoading}
          label="At Delivery" card={stats?.cards.atDelivery} comparison={stats?.comparisonLabel}
          icon="clipboard-check"
          color="#f5a524"
        />
        <Metric
          loading={statsLoading}
          label="Returning Container" card={stats?.cards.returningContainer} comparison={stats?.comparisonLabel}
          icon="layers"
          color="#0e9f9a"
        />
        <Metric
          loading={statsLoading}
          label="Delayed" card={stats?.cards.delayed} comparison={stats?.comparisonLabel}
          icon="clock"
          color="#e02b22"
        />
      </StatsPanel>

      <div className="ops-panel">
        <TableToolbar search={<SearchField placeholder="Search by Trip ID, Job ID, Container, Truck, Driver..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />} filters={<><FilterChip icon="circle-dot" label="Status" value={statusFilter} active={statusFilter !== "All Trips"} onOpen={(e) => openMenu(e, "status")} onClear={() => choose(setStatusFilter, "All Trips")} />
<FilterChip icon="map-pin" label="Origin" value={originFilter} active={originFilter !== "All Locations"} onOpen={(e) => openMenu(e, "origin")} onClear={() => choose(setOriginFilter, "All Locations")} />
<FilterChip icon="flag" label="Destination" value={destFilter} active={destFilter !== "All Locations"} onOpen={(e) => openMenu(e, "destination")} onClear={() => choose(setDestFilter, "All Locations")} />
<FilterChip icon="user" label="Driver" value={driverFilter} active={driverFilter !== "All Drivers"} onOpen={(e) => openMenu(e, "driver")} onClear={() => { setDriverId(null); choose(setDriverFilter, "All Drivers"); }} />
<DateRangeFilter value={dateFilter} onChange={(next) => choose(setDateFilter, next)} />
{filtersActive && <button type="button" className="tk-clear-filters" onClick={resetFilters}>Clear all</button>}</>} viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} map />} trailing={<Button variant="outline" icon="download" disabled={exporting || !authenticated || total == null || total === 0} onClick={() => void exportTrips()}>Export</Button>} />

        {tableView !== 'map' && listLoading && <div aria-busy="true" style={{ padding: 18 }}><Skeleton height={260} /></div>}
        {tableView !== 'map' && !listLoading && !tripsResponse && <DriverLoadingNotice>—</DriverLoadingNotice>}
        {tableView === 'map' ? <div className="tk-trip-map-view">
            <TriangulationGoogleMap points={mapPoints} selectedId={selectedId}
              onSelect={(id) => { const trip = trips.find((row) => row.id === id); if (trip) selectTrip(trip); }}
              ariaLabel="Trip locations map" emptyMessage="No truck GPS positions are available for the trips on this page." />
          </div> : !listLoading && tripsResponse && (trips.length > 0 || tableView === 'board') ? <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.trips} view={tableView} boardGroupBy={(row) => row.status}
          rows={paged} columns={cols} onRowClick={selectTrip} selected={selectedId ? [selectedId] : []}
          boardSelectedKey={selectedId} /> : null}
        {tableView === 'list' && !listLoading && tripsResponse && !trips.length && <div className="tk-board-empty">No trips match the current filters.</div>}
        {!listLoading && <Pagination
          page={page}
          pageCount={tripsResponse?.pagination.totalPages ?? 1}
          total={total ?? "—"}
          pageSize={PAGE_SIZE}
          onPage={(next) => { if (Number.isInteger(next) && next >= 1 && next <= (tripsResponse?.pagination.totalPages ?? 1)) setPage(next); }}
          onPageSize={() => {}}
        />}
      </div>

      {menu && <TripScreenMenu anchor={menu.anchor} items={menuItems} onClose={setMenu} />}

      {selectedId && <TripDrawer
        trip={selectedTrip} tripId={selectedId} loading={detailQuery.isFetching && !selectedTrip && !detailQuery.error}
        error={detailQuery.error} onRetry={detailQuery.refetch} actionError={!delayTarget ? actionError : ""}
        onClose={closeTrip} hidden={Boolean(delayTarget)}
        mapPoints={selectedMapPoints} zoom={zoom} setZoom={setZoom} fitVersion={fitVersion} setFitVersion={setFitVersion}
        payout={selectedPayout} siblingTrips={siblingTrips} canManage={canManage} actionBusy={actionBusy}
        contactOpen={contactOpen} setContactOpen={setContactOpen} message={message} setMessage={setMessage} onSend={sendMessage}
        onClearDelay={() => void perform("clearDelay", selectedTrip)} onMarkDelayed={() => updateTripStatus(selectedTrip.id, "Delayed")}
        onMarkAtDelivery={() => updateTripStatus(selectedTrip.id, "At Delivery")}
        onViewJob={() => selectedTrip?.jobId ? navigate("/jobs/detail?id=" + encodeURIComponent(selectedTrip.jobId)) : notify("info", "Job details are unavailable.")}
        onViewPayout={() => selectedPayout && navigate(selectedPayout.url)}
        onClearError={() => setActionError("")}
      />}
      <Modal open={Boolean(delayTarget)} onClose={() => { if (!actionBusy) { setDelayTarget(null); setActionError(""); } }} title="Mark Trip Delayed" description={delayTarget?.job || delayTarget?.id || ""}
        footer={<><Button variant="outline" disabled={actionBusy} onClick={() => { setDelayTarget(null); setActionError(""); }}>Close</Button><Button disabled={actionBusy || !reason.trim() || reason.trim().length > 500} onClick={() => void perform("delay", delayTarget, { reason })}>{actionBusy ? "Saving…" : "Mark Delayed"}</Button></>}>
        <Banner tone="warning" title="This flags every trip on the job as delayed and notifies the forwarder and trucker." />
        {actionError && <Banner tone="danger" title={actionError} style={{ marginTop: 12 }} />}
        <Textarea label="Reason" required rows={4} maxLength={500} value={reason} disabled={actionBusy} onChange={(e) => setReason(e.target.value)} placeholder="Explain the delay" style={{ marginTop: 14 }} />
      </Modal>
    </div>
  );
}

function TripDrawer({ trip, tripId, loading, error, onRetry, actionError, onClose, hidden, mapPoints, zoom, setZoom, fitVersion, setFitVersion,
  payout, siblingTrips, canManage, actionBusy, contactOpen, setContactOpen, message, setMessage, onSend,
  onClearDelay, onMarkDelayed, onMarkAtDelivery, onViewJob, onViewPayout, onClearError }) {
  if (hidden) return null;
  const driver = driverInfo(trip);
  const manualDelay = trip?.isDelayed === true && trip?.delayReason;
  const stage = trip?.segmentIndex != null && trip?.segmentTotal != null ? `${trip.segmentLabel || trip.status} (${trip.segmentIndex} of ${trip.segmentTotal})` : trip?.segmentLabel || "—";
  const footer = trip && (contactOpen ? <div className="tk-drawer-footer-row">
    <Button variant="outline" disabled={actionBusy} onClick={() => { setContactOpen(false); onClearError(); }}>Back</Button>
    <Button icon="send" disabled={actionBusy || !message.trim() || message.trim().length > 2000} onClick={onSend}>Send Message</Button>
  </div> : <>
    <div className="tk-drawer-footer-row">
      {manualDelay
        ? <Button variant="outline" icon="clock" disabled={actionBusy || !canManage} onClick={onClearDelay}>Clear Delay</Button>
        : <Button variant="outline" icon="clock" disabled={actionBusy || !canManage || !trip.canMarkDelayed || trip.status === "Delayed"} onClick={onMarkDelayed}>Mark Delayed</Button>}
      <Button variant="outline" icon="map-pin" disabled={actionBusy || !canManage || !trip.canMarkAtDelivery} onClick={onMarkAtDelivery}>Mark At Delivery</Button>
    </div>
    <div className="tk-drawer-footer-row">
      {payout && <Button variant="outline" onClick={onViewPayout}>View Payout</Button>}
      <Button variant="outline" icon="briefcase-business" onClick={onViewJob}>View Job</Button>
      <Button icon="message-circle" disabled={actionBusy || !trip.driverId} onClick={() => { onClearError(); setContactOpen(true); }}>Contact Driver</Button>
    </div>
  </>);
  return <SideDrawer
    label="Trip details" eyebrow="Trip" onClose={onClose} footer={footer}
    title={trip?.job && trip.job !== "—" ? <CopyableId id={trip.job} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} /> : tripId}
    meta={trip && <>
      <Badge tone={tones[trip.status] || "neutral"} dot>{trip.status}</Badge>
      {trip.tripType && <Badge tone="purple">{trip.tripType}</Badge>}
      {trip.live && <span className="trips-live">Live</span>}
    </>}
  >
    {loading && <><Skeleton height={64} /><Skeleton height={240} /><Skeleton height={160} /></>}
    {error && <Banner tone="warning" title={getApiErrorMessage(error)} action={<Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>} />}
    {actionError && <Banner tone="danger" title={actionError} />}
    {trip && (contactOpen ? <DrawerSection title="Message driver">
      <DrawerFacts items={[{ label: "To", value: driver.name, sub: present(trip.truck) || "—", wide: true }]} />
      <Textarea label="Message" placeholder={`Write a message to ${driver.name}...`} rows={6} maxLength={2000} disabled={actionBusy} value={message} onChange={(e) => setMessage(e.target.value)} />
    </DrawerSection> : <>
      <div className="tk-drawer-card"><RouteStack from={trip.from} to={trip.to} wrap /></div>

      <div className="trips-map">
        <div className="trips-map-inner">
          <TriangulationGoogleMap key={trip.id} points={mapPoints} selectedId={trip.id} ariaLabel="Trip truck location map" emptyMessage="No truck GPS position is available for this trip." zoom={11 + Math.log2(zoom / 100)} fitVersion={fitVersion} fitOnDataChange={false} />
        </div>
        <div className="trip-map-controls">
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(z + 20, 200))}>+</button>
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(z - 20, 40))}>−</button>
          <button aria-label="Recenter map" onClick={() => { setZoom(100); setFitVersion((v) => v + 1); }}>⌖</button>
        </div>
        <span className="trips-map-zoom">Zoom {zoom}%{trip.truckData?.displayLastLocationUpdate && trip.truckData.displayLastLocationUpdate !== "—" ? " · Updated " + trip.truckData.displayLastLocationUpdate : ""}</span>
      </div>

      {manualDelay && <div className="tk-drawer-note"><Icon name="clock" size={16} /><span>Marked delayed by an admin: {trip.delayReason}</span></div>}
      {siblingTrips.length > 0 && <div className="tk-drawer-note info"><Icon name="layers" size={16} /><span>{trip.job} has {siblingTrips.length + 1} trips. Also see {siblingTrips.map((t) => t.id).join(", ")}.</span></div>}

      <DrawerSection title="Progress">
        <DrawerFacts items={[
          { label: "Current stage", value: stage },
          { label: "Progress", value: trip.progress == null ? "—" : trip.progress + "%" },
          { label: "ETA", value: trip.etaLabel },
          { label: "Distance left", value: trip.distanceLabel },
        ]} />
      </DrawerSection>

      <DrawerSection title="Driver & truck">
        <DrawerFacts items={[
          { label: "Driver", value: driver.name, sub: driver.detail },
          { label: "Trucking company", value: present(trip.truckingCompanyName) || "—" },
          { label: "Truck", value: present(trip.truck) || "—" },
          { label: "Container", value: trip.containerLabel },
        ]} />
      </DrawerSection>

      <DrawerSection title="Payment">
        <DrawerFacts items={[{ label: "Company payout", value: payout ? `${payout.id} · ${payout.status}` : "—", wide: true }]} />
      </DrawerSection>

      {Array.isArray(trip.issues) && trip.issues.length > 0 && <DrawerSection title={`Reported issues (${trip.issues.length})`}>
        {trip.issues.map((issue) => <div className="trips-issue" key={issue.id || issue.createdAt}>
          <div className="trips-issue-head">
            <Badge tone={issue.resolvedAt ? "success" : "danger"}>{issueLabel(issue.type)}</Badge>
            <span className="tk-meta">{issueLabel(issue.status)}</span>
          </div>
          <p>{issue.description || "—"}</p>
          <span className="tk-meta">
            {[issue.reportedBy?.name, issue.reportedBy?.role ? issueLabel(issue.reportedBy.role) : null].filter(Boolean).join(" · ") || "—"}
            {" · "}{issueDate(issue.createdAt)}{issue.resolvedAt ? " · Resolved " + issueDate(issue.resolvedAt) : ""}
          </span>
          {issue.photoUrls.length > 0 && <span className="trips-issue-photos">
            {issue.photoUrls.map((url, index) => safeUrl(url) && <a key={url} href={safeUrl(url)} target="_blank" rel="noopener noreferrer">Photo {index + 1}</a>)}
          </span>}
        </div>)}
      </DrawerSection>}
    </>)}
  </SideDrawer>;
}
