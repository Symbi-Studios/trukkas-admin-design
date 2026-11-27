import type { Metadata } from 'next';
import { OperationsOverview } from '@/screens/OperationsOverview';
import { DEFAULT_STATS_PERIOD } from '@/domain/statsPeriod.js';
import { getDocReviewStats } from '@/lib/doc-review/data';
import { isStatsPeriod, toDateRange } from '@/lib/dateRange';
import { getJobs, getJobStats } from '@/lib/jobs/data';
import { getBidInsights, getOverview } from '@/lib/overview/data';
import { getTripStats } from '@/lib/trips/data';

export const metadata: Metadata = {
  title: 'Operations Overview',
  description: 'Job flow, trips in progress, bidding and document review across the platform.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ACTIVE_JOBS = 6;

// Runs on the Next.js server: the period lives in the URL and every section asks the backend for its own numbers.
export default async function OperationsOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.period) ? params.period[0] : params.period;
  const period: string = raw && isStatsPeriod(raw) ? raw : DEFAULT_STATS_PERIOD;
  const range = toDateRange({ from: '', to: '', period });

  const [overview, jobStats, tripStats, bids, docs, activeJobs] = await Promise.all([
    getOverview(),
    getJobStats(range),
    getTripStats(range),
    getBidInsights(range),
    getDocReviewStats(),
    // the newest jobs where bidding has started and that are not finished yet
    getJobs({ status: 'active', page: 1, limit: ACTIVE_JOBS }),
  ]);

  // Each section stands on its own: if one call fails the others still show, and the page says what is missing.
  const warnings: string[] = [];
  if (!overview.ok) warnings.push('Unable to load job volume, delivery performance and top routes.');
  if (!jobStats.ok) warnings.push('Unable to load job totals.');
  if (!tripStats.ok) warnings.push('Unable to load trip totals.');
  if (!bids.ok) warnings.push('Unable to load the bidding funnel.');
  if (!docs.ok) warnings.push('Unable to load documents awaiting review.');
  if (!activeJobs.ok) warnings.push('Unable to load active jobs.');

  return (
    <OperationsOverview
      period={period}
      overview={overview.ok ? overview.data : null}
      jobStats={jobStats.ok ? jobStats.data : null}
      tripStats={tripStats.ok ? tripStats.data : null}
      bids={bids.ok ? bids.data : null}
      docsAwaiting={docs.ok ? docs.data.jobs.awaiting : null}
      activeJobs={activeJobs.ok ? activeJobs.data.jobs : null}
      warnings={warnings}
    />
  );
}
