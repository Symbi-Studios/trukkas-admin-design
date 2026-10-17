"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Avatar,
  IconButton,
  DropdownMenu,
  EmptyState,
  Skeleton,
} from "../ds.js";
import {
  useGetAdminPayoutDirectoryQuery, useGetAdminPayoutSummaryQuery, useLazyGetAdminPayoutDocumentsQuery, useLazyGetAdminPayoutDocumentQuery, downloadPayoutFile, payoutMatchesStatus,
  payoutSummary, payoutMoney as formatNaira, payoutDetailUrl, payoutCompanyUrl, payoutJobUrl,
} from "../store/features/payouts/payoutsApi.js";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
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
  const navigate = useNavigate();
  const directoryQuery = useGetAdminPayoutDirectoryQuery();
  const statsQuery = useGetAdminPayoutSummaryQuery();
  const [readDocuments, documentsState] = useLazyGetAdminPayoutDocumentsQuery();
  const [readDocument, documentState] = useLazyGetAdminPayoutDocumentQuery();
  const downloading = useRef(false);
  const directory = directoryQuery.error ? null : directoryQuery.currentData;
  const all = directory?.rows || EMPTY_ROWS;

  const [tab, setTab] = useState("All Requests");
  const [q, setQ] = useState("");
  const [type, setType] = useState("All Payout Types");
  const [status, setStatus] = useState("All Statuses");
  const [party, setParty] = useState("All Parties");
  const [date, setDate] = useState("All Request Dates");
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
    } else if (job || trip) setQ(job || trip);
    if (requestedStatus) setStatus(requestedStatus);
  }, []);

  const summary = useMemo(() => payoutSummary(directory, statsQuery.error ? null : statsQuery.currentData), [directory, statsQuery.currentData, statsQuery.error]);
  const counts = summary.counts;
  const metric = (value, loading = (!directory && directoryQuery.isFetching) || (!statsQuery.currentData && statsQuery.isFetching)) => loading ? <Skeleton as="span" width={54} height={23} /> : value ?? "—";

  const tabFiltered = useMemo(() => {
    if (tab === "Pending")
      return all.filter((p) => payoutMatchesStatus(p, "Pending"));
    if (tab === "Approved") return all.filter((p) => payoutMatchesStatus(p, "Approved"));
    if (tab === "Rejected") return all.filter((p) => payoutMatchesStatus(p, "Rejected"));
    if (tab === "Processing")
      return all.filter((p) => payoutMatchesStatus(p, "Processing"));
    return all;
  }, [all, tab]);

  const filtered = useMemo(
    () =>
      tabFiltered.filter(
        (p) =>
          (type === "All Payout Types" || p.type === type) &&
          (status === "All Statuses" || payoutMatchesStatus(p, status)) &&
          (party === "All Parties" || p.partyType === party) &&
          (date === "All Request Dates" || p.dateRequested === date) &&
          (!q ||
            [p.id, p.reference, p.jobId, ...(p.jobIds || []), ...(p.tripIds || []), p.party, p.partyId, p.companyId, p.payment?.bank].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [tabFiltered, type, status, party, date, q],
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

  const TABS = [
    {
      value: "All Requests",
      label: "All Requests",
      count: counts["All Requests"] ?? "—",
    },
    { value: "Pending", label: "Pending", count: counts.Pending ?? "—" },
    { value: "Approved", label: "Approved", count: counts.Approved ?? "—" },
    { value: "Rejected", label: "Rejected", count: counts.Rejected ?? "—" },
    { value: "Processing", label: "Processing", count: counts.Processing ?? "—" },
  ];

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Payouts", "Requested Payouts"]}
        title="Requested Payouts"
        description="Review and manage all payout requests from drivers and trucking companies."
        actions={<Button icon="plus" onClick={() => { setTab("Pending"); setStatus("Pending Review"); setType("Company Payout"); setParty("company"); setPage(1); }}>Review Company Payouts</Button>}
      />

      <div className="payout-stats">
        <StatCard
          icon="clock"
          tint="navy"
          label="Total Requests"
          value={metric(summary.totalRequests)}
          caption="all payout requests"
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Review"
          value={metric(summary.pending, statsQuery.isFetching && !statsQuery.currentData && !directory)}
          caption={`${formatNaira(summary.companyHeld)} held`}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Approved"
          value={metric(summary.approved, statsQuery.isFetching && !statsQuery.currentData)}
          caption={`${formatNaira(summary.companyPaid)} company payouts paid`}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Rejected"
          value={metric(summary.rejected, statsQuery.isFetching && !statsQuery.currentData)}
          caption="requires no further payment"
        />
        <StatCard
          icon="database"
          tint="blue"
          label="Total Requested Amount"
          value={metric(formatNaira(summary.totalRequestedAmount))}
          caption="net of rejected requests"
        />
      </div>

      <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 var(--tk-card-pad)",
          }}
        >
          <Tabs
            value={tab}
            onChange={(v) => {
              setTab(v);
              setPage(1);
            }}
            style={{ border: "none", flex: 1 }}
            items={TABS}
          />
          <Button variant="outline" icon="download" disabled={!directory || directoryQuery.isFetching} onClick={() => exportPayouts(filtered)}>
            Export
          </Button>
        </div>

        <TableToolbar
          filters={
            <>
              <FilterButton
                label="Request Dates"
                value={date}
                options={["All Request Dates", ...new Set(all.map((payout) => payout.dateRequested).filter((value) => value !== "—"))]}
                active={date !== "All Request Dates"}
                onChange={(value) => { setDate(value); setPage(1); }}
              />
              <FilterButton
                label="Payout Types"
                value={type}
                options={[
                  "All Payout Types",
                  "Driver Payout",
                  "Company Payout",
                ]}
                active={type !== "All Payout Types"}
                onChange={(v) => {
                  setType(v);
                  setPage(1);
                }}
              />
              <FilterButton
                label="Statuses"
                value={status}
                options={[
                  "All Statuses",
                  "Pending Review",
                  "Approved",
                  "Rejected",
                  "Processing",
                  "Completed",
                ]}
                active={status !== "All Statuses"}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              />
              <FilterButton
                label="Parties"
                value={party}
                options={["All Parties", "driver", "company"]}
                active={party !== "All Parties"}
                onChange={(v) => {
                  setParty(v);
                  setPage(1);
                }}
              />
            </>
          }
          trailing={
            <SearchField
              placeholder="Search payout requests..."
              style={{ minWidth: 240 }}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          }
        />

        {!directory && directoryQuery.isFetching ? <DriverTableLoading columns={10} label="Loading payout requests" /> : filtered.length === 0 ? (
          <EmptyState
            icon="banknote"
            title="No payout requests found"
            description={directoryQuery.error ? getApiErrorMessage(directoryQuery.error) : "Try adjusting your filters or search."}
          />
        ) : (
          <>
            <DataTable
              rows={paged}
              rowKey={(r) => r.key}
              onRowClick={(r) => navigate(payoutDetailUrl(r))}
              columns={[
                {
                  key: "id",
                  header: "Payout ID",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
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
                  render: (r) => (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Avatar name={r.party} size={28} />
                      <span style={{ display: "grid", gap: 2 }}>
                        {r.companyId ? (
                          <Link to={payoutCompanyUrl(r.companyId)} onClick={(e) => e.stopPropagation()}>{r.party}</Link>
                        ) : <span className="tk-label">{r.party}</span>}
                        <span className="tk-meta">{r.partyId}</span>
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
                  render: (r) => <span style={{ display: "grid", gap: 2 }}><span className="tk-meta">{formatNaira(r.grossAmount)}</span><b>{formatNaira(r.netAmount)}</b></span>,
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
