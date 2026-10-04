import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

export const REPORT_CAPABILITIES = Object.freeze({ preview: false, export: false, templates: false, schedule: false });
export function reportNumber(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
const count = (value) => { const number = reportNumber(value); return Number.isSafeInteger(number) && number >= 0 ? number : null; };
export const reportCount = (value) => { const number = count(value); return number == null ? '—' : number.toLocaleString('en-NG'); };
export const reportMoney = (value) => { const number = reportNumber(value); return number == null ? '—' : '₦' + number.toLocaleString('en-NG', { maximumFractionDigits: 2 }); };
export const reportPercent = (value) => { const number = reportNumber(value); return number == null ? '—' : number.toLocaleString('en-NG', { maximumFractionDigits: 1 }) + '%'; };
export function reportChange(current, previous) {
  if (count(current) == null || count(previous) == null || previous === 0) return null;
  return (current - previous) / previous * 100;
}
export const unavailableReportPreview = {
  available: false, rows: [], totalRecords: null, entityCount: null, reportId: null,
  generatedOn: null, generatedBy: null, estimatedFileSizeMb: null, comparisonLabel: '—',
  summary: [
    { key: 'total', icon: 'shield-check', color: 'var(--tk-viz-1)', label: 'Total Verifications', value: '—', delta: '—', direction: null, trend: [] },
    { key: 'verified', icon: 'circle-check', color: 'var(--tk-viz-2)', label: 'Verified', value: '—', delta: '—', direction: null, trend: [] },
    { key: 'pending', icon: 'hourglass', color: 'var(--tk-viz-3)', label: 'Pending', value: '—', delta: '—', direction: null, trend: [] },
    { key: 'rejected', icon: 'circle-x', color: 'var(--tk-viz-4)', label: 'Rejected', value: '—', delta: '—', direction: null, trend: [] },
    { key: 'compliance', icon: 'shield', color: 'var(--tk-viz-2)', label: 'Compliance Rate', value: '—', delta: '—', direction: null, trend: [] },
    { key: 'avgTime', icon: 'timer', color: 'var(--tk-viz-5)', label: 'Avg. Verification Time', value: '—', delta: '—', direction: null, trend: [] },
  ],
};
export function emptyReportOverview() {
  return {
    dashboardSummary: Object.fromEntries(['totalJobs', 'completedJobs', 'totalRevenue', 'totalPayouts', 'activeUsers', 'complianceRate'].flatMap((key) => [[key, null], [key + 'Delta', '—'], [key + 'Trend', []]])),
    operationsOverview: { labels: [], series: [
      { name: 'Created', color: 'var(--tk-viz-1)', points: [] },
      { name: 'In Progress', color: 'var(--tk-viz-3)', points: [] },
      { name: 'Completed', color: 'var(--tk-viz-2)', points: [] },
      { name: 'Cancelled', color: 'var(--tk-viz-4)', points: [] },
    ] },
    jobsByStatus: [
      { label: 'Completed', count: null, pct: '—', tone: 'success', color: 'var(--tk-viz-2)' },
      { label: 'In Progress', count: null, pct: '—', tone: 'info', color: 'var(--tk-viz-3)' },
      { label: 'Pending', count: null, pct: '—', tone: 'warning', color: 'var(--tk-viz-1)' },
      { label: 'Cancelled', count: null, pct: '—', tone: 'danger', color: 'var(--tk-viz-4)' },
    ],
    jobsByType: ['Import', 'Export', 'Local Delivery', 'Haulage', 'Others'].map((label, index) => ({ label, count: null, pct: '—', color: ['var(--tk-viz-1)', 'var(--tk-viz-2)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-ink-300)'][index] })),
    geographicalDistribution: ['Lagos', 'Apapa', 'Port Harcourt', 'Onne', 'Tin Can', 'Others'].map((label) => ({ label, count: null, pct: '—' })),
    topPerformingEntities: [], trendData: { labels: [], revenue: [], payouts: [] },
    financialSummary: Object.fromEntries(['totalRevenue', 'totalPayouts', 'outstandingPayments', 'escrowBalance'].flatMap((key) => [[key, null], [key + 'Delta', '—']])),
    userEngagement: Object.fromEntries(['activeUsers', 'newUsers', 'userSessions'].flatMap((key) => [[key, null], [key + 'Delta', '—']])),
    complianceOverview: { totalVerifications: '—', verified: '—', pending: '—', rejected: '—', verifiedPct: '—', pendingPct: '—', rejectedPct: '—' },
    alertsExceptions: ['Jobs Delayed', 'Payments Overdue', 'Verification Pending', 'Compliance Issues'].map((label) => ({ label, count: '—' })),
  };
}
function adaptReportJobStats(response) {
  const data = unwrapApiResponseData(response);
  if (!data?.cards || typeof data.cards !== 'object') throw new Error('The job statistics response is missing its cards.');
  const overview = emptyReportOverview();
  overview.dashboardSummary.totalJobs = count(data.cards.totalJobs?.value);
  overview.dashboardSummary.completedJobs = count(data.cards.delivered?.value);
  overview.jobsByStatus[0].count = count(data.tabs?.delivered);
  overview.jobsByStatus[3].count = count(data.tabs?.cancelled);
  const total = overview.dashboardSummary.totalJobs;
  overview.jobsByStatus.forEach((status) => {
    if (status.count != null && total > 0 && status.count <= total) status.pct = reportPercent(status.count / total * 100);
  });
  // Pending/In Progress definitions and disputed/rejected grouping are not defined
  // for this four-category report. Do not normalize a partial donut to 100%.
  return overview;
}
const directoryError = () => ({ error: { status: 'CUSTOM_ERROR', error: 'The entity directory response is missing valid records or complete pagination.' } });
async function readDirectory(baseQuery, url, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, pageCount = 1, expectedTotal = null;
  do {
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return result;
    const data = unwrapApiResponseData(result.data);
    const pagination = data?.pagination;
    if (!Array.isArray(data?.users) || pagination?.page !== page || count(pagination.totalPages) == null || count(pagination.total) == null) return directoryError();
    if (page === 1) { pageCount = Math.max(1, pagination.totalPages); expectedTotal = pagination.total; }
    if (pageCount !== Math.max(1, pagination.totalPages) || expectedTotal !== pagination.total || (page < pageCount && data.users.length === 0)) return directoryError();
    for (const user of data.users) {
      if (typeof user?.id !== 'string' || !user.id.trim() || seen.has(user.id)) return directoryError();
      seen.add(user.id); rows.push(user);
    }
    page += 1;
  } while (page <= pageCount);
  return rows.length === expectedTotal ? { data: rows } : directoryError();
}
export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminReportJobStats: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/jobs/stats', params: { dateFrom, dateTo } }),
      transformResponse: adaptReportJobStats,
      providesTags: ['AdminJobs'],
    }),
    getAdminReportEntities: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const [forwarders, truckers] = await Promise.all([
          readDirectory(baseQuery, '/admin/users/forwarders'),
          readDirectory(baseQuery, '/admin/users/truckers', { truckerType: 'COMPANY' }),
        ]);
        if (forwarders.error || truckers.error) return { error: forwarders.error || truckers.error };
        const rows = [
          ...forwarders.data.filter((user) => ['EXPORTER', 'FORWARDER'].includes(user.type)).map((user) => ({ id: user.id, name: user.name, entityType: user.type === 'EXPORTER' ? 'Exporter' : 'Forwarder' })),
          ...truckers.data.filter((user) => user.truckerType === 'COMPANY').map((user) => ({ id: user.id, name: user.name, entityType: 'Truck Company' })),
        ];
        return { data: rows.filter((row) => typeof row.name === 'string' && row.name.trim()) };
      },
      providesTags: ['AdminForwarders', 'AdminCompanies'],
    }),
  }),
});
export const { useGetAdminReportJobStatsQuery, useGetAdminReportEntitiesQuery } = reportsApi;
