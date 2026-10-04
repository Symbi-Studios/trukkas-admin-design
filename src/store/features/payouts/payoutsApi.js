import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const records = (value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
const number = (value) => {
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const status = (value) => value === 'PENDING' ? 'Pending Review' : label(value);
const bool = (value) => typeof value === 'boolean' ? value : null;
const name = (user) => text(user.name) || text(user.businessName) || text([text(user.firstName), text(user.lastName)].filter(Boolean).join(' '));
const identity = (row) => `${text(row?.source) || ''}:${row?.id}`;
const apiError = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });

export const payoutMoney = (value) => number(value) == null ? '—' : `₦${number(value).toLocaleString('en-NG')}`;
export const payoutNumber = (value) => number(value) == null ? '—' : number(value).toLocaleString('en-NG');
export const payoutDetailUrl = (payout) => `/payouts/detail?id=${encodeURIComponent(payout.id)}${payout.source ? `&source=${encodeURIComponent(payout.source)}` : ''}`;
export const payoutCompanyUrl = (id) => `/companies/detail?id=${encodeURIComponent(id)}&tab=payouts`;
export const payoutJobUrl = (id) => `/jobs/detail?id=${encodeURIComponent(id)}`;
export const payoutTransactionUrl = (id) => `/transactions/detail?id=${encodeURIComponent(id)}`;

function datePart(value, time = false) {
  if (!text(value) || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString('en-US', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) });
}

function profileType(profile) {
  if (profile.role === 'DRIVER') return 'driver';
  if (profile.role === 'TRUCKER' && profile.truckerType === 'COMPANY') return 'company';
  return null;
}

export function adaptAdminPayout(dto, profile = {}, pending = null, log = null) {
  profile = record(profile); pending = record(pending); log = record(log);
  const party = record(dto.party), requester = record(dto.requester);
  const partyId = text(party.id), confirmedProfile = profile.id === partyId ? profile : {};
  pending = partyId && pending.id === dto.id && pending.user?.id === partyId ? pending : {};
  log = partyId && log.id === dto.id && log.userId === partyId && dto.source !== 'user_withdrawal' ? log : {};
  const account = record(confirmedProfile.details?.account), user = record(pending.user), bank = record(pending.bankDetails);
  const partyType = profileType(confirmedProfile) || profileType(party);
  const companyId = partyType === 'company' ? partyId : null;
  const partyName = text(party.name) || name(user) || name(confirmedProfile) || '—';
  const payment = record(dto.payment);
  const rawStatus = text(dto.status);
  const awaitingReview = dto.source === 'user_withdrawal' && rawStatus === 'PENDING';
  const confirmedPending = awaitingReview && pending.id === dto.id && user.id === partyId;
  const canReview = awaitingReview;
  const job = record(dto.job), jobId = text(dto.jobId);
  const reconciliation = record(dto.reconciliation);
  const approvedOn = text(dto.approvedOn) || text(dto.approvedAt);
  const processedOn = text(dto.processedOn) || text(dto.processedAt);
  return {
    id: text(dto.id), key: identity(dto), source: text(dto.source), reference: text(dto.reference) || '—',
    party: partyName, partyId: partyId || '—', partyType, companyId,
    companyName: companyId ? partyName : null,
    type: partyType === 'driver' ? 'Driver Payout' : partyType === 'company' ? 'Company Payout' : '—',
    dateRequested: datePart(dto.createdAt), dateRequestedTime: datePart(dto.createdAt, true),
    timestamp: text(dto.createdAt) && Number.isFinite(Date.parse(dto.createdAt)) ? Date.parse(dto.createdAt) : null,
    amount: number(dto.amount), fee: number(dto.fee), grossAmount: number(dto.grossAmount), netAmount: number(dto.netAmount), deductions: number(dto.deductions),
    statusCode: rawStatus, status: status(rawStatus),
    requestedBy: text(dto.requestedBy) || text(log.admin?.name) || '—',
    requestedByRole: text(dto.requestedByRole) || '—',
    requester: {
      name: text(requester.name) || partyName, idBadge: partyId || '—',
      role: text(requester.role) || label(confirmedProfile.role || user.role || party.role),
      phone: text(requester.phone) || text(confirmedProfile.phone) || text(user.phone) || '—',
      email: text(requester.email) || text(party.email) || text(confirmedProfile.email) || text(user.email) || '—',
      status: label(requester.status || confirmedProfile.status || account.accountStatus),
      rating: number(requester.rating) ?? number(confirmedProfile.rating) ?? '—',
      totalTrips: number(requester.totalTrips) ?? number(confirmedProfile.stats?.totalTrips?.count) ?? '—',
      company: text(requester.company) || (companyId ? partyName : text(confirmedProfile.linkedCompany?.name)) || '—',
    },
    jobId, jobIds: Array.isArray(dto.jobIds) ? dto.jobIds.filter((id) => text(id)) : jobId ? [jobId] : null,
    tripIds: Array.isArray(dto.tripIds) ? dto.tripIds.filter((id) => text(id)) : null,
    route: text(dto.route) || text(job.route) || '—',
    job: Object.fromEntries(['jobId', 'tripId', 'route', 'truck', 'customer', 'cargoType', 'tripDates', 'status'].map((field) => [field, text(job[field]) || (field === 'jobId' ? jobId : null) || '—'])),
    allocations: Array.isArray(dto.allocations) ? records(dto.allocations).map((entry) => ({
      jobId: text(entry.jobId), tripId: text(entry.tripId), amount: number(entry.amount),
      trip: { truckPlate: text(entry.trip?.truckPlate) || '—', driverName: text(entry.trip?.driverName) || '—', status: label(entry.trip?.status) },
    })) : null,
    eligibility: text(dto.eligibility) || '—', approvalReady: bool(dto.approvalReady),
    reconciliation: { ok: bool(reconciliation.ok), issues: Array.isArray(reconciliation.issues) ? reconciliation.issues.filter((issue) => text(issue)) : [] },
    canReview, canApprove: confirmedPending, canReject: confirmedPending,
    relatedSettlement: text(dto.relatedSettlement), relatedTransaction: text(dto.relatedTransaction), escrowId: text(dto.escrowId),
    breakdown: records(dto.breakdown).map((entry) => ({ label: text(entry.label) || '—', value: number(entry.value) })),
    payment: {
      method: text(payment.method) || '—', bank: text(payment.bank) || '—',
      accountNumber: text(payment.accountNumber) || text(bank.accountNumber) || text(log.accountNumber) || '—',
      accountName: text(payment.accountName) || '—',
    },
    notes: text(dto.notes) || text(log.note) || '—', adminRemark: text(dto.adminRemark),
    description: text(dto.description) || text(pending.description) || '—', descriptionNote: text(dto.descriptionNote) || '—',
    approvedOn: approvedOn ? datePart(approvedOn) : '—', processedOn: processedOn ? datePart(processedOn) : '—',
    payoutSteps: [
      { title: 'Initiated', time: datePart(dto.createdAt), state: text(dto.createdAt) && Number.isFinite(Date.parse(dto.createdAt)) ? 'done' : 'pending', icon: 'check' },
      { title: 'Approved', time: approvedOn ? datePart(approvedOn) : '—', state: approvedOn && Number.isFinite(Date.parse(approvedOn)) ? 'done' : 'pending', icon: 'check' },
      { title: 'Processing', time: text(dto.processingAt) ? datePart(dto.processingAt) : '—', state: text(dto.processingAt) && Number.isFinite(Date.parse(dto.processingAt)) ? 'done' : 'pending', icon: 'check' },
      { title: 'Completed', time: processedOn ? datePart(processedOn) : '—', state: rawStatus === 'COMPLETED' ? 'done' : 'pending', icon: 'check' },
    ],
    approvalSteps: [
      { title: 'Submitted', time: datePart(dto.createdAt), state: text(dto.createdAt) && Number.isFinite(Date.parse(dto.createdAt)) ? 'done' : 'pending', icon: 'check' },
      { title: 'Under Review', time: text(dto.reviewedAt) ? datePart(dto.reviewedAt) : '—', state: text(dto.reviewedAt) && Number.isFinite(Date.parse(dto.reviewedAt)) ? 'done' : 'pending', icon: 'search' },
      { title: rawStatus === 'REJECTED' ? 'Rejected' : 'Approved', time: approvedOn ? datePart(approvedOn) : '—', state: approvedOn && Number.isFinite(Date.parse(approvedOn)) ? rawStatus === 'REJECTED' ? 'danger' : 'done' : 'pending', icon: rawStatus === 'REJECTED' ? 'x' : 'check' },
      { title: 'Processed', time: processedOn ? datePart(processedOn) : '—', state: processedOn && Number.isFinite(Date.parse(processedOn)) ? 'done' : 'pending', icon: 'banknote' },
    ],
    activity: records(dto.activity).map((entry) => ({ title: text(entry.title) || '—', description: text(entry.description) || '—', time: text(entry.time) || '—', state: text(entry.state) || 'pending', icon: text(entry.icon) })),
    documents: records(dto.documents).map((entry) => ({ name: text(entry.name) || '—', file: text(entry.file) || text(entry.size) || '—', kind: text(entry.kind), url: text(entry.url) })),
    issueNotes: records(dto.issueNotes).map((entry) => ({ note: text(entry.note) || '—', time: text(entry.time) || '—' })),
  };
}

async function allPages(baseQuery, api, url, collection) {
  const rows = [], seen = new Set();
  let page = 1, total = null, pages = null;
  do {
    if (api.signal.aborted) return apiError('Payout loading was cancelled.');
    const result = await baseQuery({ url, params: { page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!Array.isArray(dto[collection]) || pagination.page !== page || !Number.isInteger(pagination.total) || pagination.total < 0
      || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0 || !Number.isInteger(pagination.limit) || pagination.limit <= 0
      || (Math.ceil(pagination.total / pagination.limit) !== pagination.totalPages && !(pagination.total === 0 && pagination.totalPages === 1))) return apiError('The payout response is missing valid records or pagination.');
    if (page === 1) { total = pagination.total; pages = Math.max(1, pagination.totalPages); }
    if (pagination.total !== total || Math.max(1, pagination.totalPages) !== pages) return apiError('Payout records changed while loading. Please refresh the list.');
    for (const entry of dto[collection]) {
      const id = text(entry?.id), key = collection === 'payouts' ? identity(entry) : id;
      if (!id || seen.has(key)) return apiError('The payout response contains missing or repeated record IDs. Please refresh the list.');
      seen.add(key); rows.push(entry);
    }
    if (page < pages && !dto[collection].length) return apiError('The payout response returned an incomplete page.');
    page += 1;
  } while (page <= pages);
  return rows.length === total ? { data: rows } : apiError('The complete payout list could not be loaded.');
}

async function payoutDirectory(baseQuery, api) {
  const list = await allPages(baseQuery, api, '/admin/payouts/all', 'payouts');
  if (list.error) return list;
  const [pendingResult, history] = await Promise.all([
    baseQuery({ url: '/admin/withdrawals/pending' }),
    allPages(baseQuery, api, '/admin/payouts', 'logs'),
  ]);
  for (const result of [pendingResult, history]) if (result.error?.status === 401) return { error: result.error };
  const pendingDto = record(unwrapApiResponseData(pendingResult.data));
  const pending = new Map(records(pendingDto.withdrawals).filter((entry) => text(entry.id)).map((entry) => [entry.id, entry]));
  const logs = new Map((history.data || []).map((entry) => [entry.id, entry]));
  const userIds = [...new Set(list.data.map((entry) => text(entry.party?.id)).filter(Boolean))], profiles = new Map();
  // Role and truckerType are needed to distinguish drivers, companies and
  // individual truckers. A name or a bank withdrawal alone cannot identify them.
  for (let start = 0; start < userIds.length; start += 4) {
    if (api.signal.aborted) return apiError('Payout loading was cancelled.');
    const results = await Promise.all(userIds.slice(start, start + 4).map(async (id) => ({ id, result: await baseQuery({ url: `/admin/users/${encodeURIComponent(id)}/profile` }) })));
    for (const { id, result } of results) {
      if (result.error?.status === 401) return { error: result.error };
      const dto = record(unwrapApiResponseData(result.data));
      if (!result.error && dto.id === id) profiles.set(id, dto);
    }
  }
  const rows = list.data.map((entry) => {
    const id = text(entry.party?.id), log = logs.get(entry.id);
    const matchingLog = entry.source !== 'user_withdrawal' && log?.userId === id ? log : null;
    return adaptAdminPayout(entry, profiles.get(id), !pendingResult.error ? pending.get(entry.id) : null, matchingLog);
  });
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  return { data: { rows, total: rows.length, pendingAvailable: !pendingResult.error && Array.isArray(pendingDto.withdrawals) } };
}

export function payoutSummary(directory, withdrawalStats) {
  const rows = directory?.rows;
  const knownStatuses = rows != null && rows.every((row) => row.statusCode != null);
  const count = (values) => knownStatuses ? rows.filter((row) => values.includes(row.statusCode)).length : null;
  return {
    totalRequests: directory?.total ?? null,
    pending: count(['PENDING']),
    approved: number(withdrawalStats?.approved), rejected: number(withdrawalStats?.rejected),
    totalRequestedAmount: null, companyHeld: null, companyPaid: null,
    counts: { 'All Requests': directory?.total ?? null, Pending: count(['PENDING']), Approved: rows?.some((row) => row.statusCode === 'APPROVED') ? count(['APPROVED']) : null, Rejected: rows?.some((row) => row.statusCode === 'REJECTED') ? count(['REJECTED']) : null, Processing: count(['PROCESSING']) },
  };
}

async function reviewWithdrawal(baseQuery, api, { id, key, reason }, decision) {
  const directory = payoutsApi.endpoints.getAdminPayoutDirectory.select()(api.getState()).data;
  const payout = directory?.rows.find((entry) => entry.key === key && entry.id === id);
  if (!payout || !(decision === 'approve' ? payout.canApprove : payout.canReject)) return apiError('This payout is not a confirmed pending withdrawal. Refresh it before reviewing.');
  // Recheck immediately before a financial write. Cached PENDING must not allow
  // approval of a request another admin has already processed.
  const pending = await baseQuery({ url: '/admin/withdrawals/pending' });
  if (pending.error) return { error: pending.error };
  const dto = record(unwrapApiResponseData(pending.data));
  if (!Array.isArray(dto.withdrawals)) return apiError('Pending withdrawal eligibility could not be confirmed.');
  if (!dto.withdrawals.some((entry) => entry?.id === id && entry.user?.id === payout.partyId)) return apiError('This withdrawal is no longer pending. Refresh the payout before reviewing.');
  const result = await baseQuery({ url: `/admin/withdrawals/${encodeURIComponent(id)}/${decision}`, method: 'POST', ...(decision === 'reject' ? { body: text(reason) ? { reason: reason.trim() } : {} } : {}) });
  if (result.error) return { error: result.error };
  const response = record(unwrapApiResponseData(result.data));
  if (!text(response.message)) return apiError('The server did not confirm the payout decision. Refresh before trying again.');
  return { data: { message: [text(response.message), text(response.withdrawal?.message)].filter(Boolean).join(' '), reference: text(response.withdrawal?.reference), reason: text(response.reason) } };
}

export const payoutsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminPayoutDirectory', 'AdminPayoutWithdrawalStats', 'AdminTransactions'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminPayoutDirectory: builder.query({
      queryFn: (_args, api, _options, baseQuery) => payoutDirectory(baseQuery, api),
      providesTags: ['AdminPayoutDirectory', 'AdminCompanies', 'AdminDrivers', 'AdminForwarders'],
    }),
    getAdminPayoutWithdrawalStats: builder.query({
      query: () => ({ url: '/admin/withdrawals/stats' }),
      transformResponse: (response) => {
        const dto = record(unwrapApiResponseData(response)), stats = record(dto.stats);
        return Object.fromEntries(['pending', 'approved', 'rejected', 'totalPendingAmount'].map((key) => [key, number(stats[key])]));
      },
      providesTags: ['AdminPayoutWithdrawalStats'],
    }),
    approveAdminPayoutWithdrawal: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => reviewWithdrawal(baseQuery, api, args, 'approve'),
      invalidatesTags: ['AdminPayoutDirectory', 'AdminPayoutWithdrawalStats', 'AdminCompanies', 'AdminDrivers', 'AdminForwarders', 'AdminTransactions'],
    }),
    rejectAdminPayoutWithdrawal: builder.mutation({
      queryFn: (args, api, _options, baseQuery) => reviewWithdrawal(baseQuery, api, args, 'reject'),
      invalidatesTags: ['AdminPayoutDirectory', 'AdminPayoutWithdrawalStats', 'AdminCompanies', 'AdminDrivers', 'AdminForwarders', 'AdminTransactions'],
    }),
  }),
});

export const { useGetAdminPayoutDirectoryQuery, useGetAdminPayoutWithdrawalStatsQuery, useApproveAdminPayoutWithdrawalMutation, useRejectAdminPayoutWithdrawalMutation } = payoutsApi;
