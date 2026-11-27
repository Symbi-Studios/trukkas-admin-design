'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api/server';
import { getAdmin } from '@/lib/auth/session';
import type { ApiResult } from '@/types/api';
import type { TripRow, TripsFilters } from '@/types/trips';
import { getTrip } from './data';
import { toTripsQuery } from './query';

// What the Trips screen does besides reading the list. They run on the Next.js server, so the token stays in the cookie.
// "Mark delayed" and "Mark at delivery" are in lib/jobs/detail-actions (the job page uses them too).
// The backend has the last word on who may do what: we check the role here only to give a clear message early.

const OPS_ROLES = new Set(['SUPER_ADMIN', 'OPS_ADMIN']);

function fail(message: string, status = 400): ApiResult<never> {
  return { ok: false, error: { status, message } };
}

export async function getTripAction(id: string): Promise<ApiResult<TripRow>> {
  if (!id) return fail('A trip is required.');
  return getTrip(id);
}

// CSV of every trip that matches the filters (not only the page on screen)
export async function exportTripsAction(filters: TripsFilters): Promise<ApiResult<string>> {
  return apiFetch<string>('/admin/trips/export', { as: 'text', query: { ...toTripsQuery(filters) } });
}

export async function clearTripDelayAction(input: { tripId: string }): Promise<ApiResult<null>> {
  const admin = await getAdmin();
  if (!admin?.role || !OPS_ROLES.has(admin.role)) return fail('This action is not available for your account.', 403);
  if (!input?.tripId) return fail('A trip is required.');
  const result = await apiFetch<unknown>(`/admin/trips/${encodeURIComponent(input.tripId)}/clear-delayed`, { method: 'POST' });
  if (!result.ok) return result;
  revalidatePath('/trips');
  revalidatePath('/jobs');
  return { ok: true, data: null };
}

export async function messageDriverAction(input: { tripId: string; message: string }): Promise<ApiResult<null>> {
  const message = String(input?.message ?? '').trim();
  if (!input?.tripId) return fail('A trip is required.');
  if (!message || message.length > 2000) return fail('Enter a message of up to 2,000 characters.');
  const result = await apiFetch<unknown>(`/admin/trips/${encodeURIComponent(input.tripId)}/message-driver`, { method: 'POST', body: { message } });
  if (!result.ok) return result;
  return { ok: true, data: null };
}
