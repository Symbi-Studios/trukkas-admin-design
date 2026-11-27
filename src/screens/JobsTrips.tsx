"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, ComponentProps, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ToastRelay } from "../components/ActionToast.jsx";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { DateRangeFilter } from "../components/DateRangeFilter.jsx";
import { Link, useNavigate } from "../router.js";
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
  Pagination,
  PageHeader,
  RouteStack,
  SearchField,
  SideDrawer,
  Skeleton,
  StatCard,
  StatsPanel,
  ViewToggle,
  TextField,
} from "../ds.js";
import { statsPeriod } from "../domain/statsPeriod.js";
import { FilterControl } from "./FilterControl";
import { TableSkeleton } from "./TableSkeleton";
import { DEFAULT_PERIOD } from "@/lib/dateRange";
import { csvCell, downloadCsv, formatDateTime, naira, today } from "@/lib/format";
import { CARGO_KIND_OPTIONS } from "@/domain/cargo";
import { MOVEMENT_FILTER_OPTIONS } from "@/domain/movement";
import { statusTone } from "@/domain/jobStatus";
import {
  cancelJobAction,
  exportJobSheetAction,
  exportJobsAction,
  getJobDrawerAction,
  markDeliveredAction,
} from "@/lib/jobs/actions";
import type {
  JobDrawerData,
  JobRow,
  JobsFilters,
  JobsPage,
  JobStatCardKey,
  JobStats,
  JobTab,
  PendingUploads,
  PortOption,
} from "@/types/jobs";
import styles from "./JobsTrips.module.css";

// The URL holds the filters, the search, the page, the view and the stats period.
// The Next.js server asks the backend for exactly that page (app/jobs/page.tsx).
export interface JobsScreenQuery extends JobsFilters {
  page: number;
  limit: number;
  view: "list" | "board";
}

interface JobsProps {
  query: JobsScreenQuery;
  jobs: JobsPage | null;
  stats: JobStats | null;
  /** pickup port names for the Pickup port filter */
  ports: PortOption[];
  pending: PendingUploads | null;
  error: string | null;
  warnings: string[];
  role: string | null;
}

// the design system's own tone and tint names
type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;
type StatTint = NonNullable<ComponentProps<typeof StatCard>["tint"]>;

const DELIVERY_ROLES = new Set(["SUPER_ADMIN", "OPS_ADMIN"]);
const ALL_JOBS = "All Jobs";
const ALL_MOVEMENTS = "All Movements";
const ALL_CARGO = "All Cargo";
const ALL_PORTS = "All Ports";

const TAB_OPTIONS: { label: string; value: JobTab | "all" }[] = [
  { label: ALL_JOBS, value: "all" },
  { label: "Pending Approval", value: "pendingApproval" },
  { label: "Bidding", value: "bidding" },
  { label: "Assigned", value: "assigned" },
  { label: "In Transit", value: "inTransit" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Flagged", value: "flagged" },
  { label: "Rejected", value: "rejected" },
];

// the movements and cargo kinds the app offers, with the app's own names
const MOVEMENT_OPTIONS = MOVEMENT_FILTER_OPTIONS;

const BOARD_COLUMNS: [string, string, BadgeTone][] = [
  ["pendingApproval", "Pending Approval", "warning"],
  ["bidding", "Bidding", "info"],
  ["assigned", "Assigned", "purple"],
  ["inTransit", "In Transit", "info"],
  ["delivered", "Delivered", "success"],
  ["cancelled", "Cancelled", "neutral"],
  ["flagged", "Flagged", "danger"],
  ["rejected", "Rejected", "danger"],
];

function AssigneeCell({ job, size = 32 }: { job: JobRow; size?: number }) {
  if (!job.truckingCompany) return <span className="tk-meta">Unassigned</span>;
  const trips = job.assignedTrips == null || job.totalTrips == null
    ? null
    : `${job.assignedTrips} of ${job.totalTrips} trip${job.totalTrips === 1 ? "" : "s"}`;
  return (
    <span className="tk-cell-person">
      <Avatar name={job.truckingCompany} src={job.truckingCompanyAvatarUrl || undefined} size={size} square />
      <span><strong title={job.truckingCompany}>{job.truckingCompany}</strong>{trips && <small>{trips}</small>}</span>
    </span>
  );
}

interface BoardProps {
  jobs: JobRow[];
  selectedJobId: string | null;
  onOpen: (id: string) => void;
  hideEmpty: boolean;
}

function JobBoard({ jobs, selectedJobId, onOpen, hideEmpty }: BoardProps) {
  const columns = hideEmpty ? BOARD_COLUMNS.filter(([stage]) => jobs.some((job) => job.stage === stage)) : BOARD_COLUMNS;
  return (
    <div className={styles.board} style={{ "--tk-board-lane-count": BOARD_COLUMNS.length, "--tk-board-gap-space": `${(BOARD_COLUMNS.length - 1) * 14}px` } as CSSProperties}>
      {!columns.length && <div className={styles.boardEmpty}>No jobs</div>}
      {columns.map(([stage, label, tone]) => {
        const items = jobs.filter((job) => job.stage === stage);
        return (
          <section className={styles.boardColumn} key={stage} aria-label={label}>
            <header className={styles.boardColumnHead}>
              <Badge tone={tone} dot>{label}</Badge>
              <span className="tk-count-pill">{items.length}</span>
            </header>
            <div className={styles.boardCards}>
              {items.length === 0 && <div className={styles.boardEmpty}>No jobs</div>}
              {items.map((job) => (
                <button
                  type="button"
                  key={job.id}
                  className={`${styles.boardCard} ${selectedJobId === job.id ? styles.boardCardActive : ""}`}
                  onClick={() => onOpen(job.id)}
                >
                  <span className={styles.boardCardTop}>
                    <strong>{job.jobNumber}</strong>
                    <span className="tk-cell-strong">{naira(job.jobValue)}</span>
                  </span>
                  <span className={styles.boardForwarder}>{job.forwarder}</span>
                  <RouteStack from={job.origin} to={job.destination} />
                  <span className={styles.boardCardFoot}>
                    <Badge tone={job.movementCode === "EXPORT" ? "success" : "purple"}>{job.movement}</Badge>
                    <AssigneeCell job={job} size={24} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type JobAction = "view" | "export" | "deliver" | "cancel";

interface DrawerState {
  status: "loading" | "ready" | "error";
  data: JobDrawerData | null;
  message: string | null;
}

interface DrawerProps {
  job: JobRow;
  drawer: DrawerState;
  onRetry: () => void;
  onClose: () => void;
  onAction: (action: JobAction, job: JobRow) => void;
  canDeliver: boolean;
  busy: boolean;
}

function JobDrawer({ job, drawer, onRetry, onClose, onAction, canDeliver, busy }: DrawerProps) {
  const navigate = useNavigate();
  const trips = drawer.data?.trips ?? null;
  const docs = drawer.data?.documents ?? null;
  // One person line under the forwarder: the contact's name only when it differs from the forwarder, then a way to reach them
  const forwarderSub = [job.contactName && job.contactName !== job.forwarder ? job.contactName : null, job.contactPhone ?? job.contactEmail].filter(Boolean).join(" · ");
  const primaryActions = [
    job.canReviewDocs && (
      <Button key="review" icon="file-check-2" disabled={busy} onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(job.id)}&ref=${encodeURIComponent(job.jobNumber)}`)}>
        Review documents
      </Button>
    ),
    job.canMarkDelivered && canDeliver && (
      <Button key="deliver" variant="outline" icon="circle-check" disabled={busy} onClick={() => onAction("deliver", job)}>Mark Delivered</Button>
    ),
  ].filter(Boolean);
  return (
    <SideDrawer
      label="Job details"
      eyebrow="Job"
      onClose={onClose}
      title={<CopyableId id={job.jobNumber} size="lg" onCopy={(value: string) => navigator.clipboard?.writeText(value)} />}
      meta={<>
        <Badge tone={statusTone(job.status)} dot>{job.status}</Badge>
        <Badge tone={job.movementCode === "EXPORT" ? "success" : "purple"}>{job.movement}</Badge>
        {job.health && <span className="tk-meta">{job.health}</span>}
        {job.flagged && <Badge tone="danger" dot>Flagged</Badge>}
      </>}
      headerActions={<IconButton icon="maximize-2" label="Open full page" onClick={() => onAction("view", job)} />}
      footer={<>
        {primaryActions.length > 0 && <div className="tk-drawer-footer-row">{primaryActions}</div>}
        <div className="tk-drawer-footer-row">
          <Button variant="outline" icon="download" disabled={busy} onClick={() => onAction("export", job)}>Export Job Sheet</Button>
          {job.canCancel && <Button variant="danger" icon="ban" disabled={busy} onClick={() => onAction("cancel", job)}>Cancel Job</Button>}
          <Button iconRight="maximize-2" onClick={() => onAction("view", job)}>Open Full Page</Button>
        </div>
      </>}
    >
      <div className="tk-drawer-card"><RouteStack from={job.origin} to={job.destination} wrap /></div>

      <DrawerSection title="Overview">
        <DrawerFacts items={[
          { label: "Forwarder", value: job.forwarder, sub: forwarderSub || undefined },
          { label: "Movement", value: job.movement },
          { label: "Cargo type", value: job.cargoKind ?? "—" },
          { label: "Cargo description", value: job.cargoDescription ?? "—" },
          { label: "Job value", value: naira(job.jobValue) },
          { label: "Agreed price", value: naira(job.agreedPrice) },
          { label: "Trucks required", value: job.requiredTrucks ?? "—", sub: job.totalTrips != null ? `${job.assignedTrips ?? 0} of ${job.totalTrips} assigned` : undefined },
          { label: "Created", value: formatDateTime(job.createdAt) },
          { label: "Expected delivery", value: formatDateTime(job.deadline), sub: job.freeDays != null && job.freeDays >= 0 ? `${job.freeDays} free day${job.freeDays === 1 ? "" : "s"}` : undefined },
        ]} />
      </DrawerSection>

      <DrawerSection title="Assigned to">
        {job.truckingCompany ? <div className={styles.drawerAssignee}><AssigneeCell job={job} size={36} /></div> : (
          <div className="tk-drawer-note info"><Icon name="building-2" size={16} /><span>No trucking company has been assigned yet.</span></div>
        )}
        {job.truckingCompany && (drawer.status === "loading" ? <Skeleton height={88} /> : drawer.status === "error" || trips == null ? (
          <Banner tone="warning" title="Unable to load drivers for this job." action={<Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>} />
        ) : trips.length > 0 ? (
          <div className={styles.driverList}>
            {trips.map((trip) => (
              <div className={styles.driverRow} key={trip.id}>
                {trip.driverName ? <Avatar name={trip.driverName} src={trip.driverAvatarUrl || undefined} size={30} /> : <span className="tk-cell-placeholder"><Icon name="user" size={13} /></span>}
                <span className={styles.driverText}>
                  <strong>{trip.driverName || job.truckingCompany}</strong>
                  <small>{trip.isOwnerDriver ? "Drives own truck" : trip.driverName ? (trip.driverPhone || "Driver") : "No separate driver"}</small>
                </span>
                <span className={styles.driverMeta}>
                  {trip.truckPlate && <span className="tk-plate"><Icon name="truck" size={12} />{trip.truckPlate}</span>}
                  <Badge tone={statusTone(trip.status)}>{trip.status}</Badge>
                </span>
              </div>
            ))}
          </div>
        ) : <span className="tk-meta">No trips have been assigned to drivers yet.</span>)}
      </DrawerSection>

      {docs && (
        <DrawerSection title="Documents">
          <DrawerFacts items={[
            { label: "Approved", value: docs.approved ?? "—" },
            { label: "Pending review", value: docs.pending ?? "—" },
            { label: "Rejected", value: docs.rejected ?? "—" },
            { label: "Total", value: docs.total },
          ]} />
        </DrawerSection>
      )}

      {job.timeline.length > 0 && (
        <DrawerSection title="Timeline">
          <ol className={styles.drawerTimeline}>
            {job.timeline.map((item, index) => (
              <li key={`${item.title}-${index}`} className={item.done ? styles.timelineDone : ""}>
                <span className={styles.drawerTimelineDot} />
                <span><strong>{item.title}</strong><small>{item.at ? formatDateTime(item.at) : "Upcoming"}</small></span>
              </li>
            ))}
          </ol>
        </DrawerSection>
      )}
    </SideDrawer>
  );
}

export function JobsLoading() {
  const cards: [string, string, StatTint][] = [
    ["clipboard-list", "Total Jobs", "blue"],
    ["clock-3", "Pending Approval", "amber"],
    ["truck", "In Transit", "blue"],
    ["circle-check", "Delivered", "green"],
    ["circle-x", "Cancelled", "red"],
  ];
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.loadingHeader} aria-hidden="true">
        <div className={styles.loadingHeaderTitle}>
          <Skeleton width={190} height={28} />
          <Skeleton width={330} height={14} />
        </div>
        <Skeleton width={318} height={42} radius={10} />
      </div>
      <div className={`${styles.loadingNotice} tk-sr-only`} role="status" aria-live="polite">
        <span className={styles.loadingNoticeDot} aria-hidden="true" />
        Loading jobs…
      </div>
      <section className={styles.metrics} aria-label="Loading job summary">
        {cards.map(([icon, label, tint]) => (
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
        <div className={styles.loadingTabs} aria-hidden="true">
          {[74, 130, 66, 76, 86, 78, 80, 68].map((width, index) => <Skeleton key={index} width={width} height={13} />)}
        </div>
        <div className={styles.loadingFilters} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={46} radius={10} />)}
        </div>
        <div className={styles.loadingTools} aria-hidden="true">
          <Skeleton width={260} height={38} radius={8} />
          <Skeleton width={90} height={38} radius={8} />
          <Skeleton width={38} height={38} radius={8} />
          <Skeleton width={38} height={38} radius={8} />
        </div>
        <TableSkeleton />
      </Card>
    </div>
  );
}

interface Toast {
  tone: "success" | "danger" | "warning" | "info";
  title: string;
}

interface ActionDialog {
  type: "deliver" | "cancel";
  job: JobRow;
}

export function JobsTrips({ query, jobs, stats, ports, pending, error, warnings, role }: JobsProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const canDeliver = role != null && DELIVERY_ROLES.has(role);
  const rows = useMemo(() => jobs?.jobs ?? [], [jobs]);
  const pagination = jobs?.pagination;

  const [search, setSearch] = usePageSearchState(query.search, () => {}) as [string, (next: string) => void];
  const [menu, setMenu] = useState<string | null>(null);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ status: "loading", data: null, message: null });
  const [drawerVersion, setDrawerVersion] = useState(0);

  // Change the URL, and the server loads the new page.
  const go = (patch: Partial<JobsScreenQuery>) => {
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
    if (next.view === "board") params.set("view", "board");
    if (next.period !== DEFAULT_PERIOD) params.set("period", next.period);
    const text = params.toString();
    startTransition(() => router.push(text ? `/jobs?${text}` : "/jobs"));
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

  const queryKey = JSON.stringify(query);
  useEffect(() => { setSelected([]); }, [queryKey]);

  const selectedJob = rows.find((job) => job.id === selectedJobId) ?? null;
  const drawerJobId = selectedJob?.id ?? null;
  const drawerJobNumber = selectedJob?.jobNumber ?? null;

  // The drawer asks the Next.js server for the drivers and document counts of the job that is open.
  useEffect(() => {
    if (!drawerJobId || !drawerJobNumber) return undefined;
    let cancelled = false;
    setDrawer({ status: "loading", data: null, message: null });
    getJobDrawerAction({ id: drawerJobId, jobNumber: drawerJobNumber })
      .then((result) => {
        if (cancelled) return;
        setDrawer(result.ok ? { status: "ready", data: result.data, message: null } : { status: "error", data: null, message: result.error.message });
      })
      .catch(() => { if (!cancelled) setDrawer({ status: "error", data: null, message: "The job details couldn’t be loaded." }); });
    return () => { cancelled = true; };
  }, [drawerJobId, drawerJobNumber, drawerVersion]);

  // the URL holds the port's id; the filter shows its name
  const portName = ports.find((port) => port.id === query.port)?.name ?? (query.port ? "Selected port" : ALL_PORTS);

  const tabLabel = TAB_OPTIONS.find((item) => item.value === query.tab)?.label ?? ALL_JOBS;
  const movementLabel = MOVEMENT_OPTIONS.find((item) => item.value === query.type)?.label ?? ALL_MOVEMENTS;
  const cargoLabel = CARGO_KIND_OPTIONS.find((item) => item.value === query.cargoKind)?.label ?? ALL_CARGO;
  const dateRange = { from: query.from, to: query.to };
  const filtersActive = query.tab !== "all" || query.period !== DEFAULT_PERIOD || Boolean(query.type || query.cargoKind || query.port || (query.from && query.to) || query.search);

  const resetFilters = () => {
    setSearch("");
    go({ tab: "all", type: "", cargoKind: "", port: "", from: "", to: "", period: DEFAULT_PERIOD, search: "" });
  };

  const hasRange = Boolean(query.from && query.to);
  const statCaption = hasRange ? "vs previous period" : statsPeriod(query.period)?.vs;
  const card = (key: JobStatCardKey) => stats?.cards[key];
  // All time has nothing to compare with: the backend then compares the last 7 days with the 7 before, which would not match the numbers shown
  const statDelta = (key: JobStatCardKey) => {
    if (query.period === "all" && !hasRange) return undefined;
    const change = card(key)?.changePercent;
    return change == null ? undefined : `${Math.abs(change)}%`;
  };
  const statDirection = (key: JobStatCardKey) => {
    if (query.period === "all" && !hasRange) return null;
    const trend = card(key)?.trend;
    return trend === "DOWN" ? "down" : trend === "UP" ? "up" : null;
  };
  const statValue = (key: JobStatCardKey) => card(key)?.value?.toLocaleString("en-NG") ?? "—";

  function exportRows(list: JobRow[]) {
    const data = [
      ["Job ID", "Company", "Trip Type", "Route", "Cargo", "Job value", "Status", "Created", "Deadline", "Free Days"],
      ...list.map((job) => [
        job.jobNumber,
        job.forwarder,
        job.movement,
        `${job.origin ?? "—"} → ${job.destination ?? "—"}`,
        job.cargo,
        job.jobValue ?? "",
        job.status,
        formatDateTime(job.createdAt),
        formatDateTime(job.deadline),
        job.freeDays ?? "",
      ]),
    ];
    downloadCsv(data.map((row) => row.map(csvCell).join(",")).join("\n"), `trukkas-jobs-selected-${today()}.csv`);
    setToast({ tone: "success", title: `${list.length} job${list.length === 1 ? "" : "s"} exported.` });
  }

  async function exportAllJobs() {
    setExporting(true);
    try {
      const result = await exportJobsAction(query);
      if (!result.ok) { setToast({ tone: "danger", title: result.error.message }); return; }
      downloadCsv(result.data, `jobs-export-${today()}.csv`);
      setToast({ tone: "success", title: "Jobs exported." });
    } catch {
      setToast({ tone: "danger", title: "Unable to export jobs." });
    } finally {
      setExporting(false);
    }
  }

  async function handleAction(action: JobAction, job: JobRow) {
    setMenu(null);
    if (busy || (action === "deliver" && !canDeliver)) return;
    if (action === "view") { navigate(`/jobs/${encodeURIComponent(job.id)}`); return; }
    if (action === "export") {
      setBusy(true);
      try {
        const result = await exportJobSheetAction(job.id);
        if (!result.ok) { setToast({ tone: "danger", title: result.error.message }); return; }
        downloadCsv(result.data, `${job.jobNumber}-job-sheet.csv`);
        setToast({ tone: "success", title: "Job sheet exported." });
      } catch {
        setToast({ tone: "danger", title: "Unable to export the job sheet." });
      } finally {
        setBusy(false);
      }
      return;
    }
    setActionNote("");
    setActionDialog({ type: action, job });
  }

  async function confirmAction() {
    if (!actionDialog || busy) return;
    const { type, job } = actionDialog;
    if (type === "cancel" && actionNote.trim().length < 3) return;
    setBusy(true);
    try {
      const result = type === "deliver"
        ? await markDeliveredAction({ jobId: job.id, note: actionNote })
        : await cancelJobAction({ jobId: job.id, reason: actionNote });
      if (!result.ok) {
        // the backend's message as it is (for example a job that is no longer in a state that allows this)
        setToast({ tone: "danger", title: result.error.message });
        router.refresh();
        return;
      }
      setActionDialog(null);
      setActionNote("");
      setToast({ tone: type === "cancel" ? "warning" : "success", title: `${job.jobNumber} ${type === "deliver" ? "marked delivered" : "cancelled"}.` });
    } catch {
      setToast({ tone: "danger", title: "Unable to update this job." });
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "id",
      header: "Job",
      width: "14%",
      render: (job: JobRow) => (
        <span className="tk-cell-id">
          <strong>{job.jobNumber}</strong>
          <small>{formatDateTime(job.createdAt)}</small>
        </span>
      ),
    },
    { key: "forwarder", header: "Forwarder", width: "17%", render: (job: JobRow) => <span className={styles.forwarder} title={job.forwarder}>{job.forwarder}</span> },
    { key: "route", header: "Route", width: "24%", render: (job: JobRow) => <RouteStack from={job.origin} to={job.destination} /> },
    {
      key: "type",
      header: "Type",
      width: "10%",
      render: (job: JobRow) => <Badge tone={job.movementCode === "EXPORT" ? "success" : "purple"}>{job.movement}</Badge>,
    },
    { key: "value", header: "Job value", width: "11%", render: (job: JobRow) => <span className="tk-cell-strong">{naira(job.jobValue)}</span> },
    { key: "status", header: "Status", width: "11%", render: (job: JobRow) => <Badge tone={statusTone(job.status)} dot>{job.status}</Badge> },
    { key: "assigned", header: "Assigned To", width: "17%", render: (job: JobRow) => <AssigneeCell job={job} /> },
  ];

  const pageCount = Math.max(1, pagination?.totalPages ?? 1);
  const board = query.view === "board";

  return (
    <div className={styles.page}>
      <PageHeader crumbs={["Jobs & Trips", "Jobs"]} title="Jobs" description="Every job on Trukkas, from posting to delivery." />
      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      <div className="tk-sr-only" role="status" aria-live="polite">{loading ? "Loading jobs…" : ""}</div>
      {error && <Banner tone="danger" title="Unable to load jobs." action={<Button variant="outline" size="sm" icon="rotate-ccw" onClick={() => router.refresh()}>Retry</Button>}>{error}</Banner>}
      {warnings.map((warning) => <Banner key={warning} tone="warning" title={warning} action={<Button variant="outline" size="sm" onClick={() => router.refresh()}>Retry</Button>} />)}

      <StatsPanel period={query.period} onPeriodChange={(period: string) => go({ period, from: "", to: "" })}>
        <StatCard icon="clipboard-list" tint="blue" label="Total Jobs" value={statValue("totalJobs")} delta={statDelta("totalJobs")} direction={statDirection("totalJobs")} caption={statCaption} style={{ minHeight: 92, padding: 13 }} />
        <StatCard icon="clock-3" tint="amber" label="Pending Approval" value={statValue("pendingApproval")} delta={statDelta("pendingApproval")} direction={statDirection("pendingApproval")} higherIsBetter={false} caption={statCaption} style={{ minHeight: 92, padding: 13 }} />
        <StatCard icon="truck" tint="blue" label="In Transit" value={statValue("inTransit")} delta={statDelta("inTransit")} direction={statDirection("inTransit")} caption={statCaption} style={{ minHeight: 92, padding: 13 }} />
        <StatCard icon="circle-check" tint="green" label="Delivered" value={statValue("delivered")} delta={statDelta("delivered")} direction={statDirection("delivered")} caption={statCaption} style={{ minHeight: 92, padding: 13 }} />
        <StatCard icon="circle-x" tint="red" label="Cancelled" value={statValue("cancelled")} delta={statDelta("cancelled")} direction={statDirection("cancelled")} higherIsBetter={false} caption={statCaption} style={{ minHeight: 92, padding: 13 }} />
      </StatsPanel>

      <Card pad="none" className={styles.workspace}>
        {query.tab === "pendingApproval" && pending && pending.total > 0 && (
          <Banner tone="info" title={`${pending.total} job${pending.total === 1 ? "" : "s"} awaiting document upload`} style={{ margin: "12px 16px 0" }}>
            {pending.jobs.map((job, index) => <span key={job.id}>{index > 0 ? " · " : ""}<Link href={`/jobs/${encodeURIComponent(job.id)}`} to={`/jobs/${encodeURIComponent(job.id)}`}>{job.jobNumber}</Link></span>)}
            {pending.total > pending.jobs.length ? " · more pending" : ""}
          </Banner>
        )}
        <div className={styles.toolbar}>
          <div className={styles.toolbarSearch}>
            <SearchField
              placeholder="Search jobs…"
              title="Search by job ID, forwarder, route or cargo"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
            />
          </div>
          <div className="tk-list-toolbar-filters" role="group" aria-label="Filter jobs">
            <FilterControl name="Status" icon="circle-dot" value={tabLabel} allValue={ALL_JOBS} options={TAB_OPTIONS.map((item) => item.label)} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ tab: TAB_OPTIONS.find((item) => item.label === label)?.value ?? "all" })} />
            <FilterControl name="Movement" icon="route" value={movementLabel} allValue={ALL_MOVEMENTS} options={[ALL_MOVEMENTS, ...MOVEMENT_OPTIONS.map((item) => item.label)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ type: MOVEMENT_OPTIONS.find((item) => item.label === label)?.value ?? "" })} />
            <FilterControl name="Cargo" icon="package" value={cargoLabel} allValue={ALL_CARGO} options={[ALL_CARGO, ...CARGO_KIND_OPTIONS.map((item) => item.label)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ cargoKind: CARGO_KIND_OPTIONS.find((item) => item.label === label)?.value ?? "" })} />
            <FilterControl name="Pickup port" icon="map-pin" value={portName} allValue={ALL_PORTS} options={[ALL_PORTS, ...ports.map((port) => port.name)]} menu={menu} setMenu={setMenu}
              onChange={(label) => go({ port: ports.find((port) => port.name === label)?.id ?? "" })} />
            <DateRangeFilter value={dateRange} onChange={(range: { from: string; to: string }) => go({ from: range.from, to: range.to })} />
            {filtersActive && <button type="button" className="tk-clear-filters" onClick={resetFilters}>Clear all</button>}
          </div>
          <div className={styles.toolbarRight}>
            <ViewToggle style={undefined} hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={query.view} onChange={(next: "list" | "board") => { setSelected([]); go({ view: next }); }} />
            <Button
              variant="outline"
              icon="download"
              disabled={exporting}
              onClick={() => (selected.length ? exportRows(rows.filter((job) => selected.includes(job.id))) : void exportAllJobs())}
            >
              {exporting ? "Exporting…" : selected.length ? `Export ${selected.length}` : "Export"}
            </Button>
          </div>
        </div>
        {!board && selected.length > 0 && (
          <div className={styles.bulkBar}>
            <strong>{selected.length} selected</strong>
            <button type="button" onClick={() => exportRows(rows.filter((job) => selected.includes(job.id)))}>Export selected</button>
            <button type="button" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {loading ? (
          <TableSkeleton />
        ) : !board ? (
          <>
            <DataTable
              selectable
              selected={selected}
              onSelect={(keys: Array<string | number>) => setSelected(keys.map(String))}
              rows={rows}
              rowKey={(job: JobRow) => job.id}
              columns={columns}
              onRowClick={(job: JobRow) => setSelectedJobId(job.id)}
            />
            {!loading && !error && rows.length === 0 && <div className={styles.empty}>No jobs match the selected filters.</div>}
            <Pagination
              page={query.page}
              pageCount={pageCount}
              pageSize={query.limit}
              total={pagination?.total}
              onPage={(next: number) => go({ page: Math.min(Math.max(1, next), pageCount) })}
              onPageSize={(size: number) => go({ limit: size })}
            />
          </>
        ) : (
          <>
            <JobBoard hideEmpty={hideEmptyColumns} jobs={rows} selectedJobId={selectedJobId} onOpen={setSelectedJobId} />
            {(pagination?.total ?? 0) > rows.length && (
              <div className={styles.boardNote}>Showing the {rows.length} most recent of {pagination?.total} jobs. Use filters or the list view to see the rest.</div>
            )}
          </>
        )}
      </Card>

      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          drawer={drawer}
          onRetry={() => setDrawerVersion((version) => version + 1)}
          onClose={() => setSelectedJobId(null)}
          onAction={handleAction}
          canDeliver={canDeliver}
          busy={busy}
        />
      )}

      <Modal
        open={Boolean(actionDialog)}
        onClose={() => { if (!busy) setActionDialog(null); }}
        title={actionDialog?.type === "deliver" ? "Mark Job Delivered" : "Cancel Job"}
        description={actionDialog?.job.jobNumber ?? ""}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setActionDialog(null)}>Close</Button>
          <Button disabled={busy || (actionDialog?.type === "cancel" && actionNote.trim().length < 3)} onClick={() => void confirmAction()}>
            {busy ? "Saving…" : actionDialog?.type === "deliver" ? "Mark Delivered" : "Cancel Job"}
          </Button>
        </>}
      >
        {actionDialog?.type === "deliver" && <Banner tone="warning" title="This completes the job and releases the trucker’s final payment." />}
        {actionDialog?.type === "cancel" && <Banner tone="warning" title="This cancels the job and holds escrow for review." />}
        <div style={{ marginTop: 14 }}>
          <TextField
            label={actionDialog?.type === "deliver" ? "Note (optional)" : "Reason"}
            required={actionDialog?.type === "cancel"}
            value={actionNote}
            maxLength={500}
            disabled={busy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setActionNote(event.target.value)}
            placeholder={actionDialog?.type === "deliver" ? "How was delivery confirmed?" : "Why is this job being cancelled?"}
          />
        </div>
      </Modal>
    </div>
  );
}
