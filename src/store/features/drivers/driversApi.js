import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const cleanText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const records = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
const accountStatusLabels = {
  ACTIVE: 'Active', PENDING_PROFILE: 'Pending Profile', PENDING_REVIEW: 'Pending Review',
  SUSPENDED: 'Inactive', INACTIVE: 'Inactive', BANNED: 'Inactive',
};
const licenseStatusLabels = { VALID: 'Valid', VERIFIED: 'Verified', EXPIRING_SOON: 'Expiring Soon', EXPIRED: 'Expired', PENDING: 'Pending Review', PENDING_REVIEW: 'Pending Review', REJECTED: 'Rejected' };
const formatEnum = (value) => cleanText(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || null;
const finiteNumber = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null;
const count = (value) => Number.isSafeInteger(finiteNumber(value)) && finiteNumber(value) >= 0 ? finiteNumber(value) : null;
function date(value) {
  if (!cleanText(value) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}
const historyPagination = (data, args) => ({
  page: count(data.pagination?.page) || args.page || 1,
  limit: count(data.pagination?.limit) || args.limit || 10,
  total: count(data.pagination?.total) ?? count(data.total),
  totalPages: count(data.pagination?.totalPages),
});

const driverFilters = ({ status, registrationType, companyId, licenseStatus, onTrip, search } = {}) => {
  const licenseVerificationStatus = ['PENDING_REVIEW', 'REJECTED'].includes(licenseStatus) ? licenseStatus : undefined;
  return Object.fromEntries(Object.entries({
    status: status === 'INACTIVE' ? undefined : status,
    statuses: status === 'INACTIVE' ? 'INACTIVE,SUSPENDED,BANNED' : undefined,
    registrationType, companyId,
    licenseStatus: licenseVerificationStatus ? undefined : licenseStatus,
    licenseVerificationStatus, onTrip, search: cleanText(search),
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
};

async function allUsers(baseQuery, path, params = {}, signal) {
  const users = new Map();
  let page = 1, pages = 1;
  do {
    if (signal?.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Driver directory request cancelled.' } };
    const result = await baseQuery({ url: path, params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const data = unwrapApiResponseData(result.data);
    const totalPages = count(data?.pagination?.totalPages), total = count(data?.pagination?.total);
    if (!Array.isArray(data?.users) || totalPages == null || total == null || (page < totalPages && !data.users.length)) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The driver directory response is incomplete.' } };
    }
    pages = Math.max(1, totalPages);
    for (const user of records(data.users)) if (cleanText(user.id)) users.set(user.id, user);
    if (page >= pages && users.size !== total) return { error: { status: 'CUSTOM_ERROR', error: 'The driver directory could not load every record.' } };
    page += 1;
  } while (page <= pages);
  return { data: [...users.values()] };
}

export function adaptAdminDriver(dto = {}) {
  const company = record(dto.linkedCompany);
  const license = record(dto.license);
  const name = cleanText(dto.name) || [cleanText(dto.firstName), cleanText(dto.lastName)].filter(Boolean).join(' ') || null;
  const rawStatus = cleanText(dto.status)?.toUpperCase() || null;
  const isOnTrip = typeof dto.isOnTrip === 'boolean' ? dto.isOnTrip : null;
  const displayStatus = cleanText(dto.displayStatus)?.toUpperCase() || (dto.isRejected === true ? 'REJECTED' : isOnTrip === true ? 'ON_TRIP' : rawStatus);
  const rawLicense = cleanText(dto.licenseStatus)?.toUpperCase() || null;
  return {
    id: cleanText(dto.id), name: name || '—', email: cleanText(dto.email), phone: cleanText(dto.phone),
    statusCode: rawStatus, displayStatusCode: displayStatus, isOnTrip, status: displayStatus === 'ON_TRIP' ? 'On Trip' : accountStatusLabels[displayStatus] || formatEnum(displayStatus) || '—',
    registrationType: dto.registrationType === 'COMPANY' ? 'Company Driver' : dto.registrationType === 'INDIVIDUAL' ? 'Individual Driver' : cleanText(company.id) ? 'Company Driver' : dto.linkedCompany === null ? 'Individual Driver' : '—',
    company: cleanText(company?.name), linkedCompanyId: cleanText(company?.id),
    license: cleanText(license.number) || cleanText(dto.licenseNumber), licenseStatusCode: rawLicense,
    licenseVerificationStatus: cleanText(license.verificationStatus),
    licenseStatus: licenseStatusLabels[rawLicense] || formatEnum(rawLicense) || '—',
    licenseExpiresAt: date(license.expiresAt) || date(dto.licenseExpiresAt), truckPlate: cleanText(record(dto.assignedTruck).plateNumber) || cleanText(dto.truckPlate),
    totalJobs: count(dto.totalJobs),
    joined: date(dto.joinedAt) || date(dto.createdAt),
    rating: count(record(dto.rating).count) === 0 ? null : finiteNumber(record(dto.rating).average), reviews: count(record(dto.rating).count), totalEarnings: finiteNumber(record(dto.earnings).completedTripValue),
    currency: cleanText(record(dto.earnings).currency),
    isRejected: typeof dto.isRejected === 'boolean' ? dto.isRejected : null,
    rejectionReason: cleanText(dto.rejectionReason), rejectedAt: date(dto.rejectedAt),
    canReview: rawStatus === 'PENDING_REVIEW',
    canActivate: rawStatus === 'SUSPENDED',
    canSuspend: rawStatus === 'ACTIVE' && isOnTrip === false,
  };
}

export function adaptAdminDriverProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = record(record(dto.details).account);
  const stats = record(dto.stats);
  // DRIVER profiles return one assigned truck; company profiles return trucks[].
  const trucks = Object.hasOwn(dto, 'truck')
    ? dto.truck === null ? [] : dto.truck && typeof dto.truck === 'object' && !Array.isArray(dto.truck) ? [dto.truck] : null
    : Array.isArray(dto.trucks) ? dto.trucks : null;
  const driver = adaptAdminDriver({
    ...dto,
    status: dto.status || account.accountStatus,
    joinedAt: date(dto.joinedAt) || date(account.dateJoined),
    totalJobs: finiteNumber(stats.totalJobs?.count),
  });
  return {
    ...driver,
    role: cleanText(dto.role),
    registrationType: cleanText(account.accountType) || (driver.registrationType === '—' ? null : driver.registrationType),
    lastLoginAt: date(dto.lastLoginAt) || date(account.lastLogin),
    registrationStatus: formatEnum(account.registrationStatus),
    failedJobs: count(stats.failedJobs?.count),
    totalEarnings: finiteNumber(stats.totalEarned?.amount),
    walletBalance: finiteNumber(stats.walletBalance?.amount),
    jobsChangeThisWeek: finiteNumber(stats.totalJobs?.changeThisWeek),
    earningsChangeThisWeek: finiteNumber(stats.totalEarned?.changeThisWeek),
    kycStatus: formatEnum(dto.verification?.kycStatus),
    trucks: trucks ? records(trucks).map((truck) => ({
      id: cleanText(truck.id), plate: cleanText(truck.plateNumber),
      type: cleanText(truck.containerType), size: cleanText(truck.containerSize),
      year: cleanText(truck.year) || (count(truck.year) != null ? String(truck.year) : null), status: formatEnum(truck.status),
    })) : null,
  };
}

function adaptDriverEarnings(response, months) {
  const dto = record(unwrapApiResponseData(response));
  if (!Array.isArray(dto.months) || dto.months.length !== months) throw new Error('The driver earnings response is missing its monthly series.');
  const rows = dto.months.map((item) => ({
    month: cleanText(item?.month), completedTrips: count(item?.completedTrips),
    completedTripValue: finiteNumber(item?.completedTripValue), currency: cleanText(item?.currency),
  })).sort((left, right) => (left.month || '').localeCompare(right.month || ''));
  let previous = null;
  for (const row of rows) {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(row.month || '') || row.completedTrips == null
      || row.completedTripValue == null || row.completedTripValue < 0 || row.currency !== 'NGN') throw new Error('The driver earnings response contains invalid monthly values.');
    const index = Number(row.month.slice(0, 4)) * 12 + Number(row.month.slice(5)) - 1;
    if (previous != null && index !== previous + 1) throw new Error('The driver earnings response has missing or duplicate months.');
    previous = index;
  }
  return {
    months: rows,
    chart: rows.map((row) => ({ label: new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', month: 'short' }).format(new Date(row.month + '-01T00:00:00Z')), value: row.completedTripValue })),
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

function adaptDriverActivity(response) {
  const data = record(unwrapApiResponseData(response));
  const review = record(data.reviews);
  return {
    maintenance: records(data.maintenanceHistory).map((item, index) => ({
      id: cleanText(item.id) || `maintenance-${index}`, reference: cleanText(item.reference) || '—',
      type: formatEnum(item.type) || '—', severity: formatEnum(item.severity) || '—', status: formatEnum(item.status) || '—',
      description: cleanText(item.description) || '—', dueDate: date(item.dueDate), completedAt: date(item.completedAt), serviceCenter: cleanText(item.serviceCenterName) || '—',
    })),
    incidents: records(data.incidents).map((item, index) => ({
      id: cleanText(item.id) || `incident-${index}`, source: formatEnum(item.source) || '—',
      type: formatEnum(item.type) || '—', status: formatEnum(item.status) || '—', description: cleanText(item.description) || '—',
      job: cleanText(record(item.job).jobNumber) || '—', createdAt: date(item.createdAt), resolvedAt: date(item.resolvedAt),
    })),
    notes: records(data.notes).map((item, index) => ({
      id: cleanText(item.id) || `note-${index}`, body: cleanText(item.body) || '—', admin: cleanText(record(item.admin).name) || '—', createdAt: date(item.createdAt),
    })),
    reviews: {
      average: count(review.count) === 0 ? null : finiteNumber(review.average), count: count(review.count),
      items: records(review.items).map((item, index) => ({
        id: cleanText(item.id) || `review-${index}`, score: finiteNumber(item.score), comment: cleanText(item.comment) || '—',
        rater: cleanText(record(item.rater).name) || '—', job: cleanText(record(item.job).jobNumber) || '—', createdAt: date(item.createdAt),
      })),
    },
  };
}

export function adminDriverError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to view or manage this driver.';
  if (error?.status === 404) return 'Driver not found.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : cleanText(message)) || cleanText(error?.error) || 'Unable to load driver data. Please try again.';
}

export const driversApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminDrivers: builder.query({
      async queryFn({ page = 1, limit = 10, ...filters } = {}, api, _options, baseQuery) {
        if (filters.tabStatus && filters.tabStatus !== 'ON_TRIP' && filters.status !== filters.tabStatus) {
          return { data: { drivers: [], pagination: { page, limit, total: 0, totalPages: 0 } } };
        }
        const params = driverFilters(filters);
        const result = await baseQuery({ url: '/admin/users/drivers', params: { ...params, page, limit } });
        if (result.error) return result;
        const data = unwrapApiResponseData(result.data);
        if (!Array.isArray(data?.users)) return { error: { status: 'CUSTOM_ERROR', error: 'The driver response is missing its list.' } };
        return { data: { drivers: records(data.users).map(adaptAdminDriver).filter((driver) => driver.id), pagination: historyPagination(data, { page, limit }) } };
      },
      providesTags: (result) => [{ type: 'AdminDrivers', id: 'LIST' }, ...(result?.drivers || []).map((driver) => ({ type: 'AdminDrivers', id: driver.id }))],
    }),
    getAdminPendingDrivers: builder.query({
      query: () => ({ url: '/admin/drivers/pending' }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          count: count(data.count),
          drivers: records(data.drivers).map((driver) => adaptAdminDriver({
            ...driver,
            name: [cleanText(driver.firstName), cleanText(driver.lastName)].filter(Boolean).join(' '),
            licenseNumber: driver.driverProfile?.licenseNumber,
            licenseExpiresAt: driver.driverProfile?.licenseExpiresAt,
          })).filter((driver) => driver.id),
        };
      },
      providesTags: [{ type: 'AdminDrivers', id: 'PENDING' }],
    }),
    getAdminDriverStats: builder.query({
      query: () => ({ url: '/admin/users/drivers/stats' }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          ...Object.fromEntries(['total', 'individual', 'company', 'pendingReview', 'active', 'onTrip', 'inactive', 'rejected', 'suspended', 'banned'].map((key) => [key, count(data[key])])),
          documentsExpiring: { expiringSoon: count(data.documentsExpiring?.expiringSoon), expired: count(data.documentsExpiring?.expired), noLicenseOnFile: count(data.documentsExpiring?.noLicenseOnFile), withinDays: count(data.documentsExpiring?.withinDays) },
          earnings: { completedTrips: count(data.earnings?.completedTrips), completedTripValue: finiteNumber(data.earnings?.completedTripValue), currency: cleanText(data.earnings?.currency) },
          averageRating: { average: count(data.averageRating?.count) === 0 ? null : finiteNumber(data.averageRating?.average), count: count(data.averageRating?.count) },
        };
      },
      providesTags: [{ type: 'AdminDriverStats', id: 'SUMMARY' }],
    }),
    getAdminDriverEarnings: builder.query({
      async queryFn(months = 6, _api, _options, baseQuery) {
        if (!Number.isSafeInteger(months) || months < 1 || months > 24) return { error: { status: 'CUSTOM_ERROR', error: 'Choose between 1 and 24 months.' } };
        const result = await baseQuery({ url: '/admin/users/drivers/earnings', params: { months } });
        if (result.error) return result;
        try { return { data: adaptDriverEarnings(result.data, months) }; }
        catch (error) { return { error: { status: 'CUSTOM_ERROR', error: error.message } }; }
      },
      providesTags: [{ type: 'AdminDriverStats', id: 'EARNINGS' }],
    }),
    getAdminDriverProfile: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        if (!cleanText(id)) return { error: { status: 'CUSTOM_ERROR', error: 'A driver ID is required.' } };
        const result = await baseQuery({ url: '/admin/users/' + encodeURIComponent(id) + '/profile' });
        if (result.error) return result;
        const profile = adaptAdminDriverProfile(result.data);
        return profile?.id === id && profile.role === 'DRIVER' ? { data: profile }
          : { error: { status: 'CUSTOM_ERROR', error: 'The profile response does not identify the requested driver.' } };
      },
      providesTags: (_result, _error, id) => [{ type: 'AdminDrivers', id }],
    }),
    getAdminDriverCompanies: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await allUsers(baseQuery, '/admin/users/truckers', { truckerType: 'COMPANY' }, api.signal);
        return result.error ? result : { data: result.data.filter((item) => cleanText(item.id) && cleanText(item.name)).map((item) => ({ id: item.id, name: item.name, email: cleanText(item.email) })) };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminDriverCompanyTrucks: builder.query({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/profile` }),
      transformResponse: (response) => records(unwrapApiResponseData(response)?.trucks)
        .filter((truck) => cleanText(truck.id) && cleanText(truck.plateNumber) && truck.assignedDriver === null)
        .map((truck) => ({ id: truck.id, plate: truck.plateNumber })),
      providesTags: ['AdminFleet', 'AdminCompanies'],
    }),
    getAdminDriverRankings: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const result = await allUsers(baseQuery, '/admin/users/drivers', {}, api.signal);
        if (result.error) return result;
        return { data: result.data.map(adaptAdminDriver).filter((driver) => driver.rating != null && driver.reviews > 0)
          .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || a.id.localeCompare(b.id)).slice(0, 5) };
      },
      providesTags: ['AdminDrivers'],
    }),
    getAdminDriverActivity: builder.query({
      query: (id) => ({ url: `/admin/users/drivers/${encodeURIComponent(id)}/activity` }),
      transformResponse: adaptDriverActivity,
      providesTags: (_result, _error, id) => [{ type: 'AdminDrivers', id }],
    }),
    createAdminDriver: builder.mutation({
      query: (fields) => ({ url: '/admin/users/drivers', method: 'POST', body: Object.fromEntries(
        ['firstName', 'lastName', 'email', 'phone', 'licenseNumber', 'licenseExpiresAt', 'companyId', 'truckId']
          .map((key) => [key, cleanText(fields[key])]).filter(([, value]) => value != null)
      ) }),
      transformResponse: (response) => {
        const data = record(unwrapApiResponseData(response));
        return { id: cleanText(data.driver?.id), invite: { sms: typeof data.invite?.sentVia?.sms === 'boolean' ? data.invite.sentVia.sms : null, email: typeof data.invite?.sentVia?.email === 'boolean' ? data.invite.sentVia.email : null } };
      },
      invalidatesTags: (_result, error) => error ? [] : ['AdminDrivers', 'AdminDriverStats', 'AdminFleet', 'AdminCompanies'],
    }),
    importAdminDrivers: builder.mutation({
      query: (file) => {
        const body = new FormData(); body.append('file', file);
        return { url: '/admin/users/drivers/import', method: 'POST', body };
      },
      transformResponse: (response) => {
        const data = record(unwrapApiResponseData(response));
        return { created: count(data.created), failed: count(data.failed), results: records(data.results).map((item) => ({ line: count(item.line), status: cleanText(item.status), error: cleanText(item.error) })) };
      },
      invalidatesTags: (_result, error) => error ? [] : ['AdminDrivers', 'AdminDriverStats', 'AdminFleet', 'AdminCompanies'],
    }),
    exportAdminDriverCompliance: builder.query({
      query: (filters = {}) => ({ url: '/admin/users/drivers/export', params: driverFilters(filters), responseHandler: 'text', headers: { Accept: 'text/csv' } }),
      transformResponse: (response) => {
        if (typeof response !== 'string') throw new Error('The compliance report response is not CSV.');
        return response;
      },
    }),
    getAdminDriverJobs: builder.query({
      query: ({ id, tab = 'all', page = 1, limit = 10 }) => ({
        url: `/admin/users/${encodeURIComponent(id)}/jobs`, params: { tab, page, limit },
      }),
      transformResponse: (response, _meta, args) => {
        const data = unwrapApiResponseData(response) || {};
        return {
          rows: records(data.jobs).map((job) => ({
            id: cleanText(job.jobId) || '—', forwarder: cleanText(job.forwarder) || '—', trucker: cleanText(job.trucker) || '—',
            route: cleanText(job.route) || '—', status: formatEnum(job.status) || '—',
            createdAt: date(job.createdAt), completedAt: date(job.completionDate),
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
          rows: records(data.transactions).map((transaction) => ({
            id: cleanText(transaction.id) || '—', label: cleanText(transaction.label) || '—',
            type: formatEnum(transaction.type) || '—', amount: finiteNumber(transaction.amount),
            status: formatEnum(transaction.status) || '—', createdAt: date(transaction.createdAt),
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
        return { statusCode: rawStatus, status: licenseStatusLabels[rawStatus] || formatEnum(rawStatus) || '—', licenseNumber: cleanText(data.licenseNumber), licenseUrl: cleanText(data.licenseUrl), expiresAt: date(data.licenseExpiresAt) };
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
  useGetAdminDriversQuery, useGetAdminPendingDriversQuery, useGetAdminDriverStatsQuery, useGetAdminDriverEarningsQuery,
  useGetAdminDriverProfileQuery, useGetAdminDriverLicenseQuery, useReviewAdminDriverMutation,
  useGetAdminDriverJobsQuery, useGetAdminDriverTransactionsQuery,
  useGetAdminDriverCompaniesQuery, useGetAdminDriverCompanyTrucksQuery, useGetAdminDriverRankingsQuery, useGetAdminDriverActivityQuery,
  useCreateAdminDriverMutation, useImportAdminDriversMutation, useLazyExportAdminDriverComplianceQuery,
  useVerifyAdminDriverLicenseMutation, useSuspendAdminDriverMutation, useActivateAdminDriverMutation,
} = driversApi;
