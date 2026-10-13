import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const record = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const count = (v) => Number.isInteger(v) && v >= 0 ? v : null;
const display = (v) => text(v) || '—';
const label = (v) => text(v)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const STATUS = { PENDING: 'Pending', IN_REVIEW: 'In Review', VERIFIED: 'Verified', REJECTED: 'Rejected', NON_COMPLIANT: 'Non-Compliant', CANCELLED: 'Cancelled' };
const TYPES = { ACCOUNT_REVIEW: 'Account Verification', BUSINESS_VERIFICATION: 'Business Verification', EXPORTER_LICENCE: 'Export License', TRUCK_REGISTRATION: 'Truck Registration', COMPANY_DOCUMENT: 'Company Document' };
const ENTITIES = { TRUCKER: 'Trucker', TRUCKING_COMPANY: 'Truck Company', DRIVER: 'Driver', EXPORTER: 'Exporter', TRUCK: 'Truck' };
const SOURCES = { TRUCKER: 'truckers', DRIVER: 'drivers', KYB: 'kyb', EXPORTER_LICENSE: 'exporter-licenses', TRUCK: 'trucks', COMPANY_DOCUMENT: 'company-documents' };
export const canReviewVerification = (role, source) => source === 'COMPANY_DOCUMENT' ? ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role) : ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role);
export const canManageVerification = (role) => ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role);
export function verificationDocumentUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function verificationDate(value, withTime = false) {
  if (!text(value)) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
const person = (v) => text(v) || text(record(v).name) || '—';
function progress(v) {
  const p = record(v), values = ['completed', 'inReview', 'pending', 'total'].map((key) => count(p[key]));
  return values.every((n) => n != null) && values[0] + values[1] + values[2] === values[3] ? { completed: values[0], inReview: values[1], pending: values[2], total: values[3] } : null;
}
export function adaptVerification(dto) {
  const name = display(dto.entityName), assessment = record(dto.assessment);
  const requirements = Array.isArray(dto.requirements) && dto.requirements.every((r) => r && typeof r === 'object' && !Array.isArray(r)) ? dto.requirements.map((r, i) => ({
    key: text(r.id) || String(i), name: display(r.name), sub: display(r.description), cat: label(r.category), status: label(r.status),
    by: person(r.reviewer), on: verificationDate(r.reviewedAt, true), note: display(r.notes), url: verificationDocumentUrl(text(r.document) || record(r.document).url),
  })) : [];
  const contact = record(dto.contact);
  return {
    key: dto.verificationId, id: dto.verificationId, reviewId: dto.verificationId, source: text(dto.sourceType), sourceId: text(dto.sourceId), entityId: text(dto.entityId),
    entityName: name, initials: name === '—' ? '—' : name.split(/\s+/).slice(0, 2).map((p) => p[0]).join(''),
    entityType: ENTITIES[dto.entityType] || '—', regNo: display(dto.registrationNumber), type: TYPES[dto.verificationType] || '—',
    statusCode: text(dto.status), status: STATUS[dto.status] || '—', riskLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(dto.riskLevel) ? label(dto.riskLevel) : '—',
    submittedOn: verificationDate(dto.submittedAt, true), submittedBy: person(dto.submittedBy), contactHint: [text(contact.email), text(contact.phone)].filter(Boolean).join(' · ') || '—',
    assignedTo: display(dto.assignedAdminName), assignedRole: label(dto.assignedAdminRole), assignedAdminId: text(dto.assignedAdminId),
    dueDate: verificationDate(dto.dueDate, true), dueDateRaw: text(dto.dueDate), priority: label(dto.priority), priorityCode: text(dto.priority),
    country: display(dto.country), joined: verificationDate(dto.joinedAt), reviewedOn: verificationDate(dto.reviewedAt, true),
    expiringSoon: typeof dto.expiringSoon === 'boolean' ? dto.expiringSoon : null, version: count(dto.version),
    progress: progress(dto.progress), requirements, documentCount: count(dto.documentCount), commentCount: count(dto.commentCount),
    assessment: display(assessment.outcome), assessmentDescription: display(assessment.description),
    riskDescription: Array.isArray(dto.riskSignals) && dto.riskSignals.every((v) => text(v)) ? dto.riskSignals.join('; ') || '—' : '—',
    canApprove: (!Object.hasOwn(dto, 'actions') || dto.actions != null) && ['PENDING', 'IN_REVIEW'].includes(dto.status) && Boolean(SOURCES[dto.sourceType] && text(dto.sourceId)),
    documentIds: Array.isArray(dto.documentIds) && dto.documentIds.every((v) => text(v)) ? dto.documentIds : null,
  };
}
export const verificationDetailUrl = (row) => '/verification/detail?id=' + encodeURIComponent(row.reviewId);
export function verificationSummary(rows) {
  const valid = Array.isArray(rows) && rows.every((r) => STATUS[r.statusCode]);
  const n = (status) => valid ? rows.filter((r) => r.statusCode === status).length : '—';
  const share = (status) => valid ? (rows.length ? (n(status) / rows.length * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0') + '%' : '—';
  return { total: valid ? rows.length : '—', totalCaption: 'All time requests', pending: n('PENDING'), pendingShare: share('PENDING'),
    inReview: n('IN_REVIEW'), inReviewShare: share('IN_REVIEW'), verified: n('VERIFIED'), verifiedShare: share('VERIFIED'), rejected: n('REJECTED'), rejectedShare: share('REJECTED'),
    expiringSoon: Array.isArray(rows) && rows.every((r) => typeof r.expiringSoon === 'boolean') ? rows.filter((r) => r.expiringSoon).length : '—', expiringSoonCaption: 'Documents / Licenses' };
}
async function readDetail(baseQuery, id) {
  const result = await baseQuery({ url: '/admin/verification/' + encodeURIComponent(id) });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  return dto.verificationId === id ? { data: adaptVerification(dto) } : failure('The response does not identify the selected verification.');
}
async function pages(baseQuery, api, url, select, identity) {
  const rows = [], seen = new Set(), owner = api.getState().auth.admin?.id;
  let total = null, totalPages = null;
  for (let page = 1; page <= 500; page += 1) {
    if (api.signal.aborted || api.getState().auth.admin?.id !== owner) return failure('Verification loading was cancelled.');
    const result = await baseQuery({ url, params: { page, limit: 100 } });
    if (result.error) return result;
    if (api.getState().auth.admin?.id !== owner) return failure('Verification loading was cancelled.');
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination), list = select(dto);
    const size = count(pagination.limit), nextTotal = count(pagination.total), nextPages = count(pagination.totalPages);
    if (!Array.isArray(list) || count(pagination.page) !== page || !size || size > 100 || nextTotal == null || nextPages == null || nextPages > 500 || Math.max(1, nextPages) !== Math.max(1, Math.ceil(nextTotal / size)) || list.length > size) return failure('The response is missing verification records or valid pagination.');
    if (total != null && (nextTotal !== total || nextPages !== totalPages)) return failure('Verifications changed while loading. Refresh and try again.');
    total = nextTotal; totalPages = nextPages;
    for (const row of list) { const key = identity(row); if (!key || seen.has(key)) return failure('The response has missing or duplicate verification records.'); seen.add(key); rows.push(row); }
    if (page >= totalPages) return rows.length === total ? { data: rows } : failure('The verification response is incomplete.');
    if (list.length !== size) return failure('The verification response contains an incomplete page.');
  }
  return failure('The verification collection exceeds the supported page count.');
}
function historyItems(dto) {
  const arrays = Object.values(dto).filter(Array.isArray);
  // The envelope is undocumented: accept only an actual, unambiguous event collection.
  return arrays.length === 1 && arrays[0].every((v) => text(v?.timestamp) && !Number.isNaN(new Date(v.timestamp).getTime())) ? arrays[0] : null;
}
const EVENTS = ['APPLICATION_SUBMITTED', 'DOCUMENT_REVIEW', 'INFORMATION_VERIFICATION', 'COMPLIANCE_ASSESSMENT', 'FINAL_DECISION'];
export function verificationTimeline(model, events) {
  return EVENTS.map((type, i) => {
    const event = events?.find((e) => Object.values(e).includes(type));
    return { title: ['Application Submitted', 'Document Review', 'Information Verification', 'Compliance Assessment', 'Final Decision'][i], icon: 'check',
      state: event ? ['REJECTED', 'NON_COMPLIANT', 'FAILED'].includes(event.outcome) ? 'danger' : ['VERIFIED', 'APPROVED', 'COMPLETED', 'SUBMITTED'].includes(event.outcome) ? 'done' : 'pending' : i === 0 && model.submittedOn !== '—' ? 'done' : 'pending',
      time: event ? verificationDate(event.timestamp, true) : i === 0 ? model.submittedOn : i === 4 ? model.reviewedOn : '—', description: event ? label(event.outcome) : '—' };
  });
}
export const verificationEntryActivity = (entries) => (entries || []).map((e) => ({ text: display(e.body), actor: person(e.author), time: verificationDate(e.createdAt, true) }));
export const verificationActivity = (events) => (events || []).map((e) => ({ text: label(Object.values(e).find((value) => EVENTS.includes(value))), actor: person(e.actor), time: verificationDate(e.timestamp, true) }));
async function download(baseQuery, id, kind, filters) {
  const zip = kind === 'documents', format = zip ? 'zip' : 'pdf';
  const url = id ? '/admin/verification/' + encodeURIComponent(id) + (zip ? '/documents/download' : '/report') : '/admin/verification/report';
  const result = await baseQuery({ url, params: { ...filters, ...(zip ? { format } : {}) }, headers: { Accept: zip ? 'application/zip' : 'application/pdf' }, responseHandler: async (response) => {
    if (response.ok) return response.blob();
    try { return JSON.parse(await response.text()); } catch { return { message: 'Unable to download the verification document.' }; }
  } });
  if (result.error) return result;
  if (!(result.data instanceof Blob) || !result.data.size) return failure('No verification document was returned.');
  const bytes = new Uint8Array(await result.data.arrayBuffer());
  if (zip ? bytes[0] !== 80 || bytes[1] !== 75 || ![[3,4],[5,6],[7,8]].some(([a,b]) => bytes[2] === a && bytes[3] === b) : String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return failure('The backend did not return a valid ' + format.toUpperCase() + ' document.');
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
  endpoints: (builder) => ({
    getAdminVerificationDirectory: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await pages(baseQuery, api, '/admin/verification', (dto) => dto.verifications, (dto) => text(dto?.verificationId));
        return result.error ? result : { data: result.data.map(adaptVerification) };
      }, providesTags: ['AdminVerificationDirectory'],
    }),
    getAdminVerificationDetail: builder.query({
      async queryFn(args, api, _options, baseQuery) {
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
      queryFn: ({ id }, api, _options, baseQuery) => text(id) ? pages(baseQuery, api, '/admin/verification/' + encodeURIComponent(id) + '/history', historyItems, (dto) => text(dto?.id) || [dto?.timestamp, dto?.type, dto?.outcome].filter(text).join(':')) : failure('A verification ID is required.'),
      providesTags: ['AdminVerificationHistory'],
    }),
    getAdminVerificationEntries: builder.query({
      queryFn: ({ id, kind }, api, _options, baseQuery) => text(id) && ['comments', 'notes'].includes(kind) ? pages(baseQuery, api, '/admin/verification/' + encodeURIComponent(id) + '/' + kind, (dto) => {
        const arrays = Object.values(dto).filter(Array.isArray);
        return arrays.length === 1 && arrays[0].every((row) => text(row?.body)) ? arrays[0] : null;
      }, (dto) => text(dto?.id) || [dto?.body, dto?.createdAt].filter(text).join(':')) : failure('Unsupported verification entry collection.'),
      providesTags: ['AdminVerificationHistory'],
    }),
    getAdminVerificationDownload: builder.query({ queryFn: ({ id, kind, filters }, _api, _options, baseQuery) => download(baseQuery, id, kind, filters) }),
    approveAdminVerificationEntity: builder.mutation({
      async queryFn({ id, owner }, api, _options, baseQuery) {
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return failure('Your session changed. Reload before approving.');
        if (!text(id)) return failure('A verification ID is required.');
        const current = await readDetail(baseQuery, id); if (current.error) return current;
        const v = current.data;
        if (owner !== api.getState().auth.admin?.id || api.signal.aborted) return failure('Your session changed. Reload before approving.');
        if (!canReviewVerification(api.getState().auth.admin?.role, v.source) || !v.canApprove) return failure('This verification cannot be approved by your account in its current state.');
        const result = await baseQuery({ url: '/admin/' + SOURCES[v.source] + '/' + encodeURIComponent(v.sourceId) + '/approve', method: 'POST' });
        if (result.error) return result;
        const confirmed = await readDetail(baseQuery, id);
        if (confirmed.error || confirmed.data.statusCode !== 'VERIFIED') return failure('Approval was submitted, but its result could not be confirmed. Refresh before trying again.');
        return { data: { message: 'Verification approved.' } };
      }, invalidatesTags: invalidations,
    }),
    changeAdminVerification: builder.mutation({
      async queryFn({ action, id, body, owner }, api, _options, baseQuery) {
        if (owner !== api.getState().auth.admin?.id || !api.getState().auth.accessToken) return failure('Your session changed. Reload before saving.');
        if (!canManageVerification(api.getState().auth.admin?.role)) return failure('Your account cannot manage verifications.');
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
        // Write response schemas are mostly absent. Never create optimistic records or statuses.
        if (action === 'create' || ['comment', 'note'].includes(action)) return { data: { accepted: true } };
        const confirmed = await readDetail(baseQuery, id); if (confirmed.error) return failure('The update was submitted, but could not be refreshed. Refresh before trying again.');
        const v = confirmed.data;
        const valid = action === 'cancel' ? v.statusCode === 'CANCELLED' : action === 'noncompliant' ? v.statusCode === 'NON_COMPLIANT' : action === 'reassign' ? v.assignedAdminId === body.assignedAdminId : action === 'information' ? (current.data.statusCode === 'PENDING' ? v.statusCode === 'IN_REVIEW' : v.statusCode === current.data.statusCode) && text(record(unwrapApiResponseData(result.data)).requestId) : (!body.priority || v.priorityCode === body.priority) && (!body.documentIds || Array.isArray(v.documentIds) && body.documentIds.length === v.documentIds.length && body.documentIds.every((documentId) => v.documentIds.includes(documentId))) && (!Object.hasOwn(body, 'dueDate') || (body.dueDate === null ? v.dueDateRaw === null : new Date(v.dueDateRaw).getTime() === new Date(body.dueDate).getTime()));
        return valid ? { data: { accepted: true } } : failure('The update was submitted, but its requested values could not be confirmed. Refresh before trying again.');
      }, invalidatesTags: invalidations,
    }),
  }),
});
export const { useGetAdminVerificationDirectoryQuery, useGetAdminVerificationDetailQuery, useGetAdminVerificationHistoryQuery, useGetAdminVerificationEntriesQuery, useLazyGetAdminVerificationDownloadQuery, useApproveAdminVerificationEntityMutation, useChangeAdminVerificationMutation } = verificationApi;
