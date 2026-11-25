"use client";
import { usePageSearchState } from "../components/PageSearch.jsx";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { BOARD_LAYOUTS } from "../domain/boardLayouts.js";
import { PageHeader, StatCard, SectionCard, TableToolbar, SearchField, DataTable, Pagination, Badge, EmptyState, Skeleton, StatsPanel, ViewToggle } from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from "../domain/statsPeriod.js";
import { useUrlParams } from "../domain/urlState.js";
import { FilterChip } from "../components/FilterChip.jsx";
import { DateRangeFilter, EMPTY_RANGE, inRange } from "../components/DateRangeFilter.jsx";
import { DateCell, MiddleId, Money, PartyCell } from "../components/finance/FinanceCells.jsx";
import {
  useGetAdminEscrowOverviewQuery, useGetAdminEscrowRegisterQuery, useGetAdminEscrowReleasesQuery,
  emptyEscrowOverview, escrowMoney as formatNaira,
} from "../store/features/wallets/walletsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { EscrowDrawer, ESCROW_STATUS_TONE } from "./EscrowDrawer.jsx";

// Escrow is money held for a job (holds) and money paid out of it (releases). Each row
// opens the hold's drawer, which shows how that job's payment was settled.
const TYPES = ["All Types", "Holds", "Releases"];
const PAGE_SIZE = 10;
const EMPTY = [];

export function Wallets() {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  return <EscrowScreen key={String(owner) + ":" + String(role) + ":" + authenticated} />;
}

function EscrowScreen() {
  const role = useSelector((state) => state.auth.admin?.role), owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn && state.auth.admin?.id));
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const overviewQuery = useGetAdminEscrowOverviewQuery({ owner, role, ...statsRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const holdsQuery = useGetAdminEscrowRegisterQuery({ owner, role }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const releasesQuery = useGetAdminEscrowReleasesQuery({ owner, role }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const { summary } = authenticated && !overviewQuery.error ? overviewQuery.currentData || emptyEscrowOverview : emptyEscrowOverview;
  const metric = (value) => overviewQuery.isLoading ? <Skeleton as="span" width={96} height={23} /> : formatNaira(value);

  const holds = authenticated && !holdsQuery.error ? holdsQuery.currentData || EMPTY : EMPTY;
  const releases = authenticated && !releasesQuery.error ? releasesQuery.currentData || EMPTY : EMPTY;
  const url = useUrlParams();
  const [q, setQ] = usePageSearchState(url.search(), () => setPage(1));
  const [type, setType] = useState(() => TYPES.includes(url.get("type")) ? url.get("type") : "All Types");
  const [status, setStatus] = useState("All Statuses");
  const [dates, setDates] = useState(EMPTY_RANGE);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("list");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [selected, setSelected] = useState(null);
  const linkedId = url.get("id");
  useEffect(() => { if (linkedId) setSelected(linkedId); }, [linkedId]);

  const rows = useMemo(() => {
    const merged = type === "Holds" ? holds : type === "Releases" ? releases : [...holds, ...releases];
    return [...merged].sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  }, [holds, releases, type]);
  const statusOptions = useMemo(() => ["All Statuses", ...new Set(rows.map((row) => row.status).filter((value) => value && value !== "—"))], [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => (status === "All Statuses" || row.status === status) && inRange(row.timestamp, dates)
      && (!needle || [row.holdId, row.releaseId, row.jobId, row.customer, row.trucker, row.releasedTo, row.reference].some((value) => value && String(value).toLowerCase().includes(needle))));
  }, [rows, status, dates, q]);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const loading = (holdsQuery.isFetching && !holdsQuery.currentData) || (releasesQuery.isFetching && !releasesQuery.currentData);
  const error = holdsQuery.error || releasesQuery.error;
  const filtersActive = type !== "All Types" || status !== "All Statuses" || Boolean(dates.from) || Boolean(q.trim());
  const reset = () => { setType("All Types"); setStatus("All Statuses"); setDates(EMPTY_RANGE); setQ(""); setPage(1); };
  const open = (row) => setSelected(row.kind === "Hold" ? row.holdId : row.escrowId);

  return (
    <>
      <PageHeader crumbs={["Finance", "Escrow"]} title="Escrow"
        description="Job payments held in escrow, and every release to truckers or refund to forwarders. Open a row to see how the payment was settled." />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey} columns={3}>
        <StatCard
          icon="wallet"
          tint="navy"
          label="Total Escrow Balance"
          value={metric(summary.totalEscrowBalance)}
          delta={summary.totalEscrowBalanceDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="lock"
          tint="amber"
          label="Held in Escrow"
          value={metric(summary.heldInEscrow)}
          delta={summary.heldInEscrowDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="hourglass"
          tint="purple"
          label="Pending Release"
          value={metric(summary.pendingRelease)}
          delta={summary.pendingReleaseDelta}
          direction="down"
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Available to Settle"
          value={metric(summary.availableToSettle)}
          delta={summary.availableToSettleDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="coins"
          tint="blue"
          label="Completed Releases"
          value={metric(summary.completedReleases)}
          delta={summary.completedReleasesDelta}
          caption={statsPeriod(statsPeriodKey).vs}
        />
        <StatCard
          icon="triangle-alert"
          tint="red"
          label="Disputed Amounts"
          value={metric(summary.disputedAmounts)}
          delta={summary.disputedAmountsDelta}
          direction="down"
          caption={statsPeriod(statsPeriodKey).vs}
        />
      </StatsPanel>

      <SectionCard title="" pad="none" className="fin-table">
        <TableToolbar
          search={<SearchField placeholder="Search escrow…" title="Search by job, escrow ID, party or reference" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterChip name="Type" icon="layers" value={type} allValue="All Types" options={TYPES} onChange={(v) => { setType(v); setStatus("All Statuses"); setPage(1); }} />
            <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Statuses" options={statusOptions} onChange={(v) => { setStatus(v); setPage(1); }} />
            <DateRangeFilter value={dates} onChange={(next) => { setDates(next); setPage(1); }} />
          </>}
          onClear={filtersActive ? reset : undefined}
          viewControl={<ViewToggle value={view} onChange={setView} hideEmpty={hideEmpty} onHideEmptyChange={setHideEmpty} />}
        />
        {loading ? <DriverTableLoading columns={7} label="Loading escrow" /> : error && !filtered.length ? (
          <EmptyState icon="lock" title="Unable to load escrow" description={getApiErrorMessage(error)} />
        ) : !filtered.length && view === "list" ? (
          <EmptyState icon="lock" title="No escrow records found" description="Try adjusting your filters or search." />
        ) : <>
          <DataTable view={view} boardHideEmpty={hideEmpty} boardConfig={BOARD_LAYOUTS.escrow} boardGroupBy={(row) => row.status} boardOnRowClick={open}
            rows={paged} rowKey={(row) => row.key} onRowClick={open}
            columns={[
              { key: "id", header: "Escrow / Release ID", render: (row) => <MiddleId value={row.kind === "Hold" ? row.holdId : row.releaseId} label="ID" onOpen={() => open(row)} /> },
              { key: "type", header: "Type", render: (row) => row.kind === "Hold" ? <Badge tone="warning">Hold</Badge> : <Badge tone={row.releaseType === "Refund" ? "orange" : "info"}>{row.releaseType}</Badge> },
              { key: "job", header: "Job ID", render: (row) => <MiddleId value={row.jobId} head={7} tail={6} label="job ID" /> },
              { key: "party", header: "Party", render: (row) => row.kind === "Hold" ? <PartyCell name={row.customer} role={row.customerRole} /> : <PartyCell name={row.releasedTo} role={row.recipientRole} /> },
              { key: "amount", header: "Amount", align: "right", render: (row) => row.kind === "Hold"
                ? <span className="fin-date" style={{ justifyItems: "end" }}><Money value={row.total} />{row.heldAmount != null && <small>{formatNaira(row.heldAmount)} still held</small>}</span>
                : <Money value={row.amount} /> },
              { key: "date", header: "Date", render: (row) => row.kind === "Hold" ? <DateCell date={row.heldOn} time={row.heldTime} /> : <DateCell date={row.releasedOn} time={row.releasedTime} /> },
              { key: "status", header: "Status", render: (row) => <Badge tone={ESCROW_STATUS_TONE[row.status] || "neutral"} dot>{row.status}</Badge> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPage={setPage} onPageSize={() => {}} />
        </>}
      </SectionCard>
      {selected && <EscrowDrawer holdId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
