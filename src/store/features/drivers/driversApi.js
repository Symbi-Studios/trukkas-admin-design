import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const cleanText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const accountStatusLabels = {
  ACTIVE: 'Active', PENDING_PROFILE: 'Pending Profile', PENDING_REVIEW: 'Pending Review',
  SUSPENDED: 'Inactive', INACTIVE: 'Inactive', BANNED: 'Inactive',
};
const licenseStatusLabels = { VALID: 'Valid', VERIFIED: 'Valid', EXPIRING_SOON: 'Expiring Soon', EXPIRED: 'Expired', PENDING: 'Pending Review', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
const formatEnum = (value) => cleanText(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || null;
const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const historyPagination = (data, args) => ({
  page: finiteNumber(data.pagination?.page) ?? args.page ?? 1,
  limit: finiteNumber(data.pagination?.limit) ?? args.limit ?? 10,
  total: finiteNumber(data.pagination?.total) ?? finiteNumber(data.total) ?? 0,
  totalPages: finiteNumber(data.pagination?.totalPages) ?? 1,
});

export function adaptAdminDriver(dto = {}) {
  const company = dto.linkedCompany || null;
  const name = cleanText(dto.name) || [dto.firstName, dto.lastName].filter(Boolean).join(' ') || null;
  const rawStatus = cleanText(dto.status)?.toUpperCase() || null;
  const isOnTrip = rawStatus === 'ACTIVE' && dto.isOnTrip === true;
  const rawLicense = cleanText(dto.licenseStatus)?.toUpperCase() || null;
  return {
    id: cleanText(dto.id), name: name || '—', email: cleanText(dto.email), phone: cleanText(dto.phone),
    statusCode: rawStatus, isOnTrip, status: isOnTrip ? 'On Trip' : accountStatusLabels[rawStatus] || formatEnum(rawStatus) || '—',
    registrationType: company ? 'Company Driver' : 'Individual Driver',
    company: cleanText(company?.name), linkedCompanyId: cleanText(company?.id),
    license: cleanText(dto.licenseNumber), licenseStatusCode: rawLicense,
    licenseStatus: licenseStatusLabels[rawLicense] || formatEnum(rawLicense) || '—',
    licenseExpiresAt: cleanText(dto.licenseExpiresAt), truckPlate: cleanText(dto.truckPlate),
    totalJobs: typeof dto.totalJobs === 'number' ? dto.totalJobs : null,
    joined: cleanText(dto.createdAt) || cleanText(dto.joinedAt),
    rating: null, reviews: null, totalEarnings: null,
    canReview: rawStatus === 'PENDING_REVIEW',
    canActivate: rawStatus === 'SUSPENDED',
    canSuspend: rawStatus === 'ACTIVE' && !isOnTrip,
  };
}

export function adaptAdminDriverProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {};
  const stats = dto.stats || {};
  const driver = adaptAdminDriver({
    ...dto,
    status: dto.status || account.accountStatus,
    joinedAt: dto.joinedAt || account.dateJoined,
    totalJobs: finiteNumber(stats.totalJobs?.count),
  });
  return {
    ...driver,
    role: cleanText(dto.role),
    registrationType: cleanText(account.accountType) || (dto.linkedCompany ? 'Company Driver' : dto.linkedCompany === null ? 'Individual Driver' : null),
    lastLoginAt: cleanText(dto.lastLoginAt) || cleanText(account.lastLogin),
    registrationStatus: formatEnum(account.registrationStatus),
    failedJobs: finiteNumber(stats.failedJobs?.count),
    totalEarnings: finiteNumber(stats.totalEarned?.amount),
    walletBalance: finiteNumber(stats.walletBalance?.amount),
    jobsChangeThisWeek: finiteNumber(stats.totalJobs?.changeThisWeek),
    earningsChangeThisWeek: finiteNumber(stats.totalEarned?.changeThisWeek),
    kycStatus: formatEnum(dto.verification?.kycStatus),
    trucks: Array.isArray(dto.trucks) ? dto.trucks.map((truck) => ({
      id: cleanText(truck.id), plate: cleanText(truck.plateNumber),
      type: cleanText(truck.containerType), size: cleanText(truck.containerSize),
      year: cleanText(String(truck.year ?? '')), status: formatEnum(truck.status),
    })) : null,
  };
}

function errorBody(response) {
  const data = unwrapApiResponseData(response) || {};
  return {
    message: cleanText(data.message),
    user: data.user ? adaptAdminDriver(data.user) : null,
    driver: data.driver ? adaptAdminDriver(data.driver) : null,
  };
}

export function adminDriverError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to view or manage this driver.';
  if (error?.status === 404) return 'Driver not found.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : cleanText(message)) || 'Unable to load driver data. Please try again.';
}

export const driversApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDrivers: builder.query({
      query: ({ search = '', status, page = 1, limit = 10 } = {}) => ({
        url: '/admin/users/drivers', params: { ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}), page, limit },
      }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        const pagination = data.pagination || {};
        return {
          drivers: (Array.isArray(data.users) ? data.users : []).map(adaptAdminDriver).filter((driver) => driver.id),
          pagination: { page: pagination.page ?? 1, limit: pagination.limit ?? 10, total: pagination.total ?? null, totalPages: pagination.totalPages ?? null },
        };
      },
      providesTags: (result) => [{ type: 'AdminDrivers', id: 'LIST' }, ...(result?.drivers || []).map((driver) => ({ type: 'AdminDrivers', id: driver.id }))],
    }),
    getAdminPendingDrivers: builder.query({
      query: () => ({ url: '/admin/drivers/pending' }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          count: typeof data.count === 'number' ? data.count : Array.isArray(data.drivers) ? data.drivers.length : null,
          drivers: (Array.isArray(data.drivers) ? data.drivers : []).map((driver) => adaptAdminDriver({
            ...driver,
            name: [driver.firstName, driver.lastName].filter(Boolean).join(' '),
            licenseStatus: driver.kycStatus,
            licenseNumber: driver.driverProfile?.licenseNumber,
            licenseExpiresAt: driver.driverProfile?.licenseExpiresAt,
          })).filter((driver) => driver.id),
        };
      },
      providesTags: [{ type: 'AdminDrivers', id: 'PENDING' }],
    }),
    getAdminDriverStats: builder.query({
      query: () => ({ url: '/admin/users/stats' }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        const driverStats = data.byRole?.drivers || {};
        return { total: typeof driverStats.total === 'number' ? driverStats.total : null, newToday: typeof driverStats.today === 'number' ? driverStats.today : null, newThisWeek: typeof driverStats.thisWeek === 'number' ? driverStats.thisWeek : null, newThisMonth: typeof driverStats.thisMonth === 'number' ? driverStats.thisMonth : null };
      },
      providesTags: [{ type: 'AdminDriverStats', id: 'SUMMARY' }],
    }),
    getAdminDriverProfile: builder.query({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/profile` }),
      transformResponse: adaptAdminDriverProfile,
      providesTags: (_result, _error, id) => [{ type: 'AdminDrivers', id }],
    }),
    getAdminDriverJobs: builder.query({
      query: ({ id, tab = 'all', page = 1, limit = 10 }) => ({
        url: `/admin/users/${encodeURIComponent(id)}/jobs`, params: { tab, page, limit },
      }),
      transformResponse: (response, _meta, args) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          rows: (Array.isArray(data.jobs) ? data.jobs : []).map((job) => ({
            id: cleanText(job.jobId), forwarder: cleanText(job.forwarder), trucker: cleanText(job.trucker),
            route: cleanText(job.route), status: formatEnum(job.status),
            createdAt: cleanText(job.createdAt), completedAt: cleanText(job.completionDate),
          })),
          pagination: historyPagination(data, args),
        };
      },
      providesTags: (_result, _error, { id }) => ['AdminJobs', { type: 'AdminDrivers', id }],
    }),
    getAdminDriverTransactions: builder.query({
      query: ({ id, page = 1, limit = 10 }) => ({
        url: `/admin/users/${encodeURIComponent(id)}/transactions`, params: { page, limit },
      }),
      transformResponse: (response, _meta, args) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          rows: (Array.isArray(data.transactions) ? data.transactions : []).map((transaction) => ({
            id: cleanText(transaction.id), label: cleanText(transaction.label),
            type: formatEnum(transaction.type), amount: finiteNumber(transaction.amount),
            status: formatEnum(transaction.status), createdAt: cleanText(transaction.createdAt),
          })),
          pagination: historyPagination(data, args),
        };
      },
      providesTags: (_result, _error, { id }) => [{ type: 'AdminDrivers', id }],
    }),
    getAdminDriverLicense: builder.query({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/license` }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        const rawStatus = cleanText(data.kycStatus)?.toUpperCase() || null;
        return { statusCode: rawStatus, status: licenseStatusLabels[rawStatus] || formatEnum(rawStatus) || '—', licenseNumber: cleanText(data.licenseNumber), licenseUrl: cleanText(data.licenseUrl), expiresAt: cleanText(data.licenseExpiresAt) };
      },
      providesTags: (_result, _error, id) => [{ type: 'AdminDrivers', id: `${id}-license` }],
    }),
    reviewAdminDriver: builder.mutation({
      query: ({ id, decision, reason }) => ({
        url: `/admin/drivers/${encodeURIComponent(id)}/${decision}`,
        method: 'POST',
        ...(decision === 'reject' ? { body: reason?.trim() ? { reason: reason.trim() } : {} } : {}),
      }),
      transformResponse: errorBody,
      invalidatesTags: (_result, error) => error ? [] : ['AdminDrivers', 'AdminDriverStats'],
    }),
    verifyAdminDriverLicense: builder.mutation({
      query: ({ id, decision, reason }) => ({
        url: `/admin/users/${encodeURIComponent(id)}/${decision === 'approve' ? 'approve-license' : 'reject-license'}`,
        method: 'POST',
        ...(decision === 'reject' ? { body: reason?.trim() ? { reason: reason.trim() } : {} } : {}),
      }),
      transformResponse: (response) => errorBody(response),
      invalidatesTags: (_result, error, { id }) => error ? [] : [{ type: 'AdminDrivers', id }, { type: 'AdminDrivers', id: `${id}-license` }, 'AdminDrivers'],
    }),
    suspendAdminDriver: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/users/${encodeURIComponent(id)}/suspend`, method: 'POST', body: { reason } }),
      transformResponse: errorBody,
      invalidatesTags: (_result, error) => error ? [] : ['AdminDrivers', 'AdminDriverStats'],
    }),
    activateAdminDriver: builder.mutation({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/activate`, method: 'POST' }),
      transformResponse: errorBody,
      invalidatesTags: (_result, error) => error ? [] : ['AdminDrivers', 'AdminDriverStats'],
    }),
  }),
});

export const {
  useGetAdminDriversQuery, useGetAdminPendingDriversQuery, useGetAdminDriverStatsQuery,
  useGetAdminDriverProfileQuery, useGetAdminDriverLicenseQuery, useReviewAdminDriverMutation,
  useGetAdminDriverJobsQuery, useGetAdminDriverTransactionsQuery,
  useVerifyAdminDriverLicenseMutation, useSuspendAdminDriverMutation, useActivateAdminDriverMutation,
} = driversApi;
