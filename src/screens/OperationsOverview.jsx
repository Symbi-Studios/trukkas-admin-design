"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "../router.js";
import {
  Badge,
  BarChart,
  Button,
  Card,
  DonutChart,
  Icon,
  LegendList,
  ListRow,
  PageHeader,
  ProgressBar,
  RankBarList,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
} from "../ds.js";
import { formatNaira } from "../mock/format.js";
import { DEFAULT_STATS_PERIOD, statsPeriod, statsPeriodRange } from "../domain/statsPeriod.js";
import { statusTone } from "../domain/jobStatus";
import { useGetAdminOverviewQuery } from "../store/features/overview/overviewApi.js";
import { useGetAdminJobStatsQuery } from "../store/features/jobs/jobsApi.js";
import { useGetAdminTripStatsQuery } from "../store/features/trips/tripsApi.js";
import { useGetAdminBidAnalyticsQuery } from "../store/features/bids/bidsApi.js";
import { useGetAdminDocReviewStatsQuery } from "../store/features/documents/documentsApi.js";
import styles from "./OperationsOverview.module.css";

const numberFormat = new Intl.NumberFormat("en-NG");
const isNum = (value) => typeof value === "number" && Number.isFinite(value);
const fmt = (value) => (isNum(value) ? numberFormat.format(value) : "—");
const sum = (...values) => (values.every(isNum) ? values.reduce((a, b) => a + b, 0) : null);
const share = (part, whole) => (isNum(part) && isNum(whole) && whole > 0 ? (part / whole) * 100 : null);
const pctLabel = (value) => (isNum(value) ? `${Number(value.toFixed(1))}%` : "—");
const known = (rows) => (rows.every((row) => isNum(row.value)) ? rows : null);
const weekday = new Intl.DateTimeFormat("en-NG", { weekday: "short", timeZone: "Africa/Lagos" });

/** StatCard delta props from a stats card ({ value, changePercent, trend }); none for all-time. */
function delta(card, periodKey) {
  if (periodKey === "all" || !isNum(card?.changePercent)) return {};
  const down = card.trend === "down" || card.changePercent < 0;
  return { delta: `${Math.abs(Number(card.changePercent.toFixed(1)))}%`, direction: down ? "down" : "up", caption: statsPeriod(periodKey).vs };
}

export function OperationsOverview() {
  const navigate = useNavigate();
  const [periodKey, setPeriodKey] = useState(DEFAULT_STATS_PERIOD);
  const range = useMemo(() => statsPeriodRange(periodKey), [periodKey]);

  const overviewQuery = useGetAdminOverviewQuery(undefined, { refetchOnMountOrArgChange: true });
  const jobsQuery = useGetAdminJobStatsQuery(range);
  const tripsQuery = useGetAdminTripStatsQuery(range);
  const bidsQuery = useGetAdminBidAnalyticsQuery(periodKey === "all" ? { allTime: true } : range);
  const docsQuery = useGetAdminDocReviewStatsQuery();

  const overview = overviewQuery.currentData;
  const jobs = jobsQuery.currentData;
  const trips = tripsQuery.currentData;
  const bids = bidsQuery.currentData;
  const docs = docsQuery.currentData;

  const firstLoad = !overview && !jobs && [overviewQuery, jobsQuery].some((query) => !query.isError && (query.isLoading || query.isFetching || query.isUninitialized));
  if (firstLoad) return <OperationsOverviewLoading />;
  if (!overview && !jobs && overviewQuery.isError && jobsQuery.isError) {
    return (
      <div className={styles.page}>
        <Card className={styles.loadError}>
          <span className={styles.loadErrorIcon} aria-hidden="true">!</span>
          <h1>Operations data couldn’t be loaded</h1>
          <p>Check your connection and try loading the overview again.</p>
          <Button onClick={() => { overviewQuery.refetch(); jobsQuery.refetch(); }}>Try again</Button>
        </Card>
      </div>
    );
  }

  const jc = jobs?.cards;
  const tc = trips?.cards;
  const tabs = jobs?.tabs;

  const pipeline = known([
    { label: "Pending approval", value: tabs?.pendingApproval, color: "var(--tk-warning)" },
    { label: "Bidding", value: tabs?.bidding, color: "var(--tk-purple)" },
    { label: "Assigned", value: tabs?.assigned, color: "var(--tk-teal, var(--tk-blue))" },
    { label: "In transit", value: tabs?.inTransit, color: "var(--tk-blue)" },
    { label: "Delivered", value: tabs?.delivered, color: "var(--tk-success)" },
    { label: "Cancelled", value: tabs?.cancelled, color: "var(--tk-ink-300)" },
    { label: "Rejected", value: tabs?.rejected, color: "var(--tk-danger)" },
  ]);

  const tripStages = known([
    { label: "At pickup", value: tc?.atPickup?.value, color: "var(--tk-warning)" },
    { label: "In transit", value: tc?.inTransit?.value, color: "var(--tk-blue)" },
    { label: "At delivery", value: tc?.atDelivery?.value, color: "var(--tk-success)" },
    { label: "Returning container", value: tc?.returningContainer?.value, color: "var(--tk-purple)" },
  ]);
  const liveTrips = tripStages ? sum(...tripStages.map((row) => row.value)) : null;

  const perf = overview?.deliveryPerformance;
  const delivery = known([
    { label: "On time", value: perf?.onTime, color: "var(--tk-success)" },
    { label: "Minor delay", value: perf?.minorDelay, color: "var(--tk-warning)" },
    { label: "Critical delay", value: perf?.critical, color: "var(--tk-danger)" },
  ]);
  const deliveryTotal = delivery ? sum(...delivery.map((row) => row.value)) : null;
  const onTimeRate = share(perf?.onTime, deliveryTotal);

  const weekly = (overview?.weeklyJobVolume || []).filter((row) => row.date && isNum(row.count));
  const weeklyLabels = weekly.map((row) => {
    const date = new Date(row.date);
    return Number.isNaN(date.getTime()) ? row.date : weekday.format(date);
  });

  const funnel = bids?.funnel;
  const funnelSteps = [
    { label: "Jobs published", value: funnel?.jobsPublished, base: funnel?.jobsPublished },
    { label: "Jobs that received bids", value: funnel?.jobsWithBids, base: funnel?.jobsPublished },
    { label: "Bids received", value: funnel?.bidsReceived, base: funnel?.bidsReceived },
    { label: "Bids accepted", value: funnel?.bidsAccepted, base: funnel?.bidsReceived },
    { label: "Jobs completed", value: funnel?.jobsCompleted, base: funnel?.jobsPublished },
  ];
  const margin = bids?.averageWinningMargin;

  const routes = (overview?.topRoutesByVolume || []).filter((route) => isNum(route.trips)).slice(0, 5);

  const attention = [
    { icon: "clipboard-check", tint: "amber", title: "Jobs pending approval", subtitle: "Waiting for an admin decision", value: tabs?.pendingApproval, route: "/jobs" },
    { icon: "flag", tint: "red", title: "Flagged jobs", subtitle: "Raised for investigation", value: tabs?.flagged, route: "/jobs" },
    { icon: "clock-alert", tint: "red", title: "Delayed trips", subtitle: "Running behind schedule", value: tc?.delayed?.value, route: "/trips" },
    { icon: "triangle-alert", tint: "amber", title: "Jobs at risk of delay", subtitle: "Likely to miss their window", value: overview?.jobs?.delayedAtRisk, route: "/jobs" },
    { icon: "file-search", tint: "amber", title: "Jobs awaiting document review", subtitle: "Container and rack documents", value: docs?.awaitingJobs, route: "/documents" },
    { icon: "arrow-left-right", tint: "purple", title: "Counter-offers open", subtitle: "Bids waiting on a response", value: bids?.counterOffers, route: "/bids" },
  ];
  const attentionTotal = sum(...attention.map((row) => row.value));

  const recentJobs = (overview?.recentJobs || []).slice(0, 6);
  const period = statsPeriod(periodKey);

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Operations", "Overview"]}
        title="Operations Overview"
        description="Job flow, live trips, bidding and document review across the platform."
        actions={
          <>
            <Button variant="outline" icon="package" onClick={() => navigate("/jobs")}>Jobs</Button>
            <Button variant="outline" icon="route" onClick={() => navigate("/trips")}>Trips</Button>
            <Button variant="outline" icon="radio-tower" onClick={() => navigate("/bids")}>Bids</Button>
          </>
        }
      />

      <StatsPanel period={periodKey} onPeriodChange={setPeriodKey}>
        <StatCard layout="stack" icon="package" label="Total Jobs" value={fmt(jc?.totalJobs?.value)} {...delta(jc?.totalJobs, periodKey)} />
        <StatCard layout="stack" icon="clipboard-check" tint="amber" label="Pending Approval" value={fmt(jc?.pendingApproval?.value)} {...delta(jc?.pendingApproval, periodKey)} />
        <StatCard layout="stack" icon="truck" tint="teal" label="Trips In Transit" value={fmt(tc?.inTransit?.value)} {...delta(tc?.inTransit, periodKey)} />
        <StatCard layout="stack" icon="circle-check" tint="green" label="Jobs Delivered" value={fmt(jc?.delivered?.value)} {...delta(jc?.delivered, periodKey)} />
        <StatCard layout="stack" icon="radio-tower" tint="purple" label="Open Bids" value={fmt(bids?.pendingBids)} caption={isNum(bids?.totalBids) ? `${fmt(bids.totalBids)} bids in total` : undefined} />
        <StatCard layout="stack" icon="clock-alert" tint="red" label="Delayed Trips" value={fmt(tc?.delayed?.value)} {...delta(tc?.delayed, periodKey)} />
      </StatsPanel>

      <section className={styles.gridTwo}>
        <SectionCard title="Job Pipeline" description={`Jobs by stage · ${period.summary}`} action={<LinkButton onClick={() => navigate("/jobs")} />}>
          {pipeline ? (
            <RankBarList numbered={false} items={pipeline.map((row) => ({ ...row, display: fmt(row.value) }))} />
          ) : (
            <Empty icon="package" title={jobsQuery.isError ? "Job stages couldn’t be loaded" : "Job stages unavailable"} text="Counts by stage haven’t been returned yet." />
          )}
        </SectionCard>

        <SectionCard title="Job Volume" description="Jobs created per day, last 7 days">
          {weekly.length ? (
            <BarChart
              height={220}
              labels={weeklyLabels}
              format={(value) => (Number.isInteger(value) ? numberFormat.format(value) : "")}
              series={[{ name: "Jobs", color: "var(--tk-blue)", points: weekly.map((row) => row.count) }]}
            />
          ) : (
            <Empty icon="chart-column" title="No job volume yet" text="Daily job counts appear here once jobs are created." />
          )}
        </SectionCard>
      </section>

      <section className={styles.gridThree}>
        <SectionCard title="Live Trips by Stage" action={<LinkButton onClick={() => navigate("/trips")} />}>
          {tripStages ? (
            <div className={styles.donutRow}>
              <DonutChart size={124} thickness={18} data={tripStages} centerValue={fmt(liveTrips)} centerLabel="Active" />
              <LegendList style={{ width: "100%" }} items={tripStages.map((row) => ({ ...row, display: fmt(row.value) }))} />
            </div>
          ) : (
            <Empty icon="route" title={tripsQuery.isError ? "Trip stages couldn’t be loaded" : "Trip stages unavailable"} text="Counts by stage haven’t been returned yet." />
          )}
          <dl className={styles.facts}>
            <div><dt>All trips · {period.summary.toLowerCase()}</dt><dd>{fmt(tc?.allTrips?.value)}</dd></div>
            <div><dt>Delayed</dt><dd className={isNum(tc?.delayed?.value) && tc.delayed.value > 0 ? styles.danger : undefined}>{fmt(tc?.delayed?.value)}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Delivery Performance" description="Completed deliveries by punctuality">
          {delivery && deliveryTotal > 0 ? (
            <div className={styles.donutRow}>
              <DonutChart size={124} thickness={18} data={delivery} centerValue={pctLabel(onTimeRate)} centerLabel="On time" />
              <LegendList style={{ width: "100%" }} items={delivery.map((row) => ({ ...row, display: fmt(row.value) }))} />
            </div>
          ) : (
            <Empty icon="timer" title="No deliveries to score yet" text="Punctuality appears once deliveries complete." />
          )}
          <dl className={styles.facts}>
            <div><dt>Completed today</dt><dd>{fmt(overview?.jobs?.completedToday)}</dd></div>
            <div><dt>Cancelled this week</dt><dd>{fmt(overview?.jobs?.cancelledThisWeek)}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Bidding Funnel" description={period.summary} action={<LinkButton onClick={() => navigate("/bids")} />}>
          <div className={styles.funnel}>
            {funnelSteps.map((step, index) => {
              const rate = index === 0 || index === 2 ? null : share(step.value, step.base);
              return (
                <ProgressBar
                  key={step.label}
                  label={step.label}
                  caption={rate == null ? fmt(step.value) : `${fmt(step.value)} · ${pctLabel(rate)}`}
                  value={isNum(step.value) && isNum(step.base) && step.base > 0 ? (step.value / step.base) * 100 : 0}
                  color={index < 2 ? "var(--tk-blue)" : index < 4 ? "var(--tk-purple)" : "var(--tk-success)"}
                />
              );
            })}
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Avg. winning margin</dt>
              <dd>{isNum(margin?.amount) ? `${formatNaira(margin.amount)}${isNum(margin.percent) ? ` (${pctLabel(margin.percent)})` : ""}` : "—"}</dd>
            </div>
          </dl>
        </SectionCard>
      </section>

      <section className={styles.gridThree}>
        <SectionCard title="Needs Attention" count={isNum(attentionTotal) && attentionTotal > 0 ? attentionTotal : undefined} pad="none">
          <div className={styles.list}>
            {attention.map((row) => (
              <ListRow
                key={row.title}
                icon={row.icon}
                iconTint={row.tint}
                title={row.title}
                subtitle={row.subtitle}
                value={fmt(row.value)}
                valueTone={isNum(row.value) && row.value > 0 ? (row.tint === "red" ? "var(--tk-danger)" : "var(--tk-ink-900)") : "var(--tk-ink-400)"}
                chevron
                onClick={() => navigate(row.route)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top Routes" description="By trip volume" action={<LinkButton onClick={() => navigate("/jobs")} />}>
          {routes.length ? (
            <RankBarList items={routes.map((route) => ({ label: route.route, value: route.trips, display: fmt(route.trips) }))} />
          ) : (
            <Empty icon="map" title="No routes yet" text="The busiest routes appear once trips run." />
          )}
        </SectionCard>

        <SectionCard title="Recent Jobs" pad="none" action={<LinkButton onClick={() => navigate("/jobs")} />}>
          {recentJobs.length ? (
            <ul className={styles.feed}>
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <button type="button" className={styles.feedRow} onClick={() => navigate(`/jobs/detail?id=${encodeURIComponent(job.id)}`)}>
                    <span className={styles.feedIcon}><Icon name="package" size={16} /></span>
                    <span className={styles.feedMain}>
                      <span className={styles.feedName}>{job.displayId}</span>
                      <span className={styles.feedMeta} title={job.routeLabel}>{job.routeLabel}</span>
                    </span>
                    <span className={styles.feedSide}>
                      <Badge tone={statusTone(job.status)} dot>{job.status}</Badge>
                      <span className={styles.feedMeta}>{isNum(job.value) ? formatNaira(job.value) : job.company || "—"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="package" title="No recent jobs" text="New jobs appear here as forwarders post them." />
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function LinkButton({ onClick }) {
  return <button type="button" className={styles.linkButton} onClick={onClick}>View all</button>;
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

function OperationsOverviewLoading() {
  const cards = [
    ["package", "Total Jobs"],
    ["clipboard-check", "Pending Approval"],
    ["truck", "Trips In Transit"],
    ["circle-check", "Jobs Delivered"],
    ["radio-tower", "Open Bids"],
    ["clock-alert", "Delayed Trips"],
  ];
  return (
    <div className={styles.page} aria-busy="true">
      <PageHeader crumbs={["Operations", "Overview"]} title="Operations Overview" description="Job flow, live trips, bidding and document review across the platform." />
      <div className={`${styles.loadingNotice} tk-sr-only`} role="status" aria-live="polite">
        <span className={styles.loadingNoticeDot} aria-hidden="true" />
        Loading operations data…
      </div>
      <StatsPanel fixedLabel="Loading">
        {cards.map(([icon, label]) => (
          <StatCard key={label} layout="stack" icon={icon} label={label} value={<Skeleton as="span" width={54} height={23} />} caption={<Skeleton as="span" width={96} height={11} />} />
        ))}
      </StatsPanel>
      <section className={styles.gridTwo} aria-hidden="true">
        <SectionCard title="Job Pipeline"><LoadingLines rows={7} /></SectionCard>
        <SectionCard title="Job Volume"><Skeleton height={220} radius={10} /></SectionCard>
      </section>
      <section className={styles.gridThree} aria-hidden="true">
        {["Live Trips by Stage", "Delivery Performance", "Bidding Funnel"].map((title) => (
          <SectionCard key={title} title={title}>
            <div className={styles.donutRow}><Skeleton width={124} height={124} radius={62} /><LoadingLines /></div>
          </SectionCard>
        ))}
      </section>
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
