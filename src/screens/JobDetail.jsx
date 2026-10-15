"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
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
  Skeleton,
  TextField,
} from "../ds.js";
import { useGetAdminJobScreenQuery, useGetAdminJobScreenTripQuery, useChangeAdminJobScreenMutation, jobScreenUrl } from "../store/features/jobs/jobDetailApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { JobDetailMap } from "./JobDetailMap.jsx";
import { useGetAdminTrackingOverviewQuery } from "../store/features/tracking/trackingApi.js";
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
const naira = (n) => typeof n === "number" && Number.isFinite(n) ? "₦" + Math.round(n).toLocaleString("en-NG") : "—";
const nairaShort = (n) => typeof n !== "number" || !Number.isFinite(n) ? "—" : Math.abs(n) >= 1000000 ? "₦" + (n / 1000000).toFixed(1) + "M" : "₦" + Math.round(n / 1000) + "K";
const displayCount = (n) => n == null ? "—" : n;
const percentage = (n) => n == null ? "—" : n + "%";
const TINT = {
  blue: ["var(--tk-blue-soft)", "var(--tk-blue)"],
  green: ["var(--tk-success-soft)", "var(--tk-success)"],
  purple: ["var(--tk-purple-soft)", "var(--tk-purple)"],
  amber: ["var(--tk-warning-soft)", "var(--tk-warning)"],
  neutral: ["var(--tk-surface-sunk)", "var(--tk-ink-400)"],
};

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

function TripActionMenu({ anchor, items, onClose }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);
  useEffect(() => {
    const update = () => {
      if (!anchor?.isConnected || !menuRef.current) { onClose(null); return; }
      const rect = anchor.getBoundingClientRect(), menu = menuRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.right - menu.width, window.innerWidth - menu.width - 8));
      const below = rect.bottom + 6;
      setPosition({ left, top: below + menu.height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - menu.height - 6) });
    };
    const outside = (event) => { if (!anchor?.contains(event.target) && !menuRef.current?.contains(event.target)) onClose(null); };
    const escape = (event) => { if (event.key === "Escape") onClose(null); };
    update();
    window.addEventListener("scroll", update, true); window.addEventListener("resize", update);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);
    };
  }, [anchor, items.length, onClose]);
  return <div ref={menuRef} onClick={(event) => event.stopPropagation()} style={{ position: "fixed", zIndex: 95, width: "max-content", top: position?.top ?? -10000, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}><DropdownMenu width={205} items={items} /></div>;
}

function LoadingDetail() {
  return (
    <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }} aria-busy="true">
      <Card><Skeleton width={180} height={26} /><div style={{ marginTop: 14 }}><Skeleton width="55%" height={14} /></div></Card>
      <div role="status" className="tk-meta">Loading job details…</div>
      <div className="jd-layout">
        <Card><Skeleton width="40%" height={20} /><div style={{ marginTop: 24 }}><Skeleton height={120} /></div></Card>
        <Card><Skeleton width="50%" height={20} /><div style={{ marginTop: 24 }}><Skeleton height={120} /></div></Card>
      </div>
    </div>
  );
}

export function JobDetail({ jobId: requestedId }) {
  const params = useParams();
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const jobId = typeof (requestedId ?? params.jobId) === "string" ? (requestedId ?? params.jobId).trim() : "";
  return <JobDetailContent key={[owner, role, jobId, authenticated].join(":")} jobId={jobId} owner={owner} role={role} authenticated={authenticated} />;
}

function JobDetailContent({ jobId, owner, role, authenticated }) {
  const navigate = useNavigate();
  const jobQuery = useGetAdminJobScreenQuery({ id: jobId, owner, role }, { skip: !authenticated || !jobId, refetchOnMountOrArgChange: true });
  const job = jobQuery.error ? undefined : jobQuery.currentData;
  const [changeJob, { isLoading: actionBusy }] = useChangeAdminJobScreenMutation();
  const actionLock = useRef(false), active = useRef(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [delayOpen, setDelayOpen] = useState(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (job?.errors.length) setToast({ tone: "warning", title: "Unable to load: " + job.errors.join(", ") + ". Refresh to try again." });
  }, [job]);

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
  const [currency] = useState("NGN");
  const [tripMenu, setTripMenu] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const bids = useMemo(() => job?.bids || [], [job]);
  const documents = useMemo(() => job?.documents || [], [job]);
  const transactions = useMemo(() => job?.transactions || [], [job]);
  const activityLog = useMemo(() => job?.activityLog || [], [job]);
  const jobTrips = useMemo(() => job?.trips || [], [job]);
  const tripCounts = job?.tripCounts || {};
  const selectedTripBase = jobTrips.find((trip) => trip.id === selectedTripId) || jobTrips[0] || null;
  const tripQuery = useGetAdminJobScreenTripQuery({ id: selectedTripBase?.id, jobId: job?.apiId, owner, role }, {
    skip: !authenticated || !selectedTripBase || tab !== "Tracking & Updates",
    refetchOnMountOrArgChange: true,
    pollingInterval: tab === "Tracking & Updates" ? 30000 : 0,
  });
  const selectedTrip = tripQuery.error ? null : tripQuery.currentData || selectedTripBase;
  const trackingMapQuery = useGetAdminTrackingOverviewQuery({ owner, role }, {
    skip: !authenticated || tab !== "Tracking & Updates" || !selectedTripBase,
    pollingInterval: tab === "Tracking & Updates" && selectedTripBase ? 30000 : 0,
  });
  const selectedRecordedRoute = useMemo(() => {
    const routes = trackingMapQuery.currentData?.routes;
    if (!selectedTripBase || !Array.isArray(routes)) return null;
    const matches = routes.filter((route) => route.source === "RECORDED_GPS" && route.tripIds?.includes(selectedTripBase.id) && Array.isArray(route.points) && route.points.length >= 2);
    return matches.length === 1 ? matches[0].points : null;
  }, [trackingMapQuery.currentData, selectedTripBase?.id]);
  const recordedRouteLoading = trackingMapQuery.isFetching && !trackingMapQuery.currentData;
  const trackingUpdates = useMemo(() => !tripQuery.error && tripQuery.currentData ? tripQuery.currentData.trackingUpdates : job?.trackingUpdates || [], [job, tripQuery.currentData, tripQuery.error]);
  const photos = useMemo(() => tripQuery.error ? [] : tripQuery.currentData?.photos || [], [tripQuery.currentData, tripQuery.error]);
  useEffect(() => { if (tripQuery.error) setToast({ tone: "danger", title: getApiErrorMessage(tripQuery.error) }); }, [tripQuery.error]);

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

  if (authenticated && (jobQuery.isLoading || jobQuery.isFetching && !job)) return <LoadingDetail />;
  if (!job) {
    return (
      <Card>
        <EmptyState icon="package" title={!jobId ? "Job ID missing" : "Unable to load job details"} description={jobQuery.error ? getApiErrorMessage(jobQuery.error) : "Open a job from the Jobs page to view its details."} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>Back to Jobs</Button>
          {authenticated && jobId && <Button variant="outline" onClick={jobQuery.refetch}>Retry</Button>}
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
    : STAGES.indexOf(workflowStatus);
  const stageDates = job.stageDates;

  const fee = job.fee, driverPayment = job.driverPayment, demurrage = job.demurrage;
  const otherCosts = job.otherCosts, netEarnings = job.netEarnings;
  const tripFinancials = jobTrips, relatedPayouts = job.relatedPayouts;
  const tripActionTarget = jobTrips.find((trip) => trip.id === tripMenu?.id);
  const bidAmountsKnown = job.bidsKnown && bids.every((bid) => bid.amount != null);
  const funding = transactions.find((t) => t.type === "ESCROW_LOCK" && t.rawStatus === "COMPLETED");
  const payoutCompleted = ["Paid", "Completed"].includes(job.finalPayoutStatus);
  const financialTimeline = [
    { title: "Forwarder Payment Received", description: funding ? naira(funding.amount) + " · " + funding.date : "—", state: funding ? "done" : "pending", icon: "check" },
    { title: "Platform Fee Allocated", description: naira(fee), state: "pending", icon: "check" },
    { title: "Trucking Company Payout", description: job.finalPayoutStatus ? naira(driverPayment) + " · " + job.finalPayoutStatus : "—", state: payoutCompleted ? "done" : "pending", icon: "truck" },
    { title: "Demurrage (if any)", description: naira(demurrage), state: "pending" },
    { title: "Job Closed", description: job.statusCode === "COMPLETED" ? "Delivery confirmed" : "—", state: job.statusCode === "COMPLETED" ? "done" : "pending", icon: "flag" },
  ];
  function unavailable(action) { notify("info", action + " is unavailable: no supported admin operation or required data is available."); }
  function openReject(target = true) { setRejectionReason(""); setRejectOpen(target); }
  async function perform(action, details = {}) {
    if (actionLock.current || !authenticated) return;
    actionLock.current = true;
    try {
      await changeJob({ id: job.apiId, owner, role, expectedStatus: job.statusCode, action, ...details }).unwrap();
      if (!active.current) return;
      setApproveOpen(false); setRejectOpen(false); setDelayOpen(null); setTripMenu(null); setMoreOpen(false);
      const messages = { approve: "Job documents approved and released for bidding.", reject: "Job documents rejected.", approveDocument: "Document approved.", rejectDocument: "Document rejected.", deliver: "Job marked delivered.", cancel: "Job cancelled.", atDelivery: "Job and its trips marked at delivery.", delay: "Job and its trips marked delayed." };
      notify("success", messages[action]);
    } catch (error) {
      if (active.current) notify("danger", getApiErrorMessage(error));
    } finally { actionLock.current = false; }
  }
  function doApprove() { return perform("approve"); }
  function doReject() {
    if (!rejectionReason.trim()) return;
    const doc = typeof rejectOpen === "object" ? rejectOpen : null;
    return perform(doc ? "rejectDocument" : "reject", { reason: rejectionReason, ...(doc ? { documentId: doc.apiId, version: doc.version, documentUrl: doc.url } : {}) });
  }
  function doAcceptBid() { unavailable("Accept Bid"); }
  function doMarkInTransit() { unavailable("Mark In Transit"); }
  function doMarkDelivered() { return perform("deliver"); }
  function doTripStatus(tripId, status) {
    setTripMenu(null);
    const trip = jobTrips.find((item) => item.id === tripId);
    if (!trip || !["SUPER_ADMIN", "OPS_ADMIN"].includes(role)) { unavailable("Update trip status"); return; }
    if (status === "At Delivery" && trip.canMarkAtDelivery) { void perform("atDelivery", { tripId }); return; }
    if (status === "Delayed" && trip.canMarkDelayed) { setDelayReason(""); setDelayOpen(trip); return; }
    unavailable("Mark " + status);
  }
  function doCancel() { return perform("cancel"); }
  function doReviewDoc(doc, approve) {
    if (!job.canApprove || !doc.canReview || !doc.apiId) { unavailable("Review document"); return; }
    if (!approve) { openReject(doc); return; }
    return perform("approveDocument", { documentId: doc.apiId, version: doc.version, documentUrl: doc.url });
  }
  async function shareJob() {
    try {
      await navigator.clipboard.writeText(new URL(jobScreenUrl(job.apiId), window.location.origin).href);
      if (active.current) notify("info", "Share link copied to clipboard.");
    } catch { if (active.current) notify("danger", "Unable to copy the share link."); }
  }
  async function refreshTracking() {
    try {
      await Promise.all([jobQuery.refetch().unwrap(), ...(selectedTripBase ? [tripQuery.refetch().unwrap(), trackingMapQuery.refetch().unwrap()] : [])]);
      if (active.current) notify("info", "Tracking data refreshed.");
    } catch (error) { if (active.current) notify("danger", getApiErrorMessage(error)); }
  }
  function exportActivity() {
    if (!job.activityKnown) { unavailable("Export Log"); return; }
    const rows = [["Date & Time", "User", "Role", "Action", "Details"], ...activityLog.map((a) => [a.time, a.user, a.role, a.action, a.details])];
    const safeCell = (value) => { const s = String(value ?? ""); return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'; };
    const csv = rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = job.id + "-activity.csv";
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("info", "Activity log exported.");
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
                //     unavailable("Edit Job");
                //   },
                // },
                {
                  label: "Duplicate Job",
                  icon: "copy",
                  onClick: () => {
                    setMoreOpen(false);
                    unavailable("Duplicate Job");
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
                    unavailable("Flag for Review");
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
        onClick={shareJob}
      >
        Share
      </Button>
      {job.status === "Pending Approval" ? (
        <>
          {/* <Button
            variant="outline"
            icon="pencil"
            onClick={() =>
              unavailable("Edit Job")
            }
          >
            Edit Job
          </Button> */}
          <SplitButton
            icon="check"
            onAction={() => setApproveOpen(true)}
            onToggle={() => openReject()}
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
              unavailable("Edit Job")
            }
          >
            Edit Job
          </Button> */}
        </>
      ) : null}
    </>
  );

  const documentStatusCounts = job.documentStatusCounts;
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
  const uniqueActivityUsers = job.uniqueActivityUsers;
  const bidsCount = job.bidsKnown ? bids.length : "—";
  const docsCount = job.documentsKnown ? job.documentStatusCounts.total ?? documents.filter((document) => document.apiId).length : "—";
  const tripsCount = job.tripsKnown ? jobTrips.length : "—";
  const activityCount = job.activityKnown ? activityLog.length : "—";

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
            count: bidsCount,
          },
          { value: "Associated Trips", label: "Associated Trips", count: tripsCount },
          { value: "Tracking & Updates", label: "Tracking & Updates" },
          { value: "Documents", label: "Documents", count: docsCount },
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
                    unavailable("Edit Job")
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
                  <strong>{job.totalWeight ?? "—"}</strong>
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
                <div className="jd-map-placeholder jd-map-active">
                  <JobDetailMap origin={job.origin} destination={job.destination} ariaLabel="Job pickup and delivery route map" />
                </div>
              </div>
              <div className="jd-route-stats">
                <span>
                  <span className="tk-meta">Distance</span>
                  <strong>
                    {job.distanceKm != null ? `${job.distanceKm} km` : "—"}
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
                    {job.assignmentStatus}
                  </Badge>
                </span>
                <span>
                  <span className="tk-meta">Total Bids</span>
                  <strong>{bidsCount}</strong>
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
              {!job.bidsKnown ? <DriverLoadingNotice>Bid data is unavailable. Refresh to try again.</DriverLoadingNotice> : bids.length > 0 ? (
                <DataTable
                  rows={bids.slice(0, 4)}
                  rowKey={(r) => r.id}
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
                    unavailable("Currency conversion")
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
                  <span>Platform Fee ({percentage(job.platformFeePct)})</span>
                  <strong>{naira(fee)}</strong>
                </div>
                <div>
                  <span>Driver/Company Payment</span>
                  <strong>{naira(driverPayment)}</strong>
                </div>
                <div>
                  <span>Demurrage (Est.)</span>
                  <strong>{naira(demurrage)}</strong>
                </div>
                <div>
                  <span>Other Costs (Est.)</span>
                  <strong>{naira(otherCosts)}</strong>
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
                  <ExternalLink onClick={() => job.forwarderId ? navigate("/forwarders/detail?id=" + encodeURIComponent(job.forwarderId)) : unavailable("Forwarder profile")}>
                    View Profile
                  </ExternalLink>
                }
              />

              <EntityRow
                icon="route"
                tint="purple"
                label="Associated Trips"
                value={`${displayCount(job.assignedTrips)} of ${displayCount(tripCounts.total)} assigned`}
                action={<a style={{ cursor: "pointer" }} onClick={() => setTab("Associated Trips")}>View Trips →</a>}
              />
              <EntityRow
                icon="truck"
                tint="amber"
                label="Trucking Company"
                value={job.truckingCompany || "—"}
                action={
                  job.truckingCompany ? (
                    <ExternalLink onClick={() => job.truckerId ? navigate("/users/detail?id=" + encodeURIComponent(job.truckerId) + "&source=user") : unavailable("Trucking company profile")}>
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
              title={`Documents (${docsCount})`}
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
                value: job.requiredTrucks == null ? "—" : `${job.requiredTrucks} Truck${job.requiredTrucks === 1 ? "" : "s"}`,
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
                title={`Bids Received (${bidsCount})`}
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
                {!job.bidsKnown ? <DriverLoadingNotice>Bid data is unavailable. Refresh to try again.</DriverLoadingNotice> : bids.length ? (
                  <DataTable
                    rows={bids}
                    rowKey={(r) => r.id}
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
                                {r.accepted && (
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
                                {displayCount(r.rating)} ({displayCount(r.trips)} trips) ·{" "}
                                {r.services?.join(", ") || "—"}
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
                          r.accepted ? (
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
                    labels={bids.filter((b) => b.amount != null).map((b) => b.company.split(" ")[0])}
                    series={[
                      {
                        name: "Amount",
                        color: "var(--tk-blue)",
                        points: bids.filter((b) => b.amount != null).map((b) => b.amount),
                      },
                    ]}
                    format={nairaShort}
                  />
                </SectionCard>
                <SectionCard title="Company Insights">
                  {bids.map((b) => (
                    <div key={b.id} className="jd-insight-row">
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
                          {displayCount(b.trips)} completed trips
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
                        {displayCount(b.rating)}
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
                    <strong>{bidsCount}</strong>
                  </div>
                  <div>
                    <span>Lowest Bid</span>
                    <strong>
                      {bids.length && bidAmountsKnown
                        ? naira(Math.min(...bids.map((b) => b.amount)))
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Highest Bid</span>
                    <strong>
                      {bids.length && bidAmountsKnown
                        ? naira(Math.max(...bids.map((b) => b.amount)))
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Average Bid</span>
                    <strong>
                      {bids.length && bidAmountsKnown
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
                      {bids.length > 1 && bidAmountsKnown
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
                    <ExternalLink onClick={() => job.forwarderId ? navigate("/forwarders/detail?id=" + encodeURIComponent(job.forwarderId)) : unavailable("Forwarder profile")}>
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
              { icon: "truck", label: "Trucks Requested", value: displayCount(tripCounts.required), tint: "amber" },
              { icon: "route", label: "Trips Created", value: `${displayCount(job.assignedTrips)} of ${displayCount(tripCounts.total)}` },
              { icon: "navigation", label: "Active Trips", value: displayCount(tripCounts.active), tint: "purple" },
              { icon: "circle-check", label: "Trips Delivered", value: displayCount(tripCounts.completed), tint: "green" },
            ]}
          />
          {tripCounts.assigned != null && tripCounts.required != null && tripCounts.assigned < tripCounts.required && (
            <Banner tone="warning" title={`${tripCounts.required - tripCounts.assigned} assignment${tripCounts.required - tripCounts.assigned === 1 ? "" : "s"} remaining`}>
              Every requested truck needs its own eligible driver from {job.truckingCompany || "the same trucking company"} before dispatch is complete.
            </Banner>
          )}
          <SectionCard
            title={`Associated Trips (${tripsCount})`}
            description="Each trip represents one truck and one driver fulfilling this job."
            pad="none"
            action={<Button size="sm" icon="truck" onClick={() => navigate("/dispatch")}>Manage Assignments</Button>}
          >
            {!job.tripsKnown ? <DriverLoadingNotice>Trip data is unavailable. Refresh to try again.</DriverLoadingNotice> : jobTrips.length ? (
              <DataTable
                rows={jobTrips}
                rowKey={(trip) => trip.id}
                onRowClick={(trip) => { setSelectedTripId(trip.id); setTab("Tracking & Updates"); }}
                coloredHeader
                columns={[
                  { key: "id", header: "Trip ID", render: (trip) => <strong className="jd-trip-id">{trip.id}</strong> },
                  { key: "truck", header: "Truck", render: (trip) => trip.truckPlate ? <a className="jd-trip-link" onClick={(event) => { event.stopPropagation(); trip.truckId ? navigate("/fleet/detail?id=" + encodeURIComponent(trip.truckId)) : unavailable("Truck profile"); }}>{trip.truckPlate}</a> : "—" },
                  { key: "driver", header: "Driver", render: (trip) => <span className="jd-trip-person"><Avatar name={trip.driverName || "Unassigned"} size={26}/><span><strong>{trip.driverName || "Unassigned"}</strong><small>{trip.driverPhone || trip.driverId || "—"}</small></span></span> },
                  { key: "company", header: "Trucking Company", render: (trip) => trip.truckingCompany || job.truckingCompany || "—" },
                  { key: "status", header: "Trip Status", render: (trip) => <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge> },
                  { key: "progress", header: "Progress", render: (trip) => <span className="jd-trip-progress"><span><i style={{ width: `${Math.min(100, trip.progress || 0)}%` }}/></span><strong>{trip.progress == null ? "—" : `${trip.progress}%`}</strong></span> },
                  { key: "eta", header: "ETA", render: (trip) => trip.eta || trip.deliveryDate || "—" },
                  { key: "actions", header: "", width: 54, render: (trip) => <span className="jd-trip-menu" onClick={(event) => event.stopPropagation()}><Button size="sm" variant="outline" icon="ellipsis" onClick={(event) => { const anchor = event.currentTarget; setTripMenu((current) => current?.id === trip.id ? null : { id: trip.id, anchor }); }}/></span> },
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
                value: displayCount(job.assignedTruckCount),
                tint: "amber",
              },
              {
                icon: "user",
                label: "Assigned Drivers",
                value: job.assignedDriverCount == null ? "—" : `${job.assignedDriverCount} driver${job.assignedDriverCount === 1 ? "" : "s"}`,
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
                  selectedTrip?.livePosition
                    ? `Live Location · Last updated ${selectedTrip?.locationUpdatedAt || "—"}`
                    : "—"
                }
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    icon="refresh-cw"
                    onClick={refreshTracking}
                  >
                    Refresh
                  </Button>
                }
              >
                <div className="jd-map-placeholder jd-map-active" style={{ height: 260 }}>
                  <JobDetailMap
                    origin={job.origin}
                    destination={job.destination}
                    liveLocation={selectedTrip?.livePosition && selectedTrip.liveCoordinates ? {
                      ...selectedTrip.liveCoordinates,
                      heading: selectedTrip.heading,
                      title: selectedTrip.truckPlate,
                      description: selectedTrip.currentLocation,
                      updatedAt: selectedTrip.locationUpdatedAt,
                    } : null}
                    recordedRoute={selectedRecordedRoute}
                    recordedRouteLoading={recordedRouteLoading}
                    preferRecordedRoute
                    locationCaption={selectedTrip?.livePosition ? selectedTrip.currentLocation || "—" : "No live position to display for this job's current status."}
                    ariaLabel="Live trip tracking map"
                    zoomControl
                  />
                </div>
                <div className="jd-route-stats" style={{ marginTop: 14 }}>
                  <span>
                    <span className="tk-meta">Distance Covered</span>
                    <strong>
                      {selectedTrip?.coveredKm != null && selectedTrip?.distanceKm != null ? `${selectedTrip.coveredKm} km / ${selectedTrip.distanceKm} km` : "—"}
                    </strong>
                  </span>
                  <span>
                    <span className="tk-meta">Current Speed</span>
                    <strong>
                      {selectedTrip?.speedKmH == null ? "—" : `${selectedTrip.speedKmH} km/h`}
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
                      state: u.completed === true ? "done" : "pending",
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
                        <img src={p.url} alt={p.label} referrerPolicy="no-referrer" style={{ width: "100%", height: 72, objectFit: "cover" }} />
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
                  value={job.truckingCompany || "—"}
                  action={
                    job.truckingCompany && (
                      <ExternalLink onClick={() => job.truckerId ? navigate("/users/detail?id=" + encodeURIComponent(job.truckerId) + "&source=user") : unavailable("Trucking company profile")}>
                        View Profile
                      </ExternalLink>
                    )
                  }
                />
                <EntityRow
                  icon="user"
                  tint="purple"
                  label="Drivers"
                  value={job.assignedDriverCount == null ? "—" : `${job.assignedDriverCount} assigned`}
                  action={<a style={{ cursor: "pointer" }} onClick={() => setTab("Associated Trips")}>View Trips →</a>}
                />
                <EntityRow
                  icon="file-text"
                  tint="amber"
                  label="Forwarder"
                  value={job.forwarder}
                  action={
                    <ExternalLink onClick={() => job.forwarderId ? navigate("/forwarders/detail?id=" + encodeURIComponent(job.forwarderId)) : unavailable("Forwarder profile")}>
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
              value={displayCount(documentStatusCounts.total)}
            />
            <StatCard
              icon="circle-check"
              tint="green"
              label="Approved"
              value={displayCount(documentStatusCounts.approved)}
            />
            <StatCard
              icon="clock"
              tint="amber"
              label="Pending Review"
              value={displayCount(documentStatusCounts.pending)}
            />
            <StatCard
              icon="circle-x"
              tint="red"
              label="Rejected"
              value={displayCount(documentStatusCounts.rejected)}
            />
          </div>
          <div className="jd-layout">
            <div className="jd-main">
              <SectionCard
                title={`Documents (${job.documentsKnown ? filteredDocuments.length : "—"})`}
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
                {!job.documentsKnown ? <DriverLoadingNotice>Document data is unavailable. Refresh to try again.</DriverLoadingNotice> : filteredDocuments.length ? (
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
                    {reviewDoc.url ? <div className="jd-doc-preview"><iframe src={reviewDoc.url} title={reviewDoc.name + " preview"} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", minHeight: 220, border: 0 }} /></div> : (
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
                    )}
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
                        disabled={actionBusy || !job.canApprove || !reviewDoc.canReview || reviewDoc.status === "Rejected"}
                        onClick={() => doReviewDoc(reviewDoc, false)}
                      >
                        Reject
                      </Button>
                      <Button
                        icon="circle-check"
                        disabled={actionBusy || !job.canApprove || !reviewDoc.canReview || reviewDoc.status === "Approved"}
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
                value: `${percentage(job.platformFeePct)}`,
                caption: naira(fee),
                tint: "green",
              },
              {
                icon: "wallet-cards",
                label: "Driver/Company Payout",
                value: naira(driverPayment),
                tint: "amber",
              },
              {
                icon: "clock",
                label: "Demurrage (Est.)",
                value: naira(demurrage),
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
                        {naira(driverPayment)}
                      </strong>
                      <span className="tk-meta">
                        Paid to {job.truckingCompany || "Trucking Company"}
                      </span>
                    </div>
                    <div className="jd-flow-box">
                      <Icon name="clock" size={16} color="var(--tk-warning)" />
                      <strong>{naira(demurrage)}</strong>
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

              <SectionCard title={`Related Payouts (${job.relatedPayoutsKnown ? relatedPayouts.length : "—"})`} description="Company payouts are reconciled to the individual trips included in this job." pad="none">
                {relatedPayouts.length ? <DataTable rows={relatedPayouts} rowKey={(payout) => payout.id} coloredHeader onRowClick={(payout) => navigate(`/payouts/${payout.id}`)} columns={[
                  { key: "id", header: "Payout ID", render: (payout) => <strong className="jd-trip-id">{payout.id}</strong> },
                  { key: "party", header: "Beneficiary" },
                  { key: "trips", header: "Trips Included", render: (payout) => `${payout.tripIds?.length || 0} of ${jobTrips.length}` },
                  { key: "gross", header: "Gross", render: (payout) => naira(payout.grossAmount ?? payout.amount) },
                  { key: "net", header: "Net", render: (payout) => naira(payout.netAmount ?? payout.amount) },
                  { key: "status", header: "Status", render: (payout) => <Badge dot tone={statusTone(payout.status)}>{payout.status}</Badge> },
                  { key: "eligibility", header: "Eligibility", render: (payout) => <Badge tone={payout.approvalReady ? "success" : "warning"}>{payout.eligibility || "Legacy"}</Badge> },
                ]} /> : !job.relatedPayoutsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <EmptyState icon="wallet" title="No payout created" description="A company payout can be reconciled after eligible trips are delivered." />}
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
                      data={[driverPayment, fee, demurrage, otherCosts].every((value) => value != null) ? [
                        {
                          label: "Trucking Payout",
                          value: driverPayment,
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
                      ] : []}
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
                          driverPayment,
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
                      <span>Platform Fee ({percentage(job.platformFeePct)})</span>
                      <strong>{naira(fee)}</strong>
                    </div>
                    <div>
                      <span>Driver/Company Payout</span>
                      <strong>
                        {naira(driverPayment)}
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
                {!job.transactionsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable
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
                />}
              </SectionCard>
            </div>

            <div className="jd-rail">
              <SectionCard title="Financial Status">
                <Timeline items={financialTimeline} />
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
                    <ExternalLink onClick={() => job.forwarderId ? navigate("/forwarders/detail?id=" + encodeURIComponent(job.forwarderId)) : unavailable("Forwarder profile")}>
                      View Profile
                    </ExternalLink>
                  }
                />
                <EntityRow
                  icon="truck"
                  tint="amber"
                  label="Trucking Company"
                  value={job.truckingCompany || "—"}
                  action={
                    job.truckingCompany && (
                      <ExternalLink onClick={() => job.truckerId ? navigate("/users/detail?id=" + encodeURIComponent(job.truckerId) + "&source=user") : unavailable("Trucking company profile")}>
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
                value: job.truckingCompany || "—",
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
                      onClick={exportActivity}
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
                {!job.activityKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable
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
                />}
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
                      unavailable("Edit Job")
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
                    <strong>{activityCount}</strong>
                    <span className="tk-meta">Total Activities</span>
                  </div>
                  <div className="jd-insight-tile">
                    <Icon name="users" size={16} color="var(--tk-purple)" />
                    <strong>{displayCount(uniqueActivityUsers)}</strong>
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
                      {job.mostActiveUser}
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

      {tripActionTarget && <TripActionMenu anchor={tripMenu.anchor} onClose={setTripMenu} items={["Assigned", "At Pickup", "In Transit", "At Delivery", "Delivered", "Delayed"].filter((status) => status !== tripActionTarget.status).map((status) => ({ label: "Mark " + status, icon: status === "Delivered" ? "circle-check" : status === "Delayed" ? "triangle-alert" : "route", tone: status === "Delayed" ? "danger" : undefined, onClick: () => doTripStatus(tripActionTarget.id, status) }))} />}

      <Modal
        open={approveOpen}
        onClose={() => { if (!actionBusy) setApproveOpen(false); }}
        title="Approve Job"
        description={`Approve ${job.id} and publish it for carrier bidding?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button icon="check" disabled={actionBusy || !job.canApprove} onClick={doApprove}>
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
        onClose={() => { if (!actionBusy) setRejectOpen(false); }}
        title={typeof rejectOpen === "object" ? "Reject Document" : "Reject Job"}
        description={typeof rejectOpen === "object" ? rejectOpen.name : `Reject ${job.id}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon="circle-x" disabled={actionBusy || !job.canApprove || !rejectionReason.trim()} onClick={doReject}>
              {typeof rejectOpen === "object" ? "Reject Document" : "Reject Job"}
            </Button>
          </>
        }
      >
        <span className="tk-meta">
          {typeof rejectOpen === "object"
            ? "The selected document will be rejected and the forwarder notified to re-upload it."
            : "This job will be marked as rejected and the forwarder will be notified. This action cannot be undone from this screen."}
        </span>
        <TextField label="Reason" required value={rejectionReason} disabled={actionBusy} onChange={(event) => setRejectionReason(event.target.value)} />
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

      <Modal open={Boolean(delayOpen)} onClose={() => { if (!actionBusy) setDelayOpen(null); }} title="Mark Delayed" description={delayOpen?.id}
        footer={<><Button variant="outline" disabled={actionBusy} onClick={() => setDelayOpen(null)}>Cancel</Button><Button disabled={actionBusy || !delayReason.trim()} onClick={() => void perform("delay", { tripId: delayOpen.id, reason: delayReason })}>{actionBusy ? "Saving…" : "Mark Delayed"}</Button></>}>
        <span className="tk-meta">The delay applies to this job and all its trips. The forwarder and trucking company will be notified.</span>
        <TextField label="Reason" value={delayReason} maxLength={500} required disabled={actionBusy} onChange={(event) => setDelayReason(event.target.value)} />
      </Modal>

      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Route Map"
        description={`${job.origin} → ${job.destination}`}
        width={640}
      >
        <div className="jd-map-placeholder jd-map-active" style={{ height: 320, minHeight: 320 }}>
          <JobDetailMap origin={job.origin} destination={job.destination} ariaLabel="Job driving route map" zoomControl />
        </div>
      </Modal>
    </div>
  );
}
