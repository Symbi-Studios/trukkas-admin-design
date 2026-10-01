import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const registrationPath = '/admin/doc-review/trucks';
const labels = { PENDING_REVIEW: 'Pending Review', ACTIVE: 'Active', APPROVED: 'Approved', REJECTED: 'Rejected', INACTIVE: 'Inactive' };
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const named = (value) => text(typeof value === 'object' && value ? value.name : value);
const photoUrl = (value) => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
export function fleetDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fleetError(error) {
  if (error?.status === 403) return 'You do not have permission to view or manage these trucks.';
  if (error?.status === 401) return 'Your session has expired. Please sign in again.';
  if (error?.status === 404) return 'Truck not found.';
  const message = error?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : text(message)) || 'Unable to load fleet data. Please try again.';
}

// Registration state must not be interpreted as availability or an on-trip state.
function adaptTruck(dto = {}) {
  const owner = dto.owner || {};
  const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
  return {
    id: text(dto.id), plate: text(dto.plateNumber) || '—', ref: text(dto.id) || '—',
    company: text(dto.truckerName) || text(owner.businessName) || text(ownerName),
    ownerId: text(dto.ownerId) || text(owner.id),
    statusCode: text(dto.status), status: labels[dto.status] || text(dto.status) || '—',
    requestType: text(dto.requestTypeLabel) || text(dto.requestType),
    submittedAt: text(dto.submittedAt), createdAt: text(dto.createdAt),
    type: named(dto.containerType), tag: named(dto.containerSize),
    // The API does not document the weight unit. Preserve it without guessing kg/tonnes.
    containerWeight: dto.containerWeight == null ? null : String(dto.containerWeight),
    make: text(dto.make), model: text(dto.model), year: dto.year == null ? null : String(dto.year),
    photos: Array.isArray(dto.photos) ? dto.photos.map(photoUrl).filter(Boolean) : [],
    driver: null, dr: null, tc: text(dto.ownerId) || text(owner.id),
    loc: null, state: null, trip: null, date: null,
    canReviewRegistration: dto.status === 'PENDING_REVIEW',
  };
}

export function mergeFleetInspection(truck, inspections = []) {
  if (!truck) return null;
  const inspection = inspections.find((row) => row.id === truck.id);
  if (!inspection) return { ...truck, canReviewInspection: false };
  const merged = { ...inspection, ...truck, canReviewInspection: truck.statusCode === 'PENDING_REVIEW' };
  for (const field of ['company', 'ownerId', 'tc', 'type', 'tag', 'make', 'model', 'year', 'createdAt']) {
    merged[field] = truck[field] ?? inspection[field];
  }
  if (!truck.photos.length) merged.photos = inspection.photos;
  return merged;
}

export const fleetApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminFleetTrucks: builder.query({
      query: ({ search = '', page = 1, limit = 10 } = {}) => ({
        url: registrationPath, params: { tab: 'all', ...(search.trim() ? { search: search.trim() } : {}), page, limit },
      }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        const pagination = data.pagination || {};
        return {
          trucks: (Array.isArray(data.trucks) ? data.trucks : []).map(adaptTruck).filter((row) => row.id),
          pagination: { page: pagination.page ?? 1, limit: pagination.limit ?? 10, total: pagination.total ?? null, totalPages: pagination.totalPages ?? null },
        };
      },
      providesTags: (data) => [{ type: 'AdminFleet', id: 'LIST' }, ...(data?.trucks || []).map((row) => ({ type: 'AdminFleet', id: row.id }))],
    }),
    getAdminFleetTruck: builder.query({
      query: (id) => ({ url: `${registrationPath}/${encodeURIComponent(id)}` }),
      transformResponse: (response) => adaptTruck(unwrapApiResponseData(response)),
      providesTags: (_data, _error, id) => [{ type: 'AdminFleet', id }],
    }),
    getAdminFleetPendingInspections: builder.query({
      query: () => ({ url: '/admin/trucks/pending' }),
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        return (Array.isArray(data.trucks) ? data.trucks : []).map(adaptTruck).filter((row) => row.id);
      },
      providesTags: [{ type: 'AdminFleet', id: 'INSPECTIONS' }],
    }),
    reviewAdminFleetTruck: builder.mutation({
      query: ({ id, kind, decision, reason }) => {
        if (!id || !['registration', 'inspection'].includes(kind) || !['approve', 'reject'].includes(decision)) throw new Error('Invalid truck review request.');
        return {
          url: `${kind === 'registration' ? registrationPath : '/admin/trucks'}/${encodeURIComponent(id)}/${decision}`,
          method: 'POST',
          ...(decision === 'reject' ? { body: reason?.trim() ? { reason: reason.trim() } : {} } : {}),
        };
      },
      transformResponse: (response) => {
        const data = unwrapApiResponseData(response) || {};
        return { message: text(data.message), truck: data.truck ? adaptTruck(data.truck) : null };
      },
      invalidatesTags: (_result, error, { id }) => error ? [] : [
        { type: 'AdminFleet', id }, { type: 'AdminFleet', id: 'LIST' }, { type: 'AdminFleet', id: 'INSPECTIONS' }, { type: 'AdminFleet', id: 'OVERVIEW' }, 'AdminTrips',
      ],
    }),
  }),
});

export const { useGetAdminFleetTrucksQuery, useGetAdminFleetTruckQuery, useGetAdminFleetPendingInspectionsQuery, useReviewAdminFleetTruckMutation } = fleetApi;
