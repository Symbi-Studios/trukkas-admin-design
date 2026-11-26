"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { ToastRelay } from "../components/ActionToast.jsx";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterSelect,
  Icon,
  Modal,
  PageHeader,
  Pagination,
  RouteStack,
  SectionCard,
  Select,
  Tabs,
  TextField,
} from "../ds.js";
import { statusTone } from "@/domain/jobStatus";
import { cancelJobAction, markDeliveredAction } from "@/lib/jobs/actions";
import {
  decideBidAction,
  editJobAction,
  flagJobAction,
  getBidActionStateAction,
  getTripDetailAction,
  markInTransitAction,
  markTripAtDeliveryAction,
  markTripDelayedAction,
} from "@/lib/jobs/detail-actions";
import type { BidActionState } from "@/lib/jobs/detail-actions";
import type { ApiError, ApiResult } from "@/types/api";
import type { ActivityEntry, JobBid, JobDetailData, JobTransaction, JobTrip, TripDetail } from "@/types/jobDetail";
import type { JobDetailTab } from "@/domain/jobDetailTabs";
import { JobContainerDocuments } from "./JobContainerDocuments";
import { JobDetailMap } from "./JobDetailMap";
import { CancellationNote, CargoSection, FeeBreakdown, PeopleSection, ScheduleSection } from "./JobDetailSections";
import "./JobDetail.css";
import "./JobDetailExtras.css";

// Job details. The Next.js server loads everything (app/jobs/[jobId]/page.tsx) and every action runs there too.
// A value the backend has not sent shows "—". The route map is not built yet.

const DASH = "—";
const OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"];
const FLAG_ROLES = ["SUPER_ADMIN", "OPS_ADMIN", "FINANCE_ADMIN"];
const LOG_PAGE_SIZE = 8;
const REFRESH_TRACKING_MS = 30000;


const FLAG_REASONS = [
  { value: "PRICING", label: "Pricing" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "DELAY", label: "Delay" },
  { value: "SAFETY", label: "Safety" },
  { value: "FRAUD_RISK", label: "Fraud risk" },
  { value: "CUSTOMER_COMPLAINT", label: "Customer complaint" },
  { value: "OTHER", label: "Other" },
];

type Dialog = "cancel" | "deliver" | "transit" | "flag" | "edit";
type Toast = { tone: "success" | "danger" | "info" | "warning"; title: string };

function naira(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  return "₦" + value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function show(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? DASH : String(value);
}

// ---------- small pieces used once or twice ----------

function TabHeading({ title, description }: { title: string; description: string }) {
  return <header className="jd-tab-heading"><h2>{title}</h2><p>{description}</p></header>;
}

function InfoStrip({ items }: { items: { label: string; value: string | number; caption?: string }[] }) {
  return (
    <div className="jd-metric-strip" style={{ ["--jd-metric-columns" as string]: items.length }}>
      {items.map((item) => (
        <div className="jd-metric" key={item.label}>
          <span>{item.label}</span>
          <strong>{show(item.value)}</strong>
          {item.caption && item.caption !== DASH && <small>{item.caption}</small>}
        </div>
      ))}
    </div>
  );
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={"jd-info-fact" + (wide ? " wide" : "")}>
      <dt>{label}</dt>
      <dd>{children === null || children === undefined || children === "" ? DASH : children}</dd>
    </div>
  );
}

const STAGES = [
  { label: "Created", icon: "file-plus" },
  { label: "Document review", icon: "file-check-2" },
  { label: "Bidding", icon: "gavel" },
  { label: "Assigned", icon: "truck" },
  { label: "In transit", icon: "route" },
  { label: "Delivered", icon: "circle-check" },
];
const STAGE_OF: Record<string, number> = { Draft: 0, "Pending Approval": 1, Bidding: 2, Assigned: 3, "In Transit": 4, Delivered: 5 };

function JobProgress({ detail }: { detail: JobDetailData }) {
  const current = STAGE_OF[detail.status];
  return (
    <section className="jd-progress" aria-label="Job status and progress">
      <div className="jd-progress-heading">
        <span>Job progress</span>
        <Badge dot tone={statusTone(detail.status)}>{detail.status}</Badge>
        {detail.updatedAt !== DASH && <span className="jd-progress-updated">Last updated {detail.updatedAt}</span>}
      </div>
      <ol className="jd-progress-steps">
        {STAGES.map((stage, index) => {
          const date = detail.stageDates[index];
          const isCurrent = index === current;
          const done = Boolean(date) || (current !== undefined && (index < current || current === 5));
          return (
            <li key={stage.label} className={done ? "done" : isCurrent ? "current" : "pending"} aria-current={isCurrent ? "step" : undefined}>
              <span className="jd-progress-node"><Icon name={done ? "check" : stage.icon} size={14} aria-hidden="true" /></span>
              <strong>{stage.label}</strong>
              <small>{date || (isCurrent ? "Current stage" : done ? "Completed" : "Upcoming")}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function csvCell(value: string): string {
  // a cell that starts with = + - @ would run as a formula in Excel
  return '"' + (/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""') + '"';
}

// ---------- the screen ----------

interface JobDetailProps {
  detail: JobDetailData | null;
  error: string | null;
  role: string | null;
  initialTab: JobDetailTab;
  initialTripId: string | null;
}

export function JobDetail({ detail, error, role, initialTab, initialTripId }: JobDetailProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<JobDetailTab>(initialTab);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);

  // dialogs
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reason, setReason] = useState("");
  const [flagReason, setFlagReason] = useState("PRICING");
  const [editDate, setEditDate] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editPickup, setEditPickup] = useState("");
  const [editDelivery, setEditDelivery] = useState("");
  const [editReturn, setEditReturn] = useState("");
  const [bidDialog, setBidDialog] = useState<{ bid: JobBid; decision: "accept" | "decline" } | null>(null);
  const [bidState, setBidState] = useState<{ loading: boolean; error: string | null; data: BidActionState | null }>({ loading: false, error: null, data: null });
  const [delayTrip, setDelayTrip] = useState<JobTrip | null>(null);
  const [delayReason, setDelayReason] = useState("");

  // tracking
  const [selectedTripId, setSelectedTripId] = useState<string | null>(initialTripId);
  const [tripState, setTripState] = useState<{ loading: boolean; error: string | null; data: TripDetail | null }>({ loading: false, error: null, data: null });
  const [trackingTick, setTrackingTick] = useState(0);

  // activity
  const [activityFilter, setActivityFilter] = useState("All Activities");
  const [activityMenu, setActivityMenu] = useState(false);
  const [logPage, setLogPage] = useState(1);

  const jobId = detail?.id ?? "";
  const trips = useMemo(() => detail?.trips ?? [], [detail]);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null;
  const selectedId = selectedTrip?.id ?? null;

  useEffect(() => {
    if (tab !== "tracking" || !selectedId || !jobId) return undefined;
    let cancelled = false;
    const load = () => {
      getTripDetailAction({ tripId: selectedId, jobId })
        .then((result) => {
          if (cancelled) return;
          setTripState(result.ok ? { loading: false, error: null, data: result.data } : { loading: false, error: result.error.message, data: null });
        })
        .catch(() => { if (!cancelled) setTripState({ loading: false, error: "Tracking data couldn’t be loaded.", data: null }); });
    };
    setTripState((current) => ({ ...current, loading: true }));
    load();
    const timer = window.setInterval(load, REFRESH_TRACKING_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tab, selectedId, jobId, trackingTick]);

  useEffect(() => {
    if (!bidDialog || !jobId) { setBidState({ loading: false, error: null, data: null }); return undefined; }
    let cancelled = false;
    setBidState({ loading: true, error: null, data: null });
    getBidActionStateAction({ bidId: bidDialog.bid.id, jobId })
      .then((result) => {
        if (cancelled) return;
        setBidState(result.ok ? { loading: false, error: null, data: result.data } : { loading: false, error: result.error.message, data: null });
      })
      .catch(() => { if (!cancelled) setBidState({ loading: false, error: "The bid couldn’t be loaded.", data: null }); });
    return () => { cancelled = true; };
  }, [bidDialog, jobId]);

  if (!detail) {
    return (
      <Card>
        <EmptyState icon="package" title="Unable to load job details" description={error ?? "Open a job from the Jobs page to view its details."} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>Back to Jobs</Button>
        </div>
      </Card>
    );
  }

  const extras = detail.extras;
  const bids = detail.bids;
  const terminal = detail.status === "Cancelled" || detail.status === "Rejected";
  const canOps = role !== null && OPS_ROLES.includes(role);
  const canFlag = role !== null && FLAG_ROLES.includes(role);
  const review = detail.review;
  const reviewFailed = detail.warnings.includes("documents");

  function notify(tone: Toast["tone"], title: string) { setToast({ tone, title }); }

  /** Runs a server action. On success it closes whatever dialog is open and shows `done`. The page refreshes itself (revalidatePath). */
  async function run<T>(action: () => Promise<ApiResult<T>>, done: string, onDone?: (data: T) => void): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) { notify("danger", result.error.message); return; }
      setDialog(null); setBidDialog(null); setDelayTrip(null);
      notify("success", done);
      onDone?.(result.data);
    } catch {
      notify("danger", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function openDialog(next: Dialog) {
    setReason(""); setEditDate(""); setEditCargo(""); setEditInstructions(""); setEditPickup(""); setEditDelivery(""); setEditReturn("");
    setFlagReason(detail?.reviewFlag?.reason && FLAG_REASONS.some((r) => r.value === detail.reviewFlag?.reason) ? (detail.reviewFlag.reason as string) : "PRICING");
    setDialog(next);
  }

  function confirmDialog() {
    if (!dialog || !detail) return;
    const id = detail.id;
    if (dialog === "cancel") return void run(() => cancelJobAction({ jobId: id, reason }), "Job cancelled.");
    if (dialog === "deliver") return void run(() => markDeliveredAction({ jobId: id, note: reason }), "Job marked delivered.");
    if (dialog === "transit") return void run(() => markInTransitAction({ jobId: id, reason }), "Job marked in transit.");
    if (dialog === "flag") return void run(() => flagJobAction({ jobId: id, flagReason, note: reason, expectedVersion: detail.reviewFlag?.version ?? null }), "Job flagged for review.");
    return void run(() => editJobAction({
      jobId: id, expectedVersion: detail.version, reason, tdoDate: editDate, cargoDescription: editCargo,
      specialInstructions: editInstructions, pickupAddress: editPickup, deliveryAddress: editDelivery, containerReturnAddress: editReturn,
    }), "Job updated.");
  }

  const reasonTooShort = reason.trim().length < 3;
  const nothingToEdit = !editDate && ![editCargo, editInstructions, editPickup, editDelivery, editReturn].some((v) => v.trim());
  const confirmDisabled = busy
    || (dialog === "deliver" ? false : reasonTooShort)
    || (dialog === "edit" && nothingToEdit);

  async function shareJob() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/jobs/${encodeURIComponent(detail?.id ?? "")}`);
      notify("info", "Share link copied to clipboard.");
    } catch {
      notify("danger", "Unable to copy the share link.");
    }
  }

  function exportActivity() {
    const rows = [["Date & Time", "User", "Role", "Action", "Details"], ...detail!.activity.map((a) => [a.time, a.user, a.role, a.action, a.details])];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detail!.jobNumber}-activity.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    notify("info", "Activity log exported.");
  }

  // ---------- header ----------

  const headerActions = (
    <>
      <Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>Back to Jobs</Button>
      {canOps && detail.adminActions.canEdit && detail.version && <Button variant="outline" icon="pencil" onClick={() => openDialog("edit")}>Edit</Button>}
      {canFlag && !terminal && !(detail.reviewFlag && !detail.reviewFlag.version) && (
        <Button variant="outline" icon="flag" onClick={() => openDialog("flag")}>{detail.reviewFlag ? "Update flag" : "Flag for review"}</Button>
      )}
      <Button variant="outline" icon="share-2" onClick={() => void shareJob()}>Share</Button>
      {detail.status === "Pending Approval" && (
        <Button icon="file-check-2" onClick={() => navigate(`/documents/review?jobId=${encodeURIComponent(detail.id)}&ref=${encodeURIComponent(detail.jobNumber)}`)}>
          {review && review.counts.pending ? `Review documents (${review.counts.pending} left)` : "Review documents"}
        </Button>
      )}
      {detail.status === "Assigned" && <Button icon="truck" disabled={!canOps || !detail.adminActions.canMarkInTransit} onClick={() => openDialog("transit")}>Mark In Transit</Button>}
      {detail.status === "In Transit" && <Button icon="circle-check" disabled={!canOps} onClick={() => openDialog("deliver")}>Mark Delivered</Button>}
      {!terminal && detail.status !== "Delivered" && <Button variant="danger" icon="ban" disabled={busy} onClick={() => openDialog("cancel")}>Cancel job</Button>}
    </>
  );

  // ---------- tabs ----------

  const counts = detail.tripCounts;
  const bidsCount = bids === null ? DASH : bids.length;
  const tripsCount = detail.trips === null ? DASH : detail.trips.length;
  const activityCount = detail.activity.length;

  const filteredActivity = activityFilter === "All Activities" ? detail.activity : detail.activity.filter((a) => a.action === activityFilter);
  const pagedActivity = filteredActivity.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);
  const activityActions = [...new Set(detail.activity.map((a) => a.action))];

  const funding = (detail.transactions ?? []).find((t) => t.type === "ESCROW_LOCK" && t.statusCode === "COMPLETED");
  const payoutDone = detail.finalPayoutStatus === "Paid" || detail.finalPayoutStatus === "Completed";
  const paySteps = [
    { title: "Forwarder payment received", note: funding ? `${naira(funding.amount)} · ${funding.date}` : DASH, done: Boolean(funding) },
    { title: "Platform fee allocated", note: naira(detail.platformFee), done: false },
    { title: "Trucking company payout", note: detail.finalPayoutStatus ? `${naira(detail.agreedPrice)} · ${detail.finalPayoutStatus}` : DASH, done: payoutDone },
  ];

  const bidAmounts = bids?.map((b) => b.amount).filter((a): a is number => a !== null) ?? [];
  const bidsKnown = bids !== null && bidAmounts.length === bids.length;

  const trackingUpdates = tripState.data ? tripState.data.updates : detail.milestones;
  const trackedTrip = tripState.data?.trip ?? selectedTrip;

  const confirmTitle = { cancel: "Cancel Job", deliver: "Mark Job Delivered", transit: "Mark In Transit", flag: "Flag for Review", edit: "Edit Job" };

  return (
    <div className="jd-detail-page">
      <PageHeader
        crumbs={["Jobs & Trips", "Jobs", detail.jobNumber]}
        title={detail.jobNumber}
        meta={<Badge tone={statusTone(detail.status)} dot>{detail.status}</Badge>}
        description={`Created on ${detail.createdAt} • Last updated ${detail.updatedAt}`}
        actions={headerActions}
      />

      {toast && <ToastRelay message={toast.title} tone={toast.tone} onShown={() => setToast(null)}><Banner tone={toast.tone} title={toast.title} /></ToastRelay>}
      {detail.warnings.length > 0 && (
        <Banner tone="warning" title={`Unable to load: ${detail.warnings.join(", ")}.`} action={<Button size="sm" variant="outline" onClick={() => navigate(`/jobs/${encodeURIComponent(detail.id)}`)}>Retry</Button>} />
      )}
      {terminal && (
        <Banner tone={detail.status === "Rejected" ? "danger" : "warning"} title={detail.status === "Rejected" ? "This job was rejected." : "This job was cancelled."}>
          {detail.status === "Rejected" ? "This job was rejected and will not be published for bidding." : "This job has been cancelled and is no longer active."}
          {detail.status === "Cancelled" && extras.cancellation && <CancellationNote cancellation={extras.cancellation} />}
        </Banner>
      )}

      <section className="jd-hero" aria-label="Job summary">
        <div className="jd-hero-route">
          <span className="jd-hero-eyebrow">{extras.requestType}{detail.forwarder !== DASH ? " · " + detail.forwarder : ""}</span>
          <RouteStack from={detail.origin} to={detail.destination} wrap />
        </div>
        <dl className="jd-hero-stats">
          <div><dt>Job value</dt><dd>{naira(detail.jobValue)}</dd></div>
          <div><dt>Agreed price</dt><dd>{naira(detail.agreedPrice)}</dd></div>
          <div><dt>Trips</dt><dd>{detail.trips === null ? DASH : `${show(detail.assignedTrips)} of ${show(counts.total)}`}</dd></div>
          <div><dt>Bids</dt><dd>{bidsCount}</dd></div>
          <div><dt>Trucking company</dt><dd>{detail.truckingCompany ?? "Not assigned"}</dd></div>
        </dl>
      </section>

      <JobProgress detail={detail} />

      <div className="jd-detail-nav">
        <Tabs
          value={tab}
          onChange={(value: string) => setTab(value as JobDetailTab)}
          items={[
            { value: "overview", label: "Overview" },
            { value: "bids", label: "Bids & Responses", count: bids?.length },
            { value: "trips", label: "Associated Trips", count: detail.trips?.length },
            { value: "tracking", label: "Tracking & Updates" },
            { value: "documents", label: "Documents", count: review?.counts.total },
            { value: "financials", label: "Financials" },
            { value: "activity", label: "Activity Log", count: activityCount },
          ]}
        />
      </div>

      {tab === "overview" && (
        <section className="jd-tab-stack">
          <TabHeading title="Overview" description="Job details, route and price at a glance." />
          <div className="jd-info-layout">
            <div className="jd-tab-stack">
              <SectionCard title="Job details" icon="package">
                <dl className="jd-info-facts">
                  <Fact label="Movement"><Badge tone="purple">{extras.requestType}</Badge></Fact>
                  <Fact label="Cargo kind">{extras.cargoKind}</Fact>
                  <Fact label="Trucks required">{extras.requiredTrucks}</Fact>
                  <Fact label="Customer / forwarder">{detail.contactPerson}</Fact>
                  <Fact label="Contact phone">{detail.contactPhone}</Fact>
                  <Fact label="Cargo details" wide>{detail.cargoDetails !== DASH ? detail.cargoDetails : detail.cargo}</Fact>
                  <Fact label="Total weight">{extras.totalWeight}</Fact>
                </dl>
                {detail.forwarderId && (
                  <button type="button" className="jd-text-link" onClick={() => navigate("/forwarders/detail?id=" + encodeURIComponent(detail.forwarderId ?? ""))}>
                    View customer profile <Icon name="arrow-up-right" size={13} />
                  </button>
                )}
                <div data-empty={extras.specialInstructions === DASH} className="jd-instructions">
                  <span className="jd-field-label">Special instructions</span>
                  <p>{extras.specialInstructions}</p>
                </div>
              </SectionCard>
              <SectionCard title="Route details" description="Pickup, delivery and schedule" icon="route">
                <div className="jd-route-stops">
                  <div className="jd-route-stop">
                    <span className="jd-stop-marker"><Icon name="circle-dot" size={18} /></span>
                    <div className="jd-stop-content">
                      <span className="jd-field-label">Pickup</span><h4>{detail.origin}</h4>
                      <span className="jd-stop-date"><Icon name="calendar" size={13} />{extras.pickupDate}</span>
                    </div>
                  </div>
                  <div className="jd-route-stop">
                    <span className="jd-stop-marker destination"><Icon name="map-pin" size={18} /></span>
                    <div className="jd-stop-content">
                      <span className="jd-field-label">Delivery</span><h4>{detail.destination}</h4>
                      <span className="jd-stop-date"><Icon name="calendar" size={13} />{extras.deliveryDate}</span>
                    </div>
                  </div>
                </div>
                <dl className="jd-route-facts">
                  <Fact label="Distance">{(detail.distanceKm ?? extras.estimatedDistanceKm) !== null ? `${detail.distanceKm ?? extras.estimatedDistanceKm} km` : null}</Fact>
                  <Fact label="Estimated duration">{extras.durationLabel}</Fact>
                  <Fact label="Container return address">{extras.returnAddress}</Fact>
                </dl>
              </SectionCard>
              <CargoSection extras={extras} description={detail.cargoDetails !== DASH ? detail.cargoDetails : detail.cargo} review={review} loadingDocs={false} />
              <PeopleSection extras={extras} forwarderName={detail.contactPerson} forwarderPhone={detail.contactPhone} truckingCompany={detail.truckingCompany} />
            </div>
            <aside className="jd-price-column jd-tab-stack">
              <SectionCard title="Price" action={<span className="jd-currency">NGN</span>}>
                <div className="jd-price-hero"><span className="jd-field-label">Job value</span><strong>{naira(detail.jobValue)}</strong></div>
                <div className="jd-price-hero"><span className="jd-field-label">Agreed price</span><strong>{naira(detail.agreedPrice)}</strong></div>
                <button type="button" className="jd-text-link" onClick={() => setTab("financials")}>View financial details <Icon name="arrow-right" size={13} /></button>
              </SectionCard>
              <ScheduleSection extras={extras} createdAt={detail.createdAt} updatedAt={detail.updatedAt} />
              <SectionCard title="Activity" icon="history" action={<button type="button" className="jd-inline-link" onClick={() => setTab("activity")}>View all <Icon name="arrow-up-right" size={12} aria-hidden="true" /></button>}>
                {detail.activity.length ? (
                  <div className="jd-overview-activity">
                    {detail.activity.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="jd-overview-event">
                        <span className="jd-event-icon"><Icon name="history" size={13} aria-hidden="true" /></span>
                        <div><strong>{entry.action}</strong><p>{entry.details}</p><small>{entry.user} · {entry.time}</small></div>
                      </div>
                    ))}
                  </div>
                ) : <p className="jd-overview-empty">No activity yet.</p>}
              </SectionCard>
            </aside>
          </div>
        </section>
      )}

      {tab === "bids" && (
        <section className="jd-tab-stack">
          <TabHeading title="Bids & responses" description="Review trucking company quotes and responses." />
          <InfoStrip items={[
            { label: "Bids received", value: bidsCount },
            { label: "Lowest bid", value: bidsKnown && bidAmounts.length ? naira(Math.min(...bidAmounts)) : DASH },
            { label: "Highest bid", value: bidsKnown && bidAmounts.length ? naira(Math.max(...bidAmounts)) : DASH },
            { label: "Average bid", value: bidsKnown && bidAmounts.length ? naira(bidAmounts.reduce((sum, a) => sum + a, 0) / bidAmounts.length) : DASH },
          ]} />
          <SectionCard
            title={`Bids Received (${bidsCount})`}
            description="Bids from trucking companies for this job."
            action={<Badge tone={detail.status === "Bidding" ? "purple" : "neutral"} dot>{detail.status === "Bidding" ? "Open until an offer is accepted" : "Bidding Closed"}</Badge>}
          >
            {bids === null ? (
              <Banner tone="warning" title="Bid data is unavailable. Refresh to try again." />
            ) : bids.length ? (
              <DataTable
                rows={bids}
                rowKey={(bid: JobBid) => bid.id}
                columns={[
                  { key: "i", header: "#", width: 30, render: (bid: JobBid) => bids.indexOf(bid) + 1 },
                  {
                    key: "company",
                    header: "Trucking Company",
                    render: (bid: JobBid) => (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={bid.company} size={30} />
                        <strong style={{ font: "600 13px/18px var(--tk-font-sans)", color: "var(--tk-ink-900)" }}>
                          {bid.company}
                          {bid.accepted && <Badge tone="success" style={{ marginLeft: 6 }}>Assigned</Badge>}
                        </strong>
                      </span>
                    ),
                  },
                  { key: "amount", header: "Amount (₦)", render: (bid: JobBid) => <strong style={{ color: "var(--tk-ink-900)" }}>{naira(bid.amount)}</strong> },
                  { key: "kind", header: "Type", render: (bid: JobBid) => (bid.isCounterOffer === null ? DASH : bid.isCounterOffer ? "Counter-offer" : "Bid") },
                  { key: "submitted", header: "Submitted", render: (bid: JobBid) => bid.submittedAt },
                  { key: "status", header: "Status", render: (bid: JobBid) => <Badge tone={bid.accepted ? "success" : "neutral"}>{bid.status}</Badge> },
                  {
                    key: "x",
                    header: "Actions",
                    render: (bid: JobBid) => bid.accepted ? <Badge tone="success">Assigned</Badge> : (
                      <span className="jd-row-actions">
                        <Button size="sm" variant="outline" disabled={detail.status !== "Bidding" || !canOps} onClick={() => { setReason(""); setBidDialog({ bid, decision: "accept" }); }}>Accept</Button>
                        {detail.status === "Bidding" && bid.statusCode === "PENDING" && bid.isCounterOffer === false && canOps && (
                          <Button size="sm" variant="outline" onClick={() => { setReason(""); setBidDialog({ bid, decision: "decline" }); }}>Decline</Button>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState icon="gavel" title="No bids yet" description="Trucking companies have not submitted any bids for this job." />
            )}
          </SectionCard>
        </section>
      )}

      {tab === "trips" && (
        <section className="jd-tab-stack">
          <TabHeading title="Trips" description="Truck assignments and the movements fulfilling this job." />
          <InfoStrip items={[
            { label: "Trucks Requested", value: show(counts.required) },
            { label: "Trips Created", value: `${show(detail.assignedTrips)} of ${show(counts.total)}` },
            { label: "Active Trips", value: show(counts.active) },
            { label: "Trips Delivered", value: show(counts.completed) },
          ]} />
          {counts.assigned !== null && counts.required !== null && counts.assigned < counts.required && (
            <Banner tone="warning" title={`${counts.required - counts.assigned} assignment${counts.required - counts.assigned === 1 ? "" : "s"} remaining`}>
              Every requested truck needs its own eligible driver from {detail.truckingCompany ?? "the same trucking company"} before dispatch is complete.
            </Banner>
          )}
          <SectionCard
            title={`Associated Trips (${tripsCount})`}
            description="Each trip represents one truck and one driver fulfilling this job."
            pad="none"
            action={<Button size="sm" icon="truck" onClick={() => navigate("/dispatch")}>Manage Assignments</Button>}
          >
            {detail.trips === null ? (
              <Banner tone="warning" title="Trip data is unavailable. Refresh to try again." />
            ) : detail.trips.length ? (
              <DataTable
                rows={detail.trips}
                rowKey={(trip: JobTrip) => trip.id}
                onRowClick={(trip: JobTrip) => { setSelectedTripId(trip.id); setTab("tracking"); }}
                coloredHeader
                columns={[
                  { key: "id", header: "Trip ID", render: (trip: JobTrip) => <strong className="jd-trip-id">{trip.id}</strong> },
                  {
                    key: "truck",
                    header: "Truck",
                    render: (trip: JobTrip) => trip.truckId ? (
                      <a className="jd-trip-link" onClick={(event) => { event.stopPropagation(); navigate("/fleet/detail?id=" + encodeURIComponent(trip.truckId ?? "")); }}>{trip.truckPlate}</a>
                    ) : trip.truckPlate,
                  },
                  {
                    key: "driver",
                    header: "Driver",
                    render: (trip: JobTrip) => (
                      <span className="jd-trip-person">
                        <Avatar name={trip.driverName ?? "Unassigned"} src={trip.driverAvatarUrl ?? undefined} size={26} />
                        <span><strong>{trip.driverName ?? "Unassigned"}</strong><small>{trip.driverPhone}</small></span>
                      </span>
                    ),
                  },
                  { key: "company", header: "Trucking Company", render: (trip: JobTrip) => (trip.truckingCompany !== DASH ? trip.truckingCompany : detail.truckingCompany ?? DASH) },
                  { key: "status", header: "Trip Status", render: (trip: JobTrip) => <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge> },
                  {
                    key: "progress",
                    header: "Progress",
                    render: (trip: JobTrip) => (
                      <span className="jd-trip-progress"><span><i style={{ width: `${Math.min(100, trip.progress ?? 0)}%` }} /></span><strong>{trip.progress === null ? DASH : `${trip.progress}%`}</strong></span>
                    ),
                  },
                  { key: "eta", header: "ETA", render: (trip: JobTrip) => (trip.eta !== DASH ? trip.eta : trip.deliveryDate) },
                  {
                    key: "actions",
                    header: "",
                    render: (trip: JobTrip) => canOps && (trip.canMarkAtDelivery || trip.canMarkDelayed) ? (
                      <span className="jd-row-actions" onClick={(event) => event.stopPropagation()}>
                        {trip.canMarkAtDelivery && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => markTripAtDeliveryAction({ tripId: trip.id, jobId: detail.id }), "Trip marked at delivery.")}>At delivery</Button>
                        )}
                        {trip.canMarkDelayed && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDelayReason(""); setDelayTrip(trip); }}>Mark delayed</Button>}
                      </span>
                    ) : null,
                  },
                ]}
              />
            ) : (
              <EmptyState icon="route" title="No trips assigned" description="Select a trucking company, then assign the required truck and driver pairs." action={<Button onClick={() => navigate("/dispatch")}>Open Dispatch Center</Button>} />
            )}
          </SectionCard>
        </section>
      )}

      {tab === "tracking" && (
        <section className="jd-tab-stack">
          <TabHeading title="Tracking & updates" description="Where the selected trip is and what has been recorded." />
          {trips.length > 0 && (
            <SectionCard title="Select Trip" description="Tracking and updates are recorded per truck movement.">
              <div className="jd-trip-selector">
                {trips.map((trip) => (
                  <button key={trip.id} type="button" className={trip.id === selectedId ? "active" : ""} onClick={() => setSelectedTripId(trip.id)}>
                    <Icon name="truck" size={16} />
                    <span><strong>{trip.containerNumber} · {trip.route}</strong><small>{trip.truckPlate} · {trip.driverName ?? "Unassigned"}</small></span>
                    <Badge dot tone={statusTone(trip.status)}>{trip.status}</Badge>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}
          {tripState.error && <Banner tone="danger" title={tripState.error} />}
          <SectionCard
            title="Live Tracking"
            description={trackedTrip?.live ? `Live location · Last updated ${trackedTrip.locationUpdatedAt}` : "No live position to display for this job's current status."}
            action={<Button size="sm" variant="outline" icon="refresh-cw" disabled={tripState.loading} onClick={() => setTrackingTick((n) => n + 1)}>{tripState.loading ? "Refreshing…" : "Refresh"}</Button>}
          >
            <div className="jd-route-stats">
              <span><span className="tk-meta">Distance Covered</span><strong>{trackedTrip && trackedTrip.coveredKm !== null && trackedTrip.distanceKm !== null ? `${trackedTrip.coveredKm} km / ${trackedTrip.distanceKm} km` : DASH}</strong></span>
              <span><span className="tk-meta">Current Speed</span><strong>{trackedTrip && trackedTrip.speedKmH !== null ? `${trackedTrip.speedKmH} km/h` : DASH}</strong></span>
              <span><span className="tk-meta">ETA</span><strong>{trackedTrip && trackedTrip.eta !== DASH ? trackedTrip.eta : extras.deliveryDate}</strong></span>
              <span><span className="tk-meta">Next Stop</span><strong>{detail.destination}</strong></span>
            </div>
            <div className="jd-map-frame">
              <JobDetailMap
                origin={detail.origin}
                destination={detail.destination}
                liveLocation={trackedTrip?.position ? { ...trackedTrip.position, title: [trackedTrip.truckPlate, trackedTrip.position.description, trackedTrip.position.updatedAt].filter((part) => part && part !== DASH).join(" · ") } : null}
                recordedRoute={tripState.data?.route ?? null}
                recordedRouteLoading={tripState.loading && !tripState.data}
                preferRecordedRoute
                locationCaption={trackedTrip?.position ? `${trackedTrip.live ? "Live" : "Last known position"} · ${trackedTrip.position.updatedAt}` : "No GPS position has been received yet."}
                ariaLabel="Job tracking map"
                zoomControl
              />
            </div>
          </SectionCard>
          <SectionCard title="Tracking Updates" pad="none">
            {trackingUpdates.length ? (
              <DataTable
                rows={trackingUpdates}
                rowKey={(_row: { time: string; status: string }, index: number) => index}
                columns={[
                  { key: "i", header: "#", width: 30, render: (row: { time: string; status: string }) => trackingUpdates.indexOf(row) + 1 },
                  { key: "time", header: "Date & Time" },
                  { key: "status", header: "Status", render: (row: { time: string; status: string }) => <Badge tone="info" dot>{row.status}</Badge> },
                ]}
              />
            ) : (
              <EmptyState icon="map-pin" title="No tracking updates yet" description="Updates will appear once the job is assigned and moving." />
            )}
          </SectionCard>
          {tripState.data && tripState.data.photos.length > 0 && (
            <SectionCard title="Photos & Proof">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {tripState.data.photos.map((photo, index) => (
                  <div key={index} className="jd-photo-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.label} referrerPolicy="no-referrer" style={{ width: "100%", height: 72, objectFit: "cover" }} />
                    <span className="tk-meta" style={{ fontSize: 10, textAlign: "center" }}>{photo.label}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </section>
      )}

      {tab === "documents" && (
        <JobContainerDocuments
          review={review}
          loading={false}
          error={reviewFailed ? ({ status: 0, message: "Documents couldn’t be loaded." } as ApiError) : null}
          onRetry={() => navigate(`/jobs/${encodeURIComponent(detail.id)}?tab=documents`)}
          jobRef={detail.jobNumber}
        />
      )}

      {tab === "financials" && (
        <section className="jd-tab-stack">
          <TabHeading title="Financials" description="Payments, costs and payouts for this job." />
          <InfoStrip items={[
            { label: "Job value", value: naira(detail.jobValue) },
            { label: "Platform fee", value: naira(detail.platformFee), caption: detail.platformFeePct === null ? DASH : `${detail.platformFeePct}%` },
            { label: "Agreed price", value: naira(detail.agreedPrice) },
          ]} />
          <div className="jd-finance-layout">
            <div className="jd-tab-stack">
              <SectionCard title="Transactions" pad="none">
                {detail.transactions === null ? (
                  <Banner tone="warning" title="Transactions are unavailable. Refresh to try again." />
                ) : detail.transactions.length ? (
                  <DataTable
                    rows={detail.transactions}
                    rowKey={(row: JobTransaction) => row.id}
                    columns={[
                      { key: "i", header: "#", width: 30, render: (row: JobTransaction) => (detail.transactions ?? []).indexOf(row) + 1 },
                      { key: "date", header: "Date & Time" },
                      { key: "description", header: "Description" },
                      {
                        key: "amount",
                        header: "Amount (₦)",
                        render: (row: JobTransaction) => (
                          <strong style={{ color: row.amount !== null && row.amount > 0 ? "var(--tk-success)" : row.amount !== null && row.amount < 0 ? "var(--tk-danger)" : "var(--tk-ink-900)" }}>
                            {row.amount === 0 ? "0" : naira(row.amount)}
                          </strong>
                        ),
                      },
                      { key: "status", header: "Status", render: (row: JobTransaction) => <Badge tone={row.status === "Completed" ? "success" : "warning"}>{row.status}</Badge> },
                      { key: "reference", header: "Reference", render: (row: JobTransaction) => <span className="tk-mono">{row.reference}</span> },
                    ]}
                  />
                ) : (
                  <EmptyState icon="wallet" title="No transactions yet" description="Payments for this job appear here once the forwarder funds it." />
                )}
              </SectionCard>
            </div>
            <aside className="jd-tab-stack">
              <SectionCard title="Payment status">
                <ol className="jd-pay-steps">
                  {paySteps.map((step) => (
                    <li key={step.title} className={step.done ? "is-done" : ""}>
                      <span>{step.done && <Icon name="check" size={12} />}</span>
                      <div><strong>{step.title}</strong><small>{step.note}</small></div>
                    </li>
                  ))}
                </ol>
              </SectionCard>
              <FeeBreakdown extras={extras} jobValue={detail.jobValue} agreedPrice={detail.agreedPrice} platformFee={detail.platformFee} platformFeePct={detail.platformFeePct} finalPayoutStatus={detail.finalPayoutStatus} />
            </aside>
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="jd-tab-stack">
          <TabHeading title="Activity log" description="A chronological record of changes and actions on this job." />
          <InfoStrip items={[
            { label: "Activities recorded", value: activityCount },
            { label: "People involved", value: show(detail.uniqueActivityUsers) },
            { label: "Most active", value: detail.mostActiveUser },
          ]} />
          <SectionCard
            title="Activity Log"
            description="A chronological record of all key activities and updates related to this job."
            pad="none"
            action={
              <>
                <span style={{ position: "relative" }}>
                  <FilterSelect label={activityFilter} active={activityFilter !== "All Activities"} onClick={() => setActivityMenu((open) => !open)} />
                  {activityMenu && (
                    <span style={{ position: "absolute", right: 0, top: 44, zIndex: "var(--tk-z-dropdown)" as unknown as number }}>
                      <DropdownMenu
                        width={200}
                        items={["All Activities", ...activityActions].map((name) => ({
                          label: name,
                          icon: name === activityFilter ? "check" : undefined,
                          onClick: () => { setActivityFilter(name); setActivityMenu(false); setLogPage(1); },
                        }))}
                      />
                    </span>
                  )}
                </span>
                <Button variant="outline" icon="download" onClick={exportActivity}>Export Log</Button>
              </>
            }
            footer={filteredActivity.length > LOG_PAGE_SIZE && (
              <Pagination
                page={logPage}
                pageSize={LOG_PAGE_SIZE}
                pageCount={Math.max(1, Math.ceil(filteredActivity.length / LOG_PAGE_SIZE))}
                total={filteredActivity.length}
                onPage={(next: number) => setLogPage(next)}
                onPageSize={() => {}}
                style={{ border: 0, padding: 0 }}
              />
            )}
          >
            {filteredActivity.length ? (
              <DataTable
                rows={pagedActivity}
                rowKey={(entry: ActivityEntry) => entry.id}
                columns={[
                  { key: "i", header: "#", width: 30, render: (entry: ActivityEntry) => filteredActivity.indexOf(entry) + 1 },
                  { key: "time", header: "Date & Time" },
                  {
                    key: "user",
                    header: "User",
                    render: (entry: ActivityEntry) => (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={entry.user} size={26} />
                        <span style={{ display: "grid", gap: 0 }}>
                          <strong style={{ font: "600 13px/18px var(--tk-font-sans)", color: "var(--tk-ink-900)" }}>{entry.user}</strong>
                          <span className="tk-meta">{entry.role}</span>
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "action",
                    header: "Action",
                    render: (entry: ActivityEntry) => (
                      <Badge tone={entry.action.includes("Reject") || entry.action.includes("Cancel") ? "danger" : entry.action.includes("Approv") || entry.action.includes("Confirm") ? "success" : "info"}>{entry.action}</Badge>
                    ),
                  },
                  { key: "details", header: "Details" },
                ]}
              />
            ) : (
              <EmptyState icon="history" title="No activity yet" description="Actions on this job will be listed here." />
            )}
          </SectionCard>
        </section>
      )}

      {/* cancel, deliver, in transit, flag, edit */}
      <Modal
        open={dialog !== null}
        onClose={() => { if (!busy) setDialog(null); }}
        title={dialog ? confirmTitle[dialog] : ""}
        description={detail.jobNumber}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setDialog(null)}>Close</Button>
          <Button variant={dialog === "cancel" ? "danger" : undefined} disabled={confirmDisabled} onClick={confirmDialog}>
            {busy ? "Saving…" : dialog === "cancel" ? "Cancel Job" : "Confirm"}
          </Button>
        </>}
      >
        {dialog === "cancel" && <Banner tone="warning" title="This cancels the job and holds escrow for review." />}
        {dialog === "deliver" && <Banner tone="warning" title="This completes the job and releases the trucker’s final payment." />}
        {dialog === "transit" && <p className="tk-meta">This confirms pickup and may release the mobilisation payment to the trucking company.</p>}
        {dialog === "flag" && (
          <Select label="Review reason" value={flagReason} onChange={(event: ChangeEvent<HTMLSelectElement>) => setFlagReason(event.target.value)} options={FLAG_REASONS} />
        )}
        {dialog === "edit" && (
          <div className="jd-form-grid">
            <p className="tk-meta">Enter only the fields you want to change. Route changes are unavailable while bids are pending and do not recalculate the price.</p>
            <TextField label="TDO date and time" type="datetime-local" value={editDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditDate(event.target.value)} />
            <TextField label="Cargo description" value={editCargo} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditCargo(event.target.value)} />
            <TextField label="Special instructions" value={editInstructions} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditInstructions(event.target.value)} />
            <TextField label="Pickup address (export)" value={editPickup} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditPickup(event.target.value)} />
            <TextField label="Delivery address" value={editDelivery} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditDelivery(event.target.value)} />
            <TextField label="Container return address" value={editReturn} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditReturn(event.target.value)} />
          </div>
        )}
        <div className="jd-form-grid">
          <TextField
            label={dialog === "deliver" ? "Note (optional)" : dialog === "flag" ? "Note" : "Reason"}
            required={dialog !== "deliver"}
            value={reason}
            maxLength={500}
            disabled={busy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value)}
            placeholder={dialog === "cancel" ? "Why is this job being cancelled?" : dialog === "deliver" ? "How was delivery confirmed?" : undefined}
          />
        </div>
      </Modal>

      {/* accept or decline a bid */}
      <Modal
        open={bidDialog !== null}
        onClose={() => { if (!busy) setBidDialog(null); }}
        title={bidDialog?.decision === "accept" ? "Accept Bid" : "Decline Bid"}
        description={bidDialog ? `${bidDialog.decision === "accept" ? "Accept" : "Decline"} ${bidDialog.bid.company}'s bid for ${detail.jobNumber}?` : ""}
        footer={bidDialog && (
          <>
            <Button variant="outline" disabled={busy} onClick={() => setBidDialog(null)}>Close</Button>
            <Button
              icon="check"
              disabled={
                busy || bidState.loading || !bidState.data
                || !(bidDialog.decision === "accept" ? bidState.data.canAccept : bidState.data.canDecline)
                || reasonTooShort || !canOps
              }
              onClick={() => {
                if (!bidState.data) return;
                const state = bidState.data;
                void run(() => decideBidAction({ decision: bidDialog.decision, bidId: bidDialog.bid.id, jobId: detail.id, expectedVersion: state.version, reason }), bidDialog.decision === "accept" ? "Bid accepted." : "Bid declined.");
              }}
            >
              {busy ? "Saving…" : bidDialog.decision === "accept" ? "Confirm Acceptance" : "Confirm Decline"}
            </Button>
          </>
        )}
      >
        {bidDialog && (
          <>
            <span className="tk-meta">
              {bidDialog.bid.company} bid {naira(bidDialog.bid.amount)}.{" "}
              {bidDialog.decision === "accept"
                ? "Accepting charges the forwarder's wallet for the agreed price, service fee and platform fee into escrow, and declines other pending bids."
                : "Declining does not move money."}
            </span>
            {bidState.error && <Banner tone="danger" title={bidState.error} />}
            {bidState.data && !(bidDialog.decision === "accept" ? bidState.data.canAccept : bidState.data.canDecline) && (
              <Banner tone="warning" title="This bid can no longer be changed. Refresh the job." />
            )}
            <div className="jd-form-grid">
              <TextField label="Reason" required maxLength={500} value={reason} onChange={(event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value)} />
            </div>
          </>
        )}
      </Modal>

      {/* mark a trip delayed */}
      <Modal
        open={delayTrip !== null}
        onClose={() => { if (!busy) setDelayTrip(null); }}
        title="Mark Delayed"
        description={delayTrip?.id}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setDelayTrip(null)}>Close</Button>
          <Button disabled={busy || !delayReason.trim()} onClick={() => { if (delayTrip) void run(() => markTripDelayedAction({ tripId: delayTrip.id, jobId: detail.id, reason: delayReason }), "Trip marked delayed."); }}>
            {busy ? "Saving…" : "Mark Delayed"}
          </Button>
        </>}
      >
        <span className="tk-meta">The forwarder and trucking company will be notified.</span>
        <div className="jd-form-grid">
          <TextField label="Reason" value={delayReason} maxLength={500} required disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => setDelayReason(event.target.value)} />
        </div>
      </Modal>
    </div>
  );
}