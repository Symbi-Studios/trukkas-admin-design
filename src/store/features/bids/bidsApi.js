import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOr(value, fallback) {
  const parsed = numberOrNull(value);
  return parsed == null ? fallback : parsed;
}

function formatStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapBid(bid) {
  const trucker = bid.trucker && typeof bid.trucker === 'object' ? bid.trucker : null;
  const job = bid.job && typeof bid.job === 'object' ? bid.job : null;
  const statusCode = typeof bid.status === 'string' ? bid.status : '';
  return {
    id: String(bid.id),
    jobId: bid.jobId == null ? (job?.id == null ? null : String(job.id)) : String(bid.jobId),
    jobNumber: bid.jobNumber || job?.jobNumber || null,
    route: bid.route || job?.route || null,
    truckerId: bid.truckerId == null ? (trucker?.id == null ? null : String(trucker.id)) : String(bid.truckerId),
    truckerName: bid.truckerName || trucker?.name || '—',
    truckerRating: numberOrNull(bid.truckerRating ?? trucker?.rating),
    truckerTrips: numberOrNull(bid.truckerTrips ?? trucker?.trips),
    amount: numberOrNull(bid.amount),
    currency: bid.currency || null,
    isCounterOffer: bid.isCounterOffer === true,
    statusCode,
    status: bid.statusLabel || formatStatus(statusCode),
    createdAt: bid.createdAt || null,
    expiresAt: bid.expiresAt || null,
    respondedAt: bid.respondedAt || null,
    originalAmount: numberOrNull(bid.originalAmount),
    counterOfferAmount: numberOrNull(bid.counterOfferAmount),
    estimatedDeliveryDate: bid.estimatedDeliveryDate || bid.deliveryDate || null,
    message: bid.message || bid.notes || null,
  };
}

function mapListResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.bids)) {
    throw new Error('The bids response is missing its bid list.');
  }
  const rows = data.bids.filter((bid) => bid && bid.id != null).map(mapBid);
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

function mapAnalyticsResponse(response) {
  const data = unwrapApiResponseData(response);
  const analytics = data?.analytics && typeof data.analytics === 'object' ? data.analytics : data;
  if (!analytics || typeof analytics !== 'object' || Array.isArray(analytics)) {
    throw new Error('The bid analytics response is invalid.');
  }
  const funnel = analytics.funnel || {};
  return {
    totalBids: numberOr(analytics.totalBids, 0),
    pendingBids: numberOr(analytics.pendingBids, 0),
    counterOffers: numberOr(analytics.counterOffers, 0),
    acceptedBids: numberOr(analytics.acceptedBids, 0),
    expiredBids: numberOr(analytics.expiredBids, 0),
    funnel: {
      jobsPublished: numberOr(funnel.jobsPublished, 0),
      jobsWithBids: numberOr(funnel.jobsWithBids, 0),
      bidsReceived: numberOr(funnel.bidsReceived, 0),
      bidsAccepted: numberOr(funnel.bidsAccepted, 0),
      jobsCompleted: numberOr(funnel.jobsCompleted, 0),
    },
    topCompanies: Array.isArray(analytics.topCompanies)
      ? analytics.topCompanies.map((company, index) => ({
          id: company.truckerId == null ? `company-${index}` : String(company.truckerId),
          name: company.name || '—',
          totalBids: numberOr(company.totalBids, 0),
          won: numberOr(company.won, 0),
          winRate: numberOr(company.winRate, 0),
        }))
      : [],
  };
}

function mapDetailResponse(response) {
  const data = unwrapApiResponseData(response);
  const bid = data?.bid && typeof data.bid === 'object' ? data.bid : data;
  if (!bid || typeof bid !== 'object' || Array.isArray(bid) || bid.id == null) {
    throw new Error('The bid detail response is missing its bid ID.');
  }
  return mapBid(bid);
}

export const bidsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminBids: builder.query({
      query: ({ status, jobId, search, dateFrom, dateTo, page = 1, limit = 20 } = {}) => ({
        url: '/admin/bids',
        params: {
          ...(status ? { status } : {}),
          ...(jobId ? { jobId } : {}),
          ...(search ? { search } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          page,
          limit,
        },
      }),
      transformResponse: (response, _meta, args) => mapListResponse(response, args),
      providesTags: (result) => [
        'AdminBids',
        ...(result?.rows || []).map((bid) => ({ type: 'AdminBids', id: bid.id })),
      ],
    }),
    getAdminBidAnalytics: builder.query({
      query: () => ({ url: '/admin/bids/analytics' }),
      transformResponse: mapAnalyticsResponse,
      providesTags: ['AdminBidAnalytics'],
    }),
    getAdminBidDetail: builder.query({
      query: (id) => ({ url: `/admin/bids/${encodeURIComponent(id)}` }),
      transformResponse: mapDetailResponse,
      providesTags: (_result, _error, id) => [{ type: 'AdminBids', id }],
    }),
  }),
});

export const {
  useGetAdminBidsQuery,
  useGetAdminBidAnalyticsQuery,
  useGetAdminBidDetailQuery,
} = bidsApi;
