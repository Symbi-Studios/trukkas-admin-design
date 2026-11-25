import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { reportRecord, reportText } from './reportContracts.js';
import { metricCount, metricNumber, metricRate } from './reportMetrics.js';
import { humanReportCode } from './reportOverviewAdapter.js';

// Read-only analytics sources for the Reports & Analytics hub. Each adapter maps the wire format to
// plain numbers (null when missing or unparseable) so the screen never guesses at shapes.

const list = (value) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : []);
const trend = (value) => metricNumber(value);

function adaptPlatform(response) {
  const dto = reportRecord(unwrapApiResponseData(response));
  const range = reportRecord(dto.range), jobs = reportRecord(range.jobs), revenue = reportRecord(range.revenue), registrations = reportRecord(range.registrations);
  const earnings = reportRecord(dto.earningsBreakdown), trips = reportRecord(dto.tripActivity), rating = reportRecord(dto.averageRating);
  const segment = (key, label) => ({ key, label, amount: metricNumber(reportRecord(earnings[key]).amount), percent: metricRate(reportRecord(earnings[key]).percent) });
  const breakdown = reportRecord(rating.breakdown);
  return {
    jobs: {
      created: metricCount(jobs.created), createdChange: trend(jobs.createdTrendPercent),
      completed: metricCount(jobs.completed), completedChange: trend(jobs.completedTrendPercent),
      cancelled: metricCount(jobs.cancelled), cancelledChange: trend(jobs.cancelledTrendPercent),
      containersMoved: metricCount(jobs.containersMoved), containersMovedChange: trend(jobs.containersMovedTrendPercent),
    },
    revenue: {
      platform: metricNumber(revenue.platformRevenue), platformChange: trend(revenue.platformRevenueTrendPercent),
      demurrage: metricNumber(revenue.demurrageRevenue), demurrageChange: trend(revenue.demurrageRevenueTrendPercent),
    },
    registrations: {
      forwarders: metricCount(registrations.forwarders), truckers: metricCount(registrations.truckers), drivers: metricCount(registrations.drivers),
      total: metricCount(registrations.total), totalChange: trend(registrations.totalTrendPercent),
    },
    topRoutes: list(dto.topRoutesByVolume).map((row, index) => ({ id: String(index), route: reportText(row.route) || '—', trips: metricCount(row.trips), share: metricRate(row.percentOfTotal) })),
    earnings: {
      total: metricNumber(earnings.totalOrders),
      completedJobs: metricCount(earnings.completedJobs),
      basis: reportText(earnings.basis),
      segments: [
        segment('drivers', 'Drivers'), segment('companies', 'Truck companies'), segment('platformFees', 'Platform fees'),
        segment('demurrage', 'Demurrage'), segment('otherCosts', 'Other costs'), segment('vat', 'VAT'),
      ],
      refunds: { amount: metricNumber(reportRecord(earnings.refunds).amount), count: metricCount(reportRecord(earnings.refunds).count) },
    },
    trips: { total: metricCount(trips.totalTrips), completed: metricCount(trips.completed), inTransit: metricCount(trips.inTransit), scheduled: metricCount(trips.scheduled), cancelled: metricCount(trips.cancelled) },
    rating: {
      average: metricNumber(rating.average), reviews: metricCount(rating.totalReviews), change: metricNumber(rating.trendVsLastMonth),
      // breakdown is the share of ratings per star (percent 0–100), not counts.
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, percent: metricRate(breakdown[stars]) })),
    },
  };
}

function adaptBids(response) {
  const dto = reportRecord(unwrapApiResponseData(response));
  const margin = reportRecord(dto.averageWinningMargin), status = reportRecord(dto.statusBreakdown), funnel = reportRecord(dto.funnel);
  return {
    total: metricCount(dto.totalBids), accepted: metricCount(dto.acceptedBids), pending: metricCount(dto.pendingBids),
    counterOffers: metricCount(dto.counterOffers), expired: metricCount(dto.expiredBids),
    margin: { amount: metricNumber(margin.amount), percent: metricNumber(margin.percent), sampleSize: metricCount(margin.sampleSize) },
    status: { accepted: metricCount(status.accepted), pending: metricCount(status.pending), expired: metricCount(status.expired), rejected: metricCount(status.rejected), withdrawn: metricCount(status.withdrawn) },
    funnel: [
      { key: 'jobsPublished', label: 'Jobs published', value: metricCount(funnel.jobsPublished) },
      { key: 'jobsWithBids', label: 'Jobs with bids', value: metricCount(funnel.jobsWithBids) },
      { key: 'bidsReceived', label: 'Bids received', value: metricCount(funnel.bidsReceived) },
      { key: 'bidsAccepted', label: 'Bids accepted', value: metricCount(funnel.bidsAccepted) },
      { key: 'jobsCompleted', label: 'Jobs completed', value: metricCount(funnel.jobsCompleted) },
    ],
    topCompanies: list(dto.topCompanies).map((row, index) => ({
      key: String(index), id: reportText(row.truckerId), name: reportText(row.name) || '—',
      bids: metricCount(row.totalBids), won: metricCount(row.won), winRate: metricRate(row.winRate),
    })),
  };
}

const FEE_CATEGORIES = { PLATFORM: 'Platform', SERVICE: 'Service', PROCESSING: 'Processing' };
function adaptFees(response) {
  const dto = reportRecord(unwrapApiResponseData(response));
  return {
    total: metricNumber(dto.totalCollected),
    truncated: dto.truncated === true,
    byCategory: list(dto.totalsByCategory).map((row) => ({ key: reportText(row.category) || '—', label: FEE_CATEGORIES[row.category] || humanReportCode(row.category), amount: metricNumber(row.amount), count: metricCount(row.count) })),
    series: list(dto.series).map((row) => ({ date: reportText(row.date), category: reportText(row.category), amount: metricNumber(row.amount) })).filter((row) => row.date && /^\d{4}-\d{2}-\d{2}/.test(row.date)),
    topRules: list(dto.topRules).map((row, index) => ({ id: reportText(row.ruleId) || String(index), name: reportText(row.name) || '—', category: FEE_CATEGORIES[row.category] || humanReportCode(row.category), total: metricNumber(row.totalCollected), count: metricCount(row.count) })),
  };
}

function adaptDemurrage(response) {
  const dto = reportRecord(unwrapApiResponseData(response));
  return {
    charged: metricNumber(dto.totalCharges), collected: metricNumber(dto.totalCollected), outstanding: metricNumber(dto.outstanding),
    waived: metricNumber(dto.waived), collectionRate: metricRate(dto.collectionRate),
  };
}

function adaptVerification(response) {
  const dto = reportRecord(unwrapApiResponseData(response));
  const keys = ['total', 'pending', 'inReview', 'verified', 'rejected', 'nonCompliant', 'cancelled', 'expiringSoon'];
  return { ...Object.fromEntries(keys.map((key) => [key, metricCount(dto[key])])), expiryWindowDays: metricCount(dto.expiryWindowDays) };
}

export const analyticsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    // from/to are Lagos calendar days (YYYY-MM-DD), both inclusive.
    getAnalyticsPlatform: builder.query({
      query: ({ from, to }) => ({ url: '/admin/overview', params: { from, to, topRoutesLimit: 10 } }),
      transformResponse: adaptPlatform,
    }),
    getAnalyticsBids: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/bids/analytics', params: { dateFrom, dateTo } }),
      transformResponse: adaptBids,
    }),
    getAnalyticsFees: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/fees/analytics', params: { dateFrom, dateTo } }),
      transformResponse: adaptFees,
    }),
    getAnalyticsDemurrage: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/demurrage/summary', params: { dateFrom, dateTo } }),
      transformResponse: adaptDemurrage,
    }),
    getAnalyticsVerification: builder.query({
      query: ({ dateFrom, dateTo }) => ({ url: '/admin/verification/summary', params: { dateFrom, dateTo, expiryWindowDays: 30 } }),
      transformResponse: adaptVerification,
    }),
  }),
});

export const {
  useGetAnalyticsPlatformQuery, useGetAnalyticsBidsQuery, useGetAnalyticsFeesQuery, useGetAnalyticsDemurrageQuery, useGetAnalyticsVerificationQuery,
} = analyticsApi;
