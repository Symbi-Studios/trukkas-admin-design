import type { Metadata } from 'next';
import { Trips, type TripsScreenQuery } from '@/screens/Trips';
import { getAdmin } from '@/lib/auth/session';
import { getPorts } from '@/lib/jobs/data';
import { getTrips, getTripStats } from '@/lib/trips/data';
import { toTripsQuery } from '@/lib/trips/query';
import { DEFAULT_PERIOD, isStatsPeriod } from '@/lib/dateRange';
import { CARGO_KIND_OPTIONS } from '@/domain/cargo';
import { MOVEMENT_FILTER_OPTIONS } from '@/domain/movement';
import { isTripTab } from '@/domain/tripStatus';

export const metadata: Metadata = {
  title: 'Trips',
  description: 'Trips in progress, from the moment a driver is assigned until delivery.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TRIP_TYPES = MOVEMENT_FILTER_OPTIONS.map((option) => option.value);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function whole(value: string | string[] | undefined, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(first(value), 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

// Runs on the Next.js server: filters, search and paging live in the URL and the backend does the work.
export default async function TripsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const status = first(params.status);
  const type = first(params.type);
  const period = first(params.period);
  const from = first(params.from);
  const to = first(params.to);
  const range = DAY.test(from) && DAY.test(to);

  const query: TripsScreenQuery = {
    tab: isTripTab(status) ? status : 'all',
    type: TRIP_TYPES.includes(type) ? type : '',
    cargoKind: CARGO_KIND_OPTIONS.some((option) => option.value === first(params.cargoKind)) ? first(params.cargoKind) : '',
    port: first(params.port).trim().slice(0, 100),
    from: range ? from : '',
    to: range ? to : '',
    search: first(params.search).trim().slice(0, 100),
    page: whole(params.page, 1, 1, 100000),
    limit: whole(params.limit, 10, 1, 100),
    period: isStatsPeriod(period) ? period : DEFAULT_PERIOD,
    // a link such as /trips?tripId=... opens that trip's drawer
    tripId: first(params.tripId).trim().slice(0, 100),
  };

  const backendQuery = toTripsQuery(query);
  const [admin, trips, stats, ports] = await Promise.all([
    getAdmin(),
    getTrips({ ...backendQuery, page: query.page, limit: query.limit }),
    // the cards count the same date range as the table, so a card and the table always agree
    getTripStats({ dateFrom: backendQuery.dateFrom, dateTo: backendQuery.dateTo }),
    getPorts(),
  ]);

  // The list is the page. The rest are extras: if one fails the page still works and says what is missing.
  const warnings: string[] = [];
  if (!stats.ok) warnings.push('Unable to load trip totals.');
  if (!ports.ok) warnings.push('Unable to load the pickup port filter.');

  return (
    <Trips
      query={query}
      trips={trips.ok ? trips.data : null}
      stats={stats.ok ? stats.data : null}
      ports={ports.ok ? ports.data : []}
      error={trips.ok ? null : trips.error.message}
      warnings={warnings}
      role={admin?.role ?? null}
    />
  );
}