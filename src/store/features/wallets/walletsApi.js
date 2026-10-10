import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) && Number.isFinite(Number(value)) ? Number(value) : null;
const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
const naira = (value, currency) => currency === 'NGN' ? number(value) : null;
const display = (value) => text(value) ?? '—';
const status = (value) => text(value)?.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') ?? '—';

export const escrowNumber = (value) => number(value)?.toLocaleString('en-NG') ?? '—';
export const escrowMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG')}`;
export const escrowMillions = (value) => number(value) == null ? '—' : `₦${(number(value) / 1000000).toFixed(2)}M`;
export const escrowCount = (value, unit) => number(value) == null ? '—' : `${escrowNumber(value)} ${unit}`;

function datePart(value, time = false) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '—';
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (hour > 23 || minute > 59 || second > 59 || offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return '—';
  }
  const date = new Date(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(date);
}
function dateTime(value) {
  const date = datePart(value), time = datePart(value, true);
  return date === '—' || time === '—' ? '—' : date + ' ' + time;
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
  const balances = record(dto.escrowBalances), escrow = record(dto.escrow), comparison = record(dto.escrowComparison);
  const summary = {
    totalEscrowBalance: number(balances.totalBalance), heldInEscrow: number(balances.heldFunds),
    pendingRelease: number(balances.pendingRelease), availableToSettle: number(balances.availableToSettle),
    completedReleases: number(escrow.totalPaidOut), disputedAmounts: number(balances.disputed),
  };
  const deltas = {
    totalEscrowBalance: comparison.totalBalancePct, heldInEscrow: comparison.heldFundsPct,
    pendingRelease: comparison.pendingReleasePct, availableToSettle: comparison.availableToSettlePct,
    completedReleases: escrow.totalPaidOutVsLastPeriodPct, disputedAmounts: comparison.disputedPct,
  };
  for (const field of summaryFields) summary[field + 'Delta'] = number(deltas[field]) == null ? '—' : number(deltas[field]) + '%';
  const weeklyActivity = Object.fromEntries(Object.keys(unavailableEscrowWeeklyActivity).map((field) => [field,
    ['fundsHeldTx', 'fundsReleasedTx', 'settlementsCount', 'newDisputes'].includes(field) ? count(dto.weeklyActivity?.[field]) : number(dto.weeklyActivity?.[field]),
  ]));
  // A pie needs a complete partition. These balances may overlap (available
  // to settle can be part of pending release); keep the legend's real values
  // without plotting a misleading distribution.
  const categoryValues = balanceFields.map(([, field]) => summary[field]);
  const canPlot = summary.totalEscrowBalance != null && categoryValues.every((value) => value != null && value >= 0) && Math.abs(categoryValues.reduce((sum, value) => sum + value, 0) - summary.totalEscrowBalance) < 0.01;
  return {
    summary, weeklyActivity,
    breakdown: balanceFields.map(([label, field, color]) => {
      const value = summary[field];
      return { label, value, chartValue: canPlot ? value : null, color, pct: value != null && summary.totalEscrowBalance > 0 ? (value / summary.totalEscrowBalance * 100).toFixed(1) + '%' : '—' };
    }),
  };
}
export const unavailableEscrowWeeklyActivity = Object.fromEntries(['fundsHeld', 'fundsHeldTx', 'fundsReleased', 'fundsReleasedTx', 'settlementsMade', 'settlementsCount', 'newDisputes', 'newDisputesAmount'].map((field) => [field, null]));

export const emptyEscrowOverview = adaptEscrowOverview(null);

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
  let expectedTotal = null, expectedPages = null;
  for (let page = 1; page <= 500; page += 1) {
    if (api.signal.aborted) return invalid('The request was cancelled.');
    const result = await baseQuery({ url, params: { ...filters, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data));
    if (!Array.isArray(dto[key])) return invalid('The response is missing its record list.');
    const totalPages = count(dto.pagination?.totalPages), total = count(dto.pagination?.total);
    const returnedPage = count(dto.pagination?.page), limit = count(dto.pagination?.limit);
    if (totalPages == null || total == null || returnedPage !== page || !limit || limit > 100 || !(totalPages === Math.ceil(total / limit) || total === 0 && totalPages === 1) || totalPages > 500 || dto[key].length > limit) return invalid('The response is missing valid pagination.');
    if (expectedTotal != null && (total !== expectedTotal || totalPages !== expectedPages)) return invalid('The record list changed while loading. Please reload.');
    expectedTotal = total; expectedPages = totalPages;
    for (const row of dto[key]) {
      const id = text(row?.id);
      if (!id || ids.has(id)) return invalid('The response contains a missing or repeated record ID.');
      ids.add(id); rows.push(row);
    }
    if (page >= totalPages) return rows.length === total ? { data: rows } : invalid('The response contains an incomplete record list.');
    if (dto[key].length !== limit) return invalid('The response did not return a complete page.');
  }
  return invalid('The record list exceeds the supported page count.');
}

function routeLabel(value) {
  const route = record(value);
  const place = (location) => text(location?.address) ?? text(location?.port?.name);
  const origin = place(route.origin), destination = place(route.destination);
  return origin && destination ? origin + ' → ' + destination : '—';
}
export function adaptEscrowHold(value) {
  const dto = record(value), holdId = text(dto.id);
  if (!holdId) return null;
  return {
    holdId, jobApiId: text(dto.jobId), jobId: display(dto.jobNumber),
    detailUrl: '/escrow/detail?id=' + encodeURIComponent(holdId),
    customer: partyName(dto.customer) ?? '—', route: routeLabel(dto.route),
    // Held Amount is the unpaid balance, rather than the original job price.
    amount: naira(dto.currentHeldAmount, dto.currency),
    heldOn: datePart(dto.heldAt), heldTime: datePart(dto.heldAt, true), releaseBy: datePart(dto.releaseBy),
    heldAt: text(dto.heldAt), statusCode: text(dto.status), status: status(dto.status),
  };
}
export function adaptEscrowRelease(value) {
  const dto = record(value), actor = record(dto.releasedBy);
  return {
    releaseId: display(dto.id), escrowId: text(dto.escrowId), jobId: display(dto.jobNumber),
    releasedTo: partyName(dto.recipient) ?? '—', amount: number(dto.amount),
    releasedOn: datePart(dto.releasedAt), releasedTime: datePart(dto.releasedAt, true),
    releasedBy: actor.type === 'SYSTEM' ? 'System' : actor.type === 'ADMIN' ? partyName(actor.admin) ?? '—' : '—',
    reference: display(dto.reference), settlementReference: display(dto.settlementReference),
    statusCode: text(dto.status), status: status(dto.status), createdAt: text(dto.createdAt),
  };
}
function adaptActivity(value) {
  const dto = record(value), actor = record(dto.actor);
  return {
    text: display(dto.text), actor: actor.type === 'SYSTEM' ? 'System' : partyName(actor.admin) ?? partyName(actor.party) ?? partyName(actor) ?? '—',
    time: dateTime(dto.occurredAt),
    state: ['SUCCESS', 'COMPLETED'].includes(dto.result) ? 'done' : ['FAILED', 'FAILURE'].includes(dto.result) ? 'danger' : 'pending',
  };
}
async function readCollection(baseQuery, url, key, adapt) {
  const result = await baseQuery({ url });
  if (result.error) return result;
  const rows = unwrapApiResponseData(result.data)?.[key];
  if (!Array.isArray(rows) || rows.some((row) => !text(row?.id)) || new Set(rows.map((row) => row.id)).size !== rows.length) return invalid('The response is missing a valid record list.');
  return { data: rows.map(adapt) };
}

export function adaptEscrowTransaction(row) {
  const pos = row.direction === 'inflow' ? true : row.direction === 'outflow' ? false : null;
  const type = text(row.type);
  const held = type === 'ESCROW_HOLD' || type === 'ESCROW_LOCK';
  const released = type === 'ESCROW_RELEASE';
  return {
    id: display(row.id), reference: display(row.reference), jobId: display(row.jobId),
    party: partyName(row.party) ?? '—', type: text(row.typeLabel) ?? status(type), typeCode: type,
    amount: number(row.amount), pos, statusCode: text(row.status), status: status(row.status),
    date: datePart(row.createdAt), time: datePart(row.createdAt, true), createdAt: text(row.createdAt),
    icon: held ? 'hourglass' : released ? 'arrow-up' : 'coins',
    tone: held ? 'var(--tk-warning)' : released ? 'var(--tk-success)' : 'var(--tk-blue)',
    releaseId: display(row.id), releasedTo: partyName(row.party) ?? '—',
    releasedOn: datePart(row.releasedAt), releasedTime: datePart(row.releasedAt, true), releasedBy: '—', settlementReference: display(row.settlementReference),
  };
}

function adaptDispute(row, detail) {
  const source = record(detail), escrow = record(source.job?.escrow);
  return {
    id: display(row.id), jobId: text(row.job?.jobNumber) ?? display(row.jobId), jobApiId: text(row.jobId),
    holdId: display(escrow.id), amount: number(escrow.totalAmount),
    customer: partyName([source.raisedBy, source.against, row.raisedBy, row.against].find((party) => party?.role === 'FORWARDER')) ?? '—', reason: display(row.reason),
    opened: datePart(row.createdAt), statusCode: text(row.status), status: status(row.status),
  };
}

export const walletsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminEscrowOverview', 'AdminEscrowLedger', 'AdminEscrowDisputes', 'AdminEscrowActivity', 'AdminEscrowHolds', 'AdminEscrowReleases', 'AdminEscrowAccounts', 'AdminEscrowAlerts'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminEscrowOverview: builder.query({
      query: () => ({ url: '/admin/payments/overview', params: { period: 'all' } }),
      transformResponse: adaptEscrowOverview, providesTags: ['AdminEscrowOverview'],
    }),
    getAdminEscrowRegister: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/escrow/holds', 'holds', { status: 'ACTIVE' });
        return result.error ? result : { data: result.data.map(adaptEscrowHold) };
      }, providesTags: ['AdminEscrowHolds'],
    }),
    getAdminEscrowHold: builder.query({
      async queryFn({ holdId }, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/escrow/holds/' + encodeURIComponent(holdId) });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (dto.id !== holdId) return invalid('The response does not belong to the selected escrow.');
        return { data: adaptEscrowHold(dto) };
      }, providesTags: ['AdminEscrowHolds'],
    }),
    getAdminEscrowReleases: builder.query({
      async queryFn({ escrowId } = {}, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/escrow/releases', 'releases', escrowId ? { escrowId } : {});
        if (result.error) return result;
        if (escrowId && result.data.some((row) => row.escrowId !== escrowId)) return invalid('The response contains releases for another escrow.');
        return { data: result.data.map(adaptEscrowRelease) };
      }, providesTags: ['AdminEscrowReleases'],
    }),
    getAdminEscrowAccounts: builder.query({
      queryFn: (_args, _api, _options, baseQuery) => readCollection(baseQuery, '/admin/escrow/accounts', 'accounts', (row) => ({
        id: row.id, name: display(row.name), balance: naira(row.balance, row.currency), status: status(row.status),
      })), providesTags: ['AdminEscrowAccounts'],
    }),
    getAdminEscrowAlerts: builder.query({
      queryFn: (_args, _api, _options, baseQuery) => readCollection(baseQuery, '/admin/escrow/alerts', 'alerts', (row) => ({
        id: row.id, title: display(row.title), description: display(row.description),
        time: dateTime(row.occurredAt),
        icon: 'triangle-alert', tone: row.severity === 'CRITICAL' || row.severity === 'ERROR' ? 'danger' : row.severity === 'INFO' ? 'info' : 'warning',
      })), providesTags: ['AdminEscrowAlerts'],
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
            if ([401, 403].includes(detail.error?.status)) return { error: detail.error };
            const dto = detail.error ? null : record(unwrapApiResponseData(detail.data));
            if (dto && (dto.id !== row.id || dto.jobId !== row.jobId)) return invalid('The response does not belong to the selected dispute.');
            rows.push(adaptDispute(row, dto));
          }
        }
        return { data: rows };
      }, providesTags: ['AdminEscrowDisputes'],
    }),
    getAdminEscrowRules: builder.query({ query: () => ({ url: '/admin/config' }), transformResponse: adaptEscrowRules, providesTags: ['AdminPricingConfig'] }),
    getAdminEscrowActivity: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await readAll(baseQuery, api, '/admin/escrow/activity', 'events');
        return result.error ? result : { data: result.data.map(adaptActivity) };
      }, providesTags: ['AdminEscrowActivity'],
    }),
  }),
});

export const { useGetAdminEscrowOverviewQuery, useGetAdminEscrowRegisterQuery, useGetAdminEscrowHoldQuery, useGetAdminEscrowReleasesQuery, useGetAdminEscrowAccountsQuery, useGetAdminEscrowAlertsQuery, useGetAdminEscrowLedgerQuery, useGetAdminEscrowDisputesQuery, useGetAdminEscrowRulesQuery, useGetAdminEscrowActivityQuery } = walletsApi;
