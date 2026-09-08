"use client";

import { useMemo, useState } from "react";
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
import { payoutRequestSummary } from "../mock/fixtures/payouts.js";
import { formatNaira } from "../mock/format.js";

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

export function RequestedPayouts() {
  const navigate = useNavigate();
  const all = useCollection("payoutRequests") || [];

  const [tab, setTab] = useState("All Requests");
  const [q, setQ] = useState("");
  const [type, setType] = useState("All Payout Types");
  const [status, setStatus] = useState("All Statuses");
  const [party, setParty] = useState("All Parties");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState(null);

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
          (!q ||
            [p.id, p.jobId, p.party, p.partyId, p.payment?.bank].some(
              (v) => v && v.toLowerCase().includes(q.toLowerCase()),
            )),
      ),
    [tabFiltered, type, status, party, q],
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
        actions={<Button icon="plus">New Payout Request</Button>}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--tk-space-4)",
        }}
      >
        <StatCard
          icon="clock"
          tint="navy"
          label="Total Requests"
          value={payoutRequestSummary.totalRequests}
          delta={payoutRequestSummary.totalRequestsDelta}
          caption="vs last week"
        />
        <StatCard
          icon="hourglass"
          tint="amber"
          label="Pending Review"
          value={payoutRequestSummary.pendingReview}
          caption={payoutRequestSummary.pendingReviewCaption}
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Approved"
          value={payoutRequestSummary.approved}
          delta={payoutRequestSummary.approvedDelta}
          caption="vs last week"
        />
        <StatCard
          icon="circle-x"
          tint="red"
          label="Rejected"
          value={payoutRequestSummary.rejected}
          delta={payoutRequestSummary.rejectedDelta}
          direction={payoutRequestSummary.rejectedDirection}
          caption="vs last week"
        />
        <StatCard
          icon="database"
          tint="blue"
          label="Total Requested Amount"
          value={formatNaira(payoutRequestSummary.totalRequestedAmount)}
          delta={payoutRequestSummary.totalRequestedAmountDelta}
          caption="vs last week"
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
          <Button variant="outline" icon="download">
            Export
          </Button>
        </div>

        <TableToolbar
          filters={
            <>
              <FilterSelect label="May 1 – May 30, 2026" icon="calendar" />
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
                        <span
                          style={{
                            font: "500 13px/18px var(--tk-font-sans)",
                            color: "var(--tk-ink-700)",
                          }}
                        >
                          {r.party}
                        </span>
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
                  header: "Related Job / Trip",
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
                    </span>
                  ),
                },
                {
                  key: "amount",
                  header: "Amount (₦)",
                  align: "right",
                  render: (r) => <b>{r.amount.toLocaleString("en-NG")}</b>,
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
