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
    exporterCount: numberOrNull(group?.exporterCount),
  };
}

function formatJoinedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatStatus(value) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapRegistrations(records, type, route) {
  return Array.isArray(records)
    ? records.map((record, index) => {
        const name = record?.name || '—';
        return {
          id: record?.id || `${type.toLowerCase()}-${index}-${name}`,
          name,
          type: record?.type || type,
          contact: record?.contact || '—',
          joined: formatJoinedAt(record?.joinedAt),
          status: formatStatus(record?.status),
          route,
          avatar: name,
        };
      })
    : [];
}

function mapHealthStatus(value) {
  const normalized = typeof value === 'string' ? value.toUpperCase() : '';
  const labels = {
    HEALTHY: { status: 'Healthy', tone: 'success' },
    DEGRADED: { status: 'Degraded', tone: 'warning' },
    NOT_AVAILABLE: { status: 'Not Available', tone: 'warning' },
    NOT_MONITORED: { status: 'Not Monitored', tone: 'neutral' },
  };
  return labels[normalized] || {
    status: normalized ? formatStatus(normalized) : '—',
    tone: normalized ? 'danger' : 'neutral',
  };
}

function mapMoneyBreakdown(part) {
  return {
    amount: numberOrNull(part?.amount),
    percent: numberOrNull(part?.percent),
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
    fleet: {
      trucksTotal: numberOrNull(data.fleet?.trucksTotal),
      trucksActive: numberOrNull(data.fleet?.trucksActive),
      companiesTotal: numberOrNull(data.fleet?.companiesTotal),
    },
    trips: {
      activeTrips: numberOrNull(data.trips?.activeTrips),
      containersMovedThisMonth: numberOrNull(data.trips?.containersMovedThisMonth),
      containersMovedTrendPercent: numberOrNull(data.trips?.containersMovedTrendPercent),
    },
    topRoutesByVolume: Array.isArray(data.topRoutesByVolume)
      ? data.topRoutesByVolume.map((route) => ({
          route: route?.route || '—',
          trips: numberOrNull(route?.trips) ?? 0,
          percentOfTotal: numberOrNull(route?.percentOfTotal),
        }))
      : [],
    earningsBreakdown: {
      totalOrders: numberOrNull(data.earningsBreakdown?.totalOrders),
      drivers: mapMoneyBreakdown(data.earningsBreakdown?.drivers),
      companies: mapMoneyBreakdown(data.earningsBreakdown?.companies),
      platformFees: mapMoneyBreakdown(data.earningsBreakdown?.platformFees),
      demurrage: mapMoneyBreakdown(data.earningsBreakdown?.demurrage),
      otherCosts: mapMoneyBreakdown(data.earningsBreakdown?.otherCosts),
    },
    tripActivity: {
      totalTrips: numberOrNull(data.tripActivity?.totalTrips),
      completed: numberOrNull(data.tripActivity?.completed),
      inTransit: numberOrNull(data.tripActivity?.inTransit),
      scheduled: numberOrNull(data.tripActivity?.scheduled),
      cancelled: numberOrNull(data.tripActivity?.cancelled),
    },
    averageRating: {
      average: numberOrNull(data.averageRating?.average),
      totalReviews: numberOrNull(data.averageRating?.totalReviews),
      trendVsLastMonth: numberOrNull(data.averageRating?.trendVsLastMonth),
      breakdown: Object.fromEntries(
        [1, 2, 3, 4, 5].map((stars) => [
          stars,
          numberOrNull(data.averageRating?.breakdown?.[stars]),
        ]),
      ),
    },
    systemHealth: {
      platformApi: mapHealthStatus(data.systemHealth?.platformApi),
      database: mapHealthStatus(data.systemHealth?.database),
      payments: mapHealthStatus(data.systemHealth?.payments),
      gpsTracking: mapHealthStatus(data.systemHealth?.gpsTracking),
      notifications: mapHealthStatus(data.systemHealth?.notifications),
    },
    recentRegistrations: {
      drivers: mapRegistrations(data.recentRegistrations?.drivers, 'Driver', '/drivers'),
      truckingCompanies: mapRegistrations(
        data.recentRegistrations?.truckingCompanies,
        'Company',
        '/companies',
      ),
      forwarders: mapRegistrations(
        data.recentRegistrations?.forwarders,
        'Forwarder',
        '/forwarders',
      ),
      exporters: mapRegistrations(
        data.recentRegistrations?.exporters,
        'Exporter',
        '/forwarders',
      ),
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
          cargo: job?.cargo || null,
          company: job?.forwarderName || null,
          truckerName: job?.truckerName || null,
          value: numberOrNull(job?.value),
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
