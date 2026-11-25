"use client";
import { ToastRelay } from '../components/ActionToast.jsx';
import { usePageSearchState } from '../components/PageSearch.jsx';
import { DateRangeFilter, EMPTY_RANGE, isRangeSet, rangeParams } from '../components/DateRangeFilter.jsx';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';


import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
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
  DropdownMenu,
  FilterSelect,
  Icon,
  IconButton,
  Modal,
  Pagination,
  PageHeader,
  RouteStack,
  SearchField,
  Select,
  SideDrawer,
  Skeleton,
  StatCard,
  StatsPanel,
  ViewToggle,
  TextField,
} from "../ds.js";
import {
  useGetAdminJobsQuery,
  useGetAdminJobStatsQuery,
  useGetAdminJobsPendingDocsQuery,
  useGetAdminJobContainerTypesQuery,
  useLazyExportAdminJobsQuery,
  useLazyExportAdminJobSheetQuery,
  useMarkAdminJobDeliveredMutation,
  useValidateAdminJobDocumentsMutation,
  useRejectAdminJobDocsMutation,
} from "../store/features/jobs/jobsApi.js";
import { useInterveneAdminTriangulationJobMutation } from "../store/features/triangulation/triangulationApi.js";
import { useGetAdminJobScreenQuery } from "../store/features/jobs/jobDetailApi.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from "../domain/statsPeriod.js";
import { createJob } from "../mock/api.js";
import { statusTone } from "./JobDetail.jsx";
import { getJobTripCounts, getJobTrips } from "../domain/jobTrips.js";
import styles from "./JobsTrips.module.css";

const REQUEST_TYPES = [
  "Import (Container)",
  "Export",
  "Transfer / Value Chain",
  "Break-Bulk",
];
const TAB_API_VALUE = {
  "Pending Approval": "pendingApproval", Bidding: "bidding", Assigned: "assigned",
  "In Transit": "inTransit", Delivered: "delivered", Cancelled: "cancelled", Flagged: "flagged",
  Rejected: "rejected",
};
const TRIP_TYPE_API_VALUE = {
  "Import (Container)": "PORT_TO_DESTINATION", Export: "EXPORT",
  "Transfer / Value Chain": "PORT_TO_PORT", "Break-Bulk": "BULK_BREAK",
};
const DELIVERY_ROLES = new Set(["SUPER_ADMIN", "OPS_ADMIN"]);

function apiErrorMessage(error, fallback) {
  return getApiErrorMessage(error, fallback);
}

function downloadCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
const naira = (number) => number == null
  ? "—"
  : `₦${number.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortType = (type) =>
  type === "Transfer / Value Chain" ? "Transfer" : type;

function normalize(job) {
  const tripCounts = job.assignmentDataAvailable
    ? { required: job.totalTrips ?? 0, assigned: job.assignedTrips ?? 0 }
    : getJobTripCounts(job);
  const trips = getJobTrips(job);
  const truckingCompany = job.truckingCompany || job.truckCompany || null;
  return {
    ...job,
    displayId: job.displayId || job.jobNumber || job.id,
    displayValue: job.jobValue ?? job.amount ?? null,
    displayRoute:
      job.route || (job.origin || job.destination
        ? `${job.origin || "—"} → ${job.destination || "—"}`
        : "—"),
    displayType: job.requestType || job.cargoType || "—",
    displayForwarder: job.forwarder || "—",
    displayCreated: job.displayCreated || job.createdAt || job.published || "—",
    displayDeadline: job.displayDeadline || null,
    displayCargo: job.displayCargo || job.cargoDetails || job.cargo || job.cargoType || "—",
    displayCargoFilter: job.cargoType || "—",
    tripCounts,
    trips,
    displayAssignee: job.assignmentDataAvailable === false
      ? truckingCompany
      : tripCounts.assigned
        ? `${tripCounts.assigned} trip${tripCounts.assigned === 1 ? "" : "s"} · ${truckingCompany || "Assigned"}`
        : null,
  };
}

function FilterMenu({ open, options, value, onChange }) {
  if (!open) return null;
  return (
    <span className={styles.menuPopover}>
      <DropdownMenu
        width={216}
        items={options.map((option) => ({
          label: option,
          icon: option === value ? "check" : undefined,
          onClick: () => onChange(option),
        }))}
      />
    </span>
  );
}

function FilterControl({ name, icon, value, allValue, options, menu, setMenu, onChange }) {
  return (
    <span className={styles.filterWrap}>
      <FilterSelect
        icon={icon}
        prefix={name}
        label={value}
        active={value !== allValue}
        onClick={() => setMenu(menu === name ? null : name)}
        onClear={() => { onChange(allValue); setMenu(null); }}
      />
      <FilterMenu
        open={menu === name}
        options={options}
        value={value}
        onChange={(next) => {
          onChange(next);
          setMenu(null);
        }}
      />
    </span>
  );
}

const BOARD_COLUMNS = [
  ["pendingApproval", "Pending Approval", "warning"],
  ["bidding", "Bidding", "info"],
  ["assigned", "Assigned", "purple"],
  ["inTransit", "In Transit", "info"],
  ["delivered", "Delivered", "success"],
  ["cancelled", "Cancelled", "neutral"],
  ["flagged", "Flagged", "danger"],
  ["rejected", "Rejected", "danger"],
];

function AssigneeCell({ job, size = 32, compact = false }) {
  const company = job.truckingCompany || job.truckCompany;
  if (!company) return <span className="tk-meta">Unassigned</span>;
  const trips = job.assignmentDataAvailable === false || job.tripCounts?.required == null
    ? null
    : `${job.tripCounts.assigned} of ${job.tripCounts.required} trip${job.tripCounts.required === 1 ? "" : "s"}`;
  return <span className="tk-cell-person">
    <Avatar name={company} src={job.truckingCompanyAvatarUrl || undefined} size={size} square />
    <span><strong title={company}>{company}</strong>{trips && <small>{trips}</small>}</span>
  </span>;
}

function JobBoard({ jobs, selectedJobId, onOpen, hideEmpty }) {
  const columns = hideEmpty ? BOARD_COLUMNS.filter(([stage]) => jobs.some((job) => job.stage === stage)) : BOARD_COLUMNS;
  return (
    <div className={styles.board} style={{ '--tk-board-lane-count': BOARD_COLUMNS.length, '--tk-board-gap-space': `${(BOARD_COLUMNS.length - 1) * 14}px` }}>
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
                    <strong>{job.displayId}</strong>
                    <span className="tk-cell-strong">{naira(job.displayValue)}</span>
                  </span>
                  <span className={styles.boardForwarder}>{job.displayForwarder}</span>
                  <RouteStack from={job.origin} to={job.destination} />
                  <span className={styles.boardCardFoot}>
                    <Badge tone={job.displayType === "Export" ? "success" : "purple"}>{shortType(job.displayType)}</Badge>
                    <AssigneeCell job={job} size={24} compact />
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

function JobActionMenu({ anchor, items, onClose }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    if (!anchor || !menuRef.current) return undefined;
    const updatePosition = () => {
      if (!menuRef.current || !anchor.isConnected) { onClose(null); return; }
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const left = Math.min(Math.max(8, anchorRect.right - menuRect.width), Math.max(8, window.innerWidth - menuRect.width - 8));
      const below = anchorRect.bottom + 6;
      const top = below + menuRect.height <= window.innerHeight - 8 ? below : Math.max(8, anchorRect.top - menuRect.height - 6);
      setPosition({ top, left });
    };
    const closeOnOutsidePointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !anchor.contains(event.target)) onClose(null);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(null); };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [anchor, items.length, onClose]);
  return (
    <div ref={menuRef} onClick={(event) => event.stopPropagation()} style={{
      position: "fixed", top: position?.top ?? -10000, left: position?.left ?? 0,
      zIndex: 'calc(var(--tk-z-modal) + 20)', width: "max-content", visibility: position ? "visible" : "hidden",
    }}>
      <DropdownMenu width={210} items={items} />
    </div>
  );
}

function JobDrawer({ job, onClose, onAction, canDeliver, actionBusy }) {
  const navigate = useNavigate();
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const detailQuery = useGetAdminJobScreenQuery({ id: job.id, owner, role }, { skip: !authenticated || !job.id, refetchOnMountOrArgChange: true });
  const detail = detailQuery.error ? null : detailQuery.currentData;
  const company = job.truckingCompany || job.truckCompany || detail?.truckingCompany || null;
  const trips = detail?.trips || [];
  const docs = detail?.documentStatusCounts;
  const timeline = (job.timeline || []).map((event) => ({
    title: event.title,
    when: event.timestamp ? new Date(event.timestamp).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Upcoming",
    done: Boolean(event.completed),
  }));
  const primaryActions = [
    (job.canValidateDocs || job.canRejectDocs) && <Button key="review" icon="file-check-2" disabled={actionBusy} onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(job.id)}&ref=${encodeURIComponent(job.displayId || job.id)}`)}>Review documents</Button>,
    job.canMarkDelivered && canDeliver && <Button key="deliver" variant="outline" icon="circle-check" disabled={actionBusy} onClick={() => onAction("deliver", job)}>Mark Delivered</Button>,
  ].filter(Boolean);
  return (
    <SideDrawer
      label="Job details"
      eyebrow="Job"
      onClose={onClose}
      title={<CopyableId id={job.displayId || job.id} size="lg" onCopy={(value) => navigator.clipboard?.writeText(value)} />}
      meta={<>
        <Badge tone={statusTone(job.status)} dot>{job.status}</Badge>
        <Badge tone={job.displayType === "Export" ? "success" : "purple"}>{shortType(job.displayType)}</Badge>
        {job.deliveryHealth && job.deliveryHealth !== job.status && <span className="tk-meta">{job.deliveryHealth}</span>}
      </>}
      headerActions={<IconButton icon="maximize-2" label="Open full page" onClick={() => onAction("view", job)} />}
      footer={<>
        {primaryActions.length > 0 && <div className="tk-drawer-footer-row">{primaryActions}</div>}
        <div className="tk-drawer-footer-row">
          <Button variant="outline" icon="download" disabled={actionBusy} onClick={() => onAction("export", job)}>Export Job Sheet</Button>
          {job.canCancel && <Button variant="danger" icon="ban" disabled={actionBusy} onClick={() => onAction("cancel", job)}>Cancel Job</Button>}
          <Button iconRight="maximize-2" onClick={() => onAction("view", job)}>Open Full Page</Button>
        </div>
      </>}
    >
      <div className="tk-drawer-card"><RouteStack from={job.origin} to={job.destination} wrap /></div>

      <DrawerSection title="Overview">
        <DrawerFacts items={[
          { label: "Forwarder", value: job.displayForwarder },
          { label: "Requested by", value: job.contactPerson || "—", sub: job.contactEmail || undefined },
          { label: "Job value", value: naira(job.displayValue) },
          { label: "Cargo", value: job.displayCargo },
          { label: "Created", value: job.displayCreated },
          { label: "Expected delivery", value: job.displayDeadline || "—", sub: job.freeDays != null && job.freeDays >= 0 ? `${job.freeDays} free day${job.freeDays === 1 ? "" : "s"}` : undefined },
        ]} />
      </DrawerSection>

      <DrawerSection title="Assigned to">
        {company ? <div className={styles.drawerAssignee}>
          <AssigneeCell job={{ ...job, truckingCompany: company }} size={36} />
        </div> : <div className="tk-drawer-note info"><Icon name="building-2" size={16} /><span>No trucking company has been assigned yet.</span></div>}
        {company && (detailQuery.isFetching && !detail ? <Skeleton height={88} /> : detailQuery.error ? <Banner tone="warning" title="Unable to load drivers for this job." action={<Button size="sm" variant="outline" onClick={detailQuery.refetch}>Retry</Button>} /> : trips.length > 0 ? (
          <div className={styles.driverList}>
            {trips.map((trip) => {
              const driver = trip.driverName && trip.driverName !== "—" ? trip.driverName : null;
              return (
                <div className={styles.driverRow} key={trip.id}>
                  {driver ? <Avatar name={driver} size={30} /> : <span className="tk-cell-placeholder"><Icon name="user" size={13} /></span>}
                  <span className={styles.driverText}>
                    <strong>{driver || company}</strong>
                    <small>{driver ? (trip.driverPhone && trip.driverPhone !== "—" ? trip.driverPhone : "Driver") : "No separate driver"}</small>
                  </span>
                  <span className={styles.driverMeta}>
                    {trip.truckPlate && trip.truckPlate !== "—" && <span className="tk-plate"><Icon name="truck" size={12} />{trip.truckPlate}</span>}
                    <Badge tone={statusTone(trip.status)}>{trip.status}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        ) : <span className="tk-meta">No trips have been assigned to drivers yet.</span>)}
      </DrawerSection>

      {docs && docs.total != null && <DrawerSection title="Documents">
        <DrawerFacts items={[
          { label: "Approved", value: docs.approved ?? "—" },
          { label: "Pending review", value: docs.pending ?? "—" },
          { label: "Rejected", value: docs.rejected ?? "—" },
          { label: "Total", value: docs.total ?? "—" },
        ]} />
      </DrawerSection>}

      {timeline.length > 0 && <DrawerSection title="Timeline">
        <ol className={styles.drawerTimeline}>
          {timeline.map((item, index) => (
            <li key={`${item.title}-${index}`} className={item.done ? styles.timelineDone : ""}>
              <span className={styles.drawerTimelineDot} />
              <span><strong>{item.title}</strong><small>{item.when}</small></span>
            </li>
          ))}
        </ol>
      </DrawerSection>}
    </SideDrawer>
  );
}

function JobsLoading() {
  const cards = [
    ["clipboard-list", "Total Jobs", "blue"],
    ["clock-3", "Pending Approval", "amber"],
    ["truck", "In Transit", "blue"],
    ["circle-check", "Delivered", "green"],
    ["circle-x", "Cancelled", "red"],
  ];
  const cellWidths = ["68%", "84%", "54%", "78%", "60%", "72%", "56%", "66%", "62%", "48%"];

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
          {[74, 130, 66, 76, 86, 78, 80, 68].map((width, index) => (
            <Skeleton key={index} width={width} height={13} />
          ))}
        </div>
        <div className={styles.loadingFilters} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={46} radius={10} />
          ))}
        </div>
        <div className={styles.loadingTools} aria-hidden="true">
          <Skeleton width={260} height={38} radius={8} />
          <Skeleton width={90} height={38} radius={8} />
          <Skeleton width={38} height={38} radius={8} />
          <Skeleton width={38} height={38} radius={8} />
        </div>
        <div className={styles.loadingTable} aria-hidden="true">
          {Array.from({ length: 8 }, (_, rowIndex) => (
            <div className={styles.loadingRow} key={rowIndex}>
              {cellWidths.map((width, columnIndex) => (
                <Skeleton key={columnIndex} width={width} height={11} />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function JobsTrips() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const navigate = useNavigate();
  const adminRole = useSelector((state) => state.auth.admin?.role);
  const canDeliver = DELIVERY_ROLES.has(adminRole);
  const [tab, setTab] = useState("All Jobs");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = usePageSearchState("", () => setPage(1));
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [cargoFilter, setCargoFilter] = useState("All Cargo");
  const [originFilter, setOriginFilter] = useState("All Locations");
  const [destinationFilter, setDestinationFilter] = useState("All Locations");
  const [dateFilter, setDateFilter] = useState(EMPTY_RANGE);
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [view, setView] = useState("list");
  const [rowMenu, setRowMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    forwarder: "",
    requestType: REQUEST_TYPES[0],
    origin: "",
    destination: "",
    cargo: "",
    jobValue: "",
    requiredTrucks: 1,
  });

  const selectedRange = useMemo(() => rangeParams(dateFilter), [dateFilter]);
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const {
    currentData: containerTypes = [],
    isError: containerTypesError,
    refetch: refetchContainerTypes,
  } = useGetAdminJobContainerTypesQuery();
  const containerTypeId = containerTypes.find((item) => item.name === cargoFilter)?.id;
  const selectedTabFilter = TAB_API_VALUE[tab];
  const selectedStatusFilter = TAB_API_VALUE[statusFilter];
  const apiStatusFilter = selectedTabFilter || selectedStatusFilter;
  const listFilters = {
    statusFilter: apiStatusFilter,
    search: query.trim() || undefined,
    tripType: TRIP_TYPE_API_VALUE[typeFilter],
    containerTypeId,
    origin: originFilter === "All Locations" ? undefined : originFilter,
    destination: destinationFilter === "All Locations" ? undefined : destinationFilter,
    ...selectedRange,
  };
  const {
    currentData: jobsResponse,
    isLoading: jobsLoading,
    isFetching: jobsFetching,
    isError: jobsError,
    refetch: refetchJobs,
  } = useGetAdminJobsQuery({ ...listFilters, page: view === "board" ? 1 : page, limit: view === "board" ? 100 : pageSize });
  const {
    currentData: statsResponse,
    isError: statsError,
    refetch: refetchStats,
  } = useGetAdminJobStatsQuery(statsRange);
  const {
    currentData: pendingDocsResponse,
    isError: pendingDocsError,
    refetch: refetchPendingDocs,
  } = useGetAdminJobsPendingDocsQuery({ search: query.trim() || undefined, page: 1, limit: 3 }, {
    skip: tab !== "Pending Approval",
  });
  const [exportJobs, { isFetching: exportingJobs }] = useLazyExportAdminJobsQuery();
  const [exportJobSheet, { isFetching: exportingSheet }] = useLazyExportAdminJobSheetQuery();
  const [markDelivered, { isLoading: markingDelivered }] = useMarkAdminJobDeliveredMutation();
  const [validateDocs, { isLoading: validatingDocs }] = useValidateAdminJobDocumentsMutation();
  const [rejectDocs, { isLoading: rejectingDocs }] = useRejectAdminJobDocsMutation();
  const [interveneJob, { isLoading: cancellingJob }] = useInterveneAdminTriangulationJobMutation();
  const actionBusy = markingDelivered || validatingDocs || rejectingDocs || cancellingJob;
  const jobsBusy = jobsLoading || jobsFetching;
  const rawJobs = jobsResponse?.rows || [];
  const jobs = useMemo(() => rawJobs.map(normalize), [rawJobs]);


  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [
    tab,
    statusFilter,
    typeFilter,
    cargoFilter,
    originFilter,
    destinationFilter,
    dateFilter,
    query,
  ]);
  useEffect(() => { setSelected([]); }, [page, pageSize, tab, statusFilter, typeFilter, cargoFilter, originFilter, destinationFilter, dateFilter, query]);

  const origins = useMemo(() => [...new Set(jobs.map((job) => job.origin).filter(Boolean))].sort(), [jobs]);
  const destinations = useMemo(() => [...new Set(jobs.map((job) => job.destination).filter(Boolean))].sort(), [jobs]);
  const cargoTypes = containerTypes.map((item) => item.name).sort();
  const tabFilters = {
    "All Jobs": () => true,
    "Pending Approval": (job) => job.stage === "pendingApproval",
    Bidding: (job) => job.stage === "bidding",
    Assigned: (job) => job.stage === "assigned",
    "In Transit": (job) => job.stage === "inTransit",
    Delivered: (job) => job.stage === "delivered",
    Cancelled: (job) => job.stage === "cancelled",
    Flagged: (job) => job.stage === "flagged",
    Rejected: (job) => job.stage === "rejected",
  };
  const filtered = useMemo(
    () =>
      jobs.filter((job) => tabFilters[tab]?.(job)
        && (statusFilter === "All Statuses" || (selectedStatusFilter
          ? job.stage === selectedStatusFilter
          : job.status === statusFilter))),
    [jobs, tab, statusFilter, selectedStatusFilter],
  );
  const paged = filtered;
  const pageCount = Math.max(1, jobsResponse?.pagination?.totalPages || 1);
  const hasLocalFilters = statusFilter !== "All Statuses" && Boolean(selectedTabFilter || !selectedStatusFilter);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const filtersActive = tab !== "All Jobs" || typeFilter !== "All Types" || cargoFilter !== "All Cargo" || originFilter !== "All Locations"
    || destinationFilter !== "All Locations" || isRangeSet(dateFilter) || Boolean(query.trim());
  const statCaption = statsPeriod(statsPeriodKey).vs;
  const card = (key) => statsResponse?.cards[key];
  const statDelta = (key) => card(key)?.changePercent == null ? undefined : `${Math.abs(card(key).changePercent)}%`;
  const statDirection = (key) => { const trend = card(key)?.trend; return trend === "DOWN" ? "down" : trend === "UP" ? "up" : null; };

  function resetFilters() {
    setTab("All Jobs");
    setStatusFilter("All Statuses");
    setTypeFilter("All Types");
    setCargoFilter("All Cargo");
    setOriginFilter("All Locations");
    setDestinationFilter("All Locations");
    setDateFilter(EMPTY_RANGE);
    setQuery("");
  }
  function exportRows(rows) {
    const data = [
      [
        "Job ID",
        "Company",
        "Trip Type",
        "Route",
        "Cargo",
        "Value",
        "Status",
        "Created",
        "Deadline",
        "Free Days",
      ],
      ...rows.map((job) => [
        job.displayId || job.id,
        job.displayForwarder,
        job.displayType,
        job.displayRoute,
        job.displayCargo,
        job.displayValue,
        job.status,
        job.displayCreated,
        job.deadline || "",
        job.freeDays ?? "",
      ]),
    ];
    const csv = data
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    downloadCsv(csv, `trukkas-jobs-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    setToast({
      tone: "success",
      title: `${rows.length} job${rows.length === 1 ? "" : "s"} exported.`,
    });
  }
  async function exportAllJobs() {
    try {
      const csv = await exportJobs(listFilters).unwrap();
      downloadCsv(csv, `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`);
      setToast({ tone: "success", title: "Jobs exported." });
    } catch (error) {
      setToast({ tone: "danger", title: apiErrorMessage(error, "Unable to export jobs.") });
    }
  }
  function openAction(type, job) {
    setActionNote("");
    setActionDialog({ type, job });
  }
  async function handleAction(action, job) {
    setMenu(null);
    setRowMenu(null);
    if (actionBusy || (action === "deliver" && !canDeliver)) return;
    if (action === "view") {
      return navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`);
    }
    if (action === "export") {
      try {
        const csv = await exportJobSheet(job.id).unwrap();
        downloadCsv(csv, `${job.displayId || job.id}-job-sheet.csv`);
        setToast({ tone: "success", title: "Job sheet exported." });
      } catch (error) {
        setToast({ tone: "danger", title: apiErrorMessage(error, "Unable to export the job sheet.") });
      }
      return;
    }
    if (action === "approve") {
      try {
        await validateDocs(job.id).unwrap();
        setToast({ tone: "success", title: `${job.displayId || job.id} documents validated.` });
      } catch (error) {
        setToast({ tone: "danger", title: apiErrorMessage(error, "Unable to validate job documents.") });
      }
      return;
    }
    if (["deliver", "reject", "cancel"].includes(action)) openAction(action, job);
  }
  async function confirmAction() {
    if (!actionDialog || actionBusy) return;
    const { type, job } = actionDialog;
    if (type !== "deliver" && !actionNote.trim()) return;
    try {
      if (type === "deliver") await markDelivered({ id: job.id, note: actionNote }).unwrap();
      if (type === "reject") await rejectDocs({ id: job.id, reason: actionNote }).unwrap();
      if (type === "cancel") await interveneJob({ jobId: job.id, type: "CANCEL_JOB", notes: actionNote }).unwrap();
      setActionDialog(null);
      setActionNote("");
      setToast({ tone: type === "cancel" ? "warning" : "success", title: `${job.displayId || job.id} ${type === "deliver" ? "marked delivered" : type === "reject" ? "documents rejected" : "cancelled"}.` });
    } catch (error) {
      setToast({ tone: "danger", title: apiErrorMessage(error, "Unable to update this job.") });
    }
  }
  async function submitJob(event) {
    event.preventDefault();
    const created = await createJob({
      ...draft,
      jobValue: Number(draft.jobValue),
      amount: Number(draft.jobValue),
      route: `${draft.origin} → ${draft.destination}`,
      cargoType: draft.cargo,
      cargoDetails: draft.cargo,
      contactPerson: "Super Admin",
    });
    setCreateOpen(false);
    setSelectedJobId(created.id);
    setTab("All Jobs");
    setDraft({
      forwarder: "",
      requestType: REQUEST_TYPES[0],
      origin: "",
      destination: "",
      cargo: "",
      jobValue: "",
      requiredTrucks: 1,
    });
    setToast({
      tone: "success",
      title: `${created.id} created and sent for approval.`,
    });
  }

  const columns = [
    {
      key: "id",
      header: "Job",
      width: "14%",
      render: (job) => (
        <span className="tk-cell-id">
          <strong>{job.displayId || job.id}</strong>
          <small>{job.displayCreated !== "—" ? job.displayCreated.replace(" at ", ", ") : "—"}</small>
        </span>
      ),
    },
    {
      key: "forwarder",
      header: "Forwarder",
      width: "17%",
      render: (job) => <span className={styles.forwarder} title={job.displayForwarder}>{job.displayForwarder}</span>,
    },
    {
      key: "route",
      header: "Route",
      width: "24%",
      render: (job) => <RouteStack from={job.origin} to={job.destination} />,
    },
    {
      key: "type",
      header: "Type",
      width: "10%",
      render: (job) => (
        <Badge tone={job.displayType === "Export" ? "success" : "purple"}>
          {shortType(job.displayType)}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Value",
      width: "11%",
      render: (job) => <span className="tk-cell-strong">{naira(job.displayValue)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "11%",
      render: (job) => (
        <Badge tone={statusTone(job.status)} dot>
          {job.status}
        </Badge>
      ),
    },
    {
      key: "assigned",
      header: "Assigned To",
      width: "17%",
      render: (job) => <AssigneeCell job={job} />,
    },
  ];

  if (!jobsResponse && jobsBusy) return <JobsLoading />;

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Jobs & Trips", "Jobs"]}
        title="Jobs"
        description="Every job on Trukkas, from posting to delivery."
      />
      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      {jobsFetching && jobsResponse && (
        <div className={styles.loadingNotice} role="status" aria-live="polite">
          <span className={styles.loadingNoticeDot} aria-hidden="true" />
          Refreshing jobs…
        </div>
      )}
      {jobsError && (
        <Banner tone="danger" title="Unable to load jobs." action={<Button variant="outline" size="sm" icon="rotate-ccw" onClick={refetchJobs}>Retry</Button>} />
      )}
      {statsError && <Banner tone="warning" title="Unable to load job totals." action={<Button variant="outline" size="sm" onClick={refetchStats}>Retry</Button>} />}
      {containerTypesError && <Banner tone="warning" title="Unable to load cargo filter options." action={<Button variant="outline" size="sm" onClick={refetchContainerTypes}>Retry</Button>} />}
      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <StatCard
          icon="clipboard-list"
          tint="blue"
          label="Total Jobs"
          value={card("totalJobs")?.value?.toLocaleString("en-NG") ?? "—"}
          delta={statDelta("totalJobs")}
          direction={statDirection("totalJobs")}
          caption={statCaption}
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="clock-3"
          tint="amber"
          label="Pending Approval"
          value={card("pendingApproval")?.value ?? "—"}
          delta={statDelta("pendingApproval")}
          direction={statDirection("pendingApproval")}
          higherIsBetter={false}
          caption={statCaption}
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="truck"
          tint="blue"
          label="In Transit"
          value={card("inTransit")?.value ?? "—"}
          delta={statDelta("inTransit")}
          direction={statDirection("inTransit")}
          caption={statCaption}
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Delivered"
          value={card("delivered")?.value ?? "—"}
          delta={statDelta("delivered")}
          direction={statDirection("delivered")}
          caption={statCaption}
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Cancelled"
          value={card("cancelled")?.value ?? "—"}
          delta={statDelta("cancelled")}
          direction={statDirection("cancelled")}
          higherIsBetter={false}
          caption={statCaption}
          style={{ minHeight: 92, padding: 13 }}
        />
        {/* <StatCard
          icon="coins"
          tint="amber"
          label="Total Job Value"
          value={naira(counts.value)}
          delta="16%"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="clock-3"
          tint="red"
          label="Demurrage (Est.)"
          value={naira(counts.demurrage)}
          delta="22%"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        /> */}
      </StatsPanel>
      <Card pad="none" className={styles.workspace}>
        {tab === "Pending Approval" && pendingDocsResponse?.pagination.total > 0 && (
          <Banner tone="info" title={`${pendingDocsResponse.pagination.total} job${pendingDocsResponse.pagination.total === 1 ? "" : "s"} awaiting document upload`} style={{ margin: "12px 16px 0" }}>
            {pendingDocsResponse.rows.map((job, index) => <span key={job.id}>{index > 0 ? " · " : ""}<Link to={`/jobs/detail?id=${encodeURIComponent(job.id)}`}>{job.displayId}</Link></span>)}
            {pendingDocsResponse.pagination.total > pendingDocsResponse.rows.length ? " · more pending" : ""}
          </Banner>
        )}
        {tab === "Pending Approval" && pendingDocsError && <Banner tone="warning" title="Unable to load jobs awaiting documents." action={<Button variant="outline" size="sm" onClick={refetchPendingDocs}>Retry</Button>} style={{ margin: "12px 16px 0" }} />}
        <div className={styles.toolbar}>
          <div className={styles.toolbarSearch}>
            <SearchField
              placeholder="Search jobs…" title="Search by job ID, forwarder, route or cargo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="tk-list-toolbar-filters" role="group" aria-label="Filter jobs">
            <FilterControl name="Status" icon="circle-dot" value={tab} allValue="All Jobs" options={["All Jobs", "Pending Approval", "Bidding", "Assigned", "In Transit", "Delivered", "Cancelled", "Flagged", "Rejected"]} menu={menu} setMenu={setMenu} onChange={setTab} />
            <FilterControl name="Type" icon="route" value={typeFilter} allValue="All Types" options={["All Types", ...REQUEST_TYPES]} menu={menu} setMenu={setMenu} onChange={setTypeFilter} />
            <FilterControl name="Cargo" icon="package" value={cargoFilter} allValue="All Cargo" options={["All Cargo", ...cargoTypes]} menu={menu} setMenu={setMenu} onChange={setCargoFilter} />
            <FilterControl name="Origin" icon="map-pin" value={originFilter} allValue="All Locations" options={["All Locations", ...origins]} menu={menu} setMenu={setMenu} onChange={setOriginFilter} />
            <FilterControl name="Destination" icon="flag" value={destinationFilter} allValue="All Locations" options={["All Locations", ...destinations]} menu={menu} setMenu={setMenu} onChange={setDestinationFilter} />
            <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
            {filtersActive && <button type="button" className="tk-clear-filters" onClick={resetFilters}>Clear all</button>}
          </div>
          <div className={styles.toolbarRight}>
            <ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={view} onChange={(next) => { setView(next); if (next === "board") setSelected([]); }} />
            <Button
              variant="outline"
              icon="download"
              disabled={exportingJobs || exportingSheet}
              onClick={() => selected.length
                ? exportRows(jobs.filter((job) => selected.includes(job.id)))
                : void exportAllJobs()}
            >
              {exportingJobs ? "Exporting…" : selected.length ? `Export ${selected.length}` : "Export"}
            </Button>
          </div>
        </div>
        {view === "list" && selected.length > 0 && (
          <div className={styles.bulkBar}>
            <strong>{selected.length} selected</strong>
            <button type="button" onClick={() => exportRows(jobs.filter((job) => selected.includes(job.id)))}>Export selected</button>
            <button type="button" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {view === "list" ? <>
          <DataTable
            selectable
            selected={selected}
            onSelect={setSelected}
            rows={paged}
            rowKey={(job) => job.id}
            columns={columns}
            onRowClick={(job) => setSelectedJobId(job.id)}
          />
          {!jobsBusy && !jobsError && filtered.length === 0 && (
            <div className={styles.empty}>No jobs match the selected filters.</div>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={hasLocalFilters ? undefined : jobsResponse?.pagination?.total ?? filtered.length}
            onPage={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
          />
        </> : <>
          <JobBoard hideEmpty={hideEmptyColumns} jobs={filtered} selectedJobId={selectedJobId} onOpen={setSelectedJobId} />
          {(jobsResponse?.pagination?.total ?? 0) > rawJobs.length && (
            <div className={styles.boardNote}>Showing the {rawJobs.length} most recent of {jobsResponse.pagination.total} jobs. Use filters or the list view to see the rest.</div>
          )}
        </>}
      </Card>
      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onAction={handleAction}
          canDeliver={canDeliver}
          actionBusy={actionBusy}
        />
      )}
      <Modal
        open={Boolean(actionDialog)}
        onClose={() => { if (!actionBusy) setActionDialog(null); }}
        title={actionDialog?.type === "deliver" ? "Mark Job Delivered" : actionDialog?.type === "reject" ? "Reject Documents" : "Cancel Job"}
        description={actionDialog?.job?.displayId || ""}
        footer={<>
          <Button variant="outline" disabled={actionBusy} onClick={() => setActionDialog(null)}>Close</Button>
          <Button disabled={actionBusy || (actionDialog?.type !== "deliver" && !actionNote.trim())} onClick={() => void confirmAction()}>
            {actionBusy ? "Saving…" : actionDialog?.type === "deliver" ? "Mark Delivered" : actionDialog?.type === "reject" ? "Reject Documents" : "Cancel Job"}
          </Button>
        </>}
      >
        {actionDialog?.type === "deliver" && <Banner tone="warning" title="This completes the job and releases the trucker’s final payment." />}
        {actionDialog?.type === "cancel" && <Banner tone="warning" title="This cancels the job and holds escrow for review." />}
        <div style={{ marginTop: 14 }}>
          <TextField
            label={actionDialog?.type === "deliver" ? "Note (optional)" : "Reason"}
            required={actionDialog?.type !== "deliver"}
            value={actionNote}
            maxLength={actionDialog?.type === "deliver" ? 500 : undefined}
            disabled={actionBusy}
            onChange={(event) => setActionNote(event.target.value)}
            placeholder={actionDialog?.type === "deliver" ? "How was delivery confirmed?" : "Explain the decision"}
          />
        </div>
      </Modal>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Job"
        description="Add a logistics job for review."
        width={580}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button form="create-job-form" type="submit">
              Create Job
            </Button>
          </>
        }
      >
        <form
          id="create-job-form"
          className={styles.createForm}
          onSubmit={submitJob}
        >
          <TextField
            required
            label="Company / Requester"
            value={draft.forwarder}
            onChange={(event) =>
              setDraft({ ...draft, forwarder: event.target.value })
            }
            placeholder="e.g. Goodwill Forwarding Ltd."
          />
          <Select
            label="Trip Type"
            value={draft.requestType}
            options={REQUEST_TYPES}
            onChange={(event) =>
              setDraft({ ...draft, requestType: event.target.value })
            }
          />
          <TextField
            required
            label="Origin"
            value={draft.origin}
            onChange={(event) =>
              setDraft({ ...draft, origin: event.target.value })
            }
            placeholder="Pickup location"
          />
          <TextField
            required
            label="Destination"
            value={draft.destination}
            onChange={(event) =>
              setDraft({ ...draft, destination: event.target.value })
            }
            placeholder="Delivery location"
          />
          <TextField
            required
            label="Cargo"
            value={draft.cargo}
            onChange={(event) =>
              setDraft({ ...draft, cargo: event.target.value })
            }
            placeholder="Cargo description"
          />
          <TextField
            required
            min="0"
            type="number"
            label="Job Value (₦)"
            money
            value={draft.jobValue}
            onChange={(event) =>
              setDraft({ ...draft, jobValue: event.target.value })
            }
            placeholder="0"
          />
          <TextField
            required
            min="1"
            max="50"
            type="number"
            label="Trucks Required"
            value={draft.requiredTrucks}
            onChange={(event) => setDraft({ ...draft, requiredTrucks: Math.max(1, Number(event.target.value) || 1) })}
            hint="Each truck will create its own trip and require a separate driver."
          />
        </form>
      </Modal>
    </div>
  );
}
