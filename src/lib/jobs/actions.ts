'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type { JobDrawerData, JobsFilters } from '@/types/jobs';
import { getJobDrawer } from './data';
import { toJobsQuery } from './query';

// Everything the Jobs screen does besides reading the list. They run on the Next.js server,
// so the token stays in the cookie. The backend decides who may do what (role checks), we show its message.

const MAX_TEXT = 500;

function invalid(message: string): ApiResult<never> {
  return { ok: false, error: { status: 400, message } };
}

function refresh(jobId: string) {
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/documents');
  revalidatePath('/dispatch');
}

export async function markDeliveredAction(input: { jobId: string; note?: string }): Promise<ApiResult<null>> {
  const note = String(input?.note ?? '').trim();
  if (!input?.jobId) return invalid('A job is required.');
  if (note.length > MAX_TEXT) return invalid(`Keep the note under ${MAX_TEXT} characters.`);
  const result = await apiFetch<unknown>(`/admin/jobs/${encodeURIComponent(input.jobId)}/mark-delivered`, {
    method: 'POST',
    body: note ? { note } : {},
  });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

// Cancelling always needs a reason: it holds the forwarder's escrow for review.
export async function cancelJobAction(input: { jobId: string; reason: string }): Promise<ApiResult<null>> {
  const reason = String(input?.reason ?? '').trim();
  if (!input?.jobId) return invalid('A job is required.');
  if (reason.length < 3) return invalid('Enter a reason of at least 3 characters.');
  if (reason.length > MAX_TEXT) return invalid(`Keep the reason under ${MAX_TEXT} characters.`);
  const result = await apiFetch<unknown>(`/admin/jobs/${encodeURIComponent(input.jobId)}/intervene`, {
    method: 'POST',
    body: { type: 'CANCEL_JOB', notes: reason },
  });
  if (!result.ok) return result;
  refresh(input.jobId);
  return { ok: true, data: null };
}

// CSV of every job that matches the filters (not only the page on screen)
export async function exportJobsAction(filters: JobsFilters): Promise<ApiResult<string>> {
  const { status, ...rest } = toJobsQuery(filters);
  return apiFetch<string>('/admin/jobs/export', { as: 'text', query: { ...rest, statusFilter: status } });
}

export async function exportJobSheetAction(jobId: string): Promise<ApiResult<string>> {
  if (!jobId) return invalid('A job is required.');
  return apiFetch<string>(`/admin/jobs/${encodeURIComponent(jobId)}/export`, { as: 'text' });
}

export async function getJobDrawerAction(job: { id: string; jobNumber: string }): Promise<ApiResult<JobDrawerData>> {
  if (!job?.id || !job?.jobNumber) return invalid('A job is required.');
  return getJobDrawer(job);
}