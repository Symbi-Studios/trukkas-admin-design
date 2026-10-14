"use client";

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
  FilterSelect,
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
  Skeleton,
} from "../ds.js";
import {
  useGetAdminSettlementsQuery, useGetAdminSettlementSummaryQuery, useGetAdminSettlementAlertsQuery, emptySettlementInsights,
  settlementMoney as formatNaira, settlementNumber, settlementMillions,
  settlementDetailUrl, exportSettlementRows,
} from '../store/features/settlements/settlementsApi.js';
import { useSettlementOperations } from '../store/features/settlements/useSettlementOperations.js';
import { defaultSettlementDates, settlementDateParams, settlementDateLabel } from '../store/features/settlements/settlementDates.js';
import { SettlementDateRangeDialog } from './SettlementDateRangeDialog.jsx';
import { DriverTableLoading } from './DriversLoading.jsx';

const TABS = [
  "All Settlements",
  "By Job",
  "By Trip",
  "Driver Settlements",
  "Vendor Settlements",
  "Customer Settlements",
];
const PAGE_SIZE = 10;

function FilterButton({ label, value, options, active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative" }}>
      <FilterSelect
        label={value}
        active={active}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <span
          style={{ position: "absolute", left: 0, top: 44, zIndex: 30 }}
          onMouseLeave={() => setOpen(false)}
        >
          <DropdownMenu
            width={200}
            items={options.map((o) => ({
              label: o,
              icon: o === value ? "check" : undefined,
              onClick: () => {
                onChange(o);
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
  "Driver Payout": "blue",
  "Transporter Payment": "purple",
  "Vendor Payment": "teal",
  "Customer Refund": "orange",
};

export function Settlements() {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <SettlementsScreen key={String(owner)+':'+String(role)+':'+authenticated} />;
}
function SettlementsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("All Settlements");
  const [q, setQ] = useState("");
  const [settlementType, setSettlementType] = useState("All Types");
  const [status, setStatus] = useState("All Status");
  const [payerType, setPayerType] = useState("All Payers");
  const [payeeType, setPayeeType] = useState("All Payees");
  const [method, setMethod] = useState("All Methods");
  const [sort, setSort] = useState("Newest First");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [view, setView] = useState("list");
  const [menuFor, setMenuFor] = useState(null);

  const [dateRange,setDateRange] = useState(defaultSettlementDates);
  const [dateDialogOpen,setDateDialogOpen] = useState(false);
  const dateParams = settlementDateParams(dateRange);
  const dateLabel = settlementDateLabel(dateRange);
  const operations = useSettlementOperations();
  const query = useGetAdminSettlementsQuery({ owner: operations.owner, role: operations.role, groupBy: tab === 'By Trip' ? 'trip' : 'job', payerBusinessType: ({ Importer:'IMPORTER', Customer:'CUSTOMER', Internal:'INTERNAL' })[payerType], ...dateParams }, { skip: !operations.authenticated });
  const summaryQuery = useGetAdminSettlementSummaryQuery({ owner: operations.owner, role: operations.role, ...dateParams }, { skip: !operations.authenticated });
  const alertsQuery = useGetAdminSettlementAlertsQuery({ owner: operations.owner, role: operations.role }, { skip: !operations.authenticated });
  const all = useMemo(() => operations.authenticated && !query.error ? query.currentData || [] : [], [query.currentData, query.error, operations.authenticated]);
  const { summary: settlementSummary, payouts: payoutSummary, statuses: settlementStatusBreakdown } = operations.authenticated && !summaryQuery.error ? summaryQuery.currentData || emptySettlementInsights : emptySettlementInsights;
  const settlementAlerts = operations.authenticated && !alertsQuery.error ? alertsQuery.currentData || [] : [];
  const loading = query.isLoading || (query.isFetching && !query.currentData);
  const value = (content) => summaryQuery.isLoading || summaryQuery.isFetching && !summaryQuery.currentData ? <Skeleton as="span" width={90} height={23} /> : content;

  const tabFiltered = useMemo(() => {
    if (tab === "Driver Settlements")
      return all.filter((s) => s.type === "Driver Payout");
    if (tab === "Vendor Settlements")
      return all.filter((s) => s.type === "Vendor Payment");
    if (tab === "Customer Settlements")
      return all.filter(
        (s) => s.type === "Customer Refund" || s.payeeType === "Customer",
      );
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
          [s.id, s.relatedTo, s.payer, s.payee, ...s.transactionReferences].some(
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
        crumbs={["Business & Finance", "Settlements"]}
        title="Settlements"
        description="Manage and track all settlement activities across jobs, trips and parties."
        actions={
          <>
            <FilterSelect label={dateLabel} icon="calendar" active onClick={() => setDateDialogOpen(true)} />
            <Button variant="outline" icon="filter">
              Filters
            </Button>
            <Button variant="outline" icon="download" disabled={loading || !knownCollection} onClick={() => exportSettlementRows(filtered)}>
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
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
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

          <TableToolbar
            filters={
              <>
                <FilterButton
                  label="Settlement Type"
                  value={settlementType}
                  options={[
                    "All Types",
                    "Driver Payout",
                    "Transporter Payment",
                    "Vendor Payment",
                    "Customer Refund",
                  ]}
                  active={settlementType !== "All Types"}
                  onChange={(v) => {
                    setSettlementType(v);
                    setPage(1);
                  }}
                />
                <FilterButton
                  label="Status"
                  value={status}
                  options={[
                    "All Status",
                    "Completed",
                    "Pending",
                    "On Hold",
                    "Failed",
                  ]}
                  active={status !== "All Status"}
                  onChange={(v) => {
                    setStatus(v);
                    setPage(1);
                  }}
                />
                <FilterButton
                  label="Payer Type"
                  value={payerType}
                  options={["All Payers", "Importer", "Customer", "Internal"]}
                  active={payerType !== "All Payers"}
                  onChange={(v) => {
                    setPayerType(v);
                    setPage(1);
                  }}
                />
                <FilterButton
                  label="Payee Type"
                  value={payeeType}
                  options={[
                    "All Payees",
                    "Driver",
                    "Transporter",
                    "Vendor",
                    "Customer",
                  ]}
                  active={payeeType !== "All Payees"}
                  onChange={(v) => {
                    setPayeeType(v);
                    setPage(1);
                  }}
                />
                <FilterButton
                  label="Payment Method"
                  value={method}
                  options={["All Methods", "Bank Transfer", "Wallet"]}
                  active={method !== "All Methods"}
                  onChange={(v) => {
                    setMethod(v);
                    setPage(1);
                  }}
                />
                <FilterSelect label={dateLabel} icon="calendar" active onClick={() => setDateDialogOpen(true)} />
              </>
            }
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 var(--tk-card-pad) 12px",
            }}
          >
            <SearchField
              placeholder="Search settlements..."
              style={{ flex: "1 1 240px" }}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <span
              style={{
                display: "flex",
                border: "1px solid var(--tk-line-strong)",
                borderRadius: "var(--tk-r-md)",
                overflow: "hidden",
              }}
            >
              <IconButton
                icon="list"
                tone={view === "list" ? "blue" : "ghost"}
                style={{ borderRadius: 0 }}
                onClick={() => setView("list")}
              />
              <IconButton
                icon="grid-3x3"
                tone={view === "grid" ? "blue" : "ghost"}
                style={{ borderRadius: 0 }}
                onClick={() => setView("grid")}
              />
            </span>
            <FilterButton
              label="Sort by"
              value={`Sort by: ${sort}`}
              options={["Newest First", "Oldest First"]}
              onChange={setSort}
            />
          </div>

          {loading ? (
            <DriverTableLoading columns={10} label="Loading settlements" />
          ) : knownCollection && filtered.length === 0 ? (
            <EmptyState
              icon="coins"
              title="No settlements found"
              description="Try adjusting your filters or search."
            />
          ) : (
            <>
              <DataTable
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

        <div
          style={{
            display: "grid",
            gap: "var(--tk-grid-gap)",
            alignContent: "start",
          }}
        >
          <SectionCard
            title="Payout Summary"
            footer={<a href="#" onClick={(event) => { event.preventDefault(); void operations.downloadReport(dateParams); }}>View Report →</a>}
          >
            <div style={{ display: "grid", justifyItems: "center", gap: 14 }}>
              <DonutChart
                size={160}
                thickness={18}
                centerValue={settlementMillions(settlementSummary.completedSettlements)}
                centerLabel="Total Settled"
                data={payoutSummary.filter((d) => Number.isFinite(d.chartValue)).map((d) => ({
                  label: d.label,
                  value: d.chartValue,
                  color: d.color,
                }))}
              />
              <LegendList
                style={{ width: "100%" }}
                items={payoutSummary.map((d) => ({
                  label: d.label,
                  value: d.pct,
                  display: `${formatNaira(d.amount)} (${d.pct == null ? "—" : `${d.pct}%`})`,
                  color: d.color,
                }))}
                showShare={false}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Settlement Status"
            action={<a href="#">View All</a>}
          >
            {settlementStatusBreakdown.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 0",
                  borderTop: "1px solid var(--tk-line)",
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
                  {settlementNumber(s.count)} settlements
                </span>
                <span className="tk-meta">{s.pct}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard
            title="Recent Settlements"
            action={<a href="#">View All</a>}
          >
            {all.slice(0, 3).map((r) => (
              <div
                key={r.key}
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
                  <Icon name="coins" size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={settlementDetailUrl(r)}
                    style={{
                      display: "block",
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {r.id}
                  </Link>
                  <span className="tk-meta">
                    {r.relatedTo} · {r.payee}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {formatNaira(r.amount)}
                  </div>
                  <Badge tone={STATUS_TONE[r.status] || "neutral"}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard
            title="Settlement Alerts"
            action={<a href="#">View All</a>}
          >
            {alertsQuery.isLoading ? <DriverTableLoading columns={3} label="Loading settlements" /> : settlementAlerts.map((a, i) => (
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
      {dateDialogOpen && <SettlementDateRangeDialog range={dateRange} onClose={() => setDateDialogOpen(false)} onApply={next => {
        if (!settlementDateParams(next)) return;
        setDateRange({ ...next }); setPage(1); setMenuFor(null); setDateDialogOpen(false);
      }} />}
    </>
  );
}
