import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptAdminDriver } from '../drivers/driversApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || null;
const named = (value) => text(typeof value === 'object' && value ? value.name : value);
export const companyDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const companyMoney = (value) => number(value) == null ? '—' : `₦${value.toLocaleString('en-NG')}`;
const verification = (value) => ({ VERIFIED: 'Verified', IN_REVIEW: 'Pending', PENDING: 'Pending', PENDING_REVIEW: 'Pending', REJECTED: 'Rejected' }[value] || label(value));

export function adaptAdminCompany(dto = {}) {
  return {
    id: text(dto.id), name: text(dto.businessName) || text(dto.name) || '—',
    truckerType: text(dto.truckerType), regNo: text(dto.cacNumber), location: text(dto.businessAddress),
    contactName: [dto.firstName, dto.lastName].filter(Boolean).join(' ') || null,
    contactPhone: text(dto.phone), contactEmail: text(dto.email),
    trucks: number(dto.fleetSize), drivers: number(dto.driverCount), totalJobs: number(dto.totalJobs),
    statusCode: text(dto.status), status: label(dto.status), verification: verification(dto.kycStatus),
    joined: companyDate(dto.createdAt || dto.joinedAt), joinedAt: text(dto.createdAt || dto.joinedAt),
    performance: null, taxId: text(dto.taxId), website: null, businessType: null, updated: '—',
  };
}

export function adaptAdminCompanyInfo(response) {
  const dto = unwrapApiResponseData(response) || {};
  return { name: text(dto.businessName), regNo: text(dto.cacNumber), location: text(dto.businessAddress), taxId: text(dto.taxId), verification: verification(dto.kycStatus), kycStatusCode: text(dto.kycStatus) };
}

export function adaptAdminCompanyProfile(response) {
  const dto = unwrapApiResponseData(response);
  if (!dto || typeof dto !== 'object' || Array.isArray(dto)) return null;
  const account = dto.details?.account || {}, company = dto.details?.company || {}, stats = dto.stats || {};
  return {
    ...adaptAdminCompany({ ...dto, ...company, status: dto.status || account.accountStatus, joinedAt: dto.joinedAt || account.dateJoined, kycStatus: dto.verification?.kycStatus }),
    role: text(dto.role), accountType: text(account.accountType), registrationStatus: label(account.registrationStatus),
    lastLogin: companyDate(dto.lastLoginAt || account.lastLogin),
    totalJobs: number(stats.totalJobs?.count), failedJobs: number(stats.failedJobs?.count),
    completedJobs: null, totalEarned: number(stats.totalEarned?.amount), walletBalance: number(stats.walletBalance?.amount),
    fleet: Array.isArray(dto.trucks) ? dto.trucks.map((truck) => ({
      id: text(truck.id), ref: text(truck.id), plate: text(truck.plateNumber),
      type: named(truck.containerType), tag: named(truck.containerSize), year: truck.year == null ? null : String(truck.year),
      status: label(truck.status), statusCode: text(truck.status), weight: truck.containerWeight == null ? null : String(truck.containerWeight),
      make: text(truck.make), model: text(truck.model), date: null, loc: null, driver: null,
    })).filter((truck) => truck.id) : null,
  };
}

// These lists have no company filter. Read every documented page before applying
// ownership/type filters; a single platform page is not a company directory.
async function readAllPages(baseQuery, url, collection, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, totalPages = 1;
  do {
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return { error: result.error };
    const dto = unwrapApiResponseData(result.data) || {};
    if (!Array.isArray(dto[collection]) || !Number.isInteger(dto.pagination?.totalPages) || dto.pagination.totalPages < 0) {
      return { error: { status: 'CUSTOM_ERROR', error: 'The API response is missing the list or pagination needed to load all company records.' } };
    }
    if (dto.pagination.page !== page) return { error: { status: 'CUSTOM_ERROR', error: 'The API did not return the requested page of company records.' } };
    totalPages = Math.max(1, dto.pagination.totalPages);
    if (page < totalPages && !dto[collection].length) return { error: { status: 'CUSTOM_ERROR', error: 'The API returned an empty page before the end of the company records.' } };
    for (const row of dto[collection]) if (row.id && !seen.has(row.id)) { rows.push(row); seen.add(row.id); }
    page += 1;
  } while (page <= totalPages);
  return { data: rows };
}

export function companyError(error) {
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 403) return 'You do not have permission to view or manage this company.';
  if (error?.status === 404) return 'Company not found.';
  const message = unwrapApiResponseData(error?.data)?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || text(error?.error) || 'Unable to load company data. Please try again.';
}

export const companiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminCompanies: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/truckers', 'users');
        if (result.error) return result;
        const companies = result.data.filter((dto) => dto.truckerType === 'COMPANY').map(adaptAdminCompany);
        // KYB, RC number, address and registration date already exist in the
        // profile contract. Enrich the directory with bounded parallel reads.
        for (let start = 0; start < companies.length; start += 4) {
          const profiles = await Promise.all(companies.slice(start, start + 4).map(async (company) => {
            const profile = await baseQuery({ url: `/admin/users/${encodeURIComponent(company.id)}/profile` });
            if (profile.error) return { ...company, profileUnavailable: true, profileErrorStatus: profile.error.status };
            const detail = adaptAdminCompanyProfile(profile.data);
            if (!detail || detail.role !== 'TRUCKER' || detail.truckerType !== 'COMPANY') return { ...company, profileUnavailable: true };
            return { ...company, ...detail, trucks: company.trucks, drivers: company.drivers, totalJobs: company.totalJobs };
          }));
          if (profiles.some((company) => company.profileErrorStatus === 401)) return { error: { status: 401, data: { message: 'Your session has expired. Please sign in again.' } } };
          companies.splice(start, profiles.length, ...profiles);
        }
        return { data: companies };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminPendingCompanies: builder.query({
      query: () => ({ url: '/admin/truckers/pending' }),
      transformResponse: (response) => (unwrapApiResponseData(response)?.truckers || []).filter((dto) => dto.truckerType === 'COMPANY').map((dto) => adaptAdminCompany({ ...dto, status: 'PENDING_REVIEW' })),
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyProfile: builder.query({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/profile` }),
      transformResponse: adaptAdminCompanyProfile,
      providesTags: (_data, _error, id) => [{ type: 'AdminCompanies', id }],
    }),
    getAdminCompanyInfo: builder.query({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/company-info` }),
      transformResponse: adaptAdminCompanyInfo,
      providesTags: (_data, _error, id) => [{ type: 'AdminCompanies', id }],
    }),
    getAdminCompanyDrivers: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/users/drivers', 'users');
        return result.error ? result : { data: result.data.filter((dto) => dto.linkedCompany?.id === id).map(adaptAdminDriver) };
      },
      providesTags: ['AdminCompanies', 'AdminDrivers'],
    }),
    getAdminCompanyJobs: builder.query({
      query: ({ id, tab = 'all', page = 1, limit = 10 }) => ({ url: `/admin/users/${encodeURIComponent(id)}/jobs`, params: { tab, page, limit } }),
      transformResponse: (response) => {
        const dto = unwrapApiResponseData(response) || {};
        return { rows: (dto.jobs || []).map((job) => ({ id: text(job.jobId), route: text(job.route), status: label(job.status), date: companyDate(job.createdAt), completionDate: companyDate(job.completionDate), amount: null })), pagination: dto.pagination };
      },
      providesTags: ['AdminJobs', 'AdminCompanies'],
    }),
    getAdminCompanyPayouts: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/payouts/all', 'payouts');
        if (result.error) return result;
        return { data: result.data.map((dto) => ({
          id: text(dto.id), companyId: text(dto.party?.id), reference: text(dto.reference), source: label(dto.source),
          amount: number(dto.amount), fee: number(dto.fee), status: label(dto.status), statusCode: text(dto.status),
          requestedBy: text(dto.requestedBy), dateRequested: companyDate(dto.createdAt),
          jobId: null, tripIds: null, grossAmount: null, deductions: null, netAmount: null, eligibility: null,
        })) };
      },
      providesTags: ['AdminCompanies'],
    }),
    getAdminCompanyActivity: builder.query({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await readAllPages(baseQuery, '/admin/audit-logs', 'logs', { entityType: 'USER' });
        return result.error ? result : { data: result.data.filter((dto) => dto.entityId === id).map((dto) => ({ id: text(dto.id), title: text(dto.action), sub: text(dto.admin?.name), time: companyDate(dto.createdAt), result: label(dto.result) })) };
      },
      providesTags: ['AdminCompanies'],
    }),
    reviewAdminCompany: builder.mutation({
      query: ({ id, decision, reason }) => {
        if (!['approve', 'reject'].includes(decision)) throw new Error('Invalid company review decision.');
        return { url: `/admin/truckers/${encodeURIComponent(id)}/${decision}`, method: 'POST', ...(decision === 'reject' ? { body: reason?.trim() ? { reason: reason.trim() } : {} } : {}) };
      },
      invalidatesTags: (_data, error) => error ? [] : ['AdminCompanies', 'AdminFleet'],
    }),
    suspendAdminCompany: builder.mutation({
      query: ({ id, reason }) => ({ url: `/admin/users/${encodeURIComponent(id)}/suspend`, method: 'POST', body: { reason: reason.trim() } }),
      invalidatesTags: (_data, error) => error ? [] : ['AdminCompanies'],
    }),
    activateAdminCompany: builder.mutation({
      query: (id) => ({ url: `/admin/users/${encodeURIComponent(id)}/activate`, method: 'POST' }),
      invalidatesTags: (_data, error) => error ? [] : ['AdminCompanies'],
    }),
  }),
});

export const { useGetAdminCompaniesQuery, useGetAdminPendingCompaniesQuery, useGetAdminCompanyProfileQuery, useGetAdminCompanyInfoQuery, useGetAdminCompanyDriversQuery, useGetAdminCompanyJobsQuery, useGetAdminCompanyPayoutsQuery, useGetAdminCompanyActivityQuery, useReviewAdminCompanyMutation, useSuspendAdminCompanyMutation, useActivateAdminCompanyMutation } = companiesApi;
