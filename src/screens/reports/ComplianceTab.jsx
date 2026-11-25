'use client';

import { MetricStrip, BreakdownBar } from '../../ds.js';
import { useGetAnalyticsVerificationQuery } from '../../store/features/reports/analyticsApi.js';
import { Panel, Quiet, SectionStatus, TextLink, fmtCount, fmtPercent, sectionState } from './analyticsShared.jsx';
import { VIZ } from './analyticsRows.js';
import styles from './Analytics.module.css';

const parseCount = (text) => (typeof text === 'string' && /^[\d,]+$/.test(text) ? Number(text.replace(/,/g, '')) : null);

export function ComplianceTab({ ctx, report }) {
  const main = sectionState(report, ctx.authenticated);
  const period = sectionState(useGetAnalyticsVerificationQuery(ctx.iso || {}, { skip: ctx.skip }), ctx.authenticated);
  const v = period.data, overall = main.data?.complianceOverview, summary = main.data?.dashboardSummary;
  const show = (state, render) => (state.data ? render(state.data) : state.error ? '—' : <span className={styles.valuePlaceholder} />);
  const waiting = v && v.pending != null && v.inReview != null ? v.pending + v.inReview : null;
  const items = [
    {
      key: 'approval', label: 'Approval rate', definition: main.data?.definitions?.complianceRate || 'Verified ÷ decided verifications (verified + rejected), all time.',
      value: show(main, () => fmtPercent(summary.complianceRate)), caption: 'Of decided verifications, all time',
    },
    { key: 'submitted', label: 'Submitted', value: show(period, () => fmtCount(v.total)), caption: 'In this period' },
    { key: 'waiting', label: 'Waiting for review', value: show(period, () => fmtCount(waiting)), caption: v ? `Of this period’s submissions · ${fmtCount(v.inReview)} in review` : undefined },
    { key: 'expiring', label: 'Expiring soon', value: show(period, () => fmtCount(v.expiringSoon)), caption: `Within ${v?.expiryWindowDays ?? 30} days` },
    { key: 'noncompliant', label: 'Non-compliant', value: show(period, () => fmtCount(v.nonCompliant)), caption: 'In this period' },
  ];
  const overallTotal = parseCount(overall?.totalVerifications);

  return (
    <div className={styles.stack}>
      <MetricStrip items={items} dimmed={period.dimmed} />

      <div className={styles.grid2}>
        <Panel title="Submitted in this period" description="Verifications submitted in this period, by status now" action={<TextLink onClick={() => ctx.navigate('/verification')}>Open queue</TextLink>}>
          <SectionStatus state={period}>
            {v && !(v.total > 0) ? <Quiet>No verifications submitted in this period.</Quiet> : (
              <BreakdownBar total={v?.total ?? undefined} items={[
                { label: 'Verified', value: v?.verified, color: VIZ[1] },
                { label: 'Pending', value: v?.pending, color: VIZ[2] },
                { label: 'In review', value: v?.inReview, color: VIZ[0] },
                { label: 'Rejected', value: v?.rejected, color: 'var(--tk-viz-4)' },
                { label: 'Non-compliant', value: v?.nonCompliant, color: VIZ[3] },
                { label: 'Cancelled', value: v?.cancelled, color: VIZ[5] },
              ]} showZero={false} />
            )}
          </SectionStatus>
        </Panel>
        <Panel title="All verifications" description={/not filtered by date/i.test(main.data?.notes?.compliance || '') ? main.data.notes.compliance : (main.data?.notes?.compliance ? main.data.notes.compliance.replace(/\.$/, '') + '. ' : 'Current state. ') + 'Not filtered by date.'}>
          <SectionStatus state={main}>
            {overallTotal === 0 ? <Quiet>No verifications yet.</Quiet> : (
              <BreakdownBar total={overallTotal ?? undefined} items={[
                { label: 'Verified', value: parseCount(overall?.verified), color: VIZ[1] },
                { label: 'Pending', value: parseCount(overall?.pending), color: VIZ[2] },
                { label: 'Rejected', value: parseCount(overall?.rejected), color: 'var(--tk-viz-4)' },
              ]} />
            )}
          </SectionStatus>
        </Panel>
      </div>
    </div>
  );
}
