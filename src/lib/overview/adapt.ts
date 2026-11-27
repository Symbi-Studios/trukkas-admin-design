import type { BackendBidAnalytics, BackendOverview, BidInsights, OverviewData } from '@/types/overview';

// Pure functions: backend shape in, screen shape out. No fetching here, so they are easy to test.

const WEEKDAY = new Intl.DateTimeFormat('en-NG', { weekday: 'short', timeZone: 'Africa/Lagos' });

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function adaptOverview(dto: BackendOverview): OverviewData {
  const performance = dto?.deliveryPerformance ?? null;
  return {
    completedToday: num(dto?.jobs?.completedToday),
    cancelledThisWeek: num(dto?.jobs?.cancelledThisWeek),
    delayedAtRisk: num(dto?.jobs?.delayedAtRisk),
    weeklyVolume: (dto?.weeklyJobVolume ?? []).flatMap((row) => {
      const count = num(row.count);
      const date = row.date ? new Date(row.date) : null;
      return count != null && date && !Number.isNaN(date.getTime()) ? [{ label: WEEKDAY.format(date), count }] : [];
    }),
    delivery: { onTime: num(performance?.onTime), minorDelay: num(performance?.minorDelay), critical: num(performance?.critical) },
    topRoutes: (dto?.topRoutesByVolume ?? []).flatMap((row) => {
      const trips = num(row.trips);
      return row.route && trips != null ? [{ route: row.route, trips }] : [];
    }),
  };
}

export function adaptBidInsights(dto: BackendBidAnalytics): BidInsights {
  const body = dto?.analytics ?? dto;
  const funnel = body?.funnel ?? null;
  const margin = body?.averageWinningMargin ?? null;
  const measured = num(margin?.sampleSize) !== 0;
  return {
    funnel: {
      jobsPublished: num(funnel?.jobsPublished),
      jobsWithBids: num(funnel?.jobsWithBids),
      bidsReceived: num(funnel?.bidsReceived),
      bidsAccepted: num(funnel?.bidsAccepted),
      jobsCompleted: num(funnel?.jobsCompleted),
    },
    margin: { amount: measured ? num(margin?.amount) : null, percent: measured ? num(margin?.percent) : null },
  };
}
