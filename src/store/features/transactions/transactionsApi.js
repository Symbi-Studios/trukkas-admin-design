import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const records = (value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const number = (value) => {
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const TYPES = {
  PAYMENT_IN: 'Payment In', PAYMENT_OUT: 'Payment Out', WITHDRAWAL: 'Payment Out',
  PAYOUT: 'Payout', ESCROW_RELEASE: 'Escrow Release', ESCROW_HOLD: 'Escrow Hold',
  ESCROW_LOCK: 'Escrow Hold', MOBILIZATION: 'Escrow Release', FINAL_PAYMENT: 'Payout', DEMURRAGE: 'Fee',
  WALLET_FUNDING: 'Wallet Funding', DEPOSIT: 'Wallet Funding', FEE: 'Fee',
  REFUND: 'Refund', REVERSAL: 'Reversal',
};
const BREAKDOWN_TYPES = new Set(['Payment In', 'Payment Out', 'Payout', 'Escrow Release']);
const BREAKDOWN_LABELS = ['Base Freight Amount', 'Service Fee (Platform)', 'Escrow Fee (1%)'];

function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const percentLabel = (value) => number(value) == null ? '—' : `${number(value) > 0 ? '+' : ''}${number(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%`;
const dateTime = (value) => timestamp(value) == null ? '—' : new Date(timestamp(value)).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const transactionNumber = (value) => number(value) == null ? '—' : number(value).toLocaleString('en-NG');
export const transactionMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG')}`;
export const transactionAmount = (row, currency = false) => row.amount == null ? '—'
  : `${row.pos == null ? '' : row.pos ? '+' : '-'}${currency ? transactionMoney(row.amount) : transactionNumber(row.amount)}`;
export const transactionDetailUrl = (id) => `/transactions/detail?id=${encodeURIComponent(id)}`;
export const transactionJobUrl = (id) => `/jobs/detail?id=${encodeURIComponent(id)}`;

export function adaptAdminTransaction(dto) {
  dto = record(dto);
  const party = record(dto.party), paymentMethod = record(dto.paymentMethod), reference = record(dto.referenceDetails);
  const related = record(dto.relatedTo), reversal = record(dto.reversal), actions = record(dto.actions);
  const created = timestamp(dto.createdAt), rawAmount = number(dto.amount);
  const direction = text(dto.direction)?.toLowerCase();
  const isReversal = reversal.isReversal === true || dto.relatedKind === 'REVERSAL';
  const legacyDemurrage = dto.type === 'WITHDRAWAL' && text(dto.description)?.startsWith('Demurrage payment');
  const type = isReversal ? 'Reversal' : legacyDemurrage ? 'Fee' : TYPES[dto.type] || text(dto.typeLabel) || label(dto.type);
  const jobInfo = record(dto.jobInfo), jobId = text(jobInfo.jobId) || text(dto.jobId);
  return {
    id: text(dto.id), displayId: text(dto.reference) || text(dto.id),
    date: created == null ? '—' : new Date(created).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }),
    time: created == null ? '—' : new Date(created).toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }),
    timestamp: created,
    description: text(dto.description) || text(dto.label) || '—', note: text(dto.note), type, typeCode: text(dto.type), isReversal,
    filterTypes: [...new Set([type, direction === 'inflow' ? 'Payment In' : direction === 'outflow' ? 'Payment Out' : null].filter(Boolean))],
    isEscrow: ['ESCROW_LOCK', 'ESCROW_RELEASE', 'ESCROW_HOLD', 'MOBILIZATION', 'FINAL_PAYMENT'].includes(dto.type) && !isReversal,
    relatedTo: text(related.label) || text(related.id) || text(dto.relatedTo) || '—',
    relatedKind: dto.relatedKind === 'JOB' ? 'Job' : dto.relatedKind === 'REVERSAL' ? 'Transaction' : label(dto.relatedKind),
    party: text(party.name) || text(dto.party) || '—',
    amount: rawAmount == null ? null : Math.abs(rawAmount),
    pos: direction === 'inflow' ? true : direction === 'outflow' ? false : null,
    statusCode: text(dto.status), status: label(dto.status), balanceAfter: number(dto.balanceAfter),
    parties: Array.isArray(dto.parties) ? records(dto.parties).map((entry) => ({
      role: text(entry.role) || '—', name: text(entry.name) || '—', id: text(entry.id) || '—',
      email: text(entry.email) || '—', phone: text(entry.phone) || '—', tint: entry.tint,
    })) : party.name || party.id ? [{
      role: label(party.role), name: text(party.name) || '—', id: text(party.id) || '—',
      email: text(party.email) || '—', phone: text(party.phone) || '—',
    }] : [],
    jobInfo: jobId ? { jobId, route: text(jobInfo.route) || '—', cargoType: text(jobInfo.cargoType) || '—', truck: text(jobInfo.truck) || '—', tripId: text(jobInfo.tripId) || '—' } : null,
    showBreakdown: BREAKDOWN_TYPES.has(type) || Array.isArray(dto.breakdown),
    breakdown: Array.isArray(dto.breakdown) ? records(dto.breakdown).map((entry) => ({ label: text(entry.label) || '—', value: number(entry.value) }))
      : BREAKDOWN_TYPES.has(type) ? BREAKDOWN_LABELS.map((name) => ({ label: name, value: null })) : null,
    paymentMethod: Object.fromEntries(['method', 'bank', 'accountNumber', 'accountName'].map((key) => [key, text(paymentMethod[key]) || '—'])),
    reference: { customerRef: text(reference.customerRef) || text(dto.customerReference) || '—', internalNote: text(reference.internalNote) || text(dto.internalNote) || '—' },
    timeline: records(dto.timeline).map((entry) => ({
      title: text(entry.title) || '—', time: text(entry.time) || dateTime(entry.createdAt), description: text(entry.description) || '—',
      state: ['pending', 'done', 'current', 'danger', 'warning'].includes(entry.state) ? entry.state : 'pending', icon: text(entry.icon),
    })),
    documents: records(dto.documents).map((entry) => ({
      id: text(entry.id), name: text(entry.name) || '—', size: text(entry.size) || '—', kind: text(entry.kind), url: text(entry.url),
    })),
    issueNotes: records(dto.issueNotes).map((entry) => ({ note: text(entry.note) || '—', time: text(entry.time) || dateTime(entry.createdAt) })),
    actions: {
      canRefund: typeof actions.canRefund === 'boolean' ? actions.canRefund : null,
      refundReason: text(actions.refundReason),
      canReverse: typeof actions.canReverse === 'boolean' ? actions.canReverse : null,
      reverseReason: text(actions.reverseReason),
    },
  };
}

// Party and related-entity filters require the complete ledger.
// Load the complete ledger before filtering or exporting; never treat one page
// as the platform's transaction list or use it to calculate platform counts.
async function readLedger(baseQuery, api) {
  const rows = [], seen = new Set();
  let page = 1, expectedTotal = null, expectedPages = null;
  do {
    if (api.signal.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Transaction loading was cancelled.' } };
    const result = await baseQuery({ url: '/admin/payments/transactions', params: { page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!Array.isArray(dto.rows) || pagination.page !== page || !Number.isInteger(pagination.total)
      || pagination.total < 0 || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0
      || !Number.isInteger(pagination.limit) || pagination.limit <= 0
      || (Math.ceil(pagination.total / pagination.limit) !== pagination.totalPages && !(pagination.total === 0 && pagination.totalPages === 1))) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The transaction ledger is missing valid records or pagination.' } };
    }
    if (page === 1) { expectedTotal = pagination.total; expectedPages = Math.max(1, pagination.totalPages); }
    if (pagination.total !== expectedTotal || Math.max(1, pagination.totalPages) !== expectedPages) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The transaction ledger changed while loading. Please refresh it.' } };
    }
    if (page < expectedPages && !dto.rows.length) return { error: { status: 'CUSTOM_ERROR', error: 'The transaction ledger returned an incomplete page.' } };
    for (const entry of dto.rows) {
      const id = text(entry?.id);
      if (!id || seen.has(id)) return { error: { status: 'CUSTOM_ERROR', error: 'The transaction ledger contains missing or repeated transaction IDs. Please refresh it.' } };
      seen.add(id); rows.push(adaptAdminTransaction(entry));
    }
    page += 1;
  } while (page <= expectedPages);
  if (rows.length !== expectedTotal) return { error: { status: 'CUSTOM_ERROR', error: 'The complete transaction ledger could not be loaded.' } };
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  return { data: { rows, total: expectedTotal } };
}

const VOLUME_LABELS = ['Payments In', 'Payments Out', 'Fees & Charges', 'Refunds', 'Reversals', 'Others'];
const STATUS_ITEMS = [
  { label: 'Completed', tone: 'success', icon: 'circle-check' },
  { label: 'Pending', tone: 'warning', icon: 'hourglass' },
  { label: 'Failed', tone: 'danger', icon: 'circle-x' },
  { label: 'Reversed', tone: 'info', icon: 'rotate-ccw' },
];

export function transactionInsights(rows, from, to, stats) {
  const start = from ? timestamp(`${from}T00:00:00+01:00`) : null;
  const end = to ? timestamp(`${to}T23:59:59.999+01:00`) : null;
  const knownRange = rows != null && (!from || Number.isFinite(start)) && (!to || Number.isFinite(end))
    && (start == null || end == null || start <= end)
    && (!(from || to) || rows.every((row) => row.timestamp != null));
  const scoped = knownRange ? rows.filter((row) => (start == null || row.timestamp >= start) && (end == null || row.timestamp <= end)) : null;
  const knownStatuses = scoped != null && scoped.every((row) => ['COMPLETED', 'PENDING', 'PROCESSING', 'FAILED', 'REVERSED'].includes(row.statusCode));
  const count = (statuses) => knownStatuses ? scoped.filter((row) => statuses.includes(row.status)).length : null;
  const percent = (value) => value == null || !scoped?.length ? '—' : `${(value / scoped.length * 100).toFixed(1)}%`;
  const successfulCount = count(['Completed']), failedReversedCount = count(['Failed', 'Reversed']);
  const completed = knownStatuses ? scoped.filter((row) => row.statusCode === 'COMPLETED') : null;
  const knownVolume = completed != null && completed.every((row) => row.amount != null && row.typeCode != null && row.pos != null);
  // Keep the six existing chart categories. Reversal entries retain their
  // original backend type, so their explicit reversal flag takes precedence.
  let amounts = knownVolume ? VOLUME_LABELS.map(() => 0) : null;
  completed?.forEach((row) => {
    if (!amounts) return;
    const index = row.isReversal || row.type === 'Reversal' ? 4 : row.type === 'Refund' ? 3 : row.type === 'Fee' ? 2 : row.pos === true ? 0 : row.pos === false ? 1 : 5;
    amounts[index] += row.amount;
  });
  let volumeTotal = amounts?.reduce((sum, value) => sum + value, 0) ?? null;
  if (volumeTotal != null && !Number.isFinite(volumeTotal)) { amounts = null; volumeTotal = null; }
  return {
    summary: {
      totalTransactions: stats?.totalTransactions ?? scoped?.length ?? null, successfulCount, successfulPct: percent(successfulCount),
      failedReversedCount, failedReversedPct: percent(failedReversedCount),
      totalInflow: stats?.totalInflow ?? null, totalOutflow: stats?.totalOutflow ?? null, netMovement: stats?.netMovement ?? null,
      totalTransactionsDelta: stats?.totalTransactionsDelta ?? '—', totalInflowDelta: stats?.totalInflowDelta ?? '—', totalOutflowDelta: stats?.totalOutflowDelta ?? '—', netMovementDelta: stats?.netMovementDelta ?? '—',
      successfulDelta: '—', failedReversedDelta: '—',
    },
    volumeTotal,
    volume: VOLUME_LABELS.map((name, index) => ({ label: name, amount: amounts?.[index] ?? null, pct: amounts == null ? null : volumeTotal === 0 ? 0 : Math.round(amounts[index] / volumeTotal * 1000) / 10, color: index === 5 ? 'var(--tk-ink-300)' : `var(--tk-viz-${index + 1})` })),
    statuses: STATUS_ITEMS.map((entry) => ({ ...entry, count: count([entry.label]), pct: percent(count([entry.label])) })),
    alerts: stats?.alerts || [],
  };
}

export function adaptAdminTransactionStats(response) {
  const dto = record(unwrapApiResponseData(response)), cards = record(dto.cards);
  const card = (key) => record(cards[key]);
  // Preserve the existing fixed May comparison caption without mislabeling another period.
  const comparison = record(dto.comparisonPeriod);
  const comparisonDate = (value) => timestamp(value) == null ? null : new Date(timestamp(value) + 3600000).toISOString().slice(0, 10);
  const matchesCaption = comparisonDate(comparison.from) === '2026-05-17' && comparisonDate(comparison.to) === '2026-05-23';
  const delta = (value) => matchesCaption ? percentLabel(value) : '—';
  const alertStyle = { TRANSACTION_FAILED: ['circle-x', 'danger'], TRANSACTION_STUCK: ['hourglass', 'warning'], TRANSACTION_ISSUE: ['flag', 'warning'] };
  return {
    totalTransactions: count(card('transactionCount').value), totalInflow: number(card('totalInflow').value),
    totalOutflow: number(card('totalOutflow').value), netMovement: number(card('netMovement').value),
    totalTransactionsDelta: delta(card('transactionCount').vsPreviousPct), totalInflowDelta: delta(card('totalInflow').vsPreviousPct),
    totalOutflowDelta: delta(card('totalOutflow').vsPreviousPct), netMovementDelta: delta(card('netMovement').vsPreviousPct),
    alerts: records(dto.alerts).map((entry) => ({
      title: text(entry.title) || '—', description: text(entry.description) || '—', time: dateTime(entry.createdAt),
      icon: alertStyle[entry.type]?.[0] || 'triangle-alert', tone: alertStyle[entry.type]?.[1] || 'warning',
    })),
  };
}

function statsRange({ from, to } = {}) {
  const dateFrom = from ? `${from}T00:00:00+01:00` : undefined, dateTo = to ? `${to}T23:59:59.999+01:00` : undefined;
  if ((dateFrom && timestamp(dateFrom) == null) || (dateTo && timestamp(dateTo) == null) || (dateFrom && dateTo && timestamp(dateFrom) > timestamp(dateTo))) throw new Error('Select a valid transaction date range.');
  return { dateFrom, dateTo };
}

async function transactionPdf(baseQuery, id, kind) {
  if (!text(id)) return { error: { status: 'CUSTOM_ERROR', error: 'A transaction ID is required.' } };
  const result = await baseQuery({ url: `/admin/payments/${encodeURIComponent(id)}/${kind}`, headers: { Accept: 'application/pdf' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    const body = await response.text();
    try { return JSON.parse(body); } catch { return { message: 'Unable to download this transaction document.' }; }
  } });
  if (result.error) return { error: result.error };
  const file = result.data;
  if (!(file instanceof Blob) || await file.slice(0, 5).text() !== '%PDF-') return { error: { status: 'CUSTOM_ERROR', error: 'The server did not return a valid PDF document.' } };
  return { data: { url: URL.createObjectURL(file), name: `transaction-${kind}-${id}.pdf` } };
}
export function downloadTransactionPdf(file) {
  const anchor = document.createElement('a'); anchor.href = file.url; anchor.download = file.name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(file.url), 1000);
}

async function performPaymentAction(baseQuery, id, action) {
  const result = await baseQuery({ url: `/admin/payments/${encodeURIComponent(id)}/${action}`, method: 'POST' });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  if (dto.transactionId !== id || !text(dto.status)) return { error: { status: 'CUSTOM_ERROR', error: 'The server response did not confirm this transaction action. Refresh before trying again.' } };
  return { data: { transactionId: dto.transactionId, status: dto.status, message: text(dto.message) } };
}

async function createTransactionRecord(baseQuery, id, action, body) {
  const result = await baseQuery({ url: `/admin/payments/${encodeURIComponent(id)}/${action}`, method: 'POST', body });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  if (dto.transactionId !== id || !text(dto.id) || !text(dto.status)) return { error: { status: 'CUSTOM_ERROR', error: 'The server did not confirm this transaction action. Refresh before trying again.' } };
  return { data: { id: dto.id, transactionId: dto.transactionId, status: dto.status, reference: text(dto.reference) } };
}

const financialTags = ['AdminTransactions', 'AdminCompanies', 'AdminForwarders', 'AdminDrivers', 'AdminEscrowOverview', 'AdminEscrowLedger', 'AdminEscrowHolds', 'AdminEscrowReleases', 'AdminEscrowAccounts', 'AdminEscrowActivity', 'AdminEscrowAlerts', 'AdminEscrowDisputes', 'AdminJobSettlements'];
export const transactionsApi = baseApi.enhanceEndpoints({ addTagTypes: financialTags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminTransactionLedger: builder.query({
      queryFn: (_args, api, _options, baseQuery) => readLedger(baseQuery, api),
      providesTags: ['AdminTransactions'],
    }),
    getAdminTransactionStats: builder.query({
      async queryFn(args, _api, _options, baseQuery) {
        let params;
        try { params = statsRange(args); } catch (error) { return { error: { status: 'CUSTOM_ERROR', error: error.message } }; }
        const result = await baseQuery({ url: '/admin/payments/transactions/stats', params });
        return result.error ? { error: result.error } : { data: adaptAdminTransactionStats(result.data) };
      }, providesTags: ['AdminTransactions'],
    }),
    getAdminTransactionDetail: builder.query({
      query: (id) => ({ url: `/admin/payments/transactions/${encodeURIComponent(id)}` }),
      transformResponse: (response, _meta, id) => {
        const dto = record(unwrapApiResponseData(response)), row = adaptAdminTransaction(dto);
        if (row.id !== id) throw new Error('The response did not include the requested transaction.');
        return row;
      }, providesTags: ['AdminTransactions'],
    }),
    getAdminTransactionReceipt: builder.query({ queryFn: (id, _api, _options, baseQuery) => transactionPdf(baseQuery, id, 'receipt') }),
    getAdminTransactionStatement: builder.query({ queryFn: (id, _api, _options, baseQuery) => transactionPdf(baseQuery, id, 'statement') }),
    retryAdminTransaction: builder.mutation({
      queryFn: (id, _api, _options, baseQuery) => performPaymentAction(baseQuery, id, 'retry'),
      invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? financialTags : [],
    }),
    reverseAdminTransaction: builder.mutation({
      queryFn: (id, _api, _options, baseQuery) => performPaymentAction(baseQuery, id, 'reverse'),
      invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? financialTags : [],
    }),
    refundAdminTransaction: builder.mutation({
      queryFn: ({ id, amount }, _api, _options, baseQuery) => {
        const value = number(amount);
        if (!text(id) || value == null || value <= 0) return { error: { status: 'CUSTOM_ERROR', error: 'Enter a valid refund amount.' } };
        return createTransactionRecord(baseQuery, id, 'refund', { amount: value });
      }, invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? financialTags : [],
    }),
    reportAdminTransactionIssue: builder.mutation({
      queryFn: ({ id, note }, _api, _options, baseQuery) => {
        if (!text(id) || !text(note)) return { error: { status: 'CUSTOM_ERROR', error: 'Describe the transaction issue.' } };
        return createTransactionRecord(baseQuery, id, 'issues', { note: text(note) });
      }, invalidatesTags: (_result, error) => !error || error.status === 'CUSTOM_ERROR' ? ['AdminTransactions'] : [],
    }),
  }),
});

export const { useGetAdminTransactionLedgerQuery, useGetAdminTransactionStatsQuery, useGetAdminTransactionDetailQuery, useLazyGetAdminTransactionDetailQuery,
  useLazyGetAdminTransactionReceiptQuery, useLazyGetAdminTransactionStatementQuery, useRetryAdminTransactionMutation, useReverseAdminTransactionMutation,
  useRefundAdminTransactionMutation, useReportAdminTransactionIssueMutation } = transactionsApi;
