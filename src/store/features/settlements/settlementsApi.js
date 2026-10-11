import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER ? Number(value) : null;
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const display = (value) => text(value) ?? '—';
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) ?? '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
export const settlementNumber = (value) => number(value)?.toLocaleString('en-NG') ?? '—';
export const settlementMoney = (value) => number(value) == null ? '—' : (number(value) < 0 ? '-' : '') + '₦' + Math.abs(number(value)).toLocaleString('en-NG');
export const settlementMillions = (value) => number(value) == null ? '—' : '₦' + (number(value) / 1000000).toFixed(2) + 'M';
export const settlementDetailUrl = (row) => '/settlements/detail?id=' + encodeURIComponent(row.id);

function datePart(value, time = false) {
  if (time && typeof value === 'string' && value.length === 10) return '—';
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '—';
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (hour > 23 || minute > 59 || second > 59 || offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(date);
}
const dateTime = (value) => datePart(value) === '—' || datePart(value, true) === '—' ? '—' : datePart(value) + ' ' + datePart(value, true);
function routeLabel(value) {
  const route = record(value), origin = text(route.origin?.address), destination = text(route.destination?.address);
  return origin && destination ? origin + ' → ' + destination : '—';
}
export function adaptAdminSettlement(value) {
  const dto = record(value), id = text(dto.id);
  if (!id) return null;
  return {
    key: JSON.stringify([id, text(dto.tripId)]), id, kind: text(dto.kind), version: text(dto.version),
    jobId: text(dto.jobId), tripId: text(dto.tripId), allocated: typeof dto.allocated === 'boolean' ? dto.allocated : null,
    relatedTo: dto.allocated === true ? display(dto.tripNumber) : display(dto.jobNumber), route: routeLabel(dto.route),
    payer: display(dto.payer?.name), payerType: label(dto.payer?.type),
    payee: display(dto.payee?.name), payeeType: dto.payee?.type === 'TRUCKER' ? 'Transporter' : dto.payee?.type === 'FORWARDER' ? 'Customer' : label(dto.payee?.type),
    amount: dto.currency === 'NGN' ? number(dto.amount) : null, currency: text(dto.currency),
    type: label(dto.category), status: label(dto.status), statusCode: text(dto.status), method: label(dto.method),
    settledOn: datePart(dto.settledAt), settledTime: datePart(dto.settledAt, true), settledAt: text(dto.settledAt),
    sortAt: datePart(dto.date) === '—' ? null : text(dto.date),
    eligible: typeof dto.eligibility?.eligible === 'boolean' ? dto.eligibility.eligible : null,
    eligibilityReason: text(dto.eligibility?.reason),
    transactionReferences: Array.isArray(dto.transactionReferences) ? dto.transactionReferences.filter((entry) => text(entry)) : [],
    jobUrl: text(dto.jobId) ? '/jobs/detail?id=' + encodeURIComponent(dto.jobId) : null,
    timeline: Array.isArray(dto.timeline) ? dto.timeline.filter((event) => event && typeof event === 'object').map((event) => ({
      title: display(event.title), description: display(event.description), time: dateTime(event.time),
      state: event.outcome === 'DONE' ? 'done' : event.outcome === 'FAILED' ? 'danger' : 'pending',
      icon: event.key === 'SETTLEMENT_INITIATED' ? 'coins' : event.key === 'SETTLEMENT_COMPLETED' ? 'lock-open' : 'check',
    })) : null,
  };
}

// The page already paginates and filters a complete collection locally.
async function allPages(baseQuery, api, url, key, params = {}, identity = (row) => text(row?.id)) {
  const rows = [], ids = new Set();
  let expectedTotal = null, expectedPages = null;
  for (let page = 1; page <= 500; page += 1) {
    if (api.signal.aborted) return failure('Settlement loading was cancelled.');
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    const total = count(pagination.total), pages = count(pagination.totalPages), limit = count(pagination.limit);
    if (!Array.isArray(dto[key]) || count(pagination.page) !== page || total == null || pages == null || !limit || limit > 100 || pages > 500 || Math.max(1, pages) !== Math.max(1, Math.ceil(total / limit)) || dto[key].length > limit) return failure('The response is missing valid settlement records or pagination.');
    if (expectedTotal != null && (expectedTotal !== total || expectedPages !== pages)) return failure('Settlement records changed while loading. Please refresh.');
    expectedTotal = total; expectedPages = pages;
    for (const row of dto[key]) {
      const id = identity(row);
      if (!id || ids.has(id)) return failure('The response contains missing or repeated settlement identifiers.');
      ids.add(id); rows.push(row);
    }
    if (page >= pages) return rows.length === total ? { data: rows } : failure('The complete settlement collection could not be loaded.');
    if (dto[key].length !== limit) return failure('Settlement loading returned an incomplete page.');
  }
  return failure('The settlement collection exceeds the supported page count.');
}

export function settlementInsights(response) {
  const dto = record(unwrapApiResponseData(response));
  const fields = ['totalSettlements', 'completedSettlements', 'pendingSettlements', 'onHold', 'failedSettlements', 'avgSettlementTime'];
  const summary = Object.fromEntries(fields.flatMap((field) => [[field, null], [field + 'Delta', '—']]));
  // Swagger names the duration and its unit, but does not publish the card or
  // category/count DTOs. Do not infer their nesting from the old mock contracts.
  const duration = number(dto.averageSettlementDuration);
  if (duration != null && duration >= 0) summary.avgSettlementTime = duration.toLocaleString('en-NG') + ' hours';
  return {
    summary,
    payouts: ['Drivers', 'Transporters', 'Vendors', 'Customers (Refunds)', 'Others'].map((name, index) => ({ label: name, pct: null, amount: null, color: ['var(--tk-viz-1)', 'var(--tk-viz-2)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-ink-300)'][index] })),
    statuses: [['Completed', 'success', 'circle-check'], ['Pending', 'warning', 'hourglass'], ['On Hold', 'info', 'circle-pause'], ['Failed', 'danger', 'circle-x']].map(([name, tone, icon]) => ({ label: name, tone, icon, count: null, pct: '—' })),
  };
}
export const emptySettlementInsights = settlementInsights(null);

export function canApproveSettlement(row) {
  return Boolean(row?.id && row.version && row.currency === 'NGN' && row.amount != null && row.amount >= 0 && row.allocated === false && row.statusCode === 'PENDING' && (row.kind === 'BANK_PAYOUT' || row.kind === 'ESCROW_TRANCHE' && row.eligible === true));
}
export function canRetrySettlement(row) {
  return Boolean(row?.id && row.version && row.currency === 'NGN' && row.amount != null && row.amount >= 0 && row.allocated === false && row.kind === 'BANK_PAYOUT' && row.statusCode === 'FAILED');
}
async function actOnSettlement(args, api, baseQuery, action) {
  const { row, idempotencyKey } = args;
  if (!['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(api.getState().auth.admin?.role)) return { error: { status: 403, data: { message: 'Settlement approval and retry require Super Admin or Finance Admin access.' } } };
  if (!(action === 'approve' ? canApproveSettlement(row) : canRetrySettlement(row)) || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey ?? '')) return failure('This settlement cannot perform the selected action. Refresh its details.');
  const result = await baseQuery({ url: '/admin/settlements/' + encodeURIComponent(row.id) + '/' + action, method: 'POST', headers: { 'x-idempotency-key': idempotencyKey }, body: { expectedVersion: row.version } });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  const acceptedStatuses = row.kind === 'ESCROW_TRANCHE' ? ['COMPLETED'] : ['PROCESSING', 'COMPLETED'];
  if (dto.id !== row.id || dto.kind !== row.kind || dto.currency !== row.currency || number(dto.amount) !== row.amount || label(dto.method) !== row.method || !text(dto.version) || !acceptedStatuses.includes(dto.status) || !Array.isArray(dto.transactionReferences) || dto.transactionReferences.some((entry) => !text(entry)) || dto.status === 'COMPLETED' && datePart(dto.settledAt) === '—') return failure('The server response could not confirm the settlement update. Refresh before proceeding.');
  return { data: adaptAdminSettlement(dto) };
}

async function getPdf(baseQuery, url, params) {
  const result = await baseQuery({ url, params, headers: { Accept: 'application/pdf' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    const content = await response.text();
    try { return JSON.parse(content); } catch { return { message: 'Unable to download the settlement document.' }; }
  } });
  if (result.error) return result;
  if (!(result.data instanceof Blob) || !result.data.size) return failure('The server did not return a settlement PDF.');
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return failure('The server did not return a valid settlement PDF.');
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return { data: { content: btoa(binary) } };
}
export function saveSettlementPdf(result, filename) {
  const binary = atob(result.content), bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSettlementRows(rows) {
  const fields = [['Settlement ID','id'],['Related To','relatedTo'],['Route','route'],['Payer','payer'],['Payer Type','payerType'],['Payee','payee'],['Payee Type','payeeType'],['Amount (NGN)','amount'],['Settlement Type','type'],['Status','status'],['Settled On','settledOn'],['Method','method']];
  const quote = (v) => { const s = String(v ?? '—'); return '"' + (/^[=+@\-\t\r]/.test(s) ? "'"+s : s).replaceAll('"','""') + '"'; };
  const csv = [fields.map(([name]) => quote(name)).join(','), ...rows.map((row) => fields.map(([,field]) => quote(row[field])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href=url; link.download='settlements.csv'; link.click(); URL.revokeObjectURL(url);
}

const settlementTags = ['AdminSettlements', 'AdminSettlementSummary', 'AdminSettlementAlerts'];
const movementTags = [...settlementTags, 'AdminTransactions', 'AdminPayoutDirectory', 'AdminPayoutWithdrawalStats', 'AdminEscrowOverview', 'AdminEscrowHolds', 'AdminEscrowReleases', 'AdminEscrowAccounts', 'AdminEscrowAlerts', 'AdminEscrowLedger', 'AdminEscrowActivity', 'AdminEscrowDisputes', 'AdminJobs', 'AdminTrips'];
export const settlementsApi = baseApi.enhanceEndpoints({ addTagTypes: movementTags }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminSettlements: builder.query({
      async queryFn({ groupBy = 'job' } = {}, api, _options, baseQuery) {
        const result = await allPages(baseQuery, api, '/admin/settlements', 'settlements', { groupBy, sort: '-date' }, (row) => text(row?.id) ? JSON.stringify([row.id, text(row.tripId)]) : null);
        return result.error ? result : { data: result.data.map(adaptAdminSettlement) };
      }, providesTags: ['AdminSettlements'],
    }),
    getAdminSettlement: builder.query({
      async queryFn({ id }, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/settlements/' + encodeURIComponent(id) });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        return dto.id === id ? { data: adaptAdminSettlement(dto) } : failure('The response does not belong to the selected settlement.');
      }, providesTags: ['AdminSettlements'],
    }),
    getAdminSettlementSummary: builder.query({
      query: () => ({ url: '/admin/settlements/summary' }), transformResponse: settlementInsights, providesTags: ['AdminSettlementSummary'],
    }),
    getAdminSettlementAlerts: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await allPages(baseQuery, api, '/admin/settlements/alerts', 'alerts');
        return result.error ? result : { data: result.data.map((row) => ({
          id: row.id, title: display(row.title), description: display(row.description), time: dateTime(row.timestamp),
          icon: 'triangle-alert', tone: row.severity === 'CRITICAL' ? 'danger' : row.severity === 'INFO' ? 'info' : 'warning',
        })) };
      }, providesTags: ['AdminSettlementAlerts'],
    }),
    approveAdminSettlement: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => actOnSettlement(args, api, baseQuery, 'approve'), invalidatesTags: movementTags,
    }),
    retryAdminSettlement: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => actOnSettlement(args, api, baseQuery, 'retry'), invalidatesTags: movementTags,
    }),
    getAdminSettlementReceipt: builder.query({
      queryFn: ({ id }, _api, _options, baseQuery) => getPdf(baseQuery, '/admin/settlements/' + encodeURIComponent(id) + '/receipt'), keepUnusedDataFor: 0,
    }),
    getAdminSettlementReport: builder.query({
      queryFn: (_args, _api, _options, baseQuery) => getPdf(baseQuery, '/admin/settlements/report', { format: 'pdf' }), keepUnusedDataFor: 0,
    }),
  }),
});
export const { useGetAdminSettlementsQuery, useGetAdminSettlementQuery, useGetAdminSettlementSummaryQuery, useGetAdminSettlementAlertsQuery, useApproveAdminSettlementMutation, useRetryAdminSettlementMutation, useLazyGetAdminSettlementReceiptQuery, useLazyGetAdminSettlementReportQuery } = settlementsApi;
