"use client";
import { formatNairaAmount, formatNairaShort } from "../lib/money.js";

import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  Button,
  Card,
  DonutChart,
  Icon,
  LineChart,
  ListRow,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
} from "../ds.js";
import { formatNaira } from "../mock/format.js";
import { statsPeriod, statsPeriodDates, statsPeriodRange } from "../domain/statsPeriod.js";
import { useGetAdminFinanceOverviewQuery } from "../store/features/finance/financeOverviewApi.js";
import { useGetAdminTransactionStatsQuery } from "../store/features/transactions/transactionsApi.js";
import { useGetAdminPayoutSummaryQuery } from "../store/features/payouts/payoutsApi.js";
import styles from "./FinanceOverview.module.css";

const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const count = (value) => (isNum(value) ? new Intl.NumberFormat("en-NG").format(value) : "—");
/** ₦12.5m style for cards and chart axes; full kobo amounts stay in lists. */
const compact = (value) => (isNum(value) ? formatNairaShort(value) : "—");
/** Full amount for stat cards: StatCard shortens it and keeps the exact figure in a hover tooltip. */
const full = (value) => (isNum(value) ? formatNairaAmount(value) : "—");
const pct = (value) => (isNum(value) ? `${Number(value.toFixed(1))}%` : "—");

/** StatCard delta props for a % change; nothing when there's no comparison. */
function change(value, period, unit = "%") {
  if (!isNum(value) || !period.compare) return {};
  return { delta: `${Number(Math.abs(value).toFixed(1))}${unit}`, direction: value >= 0 ? "up" : "down", caption: period.vs };
}

const PERIOD_KEY = "1m";

export function FinanceOverview() {
  const navigate = useNavigate();
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const [periodKey, setPeriodKey] = useState(PERIOD_KEY);
  const period = statsPeriod(periodKey);
  const range = useMemo(() => statsPeriodRange(periodKey), [periodKey]);
  const dates = useMemo(() => statsPeriodDates(periodKey), [periodKey]);

  const overviewQuery = useGetAdminFinanceOverviewQuery(range, { skip: !authenticated });
  const txQuery = useGetAdminTransactionStatsQuery({ from: dates.from, to: dates.to }, { skip: !authenticated });
  const payoutQuery = useGetAdminPayoutSummaryQuery(undefined, { skip: !authenticated });

  const overview = overviewQuery.currentData;
  const tx = txQuery.currentData;
  const payoutQueue = payoutQuery.currentData;
  const fetching = overviewQuery.isFetching && !overview;

  if (!overview && overviewQuery.isError) {
    return (
      <div className={styles.page}>
        <Card className={styles.loadError}>
          <span className={styles.loadErrorIcon} aria-hidden="true">!</span>
          <h1>Finance overview couldn’t be loaded</h1>
          <p>Check your connection and try loading the overview again.</p>
          <Button onClick={overviewQuery.refetch}>Try again</Button>
        </Card>
      </div>
    );
  }

  const v = (node) => (fetching || (!overview && authenticated) ? <Skeleton as="span" width={72} height={23} /> : node);
  const b = overview?.balances;
  const p = overview?.payouts;

  const attention = [
    { icon: "hand-coins", tint: "amber", title: "Payout requests to review", subtitle: "Withdrawals awaiting approval", value: payoutQueue?.pending, route: "/payouts" },
    { icon: "circle-x", tint: "red", title: "Failed payouts", subtitle: isNum(p?.failedAmount) ? `${formatNaira(p.failedAmount)} not delivered` : "Bank transfers that didn’t go through", value: p?.failedCount, route: "/payouts", danger: true },
    { icon: "shield-alert", tint: "red", title: "Disputed escrow", subtitle: isNum(b?.disputed) ? `${formatNaira(b.disputed)} frozen` : "Funds frozen in disputes", value: b?.disputedCount, route: "/wallets", danger: true },
    { icon: "circle-check", tint: "green", title: "Ready to settle", subtitle: isNum(b?.availableToSettle) ? `${formatNaira(b.availableToSettle)} delivered, awaiting release` : "Delivered jobs awaiting release", value: b?.availableToSettleCount, route: "/wallets" },
    { icon: "triangle-alert", tint: "amber", title: "Transaction alerts", subtitle: "Failed, stuck or flagged payments", value: tx?.alerts?.length ?? null, route: "/transactions" },
  ];
  const attentionTotal = attention.filter((row) => isNum(row.value)).reduce((total, row) => total + (row.tint === "green" ? 0 : row.value), 0);

  const w = overview?.weekly;
  const weekly = [
    { icon: "lock", label: "Funds held", amount: w?.fundsHeld, sub: isNum(w?.fundsHeldTx) ? `${count(w.fundsHeldTx)} jobs funded` : null, color: "var(--tk-viz-1)" },
    { icon: "lock-open", label: "Funds released", amount: w?.fundsReleased, sub: isNum(w?.fundsReleasedTx) ? `${count(w.fundsReleasedTx)} releases` : null, color: "var(--tk-viz-3)" },
    { icon: "banknote", label: "Settlements paid", amount: w?.settlements, sub: isNum(w?.settlementsCount) ? `${count(w.settlementsCount)} settlements` : null, color: "var(--tk-success)" },
    { icon: "shield-alert", label: "New disputes", amount: w?.newDisputesAmount, sub: isNum(w?.newDisputes) ? `${count(w.newDisputes)} opened` : null, color: "var(--tk-danger)" },
  ];
  const weeklyMax = Math.max(1, ...weekly.map((row) => (isNum(row.amount) ? row.amount : 0)));

  const segments = overview?.segments;
  const segmentsTotal = overview?.segmentsTotal ?? b?.total;

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Finance", { label: "Overview", to: "/finance-overview" }]}
        title="Finance Overview"
        description="Money held in escrow, paid out and earned across Trukkas."
        actions={
          <>
            <Button variant="outline" icon="lock" onClick={() => navigate("/wallets")}>Escrow</Button>
            <Button variant="outline" icon="banknote" onClick={() => navigate("/payouts")}>Payouts</Button>
            <Button variant="outline" icon="receipt" onClick={() => navigate("/transactions")}>Transactions</Button>
          </>
        }
      />

      <StatsPanel period={periodKey} onPeriodChange={setPeriodKey}>
        <StatCard layout="stack" icon="chart-line" tint="green" label="Commission Earned" value={v(full(overview?.commission.earned))}
          {...change(overview?.commission.delta, period)} caption={change(overview?.commission.delta, period).caption ?? (isNum(overview?.commission.rate) ? `${overview.commission.rate}% platform rate` : undefined)} />
        <StatCard layout="stack" icon="lock" tint="navy" label="Escrow Balance" value={v(full(b?.total))}
          {...change(b?.totalDelta, period)} caption={change(b?.totalDelta, period).caption ?? "At the end of the period"} />
        <StatCard layout="stack" icon="send" tint="blue" label="Total Paid Out" value={v(full(overview?.totalPaidOut))}
          {...change(overview?.totalPaidOutDelta, period)} caption={change(overview?.totalPaidOutDelta, period).caption ?? "Escrows settled"} />
        <StatCard layout="stack" icon="truck" tint="teal" label="Paid to Truckers" value={v(full(p?.toTruckers))}
          caption={isNum(p?.trips) ? `Across ${count(p.trips)} trips` : undefined} />
        <StatCard layout="stack" icon="badge-check" tint="purple" label="Payout Success" value={v(pct(p?.successRate))}
          {...change(p?.successRateDelta, period, " pts")} caption={change(p?.successRateDelta, period).caption ?? "Bank transfers delivered"} />
        <StatCard layout="stack" icon="hourglass" tint="amber" label="Demurrage Collected" value={v(full(overview?.demurrage.collected))}
          caption={isNum(overview?.demurrage.charged) ? `${compact(overview.demurrage.charged)} charged` : undefined} />
      </StatsPanel>

      <section className={styles.gridTwo}>
        <SectionCard title="Escrow Right Now" description="Where every naira held on the platform currently sits"
          action={<button type="button" className={styles.linkButton} onClick={() => navigate("/wallets")}>Open escrow</button>}>
          {segments ? (
            <div className={styles.donutRow}>
              <DonutChart size={168} thickness={22} data={segments} centerValue={compact(segmentsTotal)} centerLabel="In escrow" />
              <div className={styles.segmentList}>
                {segments.map((row) => (
                  <div key={row.key || row.label} className={styles.segment}>
                    <i style={{ background: row.color }} />
                    <span className={styles.segmentLabel}>{row.label}{isNum(row.count) && <small>{count(row.count)} {row.count === 1 ? "job" : "jobs"}</small>}</span>
                    <strong>{formatNaira(row.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : fetching || (!overview && authenticated) ? (
            <div className={styles.donutRow}><Skeleton width={168} height={168} radius={84} /><LoadingLines /></div>
          ) : (
            <Empty icon="chart-pie" title="Escrow breakdown unavailable" text="The current escrow split hasn’t been returned yet." />
          )}
          <dl className={styles.facts}>
            <div><dt>Jobs with funds in escrow</dt><dd>{count(overview?.activeJobs)}</dd></div>
            <div><dt>Paid to forwarders (refunds)</dt><dd>{isNum(p?.toForwarders) ? formatNaira(p.toForwarders) : "—"}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Commission Trend" description="Platform commission earned per day · last 7 days"
          action={<button type="button" className={styles.linkButton} onClick={() => navigate("/revenue")}>Platform revenue</button>}>
          {overview?.trend ? (
            <LineChart area height={200} labels={overview.trend.map((row) => row.label)} series={[{ name: "Commission", color: "var(--tk-success)", points: overview.trend.map((row) => row.value) }]} format={compact} />
          ) : fetching || (!overview && authenticated) ? (
            <Skeleton height={200} radius={10} />
          ) : (
            <Empty icon="chart-line" title="No commission trend yet" text="Daily commission appears here once jobs are paid." />
          )}
          <div className={styles.trendFacts}>
            <div><span>Daily average</span><strong>{isNum(overview?.trendDailyAverage) ? formatNaira(overview.trendDailyAverage) : "—"}</strong></div>
            <div><span>Best day</span><strong>{overview?.trendBestDay ? `${formatNaira(overview.trendBestDay.value)}` : "—"}</strong>{overview?.trendBestDay && <small>{overview.trendBestDay.label}</small>}</div>
            <div><span>Commission rate</span><strong>{isNum(overview?.commission.rate) ? `${overview.commission.rate}%` : "—"}</strong></div>
          </div>
        </SectionCard>
      </section>

      <section className={styles.gridThree}>
        <SectionCard title="Needs Attention" count={attentionTotal > 0 ? attentionTotal : undefined} pad="none">
          <div className={styles.list}>
            {attention.map((row) => (
              <ListRow
                key={row.title}
                icon={row.icon}
                iconTint={row.tint}
                title={row.title}
                subtitle={row.subtitle}
                value={count(row.value)}
                valueTone={isNum(row.value) && row.value > 0 ? (row.danger ? "var(--tk-danger)" : "var(--tk-ink-900)") : "var(--tk-ink-400)"}
                chevron
                onClick={() => navigate(row.route)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Money Movement" description={period.key === "all" ? "All transactions" : `Transactions · ${period.summary.toLowerCase()}`}
          action={<button type="button" className={styles.linkButton} onClick={() => navigate("/transactions")}>View all</button>}>
          <div className={styles.flow}>
            <FlowRow icon="arrow-down-left" tone="in" label="Inflow" value={tx?.totalInflow} loading={!tx && txQuery.isFetching} />
            <FlowRow icon="arrow-up-right" tone="out" label="Outflow" value={tx?.totalOutflow} loading={!tx && txQuery.isFetching} />
            <div className={styles.flowNet}>
              <span>Net movement</span>
              <strong data-negative={isNum(tx?.netMovement) && tx.netMovement < 0 || undefined}>{!tx && txQuery.isFetching ? <Skeleton as="span" width={90} height={18} /> : isNum(tx?.netMovement) ? formatNaira(tx.netMovement) : "—"}</strong>
            </div>
          </div>
          <dl className={styles.facts}>
            <div><dt>Transactions</dt><dd>{count(tx?.totalTransactions)}</dd></div>
            <div><dt>Successful</dt><dd>{count(tx?.successfulCount)}</dd></div>
            <div><dt>Failed or reversed</dt><dd>{count(tx?.failedReversedCount)}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Last 7 Days" description="Escrow activity over the past week">
          <div className={styles.weekly}>
            {weekly.map((row) => (
              <div key={row.label} className={styles.weeklyRow}>
                <span className={styles.weeklyIcon} style={{ color: row.color }}><Icon name={row.icon} size={15} /></span>
                <div className={styles.weeklyMain}>
                  <div className={styles.weeklyHead}>
                    <span>{row.label}</span>
                    <strong>{fetching ? <Skeleton as="span" width={70} height={14} /> : isNum(row.amount) ? formatNaira(row.amount) : "—"}</strong>
                  </div>
                  <span className={styles.weeklyTrack}><span style={{ width: `${isNum(row.amount) ? (row.amount / weeklyMax) * 100 : 0}%`, background: row.color }} /></span>
                  {row.sub && <small>{row.sub}</small>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function FlowRow({ icon, tone, label, value, loading }) {
  return (
    <div className={styles.flowRow}>
      <span className={styles.flowIcon} data-tone={tone}><Icon name={icon} size={16} /></span>
      <span>{label}</span>
      <strong>{loading ? <Skeleton as="span" width={90} height={16} /> : isNum(value) ? formatNaira(value) : "—"}</strong>
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={20} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LoadingLines({ rows = 4 }) {
  return (
    <div className={styles.loadingLines}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={11} width={["80%", "64%", "72%", "56%"][index % 4]} />
      ))}
    </div>
  );
}
