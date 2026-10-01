import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const SEGMENT_LABELS = {
  assigned: 'Assigned', atPickup: 'At Pickup', inTransit: 'In Transit',
  atDelivery: 'At Delivery', returningContainer: 'Returning Container',
  completed: 'Delivered', disputed: 'Disputed',
};
const ARRIVAL_STATUSES = new Set(['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT']);

function numberOr(value, fallback) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const routePoints = splitRoute(route);
  const statusCode = typeof trip.status === 'string' ? trip.status : '';
  const segment = trip.segment || null;
  const segmentLabel = trip.segmentLabel || SEGMENT_LABELS[segment] || formatStatus(statusCode);
  const driver = record(trip.driver);
  const truckingCompany = record(trip.truckingCompany);
  const currentLocation = record(trip.currentLocation);
  const distance = record(trip.distance);
  const currentSegment = record(trip.currentSegment);
  const dates = record(trip.dates);
  const truck = record(trip.truck);
  const truckLatitude = numberOr(truck.lastLatitude, null);
  const truckLongitude = numberOr(truck.lastLongitude, null);
  const latitude = truckLatitude ?? numberOr(currentLocation.latitude, null);
  const longitude = truckLongitude ?? numberOr(currentLocation.longitude, null);
  const status = trip.isDelayed ? 'Delayed' : segment === 'completed' ? 'Delivered' : segmentLabel;
  return {
    id: String(trip.tripId),
    jobId: trip.jobId == null ? null : String(trip.jobId),
    jobNumber: trip.jobNumber || (trip.jobId == null ? '—' : String(trip.jobId)),
    containerNumber: trip.containerNumber || null,
    route: route || '—',
    origin: trip.origin || routePoints.origin,
    destination: trip.destination || routePoints.destination,
    originPort: trip.originPort || null,
    destinationPort: trip.destinationPort || null,
    tripType: record(trip.tripType).label || null,
    tripTypeCode: record(trip.tripType).code || null,
    driverId: driver.id == null ? null : String(driver.id),
    driverName: driver.name || trip.driverName || null,
    driverPhone: driver.phone || null,
    driverEmail: driver.email || null,
    driverAvatarUrl: driver.avatarUrl || null,
    truckerId: truckingCompany.id == null ? null : String(truckingCompany.id),
    truckingCompanyName: truckingCompany.name || null,
    truckingCompanyPhone: truckingCompany.phone || null,
    truckingCompanyEmail: truckingCompany.email || null,
    statusCode,
    status,
    statusLabel: trip.statusLabel || null,
    segment,
    segmentLabel,
    currentSegment: currentSegment.index != null && currentSegment.total != null
      ? { index: currentSegment.index, total: currentSegment.total, label: currentSegment.label || segmentLabel }
      : null,
    progressPercent: numberOr(trip.progressPercent, null),
    isDelayed: trip.isDelayed === true,
    delayReason: trip.delayReason || null,
    hasGpsPosition: (truckLatitude != null && truckLongitude != null) || currentLocation.source === 'GPS',
    canMarkAtDelivery: ARRIVAL_STATUSES.has(statusCode),
    canMarkDelayed: !['COMPLETED', 'CANCELLED'].includes(statusCode),
    truck: {
      id: truck.id == null ? null : String(truck.id),
      plateNumber: truck.plateNumber || null,
      latitude,
      longitude,
      lastLocationUpdate: truck.lastLocationUpdate || currentLocation.updatedAt || null,
      displayLastLocationUpdate: formatDateTime(truck.lastLocationUpdate || currentLocation.updatedAt),
    },
    currentLocation: {
      description: currentLocation.description || null,
      latitude,
      longitude,
      updatedAt: currentLocation.updatedAt || truck.lastLocationUpdate || null,
      source: currentLocation.source || null,
    },
    distance: {
      totalKm: numberOr(distance.totalKm, null),
      remainingKm: numberOr(distance.remainingKm, null),
      source: distance.source || null,
    },
    eta: trip.eta || null,
    displayEta: formatDateTime(trip.eta),
    dates: {
      createdAt: dates.createdAt || null,
      assignedAt: dates.assignedAt || null,
      pickedUpAt: dates.pickedUpAt || null,
      deliveredAt: dates.deliveredAt || null,
      completedAt: dates.completedAt || null,
      updatedAt: dates.updatedAt || null,
    },
    financials: record(trip.financials),
    container: record(trip.container),
    cargoDescription: trip.cargoDescription || null,
    containerReturnAddress: trip.containerReturnAddress || null,
    tdoDate: trip.tdoDate || null,
    segments: Array.isArray(trip.segments) ? trip.segments.map((item) => ({
      key: item.key || '', label: item.label || 'Segment', index: item.index, state: item.state || 'PENDING',
    })) : [],
    milestones: Array.isArray(trip.milestones) ? trip.milestones.map((item) => ({
      key: item.key || '', label: item.label || 'Milestone', at: item.at || null, completed: item.completed === true,
    })) : [],
    issues: Array.isArray(trip.issues) ? trip.issues.map((item) => ({
      id: String(item.id), type: item.type || null, status: item.status || null,
      description: item.description || null, photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls : [],
      reportedBy: record(item.reportedBy), createdAt: item.createdAt || null, resolvedAt: item.resolvedAt || null,
    })) : [],
    otherTripsOnJob: Array.isArray(trip.otherTripsOnJob) ? trip.otherTripsOnJob.map((item) => ({
      id: item.tripId == null ? null : String(item.tripId), containerNumber: item.containerNumber || null,
    })) : [],
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

function mapStats(response) {
  const data = unwrapApiResponseData(response);
  if (!data?.cards) throw new Error('The trips stats response is missing its cards.');
  const cards = record(data.cards);
  return {
    period: record(data.period),
    cards: Object.fromEntries(['allTrips', 'inTransit', 'atPickup', 'atDelivery', 'returningContainer', 'delayed']
      .map((key) => [key, {
        value: numberOr(cards[key]?.value, null),
        changePercent: numberOr(cards[key]?.changePercent, null),
        trend: cards[key]?.trend || null,
        sparkline: Array.isArray(cards[key]?.sparkline) ? cards[key].sparkline.map((point) => numberOr(point, 0)) : [],
      }])),
  };
}

function tripFilters({ statusFilter, search, origin, destination, driverId, truckerId, tripType, dateFrom, dateTo } = {}) {
  return Object.fromEntries(Object.entries({ statusFilter, search, origin, destination, driverId, truckerId, tripType, dateFrom, dateTo })
    .filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export const tripsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminTripStats: builder.query({
      query: ({ dateFrom, dateTo } = {}) => ({ url: '/admin/trips/stats', params: tripFilters({ dateFrom, dateTo }) }),
      transformResponse: mapStats,
      providesTags: ['AdminTrips'],
    }),
    getAdminTrips: builder.query({
      query: ({ page = 1, limit = 10, ...filters } = {}) => ({
        url: '/admin/trips',
        params: { ...tripFilters(filters), page, limit },
      }),
      transformResponse: (response, _meta, args) => mapResponse(response, args),
      providesTags: ['AdminTrips'],
    }),
    getAdminTripDetail: builder.query({
      query: (id) => ({ url: `/admin/trips/${encodeURIComponent(id)}` }),
      transformResponse: (response) => mapTrip(unwrapApiResponseData(response)),
      providesTags: ['AdminTrips'],
    }),
    exportAdminTrips: builder.query({
      query: (filters = {}) => ({
        url: '/admin/trips/export', params: tripFilters(filters),
        responseHandler: 'text', headers: { Accept: 'text/csv' },
      }),
      transformResponse: (response) => {
        if (typeof response !== 'string') throw new Error('The trips export response is not CSV text.');
        return response;
      },
    }),
    markAdminTripDelayed: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/admin/trips/${encodeURIComponent(id)}/mark-delayed`, method: 'POST',
        body: { reason: reason.trim() },
      }),
      invalidatesTags: ['AdminTrips', 'AdminJobs'],
    }),
    clearAdminTripDelayed: builder.mutation({
      query: (id) => ({ url: `/admin/trips/${encodeURIComponent(id)}/clear-delayed`, method: 'POST' }),
      invalidatesTags: ['AdminTrips', 'AdminJobs'],
    }),
    markAdminTripAtDelivery: builder.mutation({
      query: (id) => ({ url: `/admin/trips/${encodeURIComponent(id)}/mark-at-delivery`, method: 'POST' }),
      invalidatesTags: ['AdminTrips', 'AdminJobs'],
    }),
    messageAdminTripDriver: builder.mutation({
      query: ({ id, message }) => ({
        url: `/admin/trips/${encodeURIComponent(id)}/message-driver`, method: 'POST',
        body: { message: message.trim() },
      }),
    }),
  }),
});

export const {
  useGetAdminTripStatsQuery,
  useGetAdminTripsQuery,
  useLazyGetAdminTripsQuery,
  useGetAdminTripDetailQuery,
  useLazyExportAdminTripsQuery,
  useMarkAdminTripDelayedMutation,
  useClearAdminTripDelayedMutation,
  useMarkAdminTripAtDeliveryMutation,
  useMessageAdminTripDriverMutation,
} = tripsApi;
