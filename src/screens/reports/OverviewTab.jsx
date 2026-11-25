'use client';

import { useState } from 'react';
import { MetricStrip, TrendChart, Leaderboard, BreakdownBar } from '../../ds.js';
import { useGetAdminReportOverviewQuery } from '../../store/features/reports/reportsApi.js';
import { useGetAnalyticsPlatformQuery } from '../../store/features/reports/analyticsApi.js';
import { Money, Panel, Quiet, SectionStatus, TextLink, bucketTitle, changeOf, fmtCount, fmtMoney, fmtMoneyFull, sectionState } from './analyticsShared.jsx';
import { entityRows, routeRows, statusItems, earningsItems, destinationRows } from './analyticsRows.js';
import styles from './Analytics.module.css';

const METRICS = [
  { key: 'totalJobs', label: 'Jobs created', kind: 'count' },
  { key: 'completedJobs', label: 'Jobs completed', kind: 'count' },
  { key: 'totalRevenue', label: 'Platform revenue', kind: 'money' },
  { key: 'totalPayouts', label: 'Payouts', kind: 'money' },
  { key: 'activeUsers', label: 'Active users', kind: 'count' },
];

/** The chart series behind each headline metric. */
function seriesFor(key, overview, groupBy) {
  const ops = overview.operationsOverview, trend = overview.trendData, summary = overview.dashboardSummary;
  const opsPoints = (name) => ops.series.find((s) => s.name === name)?.points || [];
  const source = {
    totalJobs: { points: opsPoints('Created'), labels: ops.labels, dates: ops.dates },
    completedJobs: { points: opsPoints('Completed'), labels: ops.labels, dates: ops.dates },
    totalRevenue: { points: trend.revenue, labels: trend.labels, dates: trend.dates },
    totalPayouts: { points: trend.payouts, labels: trend.labels, dates: trend.dates },
    activeUsers: {
      points: summary.activeUsersTrend, dates: summary.activeUsersTrendDates,
      labels: summary.activeUsersTrendDates.map((d) => new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric' }).format(new Date(d))),
    },
  }[key];
  return { ...source, tooltipLabels: (source.dates || []).map((d) => bucketTitle(d, key === 'activeUsers' ? 'day' : overview.groupBy || groupBy)) };
}

export function OverviewTab({ ctx, report }) {
  const [metric, setMetric] = useState('totalJobs');
  const main = sectionState(report, ctx.authenticated);
  const companies = sectionState(useGetAdminReportOverviewQuery(ctx.reportArgs && { ...ctx.reportArgs, entityType: 'TRUCKING_COMPANY' }, { skip: ctx.skip || !ctx.reportArgs }), ctx.authenticated);
  const platform = sectionState(useGetAnalyticsPlatformQuery({ from: ctx.range.dateFrom, to: ctx.range.dateTo }, { skip: ctx.skip }), ctx.authenticated);
  const overview = main.data;
  const summary = overview?.dashboardSummary;
  const selected = METRICS.find((m) => m.key === metric);

  const items = METRICS.map((m) => ({
    key: m.key,
    label: m.label,
    definition: overview?.definitions?.[m.key] || undefined,
    value: !summary ? (main.error ? '—' : <span className={styles.valuePlaceholder} />) : m.kind === 'money' ? <Money value={summary[m.key]} /> : fmtCount(summary[m.key]),
    caption: summary ? ctx.compareCaption : undefined,
    ...(summary ? changeOf({ value: summary[m.key], previous: summary[m.key + 'Previous'], percent: overview.deltaValues?.[m.key], kind: m.kind }) : {}),
  }));
  const series = overview ? seriesFor(metric, overview, ctx.groupBy) : null;

  return (
    <div className={styles.stack}>
      <section className={styles.hero}>
        <MetricStrip items={items} selected={metric} onSelect={setMetric} dimmed={main.dimmed} />
        <div className={styles.heroChart}>
          <SectionStatus state={main}>
            {series && (
              <TrendChart type="area" height={260} dimmed={main.dimmed} labels={series.labels} tooltipLabels={series.tooltipLabels}
                series={[{ name: selected.label, color: 'var(--tk-viz-1)', points: series.points }]}
                format={selected.kind === 'money' ? fmtMoneyFull : fmtCount} axisFormat={selected.kind === 'money' ? fmtMoney : fmtCount}
                emptyLabel={`No ${selected.label.toLowerCase()} in this period`} />
            )}
          </SectionStatus>
        </div>
      </section>

      <div className={styles.grid3}>
        <Panel title="Top forwarders" description="By agreed job value" action={<TextLink onClick={() => ctx.goTab('people')}>View all</TextLink>}>
          <SectionStatus state={main}>
            <Leaderboard limit={5} rows={entityRows(overview?.topPerformingEntities, 'revenue', ctx.navigate, '/forwarders')}
              empty={<Quiet>No forwarder had a job accepted in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
        <Panel title="Top truck companies" description="By agreed job value" action={<TextLink onClick={() => ctx.goTab('people')}>View all</TextLink>}>
          <SectionStatus state={companies}>
            <Leaderboard limit={5} rows={entityRows(companies.data?.topPerformingEntities, 'revenue', ctx.navigate, '/companies')}
              empty={<Quiet>No truck company had a job accepted in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
        <Panel title="Top routes" description="By trips on jobs created in this period" action={<TextLink onClick={() => ctx.goTab('jobs')}>View all</TextLink>}>
          <SectionStatus state={platform}>
            <Leaderboard limit={5} rows={routeRows(platform.data?.topRoutes)} empty={<Quiet>No routes with trips in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
      </div>

      <div className={styles.grid3}>
        <Panel title="Jobs by status" description="Jobs created in this period, by where they are now">
          <SectionStatus state={main}>
            {summary?.totalJobs === 0 ? <Quiet>No jobs created in this period.</Quiet>
              : <BreakdownBar items={statusItems(overview?.jobsByStatus)} total={summary?.totalJobs ?? undefined} />}
          </SectionStatus>
        </Panel>
        <Panel title="Where the money went" description={platform.data?.earnings.completedJobs != null ? `How the value of ${fmtCount(platform.data.earnings.completedJobs)} ${platform.data.earnings.completedJobs === 1 ? 'job' : 'jobs'} completed in this period was split` : 'Jobs completed in this period'}
          action={<TextLink onClick={() => ctx.goTab('money')}>Money</TextLink>}>
          <SectionStatus state={platform}>
            {platform.data && !(platform.data.earnings.total > 0) ? <Quiet>No completed job value in this period.</Quiet> : (
              <BreakdownBar items={earningsItems(platform.data?.earnings)} format={fmtMoney} showZero={false} />
            )}
          </SectionStatus>
        </Panel>
        <Panel title="Destinations" description="Jobs created in this period, by destination state" action={<TextLink onClick={() => ctx.goTab('jobs')}>View all</TextLink>}>
          <SectionStatus state={main}>
            <Leaderboard limit={5} rows={destinationRows(overview?.geographicalDistribution)} empty={<Quiet>No jobs created in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
      </div>

    </div>
  );
}
