import { defaultSerializeQueryArgs } from '@reduxjs/toolkit/query';
import { verificationDateParams } from './verificationDates.js';
import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const record = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const count = (v) => Number.isSafeInteger(v) && v >= 0 ? v : null;
const display = (v) => text(v) || '—';
const label = (v) => text(v)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const serializeVerificationQuery = args => defaultSerializeQueryArgs(args) + ':v3';
function scopedQuery(baseQuery, api, args = {}) {
  const auth = api.getState().auth, owner = auth.admin?.id, role = auth.admin?.role;
  const current = () => {
    const next = api.getState().auth;
    return !api.signal.aborted && Boolean(next.signedIn && owner) && next.admin?.id === owner && next.admin?.role === role && (args.owner == null || args.owner === owner) && (args.role == null || args.role === role);
  };
  return async request => {
    if (!current()) return failure('Your session changed. Reopen Verification before continuing.');
    const result = await baseQuery(request);
    return current() ? result : failure('Your session changed. Reopen Verification before continuing.');
  };
}
const STATUS = { PENDING: 'Pending', IN_REVIEW: 'In Review', VERIFIED: 'Verified', REJECTED: 'Rejected', NON_COMPLIANT: 'Non-Compliant', CANCELLED: 'Cancelled' };
const TYPES = { ACCOUNT_REVIEW: 'Account Verification', BUSINESS_VERIFICATION: 'Business Verification', TRUCK_REGISTRATION: 'Truck Registration', COMPANY_DOCUMENT: 'Company Document' };
const ENTITIES = { TRUCKER: 'Trucker', TRUCKING_COMPANY: 'Truck Company', DRIVER: 'Driver', FORWARDER: 'Forwarder', TRUCK: 'Truck' };
/** What the queue groups by: the backend merges these source queues into one list. */
export const VERIFICATION_KINDS = { ACCOUNT: 'Account', TRUCKER: 'Account', DRIVER: 'Account', KYB: 'Business (KYB)', COMPANY_DOCUMENT: 'Document', TRUCK: 'Truck' };
const SOURCES = { ACCOUNT: 'accounts', TRUCKER: 'truckers', DRIVER: 'drivers', KYB: 'kyb', TRUCK: 'trucks', COMPANY_DOCUMENT: 'company-documents' };
// The detail response names the exact approve/reject endpoints for its source record.
function actionPath(value, verb) {
  const path = text(value)?.replace(/^\/api\/v1/, '');
  return path && path.startsWith('/admin/') && path.endsWith('/' + verb) && !path.includes('..') ? path : null;
}
const sentence = (v) => { const t = text(v); return t ? t.charAt(0).toUpperCase() + t.slice(1) : null; };
const docType = (v) => { const t = text(v); if (!t) return null; const words = t.toLowerCase().split('_'); return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' '); };
const FILTERS = { entityType: { 'Truck Company': 'TRUCKING_COMPANY', Forwarder: 'FORWARDER', Driver: 'DRIVER', 'Individual Trucker': 'TRUCKER', Truck: 'TRUCK' }, verificationType: {
  'Business Verification': 'BUSINESS_VERIFICATION', 'License Verification': 'LICENSE',
  'Company Address Verification': 'ADDRESS', 'Fleet Verification': 'FLEET', 'Tax Identification (TIN)': 'TIN',
  'Insurance Verification': 'INSURANCE', 'Vehicle Documents': 'VEHICLE_DOCUMENTS',
} };
export const verificationFilterValue = (kind, choice) => choice === 'All Types' ? null : FILTERS[kind]?.[choice];
export const canReviewVerification = (role, source) => source === 'COMPANY_DOCUMENT' ? ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role) : ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role);
export const canManageVerification = (role) => ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role);
export function verificationDocumentUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function verificationDate(value, withTime = false) {
  if (!text(value)) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
const person = (v) => text(v) || text(record(v).name) || '—';
function progress(v) {
  const p = record(v), values = ['completed', 'inReview', 'pending', 'total'].map((key) => count(p[key]));
  return values.every((n) => n != null) && values[0] + values[1] + values[2] === values[3] ? { completed: values[0], inReview: values[1], pending: values[2], total: values[3] } : null;
}
export function adaptVerification(value) {
  const dto = record(value);
  const name = display(dto.entityName), assessment = record(dto.assessment);
  const requirements = Array.isArray(dto.requirements) && dto.requirements.every((r) => r && typeof r === 'object' && !Array.isArray(r)) ? dto.requirements.map((r, i) => {
    const doc = record(r.document);
    return {
      key: text(r.id) || String(i), name: display(r.name), sub: display(r.description), cat: label(r.category), statusCode: text(r.status), status: label(r.status),
      by: person(r.reviewer), on: verificationDate(r.reviewedAt, true), note: display(r.notes), url: verificationDocumentUrl(text(r.document) || doc.url),
      documentId: text(doc.id), fileName: text(doc.fileName), expiresAt: verificationDate(r.expiresAt), expiresAtRaw: text(r.expiresAt),
    };
  }) : [];
  const contact = record(dto.contact), submitter = record(dto.submittedBy), actions = record(dto.actions);
  const signals = Array.isArray(dto.riskSignals) && dto.riskSignals.every((v) => text(v)) ? dto.riskSignals.map(sentence) : [];
  const flag = (v) => typeof v === 'boolean' ? v : null;
  const approvePath = actionPath(actions.approve, 'approve'), rejectPath = actionPath(actions.reject, 'reject');
  const open = ['PENDING', 'IN_REVIEW'].includes(dto.status);
  return {
    key: dto.verificationId, id: dto.verificationId, reviewId: dto.verificationId, caseId: text(dto.caseId), source: text(dto.sourceType), sourceId: text(dto.sourceId), entityId: text(dto.entityId), verificationTypeCode: text(dto.verificationType),
    kind: VERIFICATION_KINDS[dto.sourceType] || '—', entityTypeCode: text(dto.entityType), documentType: docType(dto.documentType),
    entityName: name, initials: name === '—' ? '—' : name.split(/\s+/).slice(0, 2).map((p) => p[0]).join(''),
    entityType: ENTITIES[dto.entityType] || '—', regNo: display(dto.registrationNumber), type: TYPES[dto.verificationType] || '—',
    statusCode: text(dto.status), status: STATUS[dto.status] || '—', open, riskCode: ['LOW', 'MEDIUM', 'HIGH'].includes(dto.riskLevel) ? dto.riskLevel : null,
    riskLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(dto.riskLevel) ? label(dto.riskLevel) : '—', riskSignals: signals,
    submittedOn: verificationDate(dto.submittedAt, true), submittedAtRaw: text(dto.submittedAt), submittedBy: person(dto.submittedBy), submittedByRole: text(submitter.role),
    email: text(contact.email), phone: text(contact.phone), address: text(contact.address),
    contactHint: [text(contact.email), text(contact.phone)].filter(Boolean).join(' · ') || '—',
    assignedTo: display(dto.assignedAdminName), assignedRole: label(dto.assignedAdminRole), assignedAdminId: text(dto.assignedAdminId),
    dueDate: verificationDate(dto.dueDate, true), dueDateRaw: text(dto.dueDate), overdue: flag(dto.overdue), priority: label(dto.priority), priorityCode: text(dto.priority),
    country: display(dto.country), joined: verificationDate(dto.joinedAt), reviewedOn: verificationDate(dto.reviewedAt, true), reviewedAtRaw: text(dto.reviewedAt),
    expiresAt: verificationDate(dto.expiresAt), expiresAtRaw: text(dto.expiresAt), expiringSoon: flag(dto.expiringSoon), expired: flag(dto.expired),
    reason: text(dto.rejectionReason) || text(dto.outcomeReason), version: count(dto.version),
    progress: progress(dto.progress), requirements, documentCount: count(dto.documentCount), commentCount: count(dto.commentCount),
    assessment: label(assessment.outcome), assessmentDescription: display(assessment.description),
    screeningNote: text(assessment.riskIndicatorsNote),
    screeningChecked: Array.isArray(assessment.riskIndicators) && assessment.riskIndicators.some((r) => record(r).status && record(r).status !== 'NOT_CHECKED'),
    riskDescription: signals.length ? signals.join('; ') : '—',
    approvePath, rejectPath,
    canApprove: open && Boolean(approvePath), canReject: open && Boolean(rejectPath),
    documentIds: Array.isArray(dto.documentIds) && dto.documentIds.every((v) => text(v)) && new Set(dto.documentIds).size === dto.documentIds.length ? dto.documentIds : null,
  };
}
export const verificationDetailUrl = (row) => '/verification/detail?id=' + encodeURIComponent(row.reviewId);
export function adaptVerificationSummary(response) {
  const dto = record(unwrapApiResponseData(response)), total = count(dto.total);
  const keys = { PENDING: 'pending', IN_REVIEW: 'inReview', VERIFIED: 'verified', REJECTED: 'rejected', NON_COMPLIANT: 'nonCompliant', CANCELLED: 'cancelled' };
  const counts = Object.fromEntries(Object.entries(keys).map(([status, key]) => [status, count(dto[key])]));
  const complete = total != null && Object.values(counts).every(value => value != null) && Object.values(counts).reduce((sum, value) => sum + value, 0) === total;
  const share = status => {
    const matches = Array.isArray(dto.shares) ? dto.shares.filter(row => row?.status === status) : [];
    const row = matches.length === 1 ? matches[0] : null;
    return complete && count(row?.count) === counts[status] && typeof row?.percent === 'number' && Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100
      && (total > 0 || row.percent === 0) ? row.percent.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%' : '—';
  };
  return { total: total ?? '—', totalCaption: 'All time requests',
    ...Object.fromEntries(Object.entries(keys).flatMap(([status, key]) => [[key, counts[status] ?? '—'], [key + 'Share', share(status)]])),
    expiringSoon: count(dto.expiringSoon) ?? '—', expiringSoonCaption: 'Documents / Licenses' };
}
async function readDetail(baseQuery, id) {
  const result = await baseQuery({ url: '/admin/verification/' + encodeURIComponent(id) });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  return dto.verificationId === id ? { data: adaptVerification(dto) } : failure('The response does not identify the selected verification.');
}
async function confirmCreatedVerification(baseQuery, response, body) {
  const dto = record(unwrapApiResponseData(response)), id = text(dto.verificationId), caseId = text(dto.caseId), version = count(dto.version);
  if (!id || !caseId || version == null) return failure('The case request was submitted, but its saved identifiers and version could not be confirmed. Refresh before trying again.');
  const matches = value => value.id === id && value.caseId === caseId && value.version === version && Object.hasOwn(STATUS, value.statusCode)
    && (value.sourceId || value.entityId) === body.entityId && value.verificationTypeCode === body.verificationType
    && (!body.priority || value.priorityCode === body.priority)
    && (!body.assignedAdminId || value.assignedAdminId === body.assignedAdminId)
    && (!body.dueDate || new Date(value.dueDateRaw).getTime() === new Date(body.dueDate).getTime())
    && (!body.documentIds || value.documentIds?.length === body.documentIds.length && body.documentIds.every(documentId => value.documentIds.includes(documentId)));
  let saved = adaptVerification(dto);
  if (!matches(saved)) {
    const detail = await readDetail(baseQuery, id);
    if (detail.error) return failure('The case request was submitted, but its saved details could not be confirmed. Refresh before trying again.');
    saved = detail.data;
  }
  return matches(saved) ? { data: { accepted: true, verificationId: id, caseId, version } }
    : failure('The case request was submitted, but its saved fields could not be confirmed. Refresh before trying again.');
}
async function pages(baseQuery, api, url, select, identity, filters = {}) {
  const rows = [], seen = new Set(), owner = api.getState().auth.admin?.id;
  let total = null, totalPages = null;
  for (let page = 1; page <= 500; page += 1) {
    if (api.signal.aborted || api.getState().auth.admin?.id !== owner) return failure('Verification loading was cancelled.');
    const result = await baseQuery({ url, params: { ...filters, page, limit: 100 } });
    if (result.error) return result;
    if (api.getState().auth.admin?.id !== owner) return failure('Verification loading was cancelled.');
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination), list = select(dto);
    const size = count(pagination.limit), nextTotal = count(pagination.total), nextPages = count(pagination.totalPages);
    if (!Array.isArray(list) || count(pagination.page) !== page || !size || size > 100 || nextTotal == null || nextPages == null || nextPages > 500 || Math.max(1, nextPages) !== Math.max(1, Math.ceil(nextTotal / size)) || list.length > size) return failure('The verifications could not be loaded completely. Please refresh.');
    if (total != null && (nextTotal !== total || nextPages !== totalPages)) return failure('Verifications changed while loading. Refresh and try again.');
    total = nextTotal; totalPages = nextPages;
    for (const row of list) { const key = identity(row); if (!key || seen.has(key)) return failure('The response has missing or duplicate verification records.'); seen.add(key); rows.push(row); }
    if (page >= totalPages) return rows.length === total ? { data: rows } : failure('The verification response is incomplete.');
    if (list.length !== size) return failure('The verification response contains an incomplete page.');
  }
  return failure('The verification collection exceeds the supported page count.');
}
function historyItems(dto) {
  return Array.isArray(dto.events) && dto.events.every(value => value && typeof value === 'object' && !Array.isArray(value)) ? dto.events : null;
}
async function download(baseQuery, id, kind, filters) {
  if (!['documents', 'report'].includes(kind) || id != null && !text(id) || kind === 'documents' && !text(id)) return failure('Unsupported verification download.');
  const zip = kind === 'documents', format = zip ? 'zip' : 'pdf';
  const url = id ? '/admin/verification/' + encodeURIComponent(id) + (zip ? '/documents/download' : '/report') : '/admin/verification/report';
  const result = await baseQuery({ url, params: { ...filters, ...(zip ? { format } : {}) }, headers: { Accept: zip ? 'application/zip' : 'application/pdf' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    try { return JSON.parse(await response.text()); } catch { return { message: 'Unable to download the verification document.' }; }
  } });
  if (result.error) return result;
  if (!(result.data instanceof Blob) || !result.data.size) return failure('No verification document was returned.');
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  if (zip ? bytes[0] !== 80 || bytes[1] !== 75 || ![[3,4],[5,6],[7,8]].some(([a,b]) => bytes[2] === a && bytes[3] === b) : String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return failure('Unable to prepare the ' + format.toUpperCase() + ' document.');
  let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return { data: { content: btoa(binary), format } };
}
export function saveVerificationDocument(document) {
  const bytes = Uint8Array.from(atob(document.content), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: document.format === 'zip' ? 'application/zip' : 'application/pdf' }));
  const link = window.document.createElement('a'); link.href = url; link.download = 'verification.' + document.format; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const tags = ['AdminVerificationDirectory', 'AdminVerificationDetail', 'AdminVerificationHistory'];
const invalidations = [...tags, 'AdminCompanies', 'AdminDrivers', 'AdminDriverStats', 'AdminForwarders', 'AdminFleet'];
export const verificationApi = baseApi.enhanceEndpoints({ addTagTypes: tags }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminVerificationSummary: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      async queryFn(args, api, _options, baseQuery) {
        const result = await scopedQuery(baseQuery, api, args)({ url: '/admin/verification/summary', params: { expiryWindowDays: 30, ...(args?.dateFrom && args?.dateTo ? { dateFrom: args.dateFrom, dateTo: args.dateTo } : {}) } });
        return result.error ? result : { data: adaptVerificationSummary(result.data) };
      }, providesTags: ['AdminVerificationDirectory'],
    }),
    getAdminVerificationDirectory: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      async queryFn(args, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery, api, args);
        const dates = args?.range ? verificationDateParams(args.range) : {};
        if (!dates) return failure('Choose a valid verification date range.');
        if (args?.entityType != null && ![...Object.keys(ENTITIES), ...Object.values(FILTERS.entityType)].includes(args.entityType)
          || args?.verificationType != null && ![...Object.keys(TYPES), ...Object.values(FILTERS.verificationType), 'FORWARDER'].includes(args.verificationType)) return failure('Choose a supported verification filter.');
        const filters = { ...dates, ...(args?.entityType ? { entityType: args.entityType } : {}), ...(args?.verificationType ? { verificationType: args.verificationType } : {}) };
        const result = await pages(baseQuery, api, '/admin/verification', (dto) => dto.verifications, (dto) => text(dto?.verificationId), filters);
        return result.error ? result : { data: result.data.map(adaptVerification) };
      }, providesTags: ['AdminVerificationDirectory'],
    }),
    getAdminVerificationDetail: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      async queryFn(args, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery, api, args);
        if (!text(args.id)) return failure('A verification ID is required.');
        if (args.source && SOURCES[args.source]) {
          const directory = await pages(baseQuery, api, '/admin/verification', (dto) => dto.verifications, (dto) => text(dto?.verificationId));
          if (directory.error) return directory;
          const row = directory.data.find((dto) => dto.verificationId === args.id || dto.sourceType === args.source && dto.sourceId === args.id);
          return row ? readDetail(baseQuery, row.verificationId) : { data: null };
        }
        return readDetail(baseQuery, args.id);
      }, providesTags: ['AdminVerificationDetail'],
    }),
    getAdminVerificationHistory: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      queryFn: (args, api, _options, baseQuery) => text(args.id) ? pages(scopedQuery(baseQuery, api, args), api, '/admin/verification/' + encodeURIComponent(args.id) + '/history', historyItems, (dto) => text(dto?.id)) : failure('A verification ID is required.'),
      providesTags: ['AdminVerificationHistory'],
    }),
    getAdminVerificationEntries: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      queryFn: (args, api, _options, baseQuery) => text(args.id) && ['comments', 'notes'].includes(args.kind) ? pages(scopedQuery(baseQuery, api, args), api, '/admin/verification/' + encodeURIComponent(args.id) + '/' + args.kind, (dto) => {
        return Array.isArray(dto.items) && count(dto.total) === count(dto.pagination?.total)
          && dto.items.every(row => row?.kind === (args.kind === 'comments' ? 'COMMENT' : 'NOTE')) ? dto.items : null;
      }, (dto) => text(dto?.id)) : failure('Unsupported verification entry collection.'),
      providesTags: ['AdminVerificationHistory'],
    }),
    getAdminVerificationDownload: builder.query({
      serializeQueryArgs: serializeVerificationQuery,
      queryFn: (args, api, _options, baseQuery) => download(scopedQuery(baseQuery, api, args), args.id, args.kind, args.filters),
    }),
    decideAdminVerification: builder.mutation({
      async queryFn({ id, decision, reason, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.signedIn) return failure('Your session changed. Reload before deciding.');
        if (!text(id) || !['approve', 'reject'].includes(decision)) return failure('A verification and decision are required.');
        if (decision === 'reject' && (!text(reason) || reason.trim().length > 500)) return failure('Enter a reason of up to 500 characters.');
        const current = await readDetail(baseQuery, id); if (current.error) return current;
        const v = current.data, path = decision === 'approve' ? v.approvePath : v.rejectPath;
        if (owner !== api.getState().auth.admin?.id || api.signal.aborted) return failure('Your session changed. Reload before deciding.');
        if (!canReviewVerification(api.getState().auth.admin?.role, v.source) || !path || !v.open) return failure('This verification can’t be ' + (decision === 'approve' ? 'approved' : 'rejected') + ' by your account in its current state.');
        const result = await baseQuery({ url: path, method: 'POST', ...(decision === 'reject' ? { body: { reason: reason.trim() } } : {}) });
        if (result.error) return result;
        const confirmed = await readDetail(baseQuery, id);
        const expected = decision === 'approve' ? ['VERIFIED'] : ['REJECTED', 'NON_COMPLIANT'];
        if (confirmed.error || !expected.includes(confirmed.data.statusCode)) return failure('The decision was sent, but its result could not be confirmed. Refresh before trying again.');
        return { data: { message: decision === 'approve' ? 'Verification approved' : 'Verification rejected' } };
      }, invalidatesTags: invalidations,
    }),
    changeAdminVerification: builder.mutation({
      async queryFn({ action, id, body, owner, role }, api, _options, baseQuery) {
        baseQuery = scopedQuery(baseQuery, api, { owner, role });
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.signedIn) return failure('Your session changed. Reload before saving.');
        if (!canManageVerification(api.getState().auth.admin?.role)) return failure('Your account cannot manage verifications.');
        if (['edit', 'reassign', 'information', 'cancel'].includes(action) && !['SUPER_ADMIN', 'OPS_ADMIN'].includes(api.getState().auth.admin?.role)) return failure('Only Super Admins and Operations Admins can perform this verification action.');
        const config = { create: ['POST', ''], edit: ['PATCH', ''], reassign: ['POST', '/reassign'], information: ['POST', '/request-information'], noncompliant: ['POST', '/mark-non-compliant'], cancel: ['POST', '/cancel'], comment: ['POST', '/comments'], note: ['POST', '/notes'] }[action];
        if (!config || action !== 'create' && !text(id)) return failure('Unsupported verification action.');
        let current;
        if (action !== 'create') {
          current = await readDetail(baseQuery, id); if (current.error) return current;
          if (!['comment', 'note'].includes(action) && (count(body.expectedVersion) == null || current.data.version !== body.expectedVersion)) return failure('The verification changed or has no documented version. Refresh before saving.');
          if (action === 'noncompliant' && !canReviewVerification(api.getState().auth.admin?.role, current.data.source)) return failure('Your account cannot reject this source record.');
        }
        if (owner !== api.getState().auth.admin?.id || api.signal.aborted) return failure('Your session changed. Reload before saving.');
        const result = await baseQuery({ url: '/admin/verification' + (action === 'create' ? '' : '/' + encodeURIComponent(id)) + config[1], method: config[0], body });
        if (result.error) return result;
        if (['comment', 'note'].includes(action)) {
          const saved = record(unwrapApiResponseData(result.data));
          return text(saved.id) && saved.kind === (action === 'comment' ? 'COMMENT' : 'NOTE') && saved.body === body.body
            && saved.author?.id === owner && saved.author?.role === role && verificationDate(saved.createdAt, true) !== '—'
            ? { data: { accepted: true } } : failure('The entry was submitted, but its saved body and author could not be confirmed. Refresh before trying again.');
        }
        if (action === 'create') {
          return confirmCreatedVerification(baseQuery, result.data, body);
        }
        const confirmed = await readDetail(baseQuery, id); if (confirmed.error) return failure('The update was submitted, but could not be refreshed. Refresh before trying again.');
        const v = confirmed.data;
        const valid = action === 'cancel' ? v.statusCode === 'CANCELLED' : action === 'noncompliant' ? v.statusCode === 'NON_COMPLIANT' : action === 'reassign' ? v.assignedAdminId === body.assignedAdminId : action === 'information' ? (current.data.statusCode === 'PENDING' ? v.statusCode === 'IN_REVIEW' : v.statusCode === current.data.statusCode) && text(record(unwrapApiResponseData(result.data)).requestId) : (!body.priority || v.priorityCode === body.priority) && (!body.documentIds || Array.isArray(v.documentIds) && body.documentIds.length === v.documentIds.length && body.documentIds.every((documentId) => v.documentIds.includes(documentId))) && (!Object.hasOwn(body, 'dueDate') || (body.dueDate === null ? v.dueDateRaw === null : new Date(v.dueDateRaw).getTime() === new Date(body.dueDate).getTime()));
        return valid ? { data: { accepted: true } } : failure('The update was submitted, but its requested values could not be confirmed. Refresh before trying again.');
      }, invalidatesTags: invalidations,
    }),
  }),
});
export const { useGetAdminVerificationSummaryQuery, useGetAdminVerificationDirectoryQuery, useGetAdminVerificationDetailQuery, useGetAdminVerificationHistoryQuery, useGetAdminVerificationEntriesQuery, useLazyGetAdminVerificationDownloadQuery, useDecideAdminVerificationMutation, useChangeAdminVerificationMutation } = verificationApi;
