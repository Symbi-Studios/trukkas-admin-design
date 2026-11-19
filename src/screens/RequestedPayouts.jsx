"use client";
import { BOARD_LAYOUTS } from '../domain/boardLayouts.js';

import { ViewToggle } from '../ds.js';

import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "../router.js";
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
  Avatar,
  IconButton,
  DropdownMenu,
  EmptyState,
  Skeleton,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import {
  useGetAdminPayoutDirectoryQuery, useGetAdminPayoutSummaryQuery, useLazyGetAdminPayoutDocumentsQuery, useLazyGetAdminPayoutDocumentQuery, downloadPayoutFile, payoutMatchesStatus,
  payoutSummary, payoutMoney as formatNaira, payoutDetailUrl, payoutCompanyUrl, payoutJobUrl,
} from "../store/features/payouts/payoutsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { DATE_PRESETS, FilterChip, datePresetRange } from "../components/FilterChip.jsx";
import "./RequestedPayouts.css";

const PAGE_SIZE = 10;
const EMPTY_ROWS = [];

const STATUS_TONE = {
  "Pending Review": "warning",
  Approved: "success",
  Rejected: "danger",
  Processing: "info",
  Completed: "success",
};
const TYPE_TONE = { "Driver Payout": "blue", "Company Payout": "purple" };


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

function inDateRange(timestamp, preset) {
  if (preset === "All Dates") return true;
  const { from, to } = datePresetRange(preset);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(`${from}T00:00:00+01:00`) && timestamp <= Date.parse(`${to}T23:59:59.999+01:00`);
}

export function RequestedPayouts() {
  const [hideEmptyColumns, setHideEmptyColumns] = useState(false);
  const [tableView, setTableView] = useState('list');
  const navigate = useNavigate();
  const directoryQuery = useGetAdminPayoutDirectoryQuery();
  const statsQuery = useGetAdminPayoutSummaryQuery();
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const periodStatsQuery = useGetAdminPayoutSummaryQuery(statsRange);
  const [readDocuments, documentsState] = useLazyGetAdminPayoutDocumentsQuery();
  const [readDocument, documentState] = useLazyGetAdminPayoutDocumentQuery();
  const downloading = useRef(false);
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const all = directory?.rows || EMPTY_ROWS;

  const [q, setQ] = usePageSearchState("", () => setPage(1));
  const [type, setType] = useState("All Payout Types");
  const [status, setStatus] = useState("All Statuses");
  const [party, setParty] = useState("All Parties");
  const [date, setDate] = useState("All Dates");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("companyId") || params.get("company");
    const job = params.get("jobId");
    const trip = params.get("tripId");
    const requestedStatus = params.get("status");
    if (company) {
      setType("Company Payout");
      setParty("company");
      setQ(company);
    } else if (job || trip || params.get("q")) setQ(job || trip || params.get("q"));
    if (requestedStatus) setStatus(requestedStatus);
  }, []);

  const cardSummary = useMemo(() => payoutSummary(directory, periodStatsQuery.error ? null : periodStatsQuery.currentData), [directory, periodStatsQuery.currentData, periodStatsQuery.error]);
  const metric = (value, loading = (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching)) => loading ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";

  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          (type === "All Payout Types" || p.type === type) &&
          (status === "All Statuses" || payoutMatchesStatus(p, status)) &&
          (party === "All Parties" || p.partyType === party) &&
          inDateRange(p.timestamp, date) &&
          (!q ||
            [p.id, p.reference, p.jobId, ...(p.jobIds || []), ...(p.tripIds || []), p.party, p.partyId, p.companyId, p.payment?.bank].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [all, type, status, party, date, q],
  );

  async function downloadDocuments(row) {
    if (downloading.current || documentsState.isFetching || documentState.isFetching) return;
    setMenuFor(null); downloading.current = true;
    try {
      const docs = await readDocuments({ id: row.id, source: row.source }, false).unwrap();
      if (!docs.length) { window.alert('No payout documents are available.'); return; }
      for (const doc of docs) downloadPayoutFile(await readDocument({ id: row.id, source: row.source, url: doc.url }, false).unwrap());
    } catch (error) { window.alert(getApiErrorMessage(error)); }
    finally { downloading.current = false; }
  }

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

      <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>


        <TableToolbar
          search={<SearchField placeholder="Search by payout ID, reference, party, job or bank…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />}
          filters={<>
            <FilterChip name="Status" icon="circle-dot" value={status} allValue="All Statuses" options={["All Statuses", "Pending Review", "Approved", "Rejected", "Processing", "Completed"]} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FilterChip name="Type" icon="banknote" value={type} allValue="All Payout Types" options={["All Payout Types", "Company Payout", "Driver Payout"]} onChange={(v) => { setType(v); setPage(1); }} />
            <FilterChip name="Party" icon="user" value={party} allValue="All Parties" options={[{ value: "All Parties", label: "All Parties" }, { value: "company", label: "Company" }, { value: "driver", label: "Driver" }]} onChange={(v) => { setParty(v); setPage(1); }} />
            <FilterChip name="Requested" icon="calendar" value={date} allValue="All Dates" options={DATE_PRESETS} onChange={(v) => { setDate(v); setPage(1); }} />
          </>}
          onClear={status !== "All Statuses" || type !== "All Payout Types" || party !== "All Parties" || date !== "All Dates" || q.trim()
            ? () => { setStatus("All Statuses"); setType("All Payout Types"); setParty("All Parties"); setDate("All Dates"); setQ(""); setPage(1); }
            : undefined}
          viewControl={<ViewToggle hideEmpty={hideEmptyColumns} onHideEmptyChange={setHideEmptyColumns} value={tableView} onChange={setTableView} />}
          trailing={<Button variant="outline" icon="download" disabled={!directory || directoryQuery.isFetching} onClick={() => exportPayouts(filtered)}>Export</Button>}
        />

        {!directory && directoryQuery.isFetching ? <DriverTableLoading columns={10} label="Loading payout requests" /> : filtered.length === 0 && tableView !== 'board' ? (
          <EmptyState
            icon="banknote"
            title="No payout requests found"
            description={directoryQuery.error ? getApiErrorMessage(directoryQuery.error) : "Try adjusting your filters or search."}
          />
        ) : (
          <>
            <DataTable boardHideEmpty={hideEmptyColumns} boardConfig={BOARD_LAYOUTS.payouts} view={tableView} boardGroupBy={(row) => row.status}
              rows={paged}
              rowKey={(r) => r.key}
              onRowClick={(r) => navigate(payoutDetailUrl(r))}
              columns={[
                {
                  key: "id",
                  header: "Payout ID",
                  width: 170,
                  render: (r) => (
                    <span className="payout-id-cell">
                      <span className="tk-mono">{r.id}</span>
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Date Requested",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.dateRequested}</span>
                      <span className="tk-meta">{r.dateRequestedTime}</span>
                    </span>
                  ),
                },
                {
                  key: "party",
                  header: "Party",
                  width: 240,
                  render: (r) => (
                    <span className="payout-party-cell">
                      <Avatar name={r.party} size={28} />
                      <span className="payout-party-text">
                        {r.companyId ? (
                          <Link to={payoutCompanyUrl(r.companyId)} onClick={(e) => e.stopPropagation()}>{r.party}</Link>
                        ) : <span className="tk-label">{r.party}</span>}
                      </span>
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
                  key: "job",
                  header: "Job / Trips",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      {r.jobId ? <Link
                        to={payoutJobUrl(r.jobId)}
                        className="tk-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.jobId}
                      </Link> : <span className="tk-mono">—</span>}
                      <span className="tk-meta">{r.route}</span>
                      <span className="tk-meta">{r.truckTripCount ?? "—"} trip{r.truckTripCount === 1 ? "" : "s"}</span>
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "Gross / Net",
                  align: "right",
                  render: (r) => <span className="payout-amount-cell"><span className="tk-meta">{formatNaira(r.grossAmount)}</span><b>{formatNaira(r.netAmount)}</b></span>,
                },
                {
                  key: "eligibility",
                  header: "Eligibility",
                  render: (r) => r.partyType === "company" ? (
                    <span style={{ display: "grid", gap: 3 }}>
                      <Badge tone={r.approvalReady ? "success" : r.eligibility === "Needs Review" ? "warning" : "danger"}>{r.eligibility}</Badge>
                      <span className="tk-meta">{r.reconciliation?.ok == null ? "—" : r.reconciliation.ok ? "Reconciled" : "Needs reconciliation"}</span>
                    </span>
                  ) : <span className="tk-meta">{r.partyType === "driver" ? "Driver payout" : "—"}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  ),
                },
                {
                  key: "requestedBy",
                  header: "Requested By",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.requestedBy}</span>
                      <span className="tk-meta">{r.requestedByRole}</span>
                    </span>
                  ),
                },
                {
                  key: "x",
                  header: "Actions",
                  width: 44,
                  render: (r) => (
                    <RowMenu
                      id={r.key}
                      menuFor={menuFor}
                      setMenuFor={setMenuFor}
                      items={[
                        {
                          label: "View Details",
                          icon: "eye",
                          onClick: () => {
                            setMenuFor(null);
                            navigate(payoutDetailUrl(r));
                          },
                        },
                        {
                          label: "Copy Payout ID",
                          icon: "copy",
                          onClick: () => {
                            navigator.clipboard?.writeText(r.id);
                            setMenuFor(null);
                          },
                        },
                        { divider: true },
                        { label: "Download Documents", icon: "file-text", onClick: () => downloadDocuments(r) },
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
    </>
  );
}
