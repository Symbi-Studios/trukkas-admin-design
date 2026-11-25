import { unwrapApiResponseData } from '../../api/baseApi.js';
import { reportsApi, scopedReportQuery } from './reportsApi.js';
import { reportRecord, reportText, reportInteger } from './reportContracts.js';
import { metricDate } from './reportMetrics.js';

// Saved templates, schedules and generated exports: the Reports library.

const list = (value) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : []);
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const date = (value) => (metricDate(value) == null ? null : value);

function adaptTemplate(row) {
  return {
    id: reportText(row.id), name: reportText(row.name) || 'Untitled template',
    configuration: reportRecord(row.configuration), ownerId: reportText(reportRecord(row.owner).id), createdAt: date(row.createdAt),
  };
}
function adaptSchedule(row) {
  return {
    id: reportText(row.id), name: reportText(row.name) || 'Untitled schedule', reportType: reportText(row.reportType),
    status: reportText(row.status), frequency: reportText(row.frequency), runsAt: reportText(row.runsAt),
    recipients: Array.isArray(row.recipients) ? row.recipients.filter((v) => reportText(v)) : [],
    nextRunAt: date(row.nextRunAt), lastRunAt: date(row.lastRunAt), lastError: reportText(row.lastError), createdAt: date(row.createdAt),
  };
}
function adaptExport(row) {
  return {
    id: reportText(row.id), reportId: reportText(row.reportId), reportType: reportText(row.reportType), status: reportText(row.status),
    format: reportText(row.format), filename: reportText(row.filename), contentType: reportText(row.contentType),
    sizeBytes: reportInteger(row.sizeBytes), rowCount: reportInteger(row.rowCount), expiresAt: date(row.expiresAt), createdAt: date(row.createdAt),
    deliveryStatus: reportText(row.deliveryStatus), error: reportText(row.error), scheduleId: reportText(row.scheduleId),
  };
}

export const reportLibraryApi = reportsApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminReportTemplates: builder.query({
      async queryFn(args, api, _options, baseQuery) {
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/templates' });
        if (result.error) return result;
        return { data: list(reportRecord(unwrapApiResponseData(result.data)).templates).map(adaptTemplate).filter((t) => t.id) };
      },
      providesTags: ['AdminReportTemplates'],
    }),
    deleteAdminReportTemplate: builder.mutation({
      async queryFn({ id, ...args }, api, _options, baseQuery) {
        if (!reportText(id)) return failure('Choose a template to delete.');
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/templates/' + encodeURIComponent(id), method: 'DELETE' });
        return result.error ? result : { data: { id } };
      },
      invalidatesTags: ['AdminReportTemplates'],
    }),
    getAdminReportSchedules: builder.query({
      async queryFn(args, api, _options, baseQuery) {
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/schedules' });
        if (result.error) return result;
        return { data: list(reportRecord(unwrapApiResponseData(result.data)).schedules).map(adaptSchedule).filter((s) => s.id) };
      },
      providesTags: ['AdminReportSchedules'],
    }),
    setAdminReportScheduleStatus: builder.mutation({
      async queryFn({ id, status, ...args }, api, _options, baseQuery) {
        if (!reportText(id) || !['ACTIVE', 'PAUSED'].includes(status)) return failure('Choose a schedule to pause or resume.');
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/schedules/' + encodeURIComponent(id) + '/status', method: 'PATCH', body: { status } });
        if (result.error) return result;
        const dto = reportRecord(unwrapApiResponseData(result.data));
        if (dto.status != null && dto.status !== status) return failure('The schedule change could not be confirmed. Refresh before trying again.');
        return { data: { id, status } };
      },
      invalidatesTags: ['AdminReportSchedules'],
    }),
    deleteAdminReportSchedule: builder.mutation({
      async queryFn({ id, ...args }, api, _options, baseQuery) {
        if (!reportText(id)) return failure('Choose a schedule to delete.');
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/schedules/' + encodeURIComponent(id), method: 'DELETE' });
        return result.error ? result : { data: { id } };
      },
      invalidatesTags: ['AdminReportSchedules'],
    }),
    getAdminReportExports: builder.query({
      async queryFn({ page = 1, limit = 10, ...args }, api, _options, baseQuery) {
        const result = await scopedReportQuery(baseQuery, api, args)({ url: '/admin/reports/exports', params: { page, limit } });
        if (result.error) return result;
        const dto = reportRecord(unwrapApiResponseData(result.data)), pagination = reportRecord(dto.pagination);
        return { data: { rows: list(dto.exports).map(adaptExport).filter((e) => e.id), total: reportInteger(pagination.total), totalPages: reportInteger(pagination.totalPages), page: reportInteger(pagination.page) } };
      },
      providesTags: ['AdminReportExports'],
    }),
  }),
});

export const {
  useGetAdminReportTemplatesQuery, useDeleteAdminReportTemplateMutation,
  useGetAdminReportSchedulesQuery, useSetAdminReportScheduleStatusMutation, useDeleteAdminReportScheduleMutation,
  useGetAdminReportExportsQuery,
} = reportLibraryApi;
