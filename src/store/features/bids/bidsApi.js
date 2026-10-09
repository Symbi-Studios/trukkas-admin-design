import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const identifier = (value) => text(value) || (Number.isSafeInteger(value) && value >= 0 ? String(value) : null);

function numberOrNull(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function count(value) {
  const parsed = numberOrNull(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
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
  const trucker = record(bid.trucker);
  const job = record(bid.job);
  const statusCode = text(bid.status) || '';
  return {
    id: identifier(bid.id),
    jobId: identifier(bid.jobId) ?? identifier(job.id),
    jobNumber: text(bid.jobNumber) ?? text(job.jobNumber),
    route: text(bid.route) ?? text(job.route),
    truckerId: identifier(bid.truckerId) ?? identifier(trucker.id),
    truckerName: text(bid.truckerName) ?? text(trucker.name) ?? '—',
    truckerRating: numberOrNull(bid.truckerRating ?? trucker.rating),
    truckerTrips: count(bid.truckerTrips ?? trucker.totalTrips),
    amount: numberOrNull(bid.amount),
    currency: text(bid.currency),
    isCounterOffer: typeof bid.isCounterOffer === 'boolean' ? bid.isCounterOffer : null,
    statusCode,
    status: formatStatus(statusCode),
    createdAt: timestamp(bid.createdAt),
    expiresAt: timestamp(bid.expiresAt),
    respondedAt: timestamp(bid.respondedAt),
    estimatedDeliveryDate: timestamp(bid.estimatedDeliveryDate),
    message: text(bid.message),
  };
}

function mapListResponse(response, args = {}) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.bids)) {
    throw new Error('The bids response is missing its bid list.');
  }
  const rows = data.bids.filter((bid) => identifier(record(bid).id) != null).map(mapBid);
  const pagination = record(data.pagination);
  return {
    rows,
    pagination: {
      page: count(pagination.page) || args.page || 1,
      limit: count(pagination.limit) || args.limit || 20,
      total: count(pagination.total),
      totalPages: count(pagination.totalPages),
    },
  };
}

function mapAnalyticsResponse(response) {
  const data = unwrapApiResponseData(response);
  const analytics = data?.analytics && typeof data.analytics === 'object' ? data.analytics : data;
  if (!analytics || typeof analytics !== 'object' || Array.isArray(analytics)) {
    throw new Error('The bid analytics response is invalid.');
  }
  const funnel = record(analytics.funnel);
  const margin = record(analytics.averageWinningMargin);
  const breakdown = record(analytics.statusBreakdown);
  return {
    totalBids: count(analytics.totalBids),
    pendingBids: count(analytics.pendingBids),
    counterOffers: count(analytics.counterOffers),
    acceptedBids: count(analytics.acceptedBids),
    expiredBids: count(analytics.expiredBids),
    averageWinningMargin: {
      amount: count(margin.sampleSize) === 0 ? null : numberOrNull(margin.amount),
      percent: count(margin.sampleSize) === 0 ? null : numberOrNull(margin.percent),
      currency: text(margin.currency),
      sampleSize: count(margin.sampleSize),
    },
    statusBreakdown: {
      pending: count(breakdown.pending),
      accepted: count(breakdown.accepted),
      expired: count(breakdown.expired),
      other: count(breakdown.other),
    },
    funnel: {
      jobsPublished: count(funnel.jobsPublished),
      jobsWithBids: count(funnel.jobsWithBids),
      bidsReceived: count(funnel.bidsReceived),
      bidsAccepted: count(funnel.bidsAccepted),
      jobsCompleted: count(funnel.jobsCompleted),
    },
    topCompanies: Array.isArray(analytics.topCompanies)
      ? analytics.topCompanies.filter((company) => company && typeof company === 'object' && !Array.isArray(company)).map((company, index) => ({
          id: identifier(company.truckerId) ?? `company-${index}`,
          name: text(company.name) ?? '—',
          totalBids: count(company.totalBids),
          won: count(company.won),
          winRate: numberOrNull(company.winRate),
        }))
      : [],
  };
}

function mapDetailResponse(response) {
  const data = unwrapApiResponseData(response);
  const bid = data?.bid && typeof data.bid === 'object' ? data.bid : data;
  if (!identifier(record(bid).id)) {
    throw new Error('The bid detail response is missing its bid ID.');
  }
  return mapBid(bid);
}

export const bidsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminBids: builder.query({
      query: ({ status, isCounterOffer, jobId, search, dateFrom, dateTo, page = 1, limit = 20 } = {}) => ({
        url: '/admin/bids',
        params: {
          ...(status ? { status } : {}),
          ...(typeof isCounterOffer === 'boolean' ? { isCounterOffer } : {}),
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
      query: ({ dateFrom, dateTo, allTime } = {}) => ({
        url: '/admin/bids/analytics',
        params: {
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(typeof allTime === 'boolean' ? { allTime } : {}),
        },
      }),
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
