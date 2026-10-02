import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
export const forwarderMoney = (value) => number(value) == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
export const forwarderDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
export function adaptAdminForwarder(dto = {}) {
  return {
    id: text(dto.id), customerId: text(dto.id), name: text(dto.name) || '—', email: text(dto.email) || '—', phone: text(dto.phone) || '—',
    statusCode: text(dto.status), status: ['PENDING_PROFILE', 'PENDING_REVIEW'].includes(dto.status) ? 'Pending' : label(dto.status),
    isExporter: dto.type === 'EXPORTER' || dto.exporterLicenseStatus === 'VERIFIED', exporterLicenseStatus: text(dto.exporterLicenseStatus),
    jobs: number(dto.totalJobs), spend: null, location: '—', joined: '—', verification: '—', kycStatusCode: null,
  };
}
export function adaptAdminForwarderProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {}, exporter = dto.details?.exporterLicense || {}, stats = dto.stats || {};
  // The published example currently covers a trucker. Do not substitute earned
  // income for forwarder spending, or infer KYC from the exporter licence.
  const model = { ...adaptAdminForwarder({ ...dto, status: dto.status || account.accountStatus }), role: text(dto.role),
    isExporter: account.accountType === 'Exporter' || dto.exporterLicenseStatus === 'VERIFIED' || exporter.status === 'VERIFIED',
    exporterLicenseStatus: text(exporter.status) || text(dto.exporterLicenseStatus), exporterLicenseUrl: forwarderLink(exporter.url),
    jobs: number(stats.totalJobs?.count), balance: number(stats.walletBalance?.amount),
    joined: forwarderDate(dto.joinedAt || account.dateJoined), memberSince: forwarderDate(dto.joinedAt || account.dateJoined),
    lastActivity: forwarderDate(dto.lastLoginAt || account.lastLogin), verification: forwarderVerification(dto.verification?.kycStatus), kycStatusCode: text(dto.verification?.kycStatus),
    services: [], creditLimit: null, availableCredit: null, lastPaymentAmount: null, outstandingAmount: null,
  };
  for (const key of ['dob', 'gender', 'nationality', 'nin', 'altPhone', 'address', 'license', 'licenseExpiry', 'exportLicense', 'exportLicenseExpiry', 'yearsExperience', 'languages', 'coverage', 'cargoTypes', 'routes', 'network', 'other', 'emergencyContact', 'emergencyPhone', 'lastPaymentDate', 'outstandingCount', 'paymentTerms']) model[key] = '—';
  return model;
}
async function readAllPages(baseQuery, url, collection, params = {}) {
  const rows = [], seen = new Set(); let page = 1, totalPages = 1, expectedTotal = null;
  do {
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = unwrapApiResponseData(result.data) || {};
    if (!Array.isArray(dto[collection]) || !Number.isInteger(dto.pagination?.totalPages) || dto.pagination.totalPages < 0 || dto.pagination.page !== page || (page < dto.pagination.totalPages && !dto[collection].length)) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The API response is missing valid records or pagination.' } };
    }
    if (!Number.isInteger(dto.pagination.total) || dto.pagination.total < 0 || (expectedTotal != null && expectedTotal !== dto.pagination.total) || dto[collection].some((row) => !text(row?.id))) return { error: { status: 'CUSTOM_ERROR', error: 'The API records or totals changed while loading. Please retry.' } };
    expectedTotal = dto.pagination.total;
    totalPages = Math.max(1, dto.pagination.totalPages);
    for (const row of dto[collection]) if (!seen.has(row.id)) { seen.add(row.id); rows.push(row); }
    page += 1;
  } while (page <= totalPages);
  if (rows.length !== expectedTotal) return { error: { status: 'CUSTOM_ERROR', error: 'The API did not return all records. Please retry.' } };
  return { data: rows };
}
const userPath = (id) => `/admin/users/${encodeURIComponent(id)}`;
export const forwardersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminForwarderDirectory: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/forwarders', 'users');
        if (result.error) return result;
        const rows = result.data.map(adaptAdminForwarder);
        // Full pagination keeps directory filters/counts correct. Bounded profile
        // reads supply the shared KYC and joined-date fields missing in the list.
        for (let start = 0; start < rows.length; start += 4) {
          const enriched = await Promise.all(rows.slice(start, start + 4).map(async (row) => {
            const response = await baseQuery({ url: `${userPath(row.id)}/profile` });
            if (response.error) return { ...row, profileUnavailable: true, profileErrorStatus: response.error.status };
            const profile = adaptAdminForwarderProfile(response.data);
            if (profile?.role !== 'FORWARDER' || profile.id !== row.id) return { ...row, profileUnavailable: true };
            return { ...row, verification: profile.verification, kycStatusCode: profile.kycStatusCode, joined: profile.joined };
          }));
          if (enriched.some((row) => row.profileErrorStatus === 401)) return { error: { status: 401 } };
          rows.splice(start, enriched.length, ...enriched);
        }
        return { data: rows };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderProfile: builder.query({
      query: (id) => ({ url: `${userPath(id)}/profile` }),
      transformResponse: (response, _meta, id) => {
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
        return { count: number(dto.count), rows: Array.isArray(dto.users) ? dto.users.map((user) => ({ id: text(user.id), name: text(user.businessName) || text(user.email) || '—', email: text(user.email) || '—', phone: text(user.phone) || '—', url: forwarderLink(user.exporterLicenseUrl), submitted: forwarderDate(user.exporterLicenseSubmittedAt), status: 'IN_REVIEW' })).filter((row) => row.id) : [] };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderDestinations: builder.query({
      query: (id) => ({ url: `${userPath(id)}/saved-destinations` }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response);
        if (!Array.isArray(dto?.destinations)) throw new Error('The saved destinations response is missing its list.');
        return dto.destinations.map((row) => {
          const latitude = number(row.latitude), longitude = number(row.longitude);
          const coordinatesValid = latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
          const address = text(row.address);
          const search = coordinatesValid ? `${latitude},${longitude}` : address;
          return { id: text(row.id), name: text(row.label) || 'Saved destination', address: address || '—', mapUrl: search ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}` : null };
        });
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderJobs: builder.query({
      async queryFn({ id, tab = 'all', page = 1, limit = 10 }, _api, _options, baseQuery) {
        const result = await baseQuery({ url: `${userPath(id)}/jobs`, params: { tab, page, limit } });
        if (result.error) return result;
        const dto = unwrapApiResponseData(result.data) || {};
        if (!Array.isArray(dto.jobs) || !Number.isInteger(dto.pagination?.total) || !Number.isInteger(dto.pagination?.totalPages) || dto.pagination.page !== page || dto.jobs.some((job) => !text(job?.jobId))) return { error: { status: 'CUSTOM_ERROR', error: 'The job history response is missing records or pagination.' } };
        const rows = dto.jobs.map((job) => ({ id: text(job.jobId), detailId: null, cargo: '—', route: text(job.route) || '—', status: label(job.status), date: forwarderDate(job.createdAt), amount: null }));
        // A history jobId can be a display number. Resolve it through the admin
        // search before linking to a detail UUID; require matching ownership too.
        if (!(tab === 'completed' && limit === 1)) for (let start = 0; start < rows.length; start += 4) {
          const enriched = await Promise.all(rows.slice(start, start + 4).map(async (row) => {
            if (!row.id) return { ...row, detailUnavailable: true };
            const matches = await readAllPages(baseQuery, '/admin/jobs', 'jobs', { search: row.id });
            if (matches.error) return { ...row, detailUnavailable: true, detailErrorStatus: matches.error.status };
            const exact = matches.data.filter((job) => (job.jobNumber === row.id || job.id === row.id) && job.company?.id === id);
            if (exact.length !== 1) return { ...row, detailUnavailable: true };
            const job = exact[0];
            return { ...row, detailId: text(job.id), cargo: text(job.cargo?.label) || text(job.cargo?.description) || '—', amount: job.currency === 'NGN' ? number(job.value) : null };
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
        if (!Array.isArray(dto.transactions) || !Number.isInteger(dto.pagination?.total) || !Number.isInteger(dto.pagination?.totalPages) || dto.pagination.page !== page) throw new Error('The wallet response is missing records or pagination.');
        return { rows: (dto.transactions || []).map((row) => ({ id: text(row.id), label: text(row.label) || '—', type: label(row.type), amount: number(row.amount), status: label(row.status), date: forwarderDate(row.createdAt) })), pagination: dto.pagination };
      }, providesTags: ['AdminForwarders'],
    }),
    getAdminForwarderActivity: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/audit-logs', 'logs', { entityType: 'USER' });
        return result.error ? result : { data: result.data.filter((row) => row.entityId === id).map((row) => ({ title: text(row.action), description: [text(row.admin?.name), label(row.result), text(row.note)].filter(Boolean).join(' · '), time: forwarderDate(row.createdAt), state: row.result === 'SUCCESS' ? 'done' : row.result === 'FAILED' ? 'danger' : 'pending', icon: 'user' })) };
      }, providesTags: ['AdminForwarders'],
    }),
    reviewAdminForwarderExporterLicense: builder.mutation({
      query: ({ id, decision, reason }) => {
        if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid exporter license decision.');
        return { url: `/admin/exporter-licenses/${encodeURIComponent(id)}/${decision}`, method: 'POST', ...(decision === 'reject' ? { body: reason?.trim() ? { reason: reason.trim() } : {} } : {}) };
      }, invalidatesTags: ['AdminForwarders'],
    }),
    suspendAdminForwarder: builder.mutation({
      query: ({ id, reason }) => ({ url: `${userPath(id)}/suspend`, method: 'POST', body: { reason: reason.trim() } }), invalidatesTags: ['AdminForwarders'],
    }),
    activateAdminForwarder: builder.mutation({
      query: (id) => ({ url: `${userPath(id)}/activate`, method: 'POST' }), invalidatesTags: ['AdminForwarders'],
    }),
    sendAdminForwarderAnnouncement: builder.mutation({
      query: ({ id, title, message, channels }) => ({ url: '/admin/support/broadcasts', method: 'POST', body: { title: title.trim(), message: message.trim(), channels, audience: 'FORWARDERS', ...(id ? { userIds: [id] } : {}) } }),
    }),
  }),
});
export const { useGetAdminForwarderDirectoryQuery, useGetAdminForwarderProfileQuery, useGetAdminPendingExporterLicensesQuery, useGetAdminForwarderDestinationsQuery, useGetAdminForwarderJobsQuery, useGetAdminForwarderTransactionsQuery, useGetAdminForwarderActivityQuery, useReviewAdminForwarderExporterLicenseMutation, useSuspendAdminForwarderMutation, useActivateAdminForwarderMutation, useSendAdminForwarderAnnouncementMutation } = forwardersApi;
