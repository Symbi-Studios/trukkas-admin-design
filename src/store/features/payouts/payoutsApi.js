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
const money = (value) => number(value) != null && number(value) >= 0 ? number(value) : null;
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

function payoutTimestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function datePart(value, time = false) {
  const parsed = payoutTimestamp(value);
  if (parsed == null) return '—';
  return new Date(parsed).toLocaleString('en-US', { timeZone: 'Africa/Lagos', ...(time ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) });
}

const dateTime = (value) => datePart(value) === '—' ? '—' : datePart(value) + ', ' + datePart(value, true);

function profileType(profile) {
  if (profile.role === 'DRIVER') return 'driver';
  if (profile.role === 'TRUCKER' && profile.truckerType === 'COMPANY') return 'company';
  return null;
}

function requestFields(value) {
  const dto = record(value), beneficiary = record(dto.beneficiary), bank = record(dto.bank), requestedBy = record(dto.requestedBy);
  const related = record(dto.related), eligibility = record(dto.eligibility);
  const deductions = Array.isArray(dto.deductions) && dto.deductions.every((entry) => number(entry?.amount) != null && number(entry.amount) >= 0)
    ? dto.deductions.reduce((sum, entry) => sum + number(entry.amount), 0) : null;
  const jobs = records(dto.jobs), singleJob = jobs.length === 1 ? jobs[0] : {};
  const jobIds = Array.isArray(dto.jobIds) ? dto.jobIds.filter((id) => text(id)) : null;
  const trips = records(singleJob.trips), singleTrip = trips.length === 1 ? trips[0] : {};
  const route = record(singleJob.route), origin = text(record(route.origin).address), destination = text(record(route.destination).address);
  const job = {
    jobId: text(singleJob.jobId) || (jobIds?.length === 1 ? jobIds[0] : null),
    tripId: text(singleTrip.tripId), route: text(singleJob.route) || (origin && destination ? origin + ' → ' + destination : null),
    truck: text(singleTrip.truckPlate), customer: text(singleJob.customer), cargoType: text(singleJob.cargoType),
    tripDates: text(singleJob.tripDates), status: text(singleJob.status),
  };
  const stage = dto.reviewStatus === 'REJECTED' ? 'REJECTED' : dto.payoutStatus === 'PAID' ? 'COMPLETED'
    : dto.payoutStatus === 'AWAITING_APPROVAL' ? 'PENDING' : text(dto.payoutStatus) || text(dto.status);
  const ngn = dto.currency === 'NGN';
  const gross = number(dto.grossAmount), net = number(dto.netAmount);
  const validAmounts = ngn && gross != null && gross > 0 && net != null && net >= 0 && net <= gross
    && Number.isFinite(deductions) && Math.abs(gross - deductions - net) < 0.005;
  const isPending = dto.source === 'user_withdrawal' && dto.reviewStatus === 'PENDING_REVIEW' && dto.payoutStatus === 'AWAITING_APPROVAL';
  return { ...dto, id: dto.source === 'admin_payout' ? text(dto.payoutLogId) || text(dto.id) : text(dto.id),
    party: { ...beneficiary, role: beneficiary.type, truckerType: beneficiary.classification },
    requester: { ...beneficiary, role: beneficiary.type },
    requestedBy: text(requestedBy.name), requestedByRole: label(requestedBy.role),
    createdAt: dto.requestedAt, status: stage, reviewStatus: text(dto.reviewStatus), payoutStatus: text(dto.payoutStatus),
    amount: ngn ? money(dto.grossAmount) : null, grossAmount: ngn ? money(dto.grossAmount) : null,
    netAmount: ngn ? money(dto.netAmount) : null, deductions: ngn && Number.isFinite(deductions) ? deductions : null,
    fee: ngn && Number.isFinite(deductions) ? deductions : null,
    jobId: job.jobId, job, route: job.route,
    eligibility: eligibility.eligible === true ? 'Eligible' : eligibility.eligible === false ? 'Needs Review' : null,
    eligibilityReasons: Array.isArray(eligibility.reasons) ? eligibility.reasons.filter((reason) => text(reason)) : [],
    canApprove: isPending && dto.approvalReady === true && eligibility.eligible === true && validAmounts,
    canReject: isPending,
    payment: { method: text(dto.paymentMethod), bank: text(bank.bankName), accountNumber: text(bank.accountNumber), accountName: text(bank.accountName) },
    relatedSettlement: text(related.settlementId), relatedTransaction: text(related.transactionId),
    escrowId: Array.isArray(related.escrowIds) && related.escrowIds.length === 1 ? text(related.escrowIds[0]) : null,
    issueNotes: records(dto.issues).map((entry) => ({ note: entry.note, time: entry.createdAt })),
    adminRemark: text(dto.adminRemark) || text(record(dto.rejection).reason),
  };
}

export function adaptAdminPayout(dto, profile = {}) {
  dto = requestFields(dto);
  profile = record(profile);
  const party = record(dto.party), requester = record(dto.requester);
  const partyId = text(party.id), confirmedProfile = profile.id === partyId ? profile : {};
  const account = record(confirmedProfile.details?.account);
  const partyType = profileType(party) || profileType(confirmedProfile);
  const companyId = partyType === 'company' ? partyId : null;
  const partyName = text(party.name) || name(confirmedProfile) || '—';
  const payment = record(dto.payment);
  const rawStatus = text(dto.status);
  const awaitingReview = dto.source === 'user_withdrawal' && rawStatus === 'PENDING';
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
    timestamp: payoutTimestamp(dto.createdAt),
    amount: number(dto.amount), fee: number(dto.fee), grossAmount: number(dto.grossAmount), netAmount: number(dto.netAmount), deductions: number(dto.deductions),
    statusCode: rawStatus, status: status(rawStatus),
    requestedBy: text(dto.requestedBy) || '—',
    requestedByRole: text(dto.requestedByRole) || '—',
    requester: {
      name: text(requester.name) || partyName, idBadge: partyId || '—',
      role: text(requester.role) || label(confirmedProfile.role || party.role),
      phone: text(requester.phone) || text(confirmedProfile.phone) || '—',
      email: text(requester.email) || text(party.email) || text(confirmedProfile.email) || '—',
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
    canReview, canApprove: dto.canApprove === true, canReject: dto.canReject === true,
    reviewStatus: dto.reviewStatus, payoutStatus: dto.payoutStatus, eligibilityReasons: dto.eligibilityReasons,
    relatedSettlement: text(dto.relatedSettlement), relatedTransaction: text(dto.relatedTransaction), escrowId: text(dto.escrowId),
    breakdown: records(dto.breakdown).map((entry) => ({ label: text(entry.label) || '—', value: number(entry.value) })),
    payment: {
      method: text(payment.method) || '—', bank: text(payment.bank) || '—',
      accountNumber: text(payment.accountNumber) || '—',
      accountName: text(payment.accountName) || '—',
    },
    notes: text(dto.notes) || '—', adminRemark: text(dto.adminRemark),
    description: text(dto.description) || '—', descriptionNote: text(dto.descriptionNote) || '—',
    approvedOn: approvedOn ? datePart(approvedOn) : '—', processedOn: processedOn ? datePart(processedOn) : '—',
    payoutSteps: [
      { title: 'Initiated', time: datePart(dto.createdAt), state: payoutTimestamp(dto.createdAt) != null ? 'done' : 'pending', icon: 'check' },
      { title: 'Approved', time: approvedOn ? datePart(approvedOn) : '—', state: payoutTimestamp(approvedOn) != null ? 'done' : 'pending', icon: 'check' },
      { title: 'Processing', time: text(dto.processingAt) ? datePart(dto.processingAt) : '—', state: payoutTimestamp(dto.processingAt) != null ? 'done' : 'pending', icon: 'check' },
      { title: 'Completed', time: processedOn ? datePart(processedOn) : '—', state: rawStatus === 'COMPLETED' ? 'done' : 'pending', icon: 'check' },
    ],
    approvalSteps: [
      { title: 'Submitted', time: datePart(dto.createdAt), state: payoutTimestamp(dto.createdAt) != null ? 'done' : 'pending', icon: 'check' },
      { title: 'Under Review', time: text(dto.reviewedAt) ? datePart(dto.reviewedAt) : '—', state: payoutTimestamp(dto.reviewedAt) != null ? 'done' : 'pending', icon: 'search' },
      { title: rawStatus === 'REJECTED' ? 'Rejected' : 'Approved', time: approvedOn ? datePart(approvedOn) : '—', state: payoutTimestamp(approvedOn) != null ? rawStatus === 'REJECTED' ? 'danger' : 'done' : 'pending', icon: rawStatus === 'REJECTED' ? 'x' : 'check' },
      { title: 'Processed', time: processedOn ? datePart(processedOn) : '—', state: payoutTimestamp(processedOn) != null ? 'done' : 'pending', icon: 'banknote' },
    ],
    activity: records(dto.activity).map((entry) => ({ title: text(entry.title) || '—', description: text(entry.description) || '—', time: dateTime(entry.time), state: text(entry.state) || 'pending', icon: text(entry.icon) })),
    documents: records(dto.documents).map((entry) => ({ name: text(entry.name) || '—', file: text(entry.file) || text(entry.size) || '—', kind: text(entry.kind), url: text(entry.url) })),
    issueNotes: records(dto.issueNotes).map((entry) => ({ note: text(entry.note) || '—', time: dateTime(entry.time) })),
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
      const id = text(entry?.id), key = collection === 'requests' ? identity(entry) : id;
      if (!id || seen.has(key)) return apiError('The payout response contains missing or repeated record IDs. Please refresh the list.');
      seen.add(key); rows.push(entry);
    }
    if (page < pages && !dto[collection].length) return apiError('The payout response returned an incomplete page.');
    page += 1;
  } while (page <= pages);
  return rows.length === total ? { data: rows } : apiError('The complete payout list could not be loaded.');
}

async function payoutDirectory(baseQuery, api) {
  const list = await allPages(baseQuery, api, '/admin/payout-requests', 'requests');
  if (list.error) return list;
  if (list.data.some((entry) => !['user_withdrawal', 'admin_payout'].includes(entry.source))) return apiError('A payout source could not be confirmed.');
  const rows = list.data.map((entry) => adaptAdminPayout(entry));
  if (rows.some((row) => !row.id) || new Set(rows.map((row) => row.key)).size !== rows.length) return apiError('Payout identifiers could not be confirmed. Refresh the list.');
  rows.sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity));
  return { data: { rows, total: rows.length } };
}

export function payoutMatchesStatus(row, value) {
  if (value === 'Pending' || value === 'Pending Review') return row.reviewStatus === 'PENDING_REVIEW';
  if (value === 'Approved') return row.reviewStatus === 'APPROVED';
  if (value === 'Rejected') return row.reviewStatus === 'REJECTED';
  if (value === 'Processing') return row.payoutStatus === 'PROCESSING';
  return row.status === value;
}

export function payoutSummary(directory, summary) {
  const rows = directory?.rows;
  const knownReviews = rows != null && rows.every((row) => ['PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(row.reviewStatus));
  const count = (value) => knownReviews ? rows.filter((row) => payoutMatchesStatus(row, value)).length : null;
  return {
    totalRequests: summary?.totalRequests ?? directory?.total ?? null,
    pending: summary?.pending ?? count('Pending'), approved: summary?.approved ?? count('Approved'), rejected: summary?.rejected ?? count('Rejected'),
    totalRequestedAmount: summary?.totalRequestedAmount ?? null, companyHeld: summary?.companyHeld ?? null, companyPaid: summary?.companyPaid ?? null,
    counts: { 'All Requests': summary?.totalRequests ?? directory?.total ?? null, Pending: summary?.pending ?? count('Pending'),
      Approved: summary?.approved ?? count('Approved'), Rejected: summary?.rejected ?? count('Rejected'),
      Processing: rows != null && rows.every((row) => row.payoutStatus != null) ? rows.filter((row) => payoutMatchesStatus(row, 'Processing')).length : null },
  };
}

function payoutArgs(args) {
  if (!text(args?.id) || (args.source != null && !['user_withdrawal', 'admin_payout'].includes(args.source))) return null;
  return { id: args.id, source: args.source || undefined };
}

async function readPayout(baseQuery, args) {
  const target = payoutArgs(args);
  if (!target) return apiError('Select a payout with a valid source.');
  const result = await baseQuery({ url: '/admin/payouts/' + encodeURIComponent(target.id), params: { source: target.source } });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  if ((dto.id !== target.id && !(target.source === 'admin_payout' && dto.payoutLogId === target.id)) || !['user_withdrawal', 'admin_payout'].includes(dto.source) || (target.source && dto.source !== target.source) || !text(dto.beneficiary?.id)) return apiError('The response did not confirm the requested payout and beneficiary.');
  return { data: dto };
}

async function payoutDetail(baseQuery, api, args) {
  const result = await readPayout(baseQuery, args);
  if (result.error) return result;
  const [profileResult, documentsResult] = await Promise.all([
    baseQuery({ url: '/admin/users/' + encodeURIComponent(result.data.beneficiary.id) + '/profile' }),
    payoutDocuments(baseQuery, args),
  ]);
  for (const entry of [profileResult, documentsResult]) if (entry.error?.status === 401) return { error: entry.error };
  if (api.signal.aborted) return apiError('Payout loading was cancelled.');
  const profile = profileResult.error ? {} : record(unwrapApiResponseData(profileResult.data));
  return { data: { ...adaptAdminPayout(result.data, profile), documents: documentsResult.data || [] } };
}

async function reviewWithdrawal(baseQuery, api, args, decision) {
  const admin = api.getState().auth.admin;
  if (!text(admin?.id) || !api.getState().auth.accessToken) return apiError('Sign in before reviewing this payout.');
  const sameSession = () => !api.signal.aborted && api.getState().auth.accessToken && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  const fresh = await readPayout(baseQuery, args);
  if (fresh.error) return fresh;
  const payout = adaptAdminPayout(fresh.data);
  if (payout.source !== 'user_withdrawal' || !(decision === 'approve' ? payout.canApprove : payout.canReject)) return apiError(payout.eligibilityReasons.join(' ') || 'This payout is not eligible for this decision. Refresh it before reviewing.');
  if (!sameSession()) return apiError('The session changed. Refresh before continuing.');
  const body = decision === 'approve' ? (text(args.adminRemark) ? { adminRemark: text(args.adminRemark) } : {}) : (text(args.reason) ? { reason: text(args.reason) } : {});
  const result = await baseQuery({ url: '/admin/withdrawals/' + encodeURIComponent(payout.id) + '/' + decision, method: 'POST', body });
  if (result.error) return { error: result.error };
  const response = record(unwrapApiResponseData(result.data));
  if (!sameSession() || !text(response.message) || (decision === 'approve' && (response.status !== 'PROCESSING' || response.reference !== payout.reference || !text(response.transferReference) || (text(args.adminRemark) && response.adminRemark !== text(args.adminRemark))))) return apiError('The server did not confirm the payout decision. Refresh before trying again.');
  const confirmed = await readPayout(baseQuery, args);
  if (confirmed.error || !sameSession() || confirmed.data.reviewStatus !== (decision === 'approve' ? 'APPROVED' : 'REJECTED')) return apiError('The payout decision was submitted but could not be confirmed. Refresh before trying again.');
  return { data: { message: [text(response.message), text(response.withdrawal?.message)].filter(Boolean).join(' '), status: text(response.status) } };
}

async function changePayout(baseQuery, api, args, action) {
  const target = payoutArgs(args), admin = api.getState().auth.admin;
  const content = action === 'notes' && typeof args.note === 'string' ? args.note.trim() : text(action === 'request-info' ? args.message : args.note);
  if (!target || content == null || !text(admin?.id) || !api.getState().auth.accessToken) return apiError('Select a payout and enter the requested text.');
  const sameSession = () => !api.signal.aborted && api.getState().auth.accessToken && api.getState().auth.admin?.id === admin.id && api.getState().auth.admin?.role === admin.role;
  const fresh = await readPayout(baseQuery, target);
  if (fresh.error) return fresh;
  if (!sameSession()) return apiError('The session changed. Refresh before continuing.');
  const result = await baseQuery({ url: '/admin/payouts/' + encodeURIComponent(target.id) + '/' + action,
    method: action === 'notes' ? 'PATCH' : 'POST', body: { source: target.source, [action === 'request-info' ? 'message' : 'note']: content } });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  const confirmed = (dto.payoutId === target.id || dto.payoutId === fresh.data.id) && (action === 'notes' ? dto.notes === content && text(dto.updatedAt) && dto.updatedBy === admin.id
    : action === 'issues' ? text(dto.issueId) && dto.status === 'OPEN' && dto.note === content
    : text(dto.requestId) && dto.recipientId === fresh.data.beneficiary.id && dto.notificationStatus === 'QUEUED' && dto.channel === 'IN_APP_PUSH');
  if (!sameSession() || !confirmed) return apiError('The server did not confirm this payout action. Refresh before trying again.');
  return { data: { id: text(dto.requestId) || text(dto.issueId), status: text(dto.status) || text(dto.notificationStatus), notes: text(dto.notes) } };
}

async function payoutDocuments(baseQuery, args) {
  const target = payoutArgs(args);
  if (!target) return apiError('Select a payout with a valid source.');
  const result = await baseQuery({ url: '/admin/payouts/' + encodeURIComponent(target.id) + '/documents', params: { source: target.source } });
  if (result.error) return { error: result.error };
  const dto = record(unwrapApiResponseData(result.data));
  if (!Array.isArray(dto.documents)) return apiError('The payout document response is missing its document collection.');
  return { data: records(dto.documents).map((entry) => ({ name: text(entry.name) || '—', file: text(entry.size) || '—', kind: text(entry.kind), url: text(entry.url) })) };
}

async function payoutPdf(baseQuery, args, documentUrl) {
  const target = payoutArgs(args);
  if (!target) return apiError('Select a payout with a valid source.');
  let url = '/admin/payouts/' + encodeURIComponent(target.id) + '/statement', params = { source: target.source };
  if (documentUrl) {
    const documents = await payoutDocuments(baseQuery, target);
    if (documents.error) return documents;
    if (!documents.data.some((document) => document.url === documentUrl)) return apiError('This document no longer belongs to the selected payout. Refresh it.');
    const apiBase = new URL((process.env.NEXT_PUBLIC_API_BASE_URL || 'https://trukkas-backend.onrender.com/api/v1').replace(/\/+$/, '') + '/');
    let link;
    try { link = new URL(documentUrl, apiBase); } catch { return apiError('The payout document URL is invalid.'); }
    if (link.protocol !== 'https:' || link.username || link.password) return apiError('The payout document URL is invalid.');
    if (link.origin !== apiBase.origin) return { data: { url: link.href, external: true } };
    const path = link.pathname.slice(apiBase.pathname.length - 1);
    if (!link.pathname.startsWith(apiBase.pathname) || !/^\/admin\/(?:payouts\/[^/]+\/statement|payments\/[^/]+\/(?:receipt|statement))$/.test(path)) return apiError('The document download operation is not documented.');
    url = path; params = Object.fromEntries(link.searchParams);
  }
  const result = await baseQuery({ url, params, headers: { Accept: 'application/pdf' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    const body = await response.text();
    try { return JSON.parse(body); } catch { return { message: 'Unable to download this payout document.' }; }
  } });
  if (result.error) return { error: result.error };
  if (!(result.data instanceof Blob) || await result.data.slice(0, 5).text() !== '%PDF-') return apiError('The server did not return a valid PDF document.');
  return { data: { url: URL.createObjectURL(result.data), name: 'payout-' + target.id + '.pdf' } };
}

export function downloadPayoutFile(file) {
  if (file.external) { window.open(file.url, '_blank', 'noopener,noreferrer'); return; }
  const anchor = document.createElement('a'); anchor.href = file.url; anchor.download = file.name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(file.url), 1000);
}

const payoutTags = ['AdminPayoutDirectory', 'AdminPayoutSummary', 'AdminTransactions', 'AdminCompanies', 'AdminDrivers', 'AdminForwarders'];
export const payoutsApi = baseApi.enhanceEndpoints({ addTagTypes: payoutTags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminPayoutDirectory: builder.query({ queryFn: (_args, api, _options, baseQuery) => payoutDirectory(baseQuery, api), providesTags: payoutTags }),
    getAdminPayoutSummary: builder.query({
      query: () => ({ url: '/admin/payouts/summary' }),
      transformResponse: (response) => {
        const dto = record(unwrapApiResponseData(response)), ngn = dto.scope?.currency === 'NGN';
        const count = (value) => Number.isSafeInteger(number(value)) && number(value) >= 0 ? number(value) : null;
        const money = (value) => ngn && number(value) != null && number(value) >= 0 ? number(value) : null;
        return { totalRequests: count(dto.totalRequests), pending: count(dto.pendingReview), approved: count(dto.approved), rejected: count(dto.rejected),
          totalRequestedAmount: money(dto.totalRequestedAmount), companyHeld: money(dto.companyHeld), companyPaid: money(dto.companyPaid) };
      }, providesTags: ['AdminPayoutSummary'],
    }),
    getAdminPayoutDetail: builder.query({ queryFn: (args, api, _options, baseQuery) => payoutDetail(baseQuery, api, args), providesTags: payoutTags }),
    getAdminPayoutDocuments: builder.query({ queryFn: (args, _api, _options, baseQuery) => payoutDocuments(baseQuery, args), providesTags: ['AdminPayoutDirectory'] }),
    getAdminPayoutStatement: builder.query({ queryFn: (args, _api, _options, baseQuery) => payoutPdf(baseQuery, args) }),
    getAdminPayoutDocument: builder.query({ queryFn: ({ url, ...args }, _api, _options, baseQuery) => text(url) ? payoutPdf(baseQuery, args, url) : apiError('This payout document has no download URL.') }),
    approveAdminPayoutWithdrawal: builder.mutation({ queryFn: (args, api, _options, baseQuery) => reviewWithdrawal(baseQuery, api, args, 'approve'), invalidatesTags: payoutTags }),
    rejectAdminPayoutWithdrawal: builder.mutation({ queryFn: (args, api, _options, baseQuery) => reviewWithdrawal(baseQuery, api, args, 'reject'), invalidatesTags: payoutTags }),
    requestAdminPayoutInfo: builder.mutation({ queryFn: (args, api, _options, baseQuery) => changePayout(baseQuery, api, args, 'request-info'), invalidatesTags: payoutTags }),
    raiseAdminPayoutIssue: builder.mutation({ queryFn: (args, api, _options, baseQuery) => changePayout(baseQuery, api, args, 'issues'), invalidatesTags: payoutTags }),
    updateAdminPayoutNotes: builder.mutation({ queryFn: (args, api, _options, baseQuery) => changePayout(baseQuery, api, args, 'notes'), invalidatesTags: payoutTags }),
  }),
});

export const { useGetAdminPayoutDirectoryQuery, useGetAdminPayoutSummaryQuery, useGetAdminPayoutDetailQuery, useLazyGetAdminPayoutDocumentsQuery,
  useLazyGetAdminPayoutStatementQuery, useLazyGetAdminPayoutDocumentQuery, useApproveAdminPayoutWithdrawalMutation, useRejectAdminPayoutWithdrawalMutation,
  useRequestAdminPayoutInfoMutation, useRaiseAdminPayoutIssueMutation, useUpdateAdminPayoutNotesMutation } = payoutsApi;
