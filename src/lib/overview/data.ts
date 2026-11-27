import 'server-only';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type { BackendBidAnalytics, BackendOverview, BidInsights, OverviewData } from '@/types/overview';
import { adaptBidInsights, adaptOverview } from './adapt';

// Runs on the Next.js server. The Operations Overview page calls these.
// It also uses getJobStats (lib/jobs/data), getTripStats (lib/trips/data), getJobs (lib/jobs/data) and getDocReviewStats (lib/doc-review/data).

export async function getOverview(): Promise<ApiResult<OverviewData>> {
  const result = await apiFetch<BackendOverview>('/admin/overview', { query: { topRoutesLimit: 5 } });
  return result.ok ? { ok: true, data: adaptOverview(result.data) } : result;
}

// All time sends allTime=true; a period sends its dates
export async function getBidInsights(range: { dateFrom?: string; dateTo?: string }): Promise<ApiResult<BidInsights>> {
  const allTime = !range.dateFrom || !range.dateTo;
  const result = await apiFetch<BackendBidAnalytics>('/admin/bids/analytics', { query: allTime ? { allTime: true } : { ...range } });
  return result.ok ? { ok: true, data: adaptBidInsights(result.data) } : result;
}
