import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
const number = (...values) => {
  const value = values.find((item) => item !== null && item !== undefined && item !== '');
  const result = Number(value);
  return value === undefined || !Number.isFinite(result) ? null : result;
};

function location(value) {
  const place = record(value);
  const lat = number(place.lat, place.latitude, place.lastLatitude);
  const lng = number(place.lng, place.longitude, place.lastLongitude);
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng } : null;
}

function route(value, pickup, delivery) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const routeValue = record(value);
  const from = text(routeValue.pickup, routeValue.origin, routeValue.from, pickup);
  const to = text(routeValue.delivery, routeValue.destination, routeValue.to, delivery);
  return from && to ? `${from} → ${to}` : from || to || null;
}

function mapOpportunity(value, index) {
  const item = record(value);
  const current = record(item.finishingJob || item.currentJob || item.currentSegment || item.completingJob || item.activeJob);
  const proposed = record(item.openJob || item.matchedJob || item.proposedJob || item.proposedSegment || item.nextJob || item.job);
  const truck = record(item.truck || current.truck);
  const trucker = record(item.trucker || item.truckingCompany || truck.trucker);
  const currentPickup = text(current.pickupLocation, current.pickup, current.origin);
  const currentDelivery = text(current.deliveryLocation, current.delivery, current.destination);
  const proposedPickup = text(proposed.pickupLocation, proposed.pickup, proposed.origin);
  const proposedDelivery = text(proposed.deliveryLocation, proposed.delivery, proposed.destination);
  const currentJobId = text(current.id, current.jobId, item.currentJobId, item.tripJobId);
  const jobId = text(proposed.id, proposed.jobId, item.jobId, item.matchedJobId, item.openJobId);
  const truckerId = text(current.truckerId, trucker.id, trucker.userId, item.truckerId, item.truckingCompanyId);
  const serverId = text(item.id, item.opportunityId, item.matchId);
  const id = serverId || [currentJobId, jobId, truckerId].filter(Boolean).join(':') || `opportunity-${index}`;
  const position = location(current.deliveryPosition) || location(current.deliveryCoordinates) || location(current.delivery)
    || location(current.destinationPosition) || location(current.destinationCoordinates)
    || location(item.truckPosition) || location(truck.position) || location(truck.location)
    || location({ latitude: truck.lastLatitude, longitude: truck.lastLongitude });
  const pickupPosition = location(proposed.pickupPosition) || location(proposed.pickupCoordinates) || location(proposed.pickup)
    || location(proposed.originPosition) || location(proposed.originCoordinates)
    || location(item.pickupPosition) || location(item.pickupCoordinates);
  const deliveryPosition = location(proposed.deliveryPosition) || location(proposed.deliveryCoordinates) || location(proposed.delivery)
    || location(item.deliveryPosition) || location(item.deliveryCoordinates);
  const score = number(item.matchScore, item.score);
  const revenue = number(item.estimatedRevenue, item.estRevenue, proposed.estimatedRevenue, proposed.estRevenue);
  const routeValue = route(current.route, currentPickup, currentDelivery);
  const proposedRoute = route(proposed.route, proposedPickup, proposedDelivery);
  return {
    id,
    serverId,
    currentJobId,
    jobId,
    truckerId,
    truckPlate: text(current.plateNumber, truck.plateNumber, truck.plate, item.truckPlate, item.plateNumber),
    truckType: text(truck.type, truck.truckType, item.truckType),
    company: text(current.truckerName, trucker.companyName, trucker.name, item.truckerName, item.truckingCompanyName),
    currentRoute: text(current.currentRoute) || routeValue,
    proposedRoute,
    currentEta: text(current.eta, current.estimatedArrival, item.currentEta),
    currentStatus: text(current.statusLabel, current.status),
    currentLocation: text(current.currentLocation, truck.currentLocation, item.currentLocation),
    currentCargo: text(current.cargo, current.cargoType),
    proposedCargo: text(proposed.cargo, proposed.cargoType),
    container: text(proposed.containerType, proposed.container, current.containerType, item.containerType),
    containerNumber: text(current.containerNumber, proposed.containerNumber, item.containerNumber)
      || (Array.isArray(proposed.containerNumbers) ? proposed.containerNumbers.filter(Boolean).join(', ') : null),
    forwarder: text(proposed.forwarderName, record(proposed.forwarder).name, item.forwarderName),
    currentJobNumber: text(current.jobNumber),
    jobNumber: text(proposed.jobNumber),
    truckId: text(current.truckId, truck.id),
    forwarderId: text(proposed.forwarderId),
    pickupLocation: proposedPickup,
    deliveryLocation: proposedDelivery,
    pickupWindow: text(proposed.pickupWindow, item.pickupWindow),
    status: text(item.statusLabel, item.status),
    score,
    revenue,
    currency: text(item.currency, proposed.currency) || 'NGN',
    emptyKmAvoided: number(item.emptyKmAvoided, item.emptyDistanceKm),
    distanceKm: number(item.distanceKm, proposed.distanceKm),
    identifiedAt: text(item.identifiedAt, item.createdAt),
    position,
    pickupPosition,
    deliveryPosition,
  };
}

function mapOpportunities(response, args = {}) {
  const data = unwrapApiResponseData(response);
  const source = Array.isArray(data) ? data : data?.opportunities ?? data?.matches;
  if (!Array.isArray(source)) throw new Error('The triangulation response is missing its opportunities list.');
  const rows = source.map(mapOpportunity);
  const pagination = record(data?.pagination);
  const total = number(pagination.total, data?.total) ?? rows.length;
  const limit = (number(pagination.limit) ?? args.limit ?? rows.length) || 20;
  return {
    rows,
    pagination: {
      page: number(pagination.page) ?? args.page ?? 1,
      limit,
      total,
      totalPages: number(pagination.totalPages) ?? Math.max(1, Math.ceil(total / limit)),
    },
    summary: record(data?.summary || data?.stats),
  };
}

export const triangulationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminTriangulationOpportunities: builder.query({
      query: ({ page = 1, limit = 20, radiusKm = 150 } = {}) => ({
        url: '/admin/triangulation/opportunities',
        params: { radiusKm, page, limit },
      }),
      transformResponse: (response, _meta, args) => mapOpportunities(response, args),
      providesTags: ['AdminTriangulation'],
    }),
    notifyAdminTriangulationMatch: builder.mutation({
      query: ({ jobId, truckerId }) => ({
        url: '/admin/triangulation/notify',
        method: 'POST',
        body: { jobId, truckerId },
      }),
      invalidatesTags: ['AdminTriangulation'],
    }),
    interveneAdminTriangulationJob: builder.mutation({
      query: ({ jobId, type, notes }) => ({
        url: `/admin/jobs/${encodeURIComponent(jobId)}/intervene`,
        method: 'POST',
        body: { type, notes },
      }),
      invalidatesTags: ['AdminTriangulation', 'AdminJobs'],
    }),
  }),
});

export const {
  useGetAdminTriangulationOpportunitiesQuery,
  useNotifyAdminTriangulationMatchMutation,
  useInterveneAdminTriangulationJobMutation,
} = triangulationApi;
