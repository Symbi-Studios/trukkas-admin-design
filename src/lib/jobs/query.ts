import { STATS_PERIODS, statsPeriodRange } from '@/domain/statsPeriod.js';
import type { JobsFilters, JobsQuery } from '@/types/jobs';

// Turns the filters in the page URL into what the backend list and export endpoints accept.
// Used by the Jobs page and by the export action, so the two can never disagree.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The Jobs page opens on All time so no job is hidden until someone narrows it */
export const JOBS_DEFAULT_PERIOD = 'all';

export function isJobsPeriod(value: string): boolean {
  return STATS_PERIODS.some((item: { key: string }) => item.key === value);
}

export function toJobsQuery(filters: JobsFilters): JobsQuery {
  const query: JobsQuery = {
    status: filters.tab === 'all' ? undefined : filters.tab,
    search: filters.search || undefined,
    movementType: filters.type || undefined,
    cargoType: filters.cargoKind || undefined,
    pickupPortId: filters.port || undefined,
  };
  // a Lagos calendar day covers 00:00 to 23:59:59.999 Lagos time (UTC+1)
  if (DAY.test(filters.from) && DAY.test(filters.to)) {
    const start = new Date(`${filters.from}T00:00:00+01:00`);
    const end = new Date(`${filters.to}T23:59:59.999+01:00`);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      query.dateFrom = start.toISOString();
      query.dateTo = end.toISOString();
    }
  }
  // No chosen range: the period (Last 7 days ...) is the date range. All time sends no dates.
  if (!query.dateFrom && isJobsPeriod(filters.period)) {
    const range = statsPeriodRange(filters.period) as { dateFrom?: string; dateTo?: string };
    query.dateFrom = range.dateFrom;
    query.dateTo = range.dateTo;
  }
  return query;
}
