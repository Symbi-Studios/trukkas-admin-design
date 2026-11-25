import { reportText, reportRecord } from './reportContracts.js';
import { metricNumber, metricCount, metricRate, metricPercent, metricComparison, metricSparkline, metricDate, metricBucketLabel } from './reportMetrics.js';

const normalized = value => reportText(value)?.toLowerCase().replaceAll('_', ' ');
const colors = ['var(--tk-viz-1)', 'var(--tk-viz-2)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-viz-6)', 'var(--tk-ink-300)'];
const formattedCount = value => metricCount(value) == null ? '—' : metricCount(value).toLocaleString('en-NG');
function share(row) {
  return metricPercent(metricRate(row?.percentage));
}
/** "PORT_TO_PORT / CONTAINER" → "Port to port · Container". */
export function humanReportCode(value) {
  const text = reportText(value);
  if (!text) return '—';
  return text.split('/').map((part) => {
    const words = part.trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLowerCase();
    return words ? words[0].toUpperCase() + words.slice(1) : '—';
  }).join(' · ');
}
function breakdown(rows, label = reportText) {
  return rows.map((row, index) => ({ label: label(row?.label) || '—', count: metricCount(row?.count), pct: share(row), color: colors[index % colors.length] }));
}
function orderedPoints(rows) {
  return Array.isArray(rows) && rows.every(row => metricDate(row?.date) != null) ? [...rows].sort((a, b) => metricDate(a.date) - metricDate(b.date)) : null;
}
const definition = (source) => reportText(reportRecord(source).definition) || reportText(reportRecord(source).note) || null;

export function adaptReportOverview(value, empty, metric) {
  const dto = reportRecord(value), summary = reportRecord(dto.summary), deltaValues = {};
  for (const key of ['totalJobs', 'completedJobs', 'totalRevenue', 'totalPayouts', 'activeUsers', 'complianceRate']) {
    const source = reportRecord(summary[key]);
    const parse = ['totalJobs', 'completedJobs', 'activeUsers'].includes(key) ? metricCount : key === 'complianceRate' ? metricRate : metricNumber;
    empty.dashboardSummary[key] = parse(source.value);
    // Compliance is an all-time ratio (verified ÷ decided); it has no period comparison or trend.
    const comparison = key === 'complianceRate' ? { delta: null, text: '—', direction: null } : metricComparison(source);
    deltaValues[key] = comparison.delta;
    empty.dashboardSummary[key + 'Delta'] = comparison.text;
    empty.dashboardSummary[key + 'Trend'] = key === 'complianceRate' ? [] : metricSparkline(source.sparkline, parse);
    empty.definitions[key] = definition(source);
  }
  const operations = orderedPoints(dto.operations), operationKeys = { Created: 'created', Accepted: 'inProgress', Completed: 'completed', Cancelled: 'cancelled' };
  if (operations && (dto.metric == null || dto.metric === metric)) {
    empty.operationsOverview.labels = operations.map(row => metricBucketLabel(row.date));
    for (const series of empty.operationsOverview.series) {
      const parse = metric === 'revenue' ? metricNumber : metricCount;
      const values = operations.map(row => parse(row[operationKeys[series.name]]));
      series.points = values.every(point => point != null) ? values : [];
    }
  }
  empty.notes.operations = reportText(dto.operationsDefinition);
  empty.groupBy = ['day', 'week', 'month'].includes(dto.groupBy) ? dto.groupBy : null;
  const statuses = Array.isArray(dto.jobsByStatus) ? dto.jobsByStatus : [];
  for (const target of empty.jobsByStatus) {
    const row = statuses.find(item => normalized(item?.label) === normalized(target.label));
    target.count = metricCount(row?.count); target.pct = share(row);
    target.returned = Boolean(row);
  }
  for (const [label, tone, color] of [['Disputed', 'danger', 'var(--tk-viz-5)'], ['Other', 'neutral', 'var(--tk-ink-300)']]) {
    const row = statuses.find(item => normalized(item?.label) === normalized(label));
    if (row) empty.jobsByStatus.push({ label, tone, color, count: metricCount(row.count), pct: share(row), returned: true });
  }
  // The status buckets add up to totalJobs. When the returned buckets already do, an omitted
  // bucket is a real zero rather than missing data.
  const returned = empty.jobsByStatus.filter(status => status.returned);
  const total = empty.dashboardSummary.totalJobs;
  if (total != null && returned.every(status => status.count != null) && returned.reduce((sum, status) => sum + status.count, 0) === total) {
    for (const status of empty.jobsByStatus) if (!status.returned) { status.count = 0; status.pct = '0%'; }
  }
  for (const status of empty.jobsByStatus) delete status.returned;
  if (Array.isArray(dto.jobsByType)) empty.jobsByType = breakdown(dto.jobsByType, humanReportCode);
  if (Array.isArray(dto.geography)) empty.geographicalDistribution = breakdown(dto.geography);
  const trend = orderedPoints(dto.revenueTrend);
  if (trend) {
    empty.trendData.labels = trend.map(row => metricBucketLabel(row.date));
    for (const key of ['revenue', 'payouts']) {
      const points = trend.map(row => metricNumber(row[key]));
      empty.trendData[key] = points.every(point => point != null) ? points : [];
    }
  }
  const entities = Array.isArray(dto.topEntities) ? dto.topEntities : [];
  const types = { FORWARDER: 'Forwarder', EXPORTER: 'Forwarder', TRUCKER: 'Trucker', TRUCKING_COMPANY: 'Truck Company' };
  empty.topPerformingEntities = entities.filter(row => row && typeof row === 'object' && !Array.isArray(row)).map((row, index) => ({
    _key: reportText(row.entityId) || String(index), rank: metricCount(row.rank) ?? '—', entity: reportText(row.entityName) || '—', entityType: types[row.entityType] || humanReportCode(row.entityType),
    jobs: formattedCount(row.jobs), revenue: metricNumber(row.revenue), growth: metricNumber(row.growth),
  }));
  const financial = reportRecord(dto.financial);
  for (const [key, field] of [['totalRevenue', 'revenue'], ['grossJobValue', 'grossJobValue'], ['totalPayouts', 'payouts'], ['outstandingPayments', 'outstandingPayments'], ['escrowBalance', 'escrowBalance']]) {
    const source = reportRecord(financial[field]);
    empty.financialSummary[key] = metricNumber(source.value);
    // Outstanding payments and escrow balance are point-in-time values with no comparison.
    const comparison = ['outstandingPayments', 'escrowBalance'].includes(key) ? { delta: null, direction: null } : metricComparison(source);
    empty.financialSummary[key + 'Delta'] = comparison.delta;
    empty.financialSummary[key + 'Direction'] = comparison.direction;
    empty.financialSummary[key + 'Definition'] = definition(source);
  }
  const engagement = reportRecord(dto.engagement);
  for (const key of ['activeUsers', 'newUsers', 'userSessions']) {
    const source = reportRecord(engagement[key]);
    const comparison = metricComparison(source);
    empty.userEngagement[key] = metricCount(source.value);
    empty.userEngagement[key + 'Delta'] = comparison.delta;
    empty.userEngagement[key + 'Direction'] = comparison.direction;
    empty.userEngagement[key + 'Definition'] = definition(source);
  }
  const compliance = reportRecord(dto.compliance);
  empty.complianceOverview.totalVerifications = formattedCount(compliance.totalVerifications);
  for (const key of ['verified', 'pending', 'rejected']) {
    const source = reportRecord(compliance[key]);
    empty.complianceOverview[key] = formattedCount(source.count); empty.complianceOverview[key + 'Pct'] = metricPercent(metricRate(source.percentage));
  }
  empty.notes.compliance = reportText(compliance.note);
  const alerts = reportRecord(dto.alerts), alertDefinitions = reportRecord(alerts.definitions);
  for (const target of empty.alertsExceptions) {
    target.count = metricCount(alerts[target.key]);
    target.definition = reportText(alertDefinitions[target.key]);
  }
  empty.deltaValues = deltaValues;
  return empty;
}
