"use client";
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useState } from "react";
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
  NotAvailable,
  isMissing,
  EmptyState,
  Skeleton,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetAdminPayoutDirectoryQuery, useGetAdminPayoutSummaryQuery, payoutMatchesStatus,
  payoutSummary, payoutMoney as formatNaira,
} from "../store/features/payouts/payoutsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { FilterChip } from "../components/FilterChip.jsx";
import { DateRangeFilter, EMPTY_RANGE, inRange } from "../components/DateRangeFilter.jsx";
import { DateCell, MiddleId, Money, PartyCell, formatNaira as naira, partyRole } from "../components/finance/FinanceCells.jsx";
import { PayoutDrawer, PAYOUT_STATUS_TONE } from "./PayoutDrawer.jsx";
import { useUrlParams } from "../domain/urlState.js";
import "./RequestedPayouts.css";

const PAGE_SIZE = 10;
const EMPTY_ROWS = [];



function exportPayouts(rows) {
  const headers = ["Payout ID", "Company / Driver", "Type", "Job IDs", "Trip IDs", "Gross", "Deductions", "Net", "Status", "Eligibility"];
  const values = rows.map((payout) => [payout.id, payout.party, payout.type, payout.jobIds?.join(" | ") ?? "—", payout.tripIds?.join(" | ") ?? "—", payout.grossAmount, payout.deductions, payout.netAmount, payout.status, payout.eligibility]);
  const csv = [headers, ...values].map((row) => row.map((value) => {
    const raw = String(value ?? "—");
    const safe = typeof value === "string" && /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "payout-requests.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RequestedPayouts() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const directoryQuery = useGetAdminPayoutDirectoryQuery();
  const statsQuery = useGetAdminPayoutSummaryQuery();
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const periodStatsQuery = useGetAdminPayoutSummaryQuery(statsRange);
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const all = directory?.rows || EMPTY_ROWS;

  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [status, setStatus] = useState("All Statuses");
  const [party, setParty] = useState("All Parties");
  const [dates, setDates] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const url = useUrlParams();
  const linkedId = url.get("id"), linkedSource = url.get("source");
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (linkedId) setSelected({ id: linkedId, source: linkedSource }); }, [linkedId, linkedSource]);
  const open = (row) => setSelected({ id: row.id, source: row.source });
  const close = () => setSelected(null);
  const roleLabel = (row) => partyRole(row.partyRole)?.label;
  // Individual Driver is always offered, even before any individual has requested a payout.
  const partyOptions = useMemo(() => [...new Set(["Individual Driver", ...all.map(roleLabel).filter(Boolean)])].sort(), [all]);
  const filtersActive = status !== "All Statuses" || party !== "All Parties" || Boolean(dates.from) || Boolean(q.trim());
  function resetFilters() { setStatus("All Statuses"); setParty("All Parties"); setDates(EMPTY_RANGE); setQ(""); setPage(1); }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("companyId") || params.get("company");
    const job = params.get("jobId");
    const trip = params.get("tripId");
    const requestedStatus = params.get("status");
    if (company) setQ(company);
    else if (job || trip || params.get("q")) setQ(job || trip || params.get("q"));
    if (requestedStatus) setStatus(requestedStatus);
  }, []);

  const cardSummary = useMemo(() => payoutSummary(directory, periodStatsQuery.error ? null : periodStatsQuery.currentData), [directory, periodStatsQuery.currentData, periodStatsQuery.error]);
  const metric = (value, loading = (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching)) => loading ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";

  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          (status === "All Statuses" || payoutMatchesStatus(p, status)) &&
          (party === "All Parties" || roleLabel(p) === party) &&
          inRange(p.timestamp, dates) &&
          (!q ||
            [p.id, p.reference, p.jobId, ...(p.jobIds || []), ...p.jobNumbers, ...(p.tripIds || []), p.party, p.partyId, p.companyId, p.payment?.bank].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [all, status, party, dates, q],
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);


  return (
    <>
      <PageHeader
        crumbs={["Finance", "Payouts"]}
        title="Payouts"
        description="Withdrawal requests from trucking companies and forwarders, and payouts the platform sends to bank accounts."
      />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey}>
        <StatCard
          icon="clock"
          tint="navy"
          label="Total Requests"
          value={metric(cardSummary.totalRequests)}
          caption="all payout requests"
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Review"
          value={metric(cardSummary.pending, statsQuery.isFetching && !statsQuery.currentData && !directory)}
          caption={`${formatNaira(cardSummary.companyHeld)} held`}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Approved"
          value={metric(cardSummary.approved, statsQuery.isFetching && !statsQuery.currentData)}
          caption={`${formatNaira(cardSummary.companyPaid)} company payouts paid`}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Rejected"
          value={metric(cardSummary.rejected, statsQuery.isFetching && !statsQuery.currentData)}
          caption="requires no further payment"
        />
        <StatCard
          icon="database"
          tint="blue"
          label="Total Requested Amount"
          value={metric(formatNaira(cardSummary.totalRequestedAmount))}
          caption="net of rejected requests"
        />
      </StatsPanel>

      <SectionCard title="" pad="none" className="fin-table">
        <TableToolbar
          search={<SearchField placeholder="Search payouts…" title="Search by payout ID, reference, party, job or bank" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Statuses" options={["All Statuses", "Pending Review", "Approved", "Processing", "Completed", "Rejected"]} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterChip name="Party" icon="user" value={party} allValue="All Parties" options={["All Parties", ...partyOptions]} onChange={(v) => { setParty(v); setPage(1); }} />
            <DateRangeFilter name="Requested" value={dates} onChange={(next) => { setDates(next); setPage(1); }} />
          </>}
          onClear={filtersActive ? resetFilters : undefined}
          viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
          trailing={<Button variant="outline" icon="download" disabled={!directory || directoryQuery.isFetching} onClick={() => exportPayouts(filtered)}>Export</Button>}
        />

        {!directory && directoryQuery.isFetching ? <DriverTableLoading columns={8} label="Loading payout requests" /> : filtered.length === 0 && tableView !== "board" ? (
          <EmptyState icon="banknote" title="No payouts found" description={directoryQuery.error ? getApiErrorMessage(directoryQuery.error) : "Try adjusting your filters or search."} />
        ) : (
          <>
            <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.payouts} view={tableView} boardGroupBy={(row) => row.status} boardOnRowClick={open}
              rows={paged}
              rowKey={(r) => r.key}
              onRowClick={open}
              columns={[
                { key: "id", header: "Payout ID", render: (r) => <MiddleId value={r.id} label="payout ID" onOpen={() => open(r)} /> },
                { key: "job", header: "Job ID", render: (r) => r.jobNumbers.length
                  ? <span className="fin-id-stack"><MiddleId value={r.jobNumbers[0]} head={7} tail={6} label="job ID" />{r.jobNumbers.length > 1 && <Badge tone="neutral">+{r.jobNumbers.length - 1}</Badge>}</span>
                  : <NotAvailable label="Not applicable" /> },
                { key: "party", header: "Party", render: (r) => <PartyCell name={r.party} role={r.partyRole} /> },
                { key: "requested", header: "Requested", render: (r) => <DateCell date={r.dateRequested} time={r.dateRequestedTime} /> },
                { key: "gross", header: "Requested Amount", align: "right", render: (r) => <Money value={r.grossAmount} /> },
                { key: "net", header: "Net Payout", align: "right", render: (r) => <span className="fin-date" style={{ justifyItems: "end" }}><Money value={r.netAmount} />{r.totalDeductions != null && <small>{naira(r.totalDeductions)} fees</small>}</span> },
                { key: "bank", header: "Bank", render: (r) => isMissing(r.payment.bank) ? <NotAvailable /> : <span className="fin-date"><span>{r.payment.bank}</span><small>{r.payment.accountNumber}</small></span> },
                { key: "status", header: "Status", render: (r) => <Badge tone={PAYOUT_STATUS_TONE[r.status] || "neutral"} dot>{r.status}</Badge> },
              ]}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
          </>
        )}
      </SectionCard>
      {selected && <PayoutDrawer target={selected} row={all.find((row) => row.id === selected.id && (!selected.source || row.source === selected.source))} onClose={close} />}
    </>
  );
}
