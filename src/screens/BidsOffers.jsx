import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  DonutChart,
  DropdownMenu,
  Icon,
  Modal,
  Pagination,
  SearchField,
  Sparkline,
  Tabs,
} from "../ds.js";
import "./Operations.css";

const initialBids = [
  [
    "JOB-29821",
    "Apapa Port → Ikeja Warehouse",
    "Goodwill Forwarding Ltd.",
    "5",
    "₦1,420,000",
    "—",
    "Pending Evaluation",
    "May 30, 2026",
    "09:42 AM",
  ],
  [
    "JOB-29820",
    "Tin Can Port → Onne Port",
    "CargoLink Logistics",
    "7",
    "₦2,180,000",
    "—",
    "Pending Evaluation",
    "May 30, 2026",
    "09:37 AM",
  ],
  [
    "JOB-29819",
    "Apapa Port → Ibeju Lekki → Ogun",
    "ABC Forwarders Ltd.",
    "4",
    "₦3,050,000",
    "₦3,120,000",
    "Bid Accepted",
    "May 30, 2026",
    "09:22 AM",
  ],
  [
    "JOB-29818",
    "Port Harcourt → Aba Depot",
    "DCL Shipping Services",
    "6",
    "₦930,000",
    "₦980,000",
    "In Transit",
    "May 30, 2026",
    "08:58 AM",
  ],
  [
    "JOB-29817",
    "Apapa Port → Ibadan Dry Port",
    "Nigerian Bulk Consortia",
    "8",
    "₦4,620,000",
    "₦4,860,000",
    "At Delivery",
    "May 30, 2026",
    "08:15 AM",
  ],
  [
    "JOB-29816",
    "Tin Can Port → Lagos Island",
    "Transglobal Logistics",
    "3",
    "₦1,180,000",
    "₦1,250,000",
    "Returning Container",
    "May 30, 2026",
    "07:48 AM",
  ],
  [
    "JOB-29815",
    "Ikeja Warehouse → Apapa Port",
    "Maersk Line Nigeria",
    "5",
    "₦1,650,000",
    "—",
    "Bidding",
    "May 30, 2026",
    "07:12 AM",
  ],
  [
    "JOB-29814",
    "Lagos Port → Multiple Sites (20)",
    "BuildMax Materials",
    "9",
    "₦8,900,000",
    "₦9,450,000",
    "Completed",
    "May 30, 2026",
    "05:32 AM",
  ],
  [
    "JOB-29811",
    "Apapa Port → Sango Ota",
    "Continental Freighters",
    "6",
    "₦1,340,000",
    "—",
    "Expired",
    "May 29, 2026",
    "06:10 PM",
  ],
  [
    "JOB-29810",
    "Tin Can Port → Ijebu Ode",
    "Westgate Shipping",
    "2",
    "₦2,010,000",
    "—",
    "Cancelled",
    "May 29, 2026",
    "03:25 PM",
  ],
].map((r) => ({
  id: r[0],
  route: r[1],
  customer: r[2],
  bids: r[3],
  low: r[4],
  win: r[5],
  status: r[6],
  date: r[7],
  time: r[8],
}));
const tones = {
  "Pending Evaluation": "warning",
  "Bid Accepted": "success",
  "In Transit": "info",
  "At Delivery": "orange",
  "Returning Container": "teal",
  Bidding: "purple",
  Completed: "success",
  Expired: "danger",
  Cancelled: "neutral",
};
const STATUSES = [
  "Pending Evaluation",
  "Bid Accepted",
  "In Transit",
  "At Delivery",
  "Returning Container",
  "Bidding",
  "Completed",
  "Expired",
  "Cancelled",
];
const TAB_FILTER = {
  "Bid Overview": null,
  "Awarded / Won": "Bid Accepted",
  Expired: "Expired",
  Cancelled: "Cancelled",
};
const DATE_RANGES = [
  "May 24 – May 30, 2026",
  "May 17 – May 23, 2026",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
];
const FUNNEL_DATA = [
  ["Jobs Published", 248, "#8d58e8"],
  ["Jobs with Bids", 186, "#5b79e5"],
  ["Bids Received", 762, "#74d1b1"],
  ["Bids Accepted", 136, "#ffa11e"],
  ["Jobs Completed", 94, "#ff676d"],
];
const FUNNEL_MAX = Math.max(...FUNNEL_DATA.map((x) => x[1]));

function Metric({
  label,
  value,
  delta,
  icon,
  color = "#4c16ac",
  down = false,
}) {
  return (
    <Card className="metric-card">
      <label>{label}</label>
      <strong>{value}</strong>
      <span className={"delta " + (down ? "down" : "")}>
        {down ? "↓" : "↑"} {delta}
      </span>
      <small>vs May 17 – May 23</small>
      <i className="metric-icon" style={{ color, background: color + "12" }}>
        <Icon name={icon} size={20} />
      </i>
      <Sparkline points={[2, 3, 3, 5, 4, 7]} color={color} />
    </Card>
  );
}

export function BidsOffers() {
  const navigate = useNavigate();
  const [bids, setBids] = useState(initialBids);
  const [offers, setOffers] = useState([
    {
      id: "JOB-29821",
      company: "TrukLine Logistics Ltd.",
      amount: "₦1,520,000",
      delta: "+₦80,000",
    },
    {
      id: "JOB-29820",
      company: "Prime Haulage Ltd.",
      amount: "₦2,250,000",
      delta: "+₦70,000",
    },
    {
      id: "JOB-29815",
      company: "SpeedWay Transport",
      amount: "₦1,720,000",
      delta: "+₦50,000",
    },
    {
      id: "JOB-29814",
      company: "HeavyDuty Logistics",
      amount: "₦9,650,000",
      delta: "+₦200,000",
    },
    {
      id: "JOB-29809",
      company: "Golden Trucking Co.",
      amount: "₦2,100,000",
      delta: "+₦60,000",
    },
  ]);
  const [tab, setTab] = useState("Bid Overview"),
    [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateRange, setDateRange] = useState(DATE_RANGES[0]);
  const [openFilter, setOpenFilter] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [offerModal, setOfferModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [tab, q, statusFilter]);

  function updateBidStatus(id, status, message) {
    setBids((bs) => bs.map((b) => (b.id === id ? { ...b, status } : b)));
    setMenuFor(null);
    setToast({
      tone:
        status === "Bid Accepted"
          ? "success"
          : status === "Cancelled"
            ? "danger"
            : "info",
      title: message || `${id} marked as ${status}`,
    });
  }
  function resolveOffer(offer, accept) {
    setOffers((os) =>
      os.filter((o) => o.id + o.company !== offer.id + offer.company),
    );
    if (accept)
      updateBidStatus(
        offer.id,
        "Bid Accepted",
        `Counter offer from ${offer.company} accepted for ${offer.id}.`,
      );
    else
      setToast({
        tone: "warning",
        title: `Counter offer from ${offer.company} declined.`,
      });
    setOfferModal(null);
  }

  const isCounterTab = tab === "Counter Offers";
  const filteredBids = useMemo(
    () =>
      bids.filter((b) => {
        const matchesQ =
          !q ||
          [b.id, b.customer, b.route].some((v) =>
            v.toLowerCase().includes(q.toLowerCase()),
          );
        const matchesTabStatus =
          !TAB_FILTER[tab] || b.status === TAB_FILTER[tab];
        const matchesStatus =
          statusFilter === "All Status" || b.status === statusFilter;
        return matchesQ && matchesTabStatus && matchesStatus;
      }),
    [bids, q, tab, statusFilter],
  );
  const filteredOffers = useMemo(
    () =>
      offers.filter(
        (o) =>
          !q ||
          [o.id, o.company].some((v) =>
            v.toLowerCase().includes(q.toLowerCase()),
          ),
      ),
    [offers, q],
  );

  const pageRows = isCounterTab ? filteredOffers : filteredBids;
  const pageCount = Math.max(1, Math.ceil(pageRows.length / 8));

  const cols = [
    {
      key: "id",
      header: "Job ID",
      render: (r) => <a onClick={() => navigate("/jobs/" + r.id)}>{r.id}</a>,
    },
    { key: "route", header: "Route" },
    { key: "customer", header: "Customer" },
    { key: "bids", header: "Bids" },
    { key: "low", header: "Lowest Bid (₦)" },
    { key: "win", header: "Winning Bid (₦)" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={tones[r.status]} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Created At",
      render: (r) => (
        <span className="cell-two">
          <strong>{r.date}</strong>
          <small>{r.time}</small>
        </span>
      ),
    },
    {
      key: "a",
      header: "Actions",
      render: (r) => (
        <span style={{ position: "relative" }}>
          <button
            className="row-actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuFor(menuFor === r.id ? null : r.id);
            }}
          >
            •••
          </button>
          {menuFor === r.id && (
            <span
              style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                width={200}
                items={[
                  {
                    label: "View Job",
                    icon: "eye",
                    onClick: () => {
                      setMenuFor(null);
                      navigate("/jobs/" + r.id);
                    },
                  },
                  { divider: true },
                  {
                    label: "Accept Bid",
                    icon: "circle-check",
                    onClick: () => updateBidStatus(r.id, "Bid Accepted"),
                  },
                  {
                    label: "Reject Bid",
                    icon: "circle-x",
                    tone: "danger",
                    onClick: () => updateBidStatus(r.id, "Cancelled"),
                  },
                  {
                    label: "Mark Pending Evaluation",
                    icon: "hourglass",
                    onClick: () => updateBidStatus(r.id, "Pending Evaluation"),
                  },
                ]}
              />
            </span>
          )}
        </span>
      ),
    },
  ];
  const offerCols = [
    {
      key: "id",
      header: "Job ID",
      render: (r) => <a onClick={() => navigate("/jobs/" + r.id)}>{r.id}</a>,
    },
    { key: "company", header: "Bidding Company" },
    { key: "amount", header: "Offer Amount (₦)" },
    {
      key: "delta",
      header: "Δ vs Lowest",
      render: (r) => (
        <span style={{ color: "var(--tk-success)" }}>{r.delta}</span>
      ),
    },
    {
      key: "a",
      header: "Actions",
      render: (r) => (
        <span style={{ display: "flex", gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolveOffer(r, true)}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => resolveOffer(r, false)}
          >
            Decline
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="operations-screen">
      <div className="screen-head">
        <div>
          <div className="tk-meta">Jobs & Trips　›　Bids & Offers</div>
          <h1>Bids & Offers</h1>
          <p>Manage all bid submissions and counter offers across Trukkas.</p>
        </div>
        <div className="head-actions">
          <span style={{ position: "relative" }}>
            <button
              className="date-button"
              onClick={() =>
                setOpenFilter(openFilter === "date" ? null : "date")
              }
            >
              <Icon name="calendar" size={15} />
              {dateRange}⌄
            </button>
            {openFilter === "date" && (
              <span
                style={{ position: "absolute", left: 0, top: 44, zIndex: 30 }}
              >
                <DropdownMenu
                  width={210}
                  items={DATE_RANGES.map((r) => ({
                    label: r,
                    icon: r === dateRange ? "check" : undefined,
                    onClick: () => {
                      setDateRange(r);
                      setOpenFilter(null);
                    },
                  }))}
                />
              </span>
            )}
          </span>
          <span style={{ position: "relative" }}>
            <Button
              variant="outline"
              icon="list-filter"
              onClick={() =>
                setOpenFilter(openFilter === "head" ? null : "head")
              }
            >
              Filters
            </Button>
            {openFilter === "head" && (
              <span
                style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }}
              >
                <DropdownMenu
                  width={200}
                  items={["All Status", ...STATUSES].map((s) => ({
                    label: s,
                    icon: s === statusFilter ? "check" : undefined,
                    onClick: () => {
                      setStatusFilter(s);
                      setOpenFilter(null);
                    },
                  }))}
                />
              </span>
            )}
          </span>
          <Button
            icon="download"
            onClick={() =>
              setToast({
                tone: "info",
                title: `Exporting ${pageRows.length} record(s)…`,
              })
            }
          >
            Export
          </Button>
        </div>
      </div>

      {toast && <Banner tone={toast.tone} title={toast.title} />}

      <div className="kpi-grid">
        <Metric
          label="Total Bids"
          value="762"
          delta="18.4%"
          icon="briefcase-business"
        />
        <Metric
          label="Pending Evaluation"
          value="42"
          delta="6.7%"
          icon="hand-coins"
          color="#f27602"
          down
        />
        <Metric
          label="Counter Offers"
          value={String(offers.length)}
          delta="12.1%"
          icon="users-round"
          color="#2469e8"
        />
        <Metric
          label="Accepted Bids"
          value={String(bids.filter((b) => b.status === "Bid Accepted").length)}
          delta="15.3%"
          icon="badge-check"
          color="#12a150"
        />
        <Metric
          label="Expired Offers"
          value={String(bids.filter((b) => b.status === "Expired").length)}
          delta="9.5%"
          icon="trophy"
          color="#e02b22"
          down
        />
        <Metric
          label="Avg. Winning Margin"
          value="7.8%"
          delta="2.6%"
          icon="badge-percent"
        />
      </div>

      <Tabs
        items={[
          "Bid Overview",
          "Counter Offers",
          "Awarded / Won",
          "Expired",
          "Cancelled",
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="bids-layout">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>{tab}</h3>
            </div>
            <span style={{ position: "relative" }}>
              <button
                className="date-button"
                onClick={() =>
                  setOpenFilter(openFilter === "panel" ? null : "panel")
                }
              >
                {statusFilter}⌄
              </button>
              {openFilter === "panel" && (
                <span
                  style={{ position: "absolute", left: 0, top: 40, zIndex: 30 }}
                >
                  <DropdownMenu
                    width={200}
                    items={["All Status", ...STATUSES].map((s) => ({
                      label: s,
                      icon: s === statusFilter ? "check" : undefined,
                      onClick: () => {
                        setStatusFilter(s);
                        setOpenFilter(null);
                      },
                    }))}
                  />
                </span>
              )}
            </span>
            <SearchField
              placeholder="Search by Job ID, Company, Truck, Driver..."
              style={{ width: 260 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {isCounterTab ? (
            <DataTable
              rows={filteredOffers.slice((page - 1) * 8, page * 8)}
              rowKey={(r) => r.id + r.company}
              columns={offerCols}
            />
          ) : filteredBids.length === 0 ? (
            <div
              style={{ padding: "40px 18px", textAlign: "center" }}
              className="tk-meta"
            >
              No bids match the current filters.
            </div>
          ) : (
            <DataTable
              rows={filteredBids.slice((page - 1) * 8, page * 8)}
              columns={cols}
            />
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            total={pageRows.length}
            onPage={setPage}
            onPageSize={() => {}}
          />
        </div>

        <div className="bid-rail">
          <div className="ops-panel">
            <div className="ops-panel-head">
              <div>
                <h3>Bid Analytics</h3>
              </div>
              <a onClick={() => setTab("Bid Overview")}>View Report</a>
            </div>
            <div className="bid-analytics">
              <DonutChart
                size={130}
                thickness={20}
                centerValue="762"
                centerLabel="Total Bids"
                data={[
                  { value: 320, color: "#4c16ac" },
                  { value: 236, color: "#2469e8" },
                  { value: 128, color: "#12a150" },
                  { value: 78, color: "#f27602" },
                ]}
              />
              <div>
                {[
                  ["#4c16ac", "Lowest Bids", "42% (320)"],
                  ["#2469e8", "Competing Bids", "31% (236)"],
                  ["#12a150", "Counter Offers", "17% (128)"],
                  ["#f27602", "Expired Offers", "10% (78)"],
                ].map((x) => (
                  <div className="bid-legend" key={x[1]}>
                    <span>
                      <i style={{ background: x[0] }} />
                      {x[1]}
                    </span>
                    <b>{x[2]}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel-head">
              <div>
                <h3>Recent Counter Offers</h3>
              </div>
              <a onClick={() => setTab("Counter Offers")}>View All</a>
            </div>
            {offers.length === 0 && (
              <div style={{ padding: "20px 14px" }} className="tk-meta">
                No open counter offers.
              </div>
            )}
            {offers.map((o, i) => (
              <div
                className="offer-row"
                key={o.id + o.company}
                onClick={() => setOfferModal(o)}
              >
                <i>
                  <Icon
                    name={i % 2 ? "gavel" : "briefcase-business"}
                    size={16}
                  />
                </i>
                <span>
                  <strong>{o.id}</strong>
                  <small>{o.company}</small>
                </span>
                <span className="amount">
                  <b>{o.amount}</b>
                  <em>{o.delta}</em>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom-bid-grid">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>
                Top Bidding Companies <small>(This Week)</small>
              </h3>
            </div>
          </div>
          {[
            ["TrukLine Logistics Ltd.", "48 Bids", "Won: 12", "Win Rate 25%"],
            ["Prime Haulage Ltd.", "42 Bids", "Won: 9", "Win Rate 21%"],
            ["SpeedWay Transport", "37 Bids", "Won: 8", "Win Rate 22%"],
            ["HeavyDuty Logistics", "34 Bids", "Won: 10", "Win Rate 29%"],
            ["Golden Trucking Co.", "28 Bids", "Won: 6", "Win Rate 21%"],
          ].map((x, i) => (
            <div className="rank-row" key={x[0]}>
              <b>{i + 1}</b>
              {x.map((v) => (
                <span key={v}>{v}</span>
              ))}
            </div>
          ))}
        </div>
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div>
              <h3>Bid Conversion Funnel</h3>
            </div>
            <a
              onClick={() =>
                setToast({
                  tone: "info",
                  title: "Full funnel report is not available in this preview.",
                })
              }
            >
              View Report
            </a>
          </div>
          <div className="funnel">
            {FUNNEL_DATA.map((x) => (
              <div className="funnel-row" key={x[0]}>
                <span>{x[0]}</span>
                <i
                  style={{
                    background: x[2],
                    width: Math.max(18, (x[1] / FUNNEL_MAX) * 100) + "%",
                  }}
                />
                <b>{x[1]}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={!!offerModal}
        onClose={() => setOfferModal(null)}
        title="Counter Offer"
        description={
          offerModal ? `${offerModal.company} · ${offerModal.id}` : ""
        }
        footer={
          offerModal && (
            <>
              <Button
                variant="outline"
                onClick={() => resolveOffer(offerModal, false)}
              >
                Decline
              </Button>
              <Button
                icon="check"
                onClick={() => resolveOffer(offerModal, true)}
              >
                Accept Offer
              </Button>
            </>
          )
        }
      >
        {offerModal && (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="trip-fact">
              <span>Offer Amount</span>
              <b>{offerModal.amount}</b>
            </div>
            <div className="trip-fact">
              <span>Δ vs Lowest Bid</span>
              <b style={{ color: "var(--tk-success)" }}>{offerModal.delta}</b>
            </div>
            <span className="tk-meta">
              Accepting will mark this job's bid as accepted and notify the
              bidding company.
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
}
