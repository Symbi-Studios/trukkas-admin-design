"use client";

import { useEffect, useMemo, useState } from "react";
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
  Skeleton,
} from "../ds.js";
import { useGetAdminTripsQuery } from "../store/features/trips/tripsApi.js";
import "./Operations.css";

const PAGE_SIZE = 10;
const TRIP_STATUSES = [
  "In Transit",
  "At Pickup",
  "Delivered",
  "Delayed",
  "At Delivery",
  "Returning Container",
];
const STATUS_TO_API = {
  "In Transit": "InTransit",
  "At Pickup": "AtPickup",
  Delivered: "Delivered",
  Delayed: "Delayed",
};
const tones = {
  "In Transit": "success",
  "At Pickup": "purple",
  "At Delivery": "orange",
  "Returning Container": "teal",
  Delayed: "danger",
  Delivered: "success",
};

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

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All Trips");
  const [originFilter, setOriginFilter] = useState("All Locations");
  const [destFilter, setDestFilter] = useState("All Locations");
  const [driverFilter, setDriverFilter] = useState("All Drivers");
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [toast, setToast] = useState(null);

  const serverStatus = STATUS_TO_API[statusFilter];
  const {
    currentData: tripsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminTripsQuery({ page, limit: PAGE_SIZE, statusFilter: serverStatus }, {
    refetchOnMountOrArgChange: true,
  });
  const { currentData: allTripsResponse } = useGetAdminTripsQuery({ page: 1, limit: 1 });

  const trips = tripsResponse?.rows || [];
  const origins = useMemo(() => [...new Set(trips.map((trip) => trip.origin).filter(Boolean))], [trips]);
  const destinations = useMemo(() => [...new Set(trips.map((trip) => trip.destination).filter(Boolean))], [trips]);
  const drivers = useMemo(() => [...new Set(trips.map((trip) => trip.driverName).filter(Boolean))], [trips]);
  const localStatus = statusFilter !== "All Trips" && !serverStatus ? statusFilter : null;
  const filtered = useMemo(() => trips.filter((trip) => (
    (!localStatus || trip.status === localStatus)
    && (originFilter === "All Locations" || trip.origin === originFilter)
    && (destFilter === "All Locations" || trip.destination === destFilter)
    && (driverFilter === "All Drivers" || trip.driverName === driverFilter)
  )), [destFilter, driverFilter, localStatus, originFilter, trips]);
  const selectedTrip = trips.find((trip) => trip.id === selectedId) || null;
  const hasLocalFilters = Boolean(
    localStatus || originFilter !== "All Locations"
    || destFilter !== "All Locations" || driverFilter !== "All Drivers",
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, originFilter, destFilter, driverFilter]);

  useEffect(() => {
    if (selectedId && !selectedTrip) setSelectedId(null);
  }, [selectedId, selectedTrip]);

  function resetFilters() {
    setStatusFilter("All Trips");
    setOriginFilter("All Locations");
    setDestFilter("All Locations");
    setDriverFilter("All Drivers");
    setOpenFilter(null);
    setPage(1);
  }

  function exportTrips() {
    if (!filtered.length) return;
    const rows = [
      ["Trip ID", "Job", "Container", "Route", "Driver", "Truck", "Status", "ETA", "Last Location Update"],
      ...filtered.map((trip) => [
        trip.id,
        trip.jobNumber,
        trip.containerNumber,
        trip.route,
        trip.driverName,
        trip.truck?.plateNumber,
        trip.status,
        trip.eta,
        trip.truck?.lastLocationUpdate,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `trukkas-trips-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast({ tone: "success", title: `${filtered.length} trip${filtered.length === 1 ? "" : "s"} exported.` });
  }

  function metricValue(label) {
    if (statusFilter === label && tripsResponse) return tripsResponse.pagination.total.toLocaleString();
    return "—";
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
    { key: "type", header: "Trip Type", render: () => <Badge tone="purple">Container Trip</Badge> },
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
    { key: "segment", header: "Current Segment", render: () => "—" },
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
        <span className="cell-two"><strong>{trip.displayEta || "—"}</strong><small>Distance unavailable</small></span>
      ),
    },
    { key: "progress", header: "Progress", width: 100, render: () => "—" },
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
            <button className="date-button" disabled title="The trips API does not provide date filtering.">
              <Icon name="calendar" size={15} />Date range unavailable
            </button>
            <Button icon="download" disabled={!filtered.length} onClick={exportTrips}>Export</Button>
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

      <div className="kpi-grid">
        <Metric label="All Trips" value={allTripsResponse?.pagination.total?.toLocaleString() || "—"} caption="Across all pages" icon="briefcase-business" />
        <Metric label="In Transit" value={metricValue("In Transit")} caption={statusFilter === "In Transit" ? "Across all pages" : "Total unavailable"} icon="route" color="#12a150" />
        <Metric label="At Pickup" value={metricValue("At Pickup")} caption={statusFilter === "At Pickup" ? "Across all pages" : "Total unavailable"} icon="truck" color="#2469e8" />
        <Metric label="At Delivery" value="—" caption="Not reported by API" icon="clipboard-check" color="#f5a524" />
        <Metric label="Returning Container" value="—" caption="Not reported by API" icon="layers" color="#0e9f9a" />
        <Metric label="Delayed" value={metricValue("Delayed")} caption={statusFilter === "Delayed" ? "Across all pages" : "Total unavailable"} icon="clock" color="#e02b22" />
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div>
            <h3>All Trips <small>({hasLocalFilters ? filtered.length : tripsResponse?.pagination.total ?? 0})</small></h3>
            <p>Click a trip to view its latest available details.</p>
          </div>
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
            onSelect={(value) => { setDriverFilter(value); setOpenFilter(null); }}
          />
          <button className="jobs-filter" disabled><span>Date Range</span>Unavailable</button>
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
          total={hasLocalFilters ? undefined : tripsResponse?.pagination.total ?? 0}
          onPage={(next) => setPage(Math.min(Math.max(1, next), Math.max(1, tripsResponse?.pagination.totalPages || 1)))}
        />
      </div>

      <Modal
        open={!!selectedTrip}
        onClose={() => setSelectedId(null)}
        width={640}
        title={selectedTrip?.id}
        description={selectedTrip?.route || ""}
      >
        {selectedTrip && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={tones[selectedTrip.status] || "neutral"} dot>{selectedTrip.status}</Badge>
              {selectedTrip.statusLabel && <span className="tk-meta">{selectedTrip.statusLabel}</span>}
            </div>
            <div
              style={{
                minHeight: 180,
                borderRadius: 10,
                border: "1.5px dashed var(--tk-line-strong)",
                background: "var(--tk-surface-sunk)",
                display: "grid",
                placeItems: "center",
                gap: 8,
                textAlign: "center",
                color: "var(--tk-ink-300)",
                padding: 20,
              }}
            >
              <Icon name="map-pin" size={30} />
              {selectedTrip.truck?.latitude != null && selectedTrip.truck?.longitude != null ? (
                <>
                  <strong style={{ color: "var(--tk-ink-700)" }}>{selectedTrip.truck.latitude}, {selectedTrip.truck.longitude}</strong>
                  <span className="tk-meta">Last updated {selectedTrip.truck.displayLastLocationUpdate || "—"}</span>
                </>
              ) : <span className="tk-meta">No live position available.</span>}
            </div>
            {[
              ["Job", selectedTrip.jobNumber],
              ["Container", selectedTrip.containerNumber || "—"],
              ["Driver", selectedTrip.driverName || "—"],
              ["Truck", selectedTrip.truck?.plateNumber || "—"],
              ["ETA", selectedTrip.displayEta || "—"],
              ["Current Segment", "—"],
              ["Distance Left", "—"],
              ["Progress", "—"],
            ].map(([label, value]) => (
              <div className="trip-fact" key={label}><span>{label}</span><b>{value}</b></div>
            ))}
            {selectedTrip.jobId && (
              <Button
                variant="outline"
                icon="briefcase-business"
                onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(selectedTrip.jobId)}`)}
              >
                View Job Details
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
