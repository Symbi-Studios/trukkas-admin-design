"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useGetAdminJobsQuery } from "../store/features/jobs/jobsApi.js";
import {
  approveJob,
  cancelJob,
  createJob,
  markJobDelivered,
} from "../mock/api.js";
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
  "May 24 – May 30, 2026",
  "May 18 – May 23, 2026",
];
const naira = (number) => number == null
  ? "—"
  : `₦${Math.round(number).toLocaleString("en-NG")}`;
const shortType = (type) =>
  type === "Transfer / Value Chain" ? "Transfer" : type;

function normalize(job) {
  const tripCounts = getJobTripCounts(job);
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
    displayCreated: job.createdAt || job.published || "—",
    displayDeadline: job.displayDeadline || null,
    displayCargo: job.cargoDetails || job.cargo || job.cargoType || "—",
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

function Inspector({ job, onClose, onAction, menu, setMenu }) {
  if (!job) return null;
  const pending = job.status === "Pending Approval";
  const timeline = [
    { title: "Job Created", description: job.displayCreated, state: "done" },
    pending
      ? {
          title: "Pending Approval",
          description: "Awaiting review",
          state: "warning",
        }
      : {
          title: job.status,
          description: job.updatedAt || "Status from jobs list",
          state: job.status === "Cancelled" ? "danger" : "current",
        },
    {
      title: pending
        ? "—"
        : job.status === "Delivered"
          ? "Delivered"
          : job.displayDeadline
            ? "Delivery Deadline"
            : "Delivery",
      description: pending
        ? "Not started"
        : job.status === "Delivered"
          ? job.deliveryDate || "Delivery completed"
          : job.displayDeadline || job.deliveryDate || "In progress",
      state: job.status === "Delivered" ? "done" : "pending",
    },
  ];
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
                  ...(job.actionsAvailable === false ? [] : pending
                    ? [
                        {
                          label: "Approve Job",
                          icon: "circle-check",
                          onClick: () => onAction("approve", job),
                        },
                      ]
                    : []),
                  ...(job.actionsAvailable === false ? [] : job.status === "In Transit"
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
                  ...(job.actionsAvailable !== false && job.status !== "Cancelled" && job.status !== "Delivered"
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

  const {
    currentData: jobsResponse,
    isLoading: jobsLoading,
    isFetching: jobsFetching,
    isError: jobsError,
    refetch: refetchJobs,
  } = useGetAdminJobsQuery({ page, limit: pageSize });
  const jobsBusy = jobsLoading || jobsFetching;
  const rawJobs = jobsResponse?.rows || [];
  const jobs = useMemo(
    () =>
      rawJobs
        .map(normalize)
        .sort(
          (a, b) =>
            Number(String(b.displayId).startsWith("JOB-")) - Number(String(a.displayId).startsWith("JOB-")),
        ),
    [rawJobs],
  );

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
  useEffect(() => {
    if (!jobs.length) {
      if (selectedJobId && selectedJobId !== null) setSelectedJobId("");
      return;
    }
    if (selectedJobId === null) return;
    if (!jobs.some((job) => job.id === selectedJobId)) setSelectedJobId(jobs[0].id);
  }, [jobs, selectedJobId]);

  const counts = useMemo(
    () => ({
      total: jobsResponse?.pagination?.total ?? jobs.length,
      pending: jobs.filter((job) => job.status === "Pending Approval").length,
      bidding: jobs.filter((job) => job.status === "Bidding").length,
      assigned: jobs.filter((job) => ["Awaiting Assignment", "Partially Assigned", "Assigned"].includes(job.status)).length,
      inTransit: jobs.filter((job) => ["In Transit", "Partially Delivered", "Attention Required"].includes(job.status)).length,
      delivered: jobs.filter((job) => job.status === "Delivered").length,
      cancelled: jobs.filter((job) =>
        ["Cancelled", "Rejected"].includes(job.status),
      ).length,
      flagged: jobs.filter((job) => job.status === "Rejected").length,
      value: jobs.reduce((sum, job) => sum + job.displayValue, 0),
      demurrage: jobs
        .filter((job) => job.status === "In Transit")
        .reduce((sum, job) => sum + job.displayValue * 0.04, 0),
    }),
    [jobs, jobsResponse?.pagination?.total],
  );
  const locations = useMemo(
    () =>
      [
        ...new Set(
          jobs.flatMap((job) => [job.origin, job.destination]).filter(Boolean),
        ),
      ].sort(),
    [jobs],
  );
  const cargoTypes = useMemo(
    () =>
      [
        ...new Set(
          jobs.map((job) => job.cargoType || job.cargo).filter(Boolean),
        ),
      ].sort(),
    [jobs],
  );
  const tabFilters = {
    "All Jobs": () => true,
    "Pending Approval": (job) => job.status === "Pending Approval",
    Bidding: (job) => job.status === "Bidding",
    Assigned: (job) => ["Awaiting Assignment", "Partially Assigned", "Assigned"].includes(job.status),
    "In Transit": (job) => ["In Transit", "Partially Delivered", "Attention Required"].includes(job.status),
    Delivered: (job) => job.status === "Delivered",
    Cancelled: (job) => ["Cancelled", "Rejected"].includes(job.status),
    Flagged: (job) => job.status === "Rejected",
  };
  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const matchDate =
          dateFilter === "All Dates" ||
          (dateFilter.startsWith("May 24")
            ? /May (2[4-9]|30)/.test(job.displayDeadline || job.displayCreated)
            : /May (1[8-9]|2[0-3])/.test(job.displayDeadline || job.displayCreated));
        return (
          tabFilters[tab]?.(job) &&
          (statusFilter === "All Statuses" || job.status === statusFilter) &&
          (typeFilter === "All Types" || job.displayType === typeFilter) &&
          (cargoFilter === "All Cargo" ||
            (job.cargoType || job.cargo) === cargoFilter) &&
          (originFilter === "All Locations" || job.origin === originFilter) &&
          (destinationFilter === "All Locations" ||
            job.destination === destinationFilter) &&
          matchDate &&
          (!query ||
            [
              job.displayId,
              job.id,
              job.displayForwarder,
              job.displayRoute,
              job.displayCargo,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query.toLowerCase()),
            ))
        );
      }),
    [
      jobs,
      tab,
      statusFilter,
      typeFilter,
      cargoFilter,
      originFilter,
      destinationFilter,
      dateFilter,
      query,
    ],
  );
  const paged = filtered;
  const pageCount = Math.max(1, jobsResponse?.pagination?.totalPages || 1);
  const hasLocalFilters = Boolean(
    query || tab !== "All Jobs" || statusFilter !== "All Statuses"
    || typeFilter !== "All Types" || cargoFilter !== "All Cargo"
    || originFilter !== "All Locations" || destinationFilter !== "All Locations"
    || dateFilter !== "All Dates",
  );
  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;

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
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `trukkas-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast({
      tone: "success",
      title: `${rows.length} job${rows.length === 1 ? "" : "s"} exported.`,
    });
  }
  async function handleAction(action, job) {
    setMenu(null);
    setRowMenu(null);
    if (action === "view") {
      return navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`);
    }
    if (action === "export") return exportRows([job]);
    if (job.actionsAvailable === false) {
      setToast({ tone: "warning", title: "Job actions are not connected yet." });
      return;
    }
    if (action === "approve") await approveJob(job.id);
    if (action === "deliver") await markJobDelivered(job.id);
    if (action === "cancel") await cancelJob(job.id);
    setToast({
      tone: action === "cancel" ? "warning" : "success",
      title: `${job.displayId || job.id} ${action === "approve" ? "approved" : action === "deliver" ? "marked delivered" : "cancelled"}.`,
    });
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
                  ...(job.actionsAvailable === false ? [] : job.status === "Pending Approval"
                    ? [
                        {
                          label: "Approve Job",
                          icon: "circle-check",
                          onClick: () => handleAction("approve", job),
                        },
                      ]
                    : []),
                  ...(job.actionsAvailable === false ? [] : job.status === "In Transit"
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
                  ...(job.actionsAvailable !== false && job.status !== "Cancelled" && job.status !== "Delivered"
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
            May 24, 2026 – May 30, 2026
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
      <section className={styles.metrics} aria-label="Job summary">
        <StatCard
          icon="clipboard-list"
          tint="blue"
          label="Total Jobs"
          value={counts.total.toLocaleString()}
          delta="12%"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="clock-3"
          tint="amber"
          label="Pending Approval"
          value={counts.pending}
          delta="29%"
          direction="down"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="truck"
          tint="blue"
          label="In Transit"
          value={counts.inTransit}
          delta="14%"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Delivered"
          value={counts.delivered}
          delta="14%"
          caption="vs last week"
          style={{ minHeight: 92, padding: 13 }}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Cancelled"
          value={counts.cancelled}
          delta="5%"
          direction="down"
          caption="vs last week"
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
              {name} <span>({count})</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}>
          <FilterControl
            name="Job Status"
            value={statusFilter}
            options={[
              "All Statuses",
              "Pending Approval",
              "Bidding",
              "Awaiting Assignment",
              "Partially Assigned",
              "Assigned",
              "In Transit",
              "Partially Delivered",
              "Attention Required",
              "Delivered",
              "Cancelled",
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
            options={["All Locations", ...locations]}
            menu={menu}
            setMenu={setMenu}
            onChange={setOriginFilter}
          />
          <FilterControl
            name="Destination"
            value={destinationFilter}
            options={["All Locations", ...locations]}
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
                onClick={() =>
                  exportRows(
                    selected.length
                      ? jobs.filter((job) => selected.includes(job.id))
                      : filtered,
                  )
                }
              >
                Export
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
            />
          )}
        </div>
      </Card>
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
