"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import { formatNaira } from "../mock/format.js";
import { getCompanyPayoutSummary, normalizePayouts } from "../domain/payouts.js";
import "./RequestedPayouts.css";

const PAGE_SIZE = 10;

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
  const values = rows.map((payout) => [payout.id, payout.party, payout.type, (payout.jobIds || []).join(" | "), (payout.tripIds || []).join(" | "), payout.grossAmount, payout.deductions, payout.netAmount, payout.status, payout.eligibility]);
  const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "payout-requests.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RequestedPayouts() {
  const navigate = useNavigate();
  const payoutRows = useCollection("payoutRequests") || [];
  const jobs = useCollection("jobs") || [];
  const all = useMemo(() => normalizePayouts(payoutRows, jobs), [payoutRows, jobs]);

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

  const companySummary = useMemo(() => getCompanyPayoutSummary(all), [all]);
  const totalRequested = useMemo(
    () => all.filter((p) => p.status !== "Rejected").reduce((sum, p) => sum + Number(p.netAmount ?? p.amount ?? 0), 0),
    [all],
  );

  const counts = useMemo(
    () => ({
      "All Requests": all.length,
      Pending: all.filter((p) => p.status === "Pending Review").length,
      Approved: all.filter((p) => p.status === "Approved").length,
      Rejected: all.filter((p) => p.status === "Rejected").length,
      Processing: all.filter((p) => p.status === "Processing").length,
    }),
    [all],
  );

  const tabFiltered = useMemo(() => {
    if (tab === "Pending")
      return all.filter((p) => p.status === "Pending Review");
    if (tab === "Approved") return all.filter((p) => p.status === "Approved");
    if (tab === "Rejected") return all.filter((p) => p.status === "Rejected");
    if (tab === "Processing")
      return all.filter((p) => p.status === "Processing");
    return all;
  }, [all, tab]);

  const filtered = useMemo(
    () =>
      tabFiltered.filter(
        (p) =>
          (type === "All Payout Types" || p.type === type) &&
          (status === "All Statuses" || p.status === status) &&
          (party === "All Parties" || p.partyType === party) &&
          (date === "All Request Dates" || p.dateRequested === date) &&
          (!q ||
            [p.id, p.jobId, ...(p.jobIds || []), ...(p.tripIds || []), p.party, p.partyId, p.companyId, p.payment?.bank].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [tabFiltered, type, status, party, date, q],
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const TABS = [
    {
      value: "All Requests",
      label: "All Requests",
      count: counts["All Requests"],
    },
    { value: "Pending", label: "Pending", count: counts.Pending },
    { value: "Approved", label: "Approved", count: counts.Approved },
    { value: "Rejected", label: "Rejected", count: counts.Rejected },
    { value: "Processing", label: "Processing", count: counts.Processing },
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
          value={all.length}
          caption="all payout requests"
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Review"
          value={counts.Pending}
          caption={`${companySummary.held ? formatNaira(companySummary.held) : "No funds"} held`}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Approved"
          value={all.filter((p) => ["Approved", "Processing", "Completed"].includes(p.status)).length}
          caption={`${formatNaira(companySummary.paid)} company payouts paid`}
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Rejected"
          value={counts.Rejected}
          caption="requires no further payment"
        />
        <StatCard
          icon="database"
          tint="blue"
          label="Total Requested Amount"
          value={formatNaira(totalRequested)}
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
          <Button variant="outline" icon="download" onClick={() => exportPayouts(filtered)}>
            Export
          </Button>
        </div>

        <TableToolbar
          filters={
            <>
              <FilterButton
                label="Request Dates"
                value={date}
                options={["All Request Dates", ...new Set(all.map((payout) => payout.dateRequested))]}
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

        {filtered.length === 0 ? (
          <EmptyState
            icon="banknote"
            title="No payout requests found"
            description="Try adjusting your filters or search."
          />
        ) : (
          <>
            <DataTable
              rows={paged}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/payouts/${r.id}`)}
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
                        {r.partyType === "company" ? (
                          <Link to={`/companies/${encodeURIComponent(r.companyId || r.partyId)}`} onClick={(e) => e.stopPropagation()}>{r.party}</Link>
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
                      <Link
                        to={`/jobs/${r.jobId}`}
                        className="tk-mono"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.jobId}
                      </Link>
                      <span className="tk-meta">{r.route}</span>
                      <span className="tk-meta">{r.tripIds?.length || 0} trip{r.tripIds?.length === 1 ? "" : "s"}</span>
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "Gross / Net",
                  align: "right",
                  render: (r) => <span style={{ display: "grid", gap: 2 }}><span className="tk-meta">{formatNaira(r.grossAmount ?? r.amount)}</span><b>{formatNaira(r.netAmount ?? r.amount)}</b></span>,
                },
                {
                  key: "eligibility",
                  header: "Eligibility",
                  render: (r) => r.partyType === "company" ? (
                    <span style={{ display: "grid", gap: 3 }}>
                      <Badge tone={r.approvalReady ? "success" : r.eligibility === "Needs Review" ? "warning" : "danger"}>{r.eligibility}</Badge>
                      <span className="tk-meta">{r.reconciliation?.ok ? "Reconciled" : "Needs reconciliation"}</span>
                    </span>
                  ) : <span className="tk-meta">Driver payout</span>,
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
                      id={r.id}
                      menuFor={menuFor}
                      setMenuFor={setMenuFor}
                      items={[
                        {
                          label: "View Details",
                          icon: "eye",
                          onClick: () => {
                            setMenuFor(null);
                            navigate(`/payouts/${r.id}`);
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
                        { label: "Download Documents", icon: "file-text" },
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
