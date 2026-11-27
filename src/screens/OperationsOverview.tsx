"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useNavigate } from "../router.js";
import {
  Badge,
  BarChart,
  Banner,
  Button,
  Icon,
  LegendList,
  ListRow,
  PageHeader,
  DonutChart,
  ProgressBar,
  RankBarList,
  SectionCard,
  Skeleton,
  StatCard,
  StatsPanel,
} from "../ds.js";
import { DEFAULT_STATS_PERIOD, statsPeriod } from "../domain/statsPeriod.js";
import { statusTone } from "@/domain/jobStatus";
import { naira } from "@/lib/format";
import type { JobRow, JobStatCard, JobStats } from "@/types/jobs";
import type { BidInsights, OverviewData } from "@/types/overview";
import type { TripStats } from "@/types/trips";
import styles from "./OperationsOverview.module.css";

interface OperationsOverviewProps {
  /** the stats period in the URL (Last day, 7 days, month ...) */
  period: string;
  overview: OverviewData | null;
  jobStats: JobStats | null;
  tripStats: TripStats | null;
  bids: BidInsights | null;
  /** jobs with documents waiting for an admin */
  docsAwaiting: number | null;
  /** the newest jobs where bidding has started and that are not finished */
  activeJobs: JobRow[] | null;
  warnings: string[];
}

const numberFormat = new Intl.NumberFormat("en-NG");
const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const fmt = (value: number | null | undefined): string => (isNum(value) ? numberFormat.format(value) : "—");
const sum = (values: (number | null)[]): number | null => (values.every(isNum) ? values.reduce((a, b) => a + b, 0) : null);
const share = (part: number | null | undefined, whole: number | null): number | null => (isNum(part) && isNum(whole) && whole > 0 ? (part / whole) * 100 : null);
const pctLabel = (value: number | null): string => (isNum(value) ? `${Number(value.toFixed(1))}%` : "—");

interface Slice { label: string; value: number | null; color: string }
interface KnownSlice { label: string; value: number; color: string }

/** The chart is drawn only when every part of it is known: a half-known donut would lie */
function known(rows: Slice[]): KnownSlice[] | null {
  return rows.every((row) => isNum(row.value)) ? (rows as KnownSlice[]) : null;
}

/** StatCard change props from a stats card; none for All time, which has nothing to compare with */
function delta(card: JobStatCard | undefined, period: string): { delta?: string; direction?: "down" | "up"; caption?: string } {
  const change = card?.changePercent;
  if (period === "all" || !isNum(change)) return {};
  const down = card?.trend === "DOWN" || (card?.trend == null && change < 0);
  return { delta: `${Math.abs(Number(change.toFixed(1)))}%`, direction: down ? "down" : "up", caption: statsPeriod(period)?.vs };
}

type Tint = "blue" | "green" | "amber" | "red" | "purple" | "neutral";

export function OperationsOverview({ period, overview, jobStats, tripStats, bids, docsAwaiting, activeJobs, warnings }: OperationsOverviewProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [changing, startTransition] = useTransition();

  if (changing) return <OperationsOverviewLoading />;
  if (!overview && !jobStats) {
    return (
      <div className={styles.page}>
        <SectionCard title="Operations data couldn’t be loaded">
          <Empty icon="triangle-alert" title="Operations data couldn’t be loaded" text="Check your connection and try again." />
          <Button onClick={() => router.refresh()}>Try again</Button>
        </SectionCard>
      </div>
    );
  }

  const jc = jobStats?.cards;
  const tabs = jobStats?.tabs;
  const tc = tripStats?.cards;
  const summary = statsPeriod(period)?.summary ?? "";

  const pipeline = tabs ? known([
    { label: "Pending approval", value: tabs.pendingApproval, color: "var(--tk-warning)" },
    { label: "Bidding", value: tabs.bidding, color: "var(--tk-purple)" },
    { label: "Assigned", value: tabs.assigned, color: "var(--tk-teal, var(--tk-blue))" },
    { label: "In transit", value: tabs.inTransit, color: "var(--tk-blue)" },
    { label: "Delivered", value: tabs.delivered, color: "var(--tk-success)" },
    { label: "Cancelled", value: tabs.cancelled, color: "var(--tk-ink-300)" },
    { label: "Rejected", value: tabs.rejected, color: "var(--tk-danger)" },
  ]) : null;

  // Every stage a trip passes through while it is in progress; delayed is a flag on top of these, not a stage
  const tripStages = tc ? known([
    { label: "Assigned", value: tc.assigned.value, color: "var(--tk-teal, var(--tk-blue))" },
    { label: "At pickup", value: tc.atPickup.value, color: "var(--tk-warning)" },
    { label: "In transit", value: tc.inTransit.value, color: "var(--tk-blue)" },
    { label: "At delivery", value: tc.atDelivery.value, color: "var(--tk-success)" },
    { label: "Returning container", value: tc.returningContainer.value, color: "var(--tk-purple)" },
  ]) : null;
  const tripsInProgress = tripStages ? sum(tripStages.map((row) => row.value)) : null;

  const perf = overview?.delivery;
  const delivery = perf ? known([
    { label: "On time", value: perf.onTime, color: "var(--tk-success)" },
    { label: "Minor delay", value: perf.minorDelay, color: "var(--tk-warning)" },
    { label: "Critical delay", value: perf.critical, color: "var(--tk-danger)" },
  ]) : null;
  const deliveryTotal = delivery ? sum(delivery.map((row) => row.value)) : null;
  const onTimeRate = share(perf?.onTime, deliveryTotal);

  const funnel = bids?.funnel;
  const funnelSteps = [
    { label: "Jobs published", value: funnel?.jobsPublished, base: funnel?.jobsPublished },
    { label: "Jobs that received bids", value: funnel?.jobsWithBids, base: funnel?.jobsPublished },
    { label: "Bids received", value: funnel?.bidsReceived, base: funnel?.bidsReceived },
    { label: "Bids accepted", value: funnel?.bidsAccepted, base: funnel?.bidsReceived },
    { label: "Jobs completed", value: funnel?.jobsCompleted, base: funnel?.jobsPublished },
  ];
  const margin = bids?.margin;

  const attention: { icon: string; tint: Tint; title: string; subtitle: string; value: number | null | undefined; route: string }[] = [
    { icon: "clipboard-check", tint: "amber", title: "Jobs pending approval", subtitle: "Waiting for an admin decision", value: tabs?.pendingApproval, route: "/jobs?status=pendingApproval" },
    { icon: "flag", tint: "red", title: "Flagged jobs", subtitle: "Raised for investigation", value: tabs?.flagged, route: "/jobs?status=flagged" },
    { icon: "clock-alert", tint: "red", title: "Delayed trips", subtitle: "Running behind schedule", value: tc?.delayed.value, route: "/trips?status=delayed" },
    { icon: "triangle-alert", tint: "amber", title: "Jobs at risk of delay", subtitle: "Likely to miss their window", value: overview?.delayedAtRisk, route: "/jobs" },
    { icon: "file-search", tint: "amber", title: "Jobs awaiting document review", subtitle: "Container and rack documents", value: docsAwaiting, route: "/documents" },
  ];
  const attentionTotal = sum(attention.map((row) => row.value ?? null));

  const goToPeriod = (next: string) => startTransition(() => router.push(next === DEFAULT_STATS_PERIOD ? "/operations-overview" : `/operations-overview?period=${encodeURIComponent(next)}`));

  return (
    <div className={styles.page}>
      <PageHeader
        crumbs={["Operations", "Overview"]}
        title="Operations Overview"
        description="Job flow, trips in progress, bidding and document review across the platform."
        actions={
          <>
            <Button variant="outline" icon="package" onClick={() => navigate("/jobs")}>Jobs</Button>
            <Button variant="outline" icon="route" onClick={() => navigate("/trips")}>Trips</Button>
          </>
        }
      />
      {warnings.map((warning) => <Banner key={warning} tone="warning" title={warning} action={<Button variant="outline" size="sm" onClick={() => router.refresh()}>Retry</Button>} />)}

      <StatsPanel period={period} onPeriodChange={goToPeriod}>
        <StatCard layout="stack" icon="package" label="Total Jobs" value={fmt(jc?.totalJobs.value)} {...delta(jc?.totalJobs, period)} />
        <StatCard layout="stack" icon="clipboard-check" tint="amber" label="Pending Approval" value={fmt(jc?.pendingApproval.value)} {...delta(jc?.pendingApproval, period)} />
        <StatCard layout="stack" icon="radio-tower" tint="purple" label="In Bidding" value={fmt(tabs?.bidding)} caption="Waiting for a trucker" />
        <StatCard layout="stack" icon="truck" tint="teal" label="Trips In Transit" value={fmt(tc?.inTransit.value)} {...delta(tc?.inTransit, period)} />
        <StatCard layout="stack" icon="circle-check" tint="green" label="Jobs Delivered" value={fmt(jc?.delivered.value)} {...delta(jc?.delivered, period)} />
        <StatCard layout="stack" icon="clock-alert" tint="red" label="Delayed Trips" value={fmt(tc?.delayed.value)} {...delta(tc?.delayed, period)} />
      </StatsPanel>

      <section className={styles.gridTwo}>
        <SectionCard title="Job Pipeline" description={`Jobs by stage · ${summary}`} action={<LinkButton onClick={() => navigate("/jobs")} />}>
          {pipeline ? (
            <RankBarList numbered={false} items={pipeline.map((row) => ({ ...row, display: fmt(row.value) }))} />
          ) : (
            <Empty icon="package" title="Job stages unavailable" text="Counts by stage haven’t been returned yet." />
          )}
        </SectionCard>

        <SectionCard title="Job Volume" description="Jobs created per day, last 7 days">
          {overview && overview.weeklyVolume.length ? (
            <BarChart
              height={220}
              labels={overview.weeklyVolume.map((row) => row.label)}
              format={(value: number) => (Number.isInteger(value) ? numberFormat.format(value) : "")}
              series={[{ name: "Jobs", color: "var(--tk-blue)", points: overview.weeklyVolume.map((row) => row.count) }]}
            />
          ) : (
            <Empty icon="chart-column" title="No job volume yet" text="Daily job counts appear here once jobs are created." />
          )}
        </SectionCard>
      </section>

      <section className={styles.gridThree}>
        <SectionCard title="Trips in Progress" description="By stage" action={<LinkButton onClick={() => navigate("/trips")} />}>
          {tripStages ? (
            <div className={styles.donutRow}>
              <DonutChart size={124} thickness={18} data={tripStages} centerValue={fmt(tripsInProgress)} centerLabel="In progress" />
              <LegendList style={{ width: "100%" }} items={tripStages.map((row) => ({ ...row, display: fmt(row.value) }))} />
            </div>
          ) : (
            <Empty icon="route" title="Trip stages unavailable" text="Counts by stage haven’t been returned yet." />
          )}
          <dl className={styles.facts}>
            <div><dt>Delayed</dt><dd className={isNum(tc?.delayed.value) && tc.delayed.value > 0 ? styles.danger : undefined}>{fmt(tc?.delayed.value)}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Delivery Performance" description="Completed deliveries by punctuality">
          {delivery && isNum(deliveryTotal) && deliveryTotal > 0 ? (
            <div className={styles.donutRow}>
              <DonutChart size={124} thickness={18} data={delivery} centerValue={pctLabel(onTimeRate)} centerLabel="On time" />
              <LegendList style={{ width: "100%" }} items={delivery.map((row) => ({ ...row, display: fmt(row.value) }))} />
            </div>
          ) : (
            <Empty icon="timer" title="No deliveries to score yet" text="Punctuality appears once deliveries complete." />
          )}
          <dl className={styles.facts}>
            <div><dt>Completed today</dt><dd>{fmt(overview?.completedToday)}</dd></div>
            <div><dt>Cancelled this week</dt><dd>{fmt(overview?.cancelledThisWeek)}</dd></div>
          </dl>
        </SectionCard>

        <SectionCard title="Bidding Funnel" description={summary}>
          {bids ? (
            <div className={styles.funnel}>
              {funnelSteps.map((step, index) => {
                const rate = index === 0 || index === 2 ? null : share(step.value, step.base ?? null);
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
          ) : (
            <Empty icon="radio-tower" title="Bidding funnel unavailable" text="The funnel couldn’t be loaded." />
          )}
          <dl className={styles.facts}>
            <div>
              <dt>Avg. winning margin</dt>
              <dd>{isNum(margin?.amount) ? `${naira(margin.amount)}${isNum(margin.percent) ? ` (${pctLabel(margin.percent)})` : ""}` : isNum(margin?.percent) ? pctLabel(margin.percent) : "—"}</dd>
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

        <SectionCard title="Top Routes" description="By trip volume">
          {overview && overview.topRoutes.length ? (
            <RankBarList items={overview.topRoutes.map((route) => ({ label: route.route, value: route.trips, display: fmt(route.trips) }))} />
          ) : (
            <Empty icon="map" title="No routes yet" text="The busiest routes appear once trips run." />
          )}
        </SectionCard>

        <SectionCard title="Active Jobs" description="Newest jobs in bidding, assigned or in transit" pad="none" action={<LinkButton onClick={() => navigate("/jobs")} />}>
          {activeJobs && activeJobs.length ? (
            <ul className={styles.feed}>
              {activeJobs.map((job) => (
                <li key={job.id}>
                  <button type="button" className={styles.feedRow} onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)}>
                    <span className={styles.feedIcon}><Icon name="package" size={16} /></span>
                    <span className={styles.feedMain}>
                      <span className={styles.feedName}>{job.jobNumber}</span>
                      <span className={styles.feedMeta} title={`${job.origin ?? "—"} → ${job.destination ?? "—"}`}>{`${job.origin ?? "—"} → ${job.destination ?? "—"}`}</span>
                    </span>
                    <span className={styles.feedSide}>
                      <Badge tone={statusTone(job.status)} dot>{job.status}</Badge>
                      {/* the price the forwarder and trucker agreed; a job still in bidding has none yet */}
                      <span className={styles.feedMeta}>{job.agreedPrice != null ? naira(job.agreedPrice) : "No offer accepted yet"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="package" title="No active jobs" text="Jobs appear here once bidding starts." />
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function LinkButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className={styles.linkButton} onClick={onClick}>View all</button>;
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <Icon name={icon} size={20} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function OperationsOverviewLoading() {
  const cards = [
    ["package", "Total Jobs"],
    ["clipboard-check", "Pending Approval"],
    ["radio-tower", "In Bidding"],
    ["truck", "Trips In Transit"],
    ["circle-check", "Jobs Delivered"],
    ["clock-alert", "Delayed Trips"],
  ];
  return (
    <div className={styles.page} aria-busy="true">
      <PageHeader crumbs={["Operations", "Overview"]} title="Operations Overview" description="Job flow, trips in progress, bidding and document review across the platform." />
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
        {["Trips in Progress", "Delivery Performance", "Bidding Funnel"].map((title) => (
          <SectionCard key={title} title={title}>
            <div className={styles.donutRow}><Skeleton width={124} height={124} radius={62} /><LoadingLines /></div>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}

function LoadingLines({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.loadingLines}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={11} width={["80%", "64%", "72%", "56%"][index % 4]} />
      ))}
    </div>
  );
}