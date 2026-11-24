import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

// Finance › Overview. One read of GET /admin/payments/overview, adapted in full
// (the Escrow page's adapter only keeps the escrow balance fields).

const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);

function shortDate(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-NG', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(date);
}

const BALANCE_COLORS = {
  held: 'var(--tk-viz-1)',
  pendingRelease: 'var(--tk-viz-3)',
  availableToSettle: 'var(--tk-viz-5)',
  disputed: 'var(--tk-danger-solid)',
};

export function adaptFinanceOverview(response) {
  const dto = record(unwrapApiResponseData(response));
  const balances = record(dto.escrowBalances), comparison = record(dto.escrowComparison), escrow = record(dto.escrow);
  const payouts = record(dto.payouts), dc = record(dto.demurrageAndCommission), weekly = record(dto.weeklyActivity), charts = record(dto.charts);
  const breakdown = record(dto.escrowBalanceBreakdown);

  const segments = Array.isArray(breakdown.segments)
    ? breakdown.segments.map((row) => ({
        key: text(row?.key), label: text(row?.label) ?? '—', value: number(row?.amount), count: count(row?.count),
        color: BALANCE_COLORS[row?.key] ?? 'var(--tk-ink-300)',
      }))
    : null;

  const trend = Array.isArray(charts.revenueTrend)
    ? charts.revenueTrend.map((row) => ({ label: shortDate(row?.date) ?? '—', value: number(row?.commission) }))
    : null;
  const meta = record(charts.revenueTrendMeta), best = record(meta.bestDay);

  return {
    balances: {
      total: number(balances.totalBalance),
      held: number(balances.heldFunds),
      pendingRelease: number(balances.pendingRelease),
      availableToSettle: number(balances.availableToSettle),
      availableToSettleCount: count(balances.availableToSettleCount),
      disputed: number(balances.disputed),
      disputedCount: count(balances.disputedCount),
      totalDelta: number(comparison.totalBalancePct),
      disputedDelta: number(comparison.disputedPct),
    },
    segments: segments && segments.every((row) => row.value != null) ? segments : null,
    segmentsTotal: number(breakdown.total),
    activeJobs: count(escrow.activeJobsCount),
    totalPaidOut: number(escrow.totalPaidOut),
    totalPaidOutDelta: number(escrow.totalPaidOutVsLastPeriodPct),
    payouts: {
      toTruckers: number(payouts.totalPaidToTruckers),
      trips: count(payouts.tripsCount),
      toForwarders: number(payouts.totalPaidToForwarders),
      successRate: number(payouts.payoutSuccessRate),
      successRateDelta: number(payouts.payoutSuccessRateVsLastPeriod),
      failedAmount: number(payouts.failedPayoutsAmount),
      failedCount: count(payouts.failedPayoutsCount),
    },
    commission: {
      earned: number(dc.totalCommissionEarned),
      delta: number(dc.commissionVsLastPeriodPct),
      rate: number(dc.commissionRate),
    },
    demurrage: {
      collected: number(dc.demurrageCollected),
      charged: number(dc.demurrageChargedToForwarders),
      credited: number(dc.demurrageCreditedToForwarders),
    },
    weekly: {
      fundsHeld: number(weekly.fundsHeld), fundsHeldTx: count(weekly.fundsHeldTx),
      fundsReleased: number(weekly.fundsReleased), fundsReleasedTx: count(weekly.fundsReleasedTx),
      settlements: number(weekly.settlementsMade), settlementsCount: count(weekly.settlementsCount),
      newDisputes: count(weekly.newDisputes), newDisputesAmount: number(weekly.newDisputesAmount),
    },
    trend: trend && trend.length && trend.every((row) => row.value != null) ? trend : null,
    trendDailyAverage: number(meta.dailyAvgCommission),
    trendBestDay: number(best.commission) != null ? { label: shortDate(best.date) ?? '—', value: number(best.commission) } : null,
  };
}

export const financeOverviewApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminEscrowOverview'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminFinanceOverview: builder.query({
      query: ({ dateFrom, dateTo } = {}) => ({ url: '/admin/payments/overview', params: dateFrom && dateTo ? { dateFrom, dateTo } : { period: 'all' } }),
      transformResponse: adaptFinanceOverview,
      providesTags: ['AdminEscrowOverview'],
    }),
  }),
});

export const { useGetAdminFinanceOverviewQuery } = financeOverviewApi;
