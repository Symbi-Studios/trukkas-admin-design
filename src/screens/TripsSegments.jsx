"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  Icon,
  Modal,
  PageHeader,
  Pagination,
  ProgressBar,
  SearchField,
  Skeleton,
  Textarea,
} from "../ds.js";
import {
  useGetAdminTripsQuery,
  useGetAdminTripStatsQuery,
  useGetAdminTripDetailQuery,
  useLazyExportAdminTripsQuery,
  useMarkAdminTripDelayedMutation,
  useClearAdminTripDelayedMutation,
  useMarkAdminTripAtDeliveryMutation,
  useMessageAdminTripDriverMutation,
} from "../store/features/trips/tripsApi.js";
import { TriangulationGoogleMap } from "./TriangulationGoogleMap.jsx";
import "./Operations.css";

const PAGE_SIZE = 10;
const TRIP_STATUSES = [
  "Assigned",
  "In Transit",
  "At Pickup",
  "Delivered",
  "Delayed",
  "At Delivery",
  "Returning Container",
  "Disputed",
];
const STATUS_TO_API = {
  Assigned: "assigned", "In Transit": "inTransit", "At Pickup": "atPickup",
  Delivered: "completed", Delayed: "delayed", "At Delivery": "atDelivery",
  "Returning Container": "returningContainer", Disputed: "disputed",
};
const DATE_OPTIONS = ["All Dates", "Last 7 Days", "Previous 7 Days"];
const ACTION_ROLES = new Set(["SUPER_ADMIN", "OPS_ADMIN"]);
const tones = {
  Assigned: "info",
  "In Transit": "success",
  "At Pickup": "purple",
  "At Delivery": "orange",
  "Returning Container": "teal",
  Delayed: "danger",
  Delivered: "success",
  Disputed: "danger",
};

function dateRange(value) {
  if (value === "All Dates") return {};
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = new Date(start);
  const to = new Date(start);
  if (value === "Previous 7 Days") {
    from.setDate(from.getDate() - 13);
    to.setDate(to.getDate() - 7);
  } else from.setDate(from.getDate() - 6);
  to.setHours(23, 59, 59, 999);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function apiErrorMessage(error, fallback) {
  const detail = error?.data?.message || error?.data?.error || error?.message || error?.error;
  return Array.isArray(detail) ? detail.join(", ") : typeof detail === "string" && detail.trim() ? detail : fallback;
}

function distanceText(km) {
  return km == null ? "—" : `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 1 }).format(km)} km`;
}

function downloadCsv(csv) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `trips-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Metric({ label, value, icon, color = "#4c16ac", caption }) {
  return (
    <Card className="metric-card">
      <label>{label}</label>
      <strong>{value}</strong>
      <small>{caption}</small>
      <i className="metric-icon" style={{ color, background: color + "12" }}>
        <Icon name={icon} size={20} />
      </i>
    </Card>
  );
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

function FilterMenu({ label, value, active, open, onToggle, options, onSelect }) {
  return (
    <span style={{ position: "relative" }}>
      <button className={`jobs-filter${active ? " active" : ""}`} onClick={onToggle}>
        <span>{label}</span>{value}
      </button>
      {open && (
        <span style={{ position: "absolute", left: 0, top: 52, zIndex: 30 }}>
          <DropdownMenu
            width={220}
            items={options.map((option) => ({
              label: option,
              icon: option === value ? "check" : undefined,
              onClick: () => onSelect(option),
            }))}
          />
        </span>
      )}
    </span>
  );
}

export function TripsSegments() {
  const navigate = useNavigate();
  const adminRole = useSelector((state) => state.auth.admin?.role);
  const canManageTrips = ACTION_ROLES.has(adminRole);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All Trips");
  const [originFilter, setOriginFilter] = useState("All Locations");
  const [destFilter, setDestFilter] = useState("All Locations");
  const [driverFilter, setDriverFilter] = useState("All Drivers");
  const [driverId, setDriverId] = useState(null);
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [query, setQuery] = useState("");
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionText, setActionText] = useState("");
  const [actionError, setActionError] = useState("");

  const selectedRange = useMemo(() => dateRange(dateFilter), [dateFilter]);
  const listFilters = {
    statusFilter: STATUS_TO_API[statusFilter],
    search: query.trim() || undefined,
    origin: originFilter === "All Locations" ? undefined : originFilter,
    destination: destFilter === "All Locations" ? undefined : destFilter,
    driverId,
    ...selectedRange,
  };
  const {
    currentData: tripsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminTripsQuery({ ...listFilters, page, limit: PAGE_SIZE }, {
    refetchOnMountOrArgChange: true,
  });
  const { currentData: stats, isError: statsError, refetch: refetchStats } = useGetAdminTripStatsQuery(selectedRange);
  const {
    currentData: tripDetail,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
    refetch: refetchDetail,
  } = useGetAdminTripDetailQuery(selectedId, { skip: !selectedId, refetchOnMountOrArgChange: true });
  const [exportTripsCsv, { isFetching: exporting }] = useLazyExportAdminTripsQuery();
  const [markDelayed, { isLoading: markingDelayed }] = useMarkAdminTripDelayedMutation();
  const [clearDelayed, { isLoading: clearingDelayed }] = useClearAdminTripDelayedMutation();
  const [markAtDelivery, { isLoading: markingAtDelivery }] = useMarkAdminTripAtDeliveryMutation();
  const [messageDriver, { isLoading: sendingMessage }] = useMessageAdminTripDriverMutation();
  const actionBusy = markingDelayed || clearingDelayed || markingAtDelivery || sendingMessage;

  const trips = tripsResponse?.rows || [];
  const origins = useMemo(() => [...new Set(trips.map((trip) => trip.origin).filter(Boolean))], [trips]);
  const destinations = useMemo(() => [...new Set(trips.map((trip) => trip.destination).filter(Boolean))], [trips]);
  const drivers = useMemo(() => [...new Set(trips.map((trip) => trip.driverName).filter(Boolean))], [trips]);
  const filtered = trips;
  const selectedRow = trips.find((trip) => trip.id === selectedId) || null;
  const selectedTrip = tripDetail || selectedRow;
  const selectedMapPoints = useMemo(() => {
    if (!selectedTrip?.hasGpsPosition) return [];
    const latitude = selectedTrip.truck?.latitude;
    const longitude = selectedTrip.truck?.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{
      lat: latitude,
      lng: longitude,
      opportunityId: selectedTrip.id,
      title: `${selectedTrip.truck.plateNumber || "Truck"} · ${selectedTrip.jobNumber}`,
      color: "#0241e8",
    }];
  }, [selectedTrip?.id, selectedTrip?.hasGpsPosition, selectedTrip?.truck?.latitude,
    selectedTrip?.truck?.longitude, selectedTrip?.truck?.plateNumber, selectedTrip?.jobNumber]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, originFilter, destFilter, driverFilter, dateFilter, query]);

  useEffect(() => {
    if (selectedId && !selectedTrip) setSelectedId(null);
  }, [selectedId, selectedTrip]);

  function resetFilters() {
    setStatusFilter("All Trips");
    setOriginFilter("All Locations");
    setDestFilter("All Locations");
    setDriverFilter("All Drivers");
    setDriverId(null);
    setDateFilter("All Dates");
    setQuery("");
    setOpenFilter(null);
    setPage(1);
  }

  async function exportTrips() {
    try {
      downloadCsv(await exportTripsCsv(listFilters).unwrap());
      setToast({ tone: "success", title: "Trips exported." });
    } catch (requestError) {
      setToast({ tone: "danger", title: apiErrorMessage(requestError, "Unable to export trips.") });
    }
  }

  function metricValue(key) {
    return stats?.cards[key]?.value?.toLocaleString("en-NG") ?? "—";
  }

  function metricCaption(key) {
    const card = stats?.cards[key];
    if (card?.changePercent == null) return "—";
    return `${card.changePercent > 0 ? "+" : ""}${card.changePercent}% vs previous period`;
  }

  function openAction(type, trip) {
    setMenuFor(null);
    setSelectedId(null);
    setActionText("");
    setActionError("");
    setActionDialog({ type, trip });
  }

  async function confirmAction() {
    if (!actionDialog || actionBusy) return;
    const { type, trip } = actionDialog;
    if (["delay", "message"].includes(type) && !actionText.trim()) return;
    try {
      if (type === "delay") await markDelayed({ id: trip.id, reason: actionText }).unwrap();
      if (type === "clear-delay") await clearDelayed(trip.id).unwrap();
      if (type === "delivery") await markAtDelivery(trip.id).unwrap();
      if (type === "message") await messageDriver({ id: trip.id, message: actionText }).unwrap();
      setActionDialog(null);
      setActionText("");
      setToast({ tone: "success", title: type === "delay" ? "Trip marked delayed." : type === "clear-delay" ? "Delay flag cleared." : type === "delivery" ? "Trip marked at delivery." : "Message sent to driver." });
    } catch (requestError) {
      setActionError(apiErrorMessage(requestError, "Unable to update this trip."));
    }
  }

  const columns = [
    {
      key: "id",
      header: "Trip ID",
      width: 120,
      render: (trip) => <a onClick={() => setSelectedId(trip.id)} style={{ cursor: "pointer" }}>{trip.id}</a>,
    },
    {
      key: "job",
      header: "Job ID",
      width: 130,
      render: (trip) => (
        <a
          style={{ cursor: trip.jobId ? "pointer" : "default" }}
          onClick={(event) => {
            event.stopPropagation();
            if (trip.jobId) navigate(`/jobs/detail?id=${encodeURIComponent(trip.jobId)}`);
          }}
        >
          {trip.jobNumber}
        </a>
      ),
    },
    { key: "type", header: "Trip Type", render: (trip) => <Badge tone="purple">{trip.tripType || "—"}</Badge> },
    { key: "route", header: "Route", render: (trip) => <span className="route-cell">{trip.route}</span>, width: 190 },
    { key: "driver", header: "Driver", render: (trip) => trip.driverName || "—", width: 130 },
    {
      key: "truck",
      header: "Truck / Container",
      render: (trip) => (
        <span className="cell-two">
          <strong>{trip.truck?.plateNumber || "—"}</strong>
          <small>{trip.containerNumber || "—"}</small>
        </span>
      ),
    },
    { key: "segment", header: "Current Segment", render: (trip) => trip.currentSegment ? `${trip.currentSegment.index} of ${trip.currentSegment.total} · ${trip.currentSegment.label}` : trip.segmentLabel },
    {
      key: "status",
      header: "Status",
      render: (trip) => (
        <span className="cell-two">
          <Badge tone={tones[trip.status] || "neutral"} dot>{trip.status}</Badge>
          {trip.statusLabel && trip.statusLabel !== trip.status && <small>{trip.statusLabel}</small>}
        </span>
      ),
    },
    {
      key: "eta",
      header: "ETA",
      width: 145,
      render: (trip) => (
        <span className="cell-two"><strong>{trip.displayEta || "—"}</strong><small>{trip.distance.remainingKm == null ? "Distance unavailable" : `${distanceText(trip.distance.remainingKm)} left`}</small></span>
      ),
    },
    { key: "progress", header: "Progress", width: 100, render: (trip) => trip.progressPercent == null ? "—" : <ProgressBar value={trip.progressPercent} caption={`${trip.progressPercent}%`} /> },
    {
      key: "actions",
      header: "Actions",
      render: (trip) => (
        <span style={{ position: "relative" }}>
          <button
            className="row-actions"
            aria-label={`Actions for ${trip.id}`}
            onClick={(event) => {
              event.stopPropagation();
              setMenuFor(menuFor === trip.id ? null : trip.id);
            }}
          >•••</button>
          {menuFor === trip.id && (
            <span style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }} onClick={(event) => event.stopPropagation()}>
              <DropdownMenu
                width={200}
                items={[
                  { label: "View Trip", icon: "eye", onClick: () => { setMenuFor(null); setSelectedId(trip.id); } },
                  ...(trip.jobId ? [{ label: "View Job", icon: "briefcase-business", onClick: () => { setMenuFor(null); navigate(`/jobs/detail?id=${encodeURIComponent(trip.jobId)}`); } }] : []),
                  ...(canManageTrips && trip.canMarkDelayed && !trip.isDelayed ? [{ label: "Mark Delayed", icon: "clock", onClick: () => openAction("delay", trip) }] : []),
                  ...(canManageTrips && trip.isDelayed && trip.delayReason ? [{ label: "Clear Delay Flag", icon: "circle-check", onClick: () => openAction("clear-delay", trip) }] : []),
                  ...(canManageTrips && trip.canMarkAtDelivery ? [{ label: "Mark At Delivery", icon: "map-pin", onClick: () => openAction("delivery", trip) }] : []),
                  ...(trip.driverId ? [{ label: "Message Driver", icon: "send", onClick: () => openAction("message", trip) }] : []),
                ]}
              />
            </span>
          )}
        </span>
      ),
    },
  ];

  if (!tripsResponse && isLoading) return <TripsLoading />;

  return (
    <div className="operations-screen">
      <PageHeader
        crumbs={["Jobs & Trips", "Trips & Segments"]}
        title="Trips & Segments"
        description="Monitor all active trips and their segment execution in real-time."
        actions={(
          <>
            <span style={{ position: "relative" }}>
              <button className="date-button" onClick={() => setOpenFilter(openFilter === "header-date" ? null : "header-date")}>
                <Icon name="calendar" size={15} />{dateFilter}
              </button>
              {openFilter === "header-date" && <span style={{ position: "absolute", right: 0, top: 42, zIndex: 30 }}>
                <DropdownMenu width={180} items={DATE_OPTIONS.map((option) => ({ label: option, icon: option === dateFilter ? "check" : undefined, onClick: () => { setDateFilter(option); setOpenFilter(null); } }))} />
              </span>}
            </span>
            <Button icon="download" disabled={!tripsResponse?.pagination.total || exporting} onClick={() => void exportTrips()}>{exporting ? "Exporting…" : "Export"}</Button>
          </>
        )}
      />

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {isFetching && tripsResponse && <Banner tone="info" title="Refreshing trips…" />}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Banner tone="danger" title="Unable to load trips from the API." />
          <Button variant="outline" icon="rotate-cw" onClick={refetch}>Retry</Button>
        </div>
      )}
      {statsError && <Banner tone="warning" title="Unable to load trip totals." action={<Button variant="outline" size="sm" onClick={refetchStats}>Retry</Button>} />}

      <div className="kpi-grid">
        <Metric label="All Trips" value={metricValue("allTrips")} caption={metricCaption("allTrips")} icon="briefcase-business" />
        <Metric label="In Transit" value={metricValue("inTransit")} caption={metricCaption("inTransit")} icon="route" color="#12a150" />
        <Metric label="At Pickup" value={metricValue("atPickup")} caption={metricCaption("atPickup")} icon="truck" color="#2469e8" />
        <Metric label="At Delivery" value={metricValue("atDelivery")} caption={metricCaption("atDelivery")} icon="clipboard-check" color="#f5a524" />
        <Metric label="Returning Container" value={metricValue("returningContainer")} caption={metricCaption("returningContainer")} icon="layers" color="#0e9f9a" />
        <Metric label="Delayed" value={metricValue("delayed")} caption={metricCaption("delayed")} icon="clock" color="#e02b22" />
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h3>All Trips <small>({tripsResponse?.pagination.total ?? 0})</small></h3>
            <p>Click a trip to view its latest available details.</p>
          </div>
          <SearchField placeholder="Search trip, job, route, truck or driver…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="jobs-filters">
          <FilterMenu
            label="Trip Status"
            value={statusFilter}
            active={statusFilter !== "All Trips"}
            open={openFilter === "status"}
            onToggle={() => setOpenFilter(openFilter === "status" ? null : "status")}
            options={["All Trips", ...TRIP_STATUSES]}
            onSelect={(value) => { setStatusFilter(value); setOpenFilter(null); }}
          />
          <FilterMenu
            label="Origin"
            value={originFilter}
            active={originFilter !== "All Locations"}
            open={openFilter === "origin"}
            onToggle={() => setOpenFilter(openFilter === "origin" ? null : "origin")}
            options={["All Locations", ...origins]}
            onSelect={(value) => { setOriginFilter(value); setOpenFilter(null); }}
          />
          <FilterMenu
            label="Destination"
            value={destFilter}
            active={destFilter !== "All Locations"}
            open={openFilter === "destination"}
            onToggle={() => setOpenFilter(openFilter === "destination" ? null : "destination")}
            options={["All Locations", ...destinations]}
            onSelect={(value) => { setDestFilter(value); setOpenFilter(null); }}
          />
          <FilterMenu
            label="Driver"
            value={driverFilter}
            active={driverFilter !== "All Drivers"}
            open={openFilter === "driver"}
            onToggle={() => setOpenFilter(openFilter === "driver" ? null : "driver")}
            options={["All Drivers", ...drivers]}
            onSelect={(value) => { setDriverFilter(value); setDriverId(value === "All Drivers" ? null : trips.find((trip) => trip.driverName === value)?.driverId || null); setOpenFilter(null); }}
          />
          <FilterMenu
            label="Date Range"
            value={dateFilter}
            active={dateFilter !== "All Dates"}
            open={openFilter === "date"}
            onToggle={() => setOpenFilter(openFilter === "date" ? null : "date")}
            options={DATE_OPTIONS}
            onSelect={(value) => { setDateFilter(value); setOpenFilter(null); }}
          />
          <Button variant="outline" icon="rotate-cw" onClick={resetFilters}>Reset</Button>
        </div>

        {!error && filtered.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center" }} className="tk-meta">No trips match the current filters.</div>
        ) : (
          <DataTable rows={filtered} columns={columns} onRowClick={(trip) => setSelectedId(trip.id)} />
        )}
        <Pagination
          page={tripsResponse?.pagination.page || page}
          pageCount={Math.max(1, tripsResponse?.pagination.totalPages || 1)}
          pageSize={tripsResponse?.pagination.limit || PAGE_SIZE}
          total={tripsResponse?.pagination.total ?? 0}
          onPage={(next) => setPage(Math.min(Math.max(1, next), Math.max(1, tripsResponse?.pagination.totalPages || 1)))}
        />
      </div>

      <Modal
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        width={640}
        title={selectedTrip?.id || selectedId}
        description={selectedTrip?.route || ""}
      >
        {detailLoading && !selectedTrip && <Skeleton height={240} />}
        {detailError && <Banner tone="warning" title={apiErrorMessage(detailError, "Unable to load trip details.")} action={<Button variant="outline" size="sm" onClick={refetchDetail}>Retry</Button>} />}
        {selectedTrip && (
          <div style={{ display: "grid", gap: 14 }}>
            {detailFetching && !detailLoading && <Banner tone="info" title="Refreshing trip details…" />}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={tones[selectedTrip.status] || "neutral"} dot>{selectedTrip.status}</Badge>
              {selectedTrip.statusLabel && <span className="tk-meta">{selectedTrip.statusLabel}</span>}
            </div>
            <div style={{ height: 180, position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--tk-line-strong)" }}>
              <TriangulationGoogleMap
                points={selectedMapPoints}
                selectedId={selectedTrip.id}
                ariaLabel="Trip truck location map"
                emptyMessage="No truck GPS position is available for this trip."
              />
            </div>
            <span className="tk-meta">
              {selectedMapPoints.length
                ? `Truck GPS: ${selectedMapPoints[0].lat}, ${selectedMapPoints[0].lng} · Updated ${selectedTrip.truck.displayLastLocationUpdate || "—"}`
                : `${selectedTrip.currentLocation.description || "No location update available."}${selectedTrip.currentLocation.source === "TRIP_STATUS" ? " (trip status, not truck GPS)" : ""}`}
            </span>
            {[
              ["Job", selectedTrip.jobNumber],
              ["Container", selectedTrip.containerNumber || "—"],
              ["Driver", selectedTrip.driverName || "—"],
              ["Truck", selectedTrip.truck?.plateNumber || "—"],
              ["ETA", selectedTrip.displayEta || "—"],
              ["Current Segment", selectedTrip.currentSegment ? `${selectedTrip.currentSegment.index} of ${selectedTrip.currentSegment.total} · ${selectedTrip.currentSegment.label}` : selectedTrip.segmentLabel],
              ["Distance Left", distanceText(selectedTrip.distance.remainingKm)],
              ["Total Distance", distanceText(selectedTrip.distance.totalKm)],
              ["Progress", selectedTrip.progressPercent == null ? "—" : `${selectedTrip.progressPercent}%`],
              ["Trip Value", selectedTrip.financials.tripValue == null ? "—" : `₦${Number(selectedTrip.financials.tripValue).toLocaleString("en-NG")}`],
            ].map(([label, value]) => (
              <div className="trip-fact" key={label}><span>{label}</span><b>{value}</b></div>
            ))}
            {selectedTrip.milestones.length > 0 && <div className="trip-fact"><span>Milestones</span><b>{selectedTrip.milestones.map((item) => `${item.label}${item.completed ? " ✓" : ""}`).join(" · ")}</b></div>}
            {selectedTrip.issues.length > 0 && <div className="trip-fact"><span>Issues</span><b>{selectedTrip.issues.map((issue) => issue.description || issue.type).join(" · ")}</b></div>}
            {selectedTrip.otherTripsOnJob.length > 0 && <div className="trip-fact"><span>Other Trips On Job</span><b>{selectedTrip.otherTripsOnJob.map((trip) => trip.containerNumber || trip.id).join(", ")}</b></div>}
            {selectedTrip.jobId && (
              <Button
                variant="outline"
                icon="briefcase-business"
                onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(selectedTrip.jobId)}`)}
              >
                View Job Details
              </Button>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {canManageTrips && selectedTrip.canMarkDelayed && !selectedTrip.isDelayed && <Button variant="outline" onClick={() => openAction("delay", selectedTrip)}>Mark Delayed</Button>}
              {canManageTrips && selectedTrip.isDelayed && selectedTrip.delayReason && <Button variant="outline" onClick={() => openAction("clear-delay", selectedTrip)}>Clear Delay Flag</Button>}
              {canManageTrips && selectedTrip.canMarkAtDelivery && <Button variant="outline" onClick={() => openAction("delivery", selectedTrip)}>Mark At Delivery</Button>}
              {selectedTrip.driverId && <Button variant="outline" onClick={() => openAction("message", selectedTrip)}>Message Driver</Button>}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(actionDialog)}
        onClose={() => { if (!actionBusy) setActionDialog(null); }}
        title={actionDialog?.type === "delay" ? "Mark Trip Delayed" : actionDialog?.type === "clear-delay" ? "Clear Delay Flag" : actionDialog?.type === "delivery" ? "Mark At Delivery" : "Message Driver"}
        description={actionDialog?.trip?.jobNumber || actionDialog?.trip?.id || ""}
        footer={<>
          <Button variant="outline" disabled={actionBusy} onClick={() => setActionDialog(null)}>Close</Button>
          <Button disabled={actionBusy || (["delay", "message"].includes(actionDialog?.type) && !actionText.trim())} onClick={() => void confirmAction()}>
            {actionBusy ? "Saving…" : actionDialog?.type === "delay" ? "Mark Delayed" : actionDialog?.type === "clear-delay" ? "Clear Flag" : actionDialog?.type === "delivery" ? "Mark At Delivery" : "Send Message"}
          </Button>
        </>}
      >
        {actionDialog?.type === "delay" && <Banner tone="warning" title="This flags every trip on the job as delayed and notifies the forwarder and trucker." />}
        {actionDialog?.type === "delivery" && <Banner tone="warning" title="This starts the forwarder’s offloading grace period for the whole job." />}
        {actionDialog?.type === "clear-delay" && <Banner tone="info" title="This clears the manual delay flag. Automatic delays may remain." />}
        {actionError && <Banner tone="danger" title={actionError} style={{ marginTop: 12 }} />}
        {["delay", "message"].includes(actionDialog?.type) && <Textarea
          label={actionDialog?.type === "delay" ? "Reason" : "Message"}
          required
          rows={4}
          maxLength={actionDialog?.type === "delay" ? 500 : 2000}
          value={actionText}
          disabled={actionBusy}
          onChange={(event) => setActionText(event.target.value)}
          placeholder={actionDialog?.type === "delay" ? "Explain the delay" : "Write a message to the driver"}
          style={{ marginTop: 14 }}
        />}
      </Modal>
    </div>
  );
}
