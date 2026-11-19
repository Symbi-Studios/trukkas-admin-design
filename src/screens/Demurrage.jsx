"use client";
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle, TableToolbar } from '../ds.js';


import { usePageSearchState } from '../components/PageSearch.jsx';

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  Icon,
  Modal,
  TextField,
  Select,
  Skeleton,
  StatsPanel,
  Tabs,
} from "../ds.js";
import {
  useGetAdminDemurrageDirectoryQuery,
  useGetAdminDemurrageStatsQuery, useCreateAdminDemurrageMutation,
  demurrageMoney as money, demurrageSummary, demurrageDetailUrl,
} from "../store/features/demurrage/demurrageApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { FeeRecordsTab } from "./FeeTabs.jsx";
import { DATE_PRESETS, FilterChip, datePresetRange } from "../components/FilterChip.jsx";
import { initialSearch, initialTab } from "../domain/urlState.js";

// Demurrage covers both kinds of lateness: forwarders billed for late offloading, and truckers
// whose final payment is reduced for late delivery. Rates and free windows are on Platform Rates.
const TABS = ["Late Offloading", "Driver Delays"];
import styles from "./Demurrage.module.css";
const PAGE_SIZE = 8;
const EMPTY_ROWS = [];
const STATUS_TONE = {
  Active: "danger",
  Upcoming: "warning",
  Resolved: "success",
  Dispute: "purple",
};
function exportCsv(rows) {
  const csv = [
    [
      "Job ID",
      "Container",
      "Customer",
      "Trucker",
      "Free Days",
      "Days Used",
      "Charge",
      "Status",
      "Days Over",
    ],
    ...rows.map((r) => [
      r.jobId,
      r.container,
      r.customer,
      r.assignedTo,
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
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const owner=useSelector(state=>state.auth.admin?.id),role=useSelector(state=>state.auth.admin?.role);
  const authenticated=useSelector(state=>Boolean(state.auth.accessToken && state.auth.admin?.id));
  const scope={owner,role},active=useRef(true);
  const navigate = useNavigate();
  const directoryQuery = useGetAdminDemurrageDirectoryQuery(scope,{skip:!authenticated});
  const statsQuery = useGetAdminDemurrageStatsQuery(scope,{skip:!authenticated});
  const [createCharge, createState] = useCreateAdminDemurrageMutation();
  const canCreate = useSelector((state) => ["SUPER_ADMIN", "FINANCE_ADMIN"].includes(state.auth.admin?.role));
  const creating = useRef(false);
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const rows = directory?.rows || EMPTY_ROWS;
  const summary = useMemo(() => demurrageSummary(directory, statsQuery.error ? null : statsQuery.currentData), [directory, statsQuery.error, statsQuery.currentData]);
  const toastTimer = useRef(null);
  const [tab, setTab] = useState(() => initialTab(TABS, "Late Offloading"));
  const [q, setQ] = usePageSearchState(initialSearch(), () => setPage(1), tab === "Late Offloading"),
    [status, setStatus] = useState("All"),
    [jobType, setJobType] = useState("All"),
    [datePreset, setDatePreset] = useState("All Dates"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(PAGE_SIZE),
    [create, setCreate] = useState(false),
    [form, setForm] = useState({
      jobId: "",
      container: "",
      customer: "",
      freeDays: "",
      daysOver: "",
      rate: "",
    }),
    [toast, setToast] = useState("");

  const dateRange = datePresetRange(datePreset);
  const dateQuery = useGetAdminDemurrageDirectoryQuery({ ...scope, ...(dateRange.from ? { dateFrom: `${dateRange.from}T00:00:00+01:00`, dateTo: `${dateRange.to}T23:59:59.999+01:00` } : {}) }, { skip: !authenticated || !dateRange.from });
  const visibleQuery = dateRange.from ? dateQuery : directoryQuery;
  const visibleDirectory = visibleQuery.error ? null : visibleQuery.currentData;
  const visibleRows = visibleDirectory?.rows || EMPTY_ROWS;
  useEffect(() => { active.current=true; return () => { active.current=false; clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => { const error = statsQuery.error || dateQuery.error; if (error) notify(getApiErrorMessage(error)); }, [statsQuery.error, dateQuery.error]);
  useEffect(() => { if (directoryQuery.error) notify(getApiErrorMessage(directoryQuery.error)); }, [directoryQuery.error]);
  const metric = (value) => (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching) ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";
  const filtered = useMemo(
    () =>
      visibleRows.filter(
        (r) =>
          (status === "All" || r.status === status) &&
          (jobType === "All" || r.jobType === jobType) &&
          (!q ||
            [r.jobId, r.container, r.customer, r.assignedTo].some((v) =>
              v?.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [visibleRows, status, jobType, q],
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

  return (
    <div className="grid grid-cols-1 gap-tk-section-gap min-w-0">
      <PageHeader
        crumbs={["Finance", "Demurrage"]}
        title="Demurrage"
        description="Charges for lateness: forwarders billed for late offloading, and truckers whose final payment is reduced for late delivery."
        actions={<>
          <Button variant="outline" icon="sliders-horizontal" onClick={() => navigate("/rates")}>Rates & Free Windows</Button>
          <Button icon="plus" disabled={!canCreate} onClick={() => setCreate(true)}>Create Charge</Button>
        </>}
      />
      <StatsPanel fixedLabel="All time" fixedHint="Demurrage totals cover all time; the demurrage stats API can’t be filtered by date yet.">
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
      </StatsPanel>
      <div className="grid grid-cols-1 gap-4 items-start">
        <div className="grid grid-cols-1 gap-3.5 content-start min-w-0">
          <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
            <Tabs value={tab} onChange={(value) => { setTab(value); setPage(1); }} style={{ padding: "0 var(--tk-card-pad)" }} items={TABS} />
            {tab === "Driver Delays" ? <FeeRecordsTab kind="deductions" rules={[]} /> : <>

            <TableToolbar
              search={<SearchField placeholder="Search by job ID, container, customer or trucker…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
              filters={<>
                <FilterChip name="Status" icon="circle-dot" value={status} allValue="All" options={[{ value: "All", label: "All Statuses" }, "Active", "Upcoming", "Resolved", "Dispute"]} onChange={(v) => { setStatus(v); setPage(1); }} />
                <FilterChip name="Job Type" icon="route" value={jobType} allValue="All" options={[{ value: "All", label: "All Job Types" }, ...new Set(rows.map((r) => r.jobType).filter((value) => value !== "—"))]} onChange={(v) => { setJobType(v); setPage(1); }} />
                <FilterChip name="Free Period Ended" icon="calendar" value={datePreset} allValue="All Dates" options={DATE_PRESETS} onChange={(v) => { setDatePreset(v); setPage(1); }} />
              </>}
              onClear={status !== "All" || jobType !== "All" || datePreset !== "All Dates" || q.trim() ? () => { setQ(""); setStatus("All"); setJobType("All"); setDatePreset("All Dates"); setPage(1); } : undefined}
              viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
              trailing={<Button variant="outline" icon="download" disabled={!visibleDirectory || visibleQuery.isFetching} onClick={() => exportCsv(filtered)}>Export</Button>}
            />
            {!visibleDirectory && visibleQuery.isFetching ? <DriverTableLoading columns={10} label="Loading demurrage" /> : <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.demurrage} view={tableView} boardGroupBy={(row) => row.status}
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
                { key: "assignedTo", header: "Trucker" },
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
            </>}
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
            money
            type="number"
            placeholder="—"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
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
