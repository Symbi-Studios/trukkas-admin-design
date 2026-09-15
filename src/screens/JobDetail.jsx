"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  Card,
  SectionCard,
  DataTable,
  DropdownMenu,
  Icon,
  Modal,
  PageHeader,
  Tabs,
  Timeline,
  Avatar,
  Pagination,
  EmptyState,
  StatCard,
  BarChart,
  DonutChart,
  SearchField,
  FilterSelect,
  SplitButton,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { normalizePayouts } from "../domain/payouts.js";
import {
  approveJob,
  rejectJob,
  acceptJobBid,
  markJobInTransit,
  markJobDelivered,
  cancelJob,
  reviewJobDocument,
  updateJobTripStatus,
} from "../mock/api.js";
import { getJobTripCounts, getJobTrips } from "../domain/jobTrips.js";
import "./JobDetail.css";

const STAGES = [
  "Created",
  "Pending Approval",
  "Bidding",
  "Assigned",
  "In Transit",
  "Delivered",
];
const STAGE_ICONS = [
  "file-plus",
  "hourglass",
  "gavel",
  "truck",
  "route",
  "circle-check",
];
const STATUS_TONE = {
  "Pending Approval": "warning",
  Bidding: "purple",
  Assigned: "info",
  "In Transit": "warning",
  Delivered: "success",
  Cancelled: "neutral",
  Rejected: "danger",
  Open: "info",
  "At Pickup": "warning",
  "Awaiting Assignment": "warning",
  "Partially Assigned": "warning",
  "Partially Delivered": "info",
  "Attention Required": "danger",
  Delayed: "danger",
};
export const statusTone = (s) => STATUS_TONE[s] || "neutral";
const naira = (n) => `₦${Math.round(n || 0).toLocaleString("en-NG")}`;
const nairaShort = (n) =>
  Math.abs(n) >= 1000000
    ? `₦${(n / 1000000).toFixed(1)}M`
    : `₦${Math.round(n / 1000)}K`;
const TINT = {
  blue: ["var(--tk-blue-soft)", "var(--tk-blue)"],
  green: ["var(--tk-success-soft)", "var(--tk-success)"],
  purple: ["var(--tk-purple-soft)", "var(--tk-purple)"],
  amber: ["var(--tk-warning-soft)", "var(--tk-warning)"],
  neutral: ["var(--tk-surface-sunk)", "var(--tk-ink-400)"],
};

function seedNum(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const BID_POOL = [
  "Prime Container Services",
  "Transglobal Logistics",
  "Westafrica Forwarders",
  "Oceanic Transport",
  "SpeedLine Logistics",
  "D-Line Logistics",
];

function fallbackBids(job) {
  const h = seedNum(job.id);
  const n = 2 + (h % 3);
  const base = (job.jobValue || 1000000) * 0.68;
  return Array.from({ length: n }).map((_, i) => ({
    company: BID_POOL[(h + i * 7) % BID_POOL.length],
    rating: Number((4 + ((h + i * 13) % 9) / 10).toFixed(1)),
    trips: 30 + ((h + i * 23) % 160),
    amount: Math.round((base + ((h + i * 4177) % 300000)) / 1000) * 1000,
    estDeliveryDate: job.deliveryDate || "—",
    services: i % 2 ? ["Truck", "Driver", "Fuel"] : ["Truck", "Driver"],
    submittedAt: job.createdAt || job.published || "—",
    status: i === 0 ? "Best Offer" : i === 1 ? "Competitive" : "Standard",
  }));
}

function fallbackDocuments(job) {
  const staged = ["Bidding", "Assigned", "In Transit", "Delivered"].includes(
    job.status,
  );
  const base = [
    {
      id: "auto-1",
      name: "Bill of Lading.pdf",
      type: "B/L",
      submittedBy: job.forwarder,
      date: job.createdAt || job.published,
      status: "Approved",
      size: "2.1 MB",
    },
    {
      id: "auto-2",
      name: "Packing List.xlsx",
      type: "Packing List",
      submittedBy: job.forwarder,
      date: job.createdAt || job.published,
      status: "Approved",
      size: "280 KB",
    },
    {
      id: "auto-3",
      name: "Commercial Invoice.pdf",
      type: "Invoice",
      submittedBy: job.forwarder,
      date: job.createdAt || job.published,
      status: staged ? "Approved" : "Pending",
      size: "900 KB",
    },
  ];
  if (job.truckingCompany)
    base.push({
      id: "auto-4",
      name: "Insurance Certificate.pdf",
      type: "Insurance",
      submittedBy: job.truckingCompany,
      date: job.updatedAt,
      status: "Approved",
      size: "310 KB",
    });
  return base;
}

function fallbackTracking(job) {
  const items = [
    {
      time: job.createdAt || job.published,
      location: "—",
      status: "Created",
      details: "Job created by forwarder.",
      source: "System",
    },
  ];
  if (job.status !== "Pending Approval")
    items.push({
      time: job.updatedAt,
      location: "—",
      status: "Approved",
      details: "Job approved by Super Admin.",
      source: "System",
    });
  if (job.truckingCompany)
    items.push({
      time: job.updatedAt,
      location: job.origin || "—",
      status: "Assigned",
      details: `Truck and driver assigned by ${job.truckingCompany}.`,
      source: "System",
    });
  if (["In Transit", "Delivered"].includes(job.status))
    items.push({
      time: job.updatedAt,
      location: job.origin || "—",
      status: "Departed",
      details: "Left origin terminal.",
      source: "Driver App",
    });
  if (job.status === "In Transit")
    items.push({
      time: job.updatedAt,
      location: "En route",
      status: "In Transit",
      details: "Truck moving towards destination.",
      source: "GPS",
    });
  if (job.status === "Delivered")
    items.push({
      time: job.updatedAt,
      location: job.destination || "—",
      status: "Delivered",
      details: "Cargo delivered to destination.",
      source: "Driver App",
    });
  return items.slice().reverse();
}

function fallbackTransactions(job) {
  const fee = Math.round(
    (job.jobValue || 0) * ((job.platformFeePct || 8) / 100),
  );
  const payout = (job.jobValue || 0) - fee;
  const rows = [
    {
      date: job.createdAt || job.published,
      description: `Forwarder payment received (${job.forwarder})`,
      amount: job.jobValue || 0,
      status: "Completed",
      reference: `TRX-${seedNum(job.id) % 900000}`,
    },
    {
      date: job.createdAt || job.published,
      description: `Platform fee (${job.platformFeePct || 8}%)`,
      amount: -fee,
      status: "Allocated",
      reference: `FEE-${(job.id || "").replace(/\D/g, "")}`,
    },
  ];
  if (job.truckingCompany)
    rows.push({
      date: job.updatedAt,
      description: `Trucking company payout (${job.truckingCompany})`,
      amount: -payout,
      status: job.status === "Delivered" ? "Completed" : "Processing",
      reference: `PAYOUT-${seedNum(job.truckingCompany) % 90000}`,
    });
  rows.push({
    date: null,
    description: "Demurrage charges",
    amount: 0,
    status: "Not incurred",
    reference: "—",
  });
  return rows;
}

function fallbackActivity(job) {
  const items = [
    {
      time: job.createdAt || job.published,
      user: job.forwarder,
      role: "Forwarder",
      action: "Job Created",
      details: `Job created with route ${job.route || `${job.origin} → ${job.destination}`}.`,
    },
  ];
  if (job.status !== "Pending Approval")
    items.unshift({
      time: job.updatedAt,
      user: "Super Admin",
      role: "Trukkas",
      action: "Job Approved",
      details: "Job approved and released for bidding.",
    });
  if (job.truckingCompany)
    items.unshift({
      time: job.updatedAt,
      user: job.truckingCompany,
      role: "Trucking Company",
      action: "Assignment Confirmed",
      details: `${getJobTripCounts(job).assigned} of ${getJobTripCounts(job).required} truck and driver pairs assigned.`,
    });
  return items;
}

function InfoStrip({ items }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((it, i) => (
        <Card
          key={i}
          pad="tight"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--tk-r-sm)",
              background: TINT[it.tint || "blue"][0],
              color: TINT[it.tint || "blue"][1],
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            <Icon name={it.icon} size={16} />
          </span>
          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <span className="tk-meta">{it.label}</span>
            <strong
              style={{
                font: "600 13px/18px var(--tk-font-sans)",
                color: "var(--tk-ink-900)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.value}
            </strong>
            {it.caption && (
              <span
                className="tk-meta"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {it.caption}
              </span>
            )}
          </span>
        </Card>
      ))}
    </div>
  );
}

function StatusStepper({ stageIndex, dates = [], terminal }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {STAGES.map((s, i) => (
        <Fragment key={s}>
          <div
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 6,
              width: 60,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                background: terminal
                  ? "var(--tk-surface-sunk)"
                  : i < stageIndex
                    ? "var(--tk-success)"
                    : i === stageIndex
                      ? "var(--tk-blue)"
                      : "var(--tk-surface-sunk)",
                color:
                  !terminal && i <= stageIndex ? "#fff" : "var(--tk-ink-300)",
                font: "700 12px var(--tk-font-sans)",
              }}
            >
              {!terminal && i < stageIndex ? (
                <Icon name="check" size={13} color="#fff" />
              ) : (
                i + 1
              )}
            </span>
            <span
              style={{
                font:
                  (i === stageIndex && !terminal ? "700" : "500") +
                  " 11px/14px var(--tk-font-sans)",
                color:
                  !terminal && i <= stageIndex
                    ? "var(--tk-ink-900)"
                    : "var(--tk-ink-300)",
                textAlign: "center",
              }}
            >
              {s}
            </span>
            {dates[i] && (
              <span className="tk-meta" style={{ fontSize: 10 }}>
                {dates[i]}
              </span>
            )}
          </div>
          {i < STAGES.length - 1 && (
            <span
              style={{
                flex: 1,
                height: 2,
                marginTop: 13,
                background:
                  !terminal && i < stageIndex
                    ? "var(--tk-success)"
                    : "var(--tk-line)",
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function EntityRow({ icon, tint = "blue", label, value, action }) {
  return (
    <div className="jd-entity-row">
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--tk-r-sm)",
          background: TINT[tint][0],
          color: TINT[tint][1],
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
        <span className="tk-meta">{label}</span>
        <strong
          style={{
            font: "600 13px/18px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </strong>
      </span>
      {action}
    </div>
  );
}

function NeedHelpCard({ topic, onContact }) {
  return (
    <SectionCard title="Need Help?">
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--tk-r-sm)",
            background: "var(--tk-blue-soft)",
            color: "var(--tk-blue)",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <Icon name="headset" size={16} />
        </span>
        <span className="tk-meta">
          Have questions about {topic}? Contact your operations team.
        </span>
      </div>
      <Button variant="outline" fullWidth icon="mail" onClick={onContact}>
        Contact Support
      </Button>
    </SectionCard>
  );
}

function ExternalLink({ children, onClick }) {
  return (
    <a
      onClick={onClick}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
      <Icon name="arrow-right" size={12} />
    </a>
  );
}

export function JobDetail() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const jobs = useCollection("jobs") || [];
  const payoutRows = useCollection("payoutRequests") || [];
  const payoutRequests = useMemo(() => normalizePayouts(payoutRows, jobs), [payoutRows, jobs]);
  const job = jobs.find((j) => j.id === decodeURIComponent(jobId || ""));

  const [tab, setTab] = useState("Overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [acceptBidFor, setAcceptBidFor] = useState(null);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [toast, setToast] = useState(null);

  const [docQuery, setDocQuery] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("All Statuses");
  const [docOpenFilter, setDocOpenFilter] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState("All Activities");
  const [activityOpenFilter, setActivityOpenFilter] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [tripMenu, setTripMenu] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const bids = useMemo(() => (job ? job.bids || fallbackBids(job) : []), [job]);
  const documents = useMemo(
    () => (job ? job.documents || fallbackDocuments(job) : []),
    [job],
  );
  const trackingUpdates = useMemo(
    () => (job ? job.trackingUpdates || fallbackTracking(job) : []),
    [job],
  );
  const transactions = useMemo(
    () => (job ? job.transactions || fallbackTransactions(job) : []),
    [job],
  );
  const activityLog = useMemo(
    () => (job ? job.activityLog || fallbackActivity(job) : []),
    [job],
  );
  const photos = useMemo(() => (job ? job.photos || [] : []), [job]);
  const jobTrips = useMemo(() => getJobTrips(job), [job]);
  const tripCounts = useMemo(() => getJobTripCounts(job), [job]);
  const selectedTrip = jobTrips.find((trip) => trip.id === selectedTripId) || jobTrips[0] || null;

  useEffect(() => {
    const tripId = new URLSearchParams(window.location.search).get("tripId");
    if (tripId && jobTrips.some((trip) => trip.id === tripId)) {
      setSelectedTripId(tripId);
      setTab("Tracking & Updates");
    }
  }, [jobTrips]);

  useEffect(() => {
    setReviewDoc((d) =>
      d
        ? documents.find((x) => x.id === d.id) || documents[0] || null
        : documents[0] || null,
    );
  }, [documents]);

  if (!job) {
    return (
      <Card>
        <span className="tk-body">No job found with ID {jobId}.</span>
        <div style={{ marginTop: 12 }}>
          <Button
            variant="outline"
            icon="arrow-left"
            onClick={() => navigate("/jobs")}
          >
            Back to Jobs
          </Button>
        </div>
      </Card>
    );
  }

  function notify(tone, title) {
    setToast({ tone, title });
  }

  const terminal = job.status === "Cancelled" || job.status === "Rejected";
  const workflowStatus = ["Awaiting Assignment", "Partially Assigned"].includes(job.status)
    ? "Assigned"
    : job.status === "Partially Delivered" || job.status === "Attention Required"
      ? "In Transit"
      : job.status;
  const stageIndex = terminal
    ? STAGES.indexOf("Pending Approval")
    : Math.max(0, STAGES.indexOf(workflowStatus));
  const stageDates = [
    job.createdAt || job.published,
    job.status !== "Pending Approval" ? job.updatedAt : undefined,
  ];

  const fee = Math.round(
    (job.jobValue || 0) * ((job.platformFeePct || 8) / 100),
  );
  const acceptedBid = bids.find((b) => b.company === job.truckingCompany);
  const driverPayment = job.truckingCompany
    ? acceptedBid?.amount || job.jobValue - fee
    : null;
  const demurrage = job.demurrage || 0;
  const otherCosts =
    job.status === "In Transit" || job.status === "Delivered"
      ? Math.round((job.jobValue || 0) * 0.05)
      : 0;
  const netEarnings = fee;
  const tripFinancials = jobTrips.map((trip) => ({
    ...trip,
    cost: trip.cost || Math.round((driverPayment || 0) / Math.max(1, jobTrips.length)),
    driverPayment: trip.driverPayment || 0,
    expenses: trip.expenses || 0,
  }));
  const relatedPayouts = payoutRequests.filter((payout) =>
    payout.jobId === job.id || payout.jobIds?.includes(job.id),
  );

  async function doApprove() {
    await approveJob(job.id);
    setApproveOpen(false);
    notify("success", `${job.id} approved and released for bidding.`);
  }
  async function doReject() {
    await rejectJob(job.id);
    setRejectOpen(false);
    notify("danger", `${job.id} was rejected.`);
  }
  async function doAcceptBid(bid) {
    await acceptJobBid(job.id, bid.company);
    setAcceptBidFor(null);
    notify("success", `${bid.company} assigned to ${job.id}.`);
  }
  async function doMarkInTransit() {
    await markJobInTransit(job.id);
    notify("info", `${job.id} marked as In Transit.`);
  }
  async function doMarkDelivered() {
    await markJobDelivered(job.id);
    notify("success", `${job.id} marked as Delivered.`);
  }
  async function doTripStatus(tripId, status) {
    await updateJobTripStatus(job.id, tripId, status);
    setTripMenu(null);
    notify(status === "Delayed" ? "warning" : "success", `${tripId} marked as ${status}.`);
  }
  async function doCancel() {
    await cancelJob(job.id);
    setMoreOpen(false);
    notify("danger", `${job.id} cancelled.`);
  }
  async function doReviewDoc(doc, approve) {
    await reviewJobDocument(job.id, doc.id, approve);
    notify(
      approve ? "success" : "danger",
      `${doc.name} marked as ${approve ? "approved" : "rejected"}.`,
    );
  }
  const headerActions = (
    <>
      <span style={{ position: "relative" }}>
        <Button
          variant="outline"
          icon="ellipsis-vertical"
          onClick={() => setMoreOpen((o) => !o)}
        />
        {moreOpen && (
          <span style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }}>
            <DropdownMenu
              width={220}
              items={[
                // {
                //   label: "Edit Job",
                //   icon: "pencil",
                //   onClick: () => {
                //     setMoreOpen(false);
                //     notify("info", "Editing is not available in this preview.");
                //   },
                // },
                {
                  label: "Duplicate Job",
                  icon: "copy",
                  onClick: () => {
                    setMoreOpen(false);
                    notify("success", "Job duplicated as a draft.");
                  },
                },
                {
                  label: "Print Job Sheet",
                  icon: "printer",
                  onClick: () => {
                    setMoreOpen(false);
                    window.print();
                  },
                },
                { divider: true },
                {
                  label: "Flag for Review",
                  icon: "flag",
                  onClick: () => {
                    setMoreOpen(false);
                    notify(
                      "warning",
                      `${job.id} flagged for operations review.`,
                    );
                  },
                },
                ...(job.status === "In Transit"
                  ? [
                      {
                        label: "Mark Delivered",
                        icon: "circle-check",
                        onClick: () => {
                          setMoreOpen(false);
                          doMarkDelivered();
                        },
                      },
                    ]
                  : []),
                ...(job.status === "Assigned"
                  ? [
                      {
                        label: "Mark In Transit",
                        icon: "truck",
                        onClick: () => {
                          setMoreOpen(false);
                          doMarkInTransit();
                        },
                      },
                    ]
                  : []),
                ...(!terminal && job.status !== "Delivered"
                  ? [
                      {
                        label: "Cancel Job",
                        icon: "ban",
                        tone: "danger",
                        onClick: doCancel,
                      },
                    ]
                  : []),
              ]}
            />
          </span>
        )}
      </span>
      <Button
        variant="outline"
        icon="share-2"
        onClick={() => notify("info", "Share link copied to clipboard.")}
      >
        Share
      </Button>
      {job.status === "Pending Approval" ? (
        <>
          {/* <Button
            variant="outline"
            icon="pencil"
            onClick={() =>
              notify("info", "Editing is not available in this preview.")
            }
          >
            Edit Job
          </Button> */}
          <SplitButton
            icon="check"
            onAction={() => setApproveOpen(true)}
            onToggle={() => setRejectOpen(true)}
          >
            Approve Job
          </SplitButton>
        </>
      ) : !terminal ? (
        <>
          <Button
            variant="outline"
            icon="map-pin"
            onClick={() => setMapOpen(true)}
          >
            View on Map
          </Button>
          {/* <Button
            icon="pencil"
            onClick={() =>
              notify("info", "Editing is not available in this preview.")
            }
          >
            Edit Job
          </Button> */}
        </>
      ) : null}
    </>
  );

  const documentStatusCounts = {
    total: documents.length,
    approved: documents.filter((d) => d.status === "Approved").length,
    pending: documents.filter((d) => d.status === "Pending").length,
    rejected: documents.filter((d) => d.status === "Rejected").length,
  };
  const filteredDocuments = documents.filter(
    (d) =>
      (docStatusFilter === "All Statuses" || d.status === docStatusFilter) &&
      (!docQuery || d.name.toLowerCase().includes(docQuery.toLowerCase())),
  );

  const LOG_PAGE_SIZE = 8;
  const filteredActivity =
    activityFilter === "All Activities"
      ? activityLog
      : activityLog.filter((a) => a.action === activityFilter);
  const pagedActivity = filteredActivity.slice(
    (logPage - 1) * LOG_PAGE_SIZE,
    logPage * LOG_PAGE_SIZE,
  );
  const activityActions = [...new Set(activityLog.map((a) => a.action))];
  const uniqueActivityUsers = new Set(activityLog.map((a) => a.user)).size;

  return (
    <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
      <PageHeader
        crumbs={["Jobs & Trips", "Jobs", job.id]}
        title={job.id}
        meta={<Badge tone={statusTone(job.status)} dot>{job.status}</Badge>}
        description={`Created on ${job.createdAt || job.published} • Last updated ${job.updatedAt || "—"}`}
        actions={<>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>Back to Jobs</Button>
          {headerActions}
        </>}
      />

      {toast && (
        <Banner
          tone={toast.tone === "danger" ? "danger" : toast.tone}
          title={toast.title}
        />
      )}
      {terminal && (
        <Banner
          tone={job.status === "Rejected" ? "danger" : "neutral"}
          title={
            job.status === "Rejected"
              ? "This job was rejected."
              : "This job was cancelled."
          }
        >
          {job.status === "Rejected"
            ? "This job was rejected and will not be published for bidding."
            : "This job has been cancelled and is no longer active."}
        </Banner>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "Overview", label: "Overview" },
          {
            value: "Bids & Responses",
            label: "Bids & Responses",
            count: bids.length,
          },
          { value: "Associated Trips", label: "Associated Trips", count: jobTrips.length },
          { value: "Tracking & Updates", label: "Tracking & Updates" },
          { value: "Documents", label: "Documents", count: documents.length },
          { value: "Financials", label: "Financials" },
          { value: "Activity Log", label: "Activity Log" },
        ]}
      />

      {tab === "Overview" && (
        <div className="jd-layout">
          <div className="jd-main">
            <SectionCard
              title="Job Information"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  icon="pencil"
                  onClick={() =>
                    notify("info", "Editing is not available in this preview.")
                  }
                >
                  Edit
                </Button>
              }
            >
              <div className="jd-facts">
                <div className="jd-fact">
                  <span className="tk-meta">Job ID</span>
                  <strong>{job.id}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Request Type</span>
                  <Badge tone="purple">{job.requestType}</Badge>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Customer / Forwarder</span>
                  <strong
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {job.contactPerson}
                  </strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Contact Details</span>
                  <strong>{job.contactPhone}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Trip Type</span>
                  <strong>{job.tripType}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Cargo Type</span>
                  <strong>{job.cargoType}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Cargo Details</span>
                  <strong>{job.cargoDetails || job.cargo}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Total Weight</span>
                  <strong>{job.totalWeight || "—"}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Pickup Location</span>
                  <strong
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Icon name="map-pin" size={14} color="var(--tk-success)" />
                    {job.origin}
                  </strong>
                  <span className="tk-meta">{job.originCountry}</span>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Delivery Location</span>
                  <strong
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Icon name="map-pin" size={14} color="var(--tk-danger)" />
                    {job.destination}
                  </strong>
                  <span className="tk-meta">{job.destCountry}</span>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Preferred Pickup Date</span>
                  <strong>{job.pickupDate || "—"}</strong>
                </div>
                <div className="jd-fact">
                  <span className="tk-meta">Preferred Delivery Date</span>
                  <strong>{job.deliveryDate || "—"}</strong>
                </div>
                <div className="jd-fact" style={{ gridColumn: "1 / -1" }}>
                  <span className="tk-meta">Special Instructions</span>
                  <span
                    style={{
                      font: "400 13px/20px var(--tk-font-sans)",
                      color: "var(--tk-ink-700)",
                    }}
                  >
                    {job.specialInstructions || "—"}
                  </span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Route Details"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  icon="map"
                  onClick={() => setMapOpen(true)}
                >
                  View on Map
                </Button>
              }
            >
              <div className="jd-route-grid">
                <div className="jd-route-points">
                  <div className="jd-route-point">
                    <span
                      className="jd-route-dot"
                      style={{ background: "var(--tk-blue)" }}
                    />
                    <div>
                      <strong>{job.origin}</strong>
                      <span className="tk-meta">{job.originCountry}</span>
                    </div>
                    <span className="tk-meta">{job.pickupDate}</span>
                  </div>
                  <div className="jd-route-line" />
                  <div className="jd-route-point">
                    <span
                      className="jd-route-dot"
                      style={{ background: "var(--tk-danger)" }}
                    />
                    <div>
                      <strong>{job.destination}</strong>
                      <span className="tk-meta">{job.destCountry}</span>
                    </div>
                    <span className="tk-meta">{job.deliveryDate}</span>
                  </div>
                </div>
                <div className="jd-map-placeholder">
                  <Icon name="map" size={28} />
                  <span className="tk-meta">
                    Map surface is supplied by the consuming app's tile layer.
                  </span>
                </div>
              </div>
              <div className="jd-route-stats">
                <span>
                  <span className="tk-meta">Distance</span>
                  <strong>
                    {job.distanceKm ? `${job.distanceKm} km` : "—"}
                  </strong>
                </span>
                <span>
                  <span className="tk-meta">Estimated Duration</span>
                  <strong>{job.durationLabel || "—"}</strong>
                </span>
                <span>
                  <span className="tk-meta">Route Type</span>
                  <strong>{job.routeType || "—"}</strong>
                </span>
              </div>
            </SectionCard>

            <SectionCard
              title="Assigned & Bidding"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTab("Bids & Responses")}
                >
                  View All Bids
                </Button>
              }
            >
              <div className="jd-route-stats" style={{ marginBottom: 14 }}>
                <span>
                  <span className="tk-meta">Assignment Status</span>
                  <Badge tone={job.truckingCompany ? "info" : "neutral"} dot>
                    {job.truckingCompany ? "Assigned" : "Not Assigned"}
                  </Badge>
                </span>
                <span>
                  <span className="tk-meta">Total Bids</span>
                  <strong>{bids.length}</strong>
                </span>
                <span>
                  <span className="tk-meta">Bidding Closes</span>
                  <strong
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Icon name="clock" size={13} color="var(--tk-danger)" />
                    {job.biddingCloses || "—"}
                  </strong>
                </span>
              </div>
              {bids.length > 0 ? (
                <DataTable
                  rows={bids.slice(0, 4)}
                  rowKey={(r) => r.company}
                  columns={[
                    {
                      key: "i",
                      header: "#",
                      width: 30,
                      render: (r, i) => bids.indexOf(r) + 1,
                    },
                    {
                      key: "company",
                      header: "Company",
                      render: (r) => r.company,
                    },
                    {
                      key: "amount",
                      header: "Amount (₦)",
                      render: (r) => naira(r.amount),
                    },
                    {
                      key: "est",
                      header: "Est. Delivery",
                      render: (r) => r.estDeliveryDate,
                    },
                    {
                      key: "submitted",
                      header: "Submitted",
                      render: (r) => r.submittedAt,
                    },
                    {
                      key: "x",
                      header: "",
                      width: 70,
                      render: (r) => (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTab("Bids & Responses")}
                        >
                          View
                        </Button>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  icon="gavel"
                  title="No bids yet"
                  description="Trucking companies have not submitted any bids for this job."
                />
              )}
            </SectionCard>
          </div>

          <div className="jd-rail">
            <SectionCard title="Status">
              <StatusStepper
                stageIndex={stageIndex}
                dates={stageDates}
                terminal={terminal}
              />
              {job.status === "Pending Approval" && (
                <div className="jd-note">
                  This job is awaiting admin approval. Please review all
                  documents and details before approving.
                </div>
              )}
              {job.status === "Bidding" && (
                <div className="jd-note jd-note-info">
                  This job is published and open for carrier bidding until{" "}
                  {job.biddingCloses}.
                </div>
              )}
              {job.status === "Assigned" && (
                <div className="jd-note jd-note-info">
                  This job is assigned to {job.truckingCompany} and awaiting
                  dispatch.
                </div>
              )}
              {job.status === "In Transit" && (
                <div className="jd-note jd-note-info">
                  This job is currently in transit. See Tracking & Updates for
                  live status.
                </div>
              )}
              {job.status === "Delivered" && (
                <div className="jd-note jd-note-success">
                  This job has been delivered successfully.
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Financial Summary"
              action={
                <FilterSelect
                  label={currency}
                  onClick={() =>
                    setCurrency((c) => (c === "NGN" ? "USD" : "NGN"))
                  }
                />
              }
            >
              <div className="jd-finance-rows">
                <div>
                  <span>Job Value (Forwarder Payment)</span>
                  <strong>{naira(job.jobValue)}</strong>
                </div>
                <div>
                  <span>Platform Fee ({job.platformFeePct}%)</span>
                  <strong>{naira(fee)}</strong>
                </div>
                <div>
                  <span>Driver/Company Payment</span>
                  <strong>{driverPayment ? naira(driverPayment) : "—"}</strong>
                </div>
                <div>
                  <span>Demurrage (Est.)</span>
                  <strong>{demurrage ? naira(demurrage) : "—"}</strong>
                </div>
                <div>
                  <span>Other Costs (Est.)</span>
                  <strong>{otherCosts ? naira(otherCosts) : "—"}</strong>
                </div>
              </div>
              <div className="jd-finance-total">
                <span>Estimated Platform Earnings</span>
                <strong style={{ color: "var(--tk-success)" }}>
                  {naira(netEarnings)}
                </strong>
              </div>
            </SectionCard>

            <SectionCard title="Related Entities">
              <EntityRow
                icon="file-text"
                tint="blue"
                label="Forwarder"
                value={job.contactPerson || "—"}
                action={
                  <ExternalLink onClick={() => navigate("/forwarders")}>
                    View Profile
                  </ExternalLink>
                }
              />

              <EntityRow
                icon="route"
                tint="purple"
                label="Associated Trips"
                value={`${tripCounts.assigned} of ${tripCounts.required} assigned`}
                action={<a style={{ cursor: "pointer" }} onClick={() => setTab("Associated Trips")}>View Trips →</a>}
              />
              <EntityRow
                icon="truck"
                tint="amber"
                label="Trucking Company"
                value={job.truckingCompany || "Not yet assigned"}
                action={
                  job.truckingCompany ? (
                    <ExternalLink onClick={() => navigate("/companies")}>
                      View Profile
                    </ExternalLink>
                  ) : (
                    <a
                      style={{ cursor: "pointer" }}
                      onClick={() => setTab("Bids & Responses")}
                    >
                      Assign →
                    </a>
                  )
                }
              />
            </SectionCard>

            <SectionCard
              title={`Documents (${documents.length})`}
              action={
                <a
                  style={{ cursor: "pointer" }}
                  onClick={() => setTab("Documents")}
                >
                  View All
                </a>
              }
            >
              {documents.slice(0, 3).map((d) => (
                <div key={d.id} className="jd-doc-row">
                  <Icon
                    name={
                      d.name.endsWith(".xlsx")
                        ? "sheet"
                        : d.name.endsWith(".zip")
                          ? "image"
                          : "file-text"
                    }
                    size={16}
                    color="var(--tk-blue)"
                  />
                  <span
                    style={{ flex: 1, display: "grid", gap: 1, minWidth: 0 }}
                  >
                    <span
                      style={{
                        font: "500 13px/18px var(--tk-font-sans)",
                        color: "var(--tk-ink-900)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.name}
                    </span>
                    <span className="tk-meta">
                      {d.size} · {d.date}
                    </span>
                  </span>
                </div>
              ))}
            </SectionCard>

            <SectionCard
              title="Recent Activity"
              action={
                <a
                  style={{ cursor: "pointer" }}
                  onClick={() => setTab("Activity Log")}
                >
                  View All
                </a>
              }
            >
              {activityLog.slice(0, 3).map((a, i) => (
                <div key={i} className="jd-activity-row">
                  <span className="jd-activity-dot" />
                  <span style={{ display: "grid", gap: 1 }}>
                    <span
                      style={{
                        font: "500 13px/18px var(--tk-font-sans)",
                        color: "var(--tk-ink-900)",
                      }}
                    >
                      {a.action === "Job Created"
                        ? `Job submitted by ${a.user}`
                        : `${a.action} — ${a.details}`}
                    </span>
                    <span className="tk-meta">{a.time}</span>
                  </span>
                </div>
              ))}
            </SectionCard>
          </div>
        </div>
      )}

      {tab === "Bids & Responses" && (
        <>
          <InfoStrip
            items={[
              {
                icon: "route",
                label: "Route",
                value: job.route || `${job.origin} → ${job.destination}`,
              },
              {
                icon: "package",
                label: "Cargo",
                value: job.cargo,
                tint: "green",
              },
              {
                icon: "truck",
                label: "Required Trucks",
                value: `${job.requiredTrucks || 1} Truck${(job.requiredTrucks || 1) > 1 ? "s" : ""}`,
                tint: "amber",
              },
              {
                icon: "calendar",
                label: "Pickup Date",
                value: job.pickupDate || "—",
                tint: "purple",
              },
              {
                icon: "banknote",
                label: "Job Value",
                value: naira(job.jobValue),
                tint: "green",
              },
            ]}
          />
          <div className="jd-layout">
            <div className="jd-main">
              <SectionCard
                title={`Bids Received (${bids.length})`}
                description="Bids from trucking companies for this job. Assignment is handled by the selected trucking company."
                action={
                  <Badge
                    tone={job.status === "Bidding" ? "purple" : "neutral"}
                    dot
                  >
                    {job.status === "Bidding"
                      ? `Closes ${job.biddingCloses}`
                      : "Bidding Closed"}
                  </Badge>
                }
              >
                <Banner tone="info" style={{ marginBottom: 14 }}>
                  The Super Admin can view all bids for oversight. Trucking
                  companies manage their own truck and driver assignment.
                </Banner>
                {bids.length ? (
                  <DataTable
                    rows={bids}
                    rowKey={(r) => r.company}
                    columns={[
                      {
                        key: "i",
                        header: "#",
                        width: 30,
                        render: (r) => bids.indexOf(r) + 1,
                      },
                      {
                        key: "company",
                        header: "Trucking Company",
                        render: (r) => (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Avatar name={r.company} size={30} />
                            <span
                              style={{ display: "grid", gap: 1, minWidth: 0 }}
                            >
                              <strong
                                style={{
                                  font: "600 13px/18px var(--tk-font-sans)",
                                  color: "var(--tk-ink-900)",
                                }}
                              >
                                {r.company}
                                {job.truckingCompany === r.company && (
                                  <Badge
                                    tone="success"
                                    style={{ marginLeft: 6 }}
                                  >
                                    Assigned
                                  </Badge>
                                )}
                              </strong>
                              <span
                                className="tk-meta"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Icon
                                  name="star"
                                  size={11}
                                  color="var(--tk-warning)"
                                />
                                {r.rating} ({r.trips} trips) ·{" "}
                                {r.services.join(", ")}
                              </span>
                            </span>
                          </span>
                        ),
                      },
                      {
                        key: "amount",
                        header: "Amount (₦)",
                        render: (r) => (
                          <strong style={{ color: "var(--tk-ink-900)" }}>
                            {naira(r.amount)}
                          </strong>
                        ),
                      },
                      {
                        key: "est",
                        header: "Est. Delivery",
                        render: (r) => r.estDeliveryDate,
                      },
                      {
                        key: "submitted",
                        header: "Submitted",
                        render: (r) => r.submittedAt,
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => (
                          <Badge
                            tone={
                              r.status === "Best Offer"
                                ? "success"
                                : r.status === "Competitive"
                                  ? "info"
                                  : "neutral"
                            }
                          >
                            {r.status}
                          </Badge>
                        ),
                      },
                      {
                        key: "x",
                        header: "Actions",
                        render: (r) =>
                          job.truckingCompany === r.company ? (
                            <Badge tone="success">Assigned</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={job.status !== "Bidding"}
                              onClick={() => setAcceptBidFor(r)}
                            >
                              {job.status === "Bidding" ? "Accept" : "View"}
                            </Button>
                          ),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState
                    icon="gavel"
                    title="No bids yet"
                    description="Trucking companies have not submitted any bids for this job."
                  />
                )}
              </SectionCard>

              <div className="jd-row2">
                <SectionCard title="Bid Comparison">
                  <BarChart
                    height={200}
                    labels={bids.map((b) => b.company.split(" ")[0])}
                    series={[
                      {
                        name: "Amount",
                        color: "var(--tk-blue)",
                        points: bids.map((b) => b.amount),
                      },
                    ]}
                    format={nairaShort}
                  />
                </SectionCard>
                <SectionCard title="Company Insights">
                  {bids.map((b) => (
                    <div key={b.company} className="jd-insight-row">
                      <Avatar name={b.company} size={30} />
                      <span
                        style={{
                          flex: 1,
                          display: "grid",
                          gap: 1,
                          minWidth: 0,
                        }}
                      >
                        <strong
                          style={{
                            font: "600 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {b.company}
                        </strong>
                        <span className="tk-meta">
                          {b.trips} completed trips
                        </span>
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          font: "700 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        <Icon name="star" size={13} color="var(--tk-warning)" />
                        {b.rating}
                      </span>
                    </div>
                  ))}
                </SectionCard>
              </div>
            </div>

            <div className="jd-rail">
              <SectionCard title="Job Status">
                <StatusStepper
                  stageIndex={stageIndex}
                  dates={stageDates}
                  terminal={terminal}
                />
              </SectionCard>
              <SectionCard title="Bid Summary">
                <div className="jd-finance-rows">
                  <div>
                    <span>Total Bids</span>
                    <strong>{bids.length}</strong>
                  </div>
                  <div>
                    <span>Lowest Bid</span>
                    <strong>
                      {bids.length
                        ? naira(Math.min(...bids.map((b) => b.amount)))
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Highest Bid</span>
                    <strong>
                      {bids.length
                        ? naira(Math.max(...bids.map((b) => b.amount)))
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Average Bid</span>
                    <strong>
                      {bids.length
                        ? naira(
                            bids.reduce((s, b) => s + b.amount, 0) /
                              bids.length,
                          )
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Bid Spread</span>
                    <strong>
                      {bids.length > 1
                        ? naira(
                            Math.max(...bids.map((b) => b.amount)) -
                              Math.min(...bids.map((b) => b.amount)),
                          )
                        : "—"}
                    </strong>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Related Entities">
                <EntityRow
                  icon="file-text"
                  tint="blue"
                  label="Forwarder"
                  value={job.forwarder}
                  action={
                    <ExternalLink onClick={() => navigate("/forwarders")}>
                      View Profile
                    </ExternalLink>
                  }
                />
                <EntityRow
                  icon="map-pin"
                  tint="purple"
                  label="Pickup Location"
                  value={job.origin}
                />
                <EntityRow
                  icon="map-pin"
                  tint="amber"
                  label="Delivery Location"
                  value={job.destination}
                />
              </SectionCard>
              <NeedHelpCard
                topic="bids or the job"
                onContact={() => navigate("/tickets")}
              />
            </div>
          </div>
        </>
      )}

      {tab === "Associated Trips" && (
        <>
          <InfoStrip
            items={[
              { icon: "truck", label: "Trucks Requested", value: tripCounts.required, tint: "amber" },
              { icon: "route", label: "Trips Created", value: `${tripCounts.assigned} of ${tripCounts.required}` },
              { icon: "navigation", label: "Active Trips", value: tripCounts.active, tint: "purple" },
              { icon: "circle-check", label: "Trips Delivered", value: tripCounts.completed, tint: "green" },
            ]}
          />
          {tripCounts.assigned < tripCounts.required && (
            <Banner tone="warning" title={`${tripCounts.required - tripCounts.assigned} assignment${tripCounts.required - tripCounts.assigned === 1 ? "" : "s"} remaining`}>
              Every requested truck needs its own eligible driver from {job.truckingCompany || "the same trucking company"} before dispatch is complete.
            </Banner>
          )}
          <SectionCard
            title={`Associated Trips (${jobTrips.length})`}
            description="Each trip represents one truck and one driver fulfilling this job."
            pad="none"
            action={<Button size="sm" icon="truck" onClick={() => navigate("/dispatch")}>Manage Assignments</Button>}
          >
            {jobTrips.length ? (
              <DataTable
                rows={jobTrips}
                rowKey={(trip) => trip.id}
                onRowClick={(trip) => { setSelectedTripId(trip.id); setTab("Tracking & Updates"); }}
                coloredHeader
                columns={[
                  { key: "id", header: "Trip ID", render: (trip) => <strong className="jd-trip-id">{trip.id}</strong> },
                  { key: "truck", header: "Truck", render: (trip) => trip.truckPlate ? <a className="jd-trip-link" onClick={(event) => { event.stopPropagation(); navigate(`/fleet/${encodeURIComponent(trip.truckPlate)}`); }}>{trip.truckPlate}</a> : "—" },
                  { key: "driver", header: "Driver", render: (trip) => <span className="jd-trip-person"><Avatar name={trip.driverName || "Unassigned"} size={26}/><span><strong>{trip.driverName || "Unassigned"}</strong><small>{trip.driverPhone || trip.driverId || "—"}</small></span></span> },
                  { key: "company", header: "Trucking Company", render: (trip) => trip.truckingCompany || job.truckingCompany || "—" },
                  { key: "status", header: "Trip Status", render: (trip) => <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge> },
                  { key: "progress", header: "Progress", render: (trip) => <span className="jd-trip-progress"><span><i style={{ width: `${Math.min(100, trip.progress || 0)}%` }}/></span><strong>{trip.progress || 0}%</strong></span> },
                  { key: "eta", header: "ETA", render: (trip) => trip.eta || trip.deliveryDate || "—" },
                  { key: "actions", header: "", width: 54, render: (trip) => <span className="jd-trip-menu" onClick={(event) => event.stopPropagation()}><Button size="sm" variant="outline" icon="ellipsis" onClick={() => setTripMenu(tripMenu === trip.id ? null : trip.id)}/>{tripMenu === trip.id && <span><DropdownMenu width={205} items={["Assigned", "At Pickup", "In Transit", "At Delivery", "Delivered", "Delayed"].filter((status) => status !== trip.status).map((status) => ({ label: `Mark ${status}`, icon: status === "Delivered" ? "circle-check" : status === "Delayed" ? "triangle-alert" : "route", tone: status === "Delayed" ? "danger" : undefined, onClick: () => doTripStatus(trip.id, status) }))}/></span>}</span> },
                ]}
              />
            ) : (
              <EmptyState icon="route" title="No trips assigned" description="Select a trucking company, then assign the required truck and driver pairs." action={<Button onClick={() => navigate("/dispatch")}>Open Dispatch Center</Button>}/>
            )}
          </SectionCard>
        </>
      )}

      {tab === "Tracking & Updates" && (
        <>
          <InfoStrip
            items={[
              {
                icon: "route",
                label: "Route",
                value: job.route || `${job.origin} → ${job.destination}`,
              },
              {
                icon: "package",
                label: "Cargo",
                value: job.cargo,
                tint: "green",
              },
              {
                icon: "truck",
                label: "Assigned Trucks",
                value: tripCounts.assigned ? `${tripCounts.assigned} of ${tripCounts.required}` : "Not assigned",
                tint: "amber",
              },
              {
                icon: "user",
                label: "Assigned Drivers",
                value: tripCounts.assigned ? `${tripCounts.assigned} driver${tripCounts.assigned === 1 ? "" : "s"}` : "Not assigned",
                caption: job.truckingCompany,
                tint: "purple",
              },
              {
                icon: "calendar",
                label: "Estimated Delivery",
                value: job.deliveryDate || "—",
                tint: "green",
              },
            ]}
          />
          <div className="jd-layout">
            <div className="jd-main">
              {jobTrips.length > 0 && (
                <SectionCard title="Select Trip" description="Tracking and updates are recorded per truck movement.">
                  <div className="jd-trip-selector">
                    {jobTrips.map((trip) => (
                      <button key={trip.id} className={trip.id === selectedTrip?.id ? "active" : ""} onClick={() => setSelectedTripId(trip.id)}>
                        <Icon name="truck" size={16}/><span><strong>{trip.id}</strong><small>{trip.truckPlate} · {trip.driverName}</small></span><Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              )}
              <SectionCard
                title="Live Tracking"
                description={
                  job.status === "In Transit"
                    ? `Live Location · Last updated ${job.updatedAt}`
                    : "Live tracking is available once this job is in transit."
                }
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    icon="refresh-cw"
                    onClick={() => notify("info", "Tracking data refreshed.")}
                  >
                    Refresh
                  </Button>
                }
              >
                <div className="jd-map-placeholder" style={{ height: 260 }}>
                  <Icon
                    name={job.status === "In Transit" ? "navigation" : "map"}
                    size={28}
                  />
                  {job.status === "In Transit" ? (
                    <span className="tk-meta">{selectedTrip?.truckPlate} · {selectedTrip?.driverName} · Moving towards {job.destination}</span>
                  ) : (
                    <span className="tk-meta">
                      No live position to display for this job's current status.
                    </span>
                  )}
                </div>
                <div className="jd-route-stats" style={{ marginTop: 14 }}>
                  <span>
                    <span className="tk-meta">Distance Covered</span>
                    <strong>
                      {selectedTrip && ["In Transit", "Delivered", "Completed"].includes(selectedTrip.status)
                        ? `${Math.round((selectedTrip.distanceKm || job.distanceKm || 0) * ((selectedTrip.progress || 0) / 100))} km / ${selectedTrip.distanceKm || job.distanceKm} km`
                        : "—"}
                    </strong>
                  </span>
                  <span>
                    <span className="tk-meta">Current Speed</span>
                    <strong>
                      {selectedTrip?.status === "In Transit" ? "72 km/h" : "—"}
                    </strong>
                  </span>
                  <span>
                    <span className="tk-meta">ETA</span>
                    <strong>{selectedTrip?.eta || job.deliveryDate || "—"}</strong>
                  </span>
                  <span>
                    <span className="tk-meta">Next Stop</span>
                    <strong>{job.destination}</strong>
                  </span>
                </div>
              </SectionCard>

              <SectionCard title="Tracking Updates" pad="none">
                {trackingUpdates.length ? (
                  <DataTable
                    rows={trackingUpdates}
                    rowKey={(r, i) => i}
                    columns={[
                      {
                        key: "i",
                        header: "#",
                        width: 30,
                        render: (r) => trackingUpdates.indexOf(r) + 1,
                      },
                      { key: "time", header: "Date & Time" },
                      { key: "location", header: "Location" },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => (
                          <Badge
                            tone={
                              statusTone(r.status) === "neutral"
                                ? "info"
                                : statusTone(r.status)
                            }
                            dot
                          >
                            {r.status}
                          </Badge>
                        ),
                      },
                      { key: "details", header: "Details" },
                      {
                        key: "source",
                        header: "Source",
                        render: (r) => (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Icon
                              name={
                                r.source === "GPS"
                                  ? "satellite"
                                  : r.source === "Driver App"
                                    ? "smartphone"
                                    : "server"
                              }
                              size={13}
                              color="var(--tk-ink-300)"
                            />
                            {r.source}
                          </span>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState
                    icon="map-pin"
                    title="No tracking updates yet"
                    description="Updates will appear once the job is assigned and moving."
                  />
                )}
              </SectionCard>
            </div>

            <div className="jd-rail">
              <SectionCard title="Tracking Timeline">
                <Timeline
                  items={trackingUpdates
                    .slice()
                    .reverse()
                    .map((u, i, arr) => ({
                      title: u.status,
                      description: `${u.location !== "—" ? u.location + " — " : ""}${u.details}`,
                      time: u.time,
                      state:
                        i === arr.length - 1 && job.status === "In Transit"
                          ? "current"
                          : "done",
                      icon:
                        u.status === "Delivered"
                          ? "check"
                          : u.status === "In Transit"
                            ? "truck"
                            : "circle",
                    }))}
                />
              </SectionCard>
              {photos.length > 0 && (
                <SectionCard
                  title="Photos & Proof"
                  action={<a style={{ cursor: "pointer" }}>View All</a>}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                    }}
                  >
                    {photos.map((p, i) => (
                      <div key={i} className="jd-photo-tile">
                        <Icon
                          name="image"
                          size={20}
                          color="var(--tk-ink-300)"
                        />
                        <span
                          className="tk-meta"
                          style={{ fontSize: 10, textAlign: "center" }}
                        >
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
              <SectionCard title="Related Information">
                <EntityRow
                  icon="truck"
                  tint="blue"
                  label="Trucking Company"
                  value={job.truckingCompany || "Not yet assigned"}
                  action={
                    job.truckingCompany && (
                      <ExternalLink onClick={() => navigate("/companies")}>
                        View Profile
                      </ExternalLink>
                    )
                  }
                />
                <EntityRow
                  icon="user"
                  tint="purple"
                  label="Drivers"
                  value={tripCounts.assigned ? `${tripCounts.assigned} assigned` : "Not yet assigned"}
                  action={<a style={{ cursor: "pointer" }} onClick={() => setTab("Associated Trips")}>View Trips →</a>}
                />
                <EntityRow
                  icon="file-text"
                  tint="amber"
                  label="Forwarder"
                  value={job.forwarder}
                  action={
                    <ExternalLink onClick={() => navigate("/forwarders")}>
                      View Profile
                    </ExternalLink>
                  }
                />
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {tab === "Documents" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "var(--tk-space-4)",
            }}
          >
            <StatCard
              icon="file-text"
              label="Total Documents"
              value={documentStatusCounts.total}
            />
            <StatCard
              icon="circle-check"
              tint="green"
              label="Approved"
              value={documentStatusCounts.approved}
            />
            <StatCard
              icon="clock"
              tint="amber"
              label="Pending Review"
              value={documentStatusCounts.pending}
            />
            <StatCard
              icon="circle-x"
              tint="red"
              label="Rejected"
              value={documentStatusCounts.rejected}
            />
          </div>
          <div className="jd-layout">
            <div className="jd-main">
              <SectionCard
                title={`Documents (${filteredDocuments.length})`}
                description="Review and approve or reject documents submitted for this job."
                pad="none"
              >
                <div className="jd-doc-toolbar">
                  <SearchField
                    placeholder="Search documents…"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                  />
                  <span style={{ position: "relative" }}>
                    <FilterSelect
                      label={docStatusFilter}
                      active={docStatusFilter !== "All Statuses"}
                      onClick={() => setDocOpenFilter((o) => !o)}
                    />
                    {docOpenFilter && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 44,
                          zIndex: 30,
                        }}
                      >
                        <DropdownMenu
                          width={180}
                          items={[
                            "All Statuses",
                            "Approved",
                            "Pending",
                            "Rejected",
                          ].map((s) => ({
                            label: s,
                            icon: s === docStatusFilter ? "check" : undefined,
                            onClick: () => {
                              setDocStatusFilter(s);
                              setDocOpenFilter(false);
                            },
                          }))}
                        />
                      </span>
                    )}
                  </span>
                  <Button
                    variant="outline"
                    icon="rotate-cw"
                    onClick={() => {
                      setDocQuery("");
                      setDocStatusFilter("All Statuses");
                    }}
                  >
                    Reset
                  </Button>
                </div>
                {filteredDocuments.length ? (
                  <DataTable
                    rows={filteredDocuments}
                    rowKey={(r) => r.id}
                    onRowClick={setReviewDoc}
                    columns={[
                      {
                        key: "name",
                        header: "Document Name",
                        render: (r) => (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Icon
                              name={
                                r.name.endsWith(".xlsx")
                                  ? "sheet"
                                  : r.name.endsWith(".zip")
                                    ? "image"
                                    : "file-text"
                              }
                              size={16}
                              color="var(--tk-blue)"
                            />
                            <strong
                              style={{
                                color: "var(--tk-ink-900)",
                                font: "500 13px/18px var(--tk-font-sans)",
                              }}
                            >
                              {r.name}
                            </strong>
                          </span>
                        ),
                      },
                      { key: "type", header: "Type" },
                      { key: "scope", header: "Scope", render: (r) => <Badge tone={r.tripId ? "info" : "neutral"}>{r.tripId || "Job-wide"}</Badge> },
                      { key: "submittedBy", header: "Submitted By" },
                      { key: "date", header: "Date Submitted" },
                      {
                        key: "status",
                        header: "Status",
                        render: (r) => (
                          <Badge
                            tone={
                              r.status === "Approved"
                                ? "success"
                                : r.status === "Rejected"
                                  ? "danger"
                                  : "warning"
                            }
                            dot
                          >
                            {r.status}
                          </Badge>
                        ),
                      },
                      {
                        key: "x",
                        header: "Actions",
                        render: (r) => (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewDoc(r);
                            }}
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState
                    icon="file-text"
                    title="No documents match"
                    description="Try a different search or filter."
                  />
                )}
              </SectionCard>
            </div>

            <div className="jd-rail">
              <SectionCard title="Document Preview">
                {reviewDoc ? (
                  <>
                    <div className="jd-doc-preview">
                      <strong
                        style={{
                          font: "700 12px/16px var(--tk-font-sans)",
                          color: "var(--tk-ink-300)",
                          letterSpacing: 1,
                        }}
                      >
                        ▽ TRUKKAS
                      </strong>
                      <span
                        style={{
                          font: "700 15px/20px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {reviewDoc.type || "DOCUMENT"}
                      </span>
                      <Icon
                        name={
                          reviewDoc.name.endsWith(".xlsx")
                            ? "sheet"
                            : reviewDoc.name.endsWith(".zip")
                              ? "image"
                              : "file-text"
                        }
                        size={38}
                        color="var(--tk-ink-300)"
                      />
                      <span className="tk-meta">
                        Preview rendered by the consuming app's document viewer.
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {reviewDoc.name}
                      </strong>
                      <Badge
                        tone={
                          reviewDoc.status === "Approved"
                            ? "success"
                            : reviewDoc.status === "Rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {reviewDoc.status}
                      </Badge>
                    </div>
                    <span className="tk-meta">
                      {reviewDoc.size} · Submitted {reviewDoc.date}
                    </span>

                    <div className="jd-finance-rows" style={{ marginTop: 14 }}>
                      <div>
                        <span>File Name</span>
                        <strong>{reviewDoc.name}</strong>
                      </div>
                      <div>
                        <span>Document Type</span>
                        <strong>{reviewDoc.type}</strong>
                      </div>
                      <div>
                        <span>Applies To</span>
                        <strong>{reviewDoc.tripId || "All job trips"}</strong>
                      </div>
                      <div>
                        <span>Submitted By</span>
                        <strong>{reviewDoc.submittedBy}</strong>
                      </div>
                      <div>
                        <span>Date Submitted</span>
                        <strong>{reviewDoc.date}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong>{reviewDoc.status}</strong>
                      </div>
                      <div>
                        <span>Reviewed By</span>
                        <strong>{reviewDoc.reviewedBy || "—"}</strong>
                      </div>
                      <div>
                        <span>Reviewed On</span>
                        <strong>{reviewDoc.reviewedOn || "—"}</strong>
                      </div>
                      <div>
                        <span>Reference No.</span>
                        <strong>{reviewDoc.reference || "—"}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <Button
                        variant="outline"
                        icon="circle-x"
                        disabled={reviewDoc.status === "Rejected"}
                        onClick={() => doReviewDoc(reviewDoc, false)}
                      >
                        Reject
                      </Button>
                      <Button
                        icon="circle-check"
                        disabled={reviewDoc.status === "Approved"}
                        onClick={() => doReviewDoc(reviewDoc, true)}
                      >
                        Approve
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon="file-text"
                    title="No document selected"
                    description="Choose a document from the list to preview it."
                  />
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {tab === "Financials" && (
        <>
          <InfoStrip
            items={[
              {
                icon: "banknote",
                label: "Job Value",
                value: naira(job.jobValue),
              },
              {
                icon: "shield-check",
                label: "Platform Fee",
                value: `${job.platformFeePct}%`,
                caption: naira(fee),
                tint: "green",
              },
              {
                icon: "wallet-cards",
                label: "Driver/Company Payout",
                value: driverPayment ? naira(driverPayment) : "—",
                tint: "amber",
              },
              {
                icon: "clock",
                label: "Demurrage (Est.)",
                value: demurrage ? naira(demurrage) : "₦0",
                tint: "purple",
              },
              {
                icon: "truck",
                label: "Status",
                value: job.status,
                tint: "blue",
              },
            ]}
          />
          <div className="jd-layout">
            <div className="jd-main">
              <SectionCard
                title="Payment Flow"
                description="How the money flows from the forwarder to service providers and Trukkas."
              >
                <div className="jd-flow">
                  <div className="jd-flow-box">
                    <Icon name="user" size={16} color="var(--tk-ink-500)" />
                    <strong>{naira(job.jobValue)}</strong>
                    <span className="tk-meta">Paid by {job.forwarder}</span>
                  </div>
                  <Icon
                    name="arrow-right"
                    size={18}
                    color="var(--tk-ink-300)"
                  />
                  <div className="jd-flow-box">
                    <Icon name="database" size={16} color="var(--tk-blue)" />
                    <strong>{naira(fee)}</strong>
                    <span className="tk-meta">Trukkas Platform Fee</span>
                  </div>
                  <Icon
                    name="arrow-right"
                    size={18}
                    color="var(--tk-ink-300)"
                  />
                  <div className="jd-flow-stack">
                    <div className="jd-flow-box">
                      <Icon name="truck" size={16} color="var(--tk-success)" />
                      <strong>
                        {driverPayment ? naira(driverPayment) : "—"}
                      </strong>
                      <span className="tk-meta">
                        Paid to {job.truckingCompany || "Trucking Company"}
                      </span>
                    </div>
                    <div className="jd-flow-box">
                      <Icon name="clock" size={16} color="var(--tk-warning)" />
                      <strong>{demurrage ? naira(demurrage) : "₦0"}</strong>
                      <span className="tk-meta">Demurrage (if any)</span>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {tripFinancials.length > 0 && (
                <SectionCard title="Trip-level Costs" description="Operational costs stay attached to each truck movement and roll up to the job." pad="none">
                  <DataTable rows={tripFinancials} rowKey={(trip) => trip.id} coloredHeader columns={[
                    { key: "id", header: "Trip ID", render: (trip) => <strong className="jd-trip-id">{trip.id}</strong> },
                    { key: "truckPlate", header: "Truck" },
                    { key: "driverName", header: "Driver" },
                    { key: "cost", header: "Trip Cost", render: (trip) => naira(trip.cost) },
                    { key: "driverPayment", header: "Driver Payment", render: (trip) => naira(trip.driverPayment) },
                    { key: "expenses", header: "Expenses", render: (trip) => naira(trip.expenses) },
                    { key: "status", header: "Status", render: (trip) => <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge> },
                  ]}/>
                </SectionCard>
              )}

              <SectionCard title={`Related Payouts (${relatedPayouts.length})`} description="Company payouts are reconciled to the individual trips included in this job." pad="none">
                {relatedPayouts.length ? <DataTable rows={relatedPayouts} rowKey={(payout) => payout.id} coloredHeader onRowClick={(payout) => navigate(`/payouts/${payout.id}`)} columns={[
                  { key: "id", header: "Payout ID", render: (payout) => <strong className="jd-trip-id">{payout.id}</strong> },
                  { key: "party", header: "Beneficiary" },
                  { key: "trips", header: "Trips Included", render: (payout) => `${payout.tripIds?.length || 0} of ${jobTrips.length}` },
                  { key: "gross", header: "Gross", render: (payout) => naira(payout.grossAmount ?? payout.amount) },
                  { key: "net", header: "Net", render: (payout) => naira(payout.netAmount ?? payout.amount) },
                  { key: "status", header: "Status", render: (payout) => <Badge dot tone={statusTone(payout.status)}>{payout.status}</Badge> },
                  { key: "eligibility", header: "Eligibility", render: (payout) => <Badge tone={payout.approvalReady ? "success" : "warning"}>{payout.eligibility || "Legacy"}</Badge> },
                ]} /> : <EmptyState icon="wallet" title="No payout created" description="A company payout can be reconciled after eligible trips are delivered." />}
              </SectionCard>

              <div className="jd-row2">
                <SectionCard title="Earnings Breakdown">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <DonutChart
                      size={200}
                      thickness={18}
                      centerValue={naira(job.jobValue).replace("₦", "₦")}
                      centerLabel="Total Job Value"
                      data={[
                        {
                          label: "Trucking Payout",
                          value: driverPayment || 0,
                          color: "var(--tk-blue)",
                        },
                        {
                          label: "Platform Fee",
                          value: fee,
                          color: "var(--tk-success)",
                        },
                        {
                          label: "Demurrage",
                          value: demurrage,
                          color: "var(--tk-warning)",
                        },
                        {
                          label: "Other Adjustments",
                          value: otherCosts,
                          color: "var(--tk-neutral)",
                        },
                      ]}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 180,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {[
                        [
                          "Trucking Payout",
                          driverPayment || 0,
                          "var(--tk-blue)",
                        ],
                        ["Platform Fee", fee, "var(--tk-success)"],
                        ["Demurrage", demurrage, "var(--tk-warning)"],
                        ["Other Adjustments", otherCosts, "var(--tk-neutral)"],
                      ].map(([label, val, color]) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: color,
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              font: "400 13px/18px var(--tk-font-sans)",
                              color: "var(--tk-ink-500)",
                            }}
                          >
                            {label}
                          </span>
                          <strong
                            style={{
                              font: "600 13px/18px var(--tk-font-sans)",
                              color: "var(--tk-ink-900)",
                            }}
                          >
                            {naira(val)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>
                <SectionCard title="Key Amounts">
                  <div className="jd-finance-rows">
                    <div>
                      <span>Job Value</span>
                      <strong>{naira(job.jobValue)}</strong>
                    </div>
                    <div>
                      <span>Platform Fee ({job.platformFeePct}%)</span>
                      <strong>{naira(fee)}</strong>
                    </div>
                    <div>
                      <span>Driver/Company Payout</span>
                      <strong>
                        {driverPayment ? naira(driverPayment) : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Demurrage (Est.)</span>
                      <strong>{naira(demurrage)}</strong>
                    </div>
                    <div>
                      <span>Other Adjustments</span>
                      <strong>{naira(otherCosts)}</strong>
                    </div>
                  </div>
                  <div className="jd-finance-total">
                    <span>Net Platform Earnings</span>
                    <strong style={{ color: "var(--tk-success)" }}>
                      {naira(netEarnings)}
                    </strong>
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Transactions" pad="none">
                <DataTable
                  rows={transactions}
                  rowKey={(r, i) => i}
                  columns={[
                    {
                      key: "i",
                      header: "#",
                      width: 30,
                      render: (r) => transactions.indexOf(r) + 1,
                    },
                    {
                      key: "date",
                      header: "Date & Time",
                      render: (r) => r.date || "—",
                    },
                    { key: "description", header: "Description" },
                    {
                      key: "amount",
                      header: "Amount (₦)",
                      render: (r) => (
                        <strong
                          style={{
                            color:
                              r.amount > 0
                                ? "var(--tk-success)"
                                : r.amount < 0
                                  ? "var(--tk-danger)"
                                  : "var(--tk-ink-900)",
                          }}
                        >
                          {r.amount === 0 ? "0" : naira(r.amount)}
                        </strong>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r) => (
                        <Badge
                          tone={
                            r.status === "Completed"
                              ? "success"
                              : r.status === "Not incurred"
                                ? "neutral"
                                : "warning"
                          }
                        >
                          {r.status}
                        </Badge>
                      ),
                    },
                    {
                      key: "reference",
                      header: "Reference",
                      render: (r) => (
                        <span className="tk-mono">{r.reference}</span>
                      ),
                    },
                  ]}
                />
              </SectionCard>
            </div>

            <div className="jd-rail">
              <SectionCard title="Financial Status">
                <Timeline
                  items={[
                    {
                      title: "Forwarder Payment Received",
                      description: `${naira(job.jobValue)} · Paid on ${job.createdAt || job.published}`,
                      state: "done",
                      icon: "check",
                    },
                    {
                      title: "Platform Fee Allocated",
                      description: naira(fee),
                      state: "done",
                      icon: "check",
                    },
                    {
                      title: "Trucking Company Payout",
                      description: driverPayment
                        ? `${naira(driverPayment)} · ${job.status === "Delivered" ? "Completed" : "Processing"}`
                        : "Awaiting assignment",
                      state: job.truckingCompany
                        ? job.status === "Delivered"
                          ? "done"
                          : "current"
                        : "pending",
                      icon: "truck",
                    },
                    {
                      title: "Demurrage (if any)",
                      description: demurrage
                        ? naira(demurrage)
                        : "Not incurred",
                      state: demurrage ? "current" : "pending",
                    },
                    {
                      title: "Job Closed",
                      description:
                        job.status === "Delivered"
                          ? "Delivery confirmed"
                          : "Pending delivery confirmation",
                      state: job.status === "Delivered" ? "done" : "pending",
                      icon: "flag",
                    },
                  ]}
                />
              </SectionCard>
              <SectionCard
                title="Related Documents"
                action={
                  <a
                    style={{ cursor: "pointer" }}
                    onClick={() => setTab("Documents")}
                  >
                    View All
                  </a>
                }
              >
                {documents.slice(0, 4).map((d) => (
                  <div key={d.id} className="jd-doc-row">
                    <Icon name="file-text" size={15} color="var(--tk-blue)" />
                    <span
                      style={{
                        flex: 1,
                        font: "500 13px/18px var(--tk-font-sans)",
                        color: "var(--tk-ink-900)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {d.name}
                    </span>
                    <Icon name="download" size={14} color="var(--tk-ink-300)" />
                  </div>
                ))}
              </SectionCard>
              <SectionCard title="Related Entities">
                <EntityRow
                  icon="file-text"
                  tint="blue"
                  label="Forwarder"
                  value={job.forwarder}
                  action={
                    <ExternalLink onClick={() => navigate("/forwarders")}>
                      View Profile
                    </ExternalLink>
                  }
                />
                <EntityRow
                  icon="truck"
                  tint="amber"
                  label="Trucking Company"
                  value={job.truckingCompany || "Not yet assigned"}
                  action={
                    job.truckingCompany && (
                      <ExternalLink onClick={() => navigate("/companies")}>
                        View Profile
                      </ExternalLink>
                    )
                  }
                />
              </SectionCard>
              <NeedHelpCard
                topic="this job's financials"
                onContact={() => navigate("/tickets")}
              />
            </div>
          </div>
        </>
      )}

      {tab === "Activity Log" && (
        <>
          <InfoStrip
            items={[
              {
                icon: "route",
                label: "Route",
                value: job.route || `${job.origin} → ${job.destination}`,
              },
              {
                icon: "package",
                value: job.cargo,
                tint: "green",
              },
              {
                icon: "truck",
                label: "Trucking Company",
                value: job.truckingCompany || "Not yet assigned",
                tint: "amber",
              },
              {
                icon: "circle-check",
                label: "Status",
                value: job.status,
                tint: "purple",
              },
              {
                icon: "banknote",
                label: "Job Value",
                value: naira(job.jobValue),
                tint: "green",
              },
            ]}
          />
          <div className="jd-layout">
            <div className="jd-main">
              <SectionCard
                title="Activity Log"
                description="A chronological record of all key activities and updates related to this job."
                pad="none"
                action={
                  <>
                    <span style={{ position: "relative" }}>
                      <FilterSelect
                        label={activityFilter}
                        active={activityFilter !== "All Activities"}
                        onClick={() => setActivityOpenFilter((o) => !o)}
                      />
                      {activityOpenFilter && (
                        <span
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 44,
                            zIndex: 30,
                          }}
                        >
                          <DropdownMenu
                            width={200}
                            items={["All Activities", ...activityActions].map(
                              (s) => ({
                                label: s,
                                icon:
                                  s === activityFilter ? "check" : undefined,
                                onClick: () => {
                                  setActivityFilter(s);
                                  setActivityOpenFilter(false);
                                  setLogPage(1);
                                },
                              }),
                            )}
                          />
                        </span>
                      )}
                    </span>
                    <Button
                      variant="outline"
                      icon="download"
                      onClick={() => notify("info", "Activity log exported.")}
                    >
                      Export Log
                    </Button>
                  </>
                }
                footer={
                  filteredActivity.length > LOG_PAGE_SIZE && (
                    <Pagination
                      page={logPage}
                      pageSize={LOG_PAGE_SIZE}
                      pageCount={Math.max(
                        1,
                        Math.ceil(filteredActivity.length / LOG_PAGE_SIZE),
                      )}
                      total={filteredActivity.length}
                      onPage={setLogPage}
                      onPageSize={() => {}}
                      style={{ border: 0, padding: 0 }}
                    />
                  )
                }
              >
                <DataTable
                  rows={pagedActivity}
                  rowKey={(r, i) => i}
                  columns={[
                    {
                      key: "i",
                      header: "#",
                      width: 30,
                      render: (r) => filteredActivity.indexOf(r) + 1,
                    },
                    { key: "time", header: "Date & Time" },
                    {
                      key: "user",
                      header: "User",
                      render: (r) => (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Avatar name={r.user} size={26} />
                          <span style={{ display: "grid", gap: 0 }}>
                            <strong
                              style={{
                                font: "600 13px/18px var(--tk-font-sans)",
                                color: "var(--tk-ink-900)",
                              }}
                            >
                              {r.user}
                            </strong>
                            <span className="tk-meta">{r.role}</span>
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: "action",
                      header: "Action",
                      render: (r) => (
                        <Badge
                          tone={
                            r.action.includes("Reject")
                              ? "danger"
                              : r.action.includes("Approv") ||
                                  r.action.includes("Confirm")
                                ? "success"
                                : "info"
                          }
                        >
                          {r.action}
                        </Badge>
                      ),
                    },
                    { key: "details", header: "Details" },
                  ]}
                />
              </SectionCard>
            </div>

            <div className="jd-rail">
              <SectionCard
                title="Job Summary"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    icon="pencil"
                    onClick={() =>
                      notify(
                        "info",
                        "Editing is not available in this preview.",
                      )
                    }
                  >
                    Edit Job
                  </Button>
                }
              >
                <div className="jd-finance-rows">
                  <div>
                    <span>Job ID</span>
                    <strong>{job.id}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </div>
                  <div>
                    <span>Route</span>
                    <strong style={{ textAlign: "right" }}>
                      {job.route || `${job.origin} → ${job.destination}`}
                    </strong>
                  </div>
                  <div>
                    <span>Cargo</span>
                    <strong>{job.cargo}</strong>
                  </div>
                  <div>
                    <span>Job Value</span>
                    <strong>{naira(job.jobValue)}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{job.createdAt || job.published}</strong>
                  </div>
                  <div>
                    <span>Last Updated</span>
                    <strong>{job.updatedAt || "—"}</strong>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="Activity Insights">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div className="jd-insight-tile">
                    <Icon name="list" size={16} color="var(--tk-blue)" />
                    <strong>{activityLog.length}</strong>
                    <span className="tk-meta">Total Activities</span>
                  </div>
                  <div className="jd-insight-tile">
                    <Icon name="users" size={16} color="var(--tk-purple)" />
                    <strong>{uniqueActivityUsers}</strong>
                    <span className="tk-meta">Unique Users</span>
                  </div>
                  <div className="jd-insight-tile">
                    <Icon name="clock" size={16} color="var(--tk-warning)" />
                    <strong>
                      {STAGES.indexOf(job.status) >= 0
                        ? STAGES.indexOf(job.status) + 1
                        : "—"}
                    </strong>
                    <span className="tk-meta">Stages Reached</span>
                  </div>
                  <div className="jd-insight-tile">
                    <Icon
                      name="trending-up"
                      size={16}
                      color="var(--tk-success)"
                    />
                    <strong style={{ fontSize: 13 }}>
                      {activityLog[0]?.user?.split(" ")[0] || "—"}
                    </strong>
                    <span className="tk-meta">Most Active</span>
                  </div>
                </div>
              </SectionCard>
              <NeedHelpCard
                topic="this job's activity log"
                onContact={() => navigate("/tickets")}
              />
            </div>
          </div>
        </>
      )}

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve Job"
        description={`Approve ${job.id} and publish it for carrier bidding?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" onClick={doApprove}>
              Approve & Publish
            </Button>
          </>
        }
      >
        <span className="tk-meta">
          This will move the job from Pending Approval to Bidding. Trucking
          companies will be able to submit bids once published.
        </span>
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject Job"
        description={`Reject ${job.id}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="circle-x" onClick={doReject}>
              Reject Job
            </Button>
          </>
        }
      >
        <span className="tk-meta">
          This job will be marked as rejected and the forwarder will be
          notified. This action cannot be undone from this screen.
        </span>
      </Modal>

      <Modal
        open={!!acceptBidFor}
        onClose={() => setAcceptBidFor(null)}
        title="Accept Bid"
        description={
          acceptBidFor ? `Assign ${acceptBidFor.company} to ${job.id}?` : ""
        }
        footer={
          acceptBidFor && (
            <>
              <Button variant="outline" onClick={() => setAcceptBidFor(null)}>
                Cancel
              </Button>
              <Button icon="check" onClick={() => doAcceptBid(acceptBidFor)}>
                Confirm Assignment
              </Button>
            </>
          )
        }
      >
        {acceptBidFor && (
          <span className="tk-meta">
            {acceptBidFor.company} bid {naira(acceptBidFor.amount)} with
            estimated delivery on {acceptBidFor.estDeliveryDate}. This will move
            the job to Assigned.
          </span>
        )}
      </Modal>

      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Route Map"
        description={`${job.origin} → ${job.destination}`}
        width={640}
      >
        <div className="jd-map-placeholder" style={{ height: 320 }}>
          <Icon name="map" size={34} />
          <span className="tk-meta">
            Map surface is supplied by the consuming app's tile layer.
          </span>
        </div>
      </Modal>
    </div>
  );
}
