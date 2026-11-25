'use client';

import { MetricStrip, TrendChart, Leaderboard, BreakdownBar } from '../../ds.js';
import { useGetAnalyticsPlatformQuery } from '../../store/features/reports/analyticsApi.js';
import { Panel, Quiet, SectionStatus, TextLink, bucketTitle, changeOf, fmtCount, sectionState } from './analyticsShared.jsx';
import { breakdownItems, destinationRows, routeRows, statusItems, VIZ } from './analyticsRows.js';
import styles from './Analytics.module.css';

export function JobsTab({ ctx, report }) {
  const main = sectionState(report, ctx.authenticated);
  const platform = sectionState(useGetAnalyticsPlatformQuery({ from: ctx.range.dateFrom, to: ctx.range.dateTo }, { skip: ctx.skip }), ctx.authenticated);
  const overview = main.data, jobs = platform.data?.jobs, trips = platform.data?.trips;
  const total = overview?.dashboardSummary.totalJobs;
  const value = (v) => (platform.data ? fmtCount(v) : platform.error ? '—' : <span className={styles.valuePlaceholder} />);
  const items = [
    { key: 'created', label: 'Jobs created', higherIsBetter: true },
    { key: 'completed', label: 'Jobs completed', higherIsBetter: true },
    { key: 'cancelled', label: 'Jobs cancelled', higherIsBetter: false },
    { key: 'containersMoved', label: 'Containers moved', higherIsBetter: true },
  ].map((m) => ({
    ...m, value: value(jobs?.[m.key]), caption: jobs ? ctx.compareCaption : undefined,
    ...(jobs ? changeOf({ value: jobs[m.key], percent: jobs[m.key + 'Change'] }) : {}),
  }));
  const ops = overview?.operationsOverview;

  return (
    <div className={styles.stack}>
      <MetricStrip items={items} dimmed={platform.dimmed} />

      <Panel title="Job activity" description="Each job counted on the day it was created, accepted, completed or cancelled">
        <SectionStatus state={main}>
          {ops && (
            <TrendChart type="line" height={260} dimmed={main.dimmed} labels={ops.labels}
              tooltipLabels={ops.dates.map((d) => bucketTitle(d, overview.groupBy || ctx.groupBy))}
              series={ops.series.map((s, i) => ({ name: s.name, color: [VIZ[0], VIZ[2], VIZ[1], 'var(--tk-viz-4)'][i], points: s.points }))}
              format={fmtCount} emptyLabel="No job activity in this period" />
          )}
        </SectionStatus>
      </Panel>

      <div className={styles.grid2}>
        <Panel title="Top routes" description="By trips on jobs created in this period">
          <SectionStatus state={platform}>
            <Leaderboard rows={routeRows(platform.data?.topRoutes)} empty={<Quiet>No routes with trips in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
        <Panel title="Destinations" description="Jobs created in this period, by destination state">
          <SectionStatus state={main}>
            <Leaderboard rows={destinationRows(overview?.geographicalDistribution)} empty={<Quiet>No jobs created in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
      </div>

      <div className={styles.grid3}>
        <Panel title="Jobs by status" description="Jobs created in this period, by where they are now" action={<TextLink onClick={() => ctx.navigate('/jobs')}>Open jobs</TextLink>}>
          <SectionStatus state={main}>
            {total === 0 ? <Quiet>No jobs created in this period.</Quiet> : <BreakdownBar items={statusItems(overview?.jobsByStatus)} total={total ?? undefined} />}
          </SectionStatus>
        </Panel>
        <Panel title="Jobs by type" description="Movement and cargo, jobs created in this period">
          <SectionStatus state={main}>
            {overview && !overview.jobsByType.length ? <Quiet>No jobs created in this period.</Quiet> : <BreakdownBar items={breakdownItems(overview?.jobsByType)} />}
          </SectionStatus>
        </Panel>
        <Panel title="Trips" description="Trips in this period, by stage" action={<TextLink onClick={() => ctx.navigate('/trips')}>Open trips</TextLink>}>
          <SectionStatus state={platform}>
            {trips && trips.total === 0 ? <Quiet>No trips in this period.</Quiet> : (
              <BreakdownBar total={trips?.total ?? undefined} items={[
                { label: 'Completed', value: trips?.completed, color: VIZ[1] },
                { label: 'In transit', value: trips?.inTransit, color: VIZ[0] },
                { label: 'Scheduled', value: trips?.scheduled, color: VIZ[2] },
                { label: 'Cancelled', value: trips?.cancelled, color: 'var(--tk-viz-4)' },
              ]} />
            )}
          </SectionStatus>
        </Panel>
      </div>
    </div>
  );
}
