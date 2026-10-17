"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import { Badge, Banner, Button, Card, DataTable, DropdownMenu, Icon, Modal, PageHeader, Pagination, Skeleton, Sparkline, Textarea } from "../ds.js";
import { ProgressBar } from "../ds/components/data/ProgressBar.jsx";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { TriangulationGoogleMap } from "./TriangulationGoogleMap.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { useGetAdminTripScreenListQuery, useGetAdminTripScreenStatsQuery, useGetAdminTripScreenFiltersQuery,
  useGetAdminTripScreenDetailQuery, useLazyExportAdminTripScreenQuery, useChangeAdminTripScreenMutation } from "../store/features/trips/tripScreenApi.js";
import "./Operations.css";

const PAGE_SIZE = 10;
const TRIP_STATUSES = ["Assigned", "In Transit", "At Pickup", "At Delivery", "Returning Container", "Delayed", "Delivered"];
const STATUS_TO_API = { Assigned: "assigned", "In Transit": "inTransit", "At Pickup": "atPickup", "At Delivery": "atDelivery", "Returning Container": "returningContainer", Delayed: "delayed", Delivered: "completed" };
const DATE_OPTIONS = ["All Dates", "Last 7 Days", "Previous 7 Days"];
const tones = { Assigned: "info", "In Transit": "success", "At Pickup": "purple", "At Delivery": "orange", "Returning Container": "teal", Delayed: "danger", Delivered: "success" };

function dateRange(value) {
  if (value === "All Dates") return {};
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(today + "T00:00:00+01:00").getTime();
  const day = 86400000;
  return value === "Previous 7 Days"
    ? { dateFrom: new Date(start - 13 * day).toISOString(), dateTo: new Date(start - 6 * day - 1).toISOString() }
    : { dateFrom: new Date(start - 6 * day).toISOString(), dateTo: new Date(start + day - 1).toISOString() };
}
function downloadCsv(csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "trips-export-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function Metric({ label, card, comparison, icon, color = "#4c16ac" }) {
  const direction = card?.direction;
  return <Card className="metric-card">
    <label>{label}</label><strong>{card?.displayValue ?? "—"}</strong>
    <span className={"delta " + (direction === "DOWN" ? "down" : "")}>
      {card?.displayChange !== "—" && direction ? (direction === "DOWN" ? "↓ " : direction === "UP" ? "↑ " : "") + card.displayChange : "—"}
    </span>
    <small>{comparison && comparison !== "—" ? "vs " + comparison : "—"}</small>
    <i className="metric-icon" style={{ color, background: color + "12" }}><Icon name={icon} size={20} /></i>
    <Sparkline points={card?.sparkline || []} color={color} />
  </Card>;
}
function FilterControl({ label, value, active, onClick }) {
  return <span style={{ position: "relative" }}><button className={"jobs-filter" + (active ? " active" : "")} onClick={onClick}><span>{label}</span>{value}</button></span>;
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

function TripsLoading() {
  return (
    <div className="operations-screen" aria-busy="true">
      <Card>
        <Skeleton width={220} height={28} />
        <div style={{ marginTop: 12 }}><Skeleton width={420} height={14} /></div>
      </Card>
      <div className="kpi-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <Card className="metric-card" key={index}>
            <Skeleton width="48%" height={12} />
            <div style={{ marginTop: 14 }}><Skeleton width={72} height={27} /></div>
          </Card>
        ))}
      </div>
      <Card><Skeleton height={260} /></Card>
    </div>
  );
}


export function TripsSegments() {
  const owner = useSelector((s) => s.auth.admin?.id), role = useSelector((s) => s.auth.admin?.role);
  const authenticated = useSelector((s) => Boolean(s.auth.accessToken && s.auth.admin?.id));
  return <TripsSegmentsContent key={[owner, role, authenticated].join(":")} owner={owner} role={role} authenticated={authenticated} />;
}
function TripsSegmentsContent({ owner, role, authenticated }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1), [statusFilter, setStatusFilter] = useState("All Trips");
  const [originFilter, setOriginFilter] = useState("All Locations"), [destFilter, setDestFilter] = useState("All Locations");
  const [driverFilter, setDriverFilter] = useState("All Drivers"), [driverId, setDriverId] = useState(null);
  const [dateFilter, setDateFilter] = useState("All Dates"), [menu, setMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null), [zoom, setZoom] = useState(100), [fitVersion, setFitVersion] = useState(0);
  const [contactOpen, setContactOpen] = useState(false), [message, setMessage] = useState("");
  const [delayTarget, setDelayTarget] = useState(null), [reason, setReason] = useState(""), [actionError, setActionError] = useState("");
  const [toast, setToast] = useState(null);
  const active = useRef(true), actionLock = useRef(false), selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const selectedRange = useMemo(() => dateRange(dateFilter), [dateFilter]);
  const session = { owner, role };
  const listFilters = { ...selectedRange, statusFilter: STATUS_TO_API[statusFilter],
    origin: originFilter === "All Locations" ? undefined : originFilter,
    destination: destFilter === "All Locations" ? undefined : destFilter, driverId };
  const list = useGetAdminTripScreenListQuery({ ...session, ...listFilters, page }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const statsQuery = useGetAdminTripScreenStatsQuery({ ...session, ...selectedRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const optionsQuery = useGetAdminTripScreenFiltersQuery({ ...session, ...selectedRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const detailQuery = useGetAdminTripScreenDetailQuery({ ...session, id: selectedId }, {
    skip: !authenticated || !selectedId, refetchOnMountOrArgChange: true, pollingInterval: selectedId && !contactOpen && !delayTarget ? 30000 : 0 });
  const [exportTripsCsv, { isFetching: exporting }] = useLazyExportAdminTripScreenQuery();
  const [changeTrip, { isLoading: actionBusy }] = useChangeAdminTripScreenMutation();
  const tripsResponse = list.error ? null : list.currentData;
  const trips = tripsResponse?.rows || [], paged = trips;
  const total = tripsResponse?.pagination.total ?? null;
  const stats = statsQuery.error ? null : statsQuery.currentData;
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
  const canManage = ["SUPER_ADMIN", "OPS_ADMIN"].includes(role);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2600); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("tripId"); if (id?.trim()) setSelectedId(id.trim()); }, []);
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
  function resetFilters() {
    setStatusFilter("All Trips"); setOriginFilter("All Locations"); setDestFilter("All Locations");
    setDriverFilter("All Drivers"); setDriverId(null); setDateFilter("All Dates"); setMenu(null); setPage(1);
  }
  async function exportTrips() {
    if (exporting || !authenticated) return;
    try { const csv = await exportTripsCsv({ ...session, ...listFilters }).unwrap(); if (active.current) { downloadCsv(csv); notify(total > 5000 ? "warning" : "success", total > 5000 ? "Trips exported. This filter matches more than 5,000 trips; the API exports up to 5,000. Narrow the filters for smaller groups." : "Trips exported."); } }
    catch (e) { notify("danger", getApiErrorMessage(e)); }
  }
  async function perform(action, trip, details = {}) {
    if (actionLock.current || !authenticated || !trip) return;
    actionLock.current = true; setActionError("");
    try {
      await changeTrip({ ...session, id: trip.id, jobId: trip.jobId, expectedStatus: trip.statusCode, driverId: trip.driverId, action, ...details }).unwrap();
      if (!active.current) return;
      if (selectedRef.current === trip.id) { setContactOpen(false); setMessage(""); setDelayTarget(null); setReason(""); }
      notify("success", action === "message" ? "Message sent to " + trip.driver + "." : action === "delay" ? "Job and its trips marked delayed." : "Job and its trips marked at delivery.");
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
    : menu?.key === "date" ? DATE_OPTIONS.map((s) => ({ label: s, icon: s === dateFilter ? "check" : undefined, onClick: () => choose(setDateFilter, s) }))
    : menu?.key === "quick" ? [{ section: "QUICK FILTERS" }, { label: "Delayed Trips Only", icon: "clock", onClick: () => choose(setStatusFilter, "Delayed") }, { label: "Returning Container Only", icon: "layers", onClick: () => choose(setStatusFilter, "Returning Container") }]
    : menu?.key === "row" ? [{ label: "View Trip", icon: "eye", onClick: () => selectTrip(menu.trip) },
      { label: "View Job", icon: "briefcase-business", onClick: () => { if (menu.trip.jobId) navigate("/jobs/detail?id=" + encodeURIComponent(menu.trip.jobId)); else notify("info", "Job details are unavailable."); setMenu(null); } }] : [];

  const cols = [
    { key: "id", header: "Trip ID", width: "120px", render: (r) => <a onClick={() => selectTrip(r)} style={{ cursor: "pointer" }}>{r.id}</a> },
    { key: "job", header: "Job ID", width: "120px" },
    { key: "type", header: "Trip Type", render: (r) => <Badge tone="purple">{r.tripType || "—"}</Badge> },
    { key: "route", header: "Route", render: (r) => <span className="route-cell">{r.from}　→　{r.to}</span>, width: "120px" },
    { key: "driver", header: "Driver", width: "120px" },
    { key: "truck", header: "Truck / Container", render: (r) => <span className="cell-two"><strong>{r.truck}</strong><small>{r.containerNumber || "—"}</small></span> },
    { key: "segment", header: "Current Segment", render: (r) => r.segmentIndex != null && r.segmentTotal != null ? r.segmentIndex + " / " + r.segmentTotal : "—" },
    { key: "status", header: "Status", render: (r) => <Badge tone={tones[r.status] || "neutral"} dot>{r.status}</Badge> },
    { key: "eta", header: "ETA", width: "120px", render: (r) => <span className="cell-two"><strong>{r.etaLabel}</strong><small>{r.distanceLabel}</small></span> },
    { key: "progress", header: "Progress", width: "120px", render: (r) => <span><ProgressBar value={r.progress ?? 0} max={100} label={r.progress == null ? "—" : r.progress + "%"} /></span> },
    { key: "a", header: "Actions", render: (r) => <span style={{ position: "relative" }}><button className="row-actions" aria-label={"Actions for " + r.id} onClick={(e) => openMenu(e, "row", r)}>•••</button></span> },
  ];
  if (authenticated && !tripsResponse && (list.isLoading || list.isFetching)) return <TripsLoading />;
  return (
    <div className="operations-screen">
      <PageHeader
        crumbs={["Jobs & Trips", "Trips & Segments"]}
        title="Trips & Segments"
        description="Monitor all active trips and their segment execution in real-time."
        actions={
          <>
            <button className="date-button" onClick={(event) => openMenu(event, "date")}>
              <Icon name="calendar" size={15} />
              {dateFilter}
            </button>
            <Button icon="plus" disabled={exporting || !authenticated || total == null || total === 0} onClick={() => void exportTrips()}>Export</Button>
          </>
        }
      />

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {list.error && <Banner tone="danger" title={getApiErrorMessage(list.error)} action={<Button variant="outline" size="sm" onClick={list.refetch}>Retry</Button>} />}
      {statsQuery.error && <Banner tone="warning" title="Unable to load trip totals." action={<Button variant="outline" size="sm" onClick={statsQuery.refetch}>Retry</Button>} />}


      <div className="kpi-grid">
        <Metric
          label="All Trips" card={stats?.cards.allTrips} comparison={stats?.comparisonLabel}
          icon="briefcase-business"
        />
        <Metric
          label="In Transit" card={stats?.cards.inTransit} comparison={stats?.comparisonLabel}
          icon="route"
          color="#12a150"
        />
        <Metric
          label="At Pickup" card={stats?.cards.atPickup} comparison={stats?.comparisonLabel}
          icon="truck"
          color="#2469e8"
        />
        <Metric
          label="At Delivery" card={stats?.cards.atDelivery} comparison={stats?.comparisonLabel}
          icon="clipboard-check"
          color="#f5a524"
        />
        <Metric
          label="Returning Container" card={stats?.cards.returningContainer} comparison={stats?.comparisonLabel}
          icon="layers"
          color="#0e9f9a"
        />
        <Metric
          label="Delayed" card={stats?.cards.delayed} comparison={stats?.comparisonLabel}
          icon="clock"
          color="#e02b22"
        />
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h3>
              All Trips <small>({total ?? "—"})</small>
            </h3>
            <p>Click a trip to view its live map and details.</p>
          </div>
        </div>

        <div className="jobs-filters">
          <FilterControl label="Trip Status" value={statusFilter} active={statusFilter !== "All Trips"} onClick={(e) => openMenu(e, "status")} />
          <FilterControl label="Origin" value={originFilter} active={originFilter !== "All Locations"} onClick={(e) => openMenu(e, "origin")} />
          <FilterControl label="Destination" value={destFilter} active={destFilter !== "All Locations"} onClick={(e) => openMenu(e, "destination")} />
          <FilterControl label="Driver" value={driverFilter} active={driverFilter !== "All Drivers"} onClick={(e) => openMenu(e, "driver")} />
          <FilterControl label="Date Range" value={dateFilter} active={dateFilter !== "All Dates"} onClick={(e) => openMenu(e, "date")} />
          <span style={{ position: "relative" }}><Button variant="outline" icon="list-filter" onClick={(e) => openMenu(e, "quick")}>Filters</Button></span>
          <Button variant="outline" icon="rotate-cw" onClick={resetFilters}>Reset</Button>
        </div>

        {!tripsResponse ? <DriverLoadingNotice>—</DriverLoadingNotice> : trips.length === 0 ? (
          <div
            style={{ padding: "40px 18px", textAlign: "center" }}
            className="tk-meta"
          >
            No trips match the current filters.
          </div>
        ) : (
          <DataTable rows={paged} columns={cols} onRowClick={selectTrip} />
        )}
        <Pagination
          page={page}
          pageCount={tripsResponse?.pagination.totalPages ?? 1}
          total={total ?? "—"}
          pageSize={PAGE_SIZE}
          onPage={(next) => { if (Number.isInteger(next) && next >= 1 && next <= (tripsResponse?.pagination.totalPages ?? 1)) setPage(next); }}
          onPageSize={() => {}}
        />
      </div>

      {menu && <TripScreenMenu anchor={menu.anchor} items={menuItems} onClose={setMenu} />}

      <Modal
        open={Boolean(selectedId) && !delayTarget}
        onClose={closeTrip}
        width={640}
        title={selectedTrip?.id || selectedId}
        description={
          selectedTrip ? `${selectedTrip.from}　→　${selectedTrip.to}` : ""
        }
      >
        {detailQuery.isFetching && !selectedTrip && !detailQuery.error && <Skeleton height={240} />}
        {detailQuery.error && <Banner tone="warning" title={getApiErrorMessage(detailQuery.error)} action={<Button size="sm" variant="outline" onClick={detailQuery.refetch}>Retry</Button>} />}
        {actionError && !delayTarget && <Banner tone="danger" title={actionError} />}
        {selectedTrip &&
          (contactOpen ? (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="trip-fact">
                <span>To</span>
                <b>
                  {selectedTrip.driver}　·　{selectedTrip.truck}
                </b>
              </div>
              <Textarea
                label="Message"
                placeholder={`Write a message to ${selectedTrip.driver}...`}
                rows={5}
                maxLength={2000}
                disabled={actionBusy}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <Button variant="outline" disabled={actionBusy} onClick={() => { setContactOpen(false); setActionError(""); }}>
                  Back
                </Button>
                <Button
                  icon="send"
                  disabled={actionBusy || !message.trim() || message.trim().length > 2000}
                  onClick={sendMessage}
                >
                  Send Message
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge tone={tones[selectedTrip.status]} dot>
                  {selectedTrip.status}
                </Badge>
                <span
                  style={{
                    color: "var(--tk-success)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {selectedTrip.live ? "● Live" : "—"}
                </span>
              </div>
              <div
                style={{
                  height: 220,
                  borderRadius: 10,
                  border: "1.5px dashed var(--tk-line-strong)",
                  background: "var(--tk-surface-sunk)",
                  display: "grid",
                  placeItems: "center",
                  gap: 8,
                  textAlign: "center",
                  color: "var(--tk-ink-300)",
                  position: "relative",
                }}
              >
                <div
                  className="trip-map-controls"
                  style={{ position: "absolute", right: 10, top: 10, zIndex: 2 }}
                >
                  <button onClick={() => setZoom((z) => Math.min(z + 20, 200))}>
                    +
                  </button>
                  <button onClick={() => setZoom((z) => Math.max(z - 20, 40))}>
                    −
                  </button>
                  <button onClick={() => { setZoom(100); setFitVersion((v) => v + 1); }}>⌖</button>
                </div>
                <div style={{ position: "absolute", inset: 0, borderRadius: 10, overflow: "hidden" }}>
                  <TriangulationGoogleMap key={selectedTrip.id} points={selectedMapPoints} selectedId={selectedTrip.id} ariaLabel="Trip truck location map" emptyMessage="No truck GPS position is available for this trip." zoom={11 + Math.log2(zoom / 100)} fitVersion={fitVersion} fitOnDataChange={false} />
                </div>
                <span className="tk-meta" style={{ position: "absolute", bottom: 10, background: "var(--tk-surface)", padding: "2px 6px", borderRadius: 4 }}>Zoom {zoom}%</span>
              </div>
              {[
                ["Driver", selectedTrip.driver],
                ["Truck", selectedTrip.truck],
                ["Job ID", selectedTrip.job],
                ["Container", selectedTrip.containerLabel],
                ["Trip Type", selectedTrip.tripType || "—"],
                ["Current Segment", selectedTrip.segmentIndex != null && selectedTrip.segmentTotal != null ? selectedTrip.segmentIndex + " of " + selectedTrip.segmentTotal : "—"],
                ["Distance Left", selectedTrip.distanceLabel],
                ["ETA", selectedTrip.etaLabel],
              ].map((x) => (
                <div className="trip-fact" key={x[0]}>
                  <span>{x[0]}</span>
                  <b>{x[1]}</b>
                </div>
              ))}
              {siblingTrips.length > 0 && (
                <div className="approval-note">
                  {selectedTrip.job} has {siblingTrips.length + 1} trips
                  (multiple trucks requested by the forwarder) — also see{" "}
                  {siblingTrips.map((t) => t.id).join(", ")}.
                </div>
              )}
              <div className="trip-fact">
                <span>Company payout</span>
                <b>
                  {selectedPayout
                    ? `${selectedPayout.id} · ${selectedPayout.status}`
                    : "—"}
                </b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selectedPayout && (
                  <Button
                    variant="outline"
                    style={{ flex: 1 }}
                    onClick={() => navigate(selectedPayout.url)}
                  >
                    View Payout
                  </Button>
                )}
                <Button
                  variant="outline"
                  style={{ flex: 1 }}
                  disabled={actionBusy || !canManage || !selectedTrip.canMarkDelayed || selectedTrip.status === "Delayed"}
                  onClick={() => updateTripStatus(selectedTrip.id, "Delayed")}
                >
                  Mark Delayed
                </Button>
                <Button
                  variant="outline"
                  style={{ flex: 1 }}
                  disabled={actionBusy || !canManage || !selectedTrip.canMarkAtDelivery}
                  onClick={() =>
                    updateTripStatus(selectedTrip.id, "At Delivery")
                  }
                >
                  Mark At Delivery
                </Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  icon="message-circle"
                  style={{ flex: 1 }}
                  disabled={actionBusy || !selectedTrip.driverId} onClick={() => { setActionError(""); setContactOpen(true); }}
                >
                  Contact Driver
                </Button>
                <Button
                  variant="outline"
                  style={{ flex: 1 }}
                  onClick={() => selectedTrip.jobId ? navigate("/jobs/detail?id=" + encodeURIComponent(selectedTrip.jobId)) : notify("info", "Job details are unavailable.")}
                >
                  View Job Details
                </Button>
              </div>
            </div>
          ))}
      </Modal>
      <Modal open={Boolean(delayTarget)} onClose={() => { if (!actionBusy) { setDelayTarget(null); setActionError(""); } }} title="Mark Trip Delayed" description={delayTarget?.job || delayTarget?.id || ""}
        footer={<><Button variant="outline" disabled={actionBusy} onClick={() => { setDelayTarget(null); setActionError(""); }}>Close</Button><Button disabled={actionBusy || !reason.trim() || reason.trim().length > 500} onClick={() => void perform("delay", delayTarget, { reason })}>{actionBusy ? "Saving…" : "Mark Delayed"}</Button></>}>
        <Banner tone="warning" title="This flags every trip on the job as delayed and notifies the forwarder and trucker." />
        {actionError && <Banner tone="danger" title={actionError} style={{ marginTop: 12 }} />}
        <Textarea label="Reason" required rows={4} maxLength={500} value={reason} disabled={actionBusy} onChange={(e) => setReason(e.target.value)} placeholder="Explain the delay" style={{ marginTop: 14 }} />
      </Modal>
    </div>
  );
}
