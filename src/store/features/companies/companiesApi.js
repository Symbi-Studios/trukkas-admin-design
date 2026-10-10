import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptAdminDriver } from '../drivers/driversApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const truckNumber = (value) => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? number(Number(value)) : number(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const boolean = (value) => typeof value === 'boolean' ? value : null;
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || null;
const named = (value) => text(typeof value === 'object' && value ? value.name : value);
export const companyDate = (value) => {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return '—';
  if (value.length > 10) {
    const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59) return '—';
    const offset = value.match(/[+-](\d{2}):(\d{2})$/);
    if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });
};
export const companyMoney = (value) => number(value) == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
const verification = (value) => ({ VERIFIED: 'Verified', IN_REVIEW: 'Pending', PENDING: 'Pending', PENDING_REVIEW: 'Pending', REJECTED: 'Rejected' }[value] || label(value));

export function adaptAdminCompany(dto = {}) {
  return {
    id: text(dto.id), name: text(dto.businessName) || text(dto.name) || '—',
    truckerType: text(dto.truckerType), regNo: text(dto.rcNumber) || text(dto.cacNumber), location: text(dto.location) || text(dto.businessAddress),
    contactName: text(dto.contactPerson) || text(dto.contactName) || [text(dto.firstName), text(dto.lastName)].filter(Boolean).join(' ') || null,
    contactPhone: text(dto.phone), contactEmail: text(dto.email),
    trucks: count(dto.fleet?.total) ?? count(dto.fleetSize), activeTrucks: count(dto.fleet?.active), drivers: count(dto.driverCount), totalJobs: count(dto.totalJobs),
    statusCode: text(dto.status), displayStatusCode: text(dto.displayStatus) || text(dto.status), status: label(dto.displayStatus || dto.status), verification: verification(dto.verificationStatus ?? dto.kycStatus),
    kycStatusCode: text(dto.verificationStatus ?? dto.kycStatus), isRejected: boolean(dto.isRejected), isVerified: boolean(dto.isVerified),
    joined: companyDate(dto.createdAt || dto.joinedAt), joinedAt: text(dto.createdAt || dto.joinedAt),
    performance: number(dto.completedJobValue), completedJobs: count(dto.completedJobs), taxId: text(dto.taxId), website: text(dto.website), businessType: text(dto.businessType), updated: companyDate(dto.updatedAt),
  };
}

export function adaptAdminCompanyInfo(response) {
  const dto = unwrapApiResponseData(response) || {};
  return { name: text(dto.businessName), regNo: text(dto.cacNumber), location: text(dto.businessAddress), contactName: text(dto.contactPerson), taxId: text(dto.taxId), website: text(dto.website), businessType: text(dto.businessType), updated: companyDate(dto.lastUpdated), verification: verification(dto.kycStatus), kycStatusCode: text(dto.kycStatus), documents: adaptCompanyDocuments(dto.documents), documentCount: count(dto.documentSummary?.total) };
}

function adaptCompanyDocuments(documents) {
  if (!Array.isArray(documents)) return null;
  const keys = new Set();
  return documents.map(dto => {
    const key = text(dto.id) || text(dto.type);
    if (!key || keys.has(key)) throw new Error('The company documents contain missing or duplicate identifiers.');
    keys.add(key);
    return { id: text(dto.id), rowKey: key, type: text(dto.type), name: text(dto.label) || '—', status: label(dto.status), date: companyDate(dto.reviewedAt), uploadedAt: companyDate(dto.uploadedAt), expiry: label(dto.expiryStatus), expiresAt: companyDate(dto.expiresAt) };
  });
}

export function adaptCompanyTruck(truck = {}) {
  return { id: text(truck.id), ref: text(truck.id), plate: text(truck.plateNumber), type: named(truck.containerType), tag: named(truck.containerSize),
    year: count(truckNumber(truck.year)) == null ? null : String(truckNumber(truck.year)), status: label(truck.status), statusCode: text(truck.status), availability: text(truck.availability),
    weight: truckNumber(truck.containerWeight) == null ? null : String(truckNumber(truck.containerWeight)), containerWeight: truckNumber(truck.containerWeight) == null ? null : String(truckNumber(truck.containerWeight)),
    make: text(truck.make), model: text(truck.model), vin: text(truck.vin), engineNumber: text(truck.engineNumber), fuelType: label(truck.fuelType),
    date: null, loc: null, driver: text(truck.assignedDriver?.name), ownerId: text(truck.ownerId) };
}

export function adaptAdminCompanyProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {}, company = dto.details?.company || {}, stats = dto.stats || {};
  const fleet = Array.isArray(dto.trucks) ? dto.trucks.map(adaptCompanyTruck) : null;
  if (fleet && (fleet.some(truck => !truck.id) || new Set(fleet.map(truck => truck.id)).size !== fleet.length)) throw new Error('The company fleet contains missing or duplicate IDs.');
  const fleetKnown = fleet && fleet.every(truck => truck.statusCode);
  return {
    ...adaptAdminCompany({ ...dto, ...company, status: dto.status || account.accountStatus, joinedAt: dto.joinedAt || account.dateJoined, kycStatus: dto.verification?.kycStatus }),
    role: text(dto.role), accountType: text(account.accountType), registrationStatus: label(account.registrationStatus),
    lastLogin: companyDate(dto.lastLoginAt || account.lastLogin),
    totalJobs: count(stats.totalJobs?.count), failedJobs: count(stats.failedJobs?.count),
    totalEarned: number(stats.totalEarned?.amount), walletBalance: number(stats.walletBalance?.amount), updated: companyDate(account.lastUpdated), documentCount: count(dto.verification?.documents?.total),
    fleet,
    fleetCounts: { active: fleetKnown ? fleet.filter(truck => truck.statusCode === 'ACTIVE').length : null, inactive: fleetKnown ? fleet.filter(truck => truck.statusCode === 'INACTIVE').length : null, maintenance: fleet?.every(truck => truck.availability) ? fleet.filter(truck => truck.availability === 'UNDER_MAINTENANCE').length : null },
  };
}

async function readAllPages(baseQuery, url, collection, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, totalPages = 1;
  let expectedTotal = null;
  do {
    if (page > 500) return failure('Company records exceeded the supported page limit.');
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = unwrapApiResponseData(result.data) || {};
    if (!Array.isArray(dto[collection]) || count(dto.pagination?.totalPages) == null || count(dto.pagination?.total) == null || !count(dto.pagination?.limit)) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The API response is missing the list or pagination needed to load all company records.' } };
    }
    if (dto.pagination.page !== page) return { error: { status: 'CUSTOM_ERROR', error: 'The API did not return the requested page of company records.' } };
    totalPages = Math.max(1, dto.pagination.totalPages);
    if (expectedTotal != null && expectedTotal !== dto.pagination.total) return failure('Company records changed while loading. Please refresh.');
    expectedTotal = dto.pagination.total;
    if (page < totalPages && !dto[collection].length) return { error: { status: 'CUSTOM_ERROR', error: 'The API returned an empty page before the end of the company records.' } };
    for (const row of dto[collection]) {
      const key = text(row.id) || (collection === 'settlements' ? text(row.jobId) : null);
      if (!key || seen.has(key)) return failure('The company response contains missing or duplicate record identifiers.');
      rows.push(row); seen.add(key);
    }
    page += 1;
  } while (page <= totalPages);
  return rows.length === expectedTotal ? { data: rows } : failure('The company collection could not be loaded completely.');
}

export function companyError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to view or manage this company.';
  if (error?.status === 404) return 'Company not found.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || text(error?.message) || 'Unable to load company data. Please try again.';
}

export function companyFormBody(form, original) {
  const fields = { name: ['businessName', 150], regNo: ['cacNumber', 30], contactName: ['contactName', 120], contactPhone: ['phone', null], contactEmail: ['email', null], location: ['businessAddress', 300] };
  const body = {};
  for (const [key, [field, max]] of Object.entries(fields)) {
    const value = text(form[key]);
    const previous = original?.[key] === '—' ? null : text(original?.[key]);
    if (original && value === previous) continue;
    if (!value || max && value.length > max) throw new Error(`Please provide a valid ${field}${max ? ` (maximum ${max} characters)` : ''}.`);
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Please provide a valid email address.');
    if (field === 'phone' && !/^\+?[0-9\s-]{10,16}$/.test(value)) throw new Error('Please provide a valid phone number.');
    body[field] = value;
  }
  if (!Object.keys(body).length) throw new Error('No changes to save.');
  return body;
}

export const companiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminCompanies: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/truckers', 'users', { truckerType: 'COMPANY' });
        if (result.error) return result;
        if (result.data.some(dto => dto.truckerType !== 'COMPANY')) return failure('The company directory returned records outside the requested company type.');
        return { data: result.data.map(adaptAdminCompany) };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminPendingCompanies: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/truckers', 'users', { truckerType: 'COMPANY', status: 'pendingReview' });
        return result.error ? result : { data: result.data.map(adaptAdminCompany) };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyStats: builder.query({
      query: () => ({ url: '/admin/users/truckers/stats', params: { truckerType: 'COMPANY' } }),
      transformResponse: response => {
        const data = unwrapApiResponseData(response) || {}, cards = data.cards || {};
        return {
          total: count(cards.totalCompanies), active: count(cards.activeCompanies), verified: count(cards.verifiedCompanies), pending: count(cards.pendingReview), suspended: count(cards.suspendedCompanies), rejected: count(cards.rejectedCompanies),
          trucks: count(cards.totalTrucks), activeTrucks: count(cards.activeTrucks), drivers: count(cards.totalDrivers), paidOut: cards.paidOut?.currency === 'NGN' ? number(cards.paidOut.amount) : null,
          rankings: Array.isArray(data.rankings?.topByRevenueThisMonth) ? data.rankings.topByRevenueThisMonth.map(dto => ({ id: text(dto.id), name: text(dto.name) || '—', revenue: number(dto.revenue), jobs: count(dto.completedJobs) })) : null,
        };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyProfile: builder.query({
      query: ({ id }) => ({ url: `/admin/users/${encodeURIComponent(id)}/profile` }),
      transformResponse: (response, _meta, { id }) => { const company = adaptAdminCompanyProfile(response); if (company?.id !== id) throw new Error('The company API returned a different profile.'); return company; },
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyInfo: builder.query({
      query: ({ id }) => ({ url: `/admin/users/${encodeURIComponent(id)}/company-info` }),
      transformResponse: adaptAdminCompanyInfo,
      providesTags: (_data, _error, { id }) => [{ type: 'AdminCompanies', id }],
    }),
    getAdminCompanyDrivers: builder.query({
      async queryFn({ id }, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/drivers', 'users', { companyId: id });
        if (result.error) return result;
        if (result.data.some(dto => dto.linkedCompany?.id !== id)) return failure('The driver response included a different company.');
        return { data: result.data.map(adaptAdminDriver) };
      },
      providesTags: ['AdminCompanies', 'AdminDrivers'],
    }),
    getAdminCompanyJobs: builder.query({
      query: ({ id, tab = 'all', page = 1, limit = 10 }) => ({ url: `/admin/users/${encodeURIComponent(id)}/jobs`, params: { tab, page, limit } }),
      transformResponse: (response, _meta, { page }) => {
        const dto = unwrapApiResponseData(response) || {};
        if (!Array.isArray(dto.jobs) || count(dto.pagination?.total) == null || count(dto.pagination?.totalPages) == null || !count(dto.pagination?.limit) || dto.pagination.page !== page) throw new Error('The company jobs response is missing the requested records or pagination.');
        if (dto.jobs.some(job => !text(job.id)) || new Set(dto.jobs.map(job => job.id)).size !== dto.jobs.length) throw new Error('The company jobs contain missing or duplicate IDs.');
        return { rows: dto.jobs.map((job) => ({ id: text(job.id), reference: text(job.jobId) || '—', route: text(job.route), status: label(job.status), date: companyDate(job.createdAt), completionDate: companyDate(job.completionDate), amount: job.currency === 'NGN' ? number(job.value) : null })), pagination: dto.pagination };
      },
      providesTags: ['AdminJobs', 'AdminCompanies'],
    }),
    getAdminCompanyPayouts: builder.query({
      async queryFn({ id }, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, `/admin/users/${encodeURIComponent(id)}/settlements`, 'settlements');
        if (result.error) return result;
        return { data: result.data.map(dto => ({
          id: text(dto.jobId), payoutId: null, companyId: id, reference: '—', jobId: text(dto.jobNumber), jobDatabaseId: text(dto.jobId),
          tripCount: count(dto.tripCount), tripIds: null, grossAmount: dto.currency === 'NGN' ? number(dto.gross) : null,
          deductions: dto.currency === 'NGN' ? number(dto.deductions?.driverLateDeliveryDemurrage) : null, netAmount: dto.currency === 'NGN' ? number(dto.netPayable) : null,
          amount: dto.currency === 'NGN' ? number(dto.netPayable) : null, paid: dto.currency === 'NGN' ? number(dto.paid?.total) : null,
          fee: null, source: null, requestedBy: null, dateRequested: '—',
          statusCode: text(dto.state), status: ({ AWAITING_MOBILIZATION: 'Pending', IN_PROGRESS: 'Processing', PAID: 'Completed', HELD: 'On Hold', CANCELLED: 'Cancelled' })[dto.state] || label(dto.state),
          eligibility: label(dto.finalPayoutEligibility), reconciled: boolean(dto.reconciled),
        })) };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyTruck: builder.query({
      query: ({ id }) => `/admin/doc-review/trucks/${encodeURIComponent(id)}`,
      transformResponse: (response, _meta, { id, companyId }) => {
        const dto = unwrapApiResponseData(response);
        if (dto?.id !== id || dto.ownerId !== companyId) throw new Error('The truck details do not belong to this company.');
        return adaptCompanyTruck(dto);
      },
      providesTags: ['AdminCompanies', 'AdminFleet'],
    }),
    getAdminCompanyActivity: builder.query({
      async queryFn({ id }, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/audit-logs', 'logs', { entityType: 'USER' });
        return result.error ? result : { data: result.data.filter((dto) => dto.entityId === id).map((dto) => ({ id: text(dto.id), title: text(dto.action), sub: text(dto.admin?.name), time: companyDate(dto.createdAt), result: label(dto.result) })) };
      },
      providesTags: ['AdminCompanies'],
    }),
    reviewAdminCompany: builder.mutation({
      async queryFn({ id, decision, reason, kycStatus }, _api, _options, baseQuery) {
        if (!text(id) || !['approve', 'reject'].includes(decision) || kycStatus !== 'IN_REVIEW') return failure('This company is not awaiting manual KYB review.');
        if (decision === 'reject' && text(reason)?.length > 500) return failure('The rejection reason must be no longer than 500 characters.');
        const result = await baseQuery({ url: `/admin/kyb/${encodeURIComponent(id)}/${decision}`, method: 'POST', ...(decision === 'reject' ? { body: text(reason) ? { reason: reason.trim() } : {} } : {}) });
        if (result.error) return result;
        const data = unwrapApiResponseData(result.data);
        if (data?.user?.id !== id || data.user.kycStatus !== (decision === 'approve' ? 'VERIFIED' : 'REJECTED')) return failure('The company review was accepted, but its result could not be confirmed. Refresh before trying again.');
        return { data: { reviewed: true } };
      },
      invalidatesTags: ['AdminCompanies', 'AdminFleet'],
    }),
    suspendAdminCompany: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/users/${encodeURIComponent(id)}/suspend`, method: 'POST', body: { reason: reason.trim() } }),
      transformResponse: (response, _meta, { id }) => { const data = unwrapApiResponseData(response); if (data?.user?.id !== id || data.user.status !== 'SUSPENDED') throw new Error('Suspension was accepted, but could not be confirmed. Refresh before trying again.'); return { suspended: true }; },
      invalidatesTags: ['AdminCompanies'],
    }),
    activateAdminCompany: builder.mutation({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await baseQuery({ url: `/admin/users/${encodeURIComponent(id)}/activate`, method: 'POST' });
        if (result.error) return result;
        const confirmation = await baseQuery(`/admin/users/${encodeURIComponent(id)}/profile`);
        const data = unwrapApiResponseData(confirmation.data);
        if (confirmation.error || data?.id !== id || data.status !== 'ACTIVE') return failure('Reactivation was accepted, but could not be confirmed. Refresh before trying again.');
        return { data: { activated: true } };
      },
      invalidatesTags: ['AdminCompanies'],
    }),
    createAdminCompany: builder.mutation({
      query: (form) => ({ url: '/admin/users/truckers', method: 'POST', body: companyFormBody(form) }),
      transformResponse: response => {
        const data = unwrapApiResponseData(response);
        if (!text(data?.company?.id) || data.company.status !== 'PENDING_REVIEW' || data.company.kycStatus !== 'IN_REVIEW') throw new Error('Company creation was accepted, but could not be confirmed. Refresh before submitting again.');
        return { id: data.company.id, sms: boolean(data.invite?.sentVia?.sms), email: boolean(data.invite?.sentVia?.email) };
      },
      invalidatesTags: ['AdminCompanies'],
    }),
    updateAdminCompany: builder.mutation({
      query: ({ id, form, original }) => ({ url: `/admin/users/${encodeURIComponent(id)}/company`, method: 'PATCH', body: companyFormBody(form, original) }),
      transformResponse: (response, _meta, { id }) => {
        const data = unwrapApiResponseData(response);
        if (data?.company?.id !== id || !Array.isArray(data.changed)) throw new Error('The update was accepted, but could not be confirmed. Refresh before submitting again.');
        return { updated: true };
      },
      invalidatesTags: ['AdminCompanies'],
    }),
    messageAdminCompany: builder.mutation({
      query: ({ id, message }) => {
        if (!text(message) || message.trim().length > 2000) throw new Error('Enter a message of no more than 2000 characters.');
        return { url: `/admin/users/${encodeURIComponent(id)}/message`, method: 'POST', body: { message: message.trim() } };
      },
      transformResponse: response => {
        const data = unwrapApiResponseData(response);
        if (!text(data?.threadId)) throw new Error('The message request was accepted, but delivery could not be confirmed. Check the support thread before trying again.');
        return { threadId: data.threadId };
      },
      invalidatesTags: ['AdminCompanies'],
    }),
  }),
});

export const { useGetAdminCompaniesQuery, useGetAdminPendingCompaniesQuery, useGetAdminCompanyStatsQuery, useGetAdminCompanyTruckQuery, useGetAdminCompanyProfileQuery, useGetAdminCompanyInfoQuery, useGetAdminCompanyDriversQuery, useGetAdminCompanyJobsQuery, useGetAdminCompanyPayoutsQuery, useGetAdminCompanyActivityQuery, useReviewAdminCompanyMutation, useSuspendAdminCompanyMutation, useActivateAdminCompanyMutation, useCreateAdminCompanyMutation, useUpdateAdminCompanyMutation, useMessageAdminCompanyMutation } = companiesApi;
