import { defaultSerializeQueryArgs } from '@reduxjs/toolkit/query';
import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const permissionError = () => ({ error: { status: 403, data: { message: 'Only Super Admins can view audit logs.' } } });
const CATEGORIES = new Set(['SECURITY', 'DATA_CHANGE', 'FINANCIAL', 'COMPLIANCE', 'OPERATIONS', 'COMMUNICATION']);
export const AUDIT_DATE_OPTIONS = ['This Month', 'Last 7 Days', 'Last 30 Days', 'All Time'];
export function auditPeriod(value, now = new Date()) {
  if (value === 'All Time') return {};
  if (!AUDIT_DATE_OPTIONS.includes(value) || Number.isNaN(now.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  const dateTo = part('year') + '-' + part('month') + '-' + part('day');
  const start = new Date(dateTo + 'T12:00:00.000Z');
  start.setUTCDate(start.getUTCDate() - (value === 'Last 30 Days' ? 29 : 6));
  return { dateFrom: value === 'This Month' ? dateTo.slice(0, 8) + '01' : start.toISOString().slice(0, 10), dateTo };
}
const serializeAuditQuery = args => defaultSerializeQueryArgs(args) + ':v4';
function scopedAuditQuery(baseQuery, api, args = {}) {
  const auth = api.getState().auth, owner = auth.admin?.id, role = auth.admin?.role;
  const current = () => {
    const next = api.getState().auth;
    return !api.signal.aborted && Boolean(next.accessToken && owner) && role === 'SUPER_ADMIN' && next.admin?.id === owner && next.admin?.role === role && (args.owner == null || args.owner === owner) && (args.role == null || args.role === role);
  };
  return async request => {
    if (!current()) return permissionError();
    const result = await baseQuery(request);
    return current() ? result : failure('Your session changed. Reopen Audit Logs before continuing.');
  };
}
export function auditTabAvailable(tab, rows = []) {
  if (!['All Logs', 'User Actions', 'System Events', 'Data Changes', 'Security Events', 'Login History'].includes(tab)) return false;
  if (['Data Changes', 'Security Events', 'Login History'].includes(tab) && rows.some((row) => row.categories == null)) return false;
  if (tab === 'Login History' && rows.some((row) => row.categories?.includes('SECURITY') && row.moduleCode == null)) return false;
  return true;
}
export function auditMatchesTab(row, tab) {
  if (tab === 'All Logs') return true;
  if (tab === 'System Events') return row.isSystemEvent === true;
  if (tab === 'User Actions') return row.isUserAction;
  if (tab === 'Data Changes') return row.categories?.includes('DATA_CHANGE');
  if (tab === 'Security Events') return row.categories?.includes('SECURITY');
  if (tab === 'Login History') return row.categories?.includes('SECURITY') && row.moduleCode === 'AUTH';
  return false;
}
export function auditMatchesPeriod(row, period) {
  const from = period.dateFrom && Date.parse(`${period.dateFrom}T00:00:00+01:00`);
  const to = period.dateTo && Date.parse(`${period.dateTo}T23:59:59.999+01:00`);
  return (!period.dateFrom || (row.occurredAt != null && row.occurredAt >= from))
    && (!period.dateTo || (row.occurredAt != null && row.occurredAt <= to));
}
function timestamp(value) {
  const source = text(value);
  const parts = source?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts || Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6]) > 59) return null;
  const calendar = new Date(`${parts[1]}-${parts[2]}-${parts[3]}T00:00:00Z`);
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) && calendar.getUTCFullYear() === Number(parts[1])
    && calendar.getUTCMonth() + 1 === Number(parts[2]) && calendar.getUTCDate() === Number(parts[3]) ? parsed : null;
}
function relativeTime(at) {
  if (at == null) return '—';
  const seconds = (at - Date.now()) / 1000;
  const [unit, divisor] = Math.abs(seconds) < 60 ? ['second', 1] : Math.abs(seconds) < 3600 ? ['minute', 60]
    : Math.abs(seconds) < 86400 ? ['hour', 3600] : ['day', 86400];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}
function changeLines(value) {
  if (value == null) return null;
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return typeof serialized === 'string' ? serialized.split('\n') : null;
  } catch { return null; }
}
function relatedRecord(dto, index = 0) {
  const id = text(dto.id), type = text(dto.entityType), context = record(dto.context);
  if (!id || !type) return null;
  const encoded = encodeURIComponent(id);
  const targets = {
    JOB: { icon: 'package', label: 'Job', path: `/jobs/detail?id=${encoded}` },
    TRUCK: { icon: 'truck', label: 'Truck', path: `/fleet/detail?id=${encoded}` },
    TRANSACTION: { icon: 'receipt', label: 'Transaction', path: `/transactions/detail?id=${encoded}` },
    SETTLEMENT: { icon: 'coins', label: 'Settlement', path: `/settlements/detail?id=${encoded}` },
    USER: { icon: 'user', label: 'User', path: `/users/detail?id=${encoded}` },
    ADMIN: { icon: 'user', label: 'Admin', path: `/users/detail?id=${encoded}&source=admin` },
    DRIVER: { icon: 'user', label: 'Driver', path: `/drivers/detail?id=${encoded}` },
    COMPANY: { icon: 'building-2', label: 'Company', path: `/companies/detail?id=${encoded}` },
    FORWARDER: { icon: 'user', label: 'Forwarder', path: `/forwarders/detail?id=${encoded}` },
    ANNOUNCEMENT: { icon: 'file-text', label: 'Announcement', path: `/announcements/detail?announcementId=${encoded}` },
    MAINTENANCE: { icon: 'file-text', label: 'Maintenance', path: `/maintenance/detail?id=${encoded}` },
  };
  let target = targets[type];
  if (type === 'DOCUMENT' && text(context.jobId)) {
    target = { icon: 'file-text', label: 'Document', path: `/documents/detail?jobId=${encodeURIComponent(context.jobId)}&documentId=${encoded}` };
  }
  if (['PAYOUT', 'TRANSACTION'].includes(type) && ['user_withdrawal', 'admin_payout'].includes(context.payoutSource)
    && (type === 'PAYOUT' || context.payoutSource === 'user_withdrawal' || text(context.payoutLogId))) {
    const payoutId = context.payoutSource === 'admin_payout' ? text(context.payoutLogId) || id : id;
    target = { icon: 'receipt', label: 'Payout', path: `/payouts/detail?id=${encodeURIComponent(payoutId)}&source=${context.payoutSource}` };
  }
  // Admin actors use the admin profile source; documents need their job context.
  target ||= { icon: 'file-text', label: label(type), path: null };
  return { ...target, key: `${type}:${id}:${index}`, id, type, value: text(dto.label) || id };
}
export function adaptAdminAudit(source, { detail = false } = {}) {
  const dto = record(source), actor = record(dto.admin);
  const actorConflict = text(dto.adminId) && text(actor.id) && dto.adminId !== actor.id;
  const actorId = actorConflict ? null : text(dto.adminId) || text(actor.id);
  const admin = actorConflict ? {} : actor;
  const occurredAt = timestamp(dto.createdAt), date = occurredAt == null ? null : new Date(occurredAt);
  const status = { SUCCESS: 'Success', FAILED: 'Failed' }[dto.result] || '—';
  const categoriesKnown = Array.isArray(dto.categories) && dto.categories.every((item) => CATEGORIES.has(item));
  const categories = new Set(categoriesKnown ? dto.categories : []);
  if (CATEGORIES.has(dto.category)) categories.add(dto.category);
  const primary = relatedRecord({ id: dto.entityId, entityType: dto.entityType, label: dto.entityLabel });
  const validRelated = Array.isArray(dto.relatedRecords) && dto.relatedRecords.every((item) => text(item?.id) && text(item?.entityType));
  return {
    id: text(dto.id), occurredAt,
    date: date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' }) : '—',
    time: date ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '—', relative: relativeTime(occurredAt),
    actorId, actorPath: actorId ? `/users/detail?id=${encodeURIComponent(actorId)}&source=admin` : null,
    isUserAction: dto.actorType === 'ADMIN' || Boolean(actorId), categories: (dto.categories == null ? CATEGORIES.has(dto.category) : categoriesKnown) ? [...categories] : null,
    user: text(admin.name) || '—', email: text(admin.email) || text(dto.actorEmail) || '—', role: label(admin.role),
    action: text(dto.action) || '—', actionCode: text(dto.actionCode) || '—', moduleCode: text(dto.module), module: label(dto.module),
    description: text(dto.description) || text(dto.note) || text(dto.action) || '—', reference: text(dto.entityLabel) || text(dto.entityId) || '—', status,
    ip: text(dto.ipAddress) || '—', device: text(dto.device) || '—', location: text(dto.location) || '—',
    userAgent: text(dto.userAgent) || '—', sessionId: text(dto.sessionId) || '—', before: changeLines(dto.before), after: changeLines(dto.after),
    icon: status === 'Success' ? 'circle-check' : status === 'Failed' ? 'circle-x' : 'scroll-text',
    tone: status === 'Success' ? 'success' : status === 'Failed' ? 'danger' : 'neutral',
    related: detail ? validRelated ? dto.relatedRecords.map(relatedRecord) : null : primary ? [primary] : null,
  };
}
export function adaptSystemEvent(source) {
  const dto = record(source);
  const row = adaptAdminAudit({ id: dto.id, createdAt: dto.timestamp, action: dto.action, actionCode: dto.actionCode,
    module: dto.module, description: dto.description, result: dto.result, relatedRecords: dto.relatedRecords,
    before: dto.before, after: dto.after, ipAddress: dto.ipAddress, sessionId: dto.sessionId }, { detail: true });
  // This endpoint contains SYSTEM actors only. It supplies no admin identity,
  // and scheduled jobs have null request context. Keep unavailable facts unknown.
  return { ...row, isSystemEvent: true, user: 'System', reference: text(dto.reference) || '—' };
}
function readPage(response, requestedPage, systemEvents = false) {
  const dto = record(unwrapApiResponseData(response)), pagination = record(dto.pagination);
  const entries = systemEvents ? dto.events : dto.logs;
  if (!Array.isArray(entries) || pagination.page !== requestedPage || count(pagination.total) == null
    || count(pagination.totalPages) == null || (pagination.total > 0 && pagination.totalPages === 0)) {
    return failure('The audit API response is missing the logs or pagination needed to load all records.');
  }
  const size = count(pagination.limit);
  if (!size || size > 100 || pagination.totalPages > 500 || Math.max(1, pagination.totalPages) !== Math.max(1, Math.ceil(pagination.total / size)) || entries.length !== Math.max(0, Math.min(size, pagination.total - (requestedPage - 1) * size))) return failure('The audit API returned an incomplete page or inconsistent pagination.');
  const ids = entries.map((row) => text(row?.id));
  if (entries.length > pagination.total || (pagination.total === 0 && pagination.totalPages > 1)
    || requestedPage > Math.max(1, pagination.totalPages)) return failure('The audit API returned inconsistent pagination.');
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return failure('The audit API returned missing or duplicate audit IDs.');
  return { data: { rows: entries.map((row) => systemEvents ? adaptSystemEvent(row) : adaptAdminAudit(row)), total: pagination.total, totalPages: Math.max(1, pagination.totalPages) } };
}
async function readAuditDirectory(baseQuery, params, api, systemEvents = false) {
  const rows = [], seen = new Set();
  let page = 1, total = null, totalPages = 1;
  do {
    if (api.signal.aborted || page > 500) return failure('The audit request was cancelled.');
    const result = await baseQuery({ url: systemEvents ? '/admin/system-events' : '/admin/audit-logs', params: { ...params, page, limit: 100, ...(!systemEvents ? { sort: '-createdAt' } : {}) } });
    if (result.error) return result;
    const parsed = readPage(result.data, page, systemEvents);
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
function adaptSummary(response) {
  const dto = record(unwrapApiResponseData(response)), values = {}, comparisons = {};
  for (const key of ['totalLogs', 'activeUsers', 'securityEvents', 'failedActions']) {
    const metric = record(dto[key]);
    values[key] = count(metric.value);
    const previous = count(metric.previous), change = number(metric.changePercent);
    const direction = ['UP', 'DOWN', 'FLAT'].includes(metric.direction) ? metric.direction : null;
    const expectedDirection = values[key] == null || previous == null ? null : values[key] > previous ? 'UP' : values[key] < previous ? 'DOWN' : 'FLAT';
    const consistent = direction === expectedDirection && change != null && (change === 0 || change > 0 && direction === 'UP' || change < 0 && direction === 'DOWN');
    comparisons[key] = values[key] != null && previous != null && (previous > 0 || values[key] === 0) && consistent
      ? { percent: Math.abs(change), direction: direction === 'FLAT' ? null : direction.toLowerCase() }
      : { percent: null, direction: null };
  }
  return { ...values, comparisons };
}
export const auditApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminAuditLogs'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminAuditDirectory: builder.query({
      serializeQueryArgs: serializeAuditQuery,
      queryFn(params = {}, api, _options, baseQuery) {
        baseQuery = scopedAuditQuery(baseQuery, api, params);
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        return readAuditDirectory(baseQuery, { ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}), ...(params.dateTo ? { dateTo: params.dateTo } : {}) }, api);
      }, providesTags: ['AdminAuditLogs'],
    }),
    getAdminSystemEvents: builder.query({
      serializeQueryArgs: serializeAuditQuery,
      queryFn(params = {}, api, _options, baseQuery) {
        baseQuery = scopedAuditQuery(baseQuery, api, params);
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        return readAuditDirectory(baseQuery, { ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}), ...(params.dateTo ? { dateTo: params.dateTo } : {}) }, api, true);
      }, providesTags: ['AdminAuditLogs'],
    }),
    getAdminAuditScreenSummary: builder.query({
      serializeQueryArgs: serializeAuditQuery,
      async queryFn(args = {}, api, _options, baseQuery) {
        baseQuery = scopedAuditQuery(baseQuery, api, args);
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        const scope = args.scope ?? 'admin';
        if (!['admin', 'system', 'all'].includes(scope)) return failure('Choose a supported audit summary scope.');
        const result = await baseQuery({ url: '/admin/audit-logs/summary', params: { scope } });
        if (result.error) return result;
        return { data: adaptSummary(result.data) };
      }, providesTags: ['AdminAuditLogs'],
    }),
    getAdminAuditDetail: builder.query({
      serializeQueryArgs: serializeAuditQuery,
      async queryFn(args, api, _options, baseQuery) {
        baseQuery = scopedAuditQuery(baseQuery, api, args);
        const { id } = args;
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return permissionError();
        if (!text(id)) return failure('An audit ID is required.');
        const result = await baseQuery({ url: `/admin/audit-logs/${encodeURIComponent(id)}` });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (dto.id !== id) return failure('The audit detail response does not match the requested audit ID.');
        return { data: adaptAdminAudit(dto, { detail: true }) };
      }, providesTags: (_result, _error, args) => [{ type: 'AdminAuditLogs', id: args.id }],
    }),
  }),
});
export const { useGetAdminAuditDirectoryQuery, useGetAdminSystemEventsQuery, useGetAdminAuditScreenSummaryQuery, useGetAdminAuditDetailQuery } = auditApi;
