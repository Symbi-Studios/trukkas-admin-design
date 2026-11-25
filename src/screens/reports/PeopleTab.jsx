'use client';

import { useState } from 'react';
import { MetricStrip, Leaderboard, BreakdownBar } from '../../ds.js';
import { useGetAdminReportOverviewQuery } from '../../store/features/reports/reportsApi.js';
import { useGetAnalyticsPlatformQuery } from '../../store/features/reports/analyticsApi.js';
import { Panel, Quiet, Segmented, SectionStatus, TextLink, changeOf, fmtCount, fmtPercent, sectionState } from './analyticsShared.jsx';
import { entityRows, VIZ } from './analyticsRows.js';
import styles from './Analytics.module.css';

const SORTS = [
  { value: 'revenue', label: 'Job value' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'growth', label: 'Growth' },
];
const SORT_NOTE = {
  revenue: 'by agreed value of their jobs accepted in this period',
  jobs: 'by jobs accepted in this period',
  growth: 'by change in job value',
};

function EntityBoard({ ctx, title, entityType, base, noun }) {
  const [sortBy, setSortBy] = useState('revenue');
  const args = ctx.reportArgs && { ...ctx.reportArgs, sortBy, ...(entityType ? { entityType } : {}) };
  const state = sectionState(useGetAdminReportOverviewQuery(args, { skip: ctx.skip || !args }), ctx.authenticated);
  return (
    <Panel title={title} description={`Top ${noun} ${SORT_NOTE[sortBy]}${sortBy === 'growth' ? ' ' + ctx.compareCaption : ''}`}
      action={<Segmented label={`Rank ${noun} by`} value={sortBy} options={SORTS} onChange={setSortBy} />}>
      <SectionStatus state={state}>
        <Leaderboard rows={entityRows(state.data?.topPerformingEntities, sortBy, ctx.navigate, base)}
          empty={<Quiet>No {noun} had a job accepted in this period.</Quiet>} />
      </SectionStatus>
    </Panel>
  );
}

export function PeopleTab({ ctx, report }) {
  const main = sectionState(report, ctx.authenticated);
  const platform = sectionState(useGetAnalyticsPlatformQuery({ from: ctx.range.dateFrom, to: ctx.range.dateTo }, { skip: ctx.skip }), ctx.authenticated);
  const engagement = main.data?.userEngagement, registrations = platform.data?.registrations, rating = platform.data?.rating;
  const show = (state, render) => (state.data ? render(state.data) : state.error ? '—' : <span className={styles.valuePlaceholder} />);
  const items = [
    {
      key: 'active', label: 'Active users', definition: engagement?.activeUsersDefinition || undefined,
      value: show(main, () => fmtCount(engagement.activeUsers)), caption: engagement ? ctx.compareCaption : undefined,
      ...(engagement ? changeOf({ value: engagement.activeUsers, previous: main.data.dashboardSummary.activeUsersPrevious, percent: engagement.activeUsersDelta }) : {}),
    },
    {
      key: 'new', label: 'New sign-ups', definition: engagement?.newUsersDefinition || undefined,
      value: show(main, () => fmtCount(engagement.newUsers)), caption: engagement ? ctx.compareCaption : undefined,
      ...(engagement ? changeOf({ percent: engagement.newUsersDelta, kind: 'percent' }) : {}),
    },
    { key: 'forwarders', label: 'New forwarders', value: show(platform, () => fmtCount(registrations.forwarders)) },
    { key: 'truckers', label: 'New truckers', value: show(platform, () => fmtCount(registrations.truckers)) },
    { key: 'drivers', label: 'New drivers', value: show(platform, () => fmtCount(registrations.drivers)) },
    {
      key: 'rating', label: 'Average rating',
      value: show(platform, () => (rating.average == null ? '—' : rating.average.toLocaleString('en-NG', { maximumFractionDigits: 1 }) + ' / 5')),
      caption: rating ? `${fmtCount(rating.reviews)} ${rating.reviews === 1 ? 'review' : 'reviews'}` : undefined,
      ...(rating?.change != null && rating.change !== 0 ? { change: (rating.change > 0 ? '+' : '−') + Math.abs(rating.change).toLocaleString('en-NG', { maximumFractionDigits: 1 }), direction: rating.change > 0 ? 'up' : 'down' } : {}),
    },
  ];

  return (
    <div className={styles.stack}>
      <MetricStrip items={items} dimmed={main.dimmed} />

      <div className={styles.grid2}>
        <EntityBoard ctx={ctx} title="Forwarders" base="/forwarders" noun="forwarders" />
        <EntityBoard ctx={ctx} title="Truck companies" entityType="TRUCKING_COMPANY" base="/companies" noun="truck companies" />
      </div>

      <div className={styles.grid2}>
        <Panel title="Ratings" description={rating?.reviews > 0 ? `Share of the ${fmtCount(rating.reviews)} ${rating.reviews === 1 ? 'rating' : 'ratings'} left in this period` : 'Ratings left in this period'} action={<TextLink onClick={() => ctx.navigate('/reviews')}>Open reviews</TextLink>}>
          <SectionStatus state={platform}>
            {rating && !(rating.reviews > 0) ? <Quiet>No ratings left in this period.</Quiet> : (
              <BreakdownBar showShare={false} format={(v) => fmtPercent(v)} items={(rating?.breakdown || []).map((r, i) => ({ label: `${r.stars} star${r.stars === 1 ? '' : 's'}`, value: r.percent, color: [VIZ[1], VIZ[0], VIZ[2], VIZ[3], 'var(--tk-viz-4)'][i] }))} />
            )}
          </SectionStatus>
        </Panel>
        <Panel title="New sign-ups by type" description="Accounts that joined in this period" action={<TextLink onClick={() => ctx.navigate('/users-overview')}>Open users</TextLink>}>
          <SectionStatus state={platform}>
            {registrations && !(registrations.total > 0) ? <Quiet>No one signed up in this period.</Quiet> : (
              <BreakdownBar total={registrations?.total ?? undefined} items={[
                { label: 'Forwarders', value: registrations?.forwarders, color: VIZ[0] },
                { label: 'Truckers', value: registrations?.truckers, color: VIZ[1] },
                { label: 'Drivers', value: registrations?.drivers, color: VIZ[2] },
              ]} />
            )}
          </SectionStatus>
        </Panel>
      </div>
    </div>
  );
}
