export const KNOWLEDGE_ANALYTICS_PERIODS = [
  { value: 'thisMonth', label: 'This Month' }, { value: 'lastMonth', label: 'Last Month' },
  { value: 'last7Days', label: 'Last 7 Days' }, { value: 'last30Days', label: 'Last 30 Days' },
];
export const KNOWLEDGE_ANALYTICS_INTERVALS = [
  { value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' },
];
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const percent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const date = value.slice(0, 10), parsed = Date.parse(value);
  return day(date) && Number.isFinite(parsed) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60 ? parsed : null;
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? value : null;
}
export function knowledgeAnalyticsDate(value, compact = false) {
  const parsed = day(value) ? Date.parse(value + 'T00:00:00+01:00') : instant(value);
  return parsed == null ? '—' : new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', ...(compact ? {} : { year: 'numeric' }) }).format(new Date(parsed));
}
function votes(raw) {
  const value = record(raw), helpful = count(value.helpful), notHelpful = count(value.notHelpful);
  return { views: count(value.views), helpful, notHelpful, helpfulPercentage: helpful === 0 && notHelpful === 0 ? null : percent(value.helpfulPercentage) };
}
function bucketOverlaps(date, interval, from, to) {
  if (!day(date)) return false;
  const start = Date.parse(date + 'T00:00:00+01:00');
  const end = interval === 'month'
    ? Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 1) - 60 * 60 * 1000
    : start + (interval === 'week' ? 7 : 1) * 24 * 60 * 60 * 1000;
  return start < to && end > from;
}
export function adaptKnowledgeAnalytics(raw, request) {
  const dto = record(raw), period = record(dto.period), from = instant(period.from), to = instant(period.to);
  if (period.name !== request.period || dto.interval !== request.interval || period.timezone !== 'Africa/Lagos' || from == null || to == null || from >= to) throw new Error('The analytics response did not confirm the requested period and interval.');
  let buckets = null;
  if (Array.isArray(dto.buckets) && dto.buckets.every((bucket, index, all) => bucketOverlaps(bucket?.date, request.interval, from, to) && (index === 0 || all[index - 1].date < bucket.date))) {
    buckets = dto.buckets.map(bucket => ({ id: bucket.date, date: bucket.date, label: knowledgeAnalyticsDate(bucket.date, true), ...votes(bucket) }));
  }
  const topArticles = Array.isArray(dto.topArticles) && dto.topArticles.length <= 5 && dto.topArticles.every(article => text(article?.id)) && new Set(dto.topArticles.map(article => article.id)).size === dto.topArticles.length
    ? dto.topArticles.map(article => ({ id: article.id, title: text(article.title) || '—', views: count(article.views) })) : null;
  return { period: { from: period.from, to: period.to, timezone: period.timezone,
    label: knowledgeAnalyticsDate(period.from) + ' – ' + knowledgeAnalyticsDate(new Date(to - 1).toISOString()) + ' · Africa/Lagos' }, interval: dto.interval,
    totals: { ...votes(dto.totals), uniqueReaders: count(dto.totals?.uniqueReaders) }, buckets, topArticles };
}
