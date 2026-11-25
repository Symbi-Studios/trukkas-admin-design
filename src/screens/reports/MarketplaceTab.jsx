'use client';

import { useState } from 'react';
import { MetricStrip, Leaderboard, BreakdownBar } from '../../ds.js';
import { useGetAnalyticsBidsQuery } from '../../store/features/reports/analyticsApi.js';
import { Money, Panel, Quiet, Segmented, SectionStatus, TextLink, fmtCount, fmtPercent, sectionState, share } from './analyticsShared.jsx';
import { VIZ } from './analyticsRows.js';
import styles from './Analytics.module.css';

const MIN_BIDS = 3;
const SORTS = [
  { value: 'won', label: 'Most won' },
  { value: 'winRate', label: 'Win rate' },
  { value: 'bids', label: 'Most bids' },
];

export function MarketplaceTab({ ctx }) {
  const [sort, setSort] = useState('won');
  const bids = sectionState(useGetAnalyticsBidsQuery(ctx.iso || {}, { skip: ctx.skip }), ctx.authenticated);
  const d = bids.data;
  const placeholder = d ? null : bids.error ? '—' : <span className={styles.valuePlaceholder} />;
  const funnel = d?.funnel || [];
  const coverage = share(funnel[1]?.value, funnel[0]?.value);
  const items = [
    { key: 'bids', label: 'Bids received', value: placeholder ?? fmtCount(d.total) },
    { key: 'accepted', label: 'Bids accepted', value: placeholder ?? fmtCount(d.accepted), caption: d && d.total > 0 ? fmtPercent(share(d.accepted, d.total)) + ' of bids' : undefined },
    { key: 'coverage', label: 'Jobs that got a bid', value: placeholder ?? fmtPercent(coverage), caption: d ? `${fmtCount(funnel[1]?.value)} of ${fmtCount(funnel[0]?.value)} published` : undefined },
    {
      key: 'margin', label: 'Winning bid vs asking price',
      definition: 'Average of asking price minus accepted bid. Positive means winning bids came in under the asking price.',
      value: placeholder ?? (d.margin.percent == null ? '—' : fmtPercent(Math.abs(d.margin.percent)) + (d.margin.percent > 0 ? ' under' : d.margin.percent < 0 ? ' over' : '')),
      caption: d && d.margin.amount != null ? <>avg <Money value={Math.abs(d.margin.amount)} /> · {fmtCount(d.margin.sampleSize)} accepted bids</> : d ? 'No accepted bids with an asking price' : undefined,
    },
    { key: 'counter', label: 'Counter-offers', value: placeholder ?? fmtCount(d.counterOffers) },
  ];

  const companies = [...(d?.topCompanies || [])]
    .filter((c) => sort !== 'winRate' || (c.bids ?? 0) >= MIN_BIDS)
    .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const rows = companies.map((c) => ({
    id: c.id || c.key, label: c.name,
    value: c[sort],
    display: sort === 'winRate' ? fmtPercent(c.winRate) : sort === 'bids' ? `${fmtCount(c.bids)} bids` : `${fmtCount(c.won)} won`,
    secondary: sort === 'winRate' ? `${fmtCount(c.won)} of ${fmtCount(c.bids)}` : sort === 'bids' ? `${fmtCount(c.won)} won` : `of ${fmtCount(c.bids)} bids`,
    onClick: c.id ? () => ctx.navigate(`/companies/detail?id=${encodeURIComponent(c.id)}`) : undefined,
  }));
  const top = funnel[0]?.value;

  return (
    <div className={styles.stack}>
      <MetricStrip items={items} dimmed={bids.dimmed} />

      <div className={styles.grid2}>
        <Panel title="From job to delivery" description="Jobs and bids created in this period">
          <SectionStatus state={bids}>
            {top === 0 && !funnel.some((s) => s.value > 0) ? <Quiet>No jobs or bids in this period.</Quiet> : (
              <ol className={styles.funnel}>
                {funnel.map((step, index) => {
                  const previous = funnel[index - 1]?.value;
                  const widthBase = Math.max(...funnel.map((s) => s.value || 0), 1);
                  return (
                    <li key={step.key}>
                      <span className={styles.funnelLabel}>{step.label}</span>
                      <span className={styles.funnelTrack}><span style={{ width: `${Math.max(1, ((step.value || 0) / widthBase) * 100)}%` }} /></span>
                      <strong>{fmtCount(step.value)}</strong>
                      <span className={styles.funnelRate}>{index && previous ? fmtPercent(share(step.value, previous), 0) : ''}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionStatus>
        </Panel>
        <Panel title="Bid outcomes" description="Bids placed in this period, by where they ended up" action={<TextLink onClick={() => ctx.navigate('/bids')}>Open bids</TextLink>}>
          <SectionStatus state={bids}>
            {d && d.total === 0 ? <Quiet>No bids placed in this period.</Quiet> : (
              <BreakdownBar total={d?.total ?? undefined} items={[
                { label: 'Accepted', value: d?.status.accepted, color: VIZ[1] },
                { label: 'Pending', value: d?.status.pending, color: VIZ[0] },
                { label: 'Expired', value: d?.status.expired, color: VIZ[2] },
                { label: 'Rejected', value: d?.status.rejected, color: 'var(--tk-viz-4)' },
                { label: 'Withdrawn', value: d?.status.withdrawn, color: VIZ[5] },
              ]} />
            )}
          </SectionStatus>
        </Panel>
      </div>

      <Panel title="Truck companies on the marketplace" description={sort === 'winRate' ? `Companies with at least ${MIN_BIDS} bids in this period` : 'Bids placed in this period'}
        action={<Segmented label="Sort companies" value={sort} options={SORTS} onChange={setSort} />}>
        <SectionStatus state={bids}>
          <Leaderboard rows={rows} empty={<Quiet>{sort === 'winRate' ? `No company placed ${MIN_BIDS} or more bids in this period.` : 'No company placed a bid in this period.'}</Quiet>} />
        </SectionStatus>
      </Panel>
    </div>
  );
}
