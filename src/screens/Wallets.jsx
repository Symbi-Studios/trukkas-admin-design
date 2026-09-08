"use client";

import { useState } from "react";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  Card,
  SectionCard,
  Tabs,
  DataTable,
  Badge,
  DonutChart,
  LegendList,
  ListRow,
  IconButton,
  DropdownMenu,
  Icon,
  Modal,
  TextField,
  Timeline,
  AlertRow,
  FilterSelect,
  EmptyState,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  addEscrowFunds,
  releaseEscrowHold,
  resolveDispute,
} from "../mock/api.js";
import {
  escrowSummary as escrowSummaryStatic,
  escrowBalanceBreakdown,
  escrowWeeklyActivity,
  escrowRules,
  escrowActivityLog,
  escrowAlerts,
} from "../mock/fixtures/escrow.js";
import { formatNaira } from "../mock/format.js";

const TABS = [
  "Escrow Overview",
  "Escrow Accounts",
  "Holds",
  "Releases",
  "Disputes",
  "Transactions",
  "Escrow Rules",
  "Activity Log",
];

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

function FlowBox({ label, value, caption, color }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "grid",
        gap: 2,
        textAlign: "center",
      }}
    >
      <span style={{ font: "700 16px/22px var(--tk-font-sans)", color }}>
        {value}
      </span>
      <span
        style={{
          font: "600 12px/16px var(--tk-font-sans)",
          color: "var(--tk-ink-700)",
        }}
      >
        {label}
      </span>
      <span className="tk-meta">{caption}</span>
    </div>
  );
}

export function Wallets() {
  const summary = (useCollection("escrowSummary") || [escrowSummaryStatic])[0];
  const accounts = useCollection("escrowAccounts") || [];
  const holds = useCollection("escrowHolds") || [];
  const releases = useCollection("escrowReleases") || [];
  const disputes = useCollection("disputes") || [];
  const tx = useCollection("escrowTransactions") || [];

  const [tab, setTab] = useState("Escrow Overview");
  const [menuFor, setMenuFor] = useState(null);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleAddFunds() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    await addEscrowFunds(value);
    setBusy(false);
    setModal(null);
    setAmount("");
  }

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Escrow & Wallets"]}
        title="Escrow Wallet"
        description="Secure funds in escrow and manage holds, releases, and settlements."
        actions={
          <>
            <FilterSelect label="May 24 – May 30, 2026" icon="calendar" />
            <Button variant="outline" icon="filter">
              Filters
            </Button>
            <Button icon="plus" onClick={() => setModal("add")}>
              Add Funds
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
          label="Total Escrow Balance"
          value={formatNaira(summary.totalEscrowBalance)}
          delta={summary.totalEscrowBalanceDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="lock"
          tint="amber"
          label="Held in Escrow"
          value={formatNaira(summary.heldInEscrow)}
          delta={summary.heldInEscrowDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="hourglass"
          tint="purple"
          label="Pending Release"
          value={formatNaira(summary.pendingRelease)}
          delta={summary.pendingReleaseDelta}
          direction="down"
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Available to Settle"
          value={formatNaira(summary.availableToSettle)}
          delta={summary.availableToSettleDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="coins"
          tint="blue"
          label="Completed Releases"
          value={formatNaira(summary.completedReleases)}
          delta={summary.completedReleasesDelta}
          caption="vs May 17 – May 23"
        />
        <StatCard
          icon="triangle-alert"
          tint="red"
          label="Disputed Amounts"
          value={formatNaira(summary.disputedAmounts)}
          delta={summary.disputedAmountsDelta}
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
        <SectionCard title="" pad="none" style={{ paddingTop: 4 }}>
          <Tabs
            value={tab}
            onChange={setTab}
            style={{ padding: "0 var(--tk-card-pad)" }}
            items={TABS}
          />

          {tab === "Escrow Overview" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 20,
                padding: "18px var(--tk-card-pad) var(--tk-card-pad)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
                  gap: "var(--tk-grid-gap)",
                }}
              >
                <Card>
                  <h3 className="tk-section" style={{ marginBottom: 14 }}>
                    Escrow Balance Overview
                  </h3>
                  <div
                    style={{ display: "grid", justifyItems: "center", gap: 14 }}
                  >
                    <DonutChart
                      size={160}
                      thickness={18}
                      centerValue={`₦${(summary.totalEscrowBalance / 1000000).toFixed(2)}M`}
                      centerLabel="Total Balance"
                      data={escrowBalanceBreakdown.map((d) => ({
                        label: d.label,
                        value: d.value,
                        color: d.color,
                      }))}
                    />
                    <LegendList
                      style={{ width: "100%" }}
                      items={escrowBalanceBreakdown.map((d) => ({
                        label: d.label,
                        value: d.value,
                        display: `${formatNaira(d.value)} (${d.pct})`,
                        color: d.color,
                      }))}
                      showShare={false}
                    />
                  </div>
                </Card>
                <Card>
                  <h3 className="tk-section" style={{ marginBottom: 14 }}>
                    Escrow Activity (This Week)
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        icon: "lock",
                        tint: "amber",
                        label: "Funds Held",
                        value: formatNaira(escrowWeeklyActivity.fundsHeld),
                        caption: `${escrowWeeklyActivity.fundsHeldTx} transactions`,
                      },
                      {
                        icon: "lock-open",
                        tint: "green",
                        label: "Funds Released",
                        value: formatNaira(escrowWeeklyActivity.fundsReleased),
                        caption: `${escrowWeeklyActivity.fundsReleasedTx} transactions`,
                      },
                      {
                        icon: "coins",
                        tint: "blue",
                        label: "Settlements Made",
                        value: formatNaira(
                          escrowWeeklyActivity.settlementsMade,
                        ),
                        caption: `${escrowWeeklyActivity.settlementsCount} settlements`,
                      },
                      {
                        icon: "triangle-alert",
                        tint: "red",
                        label: "New Disputes",
                        value: escrowWeeklyActivity.newDisputes,
                        caption: `${formatNaira(escrowWeeklyActivity.newDisputesAmount)}`,
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          border: "1px solid var(--tk-line)",
                          borderRadius: "var(--tk-r-lg)",
                          padding: 12,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <Icon
                          name={s.icon}
                          size={16}
                          color={`var(--tk-${s.tint === "amber" ? "warning" : s.tint === "green" ? "success" : s.tint === "red" ? "danger" : "blue"})`}
                        />
                        <span
                          style={{
                            font: "700 15px/20px var(--tk-font-sans)",
                            color: "var(--tk-ink-900)",
                          }}
                        >
                          {s.value}
                        </span>
                        <span className="tk-meta">{s.label}</span>
                        <span className="tk-meta">{s.caption}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <SectionCard
                title="Recent Escrow Holds"
                pad="none"
                action={
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setTab("Holds");
                    }}
                  >
                    View All Holds
                  </a>
                }
              >
                <DataTable
                  rows={holds.slice(0, 5)}
                  rowKey={(r) => r.holdId}
                  columns={[
                    {
                      key: "holdId",
                      header: "Hold ID",
                      render: (r) => (
                        <Link to={`/escrow/${r.holdId}`} className="tk-mono">
                          {r.holdId}
                        </Link>
                      ),
                    },
                    { key: "jobId", header: "Job/Trip ID" },
                    { key: "customer", header: "Customer" },
                    { key: "route", header: "Route" },
                    {
                      key: "amount",
                      header: "Amount (₦)",
                      align: "right",
                      render: (r) => r.amount.toLocaleString("en-NG"),
                    },
                    {
                      key: "heldOn",
                      header: "Held On",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{r.heldOn}</span>
                          <span className="tk-meta">{r.heldTime}</span>
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r) => <Badge>{r.status}</Badge>,
                    },
                    {
                      key: "x",
                      header: "",
                      width: 60,
                      render: (r) => (
                        <span style={{ display: "flex", gap: 6 }}>
                          <IconButton
                            icon="eye"
                            onClick={() => navigate(`/escrow/${r.holdId}`)}
                          />
                        </span>
                      ),
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard
                title="Recent Escrow Releases"
                pad="none"
                action={
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setTab("Releases");
                    }}
                  >
                    View All Releases
                  </a>
                }
              >
                <DataTable
                  rows={releases.slice(0, 5)}
                  rowKey={(r) => r.releaseId}
                  columns={[
                    {
                      key: "releaseId",
                      header: "Release ID",
                      render: (r) => (
                        <span className="tk-mono">{r.releaseId}</span>
                      ),
                    },
                    { key: "jobId", header: "Job/Trip ID" },
                    { key: "releasedTo", header: "Released To" },
                    {
                      key: "amount",
                      header: "Amount (₦)",
                      align: "right",
                      render: (r) => r.amount.toLocaleString("en-NG"),
                    },
                    {
                      key: "releasedOn",
                      header: "Released On",
                      render: (r) => (
                        <span style={{ display: "grid", gap: 2 }}>
                          <span>{r.releasedOn}</span>
                          <span className="tk-meta">{r.releasedTime}</span>
                        </span>
                      ),
                    },
                    { key: "releasedBy", header: "Released By" },
                    {
                      key: "reference",
                      header: "Reference",
                      render: (r) => (
                        <span className="tk-mono">{r.reference}</span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r) => <Badge>{r.status}</Badge>,
                    },
                  ]}
                />
              </SectionCard>
            </div>
          )}

          {tab === "Escrow Accounts" && (
            <DataTable
              rows={accounts}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "name",
                  header: "Account",
                  render: (r) => (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
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
                        <Icon name="landmark" size={16} />
                      </span>
                      <span
                        style={{
                          font: "600 13px/18px var(--tk-font-sans)",
                          color: "var(--tk-ink-900)",
                        }}
                      >
                        {r.name}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "id",
                  header: "Account ID",
                  render: (r) => <span className="tk-mono">{r.id}</span>,
                },
                {
                  key: "balance",
                  header: "Balance (₦)",
                  align: "right",
                  render: (r) => <b>{r.balance.toLocaleString("en-NG")}</b>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
              ]}
            />
          )}

          {tab === "Holds" && (
            <DataTable
              rows={holds}
              rowKey={(r) => r.holdId}
              columns={[
                {
                  key: "holdId",
                  header: "Hold ID",
                  render: (r) => (
                    <Link to={`/escrow/${r.holdId}`} className="tk-mono">
                      {r.holdId}
                    </Link>
                  ),
                },
                { key: "jobId", header: "Job/Trip ID" },
                { key: "customer", header: "Customer" },
                { key: "route", header: "Route" },
                {
                  key: "amount",
                  header: "Amount (₦)",
                  align: "right",
                  render: (r) => r.amount.toLocaleString("en-NG"),
                },
                {
                  key: "heldOn",
                  header: "Held On",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.heldOn}</span>
                      <span className="tk-meta">{r.heldTime}</span>
                    </span>
                  ),
                },
                { key: "releaseBy", header: "Release By" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
                {
                  key: "x",
                  header: "Actions",
                  width: 130,
                  render: (r) =>
                    r.status === "Released" ? (
                      <Badge tone="success">Released</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => releaseEscrowHold(r.holdId)}
                      >
                        Release
                      </Button>
                    ),
                },
              ]}
            />
          )}

          {tab === "Releases" && (
            <DataTable
              rows={releases}
              rowKey={(r) => r.releaseId}
              columns={[
                {
                  key: "releaseId",
                  header: "Release ID",
                  render: (r) => <span className="tk-mono">{r.releaseId}</span>,
                },
                { key: "jobId", header: "Job/Trip ID" },
                { key: "releasedTo", header: "Released To" },
                {
                  key: "amount",
                  header: "Amount (₦)",
                  align: "right",
                  render: (r) => r.amount.toLocaleString("en-NG"),
                },
                {
                  key: "releasedOn",
                  header: "Released On",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.releasedOn}</span>
                      <span className="tk-meta">{r.releasedTime}</span>
                    </span>
                  ),
                },
                { key: "releasedBy", header: "Released By" },
                {
                  key: "reference",
                  header: "Reference",
                  render: (r) => <span className="tk-mono">{r.reference}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
              ]}
            />
          )}

          {tab === "Disputes" &&
            (disputes.length === 0 ? (
              <EmptyState
                icon="shield-check"
                title="No open disputes"
                description="All escrow disputes have been resolved."
              />
            ) : (
              <DataTable
                rows={disputes}
                rowKey={(r) => r.id}
                columns={[
                  {
                    key: "id",
                    header: "Dispute ID",
                    render: (r) => <span className="tk-mono">{r.id}</span>,
                  },
                  { key: "jobId", header: "Job ID" },
                  {
                    key: "holdId",
                    header: "Hold ID",
                    render: (r) => <span className="tk-mono">{r.holdId}</span>,
                  },
                  { key: "customer", header: "Customer" },
                  {
                    key: "amount",
                    header: "Amount (₦)",
                    align: "right",
                    render: (r) => r.amount.toLocaleString("en-NG"),
                  },
                  { key: "reason", header: "Reason" },
                  { key: "opened", header: "Opened" },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => (
                      <Badge
                        tone={
                          r.status === "Resolved"
                            ? "success"
                            : r.status === "Open"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "x",
                    header: "Actions",
                    width: 120,
                    render: (r) =>
                      r.status === "Resolved" ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveDispute(r.id)}
                        >
                          Resolve
                        </Button>
                      ),
                  },
                ]}
              />
            ))}

          {tab === "Transactions" && (
            <DataTable
              rows={tx}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "id",
                  header: "Transaction ID",
                  render: (r) => <span className="tk-mono">{r.id}</span>,
                },
                {
                  key: "type",
                  header: "Type",
                  render: (r) => (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Icon name={r.icon} size={15} color={r.tone} />
                      {r.type}
                    </span>
                  ),
                },
                { key: "jobId", header: "Job ID" },
                { key: "party", header: "Party" },
                {
                  key: "amount",
                  header: "Amount (₦)",
                  align: "right",
                  render: (r) => (
                    <span
                      style={{
                        font: "600 13px/18px var(--tk-font-sans)",
                        color: r.pos ? "var(--tk-success)" : "var(--tk-danger)",
                      }}
                    >
                      {r.pos ? "+" : "-"}
                      {r.amount.toLocaleString("en-NG")}
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Date",
                  render: (r) => (
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>{r.date}</span>
                      <span className="tk-meta">{r.time}</span>
                    </span>
                  ),
                },
              ]}
            />
          )}

          {tab === "Escrow Rules" && (
            <div style={{ padding: "4px var(--tk-card-pad) 8px" }}>
              {escrowRules.map((r) => (
                <ListRow
                  key={r.id}
                  icon={r.icon}
                  iconTint={r.iconTint}
                  title={r.name}
                  subtitle={r.description}
                  value={r.value}
                />
              ))}
            </div>
          )}

          {tab === "Activity Log" && (
            <div
              style={{ padding: "18px var(--tk-card-pad) var(--tk-card-pad)" }}
            >
              <Timeline
                items={escrowActivityLog.map((a) => ({
                  title: a.text,
                  description: `by ${a.actor}`,
                  time: a.time,
                  state: "done",
                  icon: "check",
                }))}
              />
            </div>
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
            title="Escrow Accounts"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Escrow Accounts");
                }}
              >
                Manage Accounts →
              </a>
            }
          >
            {accounts.map((a) => (
              <ListRow
                key={a.id}
                icon="landmark"
                title={a.name}
                subtitle={a.id}
                value={formatNaira(a.balance)}
                trailing={<Badge tone="success">{a.status}</Badge>}
              />
            ))}
          </SectionCard>

          <SectionCard
            title="Funds Flow (This Week)"
            footer={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Transactions");
                }}
              >
                View Report →
              </a>
            }
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FlowBox
                label="Funds Held"
                value={`₦${(escrowWeeklyActivity.fundsHeld / 1000000).toFixed(2)}M`}
                caption={`${escrowWeeklyActivity.fundsHeldTx} transactions`}
                color="var(--tk-warning)"
              />
              <Icon name="arrow-right" size={16} color="var(--tk-ink-300)" />
              <FlowBox
                label="Funds Released"
                value={`₦${(escrowWeeklyActivity.fundsReleased / 1000000).toFixed(2)}M`}
                caption={`${escrowWeeklyActivity.fundsReleasedTx} transactions`}
                color="var(--tk-success)"
              />
              <Icon name="arrow-right" size={16} color="var(--tk-ink-300)" />
              <FlowBox
                label="Settlements Made"
                value={`₦${(escrowWeeklyActivity.settlementsMade / 1000000).toFixed(2)}M`}
                caption={`${escrowWeeklyActivity.settlementsCount} settlements`}
                color="var(--tk-blue)"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Escrow Alerts"
            action={
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setTab("Disputes");
                }}
              >
                View All
              </a>
            }
          >
            {escrowAlerts.map((a, i) => (
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

      <Modal
        open={modal === "add"}
        onClose={() => setModal(null)}
        title="Add Funds to Escrow"
        description="Top up the platform escrow balance."
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !Number(amount) || Number(amount) <= 0}
              onClick={handleAddFunds}
            >
              {busy ? "Processing…" : "Add Funds"}
            </Button>
          </>
        }
      >
        <TextField
          label="Amount (₦)"
          required
          type="number"
          min="1"
          placeholder="e.g. 500000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Modal>
    </>
  );
}
