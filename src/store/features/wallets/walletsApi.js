import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) && Number.isFinite(Number(value)) ? Number(value) : null;
const display = (value) => text(value) ?? '—';
const status = (value) => text(value)?.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') ?? '—';

export const escrowNumber = (value) => number(value)?.toLocaleString('en-NG') ?? '—';
export const escrowMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG')}`;
export const escrowMillions = (value) => number(value) == null ? '—' : `₦${(number(value) / 1000000).toFixed(2)}M`;
export const escrowCount = (value, unit) => number(value) == null ? '—' : `${escrowNumber(value)} ${unit}`;

function datePart(value, time = false) {
  const date = text(value) ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(date);
}
function partyName(value) {
  const party = record(value);
  return text(party.name) ?? text(party.businessName) ?? text([text(party.firstName), text(party.lastName)].filter(Boolean).join(' '));
}

const balanceFields = [
  ['Held in Escrow', 'heldInEscrow', 'var(--tk-viz-1)'],
  ['Pending Release', 'pendingRelease', 'var(--tk-viz-3)'],
  ['Available to Settle', 'availableToSettle', 'var(--tk-viz-5)'],
  ['Disputed Amounts', 'disputedAmounts', 'var(--tk-danger-solid)'],
];
const summaryFields = ['totalEscrowBalance', 'heldInEscrow', 'pendingRelease', 'availableToSettle', 'completedReleases', 'disputedAmounts'];
export function adaptEscrowOverview(response) {
  const dto = record(unwrapApiResponseData(response));
  const escrow = record(dto.escrow);
  const breakdown = Array.isArray(dto.charts?.escrowBreakdown) ? dto.charts.escrowBreakdown : [];
  const disputed = breakdown.find((row) => row?.label === 'Held in disputes');
  const summary = Object.fromEntries(summaryFields.map((field) => [field, number(escrow[field])]));
  summary.heldInEscrow = number(escrow.heldInEscrow ?? escrow.inEscrow);
  summary.completedReleases = number(escrow.completedReleases ?? escrow.totalPaidOut);
  summary.disputedAmounts = number(escrow.disputedAmounts ?? disputed?.value);
  // The overview does not document comparison windows for the screen's dates.
  for (const field of summaryFields) summary[`${field}Delta`] = '—';
  return {
    summary,
    breakdown: balanceFields.map(([label, field, color]) => {
      const value = summary[field];
      return { label, value, color, pct: value != null && summary.totalEscrowBalance > 0 ? `${(value / summary.totalEscrowBalance * 100).toFixed(1)}%` : '—' };
    }),
  };
}
export const emptyEscrowOverview = adaptEscrowOverview(null);
export const unavailableEscrowWeeklyActivity = Object.fromEntries(['fundsHeld', 'fundsHeldTx', 'fundsReleased', 'fundsReleasedTx', 'settlementsMade', 'settlementsCount', 'newDisputes', 'newDisputesAmount'].map((field) => [field, null]));

// These are the existing rule rows, not generated records. Undocumented rule
// values stay unavailable; demurrage grace periods are not escrow hold periods.
export function adaptEscrowRules(response) {
  const fee = number(unwrapApiResponseData(response)?.config?.pricing?.platformFee);
  return [
    { id: 'ESR-001', icon: 'lock', iconTint: 'blue', name: 'Standard Hold Period', description: 'Funds held until delivery confirmation + 48 hours', value: '—' },
    { id: 'ESR-002', icon: 'shield-check', iconTint: 'green', name: 'Auto-Release on Confirmation', description: 'Releases automatically when customer confirms delivery', value: '—' },
    { id: 'ESR-003', icon: 'circle-alert', iconTint: 'red', name: 'Dispute Freeze', description: 'Freezes release while a dispute is open', value: '—' },
    { id: 'ESR-004', icon: 'percent', iconTint: 'purple', name: 'Platform Fee Deduction', description: 'Deducted from held amount before release', value: escrowMoney(fee) },
  ];
}

const invalid = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
// The UI has no pagination controls. Read every documented page, and never
// silently publish an incomplete list following a failed or malformed page.
async function readAll(baseQuery, api, url, key, filters = {}) {
  const rows = [], ids = new Set();
  for (let page = 1; ; page += 1) {
    if (api.signal.aborted) return invalid('The request was cancelled.');
    const result = await baseQuery({ url, params: { ...filters, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data));
    if (!Array.isArray(dto[key])) return invalid('The response is missing its record list.');
    const totalPages = number(dto.pagination?.totalPages);
    if (totalPages == null || !Number.isInteger(totalPages) || totalPages < 0) return invalid('The response is missing valid pagination.');
    let added = 0;
    for (const row of dto[key]) {
      const id = text(row?.id) ?? text(row?.tripId);
      if (!id) return invalid('The response contains a record without an ID.');
      if (!ids.has(id)) { ids.add(id); rows.push(row); added += 1; }
    }
    if (page >= totalPages) return { data: rows };
    if (!added) return invalid('The response did not advance to the next page.');
  }
}

export function adaptEscrowTrip(trip, jobResponse) {
  const dto = record(trip), financials = record(dto.financials), escrow = record(financials.escrow);
  const job = record(unwrapApiResponseData(jobResponse));
  const holdId = text(escrow.id), jobApiId = text(dto.jobId), tripId = text(dto.tripId);
  if (!holdId || !jobApiId || !tripId) return null;
  return {
    holdId, jobApiId, tripId,
    detailUrl: `/escrow/detail?id=${encodeURIComponent(holdId)}&tripId=${encodeURIComponent(tripId)}`,
    jobId: text(dto.jobNumber) ?? jobApiId,
    customer: partyName(job.forwarder) ?? '—',
    route: display(dto.route),
    // Trips expose payout installments, not the current held balance or hold
    // timestamps. Do not substitute job value, ETA, or trip creation time.
    amount: number(escrow.totalAmount),
    heldOn: datePart(escrow.heldAt), heldTime: datePart(escrow.heldAt, true), releaseBy: datePart(escrow.releaseBy),
    heldAt: text(escrow.heldAt), statusCode: text(escrow.status), status: status(escrow.status),
    activity: Array.isArray(job.activityLog) ? job.activityLog.filter((event) => event?.category === 'PAYMENT') : [],
  };
}

export function adaptEscrowTransaction(row) {
  const pos = row.direction === 'inflow' ? true : row.direction === 'outflow' ? false : null;
  const type = text(row.type);
  const held = type === 'ESCROW_HOLD' || type === 'ESCROW_LOCK';
  const released = type === 'ESCROW_RELEASE';
  return {
    id: display(row.id), reference: display(row.reference), jobId: display(row.jobId),
    party: partyName(row.party) ?? '—', type: status(type), typeCode: type,
    amount: number(row.amount), pos, statusCode: text(row.status), status: status(row.status),
    date: datePart(row.createdAt), time: datePart(row.createdAt, true), createdAt: text(row.createdAt),
    icon: held ? 'hourglass' : released ? 'arrow-up' : 'coins',
    tone: held ? 'var(--tk-warning)' : released ? 'var(--tk-success)' : 'var(--tk-blue)',
    releaseId: display(row.id), releasedTo: partyName(row.party) ?? '—',
    releasedOn: datePart(row.releasedAt), releasedTime: datePart(row.releasedAt, true), releasedBy: '—', settlementReference: display(row.settlementReference),
  };
}
export const escrowReleasesFromTransactions = (rows) => rows.filter((row) => row.typeCode === 'ESCROW_RELEASE' && row.statusCode === 'COMPLETED');

function adaptDispute(row, detail) {
  const source = record(detail), escrow = record(source.job?.escrow);
  return {
    id: display(row.id), jobId: text(row.job?.jobNumber) ?? display(row.jobId), jobApiId: text(row.jobId),
    holdId: display(escrow.id), amount: number(escrow.totalAmount),
    customer: partyName(row.raisedBy) ?? '—', reason: display(row.reason),
    opened: datePart(row.createdAt), statusCode: text(row.status), status: status(row.status),
  };
}

export const walletsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminEscrowOverview', 'AdminEscrowLedger', 'AdminEscrowDisputes', 'AdminEscrowActivity'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminEscrowOverview: builder.query({
      query: () => ({ url: '/admin/payments/overview', params: { period: 'all' } }),
      transformResponse: adaptEscrowOverview, providesTags: ['AdminEscrowOverview'],
    }),
    getAdminEscrowRegister: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/trips', 'trips');
        if (result.error) return result;
        const escrows = new Map();
        for (const trip of result.data) {
          const id = text(trip.financials?.escrow?.id);
          // An escrow is per job, even when a job has multiple trips.
          if (id && text(trip.jobId) && text(trip.tripId) && !escrows.has(id)) escrows.set(id, trip);
        }
        const rows = [];
        const trips = [...escrows.values()];
        for (let start = 0; start < trips.length; start += 4) {
          if (api.signal.aborted) return invalid('The request was cancelled.');
          const details = await Promise.all(trips.slice(start, start + 4).map(async (trip) => ({ trip, result: await baseQuery({ url: `/admin/jobs/${encodeURIComponent(trip.jobId)}` }) })));
          for (const { trip, result: detail } of details) {
            if (detail.error?.status === 401) return { error: detail.error };
            const row = adaptEscrowTrip(trip, detail.error ? null : detail.data);
            if (row) rows.push(row);
          }
        }
        return { data: rows };
      }, providesTags: ['AdminTrips', 'AdminJobs'],
    }),
    getAdminEscrowTrip: builder.query({
      async queryFn({ tripId, holdId }, _api, _options, baseQuery) {
        const result = await baseQuery({ url: `/admin/trips/${encodeURIComponent(tripId)}` });
        if (result.error) return result;
        const trip = record(unwrapApiResponseData(result.data));
        if (trip.financials?.escrow?.id !== holdId || !text(trip.jobId)) return invalid('This trip does not belong to the selected escrow.');
        const detail = await baseQuery({ url: `/admin/jobs/${encodeURIComponent(trip.jobId)}` });
        if (detail.error?.status === 401) return { error: detail.error };
        const row = adaptEscrowTrip(trip, detail.error ? null : detail.data);
        return row ? { data: row } : invalid('The trip response is missing its escrow details.');
      }, providesTags: ['AdminTrips', 'AdminJobs'],
    }),
    getAdminEscrowLedger: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/payments/transactions', 'rows', { tab: 'escrow' });
        return result.error ? result : { data: result.data.map(adaptEscrowTransaction) };
      }, providesTags: ['AdminEscrowLedger'],
    }),
    getAdminEscrowDisputes: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/disputes', 'disputes');
        if (result.error) return result;
        const rows = [];
        for (let start = 0; start < result.data.length; start += 4) {
          if (api.signal.aborted) return invalid('The request was cancelled.');
          const details = await Promise.all(result.data.slice(start, start + 4).map(async (row) => ({ row, result: await baseQuery({ url: `/admin/disputes/${encodeURIComponent(row.id)}` }) })));
          for (const { row, result: detail } of details) {
            if (detail.error?.status === 401) return { error: detail.error };
            rows.push(adaptDispute(row, detail.error ? null : unwrapApiResponseData(detail.data)));
          }
        }
        return { data: rows };
      }, providesTags: ['AdminEscrowDisputes'],
    }),
    getAdminEscrowRules: builder.query({ query: () => ({ url: '/admin/config' }), transformResponse: adaptEscrowRules, providesTags: ['AdminPricingConfig'] }),
    getAdminEscrowActivity: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/audit-logs', 'logs', { search: 'escrow' });
        if (result.error) return result;
        return { data: result.data.filter((row) => row.entityType === 'ESCROW' || /escrow/i.test(text(row.action) ?? '')).map((row) => ({ text: display(row.action), actor: partyName(row.admin) ?? '—', time: `${datePart(row.createdAt)} ${datePart(row.createdAt, true)}`, state: row.result === 'SUCCESS' ? 'done' : row.result === 'FAILED' ? 'danger' : 'pending' })) };
      }, providesTags: ['AdminEscrowActivity'],
    }),
  }),
});

export const { useGetAdminEscrowOverviewQuery, useGetAdminEscrowRegisterQuery, useGetAdminEscrowTripQuery, useGetAdminEscrowLedgerQuery, useGetAdminEscrowDisputesQuery, useGetAdminEscrowRulesQuery, useGetAdminEscrowActivityQuery } = walletsApi;
