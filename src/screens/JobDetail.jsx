"use client";

import { ToastRelay } from '../components/ActionToast.jsx';
import { useEffect, useMemo, useRef, useState } from "react";
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
  FilterSelect,
  Skeleton,
  TextField,
  Select,
  NotAvailable,
  orNA,
  isMissing,
  RouteStack,
  shortMoneyValue,
} from "../ds.js";
import { useGetAdminJobScreenQuery, useGetAdminJobScreenTripQuery, useChangeAdminJobScreenMutation, useGetAdminJobBidActionDetailQuery, usePerformAdminJobActionMutation, jobScreenUrl } from "../store/features/jobs/jobDetailApi.js";
import { useGetContainerReviewJobQuery } from "../store/features/documents/containerReviewApi.js";
import { countDocuments } from "../domain/containerReview.js";
import { JobContainerDocuments } from "./JobContainerDocuments.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverLoadingNotice } from "./DriversLoading.jsx";
import { JobDetailMap } from "./JobDetailMap.jsx";
import { useGetAdminTrackingOverviewQuery } from "../store/features/tracking/trackingApi.js";
import "./JobDetail.css";

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
const naira = (n) => typeof n === "number" && Number.isFinite(n) ? "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

const displayCount = (n) => n == null ? "—" : n;
const percentage = (n) => n == null ? "—" : n + "%";

function JobTabHeading({ title, description }) {
  return <header className="jd-tab-heading"><h2>{title}</h2><p>{description}</p></header>;
}

function JobFact({ label, children, wide = false }) {
  return <div className={'jd-info-fact' + (wide ? ' wide' : '')}><dt>{label}</dt><dd>{orNA(children)}</dd></div>;
}

function InfoStrip({ items }) {
  return <div className="jd-metric-strip" style={{ '--jd-metric-columns': items.length }}>
    {items.map((item, index) => <div className="jd-metric" key={index}>
      <span>{item.label}</span><strong>{isMissing(item.value) ? <NotAvailable /> : shortMoneyValue(item.value)}</strong>{item.caption && !isMissing(item.caption) && <small>{item.caption}</small>}
    </div>)}
  </div>;
}

function JobProgress({ job }) {
  const stages = [
    { label: 'Created', icon: 'file-plus', date: job.stageDates?.[0] },
    { label: 'Document review', icon: 'file-check-2', date: job.stageDates?.[1] },
    { label: 'Bidding', icon: 'gavel', date: job.stageDates?.[2] },
    { label: 'Assigned', icon: 'truck', date: job.stageDates?.[3] },
    { label: 'In transit', icon: 'route', date: job.stageDates?.[4] },
    { label: 'Delivered', icon: 'circle-check', date: job.stageDates?.[5] },
  ];
  const current = { Draft: 0, 'Pending Approval': 1, Bidding: 2, Assigned: 3, 'In Transit': 4, Delivered: 5 }[job.status];
  return <section className="jd-progress" aria-label="Job status and progress">
    <div className="jd-progress-heading"><span>Job progress</span><Badge dot tone={statusTone(job.status)}>{job.status}</Badge>{!isMissing(job.updatedAt) && <span className="jd-progress-updated">Last updated {job.updatedAt}</span>}</div>
    <ol className="jd-progress-steps">
      {stages.map((stage, index) => {
        const isCurrent = index === current;
        const done = Boolean(stage.date) || current != null && (index < current || current === 5);
        return <li key={stage.label} className={done ? 'done' : isCurrent ? 'current' : 'pending'} aria-current={isCurrent ? 'step' : undefined}>
          <span className="jd-progress-node"><Icon name={done ? 'check' : stage.icon} size={14} aria-hidden="true" /></span>
          <strong>{stage.label}</strong><small>{stage.date || (isCurrent ? 'Current stage' : done ? 'Completed' : 'Upcoming')}</small>
        </li>;
      })}
    </ol>
  </section>;
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
  return <div ref={menuRef} onClick={(event) => event.stopPropagation()} style={{ position: "fixed", zIndex: 'var(--tk-z-overlay)', width: "max-content", top: position?.top ?? -10000, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}><DropdownMenu width={205} items={items} /></div>;
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
  const [performAdminAction, { isLoading: adminActionBusy }] = usePerformAdminJobActionMutation();
  const [adminAction, setAdminAction] = useState(null);
  const [adminReason, setAdminReason] = useState("");
  const [adminDate, setAdminDate] = useState("");
  const [adminCargo, setAdminCargo] = useState("");
  const [adminInstructions, setAdminInstructions] = useState("");
  const [adminPickup, setAdminPickup] = useState("");
  const [adminDelivery, setAdminDelivery] = useState("");
  const [adminReturn, setAdminReturn] = useState("");
  const [bidDecision, setBidDecision] = useState("acceptBid");
  const [flagReason, setFlagReason] = useState("PRICING");
  const actionLock = useRef(false), adminActionLock = useRef(false), active = useRef(true);
  const [delayReason, setDelayReason] = useState("");
  const [delayOpen, setDelayOpen] = useState(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (job?.errors.length) setToast({ tone: "warning", title: "Unable to load: " + job.errors.join(", ") + ". Refresh to try again." });
  }, [job]);

  const [tab, setTab] = useState("Overview");
  const [mapOpen, setMapOpen] = useState(false);
  const [acceptBidFor, setAcceptBidFor] = useState(null);
  const bidActionQuery = useGetAdminJobBidActionDetailQuery({ id: acceptBidFor?.id, jobId: job?.apiId, owner, role }, { skip: !authenticated || !acceptBidFor?.id || !job?.apiId, refetchOnMountOrArgChange: true });
  const containerReview = useGetContainerReviewJobQuery(
    { jobId: job?.apiId, hint: { jobNumber: job?.id, forwarder: job?.forwarder, origin: job?.origin, destination: job?.destination, stage: job?.canApprove ? 'review' : 'past' } },
    { skip: !job?.apiId, refetchOnMountOrArgChange: true },
  );
  const review = containerReview.currentData;
  const reviewCounts = review ? countDocuments(review.units) : null;
  const [toast, setToast] = useState(null);

  const [logPage, setLogPage] = useState(1);
  const [activityFilter, setActivityFilter] = useState("All Activities");
  const [activityOpenFilter, setActivityOpenFilter] = useState(false);
  const [tripMenu, setTripMenu] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const bids = useMemo(() => job?.bids || [], [job]);
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
  function unavailable(action) { notify("info", action + " is not available right now."); }
  async function perform(action, details = {}) {
    if (actionLock.current || !authenticated) return;
    actionLock.current = true;
    try {
      await changeJob({ id: job.apiId, owner, role, expectedStatus: job.statusCode, action, ...details }).unwrap();
      if (!active.current) return;
      setDelayOpen(null); setTripMenu(null);
      const messages = { approve: "Job documents approved and released for bidding.", reject: "Job documents rejected.", approveDocument: "Document approved.", rejectDocument: "Document rejected.", deliver: "Job marked delivered.", cancel: "Job cancelled.", atDelivery: "Job and its trips marked at delivery.", delay: "Job and its trips marked delayed." };
      notify("success", messages[action]);
    } catch (error) {
      if (active.current) notify("danger", getApiErrorMessage(error));
    } finally { actionLock.current = false; }
  }
  function openAdminAction(action) { setAdminReason(""); setAdminDate(""); setAdminCargo(""); setAdminInstructions(""); setAdminPickup(""); setAdminDelivery(""); setAdminReturn(""); setFlagReason(job.reviewFlag?.reason || "PRICING"); setAdminAction(action); }
  function doMarkInTransit() { openAdminAction("transit"); }
  async function submitAdminAction(action, bid = null) {
    if (adminActionBusy || adminActionLock.current || adminReason.trim().length < 3) return;
    const fields = {};
    if (action === "edit") {
      if (adminCargo.trim()) fields.cargoDescription = adminCargo.trim();
      if (adminInstructions.trim()) fields.specialInstructions = adminInstructions.trim();
      if (adminPickup.trim()) fields.pickupAddress = adminPickup.trim();
      if (adminDelivery.trim()) fields.deliveryAddress = adminDelivery.trim();
      if (adminReturn.trim()) fields.containerReturnAddress = adminReturn.trim();
    }
    const date = adminDate ? new Date(adminDate) : null;
    if ((action === "duplicate" && !date) || (date && (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 86400000))) { notify("danger", "Choose a TDO date at least 24 hours from now."); return; }
    if (action === "edit" && date) fields.tdoDate = date.toISOString();
    adminActionLock.current = true;
    try {
      const result = await performAdminAction({ id: job.apiId, owner, role, action, reason: adminReason, expectedVersion: action === "edit" ? job.version : action === "flag" ? job.reviewFlag?.version : bidActionQuery.currentData?.version, flagReason, fields, bidId: bid?.id, tdoDate: date?.toISOString() }).unwrap();
      setAdminAction(null); setAcceptBidFor(null); setAdminReason("");
      notify("success", action === "duplicate" ? `Draft ${result.jobNumber || result.id} created.` : action === "transit" ? "Job marked in transit." : action === "edit" ? "Job updated." : action === "flag" ? "Job flagged for review." : action === "acceptBid" ? "Bid accepted." : "Bid declined.");
    } catch (error) {
      const shortfall = error?.data?.shortfall;
      notify("danger", error?.status === 402 && shortfall != null && shortfall !== "" && Number.isFinite(Number(shortfall)) && Number(shortfall) >= 0 ? `Insufficient funds. Shortfall: ${naira(Number(shortfall))}.` : getApiErrorMessage(error));
    } finally { adminActionLock.current = false; }
  }
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
      {["SUPER_ADMIN", "OPS_ADMIN"].includes(role) && job.adminActions.canEdit === true && job.version && <Button variant="outline" icon="pencil" onClick={() => openAdminAction("edit")}>Edit</Button>}
      {!(job.reviewFlag && !job.reviewFlag.version) && !terminal && <Button variant="outline" icon="flag" onClick={() => openAdminAction("flag")}>{job.reviewFlag ? "Update flag" : "Flag for review"}</Button>}
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
          <Button
            icon="file-check-2"
            onClick={() => { if (review) navigate(`/documents/review?jobId=${encodeURIComponent(review.id)}&ref=${encodeURIComponent(job.id)}`); else setTab("Documents"); }}
          >
            {reviewCounts?.pending ? `Review documents (${reviewCounts.pending} left)` : "Review documents"}
          </Button>
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
          {job.status === "Assigned" && <Button icon="truck" disabled={!["SUPER_ADMIN", "OPS_ADMIN"].includes(role) || job.adminActions.canMarkInTransit !== true} onClick={doMarkInTransit}>Mark In Transit</Button>}
          {job.status === "In Transit" && <Button icon="circle-check" onClick={doMarkDelivered}>Mark Delivered</Button>}
        </>
      ) : null}
      {!terminal && job.status !== "Delivered" && <Button variant="danger" icon="ban" disabled={actionBusy} onClick={doCancel}>Cancel job</Button>}
    </>
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
  const docsCount = reviewCounts ? reviewCounts.total : "—";
  const tripsCount = job.tripsKnown ? jobTrips.length : "—";
  const activityCount = job.activityKnown ? activityLog.length : "—";

  return (
    <div className="jd-detail-page">
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
        <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}>
          <Banner
            tone={toast.tone === "danger" ? "danger" : toast.tone}
            title={toast.title}
          />
        </ToastRelay>
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

      <section className="jd-hero" aria-label="Job summary">
        <div className="jd-hero-route">
          <span className="jd-hero-eyebrow">{job.requestType || "Job"}{!isMissing(job.forwarder) ? " · " + job.forwarder : ""}</span>
          <RouteStack from={job.origin} to={job.destination} wrap />
        </div>
        <dl className="jd-hero-stats">
          <div><dt>Job value</dt><dd>{shortMoneyValue(orNA(naira(job.jobValue)))}</dd></div>
          <div><dt>Trips</dt><dd>{job.tripsKnown ? `${displayCount(job.assignedTrips)} of ${displayCount(tripCounts.total)}` : <NotAvailable />}</dd></div>
          <div><dt>Bids</dt><dd>{job.bidsKnown ? bids.length : <NotAvailable />}</dd></div>
          <div><dt>Trucking company</dt><dd>{orNA(job.truckingCompany, "Not assigned")}</dd></div>
        </dl>
      </section>

      <JobProgress job={job} />

      <div className="jd-detail-nav"><Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "Overview", label: <><Icon name="layout-dashboard" size={15} aria-hidden="true" />Overview</> },
          {
            value: "Bids & Responses",
            label: <><Icon name="gavel" size={15} aria-hidden="true" />Bids & Responses</>,
            count: bidsCount,
          },
          { value: "Associated Trips", label: <><Icon name="truck" size={15} aria-hidden="true" />Associated Trips</>, count: tripsCount },
          { value: "Tracking & Updates", label: <><Icon name="map-pin" size={15} aria-hidden="true" />Tracking & Updates</> },
          { value: "Documents", label: <><Icon name="files" size={15} aria-hidden="true" />Documents</>, count: docsCount },
          { value: "Financials", label: <><Icon name="wallet" size={15} aria-hidden="true" />Financials</> },
          { value: "Activity Log", label: <><Icon name="history" size={15} aria-hidden="true" />Activity Log</>, count: activityCount },
        ]}
      /></div>

      {tab === "Overview" && (<section className="jd-tab-stack">
  <JobTabHeading title="Overview" description="Job details, route and price at a glance." />
  <div className="jd-info-layout">
    <div className="jd-tab-stack">
      <SectionCard title="Job details"  icon="package">
        <dl className="jd-info-facts">
          <JobFact label="Request type"><Badge tone="purple">{job.requestType}</Badge></JobFact>
          <JobFact label="Trip type">{job.tripType}</JobFact>
          <JobFact label="Trucks required">{displayCount(job.requiredTrucks)}</JobFact>
          <JobFact label="Customer / forwarder">{job.contactPerson || job.forwarder}</JobFact>
          <JobFact label="Contact phone">{job.contactPhone}</JobFact>
          <JobFact label="Cargo type">{job.cargoType}</JobFact>
          <JobFact label="Cargo details" wide>{job.cargoDetails || job.cargo}</JobFact>
          <JobFact label="Total weight">{job.totalWeight}</JobFact>
        </dl>
        {job.forwarderId && <button type="button" className="jd-text-link" onClick={() => navigate('/forwarders/detail?id=' + encodeURIComponent(job.forwarderId))}>View customer profile <Icon name="arrow-up-right" size={13} /></button>}
        <div data-empty={!job.specialInstructions || job.specialInstructions === '—'} className="jd-instructions">
          <span className="jd-field-label">Special instructions</span>
          <p>{isMissing(job.specialInstructions) ? 'No special instructions.' : job.specialInstructions}</p>
        </div>
      </SectionCard>
      <SectionCard title="Route details" description="Pickup, delivery and schedule" icon="route"
        action={<Button size="sm" variant="outline" icon="map" onClick={() => setMapOpen(true)}>View map</Button>}>
        <div className="jd-route-stops">
          <div className="jd-route-stop">
            <span className="jd-stop-marker"><Icon name="circle-dot" size={18} /></span>
            <div className="jd-stop-content"><span className="jd-field-label">Pickup</span><h4>{orNA(job.origin)}</h4>{!isMissing(job.originCountry) && <p>{job.originCountry}</p>}<span className="jd-stop-date"><Icon name="calendar" size={13} />{orNA(job.pickupDate, 'Date not set')}</span></div>
          </div>
          <div className="jd-route-stop">
            <span className="jd-stop-marker destination"><Icon name="map-pin" size={18} /></span>
            <div className="jd-stop-content"><span className="jd-field-label">Delivery</span><h4>{orNA(job.destination)}</h4>{!isMissing(job.destCountry) && <p>{job.destCountry}</p>}<span className="jd-stop-date"><Icon name="calendar" size={13} />{orNA(job.deliveryDate, 'Date not set')}</span></div>
          </div>
        </div>
        <dl className="jd-route-facts">
          <JobFact label="Distance">{job.distanceKm != null ? `${job.distanceKm} km` : null}</JobFact>
          <JobFact label="Estimated duration">{job.durationLabel}</JobFact>
          <JobFact label="Route type">{job.routeType}</JobFact>
        </dl>
      </SectionCard>
    </div>
    <aside className="jd-price-column jd-tab-stack">
      <SectionCard title="Price" action={<span className="jd-currency">NGN</span>}>
        <div className="jd-price-hero"><span className="jd-field-label">Total job value</span><strong>{orNA(naira(job.jobValue))}</strong></div>

        <button type="button" className="jd-text-link" onClick={() => setTab('Financials')}>View financial details <Icon name="arrow-right" size={13} /></button>
      </SectionCard>
      <SectionCard title="Activity" icon="history" action={<button type="button" className="jd-inline-link" onClick={() => setTab('Activity Log')}>View all <Icon name="arrow-up-right" size={12} aria-hidden="true" /></button>}>
        {activityLog.length ? <div className="jd-overview-activity">{activityLog.slice(0, 5).map((entry) => <div key={entry.id} className="jd-overview-event">
          <span className="jd-event-icon"><Icon name="history" size={13} aria-hidden="true" /></span>
          <div><strong>{entry.action}</strong><p>{entry.details}</p><small>{entry.user} · {entry.time}</small></div>
        </div>)}</div> : <p className="jd-overview-empty">{job.activityKnown ? 'No activity yet.' : <NotAvailable />}</p>}
      </SectionCard>
    </aside>
  </div>
</section>
)}

      {tab === "Bids & Responses" && (<section className="jd-tab-stack"><JobTabHeading title="Bids & responses" description="Review trucking company quotes and responses." /><InfoStrip items={[
 {label:'Bids received',value:bidsCount},
 {label:'Lowest bid',value:bids.length && bidAmountsKnown ? naira(Math.min(...bids.map((bid)=>bid.amount))) : '—'},
 {label:'Highest bid',value:bids.length && bidAmountsKnown ? naira(Math.max(...bids.map((bid)=>bid.amount))) : '—'},
 {label:'Average bid',value:bids.length && bidAmountsKnown ? naira(bids.reduce((sum,bid)=>sum+bid.amount,0)/bids.length) : '—'}
]} /><SectionCard
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

                {!job.bidsKnown ? <DriverLoadingNotice>Bid data is unavailable. Refresh to try again.</DriverLoadingNotice> : bids.length ? (
                  <DataTable emptyAs={<NotAvailable />}
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
                            <span style={{ display: "flex", gap: 6 }}><Button
                              size="sm"
                              variant="outline"
                              disabled={job.status !== "Bidding"}
                              onClick={() => { setAdminReason(""); setBidDecision("acceptBid"); setAcceptBidFor(r); }}
                            >
                              {job.status === "Bidding" ? "Accept" : "View"}
                            </Button>{job.status === "Bidding" && r.statusCode === "PENDING" && r.isCounterOffer === false && <Button size="sm" variant="outline" onClick={() => { setAdminReason(""); setBidDecision("declineBid"); setAcceptBidFor(r); }}>Decline</Button>}</span>
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
              </SectionCard></section>)}

      {tab === "Associated Trips" && (
        <section className="jd-tab-stack"><JobTabHeading title="Trips" description="Truck assignments and the movements fulfilling this job." />
          <InfoStrip
            items={[
              { icon: "truck", label: "Trucks Requested", value: displayCount(tripCounts.required), tint: "amber" },
              { icon: "route", label: "Trips Created", value: `${displayCount(job.assignedTrips)} of ${displayCount(tripCounts.total)}` },
              { icon: "navigation", label: "Active Trips", value: displayCount(tripCounts.active), tint: "purple" },
              { icon: "circle-check", label: "Trips Delivered", value: displayCount(tripCounts.completed), tint: "green" },
            ]}
          />
          {tripCounts.assigned != null && tripCounts.required != null && tripCounts.assigned < tripCounts.required && (
            <Banner inline tone="warning" title={`${tripCounts.required - tripCounts.assigned} assignment${tripCounts.required - tripCounts.assigned === 1 ? "" : "s"} remaining`}>
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
              <DataTable emptyAs={<NotAvailable />}
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
        </section>
      )}

      {tab === "Tracking & Updates" && (<section className="jd-tab-stack"><JobTabHeading title="Tracking & updates" description="Live location and recorded updates for the selected trip." />{jobTrips.length > 0 && (
                <SectionCard title="Select Trip" description="Tracking and updates are recorded per truck movement.">
                  <div className="jd-trip-selector">
                    {jobTrips.map((trip) => (
                      <button key={trip.id} className={trip.id === selectedTrip?.id ? "active" : ""} onClick={() => setSelectedTripId(trip.id)}>
                        <Icon name="truck" size={16}/><span><strong>{trip.containerNumber} · {trip.route}</strong><small>{trip.truckPlate} · {trip.driverName}</small></span><Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              )}<SectionCard
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
                      {orNA(selectedTrip?.coveredKm != null && selectedTrip?.distanceKm != null ? `${selectedTrip.coveredKm} km / ${selectedTrip.distanceKm} km` : "—")}
                    </strong>
                  </span>
                  <span>
                    <span className="tk-meta">Current Speed</span>
                    <strong>
                      {orNA(selectedTrip?.speedKmH == null ? "—" : `${selectedTrip.speedKmH} km/h`)}
                    </strong>
                  </span>
                  <span>
                    <span className="tk-meta">ETA</span>
                    <strong>{orNA(selectedTrip?.eta || job.deliveryDate || "—")}</strong>
                  </span>
                  <span>
                    <span className="tk-meta">Next Stop</span>
                    <strong>{orNA(job.destination)}</strong>
                  </span>
                </div>
              </SectionCard><SectionCard title="Tracking Updates" pad="none">
                {trackingUpdates.length ? (
                  <DataTable emptyAs={<NotAvailable />}
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
              </SectionCard>{photos.length > 0 && (
                <SectionCard
                  title="Photos & Proof"

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
              )}</section>)}

      {tab === "Documents" && (
        <JobContainerDocuments review={review} loading={containerReview.isFetching} error={containerReview.error} onRetry={containerReview.refetch} jobRef={job.id} />
      )}

      {tab === "Financials" && (<section className="jd-tab-stack"><JobTabHeading title="Financials" description="Payments, costs and payouts for this job." /><InfoStrip items={[{label:'Job value',value:naira(job.jobValue)},{label:'Platform fee',value:naira(fee),caption:percentage(job.platformFeePct)},{label:'Company payment',value:naira(driverPayment)},{label:'Net platform earnings',value:naira(netEarnings)}]} /><div className="jd-finance-layout"><div className="jd-tab-stack"><SectionCard title="Transactions" pad="none">
                {!job.transactionsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable emptyAs={<NotAvailable />}
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
              </SectionCard>{tripFinancials.length > 0 && (
                <SectionCard title="Trip-level Costs" description="Operational costs stay attached to each truck movement and roll up to the job." pad="none">
                  <DataTable emptyAs={<NotAvailable />} rows={tripFinancials} rowKey={(trip) => trip.id} coloredHeader columns={[
                    { key: "id", header: "Container / Route", render: (trip) => <strong className="jd-trip-id">{trip.containerNumber} · {trip.route}</strong> },
                    { key: "truckPlate", header: "Truck" },
                    { key: "driverName", header: "Driver" },
                    { key: "cost", header: "Trip Cost", render: (trip) => naira(trip.cost) },
                    { key: "driverPayment", header: "Driver Payment", render: (trip) => naira(trip.driverPayment) },
                    { key: "expenses", header: "Expenses", render: (trip) => naira(trip.expenses) },
                    { key: "status", header: "Status", render: (trip) => <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge> },
                  ]}/>
                </SectionCard>
              )}<SectionCard title={`Related Payouts (${job.relatedPayoutsKnown ? relatedPayouts.length : "—"})`} description="Company payouts are reconciled to the individual trips included in this job." pad="none">
                {relatedPayouts.length ? <DataTable emptyAs={<NotAvailable />} rows={relatedPayouts} rowKey={(payout) => payout.id} coloredHeader onRowClick={(payout) => navigate(`/payouts/${payout.id}`)} columns={[
                  { key: "id", header: "Payout ID", render: (payout) => <strong className="jd-trip-id">{payout.id}</strong> },
                  { key: "party", header: "Beneficiary" },
                  { key: "trips", header: "Trips Included", render: (payout) => `${payout.tripIds?.length || 0} of ${jobTrips.length}` },
                  { key: "gross", header: "Gross", render: (payout) => naira(payout.grossAmount ?? payout.amount) },
                  { key: "net", header: "Net", render: (payout) => naira(payout.netAmount ?? payout.amount) },
                  { key: "status", header: "Status", render: (payout) => <Badge dot tone={statusTone(payout.status)}>{payout.status}</Badge> },
                  { key: "eligibility", header: "Eligibility", render: (payout) => <Badge tone={payout.approvalReady ? "success" : "warning"}>{payout.eligibility || "Legacy"}</Badge> },
                ]} /> : !job.relatedPayoutsKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <EmptyState icon="wallet" title="No payout created" description="A company payout can be reconciled after eligible trips are delivered." />}
              </SectionCard></div><aside className="jd-tab-stack"><SectionCard title="Payment status">
                <Timeline items={financialTimeline.slice(0, 3)} />
              </SectionCard><SectionCard title="Additional costs"><div className="jd-price-breakdown"><div><span>Demurrage (estimated)</span><strong>{orNA(naira(demurrage))}</strong></div><div><span>Other adjustments</span><strong>{orNA(naira(otherCosts))}</strong></div></div></SectionCard></aside></div></section>)}

      {tab === "Activity Log" && (<section className="jd-tab-stack"><JobTabHeading title="Activity log" description="A chronological record of changes and actions on this job." /><InfoStrip items={[{label:'Activities recorded',value:activityCount},{label:'People involved',value:displayCount(uniqueActivityUsers)},{label:'Most active',value:job.mostActiveUser || '—'}]} /><SectionCard
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
                            zIndex: 'var(--tk-z-dropdown)',
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
                {!job.activityKnown ? <DriverLoadingNotice>—</DriverLoadingNotice> : <DataTable emptyAs={<NotAvailable />}
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
              </SectionCard></section>)}

      {tripActionTarget && <TripActionMenu anchor={tripMenu.anchor} onClose={setTripMenu} items={["Assigned", "At Pickup", "In Transit", "At Delivery", "Delivered", "Delayed"].filter((status) => status !== tripActionTarget.status).map((status) => ({ label: "Mark " + status, icon: status === "Delivered" ? "circle-check" : status === "Delayed" ? "triangle-alert" : "route", tone: status === "Delayed" ? "danger" : undefined, onClick: () => doTripStatus(tripActionTarget.id, status) }))} />}

      <Modal
        open={!!acceptBidFor}
        onClose={() => { if (!adminActionBusy) setAcceptBidFor(null); }}
        title={bidDecision === "acceptBid" ? "Accept Bid" : "Decline Bid"}
        description={
          acceptBidFor ? `${bidDecision === "acceptBid" ? "Accept" : "Decline"} ${acceptBidFor.company}'s bid for ${job.id}?` : ""
        }
        footer={
          acceptBidFor && (
            <>
              <Button variant="outline" disabled={adminActionBusy} onClick={() => setAcceptBidFor(null)}>
                Cancel
              </Button>
              <Button icon="check" disabled={adminActionBusy || bidActionQuery.isFetching || !bidActionQuery.currentData?.version || bidActionQuery.currentData?.[bidDecision === "acceptBid" ? "canAccept" : "canDecline"] !== true || adminReason.trim().length < 3 || !["SUPER_ADMIN", "OPS_ADMIN"].includes(role)} onClick={() => submitAdminAction(bidDecision, acceptBidFor)}>
                {adminActionBusy ? "Saving…" : bidDecision === "acceptBid" ? "Confirm Acceptance" : "Confirm Decline"}
              </Button>
            </>
          )
        }
      >
        {acceptBidFor && (
          <><span className="tk-meta">{acceptBidFor.company} bid {naira(acceptBidFor.amount)}. {bidDecision === "acceptBid" ? "Accepting charges the forwarder's wallet for the agreed price, terminal handling and platform fee into escrow, and declines other pending bids." : "Declining does not move money."}</span>
          {bidActionQuery.error && <Banner tone="danger" title={getApiErrorMessage(bidActionQuery.error)} />}
          <TextField label="Reason" required maxLength={500} value={adminReason} onChange={(event) => setAdminReason(event.target.value)} /></>
        )}
      </Modal>

      <Modal open={Boolean(adminAction)} onClose={() => { if (!adminActionBusy) setAdminAction(null); }} title={adminAction === "duplicate" ? "Duplicate Job" : adminAction === "transit" ? "Mark In Transit" : adminAction === "flag" ? "Flag for Review" : "Edit Job"}
        footer={<><Button variant="outline" disabled={adminActionBusy} onClick={() => setAdminAction(null)}>Cancel</Button><Button disabled={adminActionBusy || adminReason.trim().length < 3 || (adminAction === "duplicate" && !adminDate) || (adminAction === "edit" && !adminCargo.trim() && !adminInstructions.trim() && !adminDate && !adminPickup.trim() && !adminDelivery.trim() && !adminReturn.trim())} onClick={() => submitAdminAction(adminAction)}>{adminActionBusy ? "Saving…" : "Confirm"}</Button></>}>
        {adminAction === "transit" && <p className="tk-meta">This confirms pickup and may release the mobilisation payment to the trucking company.</p>}
        {adminAction === "flag" && <Select label="Review reason" value={flagReason} onChange={(event) => setFlagReason(event.target.value)} options={[{ value: "PRICING", label: "Pricing" }, { value: "DOCUMENTS", label: "Documents" }, { value: "DELAY", label: "Delay" }, { value: "SAFETY", label: "Safety" }, { value: "FRAUD_RISK", label: "Fraud risk" }, { value: "CUSTOMER_COMPLAINT", label: "Customer complaint" }, { value: "OTHER", label: "Other" }]} />}
        {adminAction === "duplicate" && <><p className="tk-meta">A new draft will be created for the forwarder. Documents, price, bids and assignments are not copied.</p><TextField label="New TDO date and time" type="datetime-local" required value={adminDate} onChange={(event) => setAdminDate(event.target.value)} /></>}
        {adminAction === "edit" && <><p className="tk-meta">Enter only the fields you want to change. Route changes are unavailable while bids are pending and do not recalculate the price. Address fields depend on the job's movement type.</p><TextField label="TDO date and time" type="datetime-local" value={adminDate} onChange={(event) => setAdminDate(event.target.value)} /><TextField label="Cargo description" value={adminCargo} onChange={(event) => setAdminCargo(event.target.value)} /><TextField label="Special instructions" value={adminInstructions} onChange={(event) => setAdminInstructions(event.target.value)} /><TextField label="Pickup address (export)" value={adminPickup} onChange={(event) => setAdminPickup(event.target.value)} /><TextField label="Delivery address" value={adminDelivery} onChange={(event) => setAdminDelivery(event.target.value)} /><TextField label="Container return address" value={adminReturn} onChange={(event) => setAdminReturn(event.target.value)} /></>}
        <TextField label="Reason" required maxLength={500} value={adminReason} onChange={(event) => setAdminReason(event.target.value)} />
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
