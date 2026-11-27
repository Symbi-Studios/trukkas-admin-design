import 'server-only';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type { BackendTrip, BackendTripsList, BackendTripStats, TripRow, TripsPage, TripsQuery, TripStats } from '@/types/trips';
import { adaptTrip, adaptTripsPage, adaptTripStats } from './adapt';

// Runs on the Next.js server. The Trips page calls these; the browser never talks to the backend for the list.

export async function getTrips(query: TripsQuery = {}): Promise<ApiResult<TripsPage>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const result = await apiFetch<BackendTripsList>('/admin/trips', { query: { ...query, page, limit } });
  return result.ok ? { ok: true, data: adaptTripsPage(result.data, { page, limit }) } : result;
}

export async function getTripStats(range: { dateFrom?: string; dateTo?: string } = {}): Promise<ApiResult<TripStats>> {
  const result = await apiFetch<BackendTripStats>('/admin/trips/stats', { query: { ...range } });
  return result.ok ? { ok: true, data: adaptTripStats(result.data) } : result;
}

// One trip with everything the side drawer shows (reported issues, the payout)
export async function getTrip(id: string): Promise<ApiResult<TripRow>> {
  const result = await apiFetch<BackendTrip>(`/admin/trips/${encodeURIComponent(id)}`);
  return result.ok ? { ok: true, data: adaptTrip(result.data) } : result;
}
