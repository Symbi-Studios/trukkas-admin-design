"use client";
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  TableToolbar,
  SearchField,
  DataTable,
  Pagination,
  Badge,
  IconButton,
  DropdownMenu,
  Icon,
  EmptyState,
  Skeleton,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodDates, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetAdminTransactionLedgerQuery, useGetAdminTransactionStatsQuery, useLazyGetAdminTransactionReportQuery, downloadTransactionPdf,
  transactionInsights, transactionNumber, transactionMoney as formatNaira, transactionAmount,
} from "../store/features/transactions/transactionsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import styles from "./Transactions.module.css";
import { useUrlParams } from "../domain/urlState.js";
import { FilterChip, datePresetRange } from "../components/FilterChip.jsx";
import { DateRangeFilter } from "../components/DateRangeFilter.jsx";
import { DateCell, MiddleId, Money, PartyCell } from "../components/finance/FinanceCells.jsx";
import { TransactionDrawer, TRANSACTION_STATUS_TONE, TRANSACTION_TYPE_TONE } from "./TransactionDrawer.jsx";

const EMPTY_ROWS = [];

const PAGE_SIZE = 10;


const TYPE_OPTIONS = [
  "All Types",
  "Escrow",
  "Payment In",
  "Payment Out",
  "Payout",
  "Escrow Release",
  "Escrow Hold",
  "Wallet Funding",
  "Fee",
  "Refund",
  "Reversal",
];
const STATUS_OPTIONS = [
  "All Statuses",
  "Completed",
  "Pending",
  "Failed",
  "Reversed",
];
const RELATED_OPTIONS = [
  "All (Job, Trip, etc.)",
  "Job",
  "Trip",
  "Wallet",
  "Transaction",
  "System",
];

const DEFAULT_FILTERS = {
  type: "All Types",
  status: "All Statuses",
  related: RELATED_OPTIONS[0],
  party: "All Parties",
};

function relatedKind(relatedTo) {
  if (!relatedTo || relatedTo === "—") return null;
  if (relatedTo.startsWith("JOB-")) return "Job";
  if (relatedTo.startsWith("TRIP-")) return "Trip";
  if (relatedTo === "WALLET") return "Wallet";
  if (relatedTo.startsWith("TRX-")) return "Transaction";
  return null;
}

function downloadCsv(rows) {
  const header = [
    "Transaction ID",
    "Date",
    "Time",
    "Description",
    "Type",
    "Related To",
    "Party",
    "Amount",
    "Status",
    "Balance After",
  ];
  const body = rows.map((r) => [
    r.id,
    r.date,
    r.time,
    r.description,
    r.type,
    r.relatedTo,
    r.party,
    transactionAmount(r),
    r.status,
    r.balanceAfter ?? "—",
  ]);
  const csv = [header, ...body]
    .map((row) =>
      row.map((v) => {
        const raw = String(v ?? "");
        const safe = typeof v === "string" && /^\s*[=+@-]/.test(raw) ? `'${raw}` : raw;
        return `"${safe.replace(/"/g, '""')}"`;
      }).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


export function Transactions() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const ledgerQuery = useGetAdminTransactionLedgerQuery();
  const ledger = ledgerQuery.error ? null : ledgerQuery.currentData;
  const all = ledger?.rows || EMPTY_ROWS;
  const owner = useSelector((state) => state.auth.admin?.id);
  const [readReport, reportState] = useLazyGetAdminTransactionReportQuery();
  const operationPending = useRef(false);
  const busy = ledgerQuery.isFetching || reportState.isFetching;

  const DEFAULT_DATE = "Last 7 Days";
  const defaultFilters = useMemo(() => ({ ...DEFAULT_FILTERS, ...datePresetRange(DEFAULT_DATE) }), []);
  // Other finance pages link here with ?q=, ?type= or ?status=; those links search all dates.
  const url = useUrlParams();
  const [linkedFilters] = useState(() => {
    const type = url.get("type"), status = url.get("status");
    const linked = { ...(TYPE_OPTIONS.includes(type) ? { type } : {}), ...(STATUS_OPTIONS.includes(status) ? { status } : {}) };
    return Object.keys(linked).length || url.search() ? { ...defaultFilters, ...linked, from: "", to: "" } : defaultFilters;
  });
  const [applied, setApplied] = useState(linkedFilters);
  const [openId, setOpenId] = useState(null);
  const linkedId = url.get("id");
  useEffect(() => { if (linkedId) setOpenId(linkedId); }, [linkedId]);
  const setFilter = (key) => (value) => { setApplied((current) => ({ ...current, [key]: value })); setPage(1); };
  const setDate = (range) => { setApplied((current) => ({ ...current, ...range })); setPage(1); };
  const [q, setQ] = usePageSearchState(url.search(), () => setPage(1));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);

  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsDates = useMemo(() => statsPeriodDates(statsPeriodKey), [statsPeriodKey]);
  const statsQuery = useGetAdminTransactionStatsQuery({ from: statsDates.from, to: statsDates.to });
  const stats = statsQuery.error ? null : statsQuery.currentData;
  // The stat cards follow the stats period; the table and its filters keep their own dates.
  const statsInsights = useMemo(() => transactionInsights(ledger?.rows, statsDates.from, statsDates.to, stats), [ledger, statsDates.from, statsDates.to, stats]);
  const transactionSummary = statsInsights.summary;
  const metric = (value) => (!ledger && ledgerQuery.isFetching) || (!stats && statsQuery.isFetching) ? <Skeleton as="span" width={54} height={23} /> : value;

  async function viewReport() {
    if (operationPending.current || busy) return;
    operationPending.current = true;
    try { downloadTransactionPdf(await readReport({ from: applied.from, to: applied.to, owner }, false).unwrap()); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { operationPending.current = false; }
  }

  const partyOptions = useMemo(
    () => [
      "All Parties",
      ...Array.from(new Set(all.map((r) => r.party).filter((value) => value !== "—"))).sort(),
    ],
    [all],
  );

  const filtered = useMemo(() => {
    const { type, status, related, party, from, to } = applied;
    const fromD = from ? Date.parse(`${from}T00:00:00+01:00`) : null;
    const toD = to ? Date.parse(`${to}T23:59:59.999+01:00`) : null;
    return all.filter((r) => {
      const rd = r.timestamp;
      const inRange =
        (!from || (Number.isFinite(fromD) && rd != null && rd >= fromD)) &&
        (!to || (Number.isFinite(toD) && rd != null && rd <= toD));
      return (
        (type === "All Types" || r.filterTypes.includes(type)) &&
        (status === "All Statuses" || r.status === status) &&
        (related === RELATED_OPTIONS[0] ||
          (r.relatedKind || relatedKind(r.relatedTo)) === related) &&
        (party === "All Parties" || r.party === party) &&
        inRange &&
        (!q ||
          [
            r.id,
            r.displayId,
            r.relatedTo,
            r.party,
            r.description,
            r.reference?.customerRef,
          ].some((v) => v && v.toLowerCase().includes(q.toLowerCase())))
      );
    });
  }, [all, applied, q]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive =
    JSON.stringify(applied) !== JSON.stringify(defaultFilters);

  function handleReset() {
    setApplied(defaultFilters);
    setQ("");
    setPage(1);
    if (ledgerQuery.error) ledgerQuery.refetch();
    if (statsQuery.error) statsQuery.refetch();
  }
  return (
    <>
      <PageHeader
        crumbs={["Finance", "Transactions"]}
        title="Transactions"
        description="The ledger of every money movement: escrow, wallet top-ups, releases, payouts, fees and refunds."
      />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <StatCard
          icon="receipt"
          tint="navy"
          label="Total Transactions"
          value={metric(transactionNumber(transactionSummary.totalTransactions))}
          delta={transactionSummary.totalTransactionsDelta}
          caption={transactionSummary.comparisonCaption}
        />
        <StatCard
          icon="trending-up"
          tint="green"
          label="Total Inflow"
          value={metric(formatNaira(transactionSummary.totalInflow))}
          delta={transactionSummary.totalInflowDelta}
          caption={transactionSummary.comparisonCaption}
        />
        <StatCard
          icon="trending-down"
          tint="red"
          label="Total Outflow"
          value={metric(formatNaira(transactionSummary.totalOutflow))}
          delta={transactionSummary.totalOutflowDelta}
          direction="down"
          caption={transactionSummary.comparisonCaption}
        />
        <StatCard
          icon="arrow-left-right"
          tint="blue"
          label="Net Movement"
          value={metric(formatNaira(transactionSummary.netMovement))}
          delta={transactionSummary.netMovementDelta}
          caption={transactionSummary.comparisonCaption}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Successful Transactions"
          value={metric(transactionSummary.successfulCount == null ? "—" : `${transactionNumber(transactionSummary.successfulCount)} (${transactionSummary.successfulPct})`)}
          delta={transactionSummary.successfulDelta}
          caption={transactionSummary.comparisonCaption}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Failed / Reversed"
          value={metric(transactionSummary.failedReversedCount == null ? "—" : `${transactionNumber(transactionSummary.failedReversedCount)} (${transactionSummary.failedReversedPct})`)}
          delta={transactionSummary.failedReversedDelta}
          direction="down"
          caption={transactionSummary.comparisonCaption}
        />
      </StatsPanel>

      <div
        className={styles.layout}
        style={{
          display: "grid",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <SectionCard title="" pad="none" className={styles.panel} style={{ paddingTop: 4 }}>




          <TableToolbar
            search={<SearchField placeholder="Search by reference, job, party or description…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={<>
              <FilterChip name="Type" icon="receipt" value={applied.type} allValue="All Types" options={TYPE_OPTIONS} onChange={setFilter("type")} />
              <FilterChip name="Status" icon="circle-dot" value={applied.status} allValue="All Statuses" options={STATUS_OPTIONS} onChange={setFilter("status")} />
              <FilterChip name="Related To" icon="link" value={applied.related} allValue={RELATED_OPTIONS[0]} options={RELATED_OPTIONS} onChange={setFilter("related")} />
              <FilterChip name="Party" icon="user" value={applied.party} allValue="All Parties" options={partyOptions} onChange={setFilter("party")} />
              <DateRangeFilter value={{ from: applied.from, to: applied.to }} onChange={setDate} />
            </>}
            onClear={filtersActive || q ? handleReset : undefined}
            viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
            trailing={<>
              <Button variant="outline" icon="file-text" disabled={busy || !applied.from || !applied.to} title={!applied.from || !applied.to ? "Pick a date range to download a report" : undefined} onClick={() => void viewReport()}>Report</Button>
              <Button variant="outline" icon="download" disabled={!ledger || ledgerQuery.isFetching} onClick={() => downloadCsv(selected.length ? filtered.filter((r) => selected.includes(r.id)) : filtered)}>
                {selected.length ? `Export ${selected.length}` : "Export"}
              </Button>
            </>}
          />

          {!ledger && ledgerQuery.isFetching ? <DriverTableLoading columns={10} label="Loading transactions" /> : (
            <>
              <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.transactions} boardOnRowClick={(row) => setOpenId(row.id)} view={tableView} boardGroupBy={(row) => row.status}
                rows={paged}
                rowKey={(r) => r.id}
                selectable
                selected={selected}
                onSelect={setSelected}
                onRowClick={(r) => setOpenId(r.id)}
                columns={[
                  { key: "id", header: "Reference", render: (r) => <MiddleId value={r.displayId} head={10} label="reference" onOpen={() => setOpenId(r.id)} /> },
                  { key: "date", header: "Date", render: (r) => <DateCell date={r.date} time={r.time} /> },
                  { key: "description", header: "Description", render: (r) => <span className="fin-date" style={{ maxWidth: 280, whiteSpace: "normal" }}><span>{r.description}</span></span> },
                  { key: "type", header: "Type", render: (r) => <Badge tone={TRANSACTION_TYPE_TONE[r.type] || "neutral"}>{r.type}</Badge> },
                  { key: "party", header: "Party", render: (r) => <PartyCell name={r.party} role={r.partyRole} /> },
                  { key: "amount", header: "Amount", align: "right", render: (r) => <Money value={r.amount} signed positive={r.pos} /> },
                  { key: "status", header: "Status", render: (r) => <Badge tone={TRANSACTION_STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
                ]}
              />
              {tableView === 'list' && filtered.length === 0 && <EmptyState icon="receipt" title="No transactions found"
                description={ledgerQuery.error || statsQuery.error ? getApiErrorMessage(ledgerQuery.error || statsQuery.error) : "Try adjusting your filters or search."} />}
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
                onPage={setPage}
                onPageSize={() => {}}
              />
            </>
          )}
        </SectionCard>

      </div>
      {openId && <TransactionDrawer id={openId} row={all.find((row) => row.id === openId)} onClose={() => setOpenId(null)} />}
    </>
  );
}
