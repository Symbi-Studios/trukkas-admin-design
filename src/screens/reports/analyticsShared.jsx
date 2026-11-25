'use client';

import { formatNairaAmount, formatNairaShort } from '../../lib/money.js';
import { reportRangeQuery } from '../../store/features/reports/reportDraft.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import styles from './Analytics.module.css';

const DAY = 86400000;

export const PERIODS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '12m', label: '12 months', days: 365 },
  { key: 'custom', label: 'Custom' },
];

export function lagosToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name) => parts.find((item) => item.type === name).value;
  return part('year') + '-' + part('month') + '-' + part('day');
}

export function rangeForPeriod(key) {
  const days = PERIODS.find((p) => p.key === key)?.days || 30;
  const dateTo = lagosToday();
  const dateFrom = new Date(new Date(dateTo + 'T00:00:00Z').getTime() - (days - 1) * DAY).toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

export function rangeDays(range) {
  if (!reportRangeQuery(range)) return 0;
  return Math.round((new Date(range.dateTo + 'T00:00:00Z') - new Date(range.dateFrom + 'T00:00:00Z')) / DAY) + 1;
}

/** "Nov 11 – 17", "Oct 28 – Nov 3", with years only when they differ from this year. */
export function shortRange(range) {
  if (!range || !reportRangeQuery(range)) return '—';
  const from = new Date(range.dateFrom + 'T00:00:00Z'), to = new Date(range.dateTo + 'T00:00:00Z');
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const thisYear = sameYear && from.getUTCFullYear() === new Date().getUTCFullYear();
  const fmt = (date, options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);
  const year = thisYear ? {} : { year: 'numeric' };
  if (range.dateFrom === range.dateTo) return fmt(from, { month: 'short', day: 'numeric', ...year });
  const start = fmt(from, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const end = from.getUTCMonth() === to.getUTCMonth() && sameYear ? fmt(to, { day: 'numeric', ...year }) : fmt(to, { month: 'short', day: 'numeric', ...year });
  return start + ' – ' + end;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export const fmtCount = (v) => (finite(v) ? v.toLocaleString('en-NG') : '—');
export const fmtMoney = (v) => (finite(v) ? formatNairaShort(v) : '—');
export const fmtMoneyFull = (v) => (finite(v) ? formatNairaAmount(v) : '—');
export const fmtPercent = (v, digits = 1) => (finite(v) ? v.toLocaleString('en-NG', { maximumFractionDigits: digits }) + '%' : '—');
export const share = (part, whole) => (finite(part) && finite(whole) && whole > 0 ? (part / whole) * 100 : null);

/** Short naira on screen with the exact figure on hover. */
export function Money({ value }) {
  return finite(value) ? <span title={fmtMoneyFull(value)}>{fmtMoney(value)}</span> : '—';
}

/**
 * Change for a metric. Small counts (both sides under 20) show the absolute difference ("+2"),
 * because a percentage on 3 → 5 is noise. Otherwise the API's percent change.
 */
export function changeOf({ value, previous, percent, kind = 'count' }) {
  // Only a percent was given: recover the previous count when it is unambiguous.
  if (kind === 'count' && previous == null && Number.isInteger(value) && finite(percent) && percent > -100) {
    const estimate = value / (1 + percent / 100);
    if (Math.abs(estimate - Math.round(estimate)) < 0.05) previous = Math.round(estimate);
  }
  if (kind === 'count' && Number.isInteger(value) && Number.isInteger(previous) && Math.max(Math.abs(value), Math.abs(previous)) < 20) {
    const diff = value - previous;
    return { change: diff === 0 ? 'No change' : (diff > 0 ? '+' : '−') + Math.abs(diff), direction: diff === 0 ? null : diff > 0 ? 'up' : 'down' };
  }
  if (!finite(percent)) return {};
  return { change: (percent > 0 ? '+' : percent < 0 ? '−' : '') + fmtPercent(Math.abs(percent)), direction: percent > 0 ? 'up' : percent < 0 ? 'down' : null };
}

/** Tooltip label for a chart bucket. */
export function bucketTitle(iso, groupBy) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const date = new Date(time);
  const fmt = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', ...options }).format(date);
  if (groupBy === 'month') return fmt({ month: 'long', year: 'numeric' });
  if (groupBy === 'week') return 'Week of ' + fmt({ month: 'short', day: 'numeric' });
  return fmt({ weekday: 'short', month: 'short', day: 'numeric' });
}

/** The API's own bucketing: daily up to 31 days, weekly up to 92, monthly beyond. */
export const autoGroupBy = (range) => (rangeDays(range) <= 31 ? 'day' : rangeDays(range) <= 92 ? 'week' : 'month');

/** A quiet bordered section: title, optional description and right-hand action. */
export function Panel({ title, description, action, children, className, flush = false }) {
  return (
    <section className={styles.panel + (className ? ' ' + className : '')}>
      {(title || action) && (
        <header className={styles.panelHead}>
          <div className={styles.panelTitle}>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          {action && <div className={styles.panelAction}>{action}</div>}
        </header>
      )}
      <div className={flush ? styles.panelBodyFlush : styles.panelBody}>{children}</div>
    </section>
  );
}

/** One quiet line where a section has nothing to show. */
export function Quiet({ children }) {
  return <p className={styles.quiet}>{children}</p>;
}

export function TextLink({ children, onClick }) {
  return <button type="button" className={styles.textLink} onClick={onClick}>{children}</button>;
}

/** Segmented control (same look as the period switch). */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="tk-period-toggle" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Query state for a section: first load shows placeholders, a refetch dims what's there. */
export function sectionState(query, authenticated = true) {
  const data = authenticated && !query.error ? query.data : undefined;
  return {
    data,
    loading: !data && !query.error && (query.isFetching || query.isLoading || query.isUninitialized),
    dimmed: Boolean(data) && query.isFetching,
    error: query.error ? getApiErrorMessage(query.error) : null,
  };
}

/** Placeholder line or error line for a section with no data yet. */
export function SectionStatus({ state, children }) {
  if (state.error) return <Quiet>Couldn’t load this. {state.error}</Quiet>;
  if (state.loading) return <div className={styles.placeholder} aria-busy="true" />;
  return children;
}
