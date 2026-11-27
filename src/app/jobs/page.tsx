import type { Metadata } from 'next';
import { JobsTrips, type JobsScreenQuery } from '@/screens/JobsTrips';
import { getAdmin } from '@/lib/auth/session';
import { getJobs, getJobStats, getPendingUploads, getPorts } from '@/lib/jobs/data';
import { DEFAULT_PERIOD, isStatsPeriod } from '@/lib/dateRange';
import { toJobsQuery } from '@/lib/jobs/query';
import { CARGO_KIND_OPTIONS } from '@/domain/cargo';
import { MOVEMENT_FILTER_OPTIONS } from '@/domain/movement';
import type { JobTab } from '@/types/jobs';

export const metadata: Metadata = {
  title: 'Jobs',
  description: 'Every job on Trukkas, from posting to delivery.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS: JobTab[] = ['pendingApproval', 'bidding', 'assigned', 'inTransit', 'delivered', 'cancelled', 'flagged', 'rejected'];
const TRIP_TYPES = MOVEMENT_FILTER_OPTIONS.map((option) => option.value);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BOARD_LIMIT = 100;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function whole(value: string | string[] | undefined, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(first(value), 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

// Runs on the Next.js server: filters, search and paging live in the URL and the backend does the work.
export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const status = first(params.status) as JobTab;
  const type = first(params.type);
  const period = first(params.period);
  const from = first(params.from);
  const to = first(params.to);
  const range = DAY.test(from) && DAY.test(to);

  const query: JobsScreenQuery = {
    tab: TABS.includes(status) ? status : 'all',
    type: TRIP_TYPES.includes(type) ? type : '',
    cargoKind: CARGO_KIND_OPTIONS.some((option) => option.value === first(params.cargoKind)) ? first(params.cargoKind) : '',
    port: first(params.port).trim().slice(0, 100),
    from: range ? from : '',
    to: range ? to : '',
    search: first(params.search).trim().slice(0, 100),
    page: whole(params.page, 1, 1, 100000),
    limit: whole(params.limit, 10, 1, 100),
    view: first(params.view) === 'board' ? 'board' : 'list',
    period: isStatsPeriod(period) ? period : DEFAULT_PERIOD,
  };

  const board = query.view === 'board';
  const backendQuery = toJobsQuery(query);
  const [admin, jobs, stats, ports, pending] = await Promise.all([
    getAdmin(),
    getJobs({ ...backendQuery, page: board ? 1 : query.page, limit: board ? BOARD_LIMIT : query.limit }),
    // the cards count the same date range as the table, so a card and the table always agree
    getJobStats({ dateFrom: backendQuery.dateFrom, dateTo: backendQuery.dateTo }),
    getPorts(),
    query.tab === 'pendingApproval' ? getPendingUploads(query.search) : Promise.resolve(null),
  ]);

  // The list is the page. The rest are extras: if one fails the page still works and says what is missing.
  const warnings: string[] = [];
  if (!stats.ok) warnings.push('Unable to load job totals.');
  if (!ports.ok) warnings.push('Unable to load the pickup port filter.');
  if (pending && !pending.ok) warnings.push('Unable to load jobs awaiting documents.');

  return (
    <JobsTrips
      query={query}
      jobs={jobs.ok ? jobs.data : null}
      stats={stats.ok ? stats.data : null}
      ports={ports.ok ? ports.data : []}
      pending={pending?.ok ? pending.data : null}
      error={jobs.ok ? null : jobs.error.message}
      warnings={warnings}
      role={admin?.role ?? null}
    />
  );
}
