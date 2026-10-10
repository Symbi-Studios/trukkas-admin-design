import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const path = '/admin/maintenance';
const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const number = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const integer = (v) => Number.isSafeInteger(v) && v >= 0 ? v : null;
const percent = (v) => number(v) != null && v <= 100 ? v : null;
const bool = (v) => typeof v === 'boolean' ? v : null;
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const types = { PREVENTIVE: 'Preventive', REPAIR: 'Repair', INSPECTION: 'Inspection', BREAKDOWN: 'Breakdown' };
const statuses = { REQUESTED: 'Requested', SCHEDULED: 'Scheduled', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', OVERDUE: 'Overdue', CANCELLED: 'Cancelled', REJECTED: 'Rejected' };
export const maintenanceTabs = { 'All Maintenance': 'all', Scheduled: 'scheduled', 'In Progress': 'inProgress', Completed: 'completed', Overdue: 'overdue', Cancelled: 'cancelled' };
export const maintenanceHref = (id) => `/maintenance/detail?id=${encodeURIComponent(id)}`;
export function maintenanceError(error) {
  if (error?.status === 403) return 'Your account cannot perform this maintenance operation.';
  if (error?.status === 401) return 'Please sign in again.';
  const message = error?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || 'The maintenance request could not be completed.';
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || !Number.isFinite(Date.parse(value))) return null;
  if (value.includes('T')) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59) return null;
  }
  return value;
}
export function maintenanceDate(value) {
  const parsed = dateValue(value);
  return parsed ? new Date(parsed).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}
export function maintenanceWindow(days = 7) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return { dateFrom: `${today}T00:00:00+01:00`, dateTo: `${end.toISOString().slice(0, 10)}T23:59:59.999+01:00` };
}
function mapRecord(dto) {
  if (!text(dto?.id)) throw new Error('Maintenance response is missing a record ID.');
  const days = Number.isSafeInteger(dto.daysUntilDue) ? dto.daysUntilDue : null;
  return {
    id: dto.id, reference: text(dto.reference) || '—', truckId: text(dto.truck?.id),
    company: text(dto.company?.name) || '—', plate: text(dto.truck?.plateNumber) || '—', truckType: text(dto.truck?.label) || '—',
    type: types[dto.type] || '—', status: statuses[dto.displayStatus ?? dto.status] || '—', statusCode: text(dto.status),
    description: text(dto.description) || '—', serviceCenter: text(dto.serviceCenter?.name) || '—', location: text(dto.serviceCenter?.location) || '—',
    dueDate: maintenanceDate(dto.dueDate), dueAt: dateValue(dto.dueDate), created: maintenanceDate(dto.createdAt),
    recordDate: maintenanceDate(dto.status === 'COMPLETED' ? dto.completedAt : dto.status === 'IN_PROGRESS' ? dto.startedAt : dto.status === 'CANCELLED' ? dto.cancelledAt : dto.dueDate),
    completedAt: dateValue(dto.completedAt), odometer: number(dto.odometerKm), estimatedCost: number(dto.estimatedCost), actualCost: number(dto.actualCost),
    dueLabel: days == null ? '—' : days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `In ${days} days`,
    daysUntilDue: days, priority: '—', notes: text(dto.notes) || '—',
    assetStatus: dto.truck?.status === 'MAINTENANCE' ? 'In Maintenance' : statuses[dto.truck?.status] || (dto.truck?.status === 'ACTIVE' ? 'Active' : '—'),
    makeModel: '—', year: '—', vin: '—', truckRef: text(dto.truck?.id) || '—', assetLocation: '—',
    currentOdometer: null, nextDueOdometer: null, nextDueDate: '—', nextDueDays: null, lastUpdated: '—',
    attachments: null, checklist: null, fitForRoad: null, maintenanceCompliant: null, noOpenIssues: null,
    eligibleForJobs: dto.truckEligibility?.id === dto.truck?.id ? bool(dto.truckEligibility?.eligibleForJobs) : null,
  };
}
function mapList(response, args) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.maintenance)) throw new Error('The maintenance response is missing its collection.');
  const rows = data.maintenance.map(mapRecord);
  const p = data.pagination || {};
  const page = integer(p.page), limit = integer(p.limit), total = integer(p.total), totalPages = integer(p.totalPages);
  if (!page || !limit || total == null || totalPages == null || page !== (args.page ?? 1) || rows.length > limit || rows.length > total || new Set(rows.map(r => r.id)).size !== rows.length
    || totalPages !== Math.ceil(total / limit) && !(total === 0 && totalPages === 1) || page > Math.max(1, totalPages) || total > 0 && !rows.length) throw new Error('The maintenance response has invalid pagination.');
  return { rows, pagination: { page, limit, total, totalPages } };
}
function params(args = {}) {
  return Object.fromEntries(Object.entries(args).filter(([key, value]) => ['tab', 'search', 'type', 'severity', 'companyId', 'truckId', 'dateFrom', 'dateTo', 'page', 'limit'].includes(key) && value !== '' && value != null));
}
function mapStats(response) {
  const dto = unwrapApiResponseData(response) || {};
  const cards = dto.cards || {};
  const metric = (v) => integer(v?.value);
  const segment = (key) => {
    const s = dto.overview?.segments?.find?.(s => s.key === key);
    return { count: integer(s?.count), percent: percent(s?.percent) };
  };
  const eligibility = (key) => ({ count: integer(dto.assetEligibility?.[key]?.count), percent: percent(dto.assetEligibility?.[key]?.percent) });
  return {
    totalTrucks: metric(cards.totalTrucks), inMaintenance: metric(cards.inMaintenance), inMaintenancePercent: percent(cards.inMaintenance?.percentOfFleet),
    // Container type is not a truck/trailer classification.
    trucksCaption: '— Trucks · — Trailers · — Others',
    dueSoon: cards.dueSoon?.withinDays === 7 ? metric(cards.dueSoon) : null,
    overdue: metric(cards.overdue), restrictedAssets: metric(cards.restrictedAssets), pendingApprovals: metric(cards.pendingApprovals),
    overview: ['scheduled', 'inProgress', 'completed', 'overdue'].map(segment),
    eligibility: ['eligible', 'underMaintenance', 'pendingInspection', 'restricted'].map(eligibility),
    byType: Object.keys(types).map(type => percent(dto.byType?.find?.(item => item.type === type)?.percent)),
    approvals: { total: integer(dto.approvals?.total), repair: integer(dto.approvals?.repairRequests), preventive: integer(dto.approvals?.preventiveRequests), major: integer(dto.approvals?.majorRepairRequests) },
  };
}

const taggedApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminMaintenance'] });
export const maintenanceApi = taggedApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminMaintenance: builder.query({
      query: (args = {}) => ({ url: path, params: params(args) }),
      transformResponse: (response, _meta, args = {}) => mapList(response, args),
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceStats: builder.query({ query: () => `${path}/stats`, transformResponse: mapStats, providesTags: ['AdminMaintenance'] }),
    getAdminMaintenanceAsset: builder.query({
      query: ({ truckId }) => `/admin/doc-review/trucks/${encodeURIComponent(truckId)}`,
      transformResponse: (response, _meta, { truckId }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.id !== truckId) throw new Error('The maintenance asset response returned a different truck.');
        const open = integer(dto.maintenance?.open);
        return { makeModel: [text(dto.make), text(dto.model)].filter(Boolean).join(' ') || '—', year: text(dto.year) ?? integer(dto.year) ?? '—', vin: text(dto.vin) || '—', noOpenIssues: open == null ? null : open === 0 };
      },
      providesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    getAdminMaintenanceDetail: builder.query({
      query: ({ id }) => `${path}/${encodeURIComponent(id)}`,
      transformResponse: (response, _meta, { id }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.id !== id) throw new Error('The maintenance API returned a different record.');
        return mapRecord(dto);
      },
      providesTags: ['AdminMaintenance'],
    }),
    getAdminMaintenanceTruckRecords: builder.query({
      async queryFn({ truckId }, _api, _options, fetch) {
        const rows = [], seen = new Set();
        let expectedTotal = null;
        try {
          for (let page = 1; page <= 500; page++) {
            const args = { truckId, tab: 'all', page, limit: 100 };
            const response = await fetch({ url: path, params: args });
            if (response.error) return response;
            const data = mapList(response.data, args);
            if (expectedTotal != null && expectedTotal !== data.pagination.total) return failure('Maintenance records changed while loading. Please try again.');
            expectedTotal = data.pagination.total;
            for (const row of data.rows) {
              if (row.truckId !== truckId || seen.has(row.id)) return failure('The truck maintenance history is incomplete or inconsistent.');
              seen.add(row.id); rows.push(row);
            }
            if (page >= data.pagination.totalPages) {
              if (rows.length !== expectedTotal) return failure('The truck maintenance history is incomplete.');
              const upcoming = rows.filter(r => r.status === 'Scheduled' && r.dueAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
              const last = rows.filter(r => r.statusCode === 'COMPLETED' && r.completedAt).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
              return { data: {
                history: rows.map((r, i) => ({ id: r.id, n: i + 1, date: r.recordDate, odometer: r.odometer, serviceType: r.type, description: r.description, serviceCenter: r.serviceCenter, status: r.status })),
                upcoming: upcoming.map(r => ({ title: r.description, type: r.type, dueDate: r.dueDate, dueOdometer: null })),
                nextDueDate: upcoming[0]?.dueDate || '—', nextDueDays: upcoming[0]?.daysUntilDue ?? null,
                last: { date: last?.recordDate || '—', odometer: last?.odometer ?? null, serviceType: last?.type || '—' },
              } };
            }
          }
          return failure('The truck maintenance history exceeded the supported page limit.');
        } catch (error) { return failure(error.message); }
      },
      providesTags: ['AdminMaintenance'],
    }),
    exportAdminMaintenance: builder.query({
      query: (args = {}) => ({ url: `${path}/export`, params: Object.fromEntries(Object.entries(params(args)).filter(([key]) => !['page', 'limit'].includes(key))), responseHandler: 'text' }),
      transformResponse: (response) => {
        if (typeof response !== 'string' || !response.trim() || /^\s*[<{]/.test(response)) throw new Error('The maintenance export did not return CSV.');
        return response;
      },
    }),
    importAdminMaintenance: builder.mutation({
      query: (file) => { const body = new FormData(); body.append('file', file); return { url: `${path}/import`, method: 'POST', body }; },
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response);
        if (integer(data?.created) == null || integer(data?.failed) == null || !Array.isArray(data?.results) || data.results.length !== data.created + data.failed || data.results.filter(r => r.status === 'CREATED').length !== data.created || data.results.filter(r => r.status === 'FAILED').length !== data.failed) throw new Error('The import response did not confirm its results. Check the maintenance list before importing again.');
        return { created: data.created, failed: data.failed, errors: data.results.filter(r => r.status === 'FAILED').map(r => `Line ${r.line}: ${text(r.error) || 'Import failed'}`) };
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    updateAdminMaintenanceStatus: builder.mutation({
      async queryFn({ id, action }, _api, _options, fetch) {
        const expected = { start: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED' }[action];
        if (!text(id) || !expected) return failure('Unsupported maintenance action.');
        const result = await fetch({ url: `${path}/${encodeURIComponent(id)}/${action}`, method: 'POST' });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/${encodeURIComponent(id)}`);
        if (confirmation.error) return failure('The update was accepted, but its final state could not be confirmed. Refresh before trying again.');
        const data = unwrapApiResponseData(confirmation.data);
        if (data?.id !== id || data.status !== expected) return failure('The updated maintenance status could not be confirmed. Refresh before trying again.');
        try { return { data: mapRecord(data) }; } catch (error) { return failure(error.message); }
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
    restrictAdminMaintenanceTruck: builder.mutation({
      async queryFn({ truckId, reference }, _api, _options, fetch) {
        if (!text(truckId)) return failure('The maintenance record does not contain a truck ID.');
        const result = await fetch({ url: `${path}/trucks/${encodeURIComponent(truckId)}/restrict`, method: 'POST', body: { reason: `Suspend Asset requested from maintenance record ${reference}.` } });
        if (result.error) return result;
        const confirmation = await fetch(`${path}/trucks/${encodeURIComponent(truckId)}/eligibility`);
        const data = unwrapApiResponseData(confirmation.data);
        if (confirmation.error || data?.id !== truckId || data.eligibleForJobs !== false || !dateValue(data.restrictedAt)) return failure('The restriction was accepted, but could not be confirmed. Refresh before trying again.');
        return { data: { restricted: true } };
      },
      invalidatesTags: ['AdminMaintenance', 'AdminFleet'],
    }),
  }),
});
export const { useGetAdminMaintenanceQuery, useGetAdminMaintenanceStatsQuery, useGetAdminMaintenanceAssetQuery, useGetAdminMaintenanceDetailQuery, useGetAdminMaintenanceTruckRecordsQuery, useLazyExportAdminMaintenanceQuery, useImportAdminMaintenanceMutation, useUpdateAdminMaintenanceStatusMutation, useRestrictAdminMaintenanceTruckMutation } = maintenanceApi;
