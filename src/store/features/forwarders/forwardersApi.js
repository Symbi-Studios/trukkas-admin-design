import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

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
export function adaptAdminForwarder(dto = {}) {
  return {
    id: text(dto.id), customerId: text(dto.id), name: text(dto.name) || '—', email: text(dto.email) || '—', phone: text(dto.phone) || '—',
    statusCode: text(dto.status), status: ['PENDING_PROFILE', 'PENDING_REVIEW'].includes(dto.status) ? 'Pending' : label(dto.status),
    isExporter: dto.type === 'EXPORTER' ? true : dto.type === 'FORWARDER' ? false : dto.exporterLicenseStatus === 'VERIFIED' ? true : null, exporterLicenseStatus: text(dto.exporterLicenseStatus),
    jobs: count(dto.totalJobs), spend: null, location: '—', joined: '—', verification: '—', kycStatusCode: null,
  };
}
export function adaptAdminForwarderProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {}, exporter = dto.details?.exporterLicense || {}, stats = dto.stats || {};
  // The published example currently covers a trucker. Do not substitute earned
  // income for forwarder spending, or infer KYC from the exporter licence.
  const model = { ...adaptAdminForwarder({ ...dto, status: dto.status || account.accountStatus }), role: text(dto.role),
    isExporter: account.accountType === 'Exporter' ? true : account.accountType === 'Forwarder' ? false : dto.exporterLicenseStatus === 'VERIFIED' || exporter.status === 'VERIFIED' ? true : adaptAdminForwarder(dto).isExporter,
    exporterLicenseStatus: text(exporter.status) || text(dto.exporterLicenseStatus), exporterLicenseUrl: forwarderLink(exporter.url),
    jobs: count(stats.totalJobs?.count), balance: number(stats.walletBalance?.amount),
    joined: forwarderDate(dto.joinedAt || account.dateJoined), memberSince: forwarderDate(dto.joinedAt || account.dateJoined),
    lastActivity: forwarderDate(dto.lastLoginAt || account.lastLogin), verification: forwarderVerification(dto.verification?.kycStatus), kycStatusCode: text(dto.verification?.kycStatus),
    services: [], creditLimit: null, availableCredit: null, lastPaymentAmount: null, outstandingAmount: null,
  };
  for (const key of ['dob', 'gender', 'nationality', 'nin', 'altPhone', 'address', 'license', 'licenseExpiry', 'exportLicense', 'exportLicenseExpiry', 'yearsExperience', 'languages', 'coverage', 'cargoTypes', 'routes', 'network', 'other', 'emergencyContact', 'emergencyPhone', 'lastPaymentDate', 'outstandingCount', 'paymentTerms']) model[key] = '—';
  return model;
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
    if (!Array.isArray(dto[collection]) || count(meta?.totalPages) == null || count(meta.total) == null || !count(meta.limit) || meta.page !== page
      || meta.total > 0 && meta.totalPages === 0 || page < meta.totalPages && !dto[collection].length) return failure('The API response is missing valid records or pagination.');
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
    && !(meta.total > 0 && meta.totalPages === 0) && rows.length <= meta.limit && rows.length <= meta.total
    && rows.every(row => text(row?.id)) && new Set(rows.map(row => row.id)).size === rows.length;
}
const userPath = (id) => `/admin/users/${encodeURIComponent(id)}`;
export const forwardersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminForwarderDirectory: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/forwarders', 'users', {}, _api.signal);
        if (result.error) return result;
        const rows = result.data.map(adaptAdminForwarder);
        // Full pagination keeps directory filters/counts correct. Bounded profile
        // reads supply the shared KYC and joined-date fields missing in the list.
        for (let start = 0; start < rows.length; start += 4) {
          if (_api.signal.aborted) return failure('The forwarder directory request was cancelled.');
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
export const { useGetAdminForwarderDirectoryQuery, useGetAdminForwarderProfileQuery, useGetAdminPendingExporterLicensesQuery, useGetAdminForwarderDestinationsQuery, useGetAdminForwarderJobsQuery, useGetAdminForwarderTransactionsQuery, useGetAdminForwarderActivityQuery, useReviewAdminForwarderExporterLicenseMutation, useSuspendAdminForwarderMutation, useActivateAdminForwarderMutation, useSendAdminForwarderAnnouncementMutation } = forwardersApi;
