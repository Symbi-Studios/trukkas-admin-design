"use client";
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { PageHeader, StatCard, SectionCard, SearchField, TableToolbar, DataTable, Pagination, Badge, EmptyState, Skeleton, StatsPanel, Button } from "../ds.js";
import { DEFAULT_STATS_PERIOD, STATS_PERIODS, statsPeriod, statsPeriodRange } from "../domain/statsPeriod.js";
import { useGetAdminFeeSummaryQuery, emptyFeeSummary, feeMoney } from "../store/features/fees/feesApi.js";
import { useGetAdminFeeTransactionsQuery } from "../store/features/fees/feeTabsApi.js";
import { useFeeOperations } from "../store/features/fees/useFeeOperations.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { FilterChip } from "../components/FilterChip.jsx";
import { DateRangeFilter, EMPTY_RANGE } from "../components/finance/DateRangeFilter.jsx";
import { DateCell, MiddleId, Money, PartyCell } from "../components/finance/FinanceCells.jsx";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { TransactionDrawer } from "./TransactionDrawer.jsx";

// What the platform actually earns. Rates are set on Platform Rates; this page only reports.
const CATEGORIES = [
  { value: "", label: "All Sources" },
  { value: "PLATFORM", label: "Platform fees" },
  { value: "PROCESSING", label: "Processing fees" },
  { value: "SERVICE", label: "Terminal handling" },
];
const CATEGORY_TONE = { Platform: "info", Processing: "purple", Service: "teal" };
const PAGE_SIZE = 25;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function PlatformRevenue() {
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const operations = useFeeOperations();
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const summaryQuery = useGetAdminFeeSummaryQuery({ owner, period: "month", ...statsRange }, { skip: !authenticated });
  const s = authenticated && !summaryQuery.error ? summaryQuery.currentData?.summary || emptyFeeSummary : emptyFeeSummary;
  const metric = (value) => summaryQuery.isFetching && !summaryQuery.currentData ? <Skeleton as="span" width={96} height={23} /> : value;
  const vs = statsPeriod(statsPeriodKey).vs;

  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [category, setCategory] = useState("");
  const [dates, setDates] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const ledgerQuery = useGetAdminFeeTransactionsQuery({
    owner, page, limit: PAGE_SIZE, search: q, category, feeRuleId: "",
    dateFrom: dates.from || "2020-01-01", dateTo: dates.to || today(),
  }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const ledger = ledgerQuery.error ? null : ledgerQuery.currentData;
  const rows = ledger?.rows || [];
  const filtersActive = Boolean(category || dates.from || q.trim());
  const reset = () => { setCategory(""); setDates(EMPTY_RANGE); setQ(""); setPage(1); };

  return (
    <>
      <PageHeader crumbs={["Finance", "Platform Revenue"]} title="Platform Revenue"
        description="What Trukkas collects from jobs, wallet withdrawals and deposits. Terminal handling is collected on behalf of terminals and passed through."
        actions={<Button variant="outline" icon="download" disabled={operations.busy} onClick={() => void operations.download("report", "csv", null, { period: "month" })}>Revenue report</Button>} />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey} periods={STATS_PERIODS.filter((p) => p.key !== "all")}>
        <StatCard icon="wallet" tint="navy" label="Fees Collected" value={metric(feeMoney(s.totalFeesCollected))} delta={s.totalFeesCollectedDelta} caption={vs} />
        <StatCard icon="trending-up" tint="green" label="Net Platform Revenue" value={metric(feeMoney(s.netPlatformRevenue))} delta={s.netPlatformRevenueDelta} caption="after pass-through fees" />
        <StatCard icon="percent" tint="blue" label="Platform Fees" value={metric(feeMoney(s.totalPlatformFees))} delta={s.totalPlatformFeesDelta} caption={vs} />
        <StatCard icon="landmark" tint="purple" label="Processing Fees" value={metric(feeMoney(s.processingFees))} delta={s.processingFeesDelta} caption="withdrawals & deposits" />
        <StatCard icon="anchor" tint="teal" label="Terminal Handling" value={metric(feeMoney(s.serviceFees))} delta={s.serviceFeesDelta} caption="passed through to terminals" />
        <StatCard icon="chart-pie" tint="amber" label="Take Rate" value={metric(s.avgEffectiveRate)} delta={s.avgEffectiveRateDelta} caption="net revenue ÷ job value" />
      </StatsPanel>

      <SectionCard title="" pad="none" className="fin-table">
        <TableToolbar
          search={<SearchField placeholder="Search by reference, job, payer or fee…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterChip name="Source" icon="layers" value={category} allValue="" options={CATEGORIES} onChange={(v) => { setCategory(v); setPage(1); }} />
            <DateRangeFilter value={dates} onChange={(next) => { setDates(next); setPage(1); }} />
          </>}
          onClear={filtersActive ? reset : undefined}
          trailing={ledger?.totalAmount != null && <span className="fin-date" style={{ justifyItems: "end" }}><small>Collected in this view</small><Money value={ledger.totalAmount} /></span>}
        />
        {ledgerQuery.isFetching && !ledger ? <DriverTableLoading columns={7} label="Loading revenue" /> : ledgerQuery.error ? (
          <EmptyState icon="wallet" title="Unable to load revenue" description={getApiErrorMessage(ledgerQuery.error)} />
        ) : !rows.length ? (
          <EmptyState icon="wallet" title="No fees collected" description={filtersActive ? "Try adjusting your filters or search." : "Fees appear here as jobs are funded and wallets are withdrawn from."} />
        ) : <>
          <DataTable rows={rows} rowKey={(row) => row.id} onRowClick={(row) => row.transactionId && setOpenId(row.transactionId)}
            columns={[
              { key: "reference", header: "Reference", render: (row) => <MiddleId value={row.reference} head={10} label="reference" onOpen={row.transactionId ? () => setOpenId(row.transactionId) : undefined} /> },
              { key: "date", header: "Date", render: (row) => <DateCell date={row.createdAt} /> },
              { key: "fee", header: "Fee", render: (row) => <span className="fin-date"><span>{row.feeName}</span><small><Badge tone={CATEGORY_TONE[row.category] || "neutral"}>{row.category === "Service" ? "Terminal handling" : row.category}</Badge></small></span> },
              { key: "job", header: "Job ID", render: (row) => <MiddleId value={row.job} head={7} tail={6} label="job ID" /> },
              { key: "payer", header: "Paid By", render: (row) => <PartyCell name={row.payer} role={row.category === "Processing" ? null : "FORWARDER"} /> },
              { key: "amount", header: "Amount", align: "right", render: (row) => <Money value={row.amount} /> },
              { key: "status", header: "Status", render: (row) => <Badge dot>{row.status}</Badge> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={ledger?.pagination.total} pageCount={ledger?.pagination.totalPages || 1} onPage={(next) => setPage(Math.max(1, Math.min(next, ledger?.pagination.totalPages || 1)))} onPageSize={() => {}} />
        </>}
      </SectionCard>
      {openId && <TransactionDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
