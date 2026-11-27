"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, ComponentProps, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ToastRelay } from "../components/ActionToast.jsx";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { DateRangeFilter } from "../components/DateRangeFilter.jsx";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CopyableId,
  DataTable,
  DrawerFacts,
  DrawerSection,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  Pagination,
  RouteStack,
  SearchField,
  SideDrawer,
  Skeleton,
  StatCard,
  StatsPanel,
  Textarea,
} from "../ds.js";
import { statsPeriod } from "../domain/statsPeriod.js";
import { FilterControl } from "./FilterControl";
import { TableSkeleton } from "./TableSkeleton";
import { JobDetailMap } from "./JobDetailMap";
import { DEFAULT_PERIOD } from "@/lib/dateRange";
import { downloadCsv, formatDateTime, today } from "@/lib/format";
import { CARGO_KIND_OPTIONS } from "@/domain/cargo";
import { MOVEMENT_FILTER_OPTIONS } from "@/domain/movement";
import { TRIP_TABS, tripTone } from "@/domain/tripStatus";
import { markTripAtDeliveryAction, markTripDelayedAction } from "@/lib/jobs/detail-actions";
import { clearTripDelayAction, exportTripsAction, getTripAction, messageDriverAction } from "@/lib/trips/actions";
import type { ApiResult } from "@/types/api";
import type { PortOption } from "@/types/jobs";
import type { TripRow, TripsFilters, TripsPage, TripStatCardKey, TripStats } from "@/types/trips";
import styles from "./JobsTrips.module.css";
import "./Trips.css";
// the map in the drawer is the one on the job page, and its styles live with it
import "./JobDetail.css";
import "./JobDetailExtras.css";

// The URL holds the filters, the search and the page. The Next.js server asks the backend for exactly that page (app/trips/page.tsx).
export interface TripsScreenQuery extends TripsFilters {
  page: number;
  limit: number;
  /** the trip whose drawer is open when the page loads (a link from search or from another screen) */
  tripId: string;
}

interface TripsProps {
  query: TripsScreenQuery;
  trips: TripsPage | null;
  stats: TripStats | null;
  ports: PortOption[];
  error: string | null;
  warnings: string[];
  role: string | null;
}

type StatTint = NonNullable<ComponentProps<typeof StatCard>["tint"]>;

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "OPS_ADMIN"]);
const ALL_TRIPS = "All Trips";
const ALL_MOVEMENTS = "All Movements";
const ALL_CARGO = "All Cargo";
const ALL_PORTS = "All Ports";

const STAT_CARDS: [TripStatCardKey, string, string, StatTint, boolean][] = [
  ["allTrips", "All Trips", "briefcase-business", "blue", true],
  ["inTransit", "In Transit", "route", "blue", true],
  ["atPickup", "At Pickup", "truck", "amber", true],
  ["atDelivery", "At Delivery", "clipboard-check", "green", true],
  ["returningContainer", "Returning Container", "layers", "blue", true],
  ["delayed", "Delayed", "clock", "red", false],
];

const MAP_FRAME: CSSProperties = { position: "relative", height: 260, overflow: "hidden", borderRadius: 12, isolation: "isolate" };

function driverInfo(trip: TripRow): { name: string; detail: string; empty: boolean } {
  if (trip.driverName) {
    return { name: trip.driverName, detail: trip.isOwnerDriver ? "Drives own truck" : trip.driverPhone || trip.truckingCompany || "Driver", empty: false };
  }
  if (trip.truckingCompany) return { name: trip.truckingCompany, detail: "No separate driver", empty: false };
  return { name: "Not assigned", detail: "No driver or trucker yet", empty: true };
}

function DriverCell({ trip }: { trip: TripRow }) {
  const info = driverInfo(trip);
  return (
    <span className={`tk-cell-person${info.empty ? " empty" : ""}`}>
      {info.empty
        ? <span className="tk-cell-placeholder"><Icon name="user" size={14} /></span>
        : <Avatar name={info.name} src={trip.driverAvatarUrl || undefined} size={32} />}
      <span><strong title={info.name}>{info.name}</strong><small title={info.detail}>{info.detail}</small></span>
    </span>
  );
}

const kmLeft = (km: number | null): string | null => (km == null ? null : `${km.toLocaleString("en-NG", { maximumFractionDigits: 1 })} km left`);

interface DetailState {
  id: string | null;
  status: "loading" | "ready" | "error";
  trip: TripRow | null;
  message: string | null;
}

interface DrawerProps {
  trip: TripRow;
  detail: DetailState;
  canManage: boolean;
  busy: boolean;
  actionError: string;
  contactOpen: boolean;
  message: string;
  onMessage: (value: string) => void;
  onContact: (open: boolean) => void;
  onSend: () => void;
  onRetry: () => void;
  onClose: () => void;
  onMarkDelayed: () => void;
  onClearDelay: () => void;
  onMarkAtDelivery: () => void;
  onViewJob: () => void;
  onViewPayout: () => void;
}

function TripDrawer({
  trip, detail, canManage, busy, actionError, contactOpen, message, onMessage, onContact, onSend, onRetry, onClose,
  onMarkDelayed, onClearDelay, onMarkAtDelivery, onViewJob, onViewPayout,
}: DrawerProps) {
  const driver = driverInfo(trip);
  const manualDelay = trip.isDelayed && Boolean(trip.delayReason);
  const mapCaption = trip.position
    ? `${trip.live ? "Live" : "Last known position"} · ${formatDateTime(trip.positionUpdatedAt)}`
    : "No GPS position has been received yet.";
  const footer = contactOpen ? (
    <div className="tk-drawer-footer-row">
      <Button variant="outline" disabled={busy} onClick={() => onContact(false)}>Back</Button>
      <Button icon="send" disabled={busy || !message.trim() || message.trim().length > 2000} onClick={onSend}>Send Message</Button>
    </div>
  ) : (
    <>
      <div className="tk-drawer-footer-row">
        {manualDelay
          ? <Button variant="outline" icon="clock" disabled={busy || !canManage} onClick={onClearDelay}>Clear Delay</Button>
          : <Button variant="outline" icon="clock" disabled={busy || !canManage || !trip.canMarkDelayed || trip.isDelayed || !trip.jobId} onClick={onMarkDelayed}>Mark Delayed</Button>}
        <Button variant="outline" icon="map-pin" disabled={busy || !canManage || !trip.canMarkAtDelivery || !trip.jobId} onClick={onMarkAtDelivery}>Mark At Delivery</Button>
      </div>
      <div className="tk-drawer-footer-row">
        {trip.payout && <Button variant="outline" onClick={onViewPayout}>View Payout</Button>}
        <Button variant="outline" icon="briefcase-business" disabled={!trip.jobId} onClick={onViewJob}>View Job</Button>
        <Button icon="message-circle" disabled={busy || !trip.driverId} onClick={() => onContact(true)}>Contact Driver</Button>
      </div>
    </>
  );
  return (
    <SideDrawer
      label="Trip details"
      eyebrow="Trip"
      onClose={onClose}
      headerActions={<IconButton icon="maximize-2" label="Open job page" onClick={onViewJob} />}
      footer={footer}
      title={trip.jobNumber !== "—" ? <CopyableId id={trip.jobNumber} size="lg" onCopy={(value: string) => navigator.clipboard?.writeText(value)} /> : trip.id}
      meta={<>
        <Badge tone={tripTone(trip.status)} dot>{trip.status}</Badge>
        {trip.movement && <Badge tone="purple">{trip.movement}</Badge>}
        {trip.live && <span className="trips-live">Live</span>}
      </>}
    >
      {detail.status === "loading" && <Skeleton height={24} />}
      {detail.status === "error" && <Banner tone="warning" title={detail.message ?? "The trip details couldn’t be loaded."} action={<Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>} />}
      {actionError && <Banner tone="danger" title={actionError} />}
      {contactOpen ? (
        <DrawerSection title="Message driver">
          <DrawerFacts items={[{ label: "To", value: driver.name, sub: trip.truckPlate ?? "—", wide: true }]} />
          <Textarea label="Message" placeholder={`Write a message to ${driver.name}...`} rows={6} maxLength={2000} disabled={busy} value={message} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onMessage(event.target.value)} />
        </DrawerSection>
      ) : (
        <>
          <div className="tk-drawer-card"><RouteStack from={trip.origin} to={trip.destination} wrap /></div>

          <div style={MAP_FRAME}>
            <JobDetailMap
              origin={trip.origin}
              destination={trip.destination}
              liveLocation={trip.position ? { ...trip.position, title: [trip.truckPlate, trip.locationDescription].filter(Boolean).join(" · ") } : null}
              locationCaption={mapCaption}
              ariaLabel="Trip truck location map"
              zoomControl
            />
          </div>

          {manualDelay && <div className="tk-drawer-note"><Icon name="clock" size={16} /><span>Marked delayed by an admin: {trip.delayReason}</span></div>}

          <DrawerSection title="Progress">
            <DrawerFacts items={[
              { label: "Current stage", value: trip.stage },
              { label: "Progress", value: trip.progress == null ? "—" : `${trip.progress}%` },
              { label: "ETA", value: formatDateTime(trip.eta) },
              { label: "Distance left", value: kmLeft(trip.distanceLeftKm) ?? "—" },
            ]} />
          </DrawerSection>

          <DrawerSection title="Driver & truck">
            <DrawerFacts items={[
              { label: "Driver", value: driver.name, sub: driver.detail },
              { label: "Trucking company", value: trip.truckingCompany ?? "—" },
              { label: "Truck", value: trip.truckPlate ?? "—" },
              { label: "Container", value: trip.container },
            ]} />
          </DrawerSection>

          <DrawerSection title="Payment">
            <DrawerFacts items={[{ label: "Company payout", value: trip.payout ? `${trip.payout.id} · ${trip.payout.status}` : "—", wide: true }]} />
          </DrawerSection>

          {trip.issues.length > 0 && (
            <DrawerSection title={`Reported issues (${trip.issues.length})`}>
              {trip.issues.map((issue) => (
                <div className="trips-issue" key={issue.id}>
                  <div className="trips-issue-head">
                    <Badge tone={issue.resolvedAt ? "success" : "danger"}>{issue.type}</Badge>
                    <span className="tk-meta">{issue.status}</span>
                  </div>
                  <p>{issue.description ?? "—"}</p>
                  <span className="tk-meta">
                    {issue.reportedBy ?? "—"} · {formatDateTime(issue.createdAt)}{issue.resolvedAt ? ` · Resolved ${formatDateTime(issue.resolvedAt)}` : ""}
                  </span>
                  {issue.photoUrls.length > 0 && (
                    <span className="trips-issue-photos">
                      {issue.photoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Photo {index + 1}</a>)}
                    </span>
                  )}
                </div>
              ))}
            </DrawerSection>
          )}
        </>
      )}
    </SideDrawer>
  );
}

export function TripsLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <PageHeader crumbs={["Jobs & Trips", "Trips"]} title="Trips" description="Trips in progress, from the moment a driver is assigned until delivery." />
      <div className="tk-sr-only" role="status" aria-live="polite">Loading trips…</div>
      <section className={styles.metrics} aria-label="Loading trip summary">
        {STAT_CARDS.map(([, label, icon, tint]) => (
          <StatCard
            key={label}
            icon={icon}
            label={label}
            tint={tint}
            value={<Skeleton as="span" width={54} height={23} />}
            caption={<Skeleton as="span" width={86} height={11} />}
            style={{ minHeight: 92, padding: 13 }}
          />
        ))}
      </section>
      <Card pad="none" className={styles.workspace}>
        <TableSkeleton />
      </Card>
    </div>
  );
}

interface Toast {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
}

export function Trips({ query, trips, stats, ports, error, warnings, role }: TripsProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const canManage = role != null && MANAGE_ROLES.has(role);
  const rows = useMemo(() => trips?.trips ?? [], [trips]);
  const pagination = trips?.pagination;

  const [search, setSearch] = usePageSearchState(query.search, () => {}) as [string, (next: string) => void];
  const [menu, setMenu] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(query.tripId || null);
  const [detail, setDetail] = useState<DetailState>({ id: null, status: "loading", trip: null, message: null });
  const [detailVersion, setDetailVersion] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [delayTarget, setDelayTarget] = useState<TripRow | null>(null);
  const [reason, setReason] = useState("");

  // Change the URL, and the server loads the new page.
  const go = (patch: Partial<TripsScreenQuery>) => {
    const next = { ...query, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.tab !== "all") params.set("status", next.tab);
    if (next.type) params.set("type", next.type);
    if (next.cargoKind) params.set("cargoKind", next.cargoKind);
    if (next.port) params.set("port", next.port);
    if (next.from && next.to) { params.set("from", next.from); params.set("to", next.to); }
    if (next.search) params.set("search", next.search);
    if (next.page > 1) params.set("page", String(next.page));
    if (next.limit !== 10) params.set("limit", String(next.limit));
    if (next.period !== DEFAULT_PERIOD) params.set("period", next.period);
    const text = params.toString();
    startTransition(() => router.push(text ? `/trips?${text}` : "/trips"));
  };

  // Search while typing, after a short pause, so each key does not call the backend.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const value = search.trim();
    if (value === query.search) return undefined;
    const timer = setTimeout(() => goRef.current({ search: value }), 400);
    return () => clearTimeout(timer);
  }, [search, query.search]);

  // The drawer asks the Next.js server for the open trip: its reported issues and its payout come with it.
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setDetail({ id: selectedId, status: "loading", trip: null, message: null });
    getTripAction(selectedId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result.ok
          ? { id: selectedId, status: "ready", trip: result.data, message: null }
          : { id: selectedId, status: "error", trip: null, message: result.error.message });
      })
      .catch(() => { if (!cancelled) setDetail({ id: selectedId, status: "error", trip: null, message: "The trip details couldn’t be loaded." }); });
    return () => { cancelled = true; };
  }, [selectedId, detailVersion]);

  // the list row shows at once; the full trip replaces it when it arrives
  const selectedTrip = selectedId
    ? (detail.id === selectedId ? detail.trip : null) ?? rows.find((row) => row.id === selectedId) ?? null
    : null;

  const portName = ports.find((port) => port.id === query.port)?.name ?? (query.port ? "Selected port" : ALL_PORTS);
  const tabLabel = TRIP_TABS.find((item) => item.value === query.tab)?.label ?? ALL_TRIPS;
  const movementLabel = MOVEMENT_FILTER_OPTIONS.find((item) => item.value === query.type)?.label ?? ALL_MOVEMENTS;
  const cargoLabel = CARGO_KIND_OPTIONS.find((item) => item.value === query.cargoKind)?.label ?? ALL_CARGO;
  const dateRange = { from: query.from, to: query.to };
  const hasRange = Boolean(query.from && query.to);
  const filtersActive = query.tab !== "all" || query.period !== DEFAULT_PERIOD || Boolean(query.type || query.cargoKind || query.port || hasRange || query.search);

  const resetFilters = () => {
    setSearch("");
    go({ tab: "all", type: "", cargoKind: "", port: "", from: "", to: "", period: DEFAULT_PERIOD, search: "" });
  };

  const statCaption = hasRange ? "vs previous period" : statsPeriod(query.period)?.vs;
  // All time has nothing to compare with, so no change is shown
  const allTime = query.period === "all" && !hasRange;
  const statValue = (key: TripStatCardKey) => stats?.cards[key]?.value?.toLocaleString("en-NG") ?? "—";
  const statDelta = (key: TripStatCardKey) => {
    const change = stats?.cards[key]?.changePercent;
    return allTime || change == null ? undefined : `${Math.abs(change)}%`;
  };
  const statDirection = (key: TripStatCardKey) => {
    const trend = stats?.cards[key]?.trend;
    return allTime ? null : trend === "DOWN" ? "down" : trend === "UP" ? "up" : null;
  };

  function openTrip(id: string | null) {
    setSelectedId(id);
    setContactOpen(false);
    setMessage("");
    setActionError("");
  }

  async function exportAllTrips() {
    setExporting(true);
    try {
      const result = await exportTripsAction(query);
      if (!result.ok) { setToast({ tone: "danger", title: result.error.message }); return; }
      downloadCsv(result.data, `trips-export-${today()}.csv`);
      setToast({ tone: "success", title: "Trips exported." });
    } catch {
      setToast({ tone: "danger", title: "Unable to export trips." });
    } finally {
      setExporting(false);
    }
  }

  // One place for every change to a trip: lock the buttons, show the backend's message, then reload.
  async function perform(run: () => Promise<ApiResult<null>>, success: string) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const result = await run();
      if (!result.ok) {
        setActionError(result.error.message);
        setToast({ tone: "danger", title: result.error.message });
        return;
      }
      setContactOpen(false);
      setMessage("");
      setDelayTarget(null);
      setReason("");
      setToast({ tone: "success", title: success });
      setDetailVersion((version) => version + 1);
      router.refresh();
    } catch {
      setActionError("Unable to update this trip.");
      setToast({ tone: "danger", title: "Unable to update this trip." });
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "trip",
      header: "Trip",
      width: "15%",
      render: (trip: TripRow) => <span className="tk-cell-id"><strong>{trip.jobNumber}</strong><small>{trip.container}</small></span>,
    },
    { key: "route", header: "Route", width: "27%", render: (trip: TripRow) => <RouteStack from={trip.origin} to={trip.destination} /> },
    { key: "type", header: "Type", width: "10%", render: (trip: TripRow) => (trip.movement ? <Badge tone="purple">{trip.movement}</Badge> : "—") },
    { key: "driver", header: "Driver", width: "19%", render: (trip: TripRow) => <DriverCell trip={trip} /> },
    {
      key: "truck",
      header: "Truck",
      width: "10%",
      render: (trip: TripRow) => (trip.truckPlate ? <span className="tk-plate"><Icon name="truck" size={13} />{trip.truckPlate}</span> : "—"),
    },
    { key: "status", header: "Status", width: "10%", render: (trip: TripRow) => <Badge tone={tripTone(trip.status)} dot>{trip.status}</Badge> },
    {
      key: "eta",
      header: "ETA",
      width: "9%",
      render: (trip: TripRow) => <span className="tk-cell-two"><strong>{trip.eta ? formatDateTime(trip.eta) : "—"}</strong>{kmLeft(trip.distanceLeftKm) && <small>{kmLeft(trip.distanceLeftKm)}</small>}</span>,
    },
  ];

  const pageCount = Math.max(1, pagination?.totalPages ?? 1);

  return (
    <div className={styles.page}>
      <PageHeader crumbs={["Jobs & Trips", "Trips"]} title="Trips" description="Trips in progress, from the moment a driver is assigned until delivery." />
      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      <div className="tk-sr-only" role="status" aria-live="polite">{loading ? "Loading trips…" : ""}</div>
      {error && <Banner tone="danger" title="Unable to load trips." action={<Button variant="outline" size="sm" icon="rotate-ccw" onClick={() => router.refresh()}>Retry</Button>}>{error}</Banner>}
      {warnings.map((warning) => <Banner key={warning} tone="warning" title={warning} action={<Button variant="outline" size="sm" onClick={() => router.refresh()}>Retry</Button>} />)}

      <StatsPanel period={query.period} onPeriodChange={(period: string) => go({ period, from: "", to: "" })}>
        {STAT_CARDS.map(([key, label, icon, tint, higherIsBetter]) => (
          <StatCard
            key={key}
            icon={icon}
            tint={tint}
            label={label}
            value={statValue(key)}
            delta={statDelta(key)}
            direction={statDirection(key)}
            higherIsBetter={higherIsBetter}
            caption={statCaption}
            style={{ minHeight: 92, padding: 13 }}
          />
        ))}
      </StatsPanel>

      <Card pad="none" className={styles.workspace}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarSearch}>
            <SearchField
              placeholder="Search trips…"
              title="Search by trip ID, job ID, container, truck or driver"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            />
          </div>
          <div className="tk-list-toolbar-filters" role="group" aria-label="Filter trips">
            <FilterControl name="Status" icon="circle-dot" value={tabLabel} allValue={ALL_TRIPS} options={[ALL_TRIPS, ...TRIP_TABS.map((item) => item.label)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ tab: TRIP_TABS.find((item) => item.label === label)?.value ?? "all" })} />
            <FilterControl name="Movement" icon="route" value={movementLabel} allValue={ALL_MOVEMENTS} options={[ALL_MOVEMENTS, ...MOVEMENT_FILTER_OPTIONS.map((item) => item.label)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ type: MOVEMENT_FILTER_OPTIONS.find((item) => item.label === label)?.value ?? "" })} />
            <FilterControl name="Cargo" icon="package" value={cargoLabel} allValue={ALL_CARGO} options={[ALL_CARGO, ...CARGO_KIND_OPTIONS.map((item) => item.label)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ cargoKind: CARGO_KIND_OPTIONS.find((item) => item.label === label)?.value ?? "" })} />
            <FilterControl name="Pickup port" icon="map-pin" value={portName} allValue={ALL_PORTS} options={[ALL_PORTS, ...ports.map((port) => port.name)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ port: ports.find((port) => port.name === label)?.id ?? "" })} />
            <DateRangeFilter value={dateRange} onChange={(range: { from: string; to: string }) => go({ from: range.from, to: range.to })} />
            {filtersActive && <button type="button" className="tk-clear-filters" onClick={resetFilters}>Clear all</button>}
          </div>
          <div className={styles.toolbarRight}>
            <Button variant="outline" icon="download" disabled={exporting || !trips || trips.pagination.total === 0} onClick={() => void exportAllTrips()}>
              {exporting ? "Exporting…" : "Export"}
            </Button>
          </div>
        </div>
        {loading ? (
          <TableSkeleton />
        ) : (
          <>
            <DataTable
              rows={rows}
              rowKey={(trip: TripRow) => trip.id}
              columns={columns}
              selected={selectedId ? [selectedId] : []}
              onRowClick={(trip: TripRow) => openTrip(trip.id)}
            />
            {!error && rows.length === 0 && <div className={styles.empty}>No trips match the selected filters.</div>}
            <Pagination
              page={query.page}
              pageCount={pageCount}
              pageSize={query.limit}
              total={pagination?.total}
              onPage={(next: number) => go({ page: Math.min(Math.max(1, next), pageCount) })}
              onPageSize={(size: number) => go({ limit: size })}
            />
          </>
        )}
      </Card>

      {selectedTrip && !delayTarget && (
        <TripDrawer
          trip={selectedTrip}
          detail={detail}
          canManage={canManage}
          busy={busy}
          actionError={actionError}
          contactOpen={contactOpen}
          message={message}
          onMessage={setMessage}
          onContact={(open) => { setContactOpen(open); setActionError(""); }}
          onSend={() => void perform(() => messageDriverAction({ tripId: selectedTrip.id, message }), `Message sent to ${driverInfo(selectedTrip).name}.`)}
          onRetry={() => setDetailVersion((version) => version + 1)}
          onClose={() => { if (!busy) openTrip(null); }}
          onMarkDelayed={() => { setReason(""); setActionError(""); setDelayTarget(selectedTrip); }}
          onClearDelay={() => void perform(() => clearTripDelayAction({ tripId: selectedTrip.id }), "Manual delay cleared for the job and its trips.")}
          onMarkAtDelivery={() => void perform(() => markTripAtDeliveryAction({ tripId: selectedTrip.id, jobId: selectedTrip.jobId ?? "" }), "Job and its trips marked at delivery.")}
          onViewJob={() => { if (selectedTrip.jobId) navigate(`/jobs/${encodeURIComponent(selectedTrip.jobId)}`); }}
          onViewPayout={() => { if (selectedTrip.payout) navigate(selectedTrip.payout.url); }}
        />
      )}

      <Modal
        open={Boolean(delayTarget)}
        onClose={() => { if (!busy) { setDelayTarget(null); setActionError(""); } }}
        title="Mark Trip Delayed"
        description={delayTarget?.jobNumber ?? ""}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => { setDelayTarget(null); setActionError(""); }}>Close</Button>
          <Button
            disabled={busy || !reason.trim() || reason.trim().length > 500}
            onClick={() => { if (delayTarget) void perform(() => markTripDelayedAction({ tripId: delayTarget.id, jobId: delayTarget.jobId ?? "", reason }), "Job and its trips marked delayed."); }}
          >
            {busy ? "Saving…" : "Mark Delayed"}
          </Button>
        </>}
      >
        <Banner tone="warning" title="This flags every trip on the job as delayed and notifies the forwarder and trucker." />
        {actionError && <Banner tone="danger" title={actionError} style={{ marginTop: 12 }} />}
        <Textarea label="Reason" required rows={4} maxLength={500} value={reason} disabled={busy} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)} placeholder="Explain the delay" style={{ marginTop: 14 }} />
      </Modal>
    </div>
  );
}