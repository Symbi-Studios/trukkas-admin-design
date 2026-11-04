import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (...values) => values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
const number = (...values) => {
  const value = values.find((item) => item !== null && item !== undefined && item !== '');
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
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

function mapOpportunity(value) {
  const item = record(value);
  const current = record(item.finishingJob || item.currentJob || item.currentSegment || item.completingJob || item.activeJob);
  const proposed = record(item.openJob || item.matchedJob || item.proposedJob || item.proposedSegment || item.nextJob || item.job);
  const truck = record(item.truck || current.truck);
  const trucker = record(item.trucker || item.truckingCompany || truck.trucker);
  const currentPickup = text(current.pickupLocation, current.pickup, current.origin);
  const currentDelivery = text(current.deliveryLocation, current.delivery, current.destination);
  const proposedPickup = text(record(proposed.pickup).address, proposed.pickupLocation, proposed.pickup, proposed.origin);
  const proposedDelivery = text(record(proposed.delivery).address, proposed.deliveryLocation, proposed.delivery, proposed.destination);
  const currentJobId = text(current.id, current.jobId, item.currentJobId, item.tripJobId);
  const jobId = text(proposed.id, proposed.jobId, item.jobId, item.matchedJobId, item.openJobId);
  const truckerId = text(current.truckerId, trucker.id, trucker.userId, item.truckerId, item.truckingCompanyId);
  const serverId = text(item.id, item.opportunityId, item.matchId);
  const id = serverId;
  const position = record(current.endPoint).kind === 'DELIVERY' ? location(current.endPoint) : null;
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
    currentContainerNumber: text(current.containerNumber),
    containerNumber: text(proposed.containerNumber, item.containerNumber)
      || (Array.isArray(proposed.containerNumbers) ? proposed.containerNumbers.filter(Boolean).join(', ') : null),
    forwarder: text(proposed.forwarderName, record(proposed.forwarder).name, item.forwarderName),
    currentJobNumber: text(current.jobNumber),
    jobNumber: text(proposed.jobNumber),
    truckId: text(current.truckId, truck.id),
    forwarderId: text(proposed.forwarderId),
    pickupLocation: proposedPickup,
    deliveryLocation: proposedDelivery,
    pickupWindow: text(proposed.pickupWindow, item.pickupWindow),
    status: text(record(item.review).status, item.statusLabel, item.status),
    reviewVersion: text(record(item.review).version),
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
  const rows = source.map(mapOpportunity).filter((row) => row.id);
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
      query: ({ page = 1, limit = 20, radiusKm = 150, status } = {}) => ({
        url: '/admin/triangulation/opportunities',
        params: { radiusKm, page, limit, ...(status ? { status } : {}) },
      }),
      transformResponse: (response, _meta, args) => mapOpportunities(response, args),
      providesTags: ['AdminTriangulation'],
    }),
    getAdminTriangulationActivity: builder.query({
      query: ({ id }) => ({ url: `/admin/triangulation/opportunities/${encodeURIComponent(id)}/activity` }),
      transformResponse: (response, _meta, args) => {
        const data = record(unwrapApiResponseData(response));
        if (data.opportunityId !== args.id || !Array.isArray(data.activity)) throw new Error('The activity response is unavailable.');
        return data.activity.filter((row) => text(row?.id)).map((row) => ({
          id: text(row.id), title: text(row.title, row.action), note: text(row.note, row.reasonLabel), at: text(row.createdAt), by: text(record(row.by).name),
        }));
      },
      providesTags: ['AdminTriangulation'],
    }),
    getAdminTriangulationOpportunity: builder.query({
      query: ({ id, radiusKm = 150 }) => ({
        url: `/admin/triangulation/opportunities/${encodeURIComponent(id)}`,
        params: { radiusKm },
      }),
      transformResponse: (response, _meta, args) => {
        const data = record(unwrapApiResponseData(response));
        const opportunity = mapOpportunity(data.opportunity);
        if (!opportunity.id || opportunity.id !== args.id) throw new Error('The opportunity response has an invalid ID.');
        const factors = record(data.matchFactors), financial = record(data.financial);
        return { opportunity: { ...opportunity,
          score: number(factors.matchScore, opportunity.score),
          distanceKm: number(factors.distanceKm, opportunity.distanceKm),
          revenue: number(financial.estimatedRevenue, opportunity.revenue),
          platformFee: number(financial.platformFee),
        } };
      },
      providesTags: ['AdminTriangulation'],
    }),
    reviewAdminTriangulationOpportunity: builder.mutation({
      async queryFn({ id, action, radiusKm, expectedVersion, reason, note }, api, _options, baseQuery) {
        const auth = api.getState().auth;
        const current = () => !api.signal.aborted && api.getState().auth.accessToken && api.getState().auth.admin?.id === auth.admin?.id && api.getState().auth.admin?.role === auth.admin?.role;
        const fail = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
        if (!current() || !['SUPER_ADMIN', 'OPS_ADMIN'].includes(auth.admin?.role)) return fail('This action is unavailable for your account.');
        if (!text(id) || !text(expectedVersion) || !['propose', 'reject'].includes(action)) return fail('Refresh the opportunity before continuing.');
        if (action === 'reject' && (!['TRUCK_UNAVAILABLE', 'EQUIPMENT_MISMATCH', 'TIMING_CONFLICT', 'ROUTE_NOT_VIABLE', 'COMPLIANCE_ISSUE', 'CUSTOMER_PREFERENCE', 'OTHER'].includes(reason) || (reason === 'OTHER' && !text(note)))) return fail('Choose a reason and provide a note when required.');
        const response = await baseQuery({ url: `/admin/triangulation/opportunities/${encodeURIComponent(id)}/${action}`, method: 'POST',
          body: { radiusKm, expectedVersion, ...(action === 'reject' ? { reason } : {}), ...(text(note) ? { note: text(note) } : {}) } });
        if (!current()) return fail('The session changed. Refresh before continuing.');
        if (response.error) return { error: response.error };
        const data = unwrapApiResponseData(response.data);
        if (data?.opportunityId !== id || data?.status !== (action === 'reject' ? 'REJECTED' : 'PROPOSED')) return fail('The result could not be confirmed. Refresh before trying again.');
        return { data };
      },
      invalidatesTags: ['AdminTriangulation'],
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
  useGetAdminTriangulationOpportunityQuery,
  useGetAdminTriangulationActivityQuery,
  useReviewAdminTriangulationOpportunityMutation,
  useNotifyAdminTriangulationMatchMutation,
  useInterveneAdminTriangulationJobMutation,
} = triangulationApi;
