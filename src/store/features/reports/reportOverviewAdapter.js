import { reportText, reportRecord } from './reportContracts.js';
import { metricNumber, metricCount, metricRate, metricPercent, metricComparison, metricSparkline, metricDate, metricBucketLabel } from './reportMetrics.js';

const normalized = value => reportText(value)?.toLowerCase().replaceAll('_', ' ');
const colors = ['var(--tk-viz-1)', 'var(--tk-viz-2)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-viz-6)', 'var(--tk-ink-300)'];
const formattedCount = value => metricCount(value) == null ? '—' : metricCount(value).toLocaleString('en-NG');
function share(row) {
  return metricPercent(metricRate(row?.percentage));
}
function breakdown(rows) {
  return rows.map((row, index) => ({ label: reportText(row?.label) || '—', count: metricCount(row?.count), pct: share(row), color: colors[index % colors.length] }));
}
function orderedPoints(rows) {
  return Array.isArray(rows) && rows.every(row => metricDate(row?.date) != null) ? [...rows].sort((a, b) => metricDate(a.date) - metricDate(b.date)) : null;
}
export function adaptReportOverview(value, empty, metric) {
  const dto = reportRecord(value), summary = reportRecord(dto.summary), deltaValues = {};
  for (const key of ['totalJobs', 'completedJobs', 'totalRevenue', 'totalPayouts', 'activeUsers', 'complianceRate']) {
    const source = reportRecord(summary[key]);
    const parse = ['totalJobs', 'completedJobs', 'activeUsers'].includes(key) ? metricCount : key === 'complianceRate' ? metricRate : metricNumber;
    empty.dashboardSummary[key] = parse(source.value);
    // Compliance is a current-state ratio; the backend supplies no historical comparison.
    const comparison = key === 'complianceRate' ? { delta: null, text: '—' } : metricComparison(source);
    deltaValues[key] = comparison.delta;
    empty.dashboardSummary[key + 'Delta'] = comparison.text;
    empty.dashboardSummary[key + 'Trend'] = metricSparkline(source.sparkline, parse);
  }
  const operations = orderedPoints(dto.operations), operationKeys = { Created: 'created', 'In Progress': 'inProgress', Completed: 'completed', Cancelled: 'cancelled' };
  if (operations && (dto.metric == null || dto.metric === metric)) {
    empty.operationsOverview.labels = operations.map(row => metricBucketLabel(row.date));
    for (const series of empty.operationsOverview.series) {
      const parse = metric === 'revenue' ? metricNumber : metricCount;
      const values = operations.map(row => parse(row[operationKeys[series.name]]));
      series.points = values.every(point => point != null) ? values : [];
    }
  }
  const statuses = Array.isArray(dto.jobsByStatus) ? dto.jobsByStatus : [];
  for (const target of empty.jobsByStatus) {
    const row = statuses.find(item => normalized(item?.label) === normalized(target.label));
    target.count = metricCount(row?.count); target.pct = share(row);
  }
  for (const [label, tone, color] of [['Disputed', 'danger', 'var(--tk-viz-5)'], ['Other', 'neutral', 'var(--tk-ink-300)']]) {
    const row = statuses.find(item => normalized(item?.label) === normalized(label));
    if (row) empty.jobsByStatus.push({ label, tone, color, count: metricCount(row.count), pct: share(row) });
  }
  if (Array.isArray(dto.jobsByType)) empty.jobsByType = breakdown(dto.jobsByType);
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
  const types = { FORWARDER: 'Forwarder', EXPORTER: 'Exporter', TRUCKER: 'Trucker', TRUCKING_COMPANY: 'Truck Company' };
  empty.topPerformingEntities = entities.filter(row => row && typeof row === 'object' && !Array.isArray(row)).map((row, index) => ({
    _key: reportText(row.entityId) || String(index), rank: metricCount(row.rank) ?? '—', entity: reportText(row.entityName) || '—', entityType: types[row.entityType] || reportText(row.entityType) || '—',
    jobs: formattedCount(row.jobs), revenue: metricNumber(row.revenue), growth: metricPercent(row.growth),
  }));
  const financial = reportRecord(dto.financial);
  for (const [key, field] of [['totalRevenue', 'revenue'], ['totalPayouts', 'payouts'], ['outstandingPayments', 'outstandingPayments'], ['escrowBalance', 'escrowBalance']]) {
    const source = reportRecord(financial[field]);
    empty.financialSummary[key] = metricNumber(source.value);
    empty.financialSummary[key + 'Delta'] = ['outstandingPayments', 'escrowBalance'].includes(key) ? '—' : metricComparison(source).text;
  }
  const engagement = reportRecord(dto.engagement);
  for (const key of ['activeUsers', 'newUsers']) {
    const source = reportRecord(engagement[key]);
    empty.userEngagement[key] = metricCount(source.value); empty.userEngagement[key + 'Delta'] = metricComparison(source).text;
  }
  // User sessions remain unavailable: the API explicitly does not track them.
  const compliance = reportRecord(dto.compliance);
  empty.complianceOverview.totalVerifications = formattedCount(compliance.totalVerifications);
  for (const key of ['verified', 'pending', 'rejected']) {
    const source = reportRecord(compliance[key]);
    empty.complianceOverview[key] = formattedCount(source.count); empty.complianceOverview[key + 'Pct'] = metricPercent(metricRate(source.percentage));
  }
  const alerts = reportRecord(dto.alerts), alertFields = { 'Jobs Delayed': 'jobsDelayed', 'Payments Overdue': 'paymentsOverdue', 'Verification Pending': 'verificationPending', 'Compliance Issues': 'complianceIssues' };
  for (const target of empty.alertsExceptions) target.count = formattedCount(alerts[alertFields[target.label]]);
  empty.deltaValues = deltaValues;
  empty.complianceDefinition = reportText(compliance.note) || '—';
  return empty;
}
