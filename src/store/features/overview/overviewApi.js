import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapUserCount(group) {
  return {
    total: numberOrNull(group?.total),
    todayDelta: numberOrNull(group?.todayDelta),
    weekDelta: numberOrNull(group?.weekDelta),
    monthDelta: numberOrNull(group?.monthDelta),
  };
}

function mapAdminOverviewResponse(response) {
  const data = unwrapApiResponseData(response) || {};
  const jobs = data.jobs || {};

  return {
    jobs: {
      total: numberOrNull(jobs.totalJobs),
      totalTrendPercent: numberOrNull(jobs.totalJobsTrendPercent),
      active: numberOrNull(jobs.activeJobs),
      activeTrendPercent: numberOrNull(jobs.activeJobsTrendPercent),
      completed: numberOrNull(jobs.completedJobs),
      completedToday: numberOrNull(jobs.completedToday),
      cancelled: numberOrNull(jobs.cancelledJobs),
      cancelledThisWeek: numberOrNull(jobs.cancelledThisWeek),
      delayedAtRisk: numberOrNull(jobs.delayedAtRisk),
      demurrageRevenueMonth: numberOrNull(jobs.demurrageRevenueMonth),
      platformRevenueMonth: numberOrNull(jobs.platformRevenueMonth),
      revenueTrendPercent: numberOrNull(jobs.revenueTrendPercent),
      openTickets: numberOrNull(jobs.openTickets),
      needActionTickets: numberOrNull(jobs.needActionTickets),
      docsPending: numberOrNull(jobs.docsPending),
    },
    users: {
      forwarders: mapUserCount(data.users?.forwarders),
      truckers: mapUserCount(data.users?.truckers),
      drivers: mapUserCount(data.users?.drivers),
    },
    weeklyJobVolume: Array.isArray(data.weeklyJobVolume)
      ? data.weeklyJobVolume.map((entry) => ({
          date: entry?.date || '',
          count: numberOrNull(entry?.count) ?? 0,
        }))
      : [],
    deliveryPerformance: {
      onTime: numberOrNull(data.deliveryPerformance?.onTime),
      minorDelay: numberOrNull(data.deliveryPerformance?.minorDelay),
      critical: numberOrNull(data.deliveryPerformance?.critical),
    },
    recentJobs: Array.isArray(data.recentJobs)
      ? data.recentJobs.map((job) => ({
          id: job?.id || job?.jobNumber,
          displayId: job?.jobNumber || job?.id || '—',
          status: job?.statusLabel || job?.status || '—',
          routeLabel: job?.route || '—',
          // The overview contract does not include cargo, forwarder/exporter,
          // or job value. Keep those fields absent rather than implying the API
          // returned them.
          truckerName: job?.truckerName || null,
          value: null,
          // This endpoint provides a summary only; the job detail route is
          // still backed by the local mock collection.
          detailAvailable: false,
        })).filter((job) => job.id)
      : [],
    marketplaceHealth: {
      activeForwarders: numberOrNull(data.marketplaceHealth?.activeForwarders),
      activeTruckOwners: numberOrNull(data.marketplaceHealth?.activeTruckOwners),
      truckerAcceptanceRate: numberOrNull(data.marketplaceHealth?.truckerAcceptanceRate),
      forwarderRepeatRate: numberOrNull(data.marketplaceHealth?.forwarderRepeatRate),
      disputesPer100Jobs: numberOrNull(data.marketplaceHealth?.disputesPer100Jobs),
      escrowBalance: numberOrNull(data.marketplaceHealth?.escrowBalance),
    },
  };
}

export const overviewApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query({
      query: () => ({ url: '/admin/overview', method: 'GET' }),
      transformResponse: mapAdminOverviewResponse,
    }),
  }),
});

export const { useGetAdminOverviewQuery } = overviewApi;
