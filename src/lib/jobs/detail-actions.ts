'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api/server';
import { getAdmin } from '@/lib/auth/session';
import type { ApiResult } from '@/types/api';
import type { BackendBidAction, TripDetail } from '@/types/jobDetail';
import { getTripDetail } from './detail-data';

// What the Job details screen does besides reading. They run on the Next.js server, so the token stays in the cookie.
// Cancel and mark delivered are in ./actions (the Jobs list uses them too).
// The backend has the last word on who may do what: we check the role here only to give a clear message early.

const OPS_ROLES = new Set(['SUPER_ADMIN', 'OPS_ADMIN']);
const FLAG_ROLES = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const FLAG_REASONS = new Set(['PRICING', 'DOCUMENTS', 'DELAY', 'SAFETY', 'FRAUD_RISK', 'CUSTOMER_COMPLAINT', 'OTHER']);
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(message: string, status = 400): ApiResult<never> {
  return { ok: false, error: { status, message } };
}

async function mayDo(roles: Set<string>): Promise<boolean> {
  const admin = await getAdmin();
  return Boolean(admin?.role && roles.has(admin.role));
}

/** 3 to 500 characters */
function checkReason(value: unknown): { reason: string } | { error: ApiResult<never> } {
  const reason = String(value ?? '').trim();
  if (reason.length < 3 || reason.length > 500) return { error: fail('Enter a reason between 3 and 500 characters.') };
  return { reason };
}

function refresh(jobId: string) {
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/dispatch');
}

export async function getTripDetailAction(input: { tripId: string; jobId: string }): Promise<ApiResult<TripDetail>> {
  if (!input?.tripId || !input?.jobId) return fail('A trip is required.');
  return getTripDetail(input.tripId, input.jobId);
}

export async function markInTransitAction(input: { jobId: string; reason: string }): Promise<ApiResult<null>> {
  if (!(await mayDo(OPS_ROLES))) return fail('This action is not available for your account.', 403);
  const checked = checkReason(input?.reason);
  if ('error' in checked) return checked.error;
  const result = await apiFetch<unknown>(`/admin/jobs/${encodeURIComponent(input.jobId)}/mark-in-transit`, { method: 'POST', body: { reason: checked.reason } });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

export async function flagJobAction(input: { jobId: string; flagReason: string; note: string; expectedVersion?: string | null }): Promise<ApiResult<null>> {
  if (!(await mayDo(FLAG_ROLES))) return fail('This action is not available for your account.', 403);
  if (!FLAG_REASONS.has(input?.flagReason)) return fail('Choose a review reason.');
  const checked = checkReason(input?.note);
  if ('error' in checked) return checked.error;
  const result = await apiFetch<unknown>(`/admin/jobs/${encodeURIComponent(input.jobId)}/flag`, {
    method: 'POST',
    body: { reason: input.flagReason, note: checked.reason, ...(input.expectedVersion ? { expectedVersion: input.expectedVersion } : {}) },
  });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

export interface EditJobInput {
  jobId: string;
  expectedVersion: string | null;
  reason: string;
  /** datetime-local text from the form, or empty */
  tdoDate?: string;
  cargoDescription?: string;
  specialInstructions?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  containerReturnAddress?: string;
}

/** A date the admin typed, as ISO, at least 24 hours from now (the same rule as creating a job) */
function futureDate(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= Date.now() + DAY_MS ? new Date(time).toISOString() : null;
}

/** Who the backend told about the edit */
export interface EditJobResult { forwarderNotified: boolean; truckingSideNotified: number }

export async function editJobAction(input: EditJobInput): Promise<ApiResult<EditJobResult>> {
  if (!(await mayDo(OPS_ROLES))) return fail('This action is not available for your account.', 403);
  const checked = checkReason(input?.reason);
  if ('error' in checked) return checked.error;
  if (!input.expectedVersion) return fail('Refresh the job before editing it.');
  const fields: Record<string, string> = {};
  const set = (key: string, value: string | undefined) => { const v = String(value ?? '').trim(); if (v) fields[key] = v; };
  set('cargoDescription', input.cargoDescription);
  set('specialInstructions', input.specialInstructions);
  set('pickupAddress', input.pickupAddress);
  set('deliveryAddress', input.deliveryAddress);
  set('containerReturnAddress', input.containerReturnAddress);
  if (input.tdoDate?.trim()) {
    const iso = futureDate(input.tdoDate);
    if (!iso) return fail('Choose a TDO date at least 24 hours from now.');
    fields.tdoDate = iso;
  }
  if (!Object.keys(fields).length) return fail('Enter at least one change.');
  const result = await apiFetch<{ notified?: { forwarder?: unknown; truckingSide?: unknown } | null }>(`/admin/jobs/${encodeURIComponent(input.jobId)}`, {
    method: 'PATCH',
    body: { ...fields, expectedVersion: input.expectedVersion, reason: checked.reason },
  });
  if (!result.ok) return result;
  refresh(input.jobId);
  const notified = result.data?.notified;
  return { ok: true, data: { forwarderNotified: Boolean(notified?.forwarder), truckingSideNotified: Array.isArray(notified?.truckingSide) ? notified.truckingSide.length : 0 } };
}

// ---------- bids ----------

export interface BidActionState { version: string; canAccept: boolean; canDecline: boolean }

/** Accepting or declining needs the bid's current version, so the screen asks for it when the dialog opens */
export async function getBidActionStateAction(input: { bidId: string; jobId: string }): Promise<ApiResult<BidActionState>> {
  const result = await apiFetch<BackendBidAction>(`/admin/bids/${encodeURIComponent(input.bidId)}`);
  if (!result.ok) return result;
  const bid = result.data;
  if ((bid.jobId ?? bid.job?.id) !== input.jobId) return fail('This bid does not belong to this job.', 404);
  if (!bid.version) return fail('The bid could not be read. Refresh and try again.', 502);
  return { ok: true, data: { version: bid.version, canAccept: bid.adminActions?.canAccept === true, canDecline: bid.adminActions?.canDecline === true } };
}

export async function decideBidAction(input: { decision: 'accept' | 'decline'; bidId: string; jobId: string; expectedVersion: string; reason: string }): Promise<ApiResult<null>> {
  if (!(await mayDo(OPS_ROLES))) return fail('This action is not available for your account.', 403);
  const checked = checkReason(input?.reason);
  if ('error' in checked) return checked.error;
  if (!input.expectedVersion) return fail('Refresh the bid before continuing.');
  const result = await apiFetch<unknown>(`/admin/bids/${encodeURIComponent(input.bidId)}/${input.decision === 'accept' ? 'accept' : 'decline'}`, {
    method: 'POST',
    body: { jobId: input.jobId, expectedVersion: input.expectedVersion, reason: checked.reason },
  });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

// ---------- trips ----------

export async function markTripAtDeliveryAction(input: { tripId: string; jobId: string }): Promise<ApiResult<null>> {
  if (!(await mayDo(OPS_ROLES))) return fail('This action is not available for your account.', 403);
  const result = await apiFetch<unknown>(`/admin/trips/${encodeURIComponent(input.tripId)}/mark-at-delivery`, { method: 'POST' });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

export async function markTripDelayedAction(input: { tripId: string; jobId: string; reason: string }): Promise<ApiResult<null>> {
  if (!(await mayDo(OPS_ROLES))) return fail('This action is not available for your account.', 403);
  const reason = String(input?.reason ?? '').trim();
  if (!reason || reason.length > 500) return fail('Enter a delay reason of up to 500 characters.');
  const result = await apiFetch<unknown>(`/admin/trips/${encodeURIComponent(input.tripId)}/mark-delayed`, { method: 'POST', body: { reason } });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}
