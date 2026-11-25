import { fmtCount, fmtMoney, fmtPercent } from './analyticsShared.jsx';

const VIZ = ['var(--tk-viz-1)', 'var(--tk-viz-2)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-viz-6)', 'var(--tk-ink-300)'];
const signed = (v) => (typeof v === 'number' && Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + fmtPercent(Math.abs(v)) : '—');
const jobsLabel = (n) => (n == null ? '— jobs' : `${fmtCount(n)} ${n === 1 ? 'job' : 'jobs'}`);

/** Forwarder / truck-company leaderboard rows from reports/overview topEntities. */
export function entityRows(rows = [], sortBy, navigate, base) {
  return (rows || []).map((row) => {
    const open = row.entityId && navigate ? () => navigate(`${base}/detail?id=${encodeURIComponent(row.entityId)}`) : undefined;
    if (sortBy === 'jobs') return { id: row._key, label: row.entity, value: row.jobsCount, display: jobsLabel(row.jobsCount), secondary: fmtMoney(row.revenue), onClick: open };
    if (sortBy === 'growth') return { id: row._key, label: row.entity, value: row.growth, display: signed(row.growth), secondary: fmtMoney(row.revenue), onClick: open };
    return { id: row._key, label: row.entity, value: row.revenue, display: fmtMoney(row.revenue), secondary: jobsLabel(row.jobsCount), onClick: open };
  });
}

export function routeRows(rows = []) {
  return (rows || []).map((row) => ({ id: row.id, label: row.route, value: row.trips, display: row.trips == null ? '—' : `${fmtCount(row.trips)} ${row.trips === 1 ? 'trip' : 'trips'}`, secondary: fmtPercent(row.share) }));
}

export function destinationRows(rows = []) {
  return (rows || []).map((row, index) => ({ id: row.label + index, label: row.label, value: row.count, display: fmtCount(row.count), secondary: row.pct }));
}

export function statusItems(rows = []) {
  return (rows || []).map((row) => ({ label: row.label, value: row.count, color: row.color }));
}

export function breakdownItems(rows = []) {
  return (rows || []).map((row, index) => ({ label: row.label, value: row.count, color: VIZ[index % VIZ.length] }));
}

export function earningsItems(earnings) {
  return (earnings?.segments || []).map((segment, index) => ({ key: segment.key, label: segment.label, value: segment.amount, color: VIZ[index % VIZ.length] }));
}

export { VIZ, signed, jobsLabel };
