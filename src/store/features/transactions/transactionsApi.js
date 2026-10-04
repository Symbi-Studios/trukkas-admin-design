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
  WALLET_FUNDING: 'Wallet Funding', DEPOSIT: 'Wallet Funding', FEE: 'Fee',
  REFUND: 'Refund', REVERSAL: 'Reversal',
};
const BREAKDOWN_TYPES = new Set(['Payment In', 'Payment Out', 'Payout', 'Escrow Release']);
const BREAKDOWN_LABELS = ['Base Freight Amount', 'Service Fee (Platform)', 'Escrow Fee (1%)'];

function timestamp(value) {
  if (!text(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const transactionNumber = (value) => number(value) == null ? '—' : number(value).toLocaleString('en-NG');
export const transactionMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG')}`;
export const transactionAmount = (row, currency = false) => row.amount == null ? '—'
  : `${row.pos == null ? '' : row.pos ? '+' : '-'}${currency ? transactionMoney(row.amount) : transactionNumber(row.amount)}`;
export const transactionDetailUrl = (id) => `/transactions/detail?id=${encodeURIComponent(id)}`;
export const transactionJobUrl = (id) => `/jobs/detail?id=${encodeURIComponent(id)}`;

export function adaptAdminTransaction(dto) {
  const party = record(dto.party), paymentMethod = record(dto.paymentMethod), reference = record(dto.referenceDetails);
  const created = timestamp(dto.createdAt), rawAmount = number(dto.amount);
  const direction = text(dto.direction)?.toLowerCase();
  const type = TYPES[dto.type] || label(dto.type);
  const jobId = text(dto.jobId), jobInfo = record(dto.jobInfo);
  return {
    id: text(dto.id), displayId: text(dto.reference) || text(dto.id),
    date: created == null ? '—' : new Date(created).toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }),
    time: created == null ? '—' : new Date(created).toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }),
    timestamp: created,
    description: text(dto.description) || text(dto.label) || '—', note: text(dto.note), type,
    relatedTo: text(dto.relatedTo) || jobId || '—',
    relatedKind: jobId ? 'Job' : text(dto.relatedKind),
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
      title: text(entry.title) || '—', time: text(entry.time) || '—', description: text(entry.description) || '—',
      state: ['pending', 'done', 'current', 'danger', 'warning'].includes(entry.state) ? entry.state : 'pending', icon: text(entry.icon),
    })),
    documents: records(dto.documents).map((entry) => ({
      name: text(entry.name) || '—', size: text(entry.size) || '—', kind: text(entry.kind), url: text(entry.url),
    })),
    issueNotes: records(dto.issueNotes).map((entry) => ({ note: text(entry.note) || '—', time: text(entry.time) || '—' })),
  };
}

// The UI has filters absent from the API (type, party and related entity).
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

export function transactionInsights(rows, from, to) {
  const start = from ? Date.parse(`${from}T00:00:00+01:00`) : null;
  const end = to ? Date.parse(`${to}T23:59:59.999+01:00`) : null;
  const knownRange = rows != null && (!from || Number.isFinite(start)) && (!to || Number.isFinite(end))
    && (!(from || to) || rows.every((row) => row.timestamp != null));
  const scoped = knownRange ? rows.filter((row) => (start == null || row.timestamp >= start) && (end == null || row.timestamp <= end)) : null;
  const knownStatuses = scoped != null && scoped.every((row) => row.statusCode != null);
  const count = (statuses) => knownStatuses ? scoped.filter((row) => statuses.includes(row.status)).length : null;
  const percent = (value) => value == null || !scoped?.length ? '—' : `${(value / scoped.length * 100).toFixed(1)}%`;
  const successfulCount = count(['Completed']), failedReversedCount = count(['Failed', 'Reversed']);
  // Payments overview is an escrow/payout dashboard, not transaction summary.
  // It cannot supply ledger volume, period comparisons or transaction alerts.
  return {
    summary: {
      totalTransactions: scoped?.length ?? null, successfulCount, successfulPct: percent(successfulCount),
      failedReversedCount, failedReversedPct: percent(failedReversedCount),
      totalInflow: null, totalOutflow: null, netMovement: null,
      totalTransactionsDelta: '—', totalInflowDelta: '—', totalOutflowDelta: '—', netMovementDelta: '—',
      successfulDelta: '—', failedReversedDelta: '—',
    },
    volume: VOLUME_LABELS.map((name, index) => ({ label: name, amount: null, pct: null, color: index === 5 ? 'var(--tk-ink-300)' : `var(--tk-viz-${index + 1})` })),
    statuses: STATUS_ITEMS.map((entry) => ({ ...entry, count: count([entry.label]), pct: percent(count([entry.label])) })),
    alerts: [],
  };
}

async function performPaymentAction(baseQuery, id, action) {
  const result = await baseQuery({ url: `/admin/payments/${encodeURIComponent(id)}/${action}`, method: 'POST' });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  if (dto.transactionId !== id || !text(dto.status)) return { error: { status: 'CUSTOM_ERROR', error: 'The server response did not confirm this transaction action. Refresh before trying again.' } };
  return { data: { transactionId: dto.transactionId, status: dto.status, message: text(dto.message) } };
}

export const transactionsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminTransactions'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminTransactionLedger: builder.query({
      queryFn: (_args, api, _options, baseQuery) => readLedger(baseQuery, api),
      providesTags: ['AdminTransactions'],
    }),
    retryAdminTransaction: builder.mutation({
      queryFn: (id, _api, _options, baseQuery) => performPaymentAction(baseQuery, id, 'retry'),
      invalidatesTags: ['AdminTransactions', 'AdminCompanies', 'AdminForwarders', 'AdminDrivers'],
    }),
    reverseAdminTransaction: builder.mutation({
      queryFn: (id, _api, _options, baseQuery) => performPaymentAction(baseQuery, id, 'reverse'),
      invalidatesTags: ['AdminTransactions', 'AdminCompanies', 'AdminForwarders', 'AdminDrivers'],
    }),
  }),
});

export const { useGetAdminTransactionLedgerQuery, useRetryAdminTransactionMutation, useReverseAdminTransactionMutation } = transactionsApi;
