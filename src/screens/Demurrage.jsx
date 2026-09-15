"use client";
import { useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Tabs,
  SearchField,
  DataTable,
  DonutChart,
  LegendList,
  Pagination,
  Badge,
  Icon,
  Modal,
  TextField,
  Select,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { createDemurrage } from "../mock/api.js";
const PAGE_SIZE = 8;
const STATUS_TONE = {
  Active: "danger",
  Upcoming: "warning",
  Resolved: "success",
  Dispute: "purple",
};
const DEMURRAGE_SUMMARY = [
  { label: "Active", value: 72, display: "₦18.6M (72%)", color: "#f14b67" },
  { label: "Upcoming", value: 14, display: "₦7.3M (14%)", color: "#f2b400" },
  { label: "Resolved", value: 12, display: "₦32.3M (12%)", color: "#0da56a" },
  { label: "Disputes", value: 2, display: "₦2.2M (2%)", color: "#762ce8" },
];
const money = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
function exportCsv(rows) {
  const csv = [
    [
      "Job ID",
      "Container",
      "Vessel",
      "Customer",
      "Free Days",
      "Days Used",
      "Charge",
      "Status",
      "Days Over",
    ],
    ...rows.map((r) => [
      r.jobId,
      r.container,
      r.vessel,
      r.customer,
      r.freeDays,
      r.daysUsed ?? "",
      r.charge,
      r.status,
      r.daysOver ?? "",
    ]),
  ]
    .map((x) =>
      x.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
    )
    .join("\n");
  const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = u;
  a.download = "demurrage-report.csv";
  a.click();
  URL.revokeObjectURL(u);
}
export function Demurrage() {
  const navigate = useNavigate(),
    rows = useCollection("demurrage") || [];
  const [tab, setTab] = useState("All Demurrage"),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("All"),
    [jobType, setJobType] = useState("All"),
    [date, setDate] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(PAGE_SIZE),
    [period, setPeriod] = useState("This Month"),
    [create, setCreate] = useState(false),
    [rules, setRules] = useState(false),
    [form, setForm] = useState({
      jobId: "",
      container: "",
      customer: "",
      freeDays: 7,
      daysOver: 1,
      rate: 75000,
    }),
    [toast, setToast] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "All Demurrage" || r.status === tab.replace(/s$/, "")) &&
          (status === "All" || r.status === status) &&
          (jobType === "All" || r.jobType === jobType) &&
          (!q ||
            [r.jobId, r.container, r.customer, r.vessel].some((v) =>
              v.toLowerCase().includes(q.toLowerCase()),
            )) &&
          (!date ||
            r.chargeStart.includes(
              new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
            )),
      ),
    [rows, tab, status, jobType, q, date],
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  function notify(s) {
    setToast(s);
    setTimeout(() => setToast(""), 1600);
  }
  async function submit() {
    if (!form.jobId || !form.container || !form.customer) return;
    const r = await createDemurrage({
      ...form,
      freeDays: +form.freeDays,
      daysOver: +form.daysOver,
      rate: +form.rate,
    });
    setCreate(false);
    navigate("/demurrage/" + r.id);
  }
  return (
    <div className="grid grid-cols-1 gap-tk-section-gap min-w-0">
      <PageHeader
        crumbs={["Finance", "Demurrage"]}
        title="Demurrage"
        description="Track and manage demurrage and detention charges across all shipments and containers."
        actions={
          <Button icon="download" onClick={() => exportCsv(filtered)}>
            Export Report
          </Button>
        }
      />
      <div className="grid grid-cols-[repeat(5,minmax(150px,1fr))] gap-3 min-w-0 max-[1440px]:grid-cols-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
        <StatCard
          icon="calendar-x"
          tint="red"
          label="Active Demurrage"
          value="27"
          caption="₦18,645,000.00 Total Charges"
        />
        <StatCard
          icon="calendar-clock"
          tint="amber"
          label="Upcoming Charges"
          value="16"
          caption="₦7,250,000.00 Est. Total Charges"
        />
        <StatCard
          icon="inbox"
          label="Resolved (This Month)"
          value="42"
          caption="₦32,280,000.00 Total Resolved"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Collected (This Month)"
          value="₦24,680,000.00"
          delta="68.4%"
          caption="Collection Rate"
        />
        <StatCard
          icon="circle-alert"
          tint="purple"
          label="Disputes"
          value="4"
          caption="₦2,150,000.00 In Dispute"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_310px] gap-4 items-start max-[1200px]:grid-cols-1">
        <div className="grid grid-cols-1 gap-3.5 content-start min-w-0">
          <SectionCard title="" pad="none">
            <Tabs
              value={tab}
              onChange={(v) => {
                setTab(v);
                setPage(1);
              }}
              items={[
                { label: "All Demurrage", value: "All Demurrage" },
                { label: "Active", value: "Active", count: 27 },
                { label: "Upcoming", value: "Upcoming", count: 16 },
                { label: "Resolved", value: "Resolved", count: 42 },
                { label: "Disputes", value: "Disputes", count: 4 },
              ]}
              style={{ padding: "0 16px" }}
            />
            <div className="flex gap-2.5 items-center flex-wrap px-4 py-3.5 border-b border-tk-line max-[760px]:[&>*]:w-full">
              <SearchField
                className="flex-1 min-w-[220px] max-[760px]:min-w-0"
                placeholder="Search by job ID, container no., customer..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              <select
                className="h-[38px] border border-tk-line-strong rounded-tk-sm bg-white text-tk-ink-700 pl-[11px] pr-7 text-xs font-medium font-tk-sans cursor-pointer"
                aria-label="Status filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {["All", "Active", "Upcoming", "Resolved", "Dispute"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
              <select
                className="h-[38px] border border-tk-line-strong rounded-tk-sm bg-white text-tk-ink-700 pl-[11px] pr-7 text-xs font-medium font-tk-sans cursor-pointer"
                aria-label="Job type filter"
                value={jobType}
                onChange={(e) => {
                  setJobType(e.target.value);
                  setPage(1);
                }}
              >
                <option>All</option>
                {[...new Set(rows.map((r) => r.jobType))].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                className="h-[38px] border border-tk-line-strong rounded-[7px] px-2.5 box-border w-full text-xs font-tk-sans outline-none focus:border-tk-blue focus:shadow-tk-focus"
                aria-label="Date range"
                style={{ width: 145 }}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Button
                variant="outline"
                icon="rotate-ccw"
                onClick={() => {
                  setQ("");
                  setStatus("All");
                  setJobType("All");
                  setDate("");
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </div>
            <DataTable
              rows={paged}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate("/demurrage/" + r.id)}
              columns={[
                {
                  key: "jobId",
                  header: "Job ID",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-blue">
                        {r.jobId}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.jobType}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "container",
                  header: "Container No.",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {r.container}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.size}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "vessel",
                  header: "Vessel / Voyage",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {r.vessel}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.voyage}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "customer",
                  header: "Customer",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {r.customer}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.customerType}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "freeDays",
                  header: "Free Days",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {r.freeDays}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.freePeriod}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "daysUsed",
                  header: "Days Used",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {r.daysUsed ?? "-"}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.usedPeriod}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "charge",
                  header: "Charge (₦)",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong className="text-tk-meta text-tk-ink-700">
                        {money(r.charge)}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.rate
                          ? money(r.rate) + "/day"
                          : r.status === "Upcoming"
                            ? "Within Free Days"
                            : r.overSince}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  ),
                },
                {
                  key: "daysOver",
                  header: "Days Over",
                  render: (r) => (
                    <span className="grid gap-0.5 whitespace-nowrap">
                      <strong
                        className={
                          "text-tk-meta " +
                          (r.daysOver ? "text-tk-danger" : "text-tk-ink-700")
                        }
                      >
                        {r.daysOver ?? "-"}
                        {r.daysOver != null ? " days" : ""}
                      </strong>
                      <small className="text-tk-micro text-tk-ink-400">
                        {r.overSince}
                      </small>
                    </span>
                  ),
                },
                {
                  key: "x",
                  header: "Action",
                  render: (r) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="ellipsis"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/demurrage/" + r.id);
                      }}
                    />
                  ),
                },
              ]}
            />
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
              pageSize={pageSize}
              total={filtered.length}
              onPage={(p) =>
                setPage(
                  Math.min(
                    Math.max(1, p),
                    Math.max(1, Math.ceil(filtered.length / pageSize)),
                  ),
                )
              }
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </SectionCard>
        </div>
        <div className="grid grid-cols-1 gap-3.5 content-start min-w-0 max-[1200px]:grid-cols-2 max-[1200px]:[&>:last-child:nth-child(odd)]:col-span-full max-[760px]:grid-cols-1">
          <SectionCard
            title="Demurrage Summary"
            action={
              <select
                aria-label="Summary period"
                className="h-[38px] border border-tk-line-strong rounded-tk-sm bg-white text-tk-ink-700 pl-[11px] pr-7 text-xs font-medium font-tk-sans cursor-pointer"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Year</option>
              </select>
            }
          >
            <div className="flex flex-col items-center gap-4 w-full">
              <DonutChart
                size={180}
                thickness={18}
                centerValue="₦25.9M"
                centerLabel="Total Charges"
                style={{ flex: "0 0 auto" }}
                data={DEMURRAGE_SUMMARY}
              />
              <LegendList
                items={DEMURRAGE_SUMMARY}
                showShare={false}
                style={{ flex: 1, width: "100%" }}
              />
            </div>
            <div className="border-t border-tk-line mt-3.5 pt-1.5">
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Total Charges</span>
                <b>₦25,895,000.00</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Total Collected</span>
                <b>₦24,680,000.00</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Outstanding</span>
                <b>₦1,215,000.00</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Collection Rate</span>
                <b>93.2%</b>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Quick Actions">
            <Action
              icon="clipboard-plus"
              title="Create Demurrage Charge"
              hint="Manually create a demurrage charge"
              onClick={() => setCreate(true)}
            />
            <Action
              icon="clipboard-list"
              title="Demurrage Rules"
              hint="Manage free days and rate rules"
              onClick={() => setRules(true)}
            />
            <Action
              icon="calculator"
              title="Bulk Demurrage Calculation"
              hint="Calculate demurrage for multiple jobs"
              onClick={() =>
                notify("Bulk calculation completed for visible records")
              }
            />
            <Action
              icon="file-chart-column"
              title="Demurrage Reports"
              hint="View and export demurrage reports"
              onClick={() => exportCsv(filtered)}
            />
          </SectionCard>
          <SectionCard
            title="Recent Demurrage"
            action={
              <button
                style={{
                  border: 0,
                  background: "none",
                  color: "var(--tk-blue)",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setTab("All Demurrage");
                  setPage(1);
                }}
              >
                View all
              </button>
            }
          >
            {rows.slice(0, 4).map((r) => (
              <button
                className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-1.75 py-2 border-b border-tk-line text-tk-micro w-full border-l-0 border-r-0 border-t-0 bg-transparent cursor-pointer text-left"
                key={r.id}
                onClick={() => navigate("/demurrage/" + r.id)}
              >
                <span>
                  <strong className="text-tk-blue">{r.jobId}</strong>
                  <br />
                  <Badge
                    tone={STATUS_TONE[r.status]}
                    style={{ height: 17, fontSize: 8 }}
                  >
                    {r.status}
                  </Badge>
                </span>
                <span>
                  {r.container}
                  <br />
                  <small>{r.dischargeDate}</small>
                </span>
                <span style={{ textAlign: "right" }}>
                  <b>{money(r.charge)}</b>
                  <br />
                  <small>
                    {r.daysOver ? r.daysOver + " days over" : r.overSince}
                  </small>
                </span>
              </button>
            ))}
          </SectionCard>
        </div>
      </div>
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="Create Demurrage Charge"
        width={580}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.jobId || !form.container || !form.customer}
              onClick={submit}
            >
              Create Charge
            </Button>
          </>
        }
      >
        <div className="grid gap-3.25">
          <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <TextField
              label="Job ID"
              value={form.jobId}
              onChange={(e) => setForm({ ...form, jobId: e.target.value })}
            />
            <TextField
              label="Container Number"
              value={form.container}
              onChange={(e) => setForm({ ...form, container: e.target.value })}
            />
          </div>
          <TextField
            label="Customer"
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <TextField
              label="Free Days"
              type="number"
              value={form.freeDays}
              onChange={(e) => setForm({ ...form, freeDays: e.target.value })}
            />
            <TextField
              label="Days Over"
              type="number"
              value={form.daysOver}
              onChange={(e) => setForm({ ...form, daysOver: e.target.value })}
            />
          </div>
          <TextField
            label="Daily Rate (₦)"
            type="number"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
        </div>
      </Modal>
      <Modal
        open={rules}
        onClose={() => setRules(false)}
        title="Demurrage Rules"
        description="Default free-time and daily charge settings."
        width={520}
        footer={
          <Button
            onClick={() => {
              setRules(false);
              notify("Demurrage rules saved");
            }}
          >
            Save Rules
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <TextField label="Default Free Days" type="number" defaultValue="7" />
          <TextField
            label="Default Daily Rate (₦)"
            type="number"
            defaultValue="75000"
          />
        </div>
      </Modal>
      {toast && (
        <div className="fixed right-6 bottom-6 z-100 bg-tk-ink-900 text-white rounded-[9px] px-4 py-3 shadow-tk-menu text-xs font-medium font-tk-sans">
          {toast}
        </div>
      )}
    </div>
  );
}
function Action({ icon, title, hint, onClick }) {
  return (
    <button
      className="w-full flex gap-2.25 items-center px-1 py-2 border-0 bg-transparent text-left cursor-pointer hover:bg-tk-surface-sunk"
      onClick={onClick}
    >
      <span className="w-7 h-7 rounded-tk-sm bg-tk-blue-soft text-tk-blue grid place-items-center shrink-0">
        <Icon name={icon} size={13} />
      </span>
      <span className="flex-1">
        <strong className="block text-tk-meta text-tk-ink-900">{title}</strong>
        <small className="block text-tk-micro text-tk-ink-400">{hint}</small>
      </span>
      <Icon name="chevron-right" size={13} />
    </button>
  );
}
