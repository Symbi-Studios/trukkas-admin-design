import { defaultSerializeQueryArgs } from '@reduxjs/toolkit/query';
import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptReportPreview, adaptReportExport, reportText, reportRecord, reportInteger, validReportEmails, adaptReportMeta, confirmReportTemplate } from './reportContracts.js';
import { adaptReportOverview } from './reportOverviewAdapter.js';

export const REPORT_CAPABILITIES = Object.freeze({ preview: true, export: true, templates: true, schedule: true });
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
async function readDirectory(baseQuery, url, params = {}, api) {
  const owner = api.getState().auth.admin?.id;
  const rows = [], seen = new Set();
  let page = 1, pageCount = 1, expectedTotal = null;
  do {
    if (page > 500 || api.signal.aborted || api.getState().auth.admin?.id !== owner) return directoryError();
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (api.getState().auth.admin?.id !== owner) return directoryError();
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
const reportFailure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const serializeReportQuery = args => defaultSerializeQueryArgs(args) + ':v2';
function scopedReportQuery(baseQuery, api, args = {}) {
  const auth = api.getState().auth, owner = auth.admin?.id, role = auth.admin?.role;
  const current = () => {
    const next = api.getState().auth;
    return !api.signal.aborted && Boolean(next.accessToken && owner) && next.admin?.id === owner && next.admin?.role === role && (args.owner == null || args.owner === owner) && (args.role == null || args.role === role);
  };
  return async request => {
    if (!current()) return reportFailure('Your session changed. Reopen Reports before continuing.');
    const result = await baseQuery(request);
    return current() ? result : reportFailure('Your session changed. Reopen Reports before continuing.');
  };
}
const reportTags = ['AdminReportOverview', 'AdminReportTemplates', 'AdminReportSchedules'];
export const reportsApi = baseApi.enhanceEndpoints({ addTagTypes: reportTags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminReportOverview: builder.query({
      serializeQueryArgs: serializeReportQuery,
      async queryFn(args, api, _options, baseQuery) {
        const params = Object.fromEntries(['dateFrom', 'dateTo', 'compareFrom', 'compareTo', 'groupBy', 'metric', 'entityType', 'entityId', 'sortBy'].filter(key => args[key] != null).map(key => [key, args[key]]));
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/overview', params });
        return result.error ? result : { data: adaptReportOverview(unwrapApiResponseData(result.data), emptyReportOverview(), args.metric) };
      },
      providesTags: ['AdminReportOverview'],
    }),
    getAdminReportMeta: builder.query({
      serializeQueryArgs: serializeReportQuery,
      async queryFn(args, api, _options, baseQuery) {
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/meta' });
        if (result.error) return result;
        try { return { data: adaptReportMeta(unwrapApiResponseData(result.data)) }; }
        catch (error) { return reportFailure(error.message); }
      },
    }),
    previewAdminReport: builder.query({
      serializeQueryArgs: serializeReportQuery,
      async queryFn(args, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, args);
        if (args.owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return reportFailure('Sign in to preview a report.');
        if (args.configuration.reportType === 'audit' && api.getState().auth.admin?.role !== 'SUPER_ADMIN') return reportFailure('Audit reports require Super Admin access.');
        if (!args.metadata?.reportTypes?.includes(args.configuration.reportType) || !args.metadata.formats?.includes(args.configuration.format) || args.configuration.columns.some(key => !args.metadata.columns?.includes(key))) return reportFailure('The selected report configuration is not supported by the current metadata.');
        const result = await baseQuery({ url: '/admin/reports/preview', method: 'POST', body: { ...args.configuration, page: args.page, limit: args.limit } });
        if (result.error) return result;
        if (args.owner !== api.getState().auth.admin?.id || api.signal.aborted) return reportFailure('Your session changed. Reload before previewing.');
        try { return { data: adaptReportPreview(unwrapApiResponseData(result.data), args, unavailableReportPreview) }; }
        catch (error) { return reportFailure(error.message); }
      },
    }),
    createAdminReportExport: builder.mutation({
      async queryFn({ configuration, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return reportFailure('Your session changed. Reload before exporting.');
        if (configuration.reportType === 'audit' && api.getState().auth.admin?.role !== 'SUPER_ADMIN') return reportFailure('Audit reports require Super Admin access.');
        const result = await baseQuery({ url: '/admin/reports/exports', method: 'POST', body: { configuration } });
        if (result.error) return result;
        try { return { data: adaptReportExport(unwrapApiResponseData(result.data), configuration) }; }
        catch (error) { return reportFailure('The export was submitted, but its result could not be confirmed. ' + error.message); }
      },
    }),
    saveAdminReportTemplate: builder.mutation({
      async queryFn({ name, configuration, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken || !reportText(name)) return reportFailure('Sign in and enter a template name.');
        if (configuration.reportType === 'audit' && api.getState().auth.admin?.role !== 'SUPER_ADMIN') return reportFailure('Audit reports require Super Admin access.');
        const result = await baseQuery({ url: '/admin/reports/templates', method: 'POST', body: { name: name.trim(), configuration } });
        if (result.error) return result;
        try { return { data: confirmReportTemplate(unwrapApiResponseData(result.data), { name, configuration, owner }) }; }
        catch (error) { return reportFailure(error.message); }
      }, invalidatesTags: ['AdminReportTemplates'],
    }),
    scheduleAdminReport: builder.mutation({
      async queryFn({ name, reportType, frequency, recipients, configuration, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return reportFailure('Your session changed. Reload before scheduling.');
        if (reportType === 'audit' && api.getState().auth.admin?.role !== 'SUPER_ADMIN') return reportFailure('Audit reports require Super Admin access.');
        if (!reportText(name) || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency) || !validReportEmails(recipients)) return reportFailure('Choose a supported frequency and valid email recipients.');
        const result = await baseQuery({ url: '/admin/reports/schedules', method: 'POST', body: { name, reportType, frequency, recipients, timezone: 'Africa/Lagos', configuration } });
        if (result.error) return result;
        const dto = reportRecord(unwrapApiResponseData(result.data));
        if (!reportText(dto.id) || dto.status !== 'ACTIVE' || dto.reportType !== reportType || dto.frequency !== frequency || dto.timezone !== 'Africa/Lagos' || !Array.isArray(dto.recipients) || recipients.some((email) => !dto.recipients.includes(email))) return reportFailure('The schedule was submitted, but its result could not be confirmed. Refresh before retrying.');
        return { data: { id: dto.id, status: dto.status, nextRunAt: reportText(dto.nextRunAt), runsAt: reportText(dto.runsAt) } };
      }, invalidatesTags: ['AdminReportSchedules'],
    }),
    downloadAdminReportExport: builder.query({
      serializeQueryArgs: serializeReportQuery,
      async queryFn({ file, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken || !reportText(file?.id) || file.status !== 'COMPLETED') return reportFailure('A completed report export is required.');
        const result = await baseQuery({ url: '/admin/reports/exports/' + encodeURIComponent(file.id) + '/download', responseHandler: async (response) => {
          if (response.ok) return response.blob();
          try { return JSON.parse(await response.text()); } catch { return { message: 'Unable to download the report. It may have expired.' }; }
        } });
        if (result.error) return result;
        if (!(result.data instanceof Blob) || !result.data.size) return reportFailure('The backend returned no report file.');
        const bytes = new Uint8Array(await result.data.arrayBuffer()), zip = file.contentType?.includes('zip') || file.filename?.toLowerCase().endsWith('.zip');
        const signature = String.fromCharCode(...bytes.slice(0, 5)), isZip = bytes[0] === 80 && bytes[1] === 75 && [[3,4],[5,6],[7,8]].some(([a,b]) => bytes[2] === a && bytes[3] === b);
        if ((zip || file.format === 'XLSX') && !isZip || !zip && file.format === 'PDF' && signature !== '%PDF-') return reportFailure('The backend returned an unexpected report file.');
        if (!zip && ['CSV', 'JSON'].includes(file.format)) {
          const content = new TextDecoder().decode(bytes).trimStart();
          if (file.format === 'JSON') { try { JSON.parse(content); } catch { return reportFailure('The backend did not return valid JSON.'); } }
          else if (!content || /^(?:[\[{]|<(?:!doctype|html))/i.test(content) || result.data.type.includes('json') || result.data.type.includes('html')) return reportFailure('The backend did not return valid CSV.');
        }
        let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return { data: { content: btoa(binary), filename: reportText(file.filename), contentType: reportText(file.contentType) || result.data.type } };
      },
    }),

    getAdminReportJobStats: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/jobs/stats', params: { dateFrom, dateTo } }),
      transformResponse: adaptReportJobStats,
      providesTags: ['AdminJobs'],
    }),
    getAdminReportEntities: builder.query({
      serializeQueryArgs: serializeReportQuery,
      async queryFn(args, api, _options, baseQuery) {
        baseQuery = scopedReportQuery(baseQuery, api, args);
        if (args?.owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return directoryError();
        const [forwarders, truckers] = await Promise.all([
          readDirectory(baseQuery, '/admin/users/forwarders', {}, api),
          readDirectory(baseQuery, '/admin/users/truckers', { truckerType: 'COMPANY' }, api),
        ]);
        if (forwarders.error || truckers.error) return { error: forwarders.error || truckers.error };
        const rows = [
          ...forwarders.data.filter((user) => ['EXPORTER', 'FORWARDER'].includes(user.type)).map((user) => ({ id: user.id, name: user.name, entityType: user.type === 'EXPORTER' ? 'Exporter' : 'Forwarder' })),
          ...truckers.data.filter((user) => user.truckerType === 'COMPANY').map((user) => ({ id: user.id, name: user.name, entityType: 'Truck Company' })),
        ];
        return { data: rows.map((row) => ({ ...row, name: reportText(row.name) || '—' })) };
      },
      providesTags: ['AdminForwarders', 'AdminCompanies'],
    }),
  }),
});
export const { useGetAdminReportJobStatsQuery, useGetAdminReportEntitiesQuery, useGetAdminReportOverviewQuery, useGetAdminReportMetaQuery, usePreviewAdminReportQuery, useCreateAdminReportExportMutation, useSaveAdminReportTemplateMutation, useScheduleAdminReportMutation, useLazyDownloadAdminReportExportQuery } = reportsApi;
export function saveReportFile(file) {
  if (!reportText(file.filename)) throw new Error('The backend did not supply a report filename.');
  const bytes = Uint8Array.from(atob(file.content), (c) => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: file.contentType || 'application/octet-stream' }));
  const link = document.createElement('a'); link.href = url; link.download = file.filename.split(/[\\/]/).pop(); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
