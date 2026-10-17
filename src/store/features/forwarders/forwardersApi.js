import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { isPdfAttachment, pdfAttachmentFilename } from '../../api/pdfDownload.js';
import { forwarderJobBody } from './forwarderJobContracts.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
export const forwarderMoney = (value) => number(value) == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
export const forwarderDate = (value) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '—';
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (hour > 23 || minute > 59 || second > 59 || offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
};
export const forwarderVerification = (value) => ({ VERIFIED: 'Verified', IN_REVIEW: 'Pending', PENDING: 'Pending', PENDING_REVIEW: 'Pending', REJECTED: 'Rejected' }[value] || label(value));
export const forwarderLink = (value) => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
export function forwarderError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to view or manage this forwarder.';
  if (error?.status === 404) return 'Forwarder not found.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || text(error?.message) || 'Unable to load forwarder data. Please try again.';
}
const nonNegative = (value) => number(value) != null && value >= 0 ? value : null;
const percentage = (value) => nonNegative(value) != null && value <= 100 ? value : null;
const strings = (value) => Array.isArray(value) && value.every(item => text(item)) ? value.map(item => item.trim()) : [];
const joinedStrings = (value) => strings(value).join(', ') || '—';
const checkStatus = (value) => forwarderVerification(typeof value === 'string' ? value : value?.status);
export function adaptAdminForwarder(dto = {}) {
  return {
    id: text(dto.id), customerId: text(dto.id), name: text(dto.name) || '—', email: text(dto.email) || '—', phone: text(dto.phone) || '—',
    statusCode: text(dto.status), status: ['PENDING_PROFILE', 'PENDING_REVIEW'].includes(dto.status) ? 'Pending' : label(dto.status),
    isExporter: dto.type === 'EXPORTER' ? true : dto.type === 'FORWARDER' ? false : dto.exporterLicenseStatus === 'VERIFIED' ? true : null, exporterLicenseStatus: text(dto.exporterLicenseStatus),
    jobs: count(dto.totalJobs), spend: dto.currency === 'NGN' ? nonNegative(dto.totalSpend) : null, currency: text(dto.currency),
    location: text(dto.location) || '—', joined: forwarderDate(dto.joinedAt), verification: forwarderVerification(dto.verificationStatus), kycStatusCode: text(dto.verificationStatus),
  };
}
export function adaptAdminForwarderProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {}, personal = dto.details?.personal || {}, exporter = dto.details?.exporterLicense || {}, stats = dto.stats || {};
  const business = dto.business || {}, financial = dto.financial || {}, performance = dto.performance || {}, verification = dto.verification || {};
  const rating = performance.partnerRating || {}, scale = nonNegative(rating.scale), average = nonNegative(rating.average);
  const kycStatus = text(dto.kycStatus) || text(verification.kycStatus);
  return {
    ...adaptAdminForwarder({ ...dto, status: dto.status || account.accountStatus, phone: text(dto.phone) || text(personal.phone) }), role: text(dto.role), version: timestamp(dto.version), editable: editableProfile(dto),
    isExporter: typeof exporter.isExporter === 'boolean' ? exporter.isExporter : account.accountType === 'Exporter' ? true : account.accountType === 'Forwarder' ? false : adaptAdminForwarder(dto).isExporter,
    exporterLicenseStatus: text(exporter.status) || text(dto.exporterLicenseStatus), exporterLicenseUrl: forwarderLink(exporter.url),
    jobs: count(stats.totalJobs?.count), balance: number(stats.walletBalance?.amount),
    spend: financial.currency === 'NGN' ? nonNegative(financial.totalSpend) : null, currency: text(financial.currency),
    joined: forwarderDate(dto.joinedAt || account.dateJoined), memberSince: forwarderDate(dto.joinedAt || account.dateJoined),
    lastActivity: forwarderDate(dto.lastLoginAt || account.lastLogin), verification: forwarderVerification(kycStatus), kycStatusCode: kycStatus,
    dob: forwarderDate(personal.dateOfBirth), gender: text(personal.gender) || '—', nationality: text(personal.nationality) || '—', nin: text(personal.nin) || '—',
    altPhone: text(personal.alternatePhone) || '—', address: text(personal.address) || '—', languages: joinedStrings(personal.languages), yearsExperience: count(business.yearsExperience) ?? '—',
    license: text(business.forwardingLicense?.number) || '—', licenseExpiry: forwarderDate(business.forwardingLicense?.expiresAt),
    exportLicense: text(business.exportLicense?.number) || '—', exportLicenseExpiry: forwarderDate(business.exportLicense?.expiresAt),
    services: strings(business.servicesOffered), coverage: joinedStrings(business.coverageArea), cargoTypes: joinedStrings(business.preferredCargoTypes),
    routes: joinedStrings(business.preferredRoutes), network: joinedStrings(business.partnerNetwork), other: text(business.otherInformation) || '—',
    emergencyContact: text(dto.emergencyContact?.name) || '—', emergencyPhone: text(dto.emergencyContact?.phone) || '—',
    creditLimit: financial.currency === 'NGN' ? nonNegative(financial.creditLimit) : null, availableCredit: financial.currency === 'NGN' ? nonNegative(financial.availableCredit) : null,
    paymentTerms: label(financial.paymentTerms), lastPaymentDate: forwarderDate(financial.lastPayment?.date),
    lastPaymentAmount: financial.lastPayment?.currency === 'NGN' ? nonNegative(financial.lastPayment.amount) : null,
    outstandingCount: count(financial.outstandingInvoices?.count) ?? '—', outstandingAmount: financial.outstandingInvoices?.currency === 'NGN' ? nonNegative(financial.outstandingInvoices.amount) : null,
    onTimeDelivery: percentage(performance.onTimeDelivery?.percentage), paymentReliability: percentage(performance.paymentReliability?.percentage),
    partnerRating: scale != null && scale > 0 && average != null && average <= scale ? { average, scale, count: count(rating.count) } : null,
    verificationChecks: Object.fromEntries(['nationalId', 'forwardingLicense', 'exportLicense', 'bankAccount', 'address', 'backgroundCheck'].map(key => [key, checkStatus(verification[key])])),
  };
}
function adaptForwarderStats(response) {
  const dto = unwrapApiResponseData(response) || {};
  const statuses = Array.isArray(dto.byStatus) && dto.byStatus.every(item => text(item?.status)) && new Set(dto.byStatus.map(item => item.status)).size === dto.byStatus.length ? dto.byStatus : [];
  const groups = { Active: ['ACTIVE'], Pending: ['PENDING_PROFILE', 'PENDING_REVIEW'], Suspended: ['SUSPENDED'], Inactive: ['INACTIVE'], Banned: ['BANNED'] };
  const overview = Object.entries(groups).flatMap(([label, keys]) => {
    const rows = statuses.filter(item => keys.includes(item.status));
    if (!rows.length) return [];
    return [{ label, value: rows.every(item => count(item.count) != null) ? rows.reduce((sum, item) => sum + item.count, 0) : null,
      share: rows.every(item => percentage(item.share) != null) ? percentage(rows.reduce((sum, item) => sum + item.share, 0)) : null }];
  });
  return { total: count(dto.total), active: count(dto.active), exporters: count(dto.exporters), pending: count(dto.pendingVerification), suspended: count(dto.suspended),
    totalSpend: dto.currency === 'NGN' ? nonNegative(dto.totalSpend) : null, overview };
}
const timestamp = value => typeof value === 'string' && value.includes('T') && forwarderDate(value) !== '—' ? value : null;
const editableForwarderFields = ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'businessName', 'businessAddress', 'cacNumber', 'taxId', 'website', 'businessType', 'gender', 'nationality', 'alternatePhone', 'languages', 'yearsExperience', 'forwardingLicenseNumber', 'forwardingLicenseExpiry', 'exportLicenseNumber', 'exportLicenseExpiry', 'servicesOffered', 'coverageArea', 'preferredCargoTypes', 'preferredRoutes', 'partnerNetwork', 'otherInformation', 'emergencyContactName', 'emergencyContactPhone'];
const arrayForwarderFields = new Set(['languages', 'servicesOffered', 'coverageArea', 'preferredCargoTypes', 'preferredRoutes', 'partnerNetwork']);
function editableProfile(dto) {
  const p = dto.details?.personal || {}, b = dto.business || {};
  return { firstName: text(p.firstName), middleName: text(p.middleName), lastName: text(p.lastName), dateOfBirth: forwarderDate(p.dateOfBirth) === '—' ? null : p.dateOfBirth.slice(0, 10),
    businessName: text(b.businessName), businessAddress: text(b.address), cacNumber: text(b.cacNumber), taxId: text(b.taxId), website: text(b.website), businessType: text(b.businessType),
    gender: text(p.gender), nationality: text(p.nationality), alternatePhone: text(p.alternatePhone), languages: strings(p.languages), yearsExperience: count(b.yearsExperience),
    forwardingLicenseNumber: text(b.forwardingLicense?.number), forwardingLicenseExpiry: forwarderDate(b.forwardingLicense?.expiresAt) === '—' ? null : b.forwardingLicense.expiresAt.slice(0, 10),
    exportLicenseNumber: text(b.exportLicense?.number), exportLicenseExpiry: forwarderDate(b.exportLicense?.expiresAt) === '—' ? null : b.exportLicense.expiresAt.slice(0, 10),
    servicesOffered: strings(b.servicesOffered), coverageArea: strings(b.coverageArea), preferredCargoTypes: strings(b.preferredCargoTypes), preferredRoutes: strings(b.preferredRoutes), partnerNetwork: strings(b.partnerNetwork),
    otherInformation: text(b.otherInformation), emergencyContactName: text(dto.emergencyContact?.name), emergencyContactPhone: text(dto.emergencyContact?.phone) };
}
const profileFieldPaths = {
  ...Object.fromEntries(['firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender', 'nationality', 'alternatePhone', 'languages'].map(key => [key, ['details', 'personal', key]])),
  ...Object.fromEntries(['businessName', 'cacNumber', 'taxId', 'website', 'businessType', 'yearsExperience', 'servicesOffered', 'coverageArea', 'preferredCargoTypes', 'preferredRoutes', 'partnerNetwork', 'otherInformation'].map(key => [key, ['business', key]])),
  businessAddress: ['business', 'address'], forwardingLicenseNumber: ['business', 'forwardingLicense', 'number'], forwardingLicenseExpiry: ['business', 'forwardingLicense', 'expiresAt'],
  exportLicenseNumber: ['business', 'exportLicense', 'number'], exportLicenseExpiry: ['business', 'exportLicense', 'expiresAt'],
  emergencyContactName: ['emergencyContact', 'name'], emergencyContactPhone: ['emergencyContact', 'phone'],
};
function confirmedProfileUpdate(dto, id, changes, expectedVersion) {
  const profile = dto?.profile, keys = Object.keys(changes);
  if (profile?.id !== id || profile.role !== 'FORWARDER' || !timestamp(profile.version) || profile.version === expectedVersion
    || !Array.isArray(dto.changedFields) || !dto.changedFields.every(key => text(key)) || new Set(dto.changedFields).size !== dto.changedFields.length
    || !keys.every(key => dto.changedFields.includes(key))) return false;
  const saved = editableProfile(profile);
  return keys.every(key => {
    let value = profile;
    for (const part of profileFieldPaths[key]) {
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return false;
      value = value[part];
    }
    const expected = changes[key] == null && arrayForwarderFields.has(key) ? [] : changes[key];
    return JSON.stringify(saved[key]) === JSON.stringify(expected);
  });
}
const unconfirmed = message => ({ error: { status: 'CUSTOM_ERROR', error: message, saveUnconfirmed: true } });
async function writeForwarder(baseQuery, api, request, confirm) {
  const auth = api.getState().auth, owner = auth.admin?.id;
  if (!auth.accessToken || !owner || api.signal.aborted) return failure('An active admin session is required.');
  const result = await baseQuery(request);
  if (result.error) {
    const uncertain = ['FETCH_ERROR', 'TIMEOUT_ERROR', 'PARSING_ERROR'].includes(result.error.status) || Number(result.error.status) >= 500;
    return { error: { ...result.error, ...(uncertain ? { saveUnconfirmed: true } : {}) } };
  }
  if (api.signal.aborted || api.getState().auth.admin?.id !== owner || !api.getState().auth.accessToken) return unconfirmed('The session changed after saving. Close this form and refresh before trying again.');
  const dto = unwrapApiResponseData(result.data);
  return confirm(dto) ? { data: dto } : unconfirmed('The request was sent, but the saved result could not be confirmed. Close this form and refresh before trying again.');
}
function documentedPage(response, collection, matchesRow, description) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new Error(description + ' could not be loaded. Please try again.');
  const rows = dto[collection], pagination = dto.pagination;
  if (!Array.isArray(rows) || !rows.every(matchesRow) || !pagination || Array.isArray(pagination)
    || !['page', 'limit', 'total', 'totalPages'].every(key => count(pagination[key]) != null)
    || pagination.limit < 1 || pagination.limit > 100) throw new Error(description + ' returned an incomplete response. Please try again.');
  return { rows, pagination };
}
function confirmedInvitation(dto) {
  const invitation = dto?.invitation;
  if (!text(dto?.id) || dto.status !== 'PENDING_PROFILE' || typeof invitation?.sent !== 'boolean') return false;
  if (!invitation.sent) return Boolean(text(invitation.error));
  return typeof invitation.sentVia?.sms === 'boolean' && typeof invitation.sentVia?.email === 'boolean'
    && (invitation.sentVia.sms || invitation.sentVia.email) && Boolean(timestamp(invitation.expiresAt));
}
function confirmedBulkVerification(dto, userIds) {
  if (!Array.isArray(dto?.results) || dto.results.length !== userIds.length
    || new Set(dto.results.map(row => row?.userId)).size !== userIds.length) return false;
  const outcomes = { VERIFIED: 0, NOTHING_TO_VERIFY: 0, FAILED: 0 };
  for (const row of dto.results) {
    if (!userIds.includes(row?.userId) || !Object.hasOwn(outcomes, row.outcome) || !Array.isArray(row.approved)
      || new Set(row.approved).size !== row.approved.length || row.approved.some(check => !['EXPORT_LICENSE', 'ADDRESS'].includes(check))) return false;
    if (row.outcome === 'FAILED') { if (!text(row.error) || row.approved.length) return false; }
    else {
      if (!['kycStatus', 'exporterLicenseStatus', 'addressVerificationStatus', 'ninVerificationStatus', 'bvnVerificationStatus'].every(key => text(row.verification?.[key]))) return false;
      if (row.outcome === 'VERIFIED' ? !row.approved.length : row.approved.length || !text(row.note)) return false;
    }
    outcomes[row.outcome] += 1;
  }
  return dto.totals?.requested === userIds.length && dto.totals.verified === outcomes.VERIFIED
    && dto.totals.nothingToVerify === outcomes.NOTHING_TO_VERIFY && dto.totals.failed === outcomes.FAILED;
}
async function readAllPages(baseQuery, url, collection, params = {}, signal) {
  const rows = [], seen = new Set();
  let page = 1, totalPages = 1, expectedTotal = null;
  do {
    if (signal?.aborted) return failure('The forwarder request was cancelled.');
    if (page > 500) return failure('The forwarder collection exceeded the supported page limit.');
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = unwrapApiResponseData(result.data) || {}, meta = dto.pagination;
    if (!validPage(dto, collection, page) || meta.limit > 100) return failure('The API response is missing valid records or pagination.');
    if (expectedTotal != null && expectedTotal !== meta.total) return failure('The API records changed while loading. Please refresh.');
    expectedTotal = meta.total; totalPages = Math.max(1, meta.totalPages);
    for (const row of dto[collection]) {
      if (!text(row?.id) || seen.has(row.id)) return failure('The API returned missing or duplicate records. Please refresh.');
      seen.add(row.id); rows.push(row);
    }
    page += 1;
  } while (page <= totalPages);
  return rows.length === expectedTotal ? { data: rows } : failure('The API did not return all records. Please refresh.');
}
function validPage(dto, collection, page) {
  const rows = dto[collection], meta = dto.pagination;
  return Array.isArray(rows) && count(meta?.total) != null && count(meta.totalPages) != null && count(meta.limit) > 0 && meta.page === page
    && (meta.totalPages === Math.ceil(meta.total / meta.limit) || meta.total === 0 && meta.totalPages === 1)
    && page >= 1 && page <= Math.max(1, meta.totalPages) && (meta.total === 0 || rows.length > 0) && rows.length <= meta.limit && rows.length <= meta.total
    && rows.every(row => text(row?.id)) && new Set(rows.map(row => row.id)).size === rows.length;
}
const userPath = (id) => `/admin/users/${encodeURIComponent(id)}`;
export const forwardersApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminForwarderDirectory: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/forwarders', 'users', {}, _api.signal);
        if (result.error) return result;
        return { data: result.data.map(adaptAdminForwarder) };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderStats: builder.query({
      query: () => '/admin/users/forwarders/stats', transformResponse: adaptForwarderStats, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderDocuments: builder.query({
      async queryFn({ id }, api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/user-management/' + encodeURIComponent(id) + '/documents', 'documents', { accountType: 'user' }, api.signal);
        if (result.error) return result;
        const slots = {};
        for (const [slot, type] of Object.entries({ passport: 'PASSPORT_PHOTO', exportLicense: 'EXPORTER_LICENCE', address: 'PROOF_OF_ADDRESS' })) {
          const matches = result.data.filter(item => item.type === type);
          const ordered = matches.length > 1 && matches.every(item => timestamp(item.uploadedAt)) ? [...matches].sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt)) : [];
          const item = matches.length === 1 ? matches[0] : ordered.length && Date.parse(ordered[0].uploadedAt) !== Date.parse(ordered[1].uploadedAt) ? ordered[0] : null;
          slots[slot] = item ? { id: item.id, status: forwarderVerification(item.status), url: forwarderLink(item.url), validity: forwarderDate(item.expiresAt) } : null;
        }
        return { data: slots };
      }, providesTags: ['AdminForwarders'],
    }),
    downloadAdminForwarderReport: builder.query({
      async queryFn({ owner } = {}, api, _options, baseQuery) {
        const sameSession = () => !api.signal.aborted && owner && api.getState().auth.admin?.id === owner && api.getState().auth.accessToken;
        if (!sameSession()) return failure('Sign in before downloading the forwarders report.');
        const result = await baseQuery({ url: '/admin/users/forwarders/report', params: { format: 'pdf' }, headers: { Accept: 'application/pdf' }, responseHandler: async response => {
          if (response.ok) return response.blob();
          const body = await response.text();
          try { return JSON.parse(body); } catch { return { message: 'Unable to download the forwarders report.' }; }
        } });
        if (result.error) return result;
        if (!sameSession()) return failure('The session changed. Sign in before downloading the report.');
        if (!await isPdfAttachment(result.data)) return failure('The server did not return a valid forwarders PDF report.');
        if (!sameSession()) return failure('The session changed. Sign in before downloading the report.');
        const headers = result.meta?.response?.headers, serverDate = headers?.get('date');
        const reportDate = serverDate && Number.isFinite(Date.parse(serverDate)) ? new Date(serverDate) : new Date();
        return { data: { url: URL.createObjectURL(result.data), name: pdfAttachmentFilename(headers, 'forwarders-' + reportDate.toISOString().slice(0, 10) + '.pdf') } };
      }, keepUnusedDataFor: 0,
    }),
    getAdminForwarderRankings: builder.query({
      query: ({ page = 1, limit = 20 } = {}) => ({ url: '/admin/users/forwarders/rankings', params: { page, limit, sort: 'spend' } }),
      transformResponse: (response, _meta, { page = 1 } = {}) => {
        const dto = documentedPage(response, 'rankings', row => text(row?.forwarderId) && count(row.rank) > 0, 'Spending rankings');
        const rows = dto.rows.map(row => ({ ...row, id: row.forwarderId }));
        if (!validPage({ rankings: rows, pagination: dto.pagination }, 'rankings', page) || rows.length !== Math.max(0, Math.min(dto.pagination.limit, dto.pagination.total - (page - 1) * dto.pagination.limit)) || new Set(rows.map(row => row.rank)).size !== rows.length) throw new Error('The rankings response has invalid records or pagination.');
        return { rows: rows.map(row => ({ id: row.id, rank: row.rank, name: text(row.name) || '—', spend: row.currency === 'NGN' ? nonNegative(row.totalSpend) : null })), pagination: dto.pagination };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderNotes: builder.query({
      query: ({ id, page = 1, limit = 20 }) => ({ url: userPath(id) + '/notes', params: { page, limit } }),
      transformResponse: (response, _meta, { page = 1 }) => {
        const dto = documentedPage(response, 'notes', row => text(row?.id) && Object.hasOwn(row, 'body') && Object.hasOwn(row, 'createdAt'), 'Forwarder notes');
        if (!validPage({ notes: dto.rows, pagination: dto.pagination }, 'notes', page) || dto.rows.length !== Math.max(0, Math.min(dto.pagination.limit, dto.pagination.total - (page - 1) * dto.pagination.limit))) throw new Error('The notes response has invalid records or pagination.');
        return { rows: dto.rows.map(row => ({ id: row.id, body: text(row.body) || '—', admin: text(row.admin?.name) || '—', createdAt: forwarderDate(row.createdAt), updatedAt: forwarderDate(row.updatedAt) })), pagination: dto.pagination };
      }, providesTags: ['AdminForwarders'],
    }),
    addAdminForwarderNote: builder.mutation({
      async queryFn({ id, body }, api, _options, baseQuery) {
        if (!text(id) || !text(body) || body.trim().length > 2000) return failure('Enter a note of up to 2,000 characters.');
        return writeForwarder(baseQuery, api, { url: userPath(id) + '/notes', method: 'POST', body: { body: body.trim() } }, dto => text(dto?.id) && dto.body === body.trim() && text(dto.admin?.id) && timestamp(dto.createdAt) && timestamp(dto.updatedAt));
      }, invalidatesTags: ['AdminForwarders'],
    }),
    createAdminForwarder: builder.mutation({
      async queryFn(fields, api, _options, baseQuery) {
        const body = Object.fromEntries(['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'businessName'].filter(key => text(fields[key])).map(key => [key, fields[key].trim()]));
        if (!body.firstName || !body.lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '') || !body.phone || !body.dateOfBirth || forwarderDate(body.dateOfBirth) === '—') return failure('Enter a name, valid email, phone number and date of birth.');
        const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 18);
        if (Date.parse(body.dateOfBirth) > cutoff.getTime()) return failure('The forwarder must be at least 18 years old.');
        return writeForwarder(baseQuery, api, { url: '/admin/users/forwarders', method: 'POST', body }, confirmedInvitation);
      }, invalidatesTags: ['AdminForwarders'],
    }),
    updateAdminForwarder: builder.mutation({
      async queryFn({ id, changes, expectedVersion }, api, _options, baseQuery) {
        if (!text(id) || !timestamp(expectedVersion) || !changes || !Object.keys(changes).length || Object.keys(changes).some(key => !editableForwarderFields.includes(key))) return failure('Refresh the profile and change at least one supported field.');
        const body = {};
        for (const [key, value] of Object.entries(changes)) {
          if (value == null) body[key] = null;
          else if (arrayForwarderFields.has(key)) { if (!Array.isArray(value) || value.some(item => !text(item))) return failure('Enter one non-empty item per line.'); body[key] = strings(value); }
          else if (key === 'yearsExperience') { if (count(value) == null) return failure('Years of experience must be a non-negative whole number.'); body[key] = value; }
          else { if (!text(value)) return failure('Clear empty fields or enter a value.'); body[key] = value.trim(); }
          if ((key === 'dateOfBirth' || key.endsWith('Expiry')) && body[key] != null && forwarderDate(body[key]) === '—') return failure('Enter valid dates.');
        }
        body.expectedVersion = expectedVersion;
        const savedFields = { ...body }; delete savedFields.expectedVersion;
        return writeForwarder(baseQuery, api, { url: userPath(id) + '/forwarder', method: 'PATCH', body }, dto => confirmedProfileUpdate(dto, id, savedFields, expectedVersion));
      }, invalidatesTags: ['AdminForwarders'],
    }),
    verifyAdminForwarders: builder.mutation({
      async queryFn({ userIds, reason, idempotencyKey }, api, _options, baseQuery) {
        if (!Array.isArray(userIds) || !userIds.length || userIds.length > 100 || userIds.some(id => !text(id)) || new Set(userIds).size !== userIds.length || !text(idempotencyKey)) return failure('Select 1–100 forwarders.');
        return writeForwarder(baseQuery, api, { url: '/admin/users/forwarders/verify-bulk', method: 'POST', body: { userIds, ...(text(reason) ? { reason: reason.trim() } : {}), idempotencyKey } }, dto => confirmedBulkVerification(dto, userIds));
      }, invalidatesTags: ['AdminForwarders'],
    }),
    requestAdminForwarderVerification: builder.mutation({
      async queryFn({ id, checkType, reason }, api, _options, baseQuery) {
        if (!text(id) || !['NATIONAL_ID', 'ADDRESS', 'EXPORT_LICENSE'].includes(checkType) || !text(reason)) return failure('Select a supported verification check and enter a reason.');
        return writeForwarder(baseQuery, api, { url: userPath(id) + '/verification-requests', method: 'POST', body: { checkType, reason: reason.trim() } }, dto => text(dto?.id) && dto.userId === id && dto.checkType === checkType && dto.status === 'REQUESTED' && dto.reason === reason.trim() && text(dto.caseId) && timestamp(dto.createdAt));
      }, invalidatesTags: ['AdminForwarders'],
    }),
    getAdminForwarderJobOptions: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const definitions = [['ports', 'ports'], ['containerSizes', 'container-sizes'], ['containerTypes', 'container-types'], ['truckTypes', 'truck-types']];
        const responses = await Promise.all(definitions.map(([, route]) => baseQuery('/admin/reference/' + route)));
        if (api.signal.aborted) return failure('The job options request was cancelled.');
        const failed = responses.find(result => result.error); if (failed) return failed;
        const data = {};
        for (let index = 0; index < definitions.length; index++) {
          const key = definitions[index][0], rows = unwrapApiResponseData(responses[index].data)?.[key];
          if (!Array.isArray(rows) || rows.some(row => !text(row?.id)) || new Set(rows.map(row => row.id)).size !== rows.length) return failure('The job options returned invalid ' + key + '.');
          data[key] = rows.filter(row => row.isActive === true).map(row => ({ value: row.id, label: text(row.name) || '—' }));
        }
        return { data };
      },
    }),
    getAdminForwarderJobTerminals: builder.query({
      query: ({ portId }) => '/admin/reference/ports/' + encodeURIComponent(portId) + '/terminals',
      transformResponse: (response, _meta, { portId }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.port?.id !== portId || !Array.isArray(dto.terminals) || dto.terminals.some(row => !text(row?.id) || row.portId !== portId) || new Set(dto.terminals.map(row => row.id)).size !== dto.terminals.length) throw new Error('The terminal response does not match the selected port.');
        return dto.terminals.filter(row => row.isActive === true).map(row => ({ value: row.id, label: text(row.name) || '—' }));
      },
    }),
    createAdminForwarderJob: builder.mutation({
      async queryFn(fields, api, _options, baseQuery) {
        let body; try { body = forwarderJobBody(fields); } catch (error) { return failure(error.message); }
        const owner = api.getState().auth.admin?.id;
        const profile = await baseQuery(userPath(body.forwarderId) + '/profile');
        if (profile.error) return profile;
        const dto = unwrapApiResponseData(profile.data);
        if (api.getState().auth.admin?.id !== owner) return failure('The session changed. Reopen the form.');
        if (dto?.id !== body.forwarderId || dto.role !== 'FORWARDER' || dto.status !== 'ACTIVE') return failure('Jobs can only be created for an active forwarder.');
        if (body.movementType === 'EXPORT' && dto.details?.exporterLicense?.status !== 'VERIFIED' && dto.exporterLicenseStatus !== 'VERIFIED') return failure('Export jobs require an approved exporter license.');
        return writeForwarder(baseQuery, api, { url: '/admin/jobs', method: 'POST', body }, saved => text(saved?.id) && text(saved.jobNumber) && text(saved.status)
          && saved.forwarderId === body.forwarderId && saved.createdByAdminId === owner && saved.job?.id === saved.id && saved.job.jobNumber === saved.jobNumber && saved.job.status === saved.status);
      }, invalidatesTags: ['AdminForwarders', 'AdminJobs'],
    }),
    getAdminForwarderProfile: builder.query({
      query: ({ id }) => ({ url: `${userPath(id)}/profile` }),
      transformResponse: (response, _meta, { id }) => {
        const profile = adaptAdminForwarderProfile(response);
        if (!profile || profile.id !== id) throw new Error('The API did not return the requested user profile.');
        return profile;
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminPendingExporterLicenses: builder.query({
      query: () => ({ url: '/admin/exporter-licenses/pending' }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response) || {};
        if (!Array.isArray(dto.users)) throw new Error('The exporter license response is missing its pending list.');
        if (dto.users.some(user => !text(user?.id)) || new Set(dto.users.map(user => user.id)).size !== dto.users.length || count(dto.count) == null || dto.count !== dto.users.length) throw new Error('The exporter license list contains invalid records or an incomplete count.');
        return { count: count(dto.count), rows: dto.users.map((user) => ({ id: text(user.id), name: text(user.businessName) || text(user.email) || '—', email: text(user.email) || '—', phone: text(user.phone) || '—', url: forwarderLink(user.exporterLicenseUrl), submitted: forwarderDate(user.exporterLicenseSubmittedAt), status: 'IN_REVIEW' })) };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderDestinations: builder.query({
      query: ({ id }) => ({ url: `${userPath(id)}/saved-destinations` }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response);
        if (!Array.isArray(dto?.destinations)) throw new Error('The saved destinations response is missing its list.');
        if (dto.destinations.some(row => !text(row?.id)) || new Set(dto.destinations.map(row => row.id)).size !== dto.destinations.length || count(dto.total) == null || dto.total !== dto.destinations.length) throw new Error('The saved destinations response contains missing or duplicate records.');
        return dto.destinations.map((row) => {
          const latitude = number(row.latitude), longitude = number(row.longitude);
          const coordinatesValid = latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
          const address = text(row.address);
          const search = coordinatesValid ? `${latitude},${longitude}` : address;
          return { id: text(row.id), name: text(row.label) || '—', address: address || '—', mapUrl: search ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}` : null };
        });
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderJobs: builder.query({
      async queryFn({ id, tab = 'all', page = 1, limit = 10 }, _api, _options, baseQuery) {
        const result = await baseQuery({ url: userPath(id) + '/jobs', params: { tab, page, limit } });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data) || {};
        if (!validPage(dto, 'jobs', page)) return failure('The job history response is missing records or pagination.');
        const rows = dto.jobs.map((job) => ({ id: text(job.jobId) || '—', detailId: text(job.id), cargo: '—', route: text(job.route) || '—', status: label(job.status), date: forwarderDate(job.createdAt), amount: job.currency === 'NGN' ? number(job.value) : null }));
        // User job history supplies the real detail ID and amount. The jobs
        // directory is needed only for its documented cargo type fields.
        if (!(tab === 'completed' && limit === 1)) for (let start = 0; start < rows.length; start += 4) {
          if (_api.signal.aborted) return failure('The forwarder jobs request was cancelled.');
          const enriched = await Promise.all(rows.slice(start, start + 4).map(async (row) => {
            if (row.id === '—') return { ...row, detailUnavailable: true };
            const matches = await readAllPages(baseQuery, '/admin/jobs', 'jobs', { search: row.id }, _api.signal);
            if (matches.error) return { ...row, detailUnavailable: true, detailErrorStatus: matches.error.status };
            const exact = matches.data.filter((job) => job.id === row.detailId && job.company?.id === id);
            if (exact.length !== 1) return { ...row, detailUnavailable: true };
            const cargoTypes = exact[0].cargo?.containerTypes;
            const cargo = Array.isArray(cargoTypes) && cargoTypes.length && cargoTypes.every(type => text(type)) ? cargoTypes.join(', ') : '—';
            return { ...row, cargo };
          }));
          if (enriched.some((row) => row.detailErrorStatus === 401)) return { error: { status: 401 } };
          rows.splice(start, enriched.length, ...enriched);
        }
        return { data: { rows, pagination: dto.pagination } };
      }, providesTags: ['AdminForwarders', 'AdminJobs'],
    }),
    getAdminForwarderTransactions: builder.query({
      query: ({ id, page = 1, limit = 10 }) => ({ url: `${userPath(id)}/transactions`, params: { page, limit } }),
      transformResponse: (response, _meta, { page }) => {
        const dto = unwrapApiResponseData(response) || {};
        if (!validPage(dto, 'transactions', page)) throw new Error('The wallet response is missing records or pagination.');
        return { rows: (dto.transactions || []).map((row) => ({ id: text(row.id), label: text(row.label) || '—', type: label(row.type), amount: number(row.amount), status: label(row.status), date: forwarderDate(row.createdAt) })), pagination: dto.pagination };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderActivity: builder.query({
      async queryFn({ id }, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/audit-logs', 'logs', { entityType: 'USER' }, _api.signal);
        return result.error ? result : { data: result.data.filter((row) => row.entityId === id).map((row) => ({ title: text(row.action), description: [text(row.admin?.name), label(row.result), text(row.note)].filter(Boolean).join(' · '), time: forwarderDate(row.createdAt), state: row.result === 'SUCCESS' ? 'done' : row.result === 'FAILED' ? 'danger' : 'pending', icon: 'user' })) };
      }, providesTags: ['AdminForwarders'],
    }),
    reviewAdminForwarderExporterLicense: builder.mutation({
      query: ({ id, decision, reason }) => {
        if (!text(id) || !['approve', 'reject'].includes(decision)) throw new Error('Invalid exporter license decision.');
        return { url: '/admin/exporter-licenses/' + encodeURIComponent(id) + '/' + decision, method: 'POST', ...(decision === 'reject' ? { body: text(reason) ? { reason: reason.trim() } : {} } : {}) };
      },
      transformResponse: (response, _meta, { id, decision }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.user?.id !== id || dto.user.exporterLicenseStatus !== (decision === 'approve' ? 'VERIFIED' : 'REJECTED')) throw new Error('The license review was accepted, but its result could not be confirmed. Refresh before trying again.');
        return { reviewed: true };
      }, invalidatesTags: ['AdminForwarders'],
    }),
    suspendAdminForwarder: builder.mutation({
      query: ({ id, reason }) => {
        if (!text(id) || !text(reason)) throw new Error('A forwarder and suspension reason are required.');
        return { url: userPath(id) + '/suspend', method: 'POST', body: { reason: reason.trim() } };
      },
      transformResponse: (response, _meta, { id }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.user?.id !== id || dto.user.status !== 'SUSPENDED') throw new Error('Suspension was accepted, but could not be confirmed. Refresh before trying again.');
        return { suspended: true };
      }, invalidatesTags: ['AdminForwarders'],
    }),
    activateAdminForwarder: builder.mutation({
      async queryFn(id, _api, _options, baseQuery) {
        if (!text(id)) return failure('A forwarder is required.');
        const result = await baseQuery({ url: userPath(id) + '/activate', method: 'POST' });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data);
        if (dto?.user?.id !== id) return failure('Reactivation was accepted, but could not be confirmed. Refresh before trying again.');
        const confirmation = await baseQuery(userPath(id) + '/profile');
        const profile = unwrapApiResponseData(confirmation.data);
        if (confirmation.error || profile?.id !== id || profile.role !== 'FORWARDER' || profile.status !== 'ACTIVE') return failure('Reactivation was accepted, but could not be confirmed. Refresh before trying again.');
        return { data: { activated: true } };
      }, invalidatesTags: ['AdminForwarders'],
    }),
    sendAdminForwarderAnnouncement: builder.mutation({
      query: ({ id, title, message, channels }) => {
        if (!text(title) || !text(message) || !Array.isArray(channels) || !channels.length || !channels.every(channel => ['in-app', 'email', 'push'].includes(channel)) || new Set(channels).size !== channels.length || id != null && !text(id)) throw new Error('Enter a title, message and valid delivery channels.');
        return { url: '/admin/support/broadcasts', method: 'POST', body: { title: title.trim(), message: message.trim(), channels, audience: 'FORWARDERS', ...(id ? { userIds: [id] } : {}) } };
      },
      transformResponse: (response, _meta, { id }) => {
        const dto = unwrapApiResponseData(response);
        if (!text(dto?.broadcast?.id) || count(dto.sentCount) == null || dto.sentCount === 0 || id && dto.sentCount !== 1) throw new Error('Announcement delivery could not be confirmed for the intended recipients. Check the broadcast record before trying again.');
        return { sentCount: dto.sentCount };
      },
    }),
  }),
});
export const { useGetAdminForwarderDirectoryQuery, useGetAdminForwarderJobOptionsQuery, useGetAdminForwarderJobTerminalsQuery, useCreateAdminForwarderJobMutation, useGetAdminForwarderRankingsQuery, useGetAdminForwarderNotesQuery, useAddAdminForwarderNoteMutation, useCreateAdminForwarderMutation, useUpdateAdminForwarderMutation, useVerifyAdminForwardersMutation, useRequestAdminForwarderVerificationMutation, useGetAdminForwarderStatsQuery, useGetAdminForwarderDocumentsQuery, useLazyDownloadAdminForwarderReportQuery, useGetAdminForwarderProfileQuery, useGetAdminPendingExporterLicensesQuery, useGetAdminForwarderDestinationsQuery, useGetAdminForwarderJobsQuery, useGetAdminForwarderTransactionsQuery, useGetAdminForwarderActivityQuery, useReviewAdminForwarderExporterLicenseMutation, useSuspendAdminForwarderMutation, useActivateAdminForwarderMutation, useSendAdminForwarderAnnouncementMutation } = forwardersApi;
