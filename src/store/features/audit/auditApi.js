import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const permissionError = () => ({ error: { status: 403, data: { message: 'Only Super Admins can view audit logs.' } } });

const PERIODS = {
  'May 1, 2026 – May 30, 2026': ['2026-05-01', '2026-05-30'],
  'May 24, 2026 – May 30, 2026': ['2026-05-24', '2026-05-30'],
  'May 1, 2026 – May 15, 2026': ['2026-05-01', '2026-05-15'],
};
export function auditPeriod(value) {
  const period = PERIODS[value];
  if (!period) return {};
  return { dateFrom: new Date(`${period[0]}T00:00:00`).toISOString(), dateTo: new Date(`${period[1]}T23:59:59.999`).toISOString() };
}
export const auditTabAvailable = (tab) => ['All Logs', 'User Actions'].includes(tab);
export function auditMatchesPeriod(row, period) {
  return (!period.dateFrom || (row.occurredAt != null && row.occurredAt >= Date.parse(period.dateFrom)))
    && (!period.dateTo || (row.occurredAt != null && row.occurredAt <= Date.parse(period.dateTo)));
}
function relativeTime(timestamp) {
  if (timestamp == null) return '—';
  const seconds = (timestamp - Date.now()) / 1000;
  const [unit, divisor] = Math.abs(seconds) < 60 ? ['second', 1] : Math.abs(seconds) < 3600 ? ['minute', 60]
    : Math.abs(seconds) < 86400 ? ['hour', 3600] : ['day', 86400];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}
function relatedRecord(dto) {
  const id = text(dto.entityId), type = text(dto.entityType);
  if (!id || !type) return null;
  const targets = {
    JOB: { icon: 'package', label: 'Job', path: `/jobs/detail?id=${encodeURIComponent(id)}` },
    TRUCK: { icon: 'truck', label: 'Truck', path: `/fleet/detail?id=${encodeURIComponent(id)}` },
    TRANSACTION: { icon: 'receipt', label: 'Transaction', path: `/transactions/detail?id=${encodeURIComponent(id)}` },
  };
  // Only route to screens that accept the entity's real backend ID. A document
  // needs its job ID, and admin/customer profile IDs are different namespaces.
  const target = targets[type] || { icon: 'file-text', label: label(type), path: null };
  return [{ ...target, key: `${type}:${id}`, id, type, value: text(dto.entityLabel) || id }];
}
export function adaptAdminAudit(dto) {
  const actor = record(dto.admin);
  const actorId = text(dto.adminId) || text(actor.id);
  const admin = text(dto.adminId) && text(actor.id) && dto.adminId !== actor.id ? {} : actor;
  const createdAt = text(dto.createdAt);
  const timestamp = createdAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) ? Date.parse(createdAt) : NaN;
  const occurredAt = Number.isFinite(timestamp) ? timestamp : null;
  const date = occurredAt == null ? null : new Date(occurredAt);
  const status = { SUCCESS: 'Success', FAILED: 'Failed' }[dto.result] || '—';
  const modules = { JOB: 'Jobs', USER: 'Users', TRUCK: 'Fleet', DOCUMENT: 'Documents', CONFIG: 'Configuration', ADMIN: 'Administration', TRANSACTION: 'Transactions' };
  return {
    id: text(dto.id), occurredAt,
    date: date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    time: date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—', relative: relativeTime(occurredAt),
    actorId, isUserAction: Boolean(actorId),
    user: text(admin.name) || '—', email: text(admin.email) || '—', role: label(admin.role),
    // The API action is free text. Do not guess action codes, login/security
    // categories or system actors by parsing sentences or missing admin fields.
    action: text(dto.action) || '—', module: modules[dto.entityType] || label(dto.entityType),
    description: text(dto.note) || text(dto.action) || '—', reference: text(dto.entityId) || '—', status,
    ip: '—', device: '—', location: '—', userAgent: '—', sessionId: '—', before: null, after: null,
    icon: status === 'Success' ? 'circle-check' : status === 'Failed' ? 'circle-x' : 'scroll-text',
    tone: status === 'Success' ? 'success' : status === 'Failed' ? 'danger' : 'neutral',
    related: relatedRecord(dto),
  };
}
function readPage(response, requestedPage) {
  const dto = record(unwrapApiResponseData(response)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.logs) || pagination.page !== requestedPage || !Number.isSafeInteger(pagination.total) || pagination.total < 0
    || !Number.isSafeInteger(pagination.totalPages) || pagination.totalPages < 0 || (pagination.total > 0 && pagination.totalPages === 0)) {
    return failure('The audit API response is missing the logs or pagination needed to load all records.');
  }
  const ids = dto.logs.map((row) => text(row?.id));
  if (dto.logs.length > pagination.total || (pagination.total === 0 && pagination.totalPages > 1)
    || requestedPage > Math.max(1, pagination.totalPages)) return failure('The audit API returned inconsistent pagination.');
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return failure('The audit API returned missing or duplicate audit IDs.');
  return { data: { rows: dto.logs.map(adaptAdminAudit), total: pagination.total, totalPages: Math.max(1, pagination.totalPages) } };
}
async function readAuditDirectory(baseQuery, params) {
  const rows = [], seen = new Set();
  let page = 1, total = null, totalPages = 1;
  do {
    const result = await baseQuery({ url: '/admin/audit-logs', params: { ...params, page, limit: 100 } });
    if (result.error) return result;
    const parsed = readPage(result.data, page);
    if (parsed.error) return parsed;
    const data = parsed.data;
    if (total != null && (data.total !== total || data.totalPages !== totalPages)) return failure('The audit log collection changed while loading. Refresh before filtering or exporting.');
    total = data.total; totalPages = data.totalPages;
    if (page < totalPages && !data.rows.length) return failure('The audit API returned an empty page before the end of the log collection.');
    for (const row of data.rows) {
      if (seen.has(row.id)) return failure('The audit API repeated a record across pages. Refresh before filtering or exporting.');
      seen.add(row.id); rows.push(row);
    }
    page += 1;
  } while (page <= totalPages);
  if (rows.length !== total) return failure('The audit API did not return the complete log collection.');
  return { data: { rows, total } };
}
export function auditCsv(rows) {
  const values = [['Date & Time', 'User', 'Action', 'Module', 'Description', 'Reference', 'Status'],
    ...rows.map((row) => [`${row.date} ${row.time}`, row.user, row.action, row.module, row.description, row.reference, row.status])];
  return values.map((row) => row.map((value) => {
    let cell = String(value ?? '—');
    // Quoting CSV does not prevent spreadsheet formula execution.
    if (/^[\t\r\n]|^\s*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
}
export const auditApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminAuditDirectory: builder.query({
      queryFn(params = {}, api, _options, baseQuery) {
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        return readAuditDirectory(baseQuery, { ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}), ...(params.dateTo ? { dateTo: params.dateTo } : {}) });
      }, providesTags: ['AdminAuditLogs'],
    }),
    getAdminAuditScreenSummary: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        const results = await Promise.all([{}, { result: 'FAILED' }].map((params) => baseQuery({ url: '/admin/audit-logs', params: { ...params, page: 1, limit: 1 } })));
        const counts = results.map((result, index) => {
          if (result.error) return null;
          const parsed = readPage(result.data, 1);
          if (parsed.error || (parsed.data.total > 0 && !parsed.data.rows.length)) return null;
          if (index === 1 && parsed.data.rows.some((row) => row.status !== 'Failed')) return null;
          return parsed.data.total;
        });
        return { data: { totalLogs: counts[0], failedActions: counts[1], activeUsers: null, securityEvents: null, delta: null } };
      }, providesTags: ['AdminAuditLogs'],
    }),
  }),
});
export const { useGetAdminAuditDirectoryQuery, useGetAdminAuditScreenSummaryQuery } = auditApi;
