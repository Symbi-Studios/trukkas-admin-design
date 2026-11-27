import { STATS_PERIODS, statsPeriodRange } from '@/domain/statsPeriod.js';

// Turns the date filters in a page URL into the dateFrom and dateTo the backend accepts.
// Jobs and Trips both use it, so a period means the same thing on every screen.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The list screens open on All time so nothing is hidden until someone narrows it */
export const DEFAULT_PERIOD = 'all';

export interface DateRangeFilters {
  /** Lagos calendar days, YYYY-MM-DD, or "" */
  from: string;
  to: string;
  /** Last day | 7 days | month | quarter | all time */
  period: string;
}

export interface BackendDateRange {
  dateFrom?: string;
  dateTo?: string;
}

export function isStatsPeriod(value: string): boolean {
  return STATS_PERIODS.some((item: { key: string }) => item.key === value);
}

/** A chosen from/to range wins over the period. All time sends no dates. */
export function toDateRange(filters: DateRangeFilters): BackendDateRange {
  // a Lagos calendar day covers 00:00 to 23:59:59.999 Lagos time (UTC+1)
  if (DAY.test(filters.from) && DAY.test(filters.to)) {
    const start = new Date(`${filters.from}T00:00:00+01:00`);
    const end = new Date(`${filters.to}T23:59:59.999+01:00`);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
  }
  return isStatsPeriod(filters.period) ? (statsPeriodRange(filters.period) as BackendDateRange) : {};
}
