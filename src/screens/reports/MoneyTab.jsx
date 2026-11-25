'use client';

import { MetricStrip, TrendChart, Leaderboard, BreakdownBar } from '../../ds.js';
import { useGetAnalyticsDemurrageQuery, useGetAnalyticsFeesQuery, useGetAnalyticsPlatformQuery } from '../../store/features/reports/analyticsApi.js';
import { Money, Panel, Quiet, SectionStatus, TextLink, bucketTitle, changeOf, fmtCount, fmtMoney, fmtMoneyFull, fmtPercent, sectionState } from './analyticsShared.jsx';
import { earningsItems, VIZ } from './analyticsRows.js';
import styles from './Analytics.module.css';

export function MoneyTab({ ctx, report }) {
  const main = sectionState(report, ctx.authenticated);
  const platform = sectionState(useGetAnalyticsPlatformQuery({ from: ctx.range.dateFrom, to: ctx.range.dateTo }, { skip: ctx.skip }), ctx.authenticated);
  const fees = sectionState(useGetAnalyticsFeesQuery(ctx.iso || {}, { skip: ctx.skip }), ctx.authenticated);
  const demurrage = sectionState(useGetAnalyticsDemurrageQuery(ctx.iso || {}, { skip: ctx.skip }), ctx.authenticated);
  const overview = main.data, summary = overview?.dashboardSummary, financial = overview?.financialSummary;
  const show = (state, render) => (state.data ? render(state.data) : state.error ? '—' : <span className={styles.valuePlaceholder} />);
  const items = [
    {
      key: 'revenue', label: 'Platform revenue', definition: overview?.definitions?.totalRevenue || undefined,
      value: show(main, () => <Money value={summary.totalRevenue} />), caption: summary ? ctx.compareCaption : undefined,
      ...(summary ? changeOf({ percent: overview.deltaValues.totalRevenue, kind: 'money' }) : {}),
    },
    {
      key: 'gross', label: 'Gross job value', definition: financial?.grossJobValueDefinition || undefined,
      value: show(main, () => <Money value={financial.grossJobValue} />), caption: financial ? ctx.compareCaption : undefined,
      ...(financial ? changeOf({ percent: financial.grossJobValueDelta, kind: 'money' }) : {}),
    },
    {
      key: 'payouts', label: 'Payouts', definition: overview?.definitions?.totalPayouts || undefined,
      value: show(main, () => <Money value={summary.totalPayouts} />), caption: summary ? ctx.compareCaption : undefined,
      ...(summary ? changeOf({ percent: overview.deltaValues.totalPayouts, kind: 'money' }) : {}),
    },
    {
      key: 'fees', label: 'Fees collected', definition: 'Platform, service and processing fees actually collected. Excludes demurrage.',
      value: show(fees, (d) => <Money value={d.total} />),
      caption: fees.data ? `${fmtCount(fees.data.byCategory.reduce((n, c) => n + (c.count || 0), 0))} charges` : undefined,
    },
    {
      key: 'demurrage', label: 'Demurrage collected',
      value: show(demurrage, (d) => <Money value={d.collected} />),
      caption: demurrage.data ? (demurrage.data.charged > 0 ? `${fmtPercent(demurrage.data.collectionRate)} of ${fmtMoney(demurrage.data.charged)} charged` : 'Nothing charged') : undefined,
    },
  ];
  const trend = overview?.trendData;
  const earnings = platform.data?.earnings;
  const feeRules = (fees.data?.topRules || []).map((r) => ({ id: r.id, label: r.name, detail: r.category, value: r.total, display: fmtMoney(r.total), secondary: `${fmtCount(r.count)} charges` }));

  return (
    <div className={styles.stack}>
      <MetricStrip items={items} dimmed={main.dimmed} />

      <Panel title="Revenue and payouts" description={`Platform revenue and payouts per ${overview?.groupBy || ctx.groupBy}`} action={<TextLink onClick={() => ctx.navigate('/finance-overview')}>Open finance</TextLink>}>
        <SectionStatus state={main}>
          {trend && (
            <TrendChart type="bar" height={240} dimmed={main.dimmed} labels={trend.labels}
              tooltipLabels={trend.dates.map((d) => bucketTitle(d, overview.groupBy || ctx.groupBy))}
              series={[{ name: 'Revenue', color: VIZ[0], points: trend.revenue }, { name: 'Payouts', color: VIZ[1], points: trend.payouts }]}
              format={fmtMoneyFull} axisFormat={fmtMoney} emptyLabel="No revenue or payouts in this period" />
          )}
        </SectionStatus>
      </Panel>

      <div className={styles.grid2}>
        <Panel title="Where the money went" description={earnings?.completedJobs != null ? `How the value of ${fmtCount(earnings.completedJobs)} ${earnings.completedJobs === 1 ? 'job' : 'jobs'} completed in this period was split` : 'How the value of jobs completed in this period was split'}>
          <SectionStatus state={platform}>
            {earnings && !(earnings.total > 0) ? <Quiet>No completed job value in this period.</Quiet> : (
              <>
                <BreakdownBar items={earningsItems(earnings)} format={fmtMoney} showZero={false} />
                {earnings?.refunds.count > 0 && <p className={styles.note}>{fmtCount(earnings.refunds.count)} refunded, <Money value={earnings.refunds.amount} /> in total.</p>}
              </>
            )}
          </SectionStatus>
        </Panel>
        <Panel title="Fees by type" description="Fees collected in this period" action={<TextLink onClick={() => ctx.navigate('/revenue')}>Platform revenue</TextLink>}>
          <SectionStatus state={fees}>
            {fees.data && !(fees.data.total > 0) ? <Quiet>No fees collected in this period.</Quiet> : (
              <BreakdownBar format={fmtMoney} items={(fees.data?.byCategory || []).map((c, i) => ({ key: c.key, label: c.label, value: c.amount, color: VIZ[i % VIZ.length] }))} />
            )}
          </SectionStatus>
        </Panel>
      </div>

      <div className={styles.grid3}>
        <Panel title="Top fee rules" description="By amount collected in this period" action={<TextLink onClick={() => ctx.navigate('/fees')}>Open fees</TextLink>}>
          <SectionStatus state={fees}>
            <Leaderboard rows={feeRules} empty={<Quiet>No fees collected in this period.</Quiet>} />
          </SectionStatus>
        </Panel>
        <Panel title="Demurrage" description="Charges whose free period ended in this period" action={<TextLink onClick={() => ctx.navigate('/demurrage')}>Open demurrage</TextLink>}>
          <SectionStatus state={demurrage}>
            {demurrage.data && !(demurrage.data.charged > 0) ? <Quiet>No demurrage charged in this period.</Quiet> : (
              <BreakdownBar format={fmtMoney} total={demurrage.data?.charged ?? undefined} items={[
                { label: 'Collected', value: demurrage.data?.collected, color: VIZ[1] },
                { label: 'Outstanding', value: demurrage.data?.outstanding, color: VIZ[2] },
                { label: 'Waived', value: demurrage.data?.waived, color: VIZ[5] },
              ]} />
            )}
          </SectionStatus>
        </Panel>
        <Panel title="Balances right now" description="Not filtered by date">
          <SectionStatus state={main}>
            <dl className={styles.figures}>
              {[['outstandingPayments', 'Outstanding payments'], ['escrowBalance', 'Escrow balance']].map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className={styles.figureValue}><Money value={financial?.[key]} /></dd>
                  {financial?.[key + 'Definition'] && <dd className={styles.note}>{financial[key + 'Definition']}</dd>}
                </div>
              ))}
            </dl>
          </SectionStatus>
        </Panel>
      </div>
    </div>
  );
}
