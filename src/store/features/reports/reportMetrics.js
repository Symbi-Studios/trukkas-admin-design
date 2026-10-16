export const metricRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function metricNumber(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
}
export const metricCount = value => Number.isSafeInteger(metricNumber(value)) && metricNumber(value) >= 0 ? metricNumber(value) : null;
export const metricRate = value => metricNumber(value) != null && metricNumber(value) >= 0 && metricNumber(value) <= 100 ? metricNumber(value) : null;
export const metricPercent = value => metricNumber(value) == null ? '—' : metricNumber(value).toLocaleString('en-NG', { maximumFractionDigits: 1 }) + '%';
export function metricDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (hour > 23 || minute > 59 || second > 59 || offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
export function metricComparison(value) {
  const metric = metricRecord(value), previous = metricNumber(metric.previous);
  const delta = previous == null || previous === 0 || metricNumber(metric.value) == null ? null : metricNumber(metric.changePercent);
  return { delta, text: metricPercent(delta), direction: delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : null };
}
export function metricSparkline(value, parse = metricNumber) {
  if (!Array.isArray(value) || !value.every(point => metricDate(point?.date) != null && parse(point?.value) != null)) return [];
  return [...value].sort((a, b) => metricDate(a.date) - metricDate(b.date)).map(point => parse(point.value));
}
export const metricBucketLabel = value => metricDate(value) == null ? '—' : new Date(value).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric' });
