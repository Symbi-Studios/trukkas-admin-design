"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
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
  Skeleton,
} from "../ds.js";
import {
  useGetAdminEscrowOverviewQuery, useGetAdminEscrowRegisterQuery,
  useGetAdminEscrowLedgerQuery, useGetAdminEscrowDisputesQuery,
  useGetAdminEscrowRulesQuery, useGetAdminEscrowActivityQuery,
  emptyEscrowOverview, adaptEscrowRules,
  escrowMoney as formatNaira, escrowNumber, escrowMillions, escrowCount,
  useGetAdminEscrowReleasesQuery, useGetAdminEscrowAccountsQuery, useGetAdminEscrowAlertsQuery,
} from "../store/features/wallets/walletsApi.js";
import { DriverTableLoading } from "./DriversLoading.jsx";

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
  const [tab, setTab] = useState("Escrow Overview");
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState("");
  const busy = false;
  const navigate = useNavigate();
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const overviewQuery = useGetAdminEscrowOverviewQuery({ owner }, { skip: !authenticated });
  const registerQuery = useGetAdminEscrowRegisterQuery({ owner }, { skip: !authenticated || !["Escrow Overview", "Holds"].includes(tab) });
  const releasesQuery = useGetAdminEscrowReleasesQuery({ owner }, { skip: !authenticated || !["Escrow Overview", "Releases"].includes(tab) });
  const ledgerQuery = useGetAdminEscrowLedgerQuery({ owner }, { skip: !authenticated || tab !== "Transactions" });
  const accountsQuery = useGetAdminEscrowAccountsQuery({ owner }, { skip: !authenticated });
  const alertsQuery = useGetAdminEscrowAlertsQuery({ owner }, { skip: !authenticated });
  const disputesQuery = useGetAdminEscrowDisputesQuery({ owner }, { skip: !authenticated || tab !== "Disputes" });
  const rulesQuery = useGetAdminEscrowRulesQuery({ owner }, { skip: !authenticated || tab !== "Escrow Rules" });
  const activityQuery = useGetAdminEscrowActivityQuery({ owner }, { skip: !authenticated || tab !== "Activity Log" });
  const { summary, breakdown: escrowBalanceBreakdown, weeklyActivity: escrowWeeklyActivity } = authenticated && !overviewQuery.error ? overviewQuery.currentData || emptyEscrowOverview : emptyEscrowOverview;
  const accounts = authenticated && !accountsQuery.error ? accountsQuery.currentData || [] : [];
  const holds = authenticated && !registerQuery.error ? registerQuery.currentData || [] : [];
  const tx = authenticated && !ledgerQuery.error ? ledgerQuery.currentData || [] : [];
  const releases = authenticated && !releasesQuery.error ? releasesQuery.currentData || [] : [];
  const disputes = authenticated && !disputesQuery.error ? disputesQuery.currentData || [] : [];
  const escrowRules = authenticated && !rulesQuery.error ? rulesQuery.currentData || adaptEscrowRules(null) : adaptEscrowRules(null);
  const escrowActivityLog = authenticated && !activityQuery.error ? activityQuery.currentData || [] : [];
  const escrowAlerts = authenticated && !alertsQuery.error ? alertsQuery.currentData || [] : [];
  const metric = (value) => overviewQuery.isLoading ? <Skeleton as="span" width={96} height={23} /> : formatNaira(value);

  return (
    <>
      <PageHeader
        crumbs={["Business & Finance", "Escrow & Wallets"]}
        title="Escrow Wallet"
        description="Secure funds in escrow and manage holds, releases, and settlements."
        actions={
          <>
            <FilterSelect label="—" icon="calendar" />
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
          value={metric(summary.totalEscrowBalance)}
          delta={summary.totalEscrowBalanceDelta}
          caption="—"
        />
        <StatCard
          icon="lock"
          tint="amber"
          label="Held in Escrow"
          value={metric(summary.heldInEscrow)}
          delta={summary.heldInEscrowDelta}
          caption="—"
        />
        <StatCard
          icon="hourglass"
          tint="purple"
          label="Pending Release"
          value={metric(summary.pendingRelease)}
          delta={summary.pendingReleaseDelta}
          direction="down"
          caption="—"
        />
        <StatCard
          icon="circle-check"
          tint="green"
          label="Available to Settle"
          value={metric(summary.availableToSettle)}
          delta={summary.availableToSettleDelta}
          caption="—"
        />
        <StatCard
          icon="coins"
          tint="blue"
          label="Completed Releases"
          value={metric(summary.completedReleases)}
          delta={summary.completedReleasesDelta}
          caption="—"
        />
        <StatCard
          icon="triangle-alert"
          tint="red"
          label="Disputed Amounts"
          value={metric(summary.disputedAmounts)}
          delta={summary.disputedAmountsDelta}
          direction="down"
          caption="—"
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
                      centerValue={escrowMillions(summary.totalEscrowBalance)}
                      centerLabel="Total Balance"
                      data={escrowBalanceBreakdown.filter((d) => d.chartValue != null).map((d) => ({
                        label: d.label,
                        value: d.chartValue,
                        color: d.color,
                      }))}
                    />
                    <LegendList
                      style={{ width: "100%" }}
                      items={escrowBalanceBreakdown.map((d) => ({
                        label: d.label,
                        value: d.value,
                        display: d.value == null ? "—" : `${formatNaira(d.value)} (${d.pct})`,
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
                        caption: escrowCount(escrowWeeklyActivity.fundsHeldTx, "transactions"),
                      },
                      {
                        icon: "lock-open",
                        tint: "green",
                        label: "Funds Released",
                        value: formatNaira(escrowWeeklyActivity.fundsReleased),
                        caption: escrowCount(escrowWeeklyActivity.fundsReleasedTx, "transactions"),
                      },
                      {
                        icon: "coins",
                        tint: "blue",
                        label: "Settlements Made",
                        value: formatNaira(
                          escrowWeeklyActivity.settlementsMade,
                        ),
                        caption: escrowCount(escrowWeeklyActivity.settlementsCount, "settlements"),
                      },
                      {
                        icon: "triangle-alert",
                        tint: "red",
                        label: "New Disputes",
                        value: escrowNumber(escrowWeeklyActivity.newDisputes),
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
                {registerQuery.isLoading ? <DriverTableLoading columns={8} label="Loading escrow records" /> : (<DataTable
                  rows={holds.slice(0, 5)}
                  rowKey={(r) => r.holdId}
                  columns={[
                    {
                      key: "holdId",
                      header: "Hold ID",
                      render: (r) => (
                        <Link to={r.detailUrl} className="tk-mono">
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
                      render: (r) => escrowNumber(r.amount),
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
                            onClick={() => navigate(r.detailUrl)}
                          />
                        </span>
                      ),
                    },
                  ]}
                />)}
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
                {releasesQuery.isLoading ? <DriverTableLoading columns={8} label="Loading escrow records" /> : (<DataTable
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
                      render: (r) => escrowNumber(r.amount),
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
                />)}
              </SectionCard>
            </div>
          )}

          {tab === "Escrow Accounts" && (
            <>{accountsQuery.isLoading ? <DriverTableLoading columns={4} label="Loading escrow records" /> : (<DataTable
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
                  render: (r) => <b>{escrowNumber(r.balance)}</b>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
              ]}
            />)}</>
          )}

          {tab === "Holds" && (
            <>{registerQuery.isLoading ? <DriverTableLoading columns={9} label="Loading escrow records" /> : (<DataTable
              rows={holds}
              rowKey={(r) => r.holdId}
              columns={[
                {
                  key: "holdId",
                  header: "Hold ID",
                  render: (r) => (
                    <Link to={r.detailUrl} className="tk-mono">
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
                  render: (r) => escrowNumber(r.amount),
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
                        disabled
                      >
                        Release
                      </Button>
                    ),
                },
              ]}
            />)}</>
          )}

          {tab === "Releases" && (
            <>{releasesQuery.isLoading ? <DriverTableLoading columns={8} label="Loading escrow records" /> : (<DataTable
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
                  render: (r) => escrowNumber(r.amount),
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
            />)}</>
          )}

          {tab === "Disputes" &&
            (disputesQuery.currentData && !disputesQuery.error && !disputesQuery.isFetching && disputes.length === 0 ? (
              <EmptyState
                icon="shield-check"
                title="No open disputes"
                description="All escrow disputes have been resolved."
              />
            ) : (
              <>{disputesQuery.isLoading ? <DriverTableLoading columns={9} label="Loading escrow records" /> : (<DataTable
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
                    render: (r) => escrowNumber(r.amount),
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
                          disabled
                        >
                          Resolve
                        </Button>
                      ),
                  },
                ]}
              />)}</>
            ))}

          {tab === "Transactions" && (
            <>{ledgerQuery.isLoading ? <DriverTableLoading columns={6} label="Loading escrow records" /> : (<DataTable
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
                      {r.amount == null ? "" : r.pos === true ? "+" : r.pos === false ? "-" : ""}
                      {escrowNumber(r.amount)}
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
            />)}</>
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
                  value={rulesQuery.isLoading ? <Skeleton as="span" width={54} height={14} /> : r.value}
                />
              ))}
            </div>
          )}

          {tab === "Activity Log" && (
            <div
              style={{ padding: "18px var(--tk-card-pad) var(--tk-card-pad)" }}
            >
              {activityQuery.isLoading ? <DriverTableLoading columns={3} label="Loading escrow activity" /> : <Timeline
                items={escrowActivityLog.map((a) => ({
                  title: a.text,
                  description: `by ${a.actor}`,
                  time: a.time,
                  state: a.state,
                  icon: "check",
                }))}
              />}
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
            {accountsQuery.isLoading ? <DriverTableLoading columns={3} label="Loading escrow records" /> : accounts.map((a) => (
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
                value={escrowMillions(escrowWeeklyActivity.fundsHeld)}
                caption={escrowCount(escrowWeeklyActivity.fundsHeldTx, "transactions")}
                color="var(--tk-warning)"
              />
              <Icon name="arrow-right" size={16} color="var(--tk-ink-300)" />
              <FlowBox
                label="Funds Released"
                value={escrowMillions(escrowWeeklyActivity.fundsReleased)}
                caption={escrowCount(escrowWeeklyActivity.fundsReleasedTx, "transactions")}
                color="var(--tk-success)"
              />
              <Icon name="arrow-right" size={16} color="var(--tk-ink-300)" />
              <FlowBox
                label="Settlements Made"
                value={escrowMillions(escrowWeeklyActivity.settlementsMade)}
                caption={escrowCount(escrowWeeklyActivity.settlementsCount, "settlements")}
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
            {alertsQuery.isLoading ? <DriverTableLoading columns={3} label="Loading escrow records" /> : escrowAlerts.map((a, i) => (
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
              disabled
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
