import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function formatStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const normalized = value.replace(/([a-z])([A-Z])/g, '$1_$2');
  return normalized
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitRoute(value) {
  if (typeof value !== 'string') return { origin: null, destination: null };
  const parts = value.split(/\s*(?:→|->)\s*/);
  return {
    origin: parts[0]?.trim() || null,
    destination: parts.length > 1 ? parts.slice(1).join(' → ').trim() || null : null,
  };
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapTrip(trip) {
  const route = typeof trip.route === 'string' ? trip.route : '';
  const { origin, destination } = splitRoute(route);
  const statusCode = typeof trip.status === 'string' ? trip.status : '';
  return {
    id: String(trip.tripId),
    jobId: trip.jobId == null ? null : String(trip.jobId),
    jobNumber: trip.jobNumber || (trip.jobId == null ? '—' : String(trip.jobId)),
    containerNumber: trip.containerNumber || null,
    route: route || '—',
    origin,
    destination,
    driverName: trip.driverName || null,
    statusCode,
    status: formatStatus(statusCode),
    statusLabel: trip.statusLabel || null,
    truck: trip.truck && typeof trip.truck === 'object' ? {
      plateNumber: trip.truck.plateNumber || null,
      latitude: numberOr(trip.truck.lastLatitude, null),
      longitude: numberOr(trip.truck.lastLongitude, null),
      lastLocationUpdate: trip.truck.lastLocationUpdate || null,
      displayLastLocationUpdate: formatDateTime(trip.truck.lastLocationUpdate),
    } : null,
    eta: trip.eta || null,
    displayEta: formatDateTime(trip.eta),
  };
}

function mapResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.trips)) {
    throw new Error('The trips response is missing its trip list.');
  }

  const rows = data.trips
    .filter((trip) => trip && trip.tripId != null)
    .map(mapTrip);
  const pagination = data.pagination || {};
  const limit = numberOr(pagination.limit, args.limit || rows.length || 20);
  const total = numberOr(pagination.total, rows.length);

  return {
    rows,
    pagination: {
      page: numberOr(pagination.page, args.page || 1),
      limit,
      total,
      totalPages: numberOr(pagination.totalPages, limit > 0 ? Math.ceil(total / limit) : 1),
    },
  };
}

export const tripsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminTrips: builder.query({
      query: ({ page = 1, limit = 10, statusFilter, search } = {}) => ({
        url: '/admin/trips',
        params: {
          page,
          limit,
          ...(statusFilter ? { statusFilter } : {}),
          ...(search ? { search } : {}),
        },
      }),
      transformResponse: (response, _meta, args) => mapResponse(response, args),
      providesTags: ['AdminTrips'],
    }),
  }),
});

export const { useGetAdminTripsQuery } = tripsApi;
