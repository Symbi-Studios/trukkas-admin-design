import { reportText, reportRecord, reportInteger } from './reportContracts.js';
const number = (v) => (typeof v === 'number' || typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim())) && Number.isFinite(Number(v)) ? Number(v) : null;
const points = (v) => Array.isArray(v) && v.every((n) => number(n) != null) ? v : [];
const percent = (v) => number(v) == null ? '—' : v.toLocaleString('en-NG', { maximumFractionDigits: 1 }) + '%';
const explicitPercent = (v) => typeof v === 'string' && /^[+-]?\d+(?:\.\d+)?%$/.test(v.trim()) ? Number(v.trim().slice(0, -1)) : null;
const normalized = (v) => reportText(v)?.toLowerCase().replaceAll('_', ' ');
export function adaptReportOverview(dto, empty, metric) {
  dto = reportRecord(dto);
  // Overview has no published schema. Only accept actual values that match the
  // existing named sections and their types; never infer aliases or missing totals.
  const summary = reportRecord(dto.dashboardSummary), deltaValues = {};
  for (const key of ['totalJobs', 'completedJobs', 'activeUsers']) empty.dashboardSummary[key] = reportInteger(summary[key]);
  for (const key of ['totalRevenue', 'totalPayouts']) empty.dashboardSummary[key] = number(summary[key]);
  const compliance = explicitPercent(summary.complianceRate);
  empty.dashboardSummary.complianceRate = compliance != null && compliance >= 0 && compliance <= 100 ? compliance : null;
  for (const key of ['totalJobs', 'completedJobs', 'totalRevenue', 'totalPayouts', 'activeUsers', 'complianceRate']) {
    deltaValues[key] = key === 'complianceRate' ? null : explicitPercent(summary[key + 'Delta']);
    empty.dashboardSummary[key + 'Delta'] = percent(deltaValues[key]);
    empty.dashboardSummary[key + 'Trend'] = points(summary[key + 'Trend']);
  }
  const operations = reportRecord(dto.operationsOverview);
  if (Array.isArray(operations.labels) && operations.labels.every((v) => reportText(v))) {
    empty.operationsOverview.labels = operations.labels;
    for (const series of empty.operationsOverview.series) {
      const source = Array.isArray(operations.series) ? operations.series.find((s) => s?.name === series.name) : null;
      const values = points(source?.points);
      series.points = values.length === operations.labels.length && (metric === 'revenue' || values.every((value) => reportInteger(value) != null)) ? values : [];
    }
  }
  for (const section of ['jobsByStatus', 'jobsByType', 'geographicalDistribution', 'alertsExceptions']) {
    const rows = Array.isArray(dto[section]) ? dto[section] : [];
    for (const target of empty[section]) {
      const row = rows.find((r) => normalized(r?.label) === normalized(target.label));
      const value = reportInteger(row?.count);
      target.count = section === 'alertsExceptions' ? value == null ? '—' : value.toLocaleString('en-NG') : value;
      if (Object.hasOwn(target, 'pct')) {
        const share = number(row?.percent);
        const total = empty.dashboardSummary.totalJobs;
        target.pct = share != null && share >= 0 && share <= 100 ? percent(share) : value != null && total != null && value <= total ? percent(total ? value / total * 100 : 0) : '—';
      }
    }
  }
  const trend = reportRecord(dto.trendData);
  if (Array.isArray(trend.labels) && trend.labels.every((v) => reportText(v))) {
    empty.trendData.labels = trend.labels;
    for (const key of ['revenue', 'payouts']) { const values = points(trend[key]); empty.trendData[key] = values.length === trend.labels.length ? values : []; }
  }
  const entities = Array.isArray(dto.topPerformingEntities) ? dto.topPerformingEntities : [];
  empty.topPerformingEntities = entities.filter((r) => r && typeof r === 'object' && !Array.isArray(r)).map((r, index) => ({
    _key: reportText(r.entityId) || String(index), rank: reportInteger(r.rank) ?? '—', entity: reportText(r.entity) || '—', entityType: reportText(r.entityType) || '—',
    jobs: reportInteger(r.jobs) == null ? '—' : reportInteger(r.jobs).toLocaleString('en-NG'), revenue: number(r.revenue), growth: percent(explicitPercent(r.growth)),
  }));
  for (const [section, keys] of [['financialSummary', ['totalRevenue', 'totalPayouts', 'outstandingPayments', 'escrowBalance']], ['userEngagement', ['activeUsers', 'newUsers']]]) {
    const source = reportRecord(dto[section]);
    for (const key of keys) { empty[section][key] = section === 'userEngagement' ? reportInteger(source[key]) : number(source[key]); empty[section][key + 'Delta'] = percent(explicitPercent(source[key + 'Delta'])); }
  }
  const current = reportRecord(dto.complianceOverview);
  for (const key of ['totalVerifications', 'verified', 'pending', 'rejected']) { const v = reportInteger(current[key]); empty.complianceOverview[key] = v == null ? '—' : v.toLocaleString('en-NG'); }
  for (const key of ['verifiedPct', 'pendingPct', 'rejectedPct']) { const v = number(current[key]); empty.complianceOverview[key] = v != null && v >= 0 && v <= 100 ? percent(v) : '—'; }
  // Sessions are explicitly untracked; compliance is current state, not a period metric.
  empty.deltaValues = deltaValues;
  empty.complianceDefinition = reportText(current.definition) || '—';
  return empty;
}
