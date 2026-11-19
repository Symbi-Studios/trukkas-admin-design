"use client";
import { usePageSearchState, matchesPageSearch } from '../components/PageSearch.jsx';

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  Tabs,
  DataTable,
  Badge,
  IconButton,
  DropdownMenu,
  Icon,
  Timeline,
  TableToolbar,
  SearchField,
  EmptyState,
  Skeleton,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from '../domain/statsPeriod.js';
import { initialSearch, initialTab } from '../domain/urlState.js';
import { FilterChip } from '../components/FilterChip.jsx';
import {
  useGetAdminEscrowOverviewQuery, useGetAdminEscrowRegisterQuery,
  useGetAdminEscrowDisputesQuery, useGetAdminEscrowActivityQuery,
  emptyEscrowOverview,
  escrowMoney as formatNaira, escrowNumber,
} from "../store/features/wallets/walletsApi.js";
import { escrowCanRelease, escrowMoneyRoles } from '../store/features/wallets/walletActionsApi.js';
import { WalletActionDialog } from './WalletActionDialog.jsx';
import { DriverTableLoading } from "./DriversLoading.jsx";

// Escrow covers money while it is held. Releases are listed under Settlements,
// every escrow movement is in Transactions, and escrow terms are on Platform Rates.
const TABS = [
  "Holds",
  "Disputes",
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

export function Wallets() {
  const owner = useSelector(state => state.auth.admin?.id), role = useSelector(state => state.auth.admin?.role);
  const authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <WalletScreen key={String(owner)+':'+String(role)+':'+authenticated} />;
}
function WalletScreen() {
  const role = useSelector(state => state.auth.admin?.role);
  const [action, setAction] = useState(null);
  const [tab, setTab] = useState(() => initialTab(TABS, "Holds"));
  const [search, setSearch] = usePageSearchState(initialSearch());
  const [holdStatus, setHoldStatus] = useState("All Statuses");
  const [disputeStatus, setDisputeStatus] = useState("All Statuses");
  const navigate = useNavigate();
  const owner = useSelector((state) => state.auth.admin?.id);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken && state.auth.admin?.id));
  const [statsPeriodKey, setStatsPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const statsRange = useMemo(() => statsPeriodRange(statsPeriodKey), [statsPeriodKey]);
  const overviewQuery = useGetAdminEscrowOverviewQuery({ owner, role, ...statsRange }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const registerQuery = useGetAdminEscrowRegisterQuery({ owner, role }, { skip: !authenticated || tab !== "Holds", refetchOnMountOrArgChange: true });
  const disputesQuery = useGetAdminEscrowDisputesQuery({ owner, role }, { skip: !authenticated || tab !== "Disputes", refetchOnMountOrArgChange: true });
  const activityQuery = useGetAdminEscrowActivityQuery({ owner, role }, { skip: !authenticated || tab !== "Activity Log", refetchOnMountOrArgChange: true });
  const { summary } = authenticated && !overviewQuery.error ? overviewQuery.currentData || emptyEscrowOverview : emptyEscrowOverview;
  const allHolds = authenticated && !registerQuery.error ? registerQuery.currentData || [] : [];
  const holds = allHolds.filter(row => matchesPageSearch(row, search) && (holdStatus === "All Statuses" || row.status === holdStatus));
  const allDisputes = authenticated && !disputesQuery.error ? disputesQuery.currentData || [] : [];
  const disputes = allDisputes.filter(row => matchesPageSearch(row, search) && (disputeStatus === "All Statuses" || row.status === disputeStatus));
  const statusOptions = (rows) => ["All Statuses", ...new Set(rows.map((row) => row.status).filter((value) => value && value !== "—"))];
  const escrowActivityLog = (authenticated && !activityQuery.error ? activityQuery.currentData || [] : []).filter(row => matchesPageSearch(row, search));
  const metric = (value) => overviewQuery.isLoading ? <Skeleton as="span" width={96} height={23} /> : formatNaira(value);

  return (
    <>
      <PageHeader
        crumbs={["Finance", "Escrow"]}
        title="Escrow"
        description="Job payments held in escrow until they are released to truckers or refunded to forwarders."
        actions={
          <>
            <Button variant="outline" icon="coins" onClick={() => navigate("/settlements?tab=Escrow%20Releases")}>
              View Releases
            </Button>
            <Button variant="outline" icon="receipt" onClick={() => navigate("/transactions?type=Escrow")}>
              Escrow Transactions
            </Button>
          </>
        }
      />

      <StatsPanel period={statsPeriodKey} onPeriodChange={setStatsPeriodKey} columns={3}>
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
      </StatsPanel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
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
          {(tab === "Holds" || tab === "Disputes") && (
            <TableToolbar
              search={<SearchField placeholder={tab === "Holds" ? "Search by hold ID, job, customer or route…" : "Search by dispute, job, hold or customer…"} value={search} onChange={(e) => setSearch(e.target.value)} />}
              filters={tab === "Holds"
                ? <FilterChip name="Status" icon="circle-dot" value={holdStatus} allValue="All Statuses" options={statusOptions(allHolds)} onChange={setHoldStatus} />
                : <FilterChip name="Status" icon="circle-dot" value={disputeStatus} allValue="All Statuses" options={statusOptions(allDisputes)} onChange={setDisputeStatus} />}
              onClear={(tab === "Holds" ? holdStatus : disputeStatus) !== "All Statuses" || search.trim() ? () => { setSearch(""); setHoldStatus("All Statuses"); setDisputeStatus("All Statuses"); } : undefined}
            />
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
                        disabled={!escrowMoneyRoles.includes(role) || !escrowCanRelease(r) || registerQuery.isFetching}
                        onClick={() => setAction({ kind:'release',record:r })}
                      >
                        Release
                      </Button>
                    ),
                },
              ]}
            />)}</>
          )}

          {tab === "Disputes" &&
            (disputesQuery.currentData && !disputesQuery.error && !disputesQuery.isFetching && disputesQuery.currentData.length === 0 ? (
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
                          disabled={!r.canResolve || disputesQuery.isFetching || !r.jobApiId}
                          onClick={() => setAction({ kind:'resolve',record:r })}
                        >
                          Resolve
                        </Button>
                      ),
                  },
                ]}
              />)}</>
            ))}

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

      </div>

      {action && <WalletActionDialog key={action.kind+':'+(action.record.holdId || action.record.id)} kind={action.kind} record={action.record} owner={owner} role={role} onClose={() => setAction(null)} />}
    </>
  );
}
