"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
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
  Skeleton,
} from "../ds.js";
import {
  useGetAdminDemurrageDirectoryQuery, useGetAdminDemurrageRulesQuery, useUpdateAdminDemurrageRulesMutation, useLazyGetAdminDemurrageBulkCalculationQuery,
  useGetAdminDemurrageStatsQuery, useGetAdminDemurrageSummaryQuery, useCreateAdminDemurrageMutation,
  demurrageMoney as money, demurrageSummary, demurrageDetailUrl, demurragePeriod,
} from "../store/features/demurrage/demurrageApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
const PAGE_SIZE = 8;
const EMPTY_ROWS = [];
const STATUS_TONE = {
  Active: "danger",
  Upcoming: "warning",
  Resolved: "success",
  Dispute: "purple",
};
const DEMURRAGE_SUMMARY = [
  { label: "Active", value: null, display: "—", color: "#f14b67" },
  { label: "Upcoming", value: null, display: "—", color: "#f2b400" },
  { label: "Resolved", value: null, display: "—", color: "#0da56a" },
  { label: "Disputes", value: null, display: "—", color: "#762ce8" },
  { label: "Waived", value: null, display: "—", color: "var(--tk-ink-300)" },
];
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
      r.daysUsed ?? "—",
      r.charge,
      r.status,
      r.daysOver ?? "—",
    ]),
  ]
    .map((x) =>
      x.map((v) => {
        const raw = String(v ?? "—");
        const safe = typeof v === "string" && /^\s*[=+@-]/.test(raw) ? `'${raw}` : raw;
        return '"' + safe.replaceAll('"', '""') + '"';
      }).join(","),
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
  const owner=useSelector(state=>state.auth.admin?.id),role=useSelector(state=>state.auth.admin?.role);
  const authenticated=useSelector(state=>Boolean(state.auth.accessToken));
  return <DemurrageScreen key={String(owner)+':'+String(role)+':'+authenticated} />;
}
function DemurrageScreen() {
  const owner=useSelector(state=>state.auth.admin?.id),role=useSelector(state=>state.auth.admin?.role);
  const authenticated=useSelector(state=>Boolean(state.auth.accessToken && state.auth.admin?.id));
  const scope={owner,role},active=useRef(true);
  const navigate = useNavigate();
  const directoryQuery = useGetAdminDemurrageDirectoryQuery(scope,{skip:!authenticated});
  const rulesQuery = useGetAdminDemurrageRulesQuery(scope,{skip:!authenticated});
  const statsQuery = useGetAdminDemurrageStatsQuery(scope,{skip:!authenticated});
  const [createCharge, createState] = useCreateAdminDemurrageMutation();
  const canCreate = useSelector((state) => ["SUPER_ADMIN", "FINANCE_ADMIN"].includes(state.auth.admin?.role));
  const creating = useRef(false);
  const [updateRules, updateState] = useUpdateAdminDemurrageRulesMutation();
  const [calculateBulk, bulkState] = useLazyGetAdminDemurrageBulkCalculationQuery();
  const canSaveRules = useSelector((state) => state.auth.admin?.role) === "SUPER_ADMIN";
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const rows = directory?.rows || EMPTY_ROWS;
  const summary = useMemo(() => demurrageSummary(directory, statsQuery.error ? null : statsQuery.currentData), [directory, statsQuery.error, statsQuery.currentData]);
  const toastTimer = useRef(null), savingRules = useRef(false), rulesDirty = useRef(false), bulkPending = useRef(false);
  const [tab, setTab] = useState("All Demurrage"),
    [q, setQ] = usePageSearchState("", () => setPage(1)),
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
      freeDays: "",
      daysOver: "",
      rate: "",
    }),
    [ruleForm, setRuleForm] = useState({ freeDays: "", rate: "" }),
    [toast, setToast] = useState("");

  const dateQuery = useGetAdminDemurrageDirectoryQuery({ ...scope, ...(date ? { dateFrom: `${date}T00:00:00+01:00`, dateTo: `${date}T23:59:59.999+01:00` } : {}) }, { skip: !authenticated || !date });
  const visibleQuery = date ? dateQuery : directoryQuery;
  const visibleDirectory = visibleQuery.error ? null : visibleQuery.currentData;
  const visibleRows = visibleDirectory?.rows || EMPTY_ROWS;
  const periodRange = useMemo(() => demurragePeriod(period), [period]);
  const periodQuery = useGetAdminDemurrageSummaryQuery({...periodRange,...scope},{skip:!authenticated});
  const periodSummary = periodQuery.error ? null : periodQuery.currentData;
  const periodItems = periodSummary?.items || DEMURRAGE_SUMMARY;
  const periodMetric = (value) => !periodSummary && periodQuery.isFetching ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";
  useEffect(() => { active.current=true; return () => { active.current=false; clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => { const error = statsQuery.error || periodQuery.error || dateQuery.error; if (error) notify(getApiErrorMessage(error)); }, [statsQuery.error, periodQuery.error, dateQuery.error]);
  useEffect(() => { if (directoryQuery.error) notify(getApiErrorMessage(directoryQuery.error)); }, [directoryQuery.error]);
  useEffect(() => {
    if (!rules || rulesDirty.current) return;
    const values = rulesQuery.error ? null : rulesQuery.currentData;
    setRuleForm({ freeDays: values?.freeDays ?? "", rate: values?.rate ?? "" });
  }, [rules, rulesQuery.currentData, rulesQuery.error]);
  const metric = (value) => (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching) ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";
  const filtered = useMemo(
    () =>
      visibleRows.filter(
        (r) =>
          (tab === "All Demurrage" || r.status === (tab === "Disputes" ? "Dispute" : tab)) &&
          (status === "All" || r.status === status) &&
          (jobType === "All" || r.jobType === jobType) &&
          (!q ||
            [r.jobId, r.container, r.customer, r.vessel].some((v) =>
              v?.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [visibleRows, tab, status, jobType, q],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function notify(s) {
    if (!active.current) return;
    clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }
  async function submit() {
    if (creating.current || createState.isLoading || !canCreate || !form.jobId || !form.container || !form.customer) return;
    creating.current = true;
    try {
      const result = await createCharge({...form,...scope}).unwrap();
      if (!active.current) return;
      setCreate(false);
      setForm({ jobId: "", container: "", customer: "", freeDays: "", daysOver: "", rate: "" });
      notify(result.warning || `Demurrage charge ${result.id} created.`);
    } catch (error) { notify(getApiErrorMessage(error)); }
    finally { creating.current = false; }
  }
  async function saveRules() {
    if (savingRules.current || updateState.isLoading || !canSaveRules) return;
    savingRules.current = true;
    try {
      const result = await updateRules({...ruleForm,...scope}).unwrap();
      if (!active.current) return;
      setRules(false); notify(result.message);
    } catch (error) { if (active.current) { setRules(false); notify(getApiErrorMessage(error)); } }
    finally { savingRules.current = false; }
  }
  async function bulkCalculate() {
    if (bulkPending.current || bulkState.isFetching || visibleQuery.isFetching) return;
    if (!visibleDirectory || !paged.length) { notify("Load demurrage records before calculating."); return; }
    bulkPending.current = true;
    try {
      const result = await calculateBulk({ids:paged.map((row) => row.chargeApiId),...scope}, false).unwrap();
      notify(`Bulk calculation completed for ${result.count} visible records.`);
    } catch (error) { notify(getApiErrorMessage(error)); }
    finally { bulkPending.current = false; }
  }
  return (
    <div className="grid grid-cols-1 gap-tk-section-gap min-w-0">
      <PageHeader
        crumbs={["Finance", "Demurrage"]}
        title="Demurrage"
        description="Track and manage demurrage and detention charges across all shipments and containers."
        actions={
          <Button icon="download" disabled={!visibleDirectory || visibleQuery.isFetching} onClick={() => exportCsv(filtered)}>
            Export Report
          </Button>
        }
      />
      <div className="grid grid-cols-[repeat(5,minmax(150px,1fr))] gap-3 min-w-0 max-[1440px]:grid-cols-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
        <StatCard
          icon="calendar-x"
          tint="red"
          label="Active Demurrage"
          value={metric(summary.active)}
          caption={`${money(summary.activeAmount)} Total Charges`}
        />
        <StatCard
          icon="calendar-clock"
          tint="amber"
          label="Upcoming Charges"
          value={metric(summary.upcoming)}
          caption={`${money(summary.upcomingAmount)} Est. Total Charges`}
        />
        <StatCard
          icon="inbox"
          label="Resolved (This Month)"
          value={metric(summary.resolvedThisMonth)}
          caption={`${money(summary.resolvedAmountThisMonth)} Total Resolved`}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Collected (This Month)"
          value={metric(money(summary.collectedThisMonth))}
          delta={summary.collectionRateThisMonth == null ? "—" : `${summary.collectionRateThisMonth}%`}
          direction={null}
          caption="Collection Rate"
        />
        <StatCard
          icon="circle-alert"
          tint="purple"
          label="Disputes"
          value={metric(summary.disputes)}
          caption={`${money(summary.disputeAmount)} In Dispute`}
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
                { label: "Active", value: "Active", count: summary.active ?? "—" },
                { label: "Upcoming", value: "Upcoming", count: summary.upcoming ?? "—" },
                { label: "Resolved", value: "Resolved", count: summary.resolved ?? "—" },
                { label: "Disputes", value: "Disputes", count: summary.disputes ?? "—" },
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
                {[...new Set(rows.map((r) => r.jobType).filter((value) => value !== "—"))].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                className="h-[38px] border border-tk-line-strong rounded-[7px] px-2.5 box-border w-full text-xs font-tk-sans outline-none focus:border-tk-blue focus:shadow-tk-focus"
                aria-label="Date range"
                style={{ width: 145 }}
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setPage(1); }}
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
            {!visibleDirectory && visibleQuery.isFetching ? <DriverTableLoading columns={10} label="Loading demurrage" /> : <DataTable
              rows={paged}
              rowKey={(r) => r.key}
              onRowClick={(r) => navigate(demurrageDetailUrl(r))}
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
                        {r.freeDays ?? "—"}
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
                        {r.daysUsed ?? "—"}
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
                        {r.rate != null
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
                        {r.daysOver ?? "—"}
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
                        navigate(demurrageDetailUrl(r));
                      }}
                    />
                  ),
                },
              ]}
            />}
            <Pagination
              page={currentPage}
              pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))}
              pageSize={pageSize}
              total={visibleDirectory ? filtered.length : "—"}
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
                centerValue={periodMetric(money(periodSummary?.totalCharges))}
                centerLabel="Total Charges"
                style={{ flex: "0 0 auto" }}
                data={periodSummary?.chart || []}
              />
              <LegendList
                items={periodItems}
                showShare={false}
                style={{ flex: 1, width: "100%" }}
              />
            </div>
            <div className="border-t border-tk-line mt-3.5 pt-1.5">
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Total Charges</span>
                <b>{periodMetric(money(periodSummary?.totalCharges))}</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Total Collected</span>
                <b>{periodMetric(money(periodSummary?.totalCollected))}</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Outstanding</span>
                <b>{periodMetric(money(periodSummary?.outstanding))}</b>
              </div>
              <div className="flex justify-between gap-2 py-1.5 text-tk-meta text-tk-ink-500">
                <span>Collection Rate</span>
                <b>{periodMetric(periodSummary?.collectionRate == null ? "—" : `${periodSummary.collectionRate}%`)}</b>
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
              onClick={() => { rulesDirty.current = false; setRules(true); if (rulesQuery.error) notify(getApiErrorMessage(rulesQuery.error)); }}
            />
            <Action
              icon="calculator"
              title="Bulk Demurrage Calculation"
              hint="Calculate demurrage for multiple jobs"
              onClick={bulkCalculate}
            />
            <Action
              icon="file-chart-column"
              title="Demurrage Reports"
              hint="View and export demurrage reports"
              onClick={() => visibleDirectory && !visibleQuery.isFetching ? exportCsv(filtered) : notify("Load demurrage records before exporting." )}
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
            {!directory && directoryQuery.isFetching ? <DriverTableLoading columns={3} label="Loading recent demurrage" /> : rows.slice(0, 4).map((r) => (
              <button
                className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-1.75 py-2 border-b border-tk-line text-tk-micro w-full border-l-0 border-r-0 border-t-0 bg-transparent cursor-pointer text-left"
                key={r.key}
                onClick={() => navigate(demurrageDetailUrl(r))}
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
                    {r.daysOver != null ? r.daysOver + " days over" : r.overSince}
                  </small>
                </span>
              </button>
            ))}
            {!directoryQuery.isFetching && !rows.length && "—"}
          </SectionCard>
        </div>
      </div>
      <Modal
        open={create}
        onClose={() => { if (!creating.current) setCreate(false); }}
        title="Create Demurrage Charge"
        width={580}
        footer={
          <>
            <Button variant="outline" disabled={createState.isLoading} onClick={() => setCreate(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canCreate || createState.isLoading || !form.jobId || !form.container || !form.customer || form.daysOver === ""}
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
              placeholder="—"
              value={form.freeDays}
              onChange={(e) => setForm({ ...form, freeDays: e.target.value })}
            />
            <TextField
              label="Days Over"
              type="number"
              placeholder="—"
              value={form.daysOver}
              onChange={(e) => setForm({ ...form, daysOver: e.target.value })}
            />
          </div>
          <TextField
            label="Daily Rate (₦)"
            type="number"
            placeholder="—"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
        </div>
      </Modal>
      <Modal
        open={rules}
        onClose={() => { if (!savingRules.current) setRules(false); }}
        title="Demurrage Rules"
        description="Default free-time and daily charge settings."
        width={520}
        footer={
          <Button
            disabled={!canSaveRules || updateState.isLoading || rulesQuery.isFetching || ruleForm.freeDays === "" || ruleForm.rate === ""}
            onClick={saveRules}
          >
            Save Rules
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <TextField label="Default Free Days" type="number" placeholder="—" value={ruleForm.freeDays} disabled={!canSaveRules || updateState.isLoading} onChange={(e) => { rulesDirty.current = true; setRuleForm({ ...ruleForm, freeDays: e.target.value }); }} />
          <TextField
            label="Default Daily Rate (₦)"
            type="number"
            placeholder="—"
            value={ruleForm.rate}
            disabled={!canSaveRules || updateState.isLoading}
            onChange={(e) => { rulesDirty.current = true; setRuleForm({ ...ruleForm, rate: e.target.value }); }}
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
