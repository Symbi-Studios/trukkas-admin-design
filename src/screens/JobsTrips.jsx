"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  Icon,
  IconButton,
  Modal,
  Pagination,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  StatCard,
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
const DATE_OPTIONS = [
  "All Dates",
  "Last 7 Days",
  "Previous 7 Days",
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

function dateRange(value) {
  if (value === "All Dates") return {};
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = new Date(start);
  const to = new Date(start);
  if (value === "Previous 7 Days") {
    from.setDate(from.getDate() - 13);
    to.setDate(to.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 6);
  }
  to.setHours(23, 59, 59, 999);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function apiErrorMessage(error, fallback) {
  const detail = error?.data?.message || error?.data?.error || error?.message || error?.error;
  return Array.isArray(detail) ? detail.join(", ") : typeof detail === "string" && detail.trim() ? detail : fallback;
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
  : `₦${Math.round(number).toLocaleString("en-NG")}`;
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

function FilterControl({ name, value, options, menu, setMenu, onChange }) {
  return (
    <span className={styles.filterWrap}>
      <button
        className={styles.filterControl}
        type="button"
        onClick={() => setMenu(menu === name ? null : name)}
      >
        <span>{name}</span>
        <strong>{value}</strong>
        <Icon name="chevron-down" size={14} />
      </button>
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

function Inspector({ job, onClose, onAction, menu, setMenu, canDeliver }) {
  if (!job) return null;
  const timeline = job.timeline.map((event) => ({
    title: event.title,
    description: event.timestamp ? new Date(event.timestamp).toLocaleString("en-NG") : "Upcoming",
    state: event.completed ? "done" : "pending",
  }));
  return (
    <aside className={styles.inspector} aria-label={`Selected job ${job.displayId || job.id}`}>
      <div className={styles.inspectorHead}>
        <span className={styles.jobTitle}>
          <Icon name="package" size={16} />
          {job.displayId || job.id}
        </span>
        <IconButton icon="x" label="Close inspector" onClick={onClose} />
      </div>
      <Badge tone={statusTone(job.status)} dot>
        {job.status}
      </Badge>
      <section className={styles.inspectorSection}>
        <h3>Overview</h3>
        <dl className={styles.detailsList}>
          <div>
            <dt>Company</dt>
            <dd>{job.displayForwarder}</dd>
          </div>
          <div>
            <dt>Trip Type</dt>
            <dd>
              <Badge tone="purple">{shortType(job.displayType)}</Badge>
            </dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>{job.displayRoute}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{job.displayCargo}</dd>
          </div>
          <div>
            <dt>Job Value</dt>
            <dd>
              <strong>{naira(job.displayValue)}</strong>
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{job.displayCreated}</dd>
          </div>
          <div>
            <dt>Trip Fulfilment</dt>
            <dd><strong>{job.assignmentDataAvailable === false
              ? "—"
              : `${job.tripCounts.assigned} of ${job.tripCounts.required} assigned`}</strong></dd>
          </div>
        </dl>
        <div className={styles.requester}>
          <span>Requested By</span>
          <Avatar name={job.contactPerson || "—"} size={34} />
          <span>
            <strong>{job.contactPerson || "—"}</strong>
            <small>{job.contactEmail || "Not provided"}</small>
          </span>
        </div>
      </section>
      <div className={styles.inspectorActions}>
        <Button
          fullWidth
          iconRight="arrow-right"
          onClick={() => onAction("view", job)}
        >
          View Full Details
        </Button>
        <span className={styles.moreWrap}>
          <Button
            fullWidth
            variant="outline"
            iconRight="chevron-down"
            onClick={() => setMenu(menu === "more" ? null : "more")}
          >
            More Actions
          </Button>
          {menu === "more" && (
            <span className={styles.moreMenu}>
              <DropdownMenu
                width={240}
                items={[
                  ...(job.canValidateDocs
                    ? [
                        {
                          label: "Approve Job",
                          icon: "circle-check",
                          onClick: () => onAction("approve", job),
                        },
                      ]
                    : []),
                  ...(job.canRejectDocs ? [{
                    label: "Reject Documents", icon: "circle-x", tone: "danger",
                    onClick: () => onAction("reject", job),
                  }] : []),
                  ...(job.canMarkDelivered && canDeliver
                    ? [
                        {
                          label: "Mark Delivered",
                          icon: "circle-check",
                          onClick: () => onAction("deliver", job),
                        },
                      ]
                    : []),
                  {
                    label: "Export Job Sheet",
                    icon: "download",
                    onClick: () => onAction("export", job),
                  },
                  ...(job.canCancel
                    ? [
                        { divider: true },
                        {
                          label: "Cancel Job",
                          icon: "ban",
                          tone: "danger",
                          onClick: () => onAction("cancel", job),
                        },
                      ]
                    : []),
                ]}
              />
            </span>
          )}
        </span>
      </div>
      <section className={styles.timelineSection}>
        <h3>Timeline</h3>
        <div className={styles.timeline}>
          {timeline.map((item, index) => (
            <div className={styles.timelineItem} key={`${item.title}-${index}`}>
              <span className={`${styles.timelineDot} ${styles[item.state]}`} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    </aside>
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
      <div className={styles.loadingNotice} role="status" aria-live="polite">
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
  const navigate = useNavigate();
  const adminRole = useSelector((state) => state.auth.admin?.role);
  const canDeliver = DELIVERY_ROLES.has(adminRole);
  const [tab, setTab] = useState("All Jobs");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [cargoFilter, setCargoFilter] = useState("All Cargo");
  const [originFilter, setOriginFilter] = useState("All Locations");
  const [destinationFilter, setDestinationFilter] = useState("All Locations");
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
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

  const selectedRange = useMemo(() => dateRange(dateFilter), [dateFilter]);
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
  } = useGetAdminJobsQuery({ ...listFilters, page, limit: pageSize });
  const {
    currentData: statsResponse,
    isError: statsError,
    refetch: refetchStats,
  } = useGetAdminJobStatsQuery(selectedRange);
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
    const onGlobalSearch = (event) => setQuery(event.detail || "");
    window.addEventListener("trukkas:global-search", onGlobalSearch);
    return () =>
      window.removeEventListener("trukkas:global-search", onGlobalSearch);
  }, []);
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
  useEffect(() => {
    if (!jobs.length) {
      if (selectedJobId && selectedJobId !== null) setSelectedJobId("");
      return;
    }
    if (selectedJobId === null) return;
    if (!jobs.some((job) => job.id === selectedJobId)) setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  const counts = {
    total: statsResponse?.tabs.all ?? null,
    pending: statsResponse?.tabs.pendingApproval ?? null,
    bidding: statsResponse?.tabs.bidding ?? null,
    assigned: statsResponse?.tabs.assigned ?? null,
    inTransit: statsResponse?.tabs.inTransit ?? null,
    delivered: statsResponse?.tabs.delivered ?? null,
    cancelled: statsResponse?.tabs.cancelled ?? null,
    flagged: statsResponse?.tabs.flagged ?? null,
  };
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
  const statCaption = dateFilter === "All Dates" ? "vs last week" : "vs previous period";
  const card = (key) => statsResponse?.cards[key];
  const statDelta = (key) => card(key)?.changePercent == null ? undefined : `${Math.abs(card(key).changePercent)}%`;
  const statDirection = (key) => card(key)?.trend === "DOWN" ? "down" : "up";

  function resetFilters() {
    setStatusFilter("All Statuses");
    setTypeFilter("All Types");
    setCargoFilter("All Cargo");
    setOriginFilter("All Locations");
    setDestinationFilter("All Locations");
    setDateFilter("All Dates");
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
      header: "Job ID",
      width: 92,
      render: (job) => (
        <Link
          to={`/jobs/detail?id=${encodeURIComponent(job.id)}`}
          className={styles.jobLink}
          onClick={(event) => event.stopPropagation()}
        >
          {job.displayId || job.id}
        </Link>
      ),
    },
    {
      key: "company",
      header: "Company / Requester",
      width: 170,
      render: (job) => (
        <span className={styles.twoLine}>
          <strong>{job.displayForwarder}</strong>
          <small>{job.originCountry || "—"}</small>
        </span>
      ),
    },
    {
      key: "type",
      header: "Trip Type",
      width: 128,
      render: (job) => (
        <Badge tone={job.displayType === "Export" ? "success" : "purple"}>
          {shortType(job.displayType)}
        </Badge>
      ),
    },
    {
      key: "route",
      header: "Route",
      width: 165,
      render: (job) => <span className={styles.route}>{job.displayRoute}</span>,
    },
    {
      key: "cargo",
      header: "Cargo",
      width: 150,
      render: (job) => <span className={styles.cargo}>{job.displayCargo}</span>,
    },
    {
      key: "value",
      header: "Value (₦)",
      width: 106,
      render: (job) => (
        <strong className={styles.value}>{naira(job.displayValue)}</strong>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 112,
      render: (job) => (
        <Badge tone={statusTone(job.status)} dot>
          {job.status}
        </Badge>
      ),
    },
    {
      key: "assigned",
      header: "Assigned To",
      width: 130,
      render: (job) =>
        job.displayAssignee ? (
          <span className={styles.assignee}>
            <Avatar name={job.truckingCompany || job.truckCompany || job.displayAssignee} size={26} />
            {job.assignmentDataAvailable === false
              ? <span>{job.displayAssignee}</span>
              : <span className={styles.twoLine}><strong>{job.tripCounts.assigned} of {job.tripCounts.required} trips</strong><small>{job.truckingCompany || job.truckCompany}</small></span>}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "created",
      header: "Dates",
      width: 116,
      render: (job) => (
        <span className={styles.dateCell}>
          {job.displayCreated !== "—" ? (
            <>
              <span>{job.displayCreated.replace(" at ", ", ")}</span>
              <small>Created</small>
            </>
          ) : job.displayDeadline ? (
            <>
              <span>{job.displayDeadline}</span>
              <small>Deadline</small>
              {job.freeDays != null && <small>{job.freeDays} free days</small>}
            </>
          ) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: 54,
      render: (job) => (
        <span className={styles.rowMenuWrap}>
          <IconButton
            icon="ellipsis"
            label={`Actions for ${job.displayId || job.id}`}
            onClick={(event) => {
              event.stopPropagation();
              setRowMenu(rowMenu === job.id ? null : job.id);
            }}
          />
          {rowMenu === job.id && (
            <span
              className={styles.rowMenu}
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenu
                width={210}
                items={[
                  {
                    label: "View Job Details",
                    icon: "eye",
                    onClick: () => handleAction("view", job),
                  },
                  ...(job.canValidateDocs
                    ? [
                        {
                          label: "Approve Job",
                          icon: "circle-check",
                          onClick: () => handleAction("approve", job),
                        },
                      ]
                    : []),
                  ...(job.canRejectDocs ? [{
                    label: "Reject Documents", icon: "circle-x", tone: "danger",
                    onClick: () => handleAction("reject", job),
                  }] : []),
                  ...(job.canMarkDelivered && canDeliver
                    ? [
                        {
                          label: "Mark Delivered",
                          icon: "circle-check",
                          onClick: () => handleAction("deliver", job),
                        },
                      ]
                    : []),
                  {
                    label: "Export Job Sheet",
                    icon: "download",
                    onClick: () => handleAction("export", job),
                  },
                  ...(job.canCancel
                    ? [
                        { divider: true },
                        {
                          label: "Cancel Job",
                          icon: "ban",
                          tone: "danger",
                          onClick: () => handleAction("cancel", job),
                        },
                      ]
                    : []),
                ]}
              />
            </span>
          )}
        </span>
      ),
    },
  ];

  if (!jobsResponse && jobsBusy) return <JobsLoading />;

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Jobs & Trips", "Jobs"]}
        title="Jobs"
        description="View, manage and monitor all logistics jobs across Trukkas."
        actions={<span className={styles.headerActions}>
          <button
            className={styles.dateButton}
            type="button"
            onClick={() =>
              setMenu(menu === "Header Date" ? null : "Header Date")
            }
          >
            <Icon name="calendar-days" size={17} />
            {dateFilter}
            <Icon name="chevron-down" size={14} />
          </button>
          {/* <Button icon="plus" onClick={() => setCreateOpen(true)}>
            Create Job
          </Button> */}
          <FilterMenu
            open={menu === "Header Date"}
            options={DATE_OPTIONS}
            value={dateFilter}
            onChange={(value) => {
              setDateFilter(value);
              setMenu(null);
            }}
          />
        </span>}
      />
      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {jobsFetching && jobsResponse && (
        <div className={styles.loadingNotice} role="status" aria-live="polite">
          <span className={styles.loadingNoticeDot} aria-hidden="true" />
          Refreshing jobs…
        </div>
      )}
      {jobsError && (
        <div className={styles.loadError}>
          <Banner tone="danger" title="Unable to load jobs from the API." />
          <Button variant="outline" icon="rotate-ccw" onClick={refetchJobs}>
            Retry
          </Button>
        </div>
      )}
      {statsError && <Banner tone="warning" title="Unable to load job totals." action={<Button variant="outline" size="sm" onClick={refetchStats}>Retry</Button>} />}
      {containerTypesError && <Banner tone="warning" title="Unable to load cargo filter options." action={<Button variant="outline" size="sm" onClick={refetchContainerTypes}>Retry</Button>} />}
      <section className={styles.metrics} aria-label="Job summary">
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
      </section>
      <Card pad="none" className={styles.workspace}>
        <div className={styles.tabs}>
          {[
            ["All Jobs", counts.total],
            ["Pending Approval", counts.pending],
            ["Bidding", counts.bidding],
            ["Assigned", counts.assigned],
            ["In Transit", counts.inTransit],
            ["Delivered", counts.delivered],
            ["Cancelled", counts.cancelled],
            ["Flagged", counts.flagged],
          ].map(([name, count]) => (
            <button
              type="button"
              className={tab === name ? styles.activeTab : ""}
              key={name}
              onClick={() => setTab(name)}
            >
              {name} <span>({count ?? "—"})</span>
            </button>
          ))}
        </div>
        {tab === "Pending Approval" && pendingDocsResponse?.pagination.total > 0 && (
          <Banner tone="info" title={`${pendingDocsResponse.pagination.total} job${pendingDocsResponse.pagination.total === 1 ? "" : "s"} awaiting document upload`} style={{ margin: "12px 16px 0" }}>
            {pendingDocsResponse.rows.map((job, index) => <span key={job.id}>{index > 0 ? " · " : ""}<Link to={`/jobs/detail?id=${encodeURIComponent(job.id)}`}>{job.displayId}</Link></span>)}
            {pendingDocsResponse.pagination.total > pendingDocsResponse.rows.length ? " · more pending" : ""}
          </Banner>
        )}
        {tab === "Pending Approval" && pendingDocsError && <Banner tone="warning" title="Unable to load jobs awaiting documents." action={<Button variant="outline" size="sm" onClick={refetchPendingDocs}>Retry</Button>} style={{ margin: "12px 16px 0" }} />}
        <div className={styles.filterBar}>
          <FilterControl
            name="Job Status"
            value={statusFilter}
            options={[
              "All Statuses",
              "Pending Approval",
              "Bidding",
              "Assigned",
              "In Transit",
              "Delivered",
              "Cancelled",
              "Flagged",
              "Rejected",
            ]}
            menu={menu}
            setMenu={setMenu}
            onChange={setStatusFilter}
          />
          <FilterControl
            name="Trip Type"
            value={typeFilter}
            options={["All Types", ...REQUEST_TYPES]}
            menu={menu}
            setMenu={setMenu}
            onChange={setTypeFilter}
          />
          <FilterControl
            name="Cargo Type"
            value={cargoFilter}
            options={["All Cargo", ...cargoTypes]}
            menu={menu}
            setMenu={setMenu}
            onChange={setCargoFilter}
          />
          <FilterControl
            name="Origin"
            value={originFilter}
            options={["All Locations", ...origins]}
            menu={menu}
            setMenu={setMenu}
            onChange={setOriginFilter}
          />
          <FilterControl
            name="Destination"
            value={destinationFilter}
            options={["All Locations", ...destinations]}
            menu={menu}
            setMenu={setMenu}
            onChange={setDestinationFilter}
          />
          <FilterControl
            name="Date Range"
            value={dateFilter}
            options={DATE_OPTIONS}
            menu={menu}
            setMenu={setMenu}
            onChange={setDateFilter}
          />
          <Button
            variant="outline"
            icon="list-filter"
            onClick={() => setMenu(null)}
          >
            Filters
          </Button>
          <Button variant="ghost" icon="rotate-ccw" onClick={resetFilters}>
            Reset
          </Button>
        </div>
        <div
          className={`${styles.mainGrid} ${selectedJob ? "" : styles.noInspector}`}
        >
          <div className={styles.tableArea}>
            <div className={styles.tableTools}>
              <SearchField
                placeholder="Search by Job ID, company, route, or cargo…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                variant="outline"
                icon="download"
                disabled={exportingJobs || exportingSheet}
                onClick={() => selected.length
                  ? exportRows(jobs.filter((job) => selected.includes(job.id)))
                  : void exportAllJobs()}
              >
                {exportingJobs ? "Exporting…" : "Export"}
              </Button>
              <IconButton icon="list" label="List view" tone="outline" />
              <IconButton icon="grid-2x2" label="Grid view" tone="outline" />
            </div>
            {selected.length > 0 && (
              <div className={styles.bulkBar}>
                <strong>{selected.length} selected</strong>
                <button
                  type="button"
                  onClick={() =>
                    exportRows(jobs.filter((job) => selected.includes(job.id)))
                  }
                >
                  Export selected
                </button>
                <button type="button" onClick={() => setSelected([])}>
                  Clear
                </button>
              </div>
            )}
            <div className={styles.tableShell}>
              <DataTable
                selectable
                selected={selected}
                onSelect={setSelected}
                rows={paged}
                rowKey={(job) => job.id}
                columns={columns}
                tableLayout="fixed"
                onRowClick={(job) => setSelectedJobId(job.id)}
              />
            </div>
            {!jobsBusy && !jobsError && filtered.length === 0 && (
              <div className={styles.empty}>
                No jobs match the selected filters.
              </div>
            )}
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={hasLocalFilters ? undefined : jobsResponse?.pagination?.total ?? filtered.length}
              onPage={(next) =>
                setPage(
                  Math.min(Math.max(1, next), pageCount),
                )
              }
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
          {selectedJob && (
            <Inspector
              job={selectedJob}
              onClose={() => setSelectedJobId(null)}
              onAction={handleAction}
              menu={menu}
              setMenu={setMenu}
              canDeliver={canDeliver}
            />
          )}
        </div>
      </Card>
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
