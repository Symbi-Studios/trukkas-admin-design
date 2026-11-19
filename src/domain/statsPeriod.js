// Relative periods for the stat cards at the top of each page.
// Rolling windows ending now: last day = 24h, last month = 30 days, last quarter = 90 days.
// Stats use these; table filters keep their own date filters.

export const STATS_PERIODS = [
  { key: '1d', label: 'Last day', days: 1, summary: 'Last day', compare: 'the day before', vs: 'vs previous day' },
  { key: '7d', label: 'Last 7 days', days: 7, summary: 'Last 7 days', compare: 'the 7 days before', vs: 'vs previous 7 days' },
  { key: '1m', label: 'Last month', days: 30, summary: 'Last month', compare: 'the month before', vs: 'vs previous month' },
  { key: '3m', label: 'Last quarter', days: 90, summary: 'Last quarter', compare: 'the quarter before', vs: 'vs previous quarter' },
  { key: 'all', label: 'All time', days: null, summary: 'All time', compare: null, vs: 'all time' },
];

export const DEFAULT_STATS_PERIOD = '7d';

export function statsPeriod(key) {
  return STATS_PERIODS.find((p) => p.key === key) || STATS_PERIODS.find((p) => p.key === DEFAULT_STATS_PERIOD);
}

/** ISO { dateFrom, dateTo } for a rolling window ending now; {} for "all". */
export function statsPeriodRange(key, now = new Date()) {
  const period = statsPeriod(key);
  if (!period.days) return {};
  const to = new Date(now);
  const from = new Date(now.getTime() - period.days * 86400000);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

/** Number of days in the window, or null for "all". */
export function statsPeriodDays(key) {
  return statsPeriod(key).days;
}

/** { from, to } as Lagos calendar days (YYYY-MM-DD) for APIs that take dates, not timestamps; {} for "all". */
export function statsPeriodDates(key, now = new Date()) {
  const period = statsPeriod(key);
  if (!period.days) return {};
  const day = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return { from: day(new Date(now.getTime() - (period.days - 1) * 86400000)), to: day(now) };
}
