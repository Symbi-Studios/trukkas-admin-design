"use client";
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useMemo, useState } from "react";
import { useSelector } from 'react-redux';
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Tabs,
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
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetAdminSettlementsQuery, useGetAdminSettlementSummaryQuery, emptySettlementInsights,
  settlementMoney as formatNaira, settlementNumber, settlementMillions,
  settlementDetailUrl, exportSettlementRows,
} from '../store/features/settlements/settlementsApi.js';
import { useSettlementOperations } from '../store/features/settlements/useSettlementOperations.js';
import { settlementDateParams, settlementDateLabel } from '../store/features/settlements/settlementDates.js';
import { SettlementDateRangeDialog } from './SettlementDateRangeDialog.jsx';
import { DriverTableLoading } from './DriversLoading.jsx';
import { initialSearch, initialTab } from '../domain/urlState.js';
import { DATE_PRESETS, FilterChip, datePresetRange } from '../components/FilterChip.jsx';
import styles from './Settlements.module.css';

// A settlement is money paid to a party: escrow releases (mobilisation, final payment,
// dispute settlements and refunds) credit wallets; bank payouts move wallet money to a bank.
// Withdrawal requests are reviewed on Payouts. Driver and vendor payments don't exist on the platform.
const TABS = [
  "All Settlements",
  "Escrow Releases",
  "Bank Payouts",
];
const TYPE_OPTIONS = ["All Types", "Mobilization", "Final Payment", "Dispute Settlement", "Customer Refund", "Bank Payout"];
const PAGE_SIZE = 10;


function RowMenu({ items, id, menuFor, setMenuFor }) {
  return (
    <span style={{ position: "relative" }}>
      <IconButton
        icon="ellipsis-vertical"
        onClick={() => setMenuFor(menuFor === id ? null : id)}
      />
      {menuFor === id && (
        <span
          style={{ position: "absolute", right: 0, top: 34, zIndex: 30 }}
          onMouseLeave={() => setMenuFor(null)}
        >
          <DropdownMenu width={190} items={items} />
        </span>
      )}
    </span>
  );
}

const STATUS_TONE = {
  Completed: "success",
  Pending: "warning",
  "On Hold": "info",
  Failed: "danger",
};
const TYPE_TONE = {
  Mobilization: "blue",
  "Final Payment": "purple",
  "Dispute Settlement": "teal",
  "Customer Refund": "orange",
  "Bank Payout": "neutral",
};

export function Settlements() {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <SettlementsScreen key={String(owner)+':'+String(role)+':'+authenticated} />;
}
function SettlementsScreen() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => initialTab(TABS, "All Settlements"));
  const [groupBy, setGroupBy] = useState("Group by Job");
  const [q, setQ] = usePageSearchState(initialSearch(), () => setPage(1));
  const [settlementType, setSettlementType] = useState("All Types");
  const [status, setStatus] = useState("All Status");
  const [payerType, setPayerType] = useState("All Payers");
  const [payeeType, setPayeeType] = useState("All Payees");
  const [method, setMethod] = useState("All Methods");
  const [sort, setSort] = useState("Newest First");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [menuFor, setMenuFor] = useState(null);

  const [datePreset, setDatePreset] = useState("Last 30 Days");
  const [dateRange,setDateRange] = useState(() => datePresetRange("Last 30 Days"));
  const [dateDialogOpen,setDateDialogOpen] = useState(false);
  const dateParams = settlementDateParams(dateRange);
  const dateLabel = settlementDateLabel(dateRange);
  const operations = useSettlementOperations();
  const query = useGetAdminSettlementsQuery({ owner: operations.owner, role: operations.role, groupBy: groupBy === 'Group by Trip' ? 'trip' : 'job', payerBusinessType: ({ Importer:'IMPORTER', Customer:'CUSTOMER', Internal:'INTERNAL' })[payerType], ...dateParams }, { skip: !operations.authenticated });
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const summaryQuery = useGetAdminSettlementSummaryQuery({ owner: operations.owner, role: operations.role, ...statsRange }, { skip: !operations.authenticated });
  const all = useMemo(() => operations.authenticated && !query.error ? query.currentData || [] : [], [query.currentData, query.error, operations.authenticated]);
  const { summary: settlementSummary } = operations.authenticated && !summaryQuery.error ? summaryQuery.currentData || emptySettlementInsights : emptySettlementInsights;
  const filtersActive = settlementType !== "All Types" || status !== "All Status" || payerType !== "All Payers" || payeeType !== "All Payees"
    || method !== "All Methods" || groupBy !== "Group by Job" || datePreset !== "Last 30 Days" || sort !== "Newest First" || Boolean(q.trim());
  function resetFilters() {
    setSettlementType("All Types"); setStatus("All Status"); setPayerType("All Payers"); setPayeeType("All Payees"); setMethod("All Methods");
    setGroupBy("Group by Job"); setDatePreset("Last 30 Days"); setDateRange(datePresetRange("Last 30 Days")); setSort("Newest First"); setQ(""); setPage(1);
  }
  const loading = query.isLoading || (query.isFetching && !query.currentData);
  const value = (content) => summaryQuery.isLoading || summaryQuery.isFetching && !summaryQuery.currentData ? <Skeleton as="span" width={90} height={23} /> : content;

  const tabFiltered = useMemo(() => {
    if (tab === "Escrow Releases") return all.filter((s) => s.isEscrowRelease);
    if (tab === "Bank Payouts") return all.filter((s) => s.isBankPayout);
    return all;
  }, [all, tab]);
  const filtered = useMemo(() => {
    let rows = tabFiltered.filter(
      (s) =>
        (settlementType === "All Types" || s.type === settlementType) &&
        (status === "All Status" || s.status === status || status === "Pending" && s.statusCode === "PROCESSING") &&
        (payerType === "All Payers" || s.payerType === payerType) &&
        (payeeType === "All Payees" || s.payeeType === payeeType) &&
        (method === "All Methods" || s.method === method) &&
        (!q ||
          [s.id, s.relatedTo, s.payer, s.payee, s.escrowId, ...s.transactionReferences, ...s.transactionIds].some(
            (v) => v && v.toLowerCase().includes(q.toLowerCase()),
          )),
    );
    rows = [...rows].sort((a, b) => {
      const aTime = Date.parse(a.sortAt), bTime = Date.parse(b.sortAt);
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
      if (!Number.isFinite(bTime)) return -1;
      return sort === "Newest First" ? bTime - aTime : aTime - bTime;
    });
    return rows;
  }, [
    tabFiltered,
    settlementType,
    status,
    payerType,
    payeeType,
    method,
    q,
    sort,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const knownCollection = operations.authenticated && query.isSuccess && !query.error;

  return (
    <>
      <PageHeader
        crumbs={["Finance", "Settlements"]}
        title="Settlements"
        description="Money paid out to parties: escrow releases to truckers, refunds to forwarders, and wallet-to-bank payouts."
      />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <StatCard
          icon="wallet"
          tint="navy"
          label="Total Settlements"
          value={value(formatNaira(settlementSummary.totalSettlements))}
          delta={settlementSummary.totalSettlementsDelta}
          direction={settlementSummary.totalSettlementsDirection}
          caption={settlementSummary.comparisonCaption}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Completed Settlements"
          value={value(formatNaira(settlementSummary.completedSettlements))}
          delta={settlementSummary.completedSettlementsDelta}
          direction={settlementSummary.completedSettlementsDirection}
          caption={settlementSummary.comparisonCaption}
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Settlements"
          value={value(formatNaira(settlementSummary.pendingSettlements))}
          delta={settlementSummary.pendingSettlementsDelta}
          direction={settlementSummary.pendingSettlementsDirection}
          caption={settlementSummary.comparisonCaption}
        />
        <StatCard
          icon="circle-pause"
          tint="purple"
          label="On Hold"
          value={value(formatNaira(settlementSummary.onHold))}
          delta={settlementSummary.onHoldDelta}
          direction={settlementSummary.onHoldDirection}
          caption={settlementSummary.comparisonCaption}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Failed Settlements"
          value={value(formatNaira(settlementSummary.failedSettlements))}
          delta={settlementSummary.failedSettlementsDelta}
          direction={settlementSummary.failedSettlementsDirection}
          caption={settlementSummary.comparisonCaption}
        />
        <StatCard
          icon="timer"
          tint="blue"
          label="Avg. Settlement Time"
          value={value(settlementSummary.avgSettlementTime ?? "—")}
          delta={settlementSummary.avgSettlementTimeDelta}
          direction={settlementSummary.avgSettlementTimeDirection}
          caption={settlementSummary.comparisonCaption}
        />
      </StatsPanel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />
          {tab === "Bank Payouts" && (
            <p className="tk-meta" style={{ margin: "12px var(--tk-card-pad) 0" }}>
              Withdrawal requests are approved or rejected on <Link to="/payouts">Payouts</Link>; this tab shows the resulting bank transfers.
            </p>
          )}

          <TableToolbar
            search={<SearchField placeholder="Search by settlement ID, job, payer, payee or reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
            filters={<>
              <FilterChip name="Type" icon="coins" value={settlementType} allValue="All Types" options={TYPE_OPTIONS} onChange={(v) => { setSettlementType(v); setPage(1); }} />
              <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Status" options={["All Status", "Completed", "Pending", "On Hold", "Failed"]} onChange={(v) => { setStatus(v); setPage(1); }} />
              <FilterChip name="Payer" icon="arrow-up-right" value={payerType} allValue="All Payers" options={["All Payers", "Importer", "Customer", "Internal"]} onChange={(v) => { setPayerType(v); setPage(1); }} />
              <FilterChip name="Payee" icon="arrow-down-left" value={payeeType} allValue="All Payees" options={["All Payees", "Transporter", "Customer"]} onChange={(v) => { setPayeeType(v); setPage(1); }} />
              <FilterChip name="Method" icon="wallet" value={method} allValue="All Methods" options={["All Methods", "Bank Transfer", "Wallet"]} onChange={(v) => { setMethod(v); setPage(1); }} />
              <FilterChip name="Grouping" icon="layers" value={groupBy} allValue="Group by Job" options={["Group by Job", "Group by Trip"]} onChange={(v) => { setGroupBy(v); setPage(1); }} />
              <FilterChip name="Date" icon="calendar" value={datePreset} allValue="All Dates"
                options={[...DATE_PRESETS, { value: "Custom", label: datePreset === "Custom" ? dateLabel : "Custom range…" }]}
                onChange={(v) => { if (v === "Custom") { setDateDialogOpen(true); return; } setDatePreset(v); setDateRange(datePresetRange(v)); setPage(1); }} />
              <FilterChip name="Sort" icon="arrow-down-up" value={sort} allValue="Newest First" options={["Newest First", "Oldest First"]} onChange={setSort} />
            </>}
            onClear={filtersActive ? resetFilters : undefined}
            viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
            trailing={<>
              <Button variant="outline" icon="file-text" disabled={!dateParams} onClick={() => void operations.downloadReport(dateParams)}>Report</Button>
              <Button variant="outline" icon="download" disabled={loading || !knownCollection} onClick={() => exportSettlementRows(filtered)}>Export</Button>
            </>}
          />

          {loading ? (
            <DriverTableLoading columns={10} label="Loading settlements" />
          ) : knownCollection && filtered.length === 0 && tableView !== 'board' ? (
            <EmptyState
              icon="coins"
              title="No settlements found"
              description="Try adjusting your filters or search."
            />
          ) : (
            <>
              <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.settlements} boardOnRowClick={(row) => navigate(settlementDetailUrl(row))} view={tableView} boardGroupBy={(row) => row.status}
                rows={paged}
                rowKey={(r) => r.key}
                columns={[
                  {
                    key: "id",
                    header: "Settlement ID",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <Link to={settlementDetailUrl(r)} className="tk-mono">
                          {r.id}
                        </Link>
                      </span>
                    ),
                  },
                  {
                    key: "relatedTo",
                    header: "Related To",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            font: "500 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-700)",
                          }}
                        >
                          {r.route}
                        </span>
                        <span className="tk-meta">{r.relatedTo}</span>
                      </span>
                    ),
                  },
                  {
                    key: "payer",
                    header: "Payer",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <span>{r.payer}</span>
                        <span className="tk-meta">{r.payerType}</span>
                      </span>
                    ),
                  },
                  {
                    key: "payee",
                    header: "Payee",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <span>{r.payee}</span>
                        <span className="tk-meta">{r.payeeType}</span>
                      </span>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Amount (₦)",
                    align: "right",
                    render: (r) => <b>{settlementNumber(r.amount)}</b>,
                  },
                  {
                    key: "type",
                    header: "Settlement Type",
                    render: (r) => (
                      <Badge tone={TYPE_TONE[r.type] || "neutral"}>
                        {r.type}
                      </Badge>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => (
                      <Badge tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Badge>
                    ),
                  },
                  {
                    key: "settledOn",
                    header: "Settled On",
                    render: (r) =>
                      r.settledOn !== "—" ? (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{r.settledOn}</span>
                          <span className="tk-meta">{r.settledTime}</span>
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "method", header: "Method" },
                  {
                    key: "x",
                    header: "",
                    width: 44,
                    render: (r) => (
                      <RowMenu
                        id={r.key}
                        menuFor={menuFor}
                        setMenuFor={setMenuFor}
                        items={[
                          {
                            label: "View Settlement",
                            icon: "eye",
                            onClick: () => {
                              setMenuFor(null);
                              navigate(settlementDetailUrl(r));
                            },
                          },
                          ...(r.status === "Failed"
                            ? [
                                {
                                  label: "Retry Settlement",
                                  icon: "rotate-ccw",
                                  onClick: () => {
                                    setMenuFor(null);
                                    void operations.settle(r, "retry");
                                  },
                                },
                              ]
                            : []),
                          ...(r.status === "Pending" || r.status === "On Hold"
                            ? [
                                {
                                  label: "Approve & Settle",
                                  icon: "circle-check",
                                  onClick: () => {
                                    setMenuFor(null);
                                    void operations.settle(r, "approve");
                                  },
                                },
                              ]
                            : []),
                          { divider: true },
                          { label: "Download Receipt", icon: "file-text", onClick: () => { void operations.download(r); setMenuFor(null); } },
                        ]}
                      />
                    ),
                  },
                ]}
              />
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                total={knownCollection ? filtered.length : undefined}
                pageCount={pageCount}
                onPage={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                onPageSize={(size) => { setPageSize(size); setPage(1); }}
              />
            </>
          )}
        </SectionCard>

      </div>
      {dateDialogOpen && <SettlementDateRangeDialog range={dateRange} onClose={() => setDateDialogOpen(false)} onApply={next => {
        if (!settlementDateParams(next)) return;
        setDateRange({ ...next }); setDatePreset("Custom"); setPage(1); setMenuFor(null); setDateDialogOpen(false);
      }} />}
    </>
  );
}
