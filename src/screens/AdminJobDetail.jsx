"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  PageHeader,
  SectionCard,
  Skeleton,
  Tabs,
  Timeline,
} from "../ds.js";
import { useGetAdminBidsQuery, useGetAdminJobDetailQuery } from "../store/features/jobs/jobsApi.js";
import { statusTone } from "./JobDetail.jsx";
import "./JobDetail.css";

const TABS = [
  "Overview",
  "Bids & Responses",
  "Associated Trips",
  "Tracking & Updates",
  "Documents",
  "Financials",
  "Activity Log",
];

function shown(value) {
  return value == null || value === "" ? "—" : value;
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function amount(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(value)
    : "—";
}

function bidStatusTone(status) {
  if (status === "Accepted") return "success";
  if (status === "Pending") return "warning";
  if (status === "Rejected") return "danger";
  if (status === "Expired") return "neutral";
  return "neutral";
}

function percent(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}%` : "—";
}

function safeDocumentUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function Fact({ label, value }) {
  return (
    <div className="jd-fact">
      <span className="tk-meta">{label}</span>
      <strong>{shown(value)}</strong>
    </div>
  );
}

function PersonCard({ title, person }) {
  return (
    <SectionCard title={title}>
      <div className="jd-facts">
        <Fact label="Name" value={person?.name} />
        <Fact label="Email" value={person?.email} />
        <Fact label="Phone" value={person?.phone} />
      </div>
    </SectionCard>
  );
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

export function AdminJobDetail() {
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() || "";
  const [tab, setTab] = useState("Overview");
  const [bidsPage, setBidsPage] = useState(1);
  const { currentData: job, isLoading, isFetching, error, refetch } = useGetAdminJobDetailQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const {
    currentData: bidsResponse,
    isLoading: bidsLoading,
    isFetching: bidsFetching,
    error: bidsError,
    refetch: refetchBids,
  } = useGetAdminBidsQuery({ jobId: id, page: bidsPage, limit: 20 }, {
    skip: !id || tab !== "Bids & Responses",
    refetchOnMountOrArgChange: true,
  });

  if (!id) {
    return <Card><EmptyState icon="package" title="Job ID missing" description="Open a job from the Jobs page to view its details." action={<Button onClick={() => navigate("/jobs")}>Back to Jobs</Button>} /></Card>;
  }
  if (isLoading || (isFetching && !job)) return <LoadingDetail />;
  if (error || !job) {
    const status = error?.status === "PARSING_ERROR" ? error.originalStatus : error?.status;
    const title = status === 404 ? "Job not found" : status === 403 ? "Access denied" : "Unable to load job details";
    return (
      <Card>
        <EmptyState icon="package" title={title} description={status === 403 ? "Your account cannot view this job." : "The job details are unavailable right now."} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button variant="outline" onClick={() => navigate("/jobs")}>Back to Jobs</Button>
          {status !== 403 && status !== 404 && <Button onClick={refetch}>Retry</Button>}
        </div>
      </Card>
    );
  }

  const timeline = job.timeline.map((event) => ({
    title: event.title,
    time: dateTime(event.timestamp),
    state: event.completed ? "done" : "pending",
    icon: event.completed ? "check" : undefined,
  }));
  const documentCount = job.documents.filter((document) => document.url).length;
  const overview = tab === "Overview";

  return (
    <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
      <PageHeader
        crumbs={["Jobs & Trips", "Jobs", job.displayId]}
        title={job.displayId}
        meta={<Badge tone={statusTone(job.status)} dot>{job.status}</Badge>}
        description={`Job ID ${job.id}`}
        actions={<Button variant="outline" icon="arrow-left" onClick={() => navigate("/jobs")}>Back to Jobs</Button>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((value) => ({
          value, label: value,
          ...(value === "Bids & Responses" && bidsResponse
            ? { count: bidsResponse.pagination.total }
            : {}),
          ...(value === "Documents" ? { count: documentCount } : {}),
        }))}
      />

      {overview && (
        <div className="jd-layout">
          <div className="jd-main">
            <SectionCard title="Job Information">
              <div className="jd-facts">
                <Fact label="Job ID" value={job.displayId} />
                <Fact label="Status" value={job.status} />
                <Fact label="TDO Date" value={dateTime(job.tdoDate)} />
                <Fact label="Free Days" value={job.freeDays} />
                <Fact label="Container Return Address" value={job.containerReturnAddress} />
              </div>
            </SectionCard>
            <SectionCard title="Route Details">
              <div className="jd-route-points">
                <div className="jd-route-point">
                  <span className="jd-route-dot" style={{ background: "var(--tk-blue)" }} />
                  <div><strong>{shown(job.pickup?.address)}</strong><span className="tk-meta">Pickup · {shown(job.pickup?.port)} · {shown(job.pickup?.terminal)}</span></div>
                </div>
                <div className="jd-route-line" />
                <div className="jd-route-point">
                  <span className="jd-route-dot" style={{ background: "var(--tk-danger)" }} />
                  <div><strong>{shown(job.delivery?.address)}</strong><span className="tk-meta">Delivery</span></div>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Container & Cargo">
              {job.containers.length ? (
                <div style={{ display: "grid", gap: 20 }}>
                  {job.containers.map((container, index) => (
                    <div key={container.id || container.number || index} style={{ display: "grid", gap: 12 }}>
                      {job.containers.length > 1 && <strong>Container {index + 1}</strong>}
                      <div className="jd-facts">
                        <Fact label="Container Number" value={container.number} />
                        <Fact label="Type" value={container.type} />
                        <Fact label="Size" value={container.size} />
                        <Fact label="Cargo Weight" value={container.cargoWeight} />
                        <Fact label="Cargo Contents" value={container.cargoContents} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <span className="tk-meta">No container information available.</span>}
            </SectionCard>
            <PersonCard title="Forwarder" person={job.forwarder} />
            <PersonCard title="Trucking Company" person={job.trucker} />
          </div>
          <div className="jd-rail">
            <SectionCard title="Status">
              <Badge tone={statusTone(job.status)} dot>{job.status}</Badge>
            </SectionCard>
            <SectionCard title="Driver & Vehicle">
              <div className="jd-facts">
                <Fact label="Driver" value={job.driver?.name} />
                <Fact label="Phone" value={job.driver?.phone} />
                <Fact label="Truck Plate" value={job.vehicle?.plateNumber} />
                <Fact label="Vehicle" value={[job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ")} />
              </div>
            </SectionCard>
            <SectionCard title="Financial Summary">
              <div className="jd-finance-rows">
                <div><span>Agreed Price</span><strong>{amount(job.pricing?.agreedPrice)}</strong></div>
                <div><span>Platform Fee</span><strong>{amount(job.pricing?.platformFee)}</strong></div>
                <div><span>Trucker Payout</span><strong>{amount(job.pricing?.truckerPayout)}</strong></div>
              </div>
            </SectionCard>
            <SectionCard title={`Documents (${documentCount})`} action={<Button size="sm" variant="outline" onClick={() => setTab("Documents")}>View All</Button>}>
              <span className="tk-meta">Approval: {shown(job.documentApprovalStatus)}</span>
            </SectionCard>
            <SectionCard title="Recent Activity" action={<Button size="sm" variant="outline" onClick={() => setTab("Tracking & Updates")}>View All</Button>}>
              {timeline.length ? <Timeline items={timeline.slice(-3)} /> : <span className="tk-meta">No timeline available.</span>}
            </SectionCard>
          </div>
        </div>
      )}

      {tab === "Bids & Responses" && (
        <SectionCard
          title={`Bids Received (${bidsResponse?.pagination.total ?? "…"})`}
          description="Bids and responses submitted for this job."
        >
          {(bidsLoading || bidsFetching) && !bidsResponse ? (
            <div role="status" className="tk-meta" style={{ padding: 24, textAlign: "center" }}>Loading bids…</div>
          ) : bidsError ? (
            <div style={{ display: "grid", justifyItems: "center", gap: 12, padding: 24 }}>
              <Banner tone="danger" title="Unable to load bids for this job." />
              <Button variant="outline" icon="rotate-ccw" onClick={refetchBids}>Retry</Button>
            </div>
          ) : bidsResponse?.rows.length ? (
            <>
              {bidsFetching && <div role="status" className="tk-meta" style={{ padding: "0 16px 12px" }}>Refreshing bids…</div>}
              <DataTable
                rows={bidsResponse.rows}
                rowKey={(bid) => bid.id}
                columns={[
                  {
                    key: "company",
                    header: "Trucking Company",
                    render: (bid) => (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar name={bid.truckerName} size={30} />
                        <span style={{ display: "grid", gap: 2 }}>
                          <strong>{bid.truckerName}</strong>
                          <small className="tk-meta">{bid.truckerRating == null ? "Rating unavailable" : `${bid.truckerRating} rating`}{bid.truckerTrips == null ? "" : ` · ${bid.truckerTrips} trips`}</small>
                        </span>
                      </span>
                    ),
                  },
                  { key: "amount", header: "Bid Amount", render: (bid) => <strong>{amount(bid.amount)}</strong> },
                  { key: "offer", header: "Offer Type", render: (bid) => bid.isCounterOffer ? "Counter offer" : "Initial offer" },
                  { key: "created", header: "Submitted", render: (bid) => dateTime(bid.createdAt) },
                  { key: "expires", header: "Expires", render: (bid) => dateTime(bid.expiresAt) },
                  { key: "status", header: "Status", render: (bid) => <Badge tone={bidStatusTone(bid.status)}>{bid.status}</Badge> },
                  { key: "responded", header: "Responded", render: (bid) => dateTime(bid.respondedAt) },
                ]}
              />
              <Pagination
                page={bidsResponse.pagination.page}
                pageCount={Math.max(1, bidsResponse.pagination.totalPages)}
                pageSize={bidsResponse.pagination.limit}
                total={bidsResponse.pagination.total}
                onPage={(next) => setBidsPage(Math.min(Math.max(1, next), Math.max(1, bidsResponse.pagination.totalPages)))}
              />
            </>
          ) : (
            <EmptyState icon="gavel" title="No bids for this job" description="Bids submitted for this job will appear here." />
          )}
        </SectionCard>
      )}
      {tab === "Associated Trips" && (
        <div className="jd-row2">
          <SectionCard title="Driver">
            <div className="jd-facts">
              <Fact label="Name" value={job.driver?.name} />
              <Fact label="Email" value={job.driver?.email} />
              <Fact label="Phone" value={job.driver?.phone} />
              <Fact label="Trust Score" value={job.driver?.trustScore} />
              <Fact label="License Number" value={job.driver?.license?.number} />
              <Fact label="License Expiry" value={dateTime(job.driver?.license?.expiresAt)} />
              {safeDocumentUrl(job.driver?.license?.url) && (
                <div className="jd-fact"><span className="tk-meta">License</span><strong><a href={safeDocumentUrl(job.driver.license.url)} target="_blank" rel="noopener noreferrer">View License</a></strong></div>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Vehicle">
            <div className="jd-facts">
              <Fact label="Plate" value={job.vehicle?.plateNumber} />
              <Fact label="Make" value={job.vehicle?.make} />
              <Fact label="Model" value={job.vehicle?.model} />
              <Fact label="Year" value={job.vehicle?.year} />
              <Fact label="Color" value={job.vehicle?.color} />
            </div>
          </SectionCard>
        </div>
      )}
      {tab === "Tracking & Updates" && <SectionCard title="Tracking Timeline">{timeline.length ? <Timeline items={timeline} /> : <EmptyState icon="route" title="No tracking timeline available" />}</SectionCard>}
      {tab === "Documents" && (
        <SectionCard title="Documents" description={`Approval status: ${shown(job.documentApprovalStatus)}`}>
          <div className="jd-finance-rows">
            {job.documents.map((document) => {
              const url = safeDocumentUrl(document.url);
              return <div key={document.key}><span>{document.label}</span><strong>{url ? <a href={url} target="_blank" rel="noopener noreferrer">View Document</a> : "Not available"}</strong></div>;
            })}
          </div>
          {job.documents.length === 0 && <span className="tk-meta">No document information available.</span>}
        </SectionCard>
      )}
      {tab === "Financials" && (
        <SectionCard title="Financial Summary">
          <div className="jd-finance-rows">
            <div><span>Agreed Price</span><strong>{amount(job.pricing?.agreedPrice)}</strong></div>
            <div><span>Platform Fee</span><strong>{amount(job.pricing?.platformFee)}</strong></div>
            <div><span>Commission</span><strong>{percent(job.pricing?.commissionPercent)}</strong></div>
            <div><span>Trucker Payout</span><strong>{amount(job.pricing?.truckerPayout)}</strong></div>
            <div><span>Mobilization Amount</span><strong>{amount(job.pricing?.mobilizationAmount)}</strong></div>
            <div><span>Mobilization Percent</span><strong>{percent(job.pricing?.mobilizationPercent)}</strong></div>
            <div><span>Mobilization Paid</span><strong>{shown(job.pricing?.mobilizationPaid)}</strong></div>
            <div><span>Final Payout Status</span><strong>{shown(job.pricing?.finalPayoutStatus)}</strong></div>
          </div>
        </SectionCard>
      )}
      {tab === "Activity Log" && <SectionCard title="Activity Log"><EmptyState icon="clock" title="Activity log unavailable" description="The job response provides milestone events but no audit log with actors or detailed changes." /></SectionCard>}
    </div>
  );
}
