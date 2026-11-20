"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { BOARD_LAYOUTS } from "../domain/boardLayouts.js";
import { PageHeader, Button, StatCard, SectionCard, SearchField, TableToolbar, DataTable, Pagination, Badge, Modal, TextField, Skeleton, StatsPanel, EmptyState, NotAvailable, ViewToggle } from "../ds.js";
import { useGetAdminDemurrageDirectoryQuery, useGetAdminDemurrageStatsQuery, useCreateAdminDemurrageMutation, demurrageMoney as money, demurrageSummary } from "../store/features/demurrage/demurrageApi.js";
import { useGetAdminFeeDeductionsQuery } from "../store/features/fees/feeTabsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { useUrlParams } from "../domain/urlState.js";
import { FilterChip } from "../components/FilterChip.jsx";
import { DateRangeFilter, EMPTY_RANGE, inRange } from "../components/finance/DateRangeFilter.jsx";
import { DateCell, MiddleId, Money, PartyCell } from "../components/finance/FinanceCells.jsx";
import { DemurrageDrawer, DEMURRAGE_STATUS_TONE } from "./DemurrageDrawer.jsx";
import { DriverTableLoading } from "./DriversLoading.jsx";

// Demurrage is lateness, charged two ways: forwarders billed for late offloading (charges),
// and truckers whose final payment is reduced for late delivery (driver-delay deductions).
const TYPES = ["All Types", "Late Offloading", "Driver Delay"];
const PAGE_SIZE = 10;
const EMPTY_ROWS = [];
const csvCell = (value) => {
  const raw = String(value ?? "");
  return '"' + (/^\s*[=+@-]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') + '"';
};
function exportCsv(rows) {
  const header = ["Type", "Job ID", "Forwarder", "Trucker", "Days Over", "Amount (NGN)", "Status", "Date"];
  const lines = rows.map((r) => [r.kind, r.jobId, r.customer, r.trucker, r.daysOver ?? "", r.amount ?? "", r.status, r.date]);
  const url = URL.createObjectURL(new Blob([[header, ...lines].map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = "demurrage.csv"; a.click(); URL.revokeObjectURL(url);
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function Demurrage() {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  return <DemurrageScreen key={String(owner) + ":" + String(role) + ":" + authenticated} />;
}

function DemurrageScreen() {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const scope = { owner, role }, active = useRef(true);
  const navigate = useNavigate();
  const directoryQuery = useGetAdminDemurrageDirectoryQuery(scope, { skip: !authenticated });
  const statsQuery = useGetAdminDemurrageStatsQuery(scope, { skip: !authenticated });
  // Deductions are paged server-side; ask for the first 100 across all dates.
  const deductionsQuery = useGetAdminFeeDeductionsQuery({ owner, page: 1, limit: 100, search: "", dateFrom: "2020-01-01", dateTo: today() }, { skip: !authenticated || !owner });
  const [createCharge, createState] = useCreateAdminDemurrageMutation();
  const canCreate = useSelector((state) => ["SUPER_ADMIN", "FINANCE_ADMIN"].includes(state.auth.admin?.role));
  const creating = useRef(false), toastTimer = useRef(null);
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const summary = useMemo(() => demurrageSummary(directory, statsQuery.error ? null : statsQuery.currentData), [directory, statsQuery.error, statsQuery.currentData]);
  const metric = (value) => (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching) ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";

  const url = useUrlParams();
  const [q, setQ] = usePageSearchState(url.search(), () => setPage(1));
  const [type, setType] = useState("All Types"), [status, setStatus] = useState("All Statuses"), [dates, setDates] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1), [view, setView] = useState("list"), [hideEmpty, setHideEmpty] = useState(false);
  const [selected, setSelected] = useState(null);
  const linkedId = url.get("id");
  useEffect(() => { if (linkedId) setSelected({ chargeId: linkedId }); }, [linkedId]);
  const [create, setCreate] = useState(false), [toast, setToast] = useState("");
  const [form, setForm] = useState({ jobId: "", container: "", customer: "", freeDays: "", daysOver: "", rate: "" });

  const rows = useMemo(() => {
    const charges = (directory?.rows || EMPTY_ROWS).map((r) => ({
      ...r, kind: "Late Offloading", key: "charge:" + r.key, trucker: r.assignedTo, amount: r.charge,
      when: r.chargeStartAt || r.freeUntil || r.cargoArrivedAt, date: r.chargeStart !== "—" ? r.chargeStart : r.createdOn,
    }));
    const deductions = (deductionsQuery.error ? EMPTY_ROWS : deductionsQuery.currentData?.rows || EMPTY_ROWS).map((r) => ({
      ...r, kind: "Driver Delay", key: "deduction:" + r.id, jobId: r.job, customer: null, trucker: r.user, daysOver: null, when: r.createdAtIso, date: r.createdAt,
    }));
    return [...charges, ...deductions].sort((a, b) => (Date.parse(b.when || "") || 0) - (Date.parse(a.when || "") || 0));
  }, [directory, deductionsQuery.currentData, deductionsQuery.error]);
  const statusOptions = useMemo(() => ["All Statuses", ...new Set(rows.filter((r) => type === "All Types" || r.kind === type).map((r) => r.status).filter((value) => value && value !== "—"))], [rows, type]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (type === "All Types" || r.kind === type) && (status === "All Statuses" || r.status === status) && inRange(r.when, dates)
      && (!needle || [r.jobId, r.customer, r.trucker, r.reference].some((value) => value && String(value).toLowerCase().includes(needle))));
  }, [rows, type, status, dates, q]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const loading = (directoryQuery.isFetching && !directory) || (deductionsQuery.isFetching && !deductionsQuery.currentData);
  const moreDeductions = (deductionsQuery.currentData?.pagination?.total ?? 0) > (deductionsQuery.currentData?.rows?.length ?? 0);
  const filtersActive = type !== "All Types" || status !== "All Statuses" || Boolean(dates.from) || Boolean(q.trim());
  const reset = () => { setType("All Types"); setStatus("All Statuses"); setDates(EMPTY_RANGE); setQ(""); setPage(1); };

  useEffect(() => { active.current = true; return () => { active.current = false; clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => { const error = statsQuery.error || directoryQuery.error || deductionsQuery.error; if (error) notify(getApiErrorMessage(error)); }, [statsQuery.error, directoryQuery.error, deductionsQuery.error]);
  function notify(text) {
    if (!active.current) return;
    clearTimeout(toastTimer.current); setToast(text);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
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
      <SectionCard title="" pad="none" className="fin-table">
        <TableToolbar
          search={<SearchField placeholder="Search by job, forwarder or trucker…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterChip name="Type" icon="layers" value={type} allValue="All Types" options={TYPES} onChange={(v) => { setType(v); setStatus("All Statuses"); setPage(1); }} />
            <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Statuses" options={statusOptions} onChange={(v) => { setStatus(v); setPage(1); }} />
            <DateRangeFilter value={dates} onChange={(next) => { setDates(next); setPage(1); }} />
          </>}
          onClear={filtersActive ? reset : undefined}
          viewControl={<ViewToggle value={view} onChange={setView} hideEmpty={hideEmpty} onHideEmptyChange={setHideEmpty} />}
          trailing={<Button variant="outline" icon="download" disabled={loading || !filtered.length} onClick={() => exportCsv(filtered)}>Export</Button>}
        />
        {loading ? <DriverTableLoading columns={8} label="Loading demurrage" /> : !filtered.length && view === "list" ? (
          <EmptyState icon="hourglass" title="No demurrage found" description="Try adjusting your filters or search." />
        ) : <>
          <DataTable view={view} boardHideEmpty={hideEmpty} boardConfig={BOARD_LAYOUTS.demurrage} boardGroupBy={(r) => r.status} boardOnRowClick={(r) => setSelected({ row: r })}
            rows={paged} rowKey={(r) => r.key} onRowClick={(r) => setSelected({ row: r })}
            columns={[
              { key: "job", header: "Job ID", render: (r) => <MiddleId value={r.jobId} head={7} tail={6} label="job ID" onOpen={() => setSelected({ row: r })} /> },
              { key: "kind", header: "Type", render: (r) => <Badge tone={r.kind === "Driver Delay" ? "purple" : "info"}>{r.kind}</Badge> },
              { key: "customer", header: "Forwarder", render: (r) => r.kind === "Driver Delay" ? <NotAvailable label="Not applicable" /> : <PartyCell name={r.customer} role="FORWARDER" /> },
              { key: "trucker", header: "Trucker", render: (r) => <PartyCell name={r.trucker} role="TRUCKER" /> },
              { key: "daysOver", header: "Days Over", render: (r) => r.daysOver == null ? <NotAvailable label={r.kind === "Driver Delay" ? "Not applicable" : "Not available"} /> : <span className="tk-cell-strong" style={{ color: r.daysOver > 0 ? "var(--tk-danger)" : undefined }}>{r.daysOver} day{r.daysOver === 1 ? "" : "s"}</span> },
              { key: "amount", header: "Amount", align: "right", render: (r) => <Money value={r.amount} /> },
              { key: "date", header: "Date", render: (r) => <DateCell date={r.date} /> },
              { key: "status", header: "Status", render: (r) => <Badge tone={DEMURRAGE_STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
            ]} />
          {moreDeductions && <p className="fin-note" style={{ padding: "0 var(--tk-card-pad)" }}>Showing the 100 most recent driver-delay deductions.</p>}
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
        </>}
      </SectionCard>
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
      {selected && <DemurrageDrawer row={selected.row} chargeId={selected.chargeId} onClose={() => setSelected(null)} />}
      {toast && (
        <div className="fixed right-6 bottom-6 z-100 bg-tk-ink-900 text-white rounded-[9px] px-4 py-3 shadow-tk-menu text-xs font-medium font-tk-sans">
          {toast}
        </div>
      )}
    </div>
  );
}
