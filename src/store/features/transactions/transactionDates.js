const timeZone = 'Africa/Lagos';
const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
function lagosDay(date) {
  const parts = Object.fromEntries(dayParts.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function dayLabel(value, year) {
  return new Date(value + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
}
export function transactionRangeLabel(from, to) {
  if (!from && !to) return 'All Dates';
  if (from && !validDay(from) || to && !validDay(to) || from && to && from > to) return '—';
  if (!from) return 'Through ' + dayLabel(to, true);
  if (!to) return 'From ' + dayLabel(from, true);
  if (from === to) return dayLabel(from, true);
  return dayLabel(from, from.slice(0, 4) !== to.slice(0, 4)) + ' – ' + dayLabel(to, true);
}
export function transactionDatePresets(now = new Date()) {
  const today = new Date(lagosDay(now) + 'T00:00:00Z');
  const shift = days => { const date = new Date(today); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const ranges = [0, 1, 2].map(week => {
    const from = shift(-week * 7 - 6), to = shift(-week * 7);
    return { label: transactionRangeLabel(from, to), from, to };
  });
  const from = today.toISOString().slice(0, 7) + '-01';
  const last = new Date(today); last.setUTCMonth(last.getUTCMonth() + 1, 0);
  ranges.push({ label: 'This Month (' + today.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) + ')', from, to: last.toISOString().slice(0, 10) });
  return ranges;
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDay(value.slice(0, 10))) return null;
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  const parsed = Date.parse(value);
  return hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(parsed) ? parsed : null;
}
export function transactionComparisonCaption(period, comparison) {
  const currentFrom = instant(period?.from), currentTo = instant(period?.to), from = instant(comparison?.from), to = instant(comparison?.to);
  if (currentFrom == null || currentTo == null || currentFrom > currentTo || from == null || to == null || from >= to || to > currentFrom) return null;
  // A comparison ending exactly at the current window's start uses that
  // boundary exclusively; show its last included Lagos calendar day.
  const lastIncluded = to === currentFrom ? to - 1 : to;
  if (lastIncluded < from) return null;
  return 'vs ' + transactionRangeLabel(lagosDay(new Date(from)), lagosDay(new Date(lastIncluded)));
}
