"use client";

import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Tabs,
  TableToolbar,
  SearchField,
  Select,
  TextField,
  DataTable,
  Pagination,
  Badge,
  DonutChart,
  LegendList,
  IconButton,
  DropdownMenu,
  Icon,
  AlertRow,
  EmptyState,
  FilterSelect,
  Skeleton,
} from "../ds.js";
import {
  useGetAdminTransactionLedgerQuery, useRetryAdminTransactionMutation, useReverseAdminTransactionMutation,
  useGetAdminTransactionStatsQuery, useLazyGetAdminTransactionDetailQuery, useLazyGetAdminTransactionReceiptQuery, downloadTransactionPdf,
  transactionInsights, transactionNumber, transactionMoney as formatNaira, transactionAmount, transactionDetailUrl,
} from "../store/features/transactions/transactionsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import styles from "./Transactions.module.css";

const EMPTY_ROWS = [];

const TABS = [
  "All Transactions",
  "Escrow",
  "Payments In",
  "Payments Out",
  "Wallet Transfers",
  "Settlements",
  "Refunds",
  "Fees & Charges",
  "Reversals",
];
const PAGE_SIZE = 10;

const STATUS_TONE = {
  Completed: "success",
  Pending: "warning",
  Failed: "danger",
  Reversed: "orange",
};
const TYPE_TONE = {
  "Payment In": "success",
  "Payment Out": "orange",
  Payout: "purple",
  "Escrow Release": "info",
  "Escrow Hold": "neutral",
  "Wallet Funding": "teal",
  Fee: "orange",
  Refund: "warning",
  Reversal: "danger",
};

const TYPE_OPTIONS = [
  "All Types",
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

const DATE_PRESETS = {
  "May 24 – May 30, 2026": ["2026-05-24", "2026-05-30"],
  "May 17 – May 23, 2026": ["2026-05-17", "2026-05-23"],
  "May 10 – May 16, 2026": ["2026-05-10", "2026-05-16"],
  "This Month (May 2026)": ["2026-05-01", "2026-05-31"],
};

const DEFAULT_FILTERS = {
  type: "All Types",
  status: "All Statuses",
  related: RELATED_OPTIONS[0],
  party: "All Parties",
  from: DATE_PRESETS["May 24 – May 30, 2026"][0],
  to: DATE_PRESETS["May 24 – May 30, 2026"][1],
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

function DateRangeButton({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <FilterSelect
        label={value}
        icon="calendar"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <span
          style={{ position: "absolute", right: 0, top: 44, zIndex: 30 }}
          onMouseLeave={() => setOpen(false)}
        >
          <DropdownMenu
            width={220}
            items={Object.keys(DATE_PRESETS).map((k) => ({
              label: k,
              icon: k === value ? "check" : undefined,
              onClick: () => {
                onChange(k);
                setOpen(false);
              },
            }))}
          />
        </span>
      )}
    </span>
  );
}

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
          <DropdownMenu width={200} items={items} />
        </span>
      )}
    </span>
  );
}

export function Transactions() {
  const navigate = useNavigate();
  const ledgerQuery = useGetAdminTransactionLedgerQuery();
  const ledger = ledgerQuery.error ? null : ledgerQuery.currentData;
  const all = ledger?.rows || EMPTY_ROWS;
  const canReverse = useSelector((state) => state.auth.admin?.role) === "SUPER_ADMIN";
  const [retryTransaction, retryState] = useRetryAdminTransactionMutation();
  const [reverseTransaction, reverseState] = useReverseAdminTransactionMutation();
  const [readTransaction, detailState] = useLazyGetAdminTransactionDetailQuery();
  const [readReceipt, receiptState] = useLazyGetAdminTransactionReceiptQuery();
  const operationPending = useRef(false);
  const busy = retryState.isLoading || reverseState.isLoading || ledgerQuery.isFetching || detailState.isFetching || receiptState.isFetching;

  const [tab, setTab] = useState("All Transactions");
  const [dateLabel, setDateLabel] = useState("May 24 – May 30, 2026");
  const [showFilters, setShowFilters] = useState(true);
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);
  const [selected, setSelected] = useState([]);

  const statsQuery = useGetAdminTransactionStatsQuery({ from: applied.from, to: applied.to });
  const stats = statsQuery.error ? null : statsQuery.currentData;
  const insights = useMemo(() => transactionInsights(ledger?.rows, applied.from, applied.to, stats), [ledger, applied.from, applied.to, stats]);
  const transactionSummary = insights.summary;
  const transactionVolumeBreakdown = insights.volume;
  const transactionStatusBreakdown = insights.statuses;
  const transactionAlerts = insights.alerts;
  const metric = (value) => (!ledger && ledgerQuery.isFetching) || (!stats && statsQuery.isFetching) ? <Skeleton as="span" width={54} height={23} /> : value;

  async function downloadReceipt(row) {
    if (operationPending.current || busy) return;
    setMenuFor(null); operationPending.current = true;
    try { downloadTransactionPdf(await readReceipt(row.id, false).unwrap()); }
    catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { operationPending.current = false; }
  }

  async function handleMutation(row, reverse = false) {
    if (operationPending.current || busy) return;
    setMenuFor(null);
    if (reverse && !canReverse) { window.alert("Reversing transactions requires Super Admin access."); return; }
    if (row.statusCode !== (reverse ? "COMPLETED" : "FAILED")) return;
    operationPending.current = true;
    try {
      if (reverse) {
        const detail = await readTransaction(row.id, false).unwrap();
        if (detail.statusCode !== 'COMPLETED' || detail.actions.canReverse !== true) {
          window.alert(detail.actions.reverseReason || 'Reversing this transaction is not available yet.'); return;
        }
      }
      await (reverse ? reverseTransaction : retryTransaction)(row.id).unwrap();
    } catch (error) {
      window.alert(getApiErrorMessage(error));
    } finally {
      operationPending.current = false;
    }
  }

  const partyOptions = useMemo(
    () => [
      "All Parties",
      ...Array.from(new Set(all.map((r) => r.party).filter((value) => value !== "—"))).sort(),
    ],
    [all],
  );

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "Escrow":
        return all.filter((r) => r.isEscrow);
      case "Payments In":
        return all.filter((r) => r.pos === true);
      case "Payments Out":
        return all.filter((r) => r.pos === false);
      case "Wallet Transfers":
        return all.filter((r) => r.type === "Wallet Funding");
      case "Settlements":
        return all.filter((r) => r.isSettlement);
      case "Refunds":
        return all.filter((r) => r.type === "Refund");
      case "Fees & Charges":
        return all.filter((r) => r.type === "Fee");
      case "Reversals":
        return all.filter(
          (r) => r.type === "Reversal" || r.status === "Reversed",
        );
      default:
        return all;
    }
  }, [all, tab]);

  const filtered = useMemo(() => {
    const { type, status, related, party, from, to } = applied;
    const fromD = from ? Date.parse(`${from}T00:00:00+01:00`) : null;
    const toD = to ? Date.parse(`${to}T23:59:59.999+01:00`) : null;
    return tabFiltered.filter((r) => {
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
  }, [tabFiltered, applied, q]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersActive =
    JSON.stringify(applied) !== JSON.stringify(DEFAULT_FILTERS);

  function handleApply() {
    setApplied(draft);
    setPage(1);
  }
  function handleReset() {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setQ("");
    setPage(1);
    if (ledgerQuery.error) ledgerQuery.refetch();
    if (statsQuery.error) statsQuery.refetch();
  }
  function jumpToStatus(status) {
    const next = { ...DEFAULT_FILTERS, status };
    setDraft(next);
    setApplied(next);
    setTab("All Transactions");
    setPage(1);
  }
  function resetToAll() {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setQ("");
    setTab("All Transactions");
    setPage(1);
  }

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Transactions"]}
        title="Transactions"
        description="Track all money movements across escrow, wallets, settlements and payouts."
        actions={
          <>
            <DateRangeButton
              value={dateLabel}
              onChange={(k) => {
                setDateLabel(k);
                const [from, to] = DATE_PRESETS[k];
                setDraft((d) => ({ ...d, from, to }));
                setApplied((a) => ({ ...a, from, to }));
                setPage(1);
              }}
            />
            <Button
              variant="outline"
              icon="filter"
              onClick={() => setShowFilters((s) => !s)}
            >
              Filters
            </Button>
            <Button
              variant="outline"
              icon="download"
              disabled={!ledger || ledgerQuery.isFetching}
              onClick={() =>
                downloadCsv(
                  selected.length
                    ? filtered.filter((r) => selected.includes(r.id))
                    : filtered,
                )
              }
            >
              Export
            </Button>
          </>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--tk-space-4)",
        }}
      >
        <StatCard
          icon="receipt"
          tint="navy"
          label="Total Transactions"
          value={metric(transactionNumber(transactionSummary.totalTransactions))}
          delta={transactionSummary.totalTransactionsDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="trending-up"
          tint="green"
          label="Total Inflow"
          value={metric(formatNaira(transactionSummary.totalInflow))}
          delta={transactionSummary.totalInflowDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="trending-down"
          tint="red"
          label="Total Outflow"
          value={metric(formatNaira(transactionSummary.totalOutflow))}
          delta={transactionSummary.totalOutflowDelta}
          direction="down"
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="arrow-left-right"
          tint="blue"
          label="Net Movement"
          value={metric(formatNaira(transactionSummary.netMovement))}
          delta={transactionSummary.netMovementDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Successful Transactions"
          value={metric(transactionSummary.successfulCount == null ? "—" : `${transactionNumber(transactionSummary.successfulCount)} (${transactionSummary.successfulPct})`)}
          delta={transactionSummary.successfulDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Failed / Reversed"
          value={metric(transactionSummary.failedReversedCount == null ? "—" : `${transactionNumber(transactionSummary.failedReversedCount)} (${transactionSummary.failedReversedPct})`)}
          delta={transactionSummary.failedReversedDelta}
          direction="down"
          caption="vs May 17 – May 23"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: "var(--tk-grid-gap)",
          alignItems: "start",
        }}
      >
        <SectionCard title="" pad="none" className={styles.panel} style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />

          {showFilters && (
            <div className={styles.filters}
              style={{
                display: "grid",
                gap: 10,
                padding: "14px var(--tk-card-pad) 0",
              }}
            >
              <Select
                label="Transaction Type"
                value={draft.type}
                options={TYPE_OPTIONS}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, type: e.target.value }))
                }
              />
              <Select
                label="Status"
                value={draft.status}
                options={STATUS_OPTIONS}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value }))
                }
              />
              <TextField
                label="From Date"
                type="date"
                icon="calendar"
                value={draft.from}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, from: e.target.value }))
                }
              />
              <TextField
                label="To Date"
                type="date"
                icon="calendar"
                value={draft.to}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, to: e.target.value }))
                }
              />
              <Select
                label="Related To"
                value={draft.related}
                options={RELATED_OPTIONS}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, related: e.target.value }))
                }
              />
              <Select
                label="Party"
                value={draft.party}
                options={partyOptions}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, party: e.target.value }))
                }
              />
            </div>
          )}

          <TableToolbar
            search={
              <SearchField
                placeholder="Search transactions (reference, job ID, customer...)"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            }
            trailing={
              <>
                <Button
                  variant="outline"
                  icon="rotate-ccw"
                  onClick={handleReset}
                >
                  Reset
                </Button>
                <Button icon="check" onClick={handleApply}>
                  Apply
                </Button>
              </>
            }
            onClear={filtersActive || q ? handleReset : undefined}
          />

          {!ledger && ledgerQuery.isFetching ? <DriverTableLoading columns={10} label="Loading transactions" /> : filtered.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No transactions found"
              description={ledgerQuery.error || statsQuery.error ? getApiErrorMessage(ledgerQuery.error || statsQuery.error) : "Try adjusting your filters or search."}
            />
          ) : (
            <>
              <DataTable
                rows={paged}
                rowKey={(r) => r.id}
                selectable
                selected={selected}
                onSelect={setSelected}
                columns={[
                  {
                    key: "date",
                    header: "Date & Time",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <span>{r.date}</span>
                        <span className="tk-meta">{r.time}</span>
                      </span>
                    ),
                  },
                  {
                    key: "id",
                    header: "Reference",
                    render: (r) => (
                      <Link to={transactionDetailUrl(r.id)} className="tk-mono">
                        {r.displayId}
                      </Link>
                    ),
                  },
                  {
                    key: "description",
                    header: "Description",
                    render: (r) => (
                      <span style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            font: "500 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-700)",
                          }}
                        >
                          {r.description}
                        </span>
                        <span className="tk-meta">{r.relatedTo}</span>
                      </span>
                    ),
                  },
                  {
                    key: "type",
                    header: "Type",
                    render: (r) => (
                      <Badge tone={TYPE_TONE[r.type] || "neutral"}>
                        {r.type}
                      </Badge>
                    ),
                  },
                  {
                    key: "relatedTo",
                    header: "Related To",
                    render: (r) => (
                      <span className="tk-mono">{r.relatedTo}</span>
                    ),
                  },
                  { key: "party", header: "Party" },
                  {
                    key: "amount",
                    header: "Amount (₦)",
                    align: "right",
                    render: (r) => (
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: r.pos
                            ? "var(--tk-success)"
                            : "var(--tk-danger)",
                        }}
                      >
                        {transactionAmount(r)}
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
                    key: "balanceAfter",
                    header: "Balance After",
                    align: "right",
                    render: (r) => transactionNumber(r.balanceAfter),
                  },
                  {
                    key: "x",
                    header: "Actions",
                    width: 44,
                    render: (r) => (
                      <RowMenu
                        id={r.id}
                        menuFor={menuFor}
                        setMenuFor={setMenuFor}
                        items={[
                          {
                            label: "View Transaction",
                            icon: "eye",
                            onClick: () => {
                              setMenuFor(null);
                              navigate(transactionDetailUrl(r.id));
                            },
                          },
                          {
                            label: "Copy Reference",
                            icon: "copy",
                            onClick: () => {
                              navigator.clipboard?.writeText(r.displayId);
                              setMenuFor(null);
                            },
                          },
                          { divider: true },
                          ...(r.status === "Failed"
                            ? [
                                {
                                  label: "Retry Transaction",
                                  icon: "rotate-ccw",
                                  onClick: () => {
                                    handleMutation(r);
                                  },
                                },
                              ]
                            : []),
                          ...(r.status === "Completed"
                            ? [
                                {
                                  label: "Reverse Transaction",
                                  icon: "undo-2",
                                  tone: "danger",
                                  onClick: () => {
                                    handleMutation(r, true);
                                  },
                                },
                              ]
                            : []),
                          { label: "Download Receipt", icon: "file-text", disabled: busy, onClick: () => downloadReceipt(r) },
                        ]}
                      />
                    ),
                  },
                ]}
              />
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

        <div
          style={{
            display: "grid",
            gap: "var(--tk-grid-gap)",
            alignContent: "start",
          }}
        >
          <SectionCard
            title="Transaction Summary"
            footer={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.alert("Transaction reports are not available yet.");
                }}
              >
                View Report →
              </a>
            }
          >
            <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
              <DonutChart
                size={180}
                thickness={18}
                centerValue={formatNaira(insights.volumeTotal)}
                centerLabel="Total Volume"
                data={transactionVolumeBreakdown.filter((d) => d.pct != null).map((d) => ({
                  label: d.label,
                  value: d.pct,
                  color: d.color,
                }))}
              />
              <LegendList
                style={{ width: "100%" }}
                items={transactionVolumeBreakdown.map((d) => ({
                  label: d.label,
                  value: d.pct,
                  display: d.amount == null || d.pct == null ? "—" : `${formatNaira(d.amount)} (${d.pct}%)`,
                  color: d.color,
                }))}
                showShare={false}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Transaction Status"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  resetToAll();
                }}
              >
                View All
              </a>
            }
          >
            {transactionStatusBreakdown.map((s) => (
              <div
                key={s.label}
                onClick={() => jumpToStatus(s.label)}
                role="button"
                tabIndex={0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderTop: "1px solid var(--tk-line)",
                  cursor: "pointer",
                }}
              >
                <Icon
                  name={s.icon}
                  size={16}
                  color={`var(--tk-${s.tone === "info" ? "blue" : s.tone})`}
                />
                <span
                  style={{
                    flex: 1,
                    font: "500 13px/18px var(--tk-font-sans)",
                    color: "var(--tk-ink-700)",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    font: "600 13px/18px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  {transactionNumber(s.count)} transactions
                </span>
                <span className="tk-meta">{s.pct}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard
            title="Recent Transactions"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  resetToAll();
                }}
              >
                View All
              </a>
            }
          >
            {!all.length && !ledgerQuery.isFetching && <span className="tk-meta">—</span>}
            {all.slice(0, 5).map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: "1px solid var(--tk-line)",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--tk-r-sm)",
                    background: "var(--tk-blue-soft)",
                    color: "var(--tk-blue)",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name="receipt" size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={transactionDetailUrl(r.id)}
                    style={{
                      display: "block",
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.displayId}
                  </Link>
                  <span
                    className="tk-meta"
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.description}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: r.pos ? "var(--tk-success)" : "var(--tk-danger)",
                    }}
                  >
                    {transactionAmount(r, true)}
                  </div>
                  <span className="tk-meta">
                    {r.date === "Just now" ? "just now" : `${r.date} ${r.time}`}
                  </span>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard
            title="Transaction Alerts"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  jumpToStatus("Failed");
                }}
              >
                View All
              </a>
            }
          >
            {!transactionAlerts.length && <span className="tk-meta">{statsQuery.error ? getApiErrorMessage(statsQuery.error) : '—'}</span>}
            {transactionAlerts.map((a, i) => (
              <AlertRow
                key={i}
                icon={a.icon}
                tone={a.tone}
                title={a.title}
                description={a.description}
                action={<span className="tk-meta">{a.time}</span>}
              />
            ))}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
