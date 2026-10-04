import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const SOURCES = {
  TRUCKER: { path: 'truckers', collection: 'truckers', response: 'trucker', type: 'Account Verification', status: 'Pending' },
  DRIVER: { path: 'drivers', collection: 'drivers', response: 'driver', type: 'License Verification', status: 'Pending' },
  KYB: { path: 'kyb', collection: 'users', response: 'user', type: 'Business Verification', status: 'In Review' },
  EXPORTER_LICENSE: { path: 'exporter-licenses', collection: 'users', response: 'user', type: 'Export License', status: 'In Review' },
  TRUCK: { path: 'trucks', collection: 'trucks', response: 'truck', type: 'Truck Registration', status: 'Pending' },
};
const ADMINS = ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'];
export const canReviewVerification = (role, source) => source === 'COMPANY_DOCUMENT' ? ['SUPER_ADMIN', 'OPS_ADMIN'].includes(role) : ADMINS.includes(role);
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
export function verificationDocumentUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function verificationDate(value, withTime = false) {
  if (!text(value)) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
const personName = (dto) => [text(dto.firstName), text(dto.lastName)].filter(Boolean).join(' ') || null;
const entityType = (source, party) => source === 'EXPORTER_LICENSE' ? 'Forwarder'
  : ['KYB', 'COMPANY_DOCUMENT'].includes(source) || (['TRUCKER', 'TRUCK'].includes(source) && party.truckerType === 'COMPANY') ? 'Truck Company'
    : source === 'DRIVER' ? 'Driver' : ['TRUCKER', 'TRUCK'].includes(source) ? label(party.truckerType) : '—';
function pendingStatus(source, dto) {
  const field = source === 'KYB' ? dto.kycStatus : source === 'EXPORTER_LICENSE' ? dto.exporterLicenseStatus : dto.status;
  return !text(field) || (['KYB', 'EXPORTER_LICENSE'].includes(source) ? field === 'IN_REVIEW' : field === 'PENDING_REVIEW');
}
export function adaptVerification(source, dto) {
  const party = source === 'TRUCK' ? record(dto.owner) : dto;
  const name = text(party.businessName) || personName(party) || '—';
  return {
    key: `${source}:${dto.id}`, reviewId: dto.id, source, ownerId: source === 'TRUCK' ? text(dto.ownerId) || text(party.id) : dto.id,
    // These queues identify accounts/trucks, not verification records.
    id: '—', entityName: name, initials: name === '—' ? '—' : name.split(/\s+/).slice(0, 2).map((part) => part[0]).join(''),
    entityType: entityType(source, party), regNo: text(party.cacNumber) || '—',
    country: '—', joined: source === 'TRUCK' ? '—' : verificationDate(dto.createdAt),
    submittedOn: source === 'EXPORTER_LICENSE' ? verificationDate(dto.exporterLicenseSubmittedAt, true) : '—',
    submittedBy: '—', contactHint: [text(party.email), text(party.phone)].filter(Boolean).join(' · ') || '—',
    type: SOURCES[source].type, status: pendingStatus(source, dto) ? SOURCES[source].status : '—',
    assignedTo: '—', assignedRole: '—', dueDate: '—', priority: '—', riskLevel: '—', assessment: '—',
    requirements: [], activity: [], progress: null, documentCount: null, commentCount: null,
    canApprove: pendingStatus(source, dto),
  };
}
function addLicense(model, dto) {
  const url = verificationDocumentUrl(dto.licenseUrl || dto.exporterLicenseUrl);
  if (!url) return model;
  model.requirements = [{ key: model.key, name: model.source === 'EXPORTER_LICENSE' ? 'Export License' : 'Driver License',
    sub: text(dto.licenseNumber) || '—', cat: '—', status: model.status, by: '—', on: '—', note: '—', url }];
  return model;
}
function documentRequirement(dto, index) {
  return {
    key: text(dto.id) || `${text(dto.type) || 'document'}:${index}`, name: text(dto.label) || '—',
    sub: text(dto.fileName) || '—', cat: '—', status: dto.status === 'APPROVED' ? 'Completed' : label(dto.status),
    by: text(dto.reviewedBy?.name) || '—', on: verificationDate(dto.reviewedAt, true), note: text(dto.rejectionReason) || '—',
    url: verificationDocumentUrl(dto.url),
  };
}
function addDocuments(model, documents) {
  if (!Array.isArray(documents) || documents.some((document) => !document || typeof document !== 'object' || Array.isArray(document))) return model;
  model.requirements = documents.map(documentRequirement);
  model.documentCount = documents.filter((document) => text(document.id)).length;
  // This is document-checklist completion, not KYC stage completion. A rejected
  // requirement has no segment in the existing chart, so leave that chart unknown.
  if (documents.every((document) => ['APPROVED', 'PENDING', 'MISSING'].includes(document.status))) {
    model.progress = { total: documents.length, completed: documents.filter((document) => document.status === 'APPROVED').length,
      inReview: 0, pending: documents.filter((document) => ['PENDING', 'MISSING'].includes(document.status)).length };
  }
  return model;
}
function adaptCompanyDocument(dto) {
  const model = adaptVerification('KYB', { id: dto.id, businessName: dto.company?.name, email: dto.company?.email });
  const types = { CAC_CERTIFICATE: 'Business Verification', CAC_STATUS_REPORT: 'Business Verification',
    TIN_CERTIFICATE: 'Tax Identification (TIN)', OPERATING_LICENCE: 'License Verification',
    GOODS_IN_TRANSIT_INSURANCE: 'Insurance Verification', PROOF_OF_ADDRESS: 'Company Address Verification' };
  Object.assign(model, {
    source: 'COMPANY_DOCUMENT', key: `COMPANY_DOCUMENT:${dto.id}`, ownerId: text(dto.company?.id),
    type: types[dto.type] || '—', status: { APPROVED: 'Verified', REJECTED: 'Rejected', PENDING: 'Pending' }[dto.status] || '—',
    submittedOn: verificationDate(dto.uploadedAt, true), submittedBy: text(dto.uploadedBy?.name) || '—',
    joined: '—', canApprove: dto.status === 'PENDING', expiringSoon: dto.expiryStatus === 'EXPIRING_SOON',
    documents: [verificationDocumentUrl(dto.url)].filter(Boolean), reviewedOn: verificationDate(dto.reviewedAt, true),
  });
  return addDocuments(model, [dto]);
}
function validItems(items, count) {
  if (!Array.isArray(items) || (count != null && (!Number.isInteger(count) || count !== items.length))) return false;
  const ids = items.map((dto) => text(dto?.id));
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}
export const verificationDetailUrl = (row) => `/verification/detail?id=${encodeURIComponent(row.reviewId)}&source=${encodeURIComponent(row.source)}`;
export function verificationSummary(rows) {
  return {
    total: '—', totalCaption: 'All time requests', pending: rows ? rows.filter((row) => row.status === 'Pending').length : '—', pendingShare: '—',
    inReview: rows ? rows.filter((row) => row.status === 'In Review').length : '—', inReviewShare: '—',
    verified: '—', verifiedShare: '—', rejected: '—', rejectedShare: '—', expiringSoon: '—', expiringSoonCaption: 'Documents / Licenses',
  };
}
async function readPending(baseQuery, source) {
  const config = SOURCES[source];
  if (!config) return failure('This verification type is not supported by the documented API.');
  const result = await baseQuery({ url: `/admin/${config.path}/pending` });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  if (!validItems(dto[config.collection], dto.count)) return failure('The API did not return a complete pending verification queue with unique entity IDs.');
  return { data: dto[config.collection] };
}
async function readCompanyDocuments(baseQuery, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, totalPages = 1, total = null;
  do {
    const result = await baseQuery({ url: '/admin/company-documents', params: { ...params, page, limit: 100 } });
    if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!validItems(dto.documents) || pagination.page !== page || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0 || !Number.isInteger(pagination.total) || pagination.total < 0) return failure('The company document response is missing the records or pagination needed to load every review.');
    if (total !== null && (pagination.total !== total || Math.max(1, pagination.totalPages) !== totalPages)) return failure('The company document queue changed while loading. Refresh to load it again.');
    total = pagination.total;
    totalPages = Math.max(1, pagination.totalPages);
    if (page < totalPages && !dto.documents.length) return failure('The company document queue returned an incomplete page.');
    for (const item of dto.documents) {
      if (seen.has(item.id)) return failure('The company document queue returned a duplicate document.');
      seen.add(item.id); rows.push(item);
    }
    page += 1;
  } while (page <= totalPages);
  if (rows.length !== total) return failure('The company document queue did not return every review.');
  return { data: rows };
}
export const verificationApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminVerificationDirectory', 'AdminVerificationDetail'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminVerificationDirectory: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        // The combined endpoint includes financial withdrawals and does not
        // enumerate every group type. Use the documented native queues to keep
        // account, KYB, licence and physical truck reviews distinct.
        const sources = Object.keys(SOURCES);
        const results = await Promise.all([...sources.map((source) => readPending(baseQuery, source)), readCompanyDocuments(baseQuery)]);
        const failed = results.find((result) => result.error);
        if (failed) return failed;
        const rows = results.flatMap((result, index) => result.data.map((item) => index === sources.length ? adaptCompanyDocument(item) : adaptVerification(sources[index], item)));
        return { data: rows };
      },
      providesTags: ['AdminVerificationDirectory', 'AdminCompanies', 'AdminDrivers', 'AdminForwarders', 'AdminFleet'],
    }),
    getAdminVerificationDetail: builder.query({
      async queryFn({ source, id }, _api, _options, baseQuery) {
        if (!text(id)) return failure('A real entity ID is required to load a verification.');
        const pending = source === 'COMPANY_DOCUMENT' ? await readCompanyDocuments(baseQuery) : await readPending(baseQuery, source);
        if (pending.error) return pending;
        const item = pending.data.find((entry) => entry.id === id);
        if (!item) return { data: null };
        const model = source === 'COMPANY_DOCUMENT' ? adaptCompanyDocument(item) : adaptVerification(source, item);
        if (source === 'EXPORTER_LICENSE') addLicense(model, item);
        if (source === 'DRIVER') addLicense(model, record(item.driverProfile));
        const userId = model.ownerId;
        if (!userId) return { data: model };
        const profile = await baseQuery({ url: `/admin/users/${encodeURIComponent(userId)}/profile` });
        if (profile.error?.status === 401 || profile.error?.status === 403) return { error: profile.error };
        const user = record(unwrapApiResponseData(profile.data));
        const matches = user.id === userId && (source === 'DRIVER' ? user.role === 'DRIVER' : source === 'EXPORTER_LICENSE' ? user.role === 'FORWARDER' : user.role === 'TRUCKER' && (['KYB', 'COMPANY_DOCUMENT'].includes(source) ? user.truckerType === 'COMPANY' : true));
        if (matches) {
          const company = record(user.details?.company);
          model.entityName = text(company.businessName) || text(user.name) || model.entityName;
          model.initials = model.entityName === '—' ? '—' : model.entityName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
          model.entityType = entityType(source, user);
          model.regNo = text(company.cacNumber) || model.regNo;
          const joined = verificationDate(user.joinedAt || user.details?.account?.dateJoined);
          if (joined !== '—') model.joined = joined;
          if (user.role === 'TRUCKER' && user.truckerType === 'COMPANY' && ['KYB', 'TRUCKER'].includes(source)) {
            const companyInfo = await baseQuery({ url: `/admin/users/${encodeURIComponent(userId)}/company-info` });
            if (companyInfo.error?.status === 401 || companyInfo.error?.status === 403) return { error: companyInfo.error };
            if (!companyInfo.error) addDocuments(model, record(unwrapApiResponseData(companyInfo.data)).documents);
          }
        }
        return { data: model };
      },
      providesTags: (_data, _error, args) => [{ type: 'AdminVerificationDetail', id: `${args.source}:${args.id}` }],
    }),
    approveAdminVerificationEntity: builder.mutation({
      async queryFn({ source, id }, api, _options, baseQuery) {
        if (!canReviewVerification(api.getState().auth.admin?.role, source)) return failure('You do not have permission to approve verifications.');
        if (!text(id)) return failure('A real entity ID is required to approve a verification.');
        const pending = source === 'COMPANY_DOCUMENT' ? await readCompanyDocuments(baseQuery, { status: 'pending' }) : await readPending(baseQuery, source);
        if (pending.error) return pending;
        const item = pending.data.find((entry) => entry.id === id);
        if (!item || (source === 'COMPANY_DOCUMENT' ? item.status !== 'PENDING' : !pendingStatus(source, item))) return failure('This entity is no longer pending this review. Refresh before proceeding.');
        const config = source === 'COMPANY_DOCUMENT' ? { path: 'company-documents', response: 'document' } : SOURCES[source];
        const result = await baseQuery({ url: `/admin/${config.path}/${encodeURIComponent(id)}/approve`, method: 'POST' });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)), updated = record(dto[config.response]);
        const confirmed = source === 'COMPANY_DOCUMENT' ? updated.status === 'APPROVED' : source === 'KYB' ? updated.kycStatus === 'VERIFIED' : source === 'EXPORTER_LICENSE' ? updated.exporterLicenseStatus === 'VERIFIED' : updated.status === 'ACTIVE';
        if (updated.id !== id || !confirmed) return failure('The approval response did not confirm the expected entity and status. Refresh before attempting another approval.');
        return { data: { message: text(dto.message) || 'Verification approved.', status: 'Verified', ...(source === 'COMPANY_DOCUMENT' ? { document: updated } : {}) } };
      },
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(verificationApi.util.updateQueryData('getAdminVerificationDetail', args, (draft) => {
            if (draft) {
              draft.status = data.status; draft.canApprove = false;
              if (data.document) { addDocuments(draft, [data.document]); draft.reviewedOn = verificationDate(data.document.reviewedAt, true); }
            }
          }));
        } catch { /* The existing action reports the server error. */ }
      },
      invalidatesTags: ['AdminVerificationDirectory', 'AdminCompanies', 'AdminDrivers', 'AdminDriverStats', 'AdminForwarders', 'AdminFleet'],
    }),
  }),
});
export const { useGetAdminVerificationDirectoryQuery, useGetAdminVerificationDetailQuery, useApproveAdminVerificationEntityMutation } = verificationApi;
