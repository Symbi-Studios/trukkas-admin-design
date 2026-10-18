import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptAdminAudit } from '../audit/auditApi.js';
import { feeNumber, feePeriods } from './feesApi.js';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const amount = value => feeNumber(value) != null && feeNumber(value) >= 0 ? feeNumber(value) : null;
const label = value => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, part => part.toUpperCase()) || '—';
const failure = error => ({ error: { status: 'CUSTOM_ERROR', error } });
export const feeLedgerCategories = ['PLATFORM', 'SERVICE', 'PROCESSING'];
export const feeAuditScopes = [
  { value: 'config', label: 'Platform configuration', params: { module: 'CONFIG', entityType: 'CONFIG', category: 'FINANCIAL' } },
  { value: 'finance', label: 'Finance settings', params: { module: 'SETTINGS', entityType: 'SETTINGS', category: 'FINANCIAL', search: 'finance' } },
  { value: 'terminal', label: 'Terminal fees', params: { module: 'PRICING', entityType: 'TERMINAL', category: 'FINANCIAL', search: 'Pricing updated terminal fee' } },
];
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function feeRangeValid(from, to) {
  return (!from || validDay(from)) && (!to || validDay(to)) && (!from || !to || from <= to);
}
export function feeRecordDate(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDay(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) return '—';
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) return '—';
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function period(value) {
  const dto = record(value);
  return { from: feeRecordDate(dto.from), to: feeRecordDate(dto.to), timezone: text(dto.timezone) || '—' };
}
function pageData(dto, key, page, limit) {
  const rows = dto[key], p = record(dto.pagination);
  if (!Array.isArray(rows) || p.page !== page || p.limit !== limit || count(p.total) == null || count(p.totalPages) == null
    || Math.max(1, p.totalPages) !== Math.max(1, Math.ceil(p.total / limit))
    || page > Math.max(1, p.totalPages) || rows.length !== Math.max(0, Math.min(limit, p.total - (page - 1) * limit))
    || rows.some(row => !text(row?.id)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('The fee response has incomplete records or pagination. Refresh before continuing.');
  return { rows, pagination: { page, limit, total: p.total, totalPages: Math.max(1, p.totalPages) } };
}
function scopedQuery(baseQuery, api, args, superOnly = false) {
  const current = () => !api.signal.aborted && args.owner && api.getState().auth.accessToken
    && api.getState().auth.admin?.id === args.owner && (!superOnly || args.role === 'SUPER_ADMIN' && api.getState().auth.admin?.role === args.role);
  return async request => {
    if (!current()) return { error: { status: 403, data: { message: superOnly ? 'Only Super Admins can view the fee audit log.' : 'Sign in before loading fee records.' } } };
    const result = await baseQuery(request);
    return current() ? result : failure('Your session changed. Reopen Fees before continuing.');
  };
}
async function listQuery(kind, args, api, baseQuery) {
  try {
    const { page = 1, limit = 20, dateFrom, dateTo, search } = args;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !feeRangeValid(dateFrom, dateTo)) throw new Error('Select valid fee dates and pagination.');
    const params = { page, limit, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
    if (text(search)) params.search = search.trim();
    let url = '/admin/fees/' + kind, collection = kind;
    if (kind === 'deductions') {
      if (args.status && !['ASSESSED', 'APPLIED', 'WAIVED', 'REFUNDED'].includes(args.status)) throw new Error('Select a supported deduction status.');
      if (args.status) params.status = args.status;
    } else if (kind === 'transactions') {
      collection = 'feeTransactions';
      if (args.category && !feeLedgerCategories.includes(args.category)) throw new Error('Select a supported fee category.');
      if (args.category) params.category = args.category;
      if (text(args.feeRuleId)) params.feeRuleId = args.feeRuleId.trim();
    } else {
      const scope = feeAuditScopes.find(scope => scope.value === args.scope);
      if (!scope) throw new Error('Select a fee audit scope.');
      Object.assign(params, scope.params, { sort: '-createdAt' });
      url = '/admin/audit-logs'; collection = 'logs';
    }
    const result = await scopedQuery(baseQuery, api, args, kind === 'audit')({ url, params });
    if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data));
    if (dto.truncated === true) throw new Error('The backend truncated the fee data. Narrow the date range before reviewing totals.');
    const data = pageData(dto, collection, page, limit), totals = record(dto.totals);
    if (kind === 'audit') return { data: { ...data, rows: data.rows.map(row => adaptAdminAudit(row)), failed: count(totals.failed) } };
    if (kind === 'deductions') return { data: { ...data, period: period(dto.period), totals: { count: count(totals.count), ...Object.fromEntries(['assessed', 'applied', 'waived', 'refunded'].map(key => [key, totals.currency === 'NGN' ? amount(totals[key]) : null])) },
      rows: data.rows.map(row => ({ id: row.id, type: label(row.type), jobId: text(row.jobId), job: text(row.jobNumber) || text(row.jobId) || '—', transactionId: text(row.transactionId), user: text(row.user?.name) || '—', amount: row.currency === 'NGN' ? amount(row.amount) : null,
        reason: text(row.reason) || '—', status: label(row.status), createdAt: feeRecordDate(row.createdAt), forwarder: row.currency === 'NGN' ? amount(row.split?.forwarder) : null, platform: row.currency === 'NGN' ? amount(row.split?.platform) : null })) } };
    return { data: { ...data, period: period(dto.period), totalAmount: totals.currency === 'NGN' ? amount(totals.amount) : null,
      rows: data.rows.map(row => ({ id: row.id, transactionId: text(row.transactionId), reference: text(row.reference) || '—', ruleId: text(row.feeRuleId), feeName: text(row.feeName) || '—', category: label(row.category), amount: row.currency === 'NGN' ? amount(row.feeAmount) : null,
        payer: text(row.payer?.name) || '—', jobId: text(row.jobId), job: text(row.jobNumber) || text(row.jobId) || '—', status: label(row.status), createdAt: feeRecordDate(row.createdAt) })) } };
  } catch (error) { return failure(error.message); }
}
function adaptAnalytics(response) {
  const dto = record(unwrapApiResponseData(response));
  if (dto.truncated === true) throw new Error('The backend truncated fee analytics. Select a shorter period.');
  const ngn = dto.currency === 'NGN', money = value => ngn ? amount(value) : null;
  const collection = (key, identity) => {
    const rows = dto[key];
    if (!Array.isArray(rows) || rows.some(row => !identity(row)) || new Set(rows.map(identity)).size !== rows.length) throw new Error('The fee analytics response is missing valid ' + key + '.');
    return rows;
  };
  return { period: period(dto.period), totalCollected: money(dto.totalCollected),
    series: collection('series', row => validDay(row?.date) && feeLedgerCategories.includes(row.category) ? row.date + ':' + row.category : null).map(row => ({ id: row.date + ':' + row.category, date: row.date, category: label(row.category), amount: money(row.amount), count: count(row.count) })),
    categories: collection('totalsByCategory', row => feeLedgerCategories.includes(row?.category) ? row.category : null).map(row => ({ id: row.category, name: label(row.category), amount: money(row.amount), count: count(row.count) })),
    topRules: collection('topRules', row => text(row?.ruleId)).map(row => ({ id: row.ruleId, name: text(row.name) || '—', category: label(row.category), amount: money(row.totalCollected), count: count(row.count) })) };
}
export const feeTabsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminFeeLedger', 'AdminFeeAnalytics', 'AdminAuditLogs'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: builder => ({
    getAdminFeeDeductions: builder.query({ queryFn: (args, api, _options, baseQuery) => listQuery('deductions', args, api, baseQuery), providesTags: ['AdminFeeLedger'] }),
    getAdminFeeTransactions: builder.query({ queryFn: (args, api, _options, baseQuery) => listQuery('transactions', args, api, baseQuery), providesTags: ['AdminFeeLedger'] }),
    getAdminFeeAudit: builder.query({ queryFn: (args, api, _options, baseQuery) => listQuery('audit', args, api, baseQuery), providesTags: ['AdminAuditLogs'] }),
    getAdminFeeAnalytics: builder.query({
      async queryFn(args, api, _options, baseQuery) {
        try {
          if (!feePeriods.some(period => period.value === args.period)) throw new Error('Select a supported fee analytics period.');
          const result = await scopedQuery(baseQuery, api, args)({ url: '/admin/fees/analytics', params: { period: args.period } });
          return result.error ? result : { data: adaptAnalytics(result.data) };
        } catch (error) { return failure(error.message); }
      }, providesTags: ['AdminFeeAnalytics'],
    }),
  }),
});
export const { useGetAdminFeeDeductionsQuery, useGetAdminFeeTransactionsQuery, useGetAdminFeeAuditQuery, useGetAdminFeeAnalyticsQuery } = feeTabsApi;
