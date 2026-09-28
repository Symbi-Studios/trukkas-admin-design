"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DonutChart,
  DropdownMenu,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  Pagination,
  SearchField,
  Skeleton,
  Tabs,
} from "../ds.js";
import {
  useGetAdminBidAnalyticsQuery,
  useGetAdminBidDetailQuery,
  useGetAdminBidsQuery,
} from "../store/features/bids/bidsApi.js";
import "./Operations.css";

const PAGE_SIZE = 8;
const STATUS_OPTIONS = [
  ["All Status", null],
  ["Pending", "PENDING"],
  ["Accepted", "ACCEPTED"],
  ["Rejected", "REJECTED"],
  ["Withdrawn", "WITHDRAWN"],
  ["Expired", "EXPIRED"],
];
const TAB_STATUS = {
  "Awarded / Won": "ACCEPTED",
  Expired: "EXPIRED",
  Cancelled: "WITHDRAWN",
};
const STATUS_TONES = {
  Pending: "warning",
  Accepted: "success",
  Rejected: "danger",
  Withdrawn: "neutral",
  Expired: "danger",
};
const DATE_RANGES = ["All Dates", "Last 7 Days", "Last 30 Days", "This Month"];

function isoStart(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.toISOString();
}

function isoEnd(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value.toISOString();
}

function dateParams(label) {
  if (label === "All Dates") return {};
  const now = new Date();
  const start = new Date(now);
  if (label === "Last 7 Days") start.setDate(now.getDate() - 6);
  if (label === "Last 30 Days") start.setDate(now.getDate() - 29);
  if (label === "This Month") start.setDate(1);
  return { dateFrom: isoStart(start), dateTo: isoEnd(now) };
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function money(value, currency = "NGN") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency", currency: currency || "NGN", maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₦${value.toLocaleString("en-NG")}`;
  }
}

function Metric({ label, value, icon, color = "#4c16ac", caption = "Rolling 7 days" }) {
  return (
    <Card className="metric-card">
      <label>{label}</label>
      <strong>{value}</strong>
      <small>{caption}</small>
      <i className="metric-icon" style={{ color, background: color + "12" }}>
        <Icon name={icon} size={20} />
      </i>
    </Card>
  );
}

function BidsLoading() {
  return (
    <div className="operations-screen" aria-busy="true">
      <Card><Skeleton width={220} height={28} /><div style={{ marginTop: 12 }}><Skeleton width={420} height={14} /></div></Card>
      <div className="kpi-grid">
        {Array.from({ length: 6 }, (_, index) => <Card className="metric-card" key={index}><Skeleton width="46%" height={12} /><div style={{ marginTop: 14 }}><Skeleton width={72} height={27} /></div></Card>)}
      </div>
      <Card><Skeleton height={300} /></Card>
    </div>
  );
}

function BidsTableLoading({ columns }) {
  const rows = Array.from({ length: 6 }, (_, index) => ({ id: `loading-${index}` }));
  const loadingColumns = columns.map((column, index) => ({
    ...column,
    render: () => <Skeleton width={index === 3 ? "76%" : "62%"} height={12} />,
  }));

  return (
    <div role="status" aria-label="Loading bids" aria-busy="true">
      <DataTable rows={rows} rowKey={(row) => row.id} columns={loadingColumns} />
      <span className="tk-meta" style={{ display: "block", padding: "0 16px 12px" }}>Loading bids…</span>
    </div>
  );
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function BidsOffers() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Bid Overview");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateRange, setDateRange] = useState("All Dates");
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedBidId, setSelectedBidId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);
  useEffect(() => {
    setPage(1);
  }, [tab, search, statusFilter, dateRange]);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const selectedStatus = STATUS_OPTIONS.find(([label]) => label === statusFilter)?.[1] || null;
  const status = TAB_STATUS[tab] || selectedStatus;
  const dates = dateParams(dateRange);
  const {
    currentData: bidsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminBidsQuery({ status, search, ...dates, page, limit: PAGE_SIZE }, {
    refetchOnMountOrArgChange: true,
  });
  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useGetAdminBidAnalyticsQuery(undefined, { refetchOnMountOrArgChange: true });
  const {
    currentData: selectedBid,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
    refetch: refetchDetail,
  } = useGetAdminBidDetailQuery(selectedBidId, { skip: !selectedBidId });

  const rows = bidsResponse?.rows || [];
  const isCounterTab = tab === "Counter Offers";
  const visibleRows = useMemo(
    () => isCounterTab ? rows.filter((bid) => bid.isCounterOffer) : rows,
    [isCounterTab, rows],
  );
  const counterOffers = rows.filter((bid) => bid.isCounterOffer);

  const funnelData = analytics ? [
    ["Jobs Published", analytics.funnel.jobsPublished, "#8d58e8"],
    ["Jobs with Bids", analytics.funnel.jobsWithBids, "#5b79e5"],
    ["Bids Received", analytics.funnel.bidsReceived, "#74d1b1"],
    ["Bids Accepted", analytics.funnel.bidsAccepted, "#ffa11e"],
    ["Jobs Completed", analytics.funnel.jobsCompleted, "#ff676d"],
  ] : [];
  const funnelMax = Math.max(1, ...funnelData.map((item) => item[1]));
  const otherBids = analytics
    ? Math.max(0, analytics.totalBids - analytics.pendingBids - analytics.acceptedBids - analytics.expiredBids)
    : 0;

  function exportRows() {
    if (!visibleRows.length) return;
    const data = [
      ["Bid ID", "Job", "Route", "Trucking Company", "Amount", "Counter Offer", "Status", "Submitted", "Expires", "Responded"],
      ...visibleRows.map((bid) => [
        bid.id, bid.jobNumber, bid.route, bid.truckerName, bid.amount,
        bid.isCounterOffer ? "Yes" : "No", bid.status, bid.createdAt, bid.expiresAt, bid.respondedAt,
      ]),
    ];
    const csv = data.map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `trukkas-bids-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast({ tone: "success", title: `${visibleRows.length} bid${visibleRows.length === 1 ? "" : "s"} exported.` });
  }

  const columns = [
    {
      key: "id", header: "Bid ID", width: 120,
      render: (bid) => <a style={{ cursor: "pointer" }} onClick={() => setSelectedBidId(bid.id)}>{bid.id}</a>,
    },
    {
      key: "job", header: "Job", width: 130,
      render: (bid) => bid.jobId ? (
        <a onClick={(event) => { event.stopPropagation(); navigate(`/jobs/detail?id=${encodeURIComponent(bid.jobId)}`); }}>{bid.jobNumber || bid.jobId}</a>
      ) : bid.jobNumber || "—",
    },
    { key: "route", header: "Route", render: (bid) => bid.route || "—", width: 180 },
    {
      key: "company", header: "Trucking Company",
      render: (bid) => (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={bid.truckerName} size={30} />
          <span className="cell-two"><strong>{bid.truckerName}</strong><small>{bid.truckerRating == null ? "Rating unavailable" : `${bid.truckerRating} rating`}{bid.truckerTrips == null ? "" : ` · ${bid.truckerTrips} trips`}</small></span>
        </span>
      ),
    },
    { key: "amount", header: "Bid Amount", render: (bid) => <strong>{money(bid.amount, bid.currency)}</strong> },
    { key: "offer", header: "Offer Type", render: (bid) => bid.isCounterOffer ? <Badge tone="info">Counter Offer</Badge> : "Initial Bid" },
    { key: "status", header: "Status", render: (bid) => <Badge tone={STATUS_TONES[bid.status] || "neutral"} dot>{bid.status}</Badge> },
    { key: "created", header: "Submitted", render: (bid) => dateTime(bid.createdAt), width: 145 },
  ];

  if (!bidsResponse && isLoading && !analytics) return <BidsLoading />;

  return (
    <div className="operations-screen">
      <PageHeader
        crumbs={["Jobs & Trips", "Bids & Offers"]}
        title="Bids & Offers"
        description="Manage all bid submissions and counter offers across Trukkas."
        actions={(
          <>
            <span style={{ position: "relative" }}>
              <button className="date-button" onClick={() => setOpenFilter(openFilter === "date" ? null : "date")}>
                <Icon name="calendar" size={15} />{dateRange}⌄
              </button>
              {openFilter === "date" && (
                <span style={{ position: "absolute", left: 0, top: 44, zIndex: 30 }}>
                  <DropdownMenu width={210} items={DATE_RANGES.map((range) => ({ label: range, icon: range === dateRange ? "check" : undefined, onClick: () => { setDateRange(range); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <Button icon="download" disabled={!visibleRows.length} onClick={exportRows}>Export</Button>
          </>
        )}
      />

      {toast && <Banner tone={toast.tone} title={toast.title} />}
      {isFetching && bidsResponse && <Banner tone="info" title="Refreshing bids…" />}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Banner tone="danger" title="Unable to load bids from the API." />
          <Button variant="outline" icon="rotate-cw" onClick={refetch}>Retry</Button>
        </div>
      )}
      {analyticsError && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Banner tone="warning" title="Bid analytics are temporarily unavailable." />
          <Button variant="outline" icon="rotate-cw" onClick={refetchAnalytics}>Retry analytics</Button>
        </div>
      )}

      <div className="kpi-grid">
        <Metric label="Total Bids" value={analyticsLoading ? "…" : analytics?.totalBids?.toLocaleString() ?? "—"} icon="briefcase-business" />
        <Metric label="Pending Evaluation" value={analyticsLoading ? "…" : analytics?.pendingBids?.toLocaleString() ?? "—"} icon="hand-coins" color="#f27602" />
        <Metric label="Counter Offers" value={analyticsLoading ? "…" : analytics?.counterOffers?.toLocaleString() ?? "—"} icon="users-round" color="#2469e8" />
        <Metric label="Accepted Bids" value={analyticsLoading ? "…" : analytics?.acceptedBids?.toLocaleString() ?? "—"} icon="badge-check" color="#12a150" />
        <Metric label="Expired Offers" value={analyticsLoading ? "…" : analytics?.expiredBids?.toLocaleString() ?? "—"} icon="clock" color="#e02b22" />
        <Metric label="Avg. Winning Margin" value="—" caption="Not reported by API" icon="badge-percent" />
      </div>

      <Tabs
        items={["Bid Overview", "Counter Offers", "Awarded / Won", "Expired", "Cancelled"]}
        value={tab}
        onChange={(value) => {
          if (value === "Counter Offers" && status == null && page === 1) refetch();
          setTab(value);
          setStatusFilter("All Status");
        }}
      />

      <div className="bids-layout">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div><h3>{tab}</h3></div>
            <span style={{ position: "relative" }}>
              <button className="date-button" onClick={() => setOpenFilter(openFilter === "status" ? null : "status")}>{statusFilter}⌄</button>
              {openFilter === "status" && (
                <span style={{ position: "absolute", left: 0, top: 40, zIndex: 30 }}>
                  <DropdownMenu width={190} items={STATUS_OPTIONS.map(([label]) => ({ label, icon: label === statusFilter ? "check" : undefined, onClick: () => { setStatusFilter(label); setOpenFilter(null); } }))} />
                </span>
              )}
            </span>
            <SearchField placeholder="Search job number or trucking company..." style={{ width: 280 }} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          {isFetching ? (
            <BidsTableLoading columns={columns} />
          ) : !error && visibleRows.length === 0 ? (
            <EmptyState icon="gavel" title="No bids match these filters" description="Try another status, date range, or search term." />
          ) : (
            <DataTable rows={visibleRows} rowKey={(bid) => bid.id} columns={columns} onRowClick={(bid) => setSelectedBidId(bid.id)} />
          )}
          <Pagination
            page={bidsResponse?.pagination.page || page}
            pageCount={Math.max(1, bidsResponse?.pagination.totalPages || 1)}
            pageSize={bidsResponse?.pagination.limit || PAGE_SIZE}
            total={isCounterTab ? undefined : bidsResponse?.pagination.total ?? 0}
            onPage={(next) => setPage(Math.min(Math.max(1, next), Math.max(1, bidsResponse?.pagination.totalPages || 1)))}
          />
        </div>

        <div className="bid-rail">
          <div className="ops-panel">
            <div className="ops-panel-head"><div><h3>Bid Analytics</h3></div></div>
            <div className="bid-analytics">
              <DonutChart
                size={130}
                thickness={20}
                centerValue={analytics?.totalBids ?? "—"}
                centerLabel="Total Bids"
                data={[
                  { value: analytics?.pendingBids || 0, color: "#f27602" },
                  { value: analytics?.acceptedBids || 0, color: "#12a150" },
                  { value: analytics?.expiredBids || 0, color: "#e02b22" },
                  { value: otherBids, color: "#8d58e8" },
                ]}
              />
              <div>
                {[
                  ["#f27602", "Pending", analytics?.pendingBids],
                  ["#12a150", "Accepted", analytics?.acceptedBids],
                  ["#e02b22", "Expired", analytics?.expiredBids],
                  ["#8d58e8", "Other", otherBids],
                ].map(([color, label, value]) => (
                  <div className="bid-legend" key={label}><span><i style={{ background: color }} />{label}</span><b>{value ?? "—"}</b></div>
                ))}
              </div>
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel-head"><div><h3>Counter Offers on This Page</h3></div><a onClick={() => setTab("Counter Offers")}>View All</a></div>
            {counterOffers.length === 0 && <div style={{ padding: "20px 14px" }} className="tk-meta">No counter offers on the loaded page.</div>}
            {counterOffers.slice(0, 5).map((bid) => (
              <div className="offer-row" key={bid.id} onClick={() => setSelectedBidId(bid.id)}>
                <i><Icon name="gavel" size={16} /></i>
                <span><strong>{bid.jobNumber || bid.id}</strong><small>{bid.truckerName}</small></span>
                <span className="amount"><b>{money(bid.amount, bid.currency)}</b><em>{bid.status}</em></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom-bid-grid">
        <div className="ops-panel">
          <div className="ops-panel-head"><div><h3>Top Bidding Companies <small>(Rolling 7 Days)</small></h3></div></div>
          {analytics?.topCompanies.length ? analytics.topCompanies.map((company, index) => (
            <div className="rank-row" key={company.id}>
              <b>{index + 1}</b><span>{company.name}</span><span>{company.totalBids} Bids</span><span>Won: {company.won}</span><span>Win Rate {company.winRate}%</span>
            </div>
          )) : <div style={{ padding: "20px 14px" }} className="tk-meta">No company analytics available.</div>}
        </div>
        <div className="ops-panel">
          <div className="ops-panel-head"><div><h3>Bid Conversion Funnel</h3></div></div>
          <div className="funnel">
            {funnelData.map(([label, value, color]) => (
              <div className="funnel-row" key={label}><span>{label}</span><i style={{ background: color, width: Math.max(18, (value / funnelMax) * 100) + "%" }} /><b>{value}</b></div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={!!selectedBidId}
        onClose={() => setSelectedBidId(null)}
        title={selectedBid?.id || "Bid Details"}
        description={selectedBid ? `${selectedBid.truckerName} · ${selectedBid.jobNumber || selectedBid.jobId || "Job unavailable"}` : "Loading bid details…"}
      >
        {(detailLoading || detailFetching) && !selectedBid ? (
          <div role="status" className="tk-meta" style={{ padding: 24, textAlign: "center" }}>Loading bid details…</div>
        ) : detailError ? (
          <div style={{ display: "grid", justifyItems: "center", gap: 12, padding: 24 }}>
            <Banner tone="danger" title="Unable to load bid details." />
            <Button variant="outline" icon="rotate-cw" onClick={refetchDetail}>Retry</Button>
          </div>
        ) : selectedBid ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="trip-fact"><span>Status</span><b><Badge tone={STATUS_TONES[selectedBid.status] || "neutral"}>{selectedBid.status}</Badge></b></div>
            <div className="trip-fact"><span>Bid Amount</span><b>{money(selectedBid.amount, selectedBid.currency)}</b></div>
            <div className="trip-fact"><span>Offer Type</span><b>{selectedBid.isCounterOffer ? "Counter Offer" : "Initial Bid"}</b></div>
            <div className="trip-fact"><span>Route</span><b>{selectedBid.route || "—"}</b></div>
            <div className="trip-fact"><span>Submitted</span><b>{dateTime(selectedBid.createdAt)}</b></div>
            <div className="trip-fact"><span>Expires</span><b>{dateTime(selectedBid.expiresAt)}</b></div>
            <div className="trip-fact"><span>Responded</span><b>{dateTime(selectedBid.respondedAt)}</b></div>
            <div className="trip-fact"><span>Estimated Delivery</span><b>{dateTime(selectedBid.estimatedDeliveryDate)}</b></div>
            <div className="trip-fact"><span>Message</span><b>{selectedBid.message || "—"}</b></div>
            {selectedBid.jobId && <Button variant="outline" onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(selectedBid.jobId)}`)}>View Job Details</Button>}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
