import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const identifier = (value) => text(value) || (Number.isSafeInteger(value) && value >= 0 ? String(value) : null);
const SEGMENT_LABELS = {
  assigned: 'Assigned', atPickup: 'At Pickup', inTransit: 'In Transit',
  atDelivery: 'At Delivery', returningContainer: 'Returning Container',
  completed: 'Delivered', disputed: 'Disputed',
};
const ARRIVAL_STATUSES = new Set(['DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT']);

function numberOr(value, fallback) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function count(value) {
  const parsed = numberOr(value, null);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function nonNegative(value) {
  const parsed = numberOr(value, null);
  return parsed != null && parsed >= 0 ? parsed : null;
}

function gpsPosition(latitude, longitude) {
  const lat = numberOr(latitude, null), lng = numberOr(longitude, null);
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { latitude: lat, longitude: lng } : null;
}

function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
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
  const valid = timestamp(value);
  if (!valid) return null;
  const date = new Date(valid);
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapTrackingTrip(trip) {
  const position = trip.hasGpsPosition ? { lat: trip.truck.latitude, lng: trip.truck.longitude } : null;
  const colors = {
    Assigned: '#0241e8', 'In Transit': '#0241e8', 'At Pickup': '#f27602', 'At Delivery': '#0e7c86',
    Delivered: '#12833b', Delayed: '#cb0611', Stopped: '#8a90a8', Maintenance: '#4c16ac',
  };
  return {
    id: trip.id,
    jobId: trip.jobId,
    segment: trip.segment,
    from: trip.origin || '—',
    to: trip.destination || '—',
    status: trip.status,
    statusColor: colors[trip.status] || '#0241e8',
    speed: null,
    driver: trip.driverName || '—',
    driverPhone: trip.driverPhone || '—',
    driverId: trip.driverId,
    truck: trip.truck.plateNumber || '—',
    truckPhone: '—',
    company: trip.truckingCompanyName || '—',
    companyPhone: trip.truckingCompanyPhone || '—',
    container: text(trip.container.size) || trip.containerNumber || '—',
    cargo: trip.cargoDescription || '—',
    location: trip.currentLocation.description
      ? `${trip.currentLocation.description}${trip.currentLocation.source === 'TRIP_STATUS' ? ' (status based)' : ''}`
      : position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : '—',
    // Recorded route mileage and straight-line distance remaining do not measure distance travelled.
    distanceCovered: '—',
    totalDistance: trip.distance.totalKm == null ? '—' : `${trip.distance.totalKm} km`,
    eta: trip.displayEta || '—',
    nextStop: (['assigned', 'atPickup'].includes(trip.segment) ? trip.origin
      : trip.segment === 'returningContainer' ? trip.containerReturnAddress
        : ['inTransit', 'atDelivery'].includes(trip.segment) ? trip.destination : null) || '—',
    lastUpdate: trip.truck.displayLastLocationUpdate || '—',
    engine: '—',
    progress: trip.progressPercent,
    stops: trip.milestones.map((milestone) => ({
      time: milestone.at ? new Date(milestone.at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '—',
      label: milestone.label,
      state: milestone.completed === true ? 'done' : milestone.completed === false ? 'pending' : null,
    })),
    position,
  };
}

function mapTrip(trip) {
  if (!trip || !identifier(trip.tripId)) throw new Error('The trip response is missing a valid trip ID.');
  const route = text(trip.route);
  const routePoints = splitRoute(route);
  const statusCode = text(trip.status) || '';
  const segment = text(trip.segment);
  const segmentLabel = text(trip.segmentLabel) || SEGMENT_LABELS[segment] || formatStatus(statusCode);
  const driver = record(trip.driver);
  const truckingCompany = record(trip.truckingCompany);
  const currentLocation = record(trip.currentLocation);
  const distance = record(trip.distance);
  const currentSegment = record(trip.currentSegment);
  const dates = record(trip.dates);
  const truck = record(trip.truck);
  const truckGps = gpsPosition(truck.lastLatitude, truck.lastLongitude);
  const gps = truckGps
    || (currentLocation.source === 'GPS' ? gpsPosition(currentLocation.latitude, currentLocation.longitude) : null);
  const gpsUpdatedAt = gps ? timestamp(truckGps ? truck.lastLocationUpdate : currentLocation.updatedAt) : null;
  const latitude = gps?.latitude ?? null, longitude = gps?.longitude ?? null;
  const isDelayed = typeof trip.isDelayed === 'boolean' ? trip.isDelayed : null;
  const status = isDelayed === true ? 'Delayed' : isDelayed === false ? segment === 'completed' ? 'Delivered' : segmentLabel : '—';
  const segmentIndex = count(currentSegment.index), segmentTotal = count(currentSegment.total);
  const progress = nonNegative(trip.progressPercent);
  const financials = record(trip.financials);
  const mapped = {
    id: identifier(trip.tripId),
    jobId: identifier(trip.jobId),
    jobNumber: text(trip.jobNumber) || identifier(trip.jobId) || '—',
    containerNumber: text(trip.containerNumber),
    route: route || '—',
    origin: text(trip.origin) || routePoints.origin,
    destination: text(trip.destination) || routePoints.destination,
    originPort: text(trip.originPort),
    destinationPort: text(trip.destinationPort),
    tripType: text(record(trip.tripType).label),
    tripTypeCode: text(record(trip.tripType).code),
    driverId: identifier(driver.id),
    driverName: text(driver.name) || text(trip.driverName),
    driverPhone: text(driver.phone),
    driverEmail: text(driver.email),
    driverAvatarUrl: text(driver.avatarUrl),
    truckerId: identifier(truckingCompany.id),
    truckingCompanyName: text(truckingCompany.name),
    truckingCompanyPhone: text(truckingCompany.phone),
    truckingCompanyEmail: text(truckingCompany.email),
    statusCode,
    status,
    statusLabel: text(trip.statusLabel),
    segment,
    segmentLabel,
    currentSegment: segmentIndex > 0 && segmentTotal >= segmentIndex
      ? { index: segmentIndex, total: segmentTotal, label: text(currentSegment.label) || segmentLabel }
      : null,
    progressPercent: progress != null && progress <= 100 ? progress : null,
    isDelayed,
    delayReason: text(trip.delayReason),
    hasGpsPosition: Boolean(gps),
    canMarkAtDelivery: ARRIVAL_STATUSES.has(statusCode),
    canMarkDelayed: Boolean(statusCode) && isDelayed != null && !['COMPLETED', 'CANCELLED'].includes(statusCode),
    truck: {
      id: identifier(truck.id),
      plateNumber: text(truck.plateNumber),
      latitude,
      longitude,
      lastLocationUpdate: gpsUpdatedAt,
      displayLastLocationUpdate: formatDateTime(gpsUpdatedAt),
    },
    currentLocation: {
      description: text(currentLocation.description),
      latitude,
      longitude,
      updatedAt: timestamp(currentLocation.updatedAt) || timestamp(truck.lastLocationUpdate),
      source: text(currentLocation.source),
    },
    distance: {
      totalKm: nonNegative(distance.totalKm),
      remainingKm: nonNegative(distance.remainingKm),
      source: text(distance.source),
    },
    eta: timestamp(trip.eta),
    displayEta: formatDateTime(trip.eta),
    dates: {
      createdAt: timestamp(dates.createdAt),
      assignedAt: timestamp(dates.assignedAt),
      pickedUpAt: timestamp(dates.pickedUpAt),
      deliveredAt: timestamp(dates.deliveredAt),
      completedAt: timestamp(dates.completedAt),
      updatedAt: timestamp(dates.updatedAt),
    },
    financials: { ...financials, tripValue: nonNegative(financials.tripValue) },
    container: record(trip.container),
    cargoDescription: text(trip.cargoDescription),
    containerReturnAddress: text(trip.containerReturnAddress),
    tdoDate: timestamp(trip.tdoDate),
    segments: Array.isArray(trip.segments) ? trip.segments.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({
      key: text(item.key), label: text(item.label) || '—', index: count(item.index), state: text(item.state),
    })) : [],
    milestones: Array.isArray(trip.milestones) ? trip.milestones.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({
      key: text(item.key), label: text(item.label) || '—', at: timestamp(item.at), completed: typeof item.completed === 'boolean' ? item.completed : null,
    })) : [],
    issues: Array.isArray(trip.issues) ? trip.issues.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({
      id: identifier(item.id), type: text(item.type) || '—', status: text(item.status),
      description: text(item.description), photoUrls: Array.isArray(item.photoUrls) ? item.photoUrls.filter((url) => text(url)) : [],
      reportedBy: record(item.reportedBy), createdAt: timestamp(item.createdAt), resolvedAt: timestamp(item.resolvedAt),
    })) : [],
    otherTripsOnJob: Array.isArray(trip.otherTripsOnJob) ? trip.otherTripsOnJob.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({
      id: identifier(item.tripId) || '—', containerNumber: text(item.containerNumber),
    })) : [],
  };
  return { ...mapped, tracking: mapTrackingTrip(mapped) };
}

function mapResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.trips)) {
    throw new Error('The trips response is missing its trip list.');
  }

  const rows = data.trips.map(mapTrip);
  const pagination = record(data.pagination);
  const limit = count(pagination.limit) > 0 ? count(pagination.limit) : args.limit || 10;
  const total = count(pagination.total);

  return {
    rows,
    pagination: {
      page: count(pagination.page) > 0 ? count(pagination.page) : args.page || 1,
      limit,
      total,
      totalPages: count(pagination.totalPages) ?? (total != null ? Math.ceil(total / limit) : null),
    },
  };
}

function mapStats(response) {
  const data = unwrapApiResponseData(response);
  if (!data?.cards || typeof data.cards !== 'object' || Array.isArray(data.cards)) throw new Error('The trips stats response is missing its cards.');
  const cards = record(data.cards);
  return {
    period: record(data.period),
    cards: Object.fromEntries(['allTrips', 'inTransit', 'atPickup', 'atDelivery', 'returningContainer', 'delayed']
      .map((key) => [key, {
        value: count(cards[key]?.value),
        changePercent: numberOr(cards[key]?.changePercent, null),
        trend: text(cards[key]?.trend),
        sparkline: Array.isArray(cards[key]?.sparkline) ? cards[key].sparkline.map(count) : [],
      }])),
  };
}

function tripFilters({ statusFilter, search, origin, destination, driverId, truckerId, tripType, dateFrom, dateTo } = {}) {
  return Object.fromEntries(Object.entries({ statusFilter, search, origin, destination, driverId, truckerId, tripType, dateFrom, dateTo })
    .filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

export const tripsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
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
    getAdminTrackingTrips: builder.query({
      async queryFn({ page = 1, limit = 100, ...filters } = {}, api, _options, baseQuery) {
        const rows = new Map();
        let pagination;
        // Refresh every loaded page together; polling only the last page leaves earlier markers stale.
        for (let nextPage = 1; nextPage <= page; nextPage += 1) {
          if (api.signal.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Tracking request cancelled.' } };
          const response = await baseQuery({ url: '/admin/trips', params: { ...tripFilters(filters), page: nextPage, limit } });
          if (response.error) return { error: response.error };
          try {
            const mapped = mapResponse(response.data, { page: nextPage, limit });
            mapped.rows.forEach((trip) => rows.set(trip.id, trip.tracking));
            pagination = mapped.pagination;
          } catch {
            return { error: { status: 'CUSTOM_ERROR', error: 'The tracking trips response is invalid.' } };
          }
          if (pagination.totalPages == null || nextPage >= pagination.totalPages) break;
        }
        return { data: { rows: [...rows.values()], pagination } };
      },
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
  useGetAdminTrackingTripsQuery,
  useLazyGetAdminTripsQuery,
  useGetAdminTripDetailQuery,
  useLazyExportAdminTripsQuery,
  useMarkAdminTripDelayedMutation,
  useClearAdminTripDelayedMutation,
  useMarkAdminTripAtDeliveryMutation,
  useMessageAdminTripDriverMutation,
} = tripsApi;
