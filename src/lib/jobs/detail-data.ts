import 'server-only';
import { apiFetch } from '@/lib/api/server';
import { getDocReviewJob } from '@/lib/doc-review/data';
import type { ApiResult } from '@/types/api';
import type { BackendJobsList } from '@/types/jobs';
import type {
  BackendBid,
  BackendJobDetailDto,
  BackendPaginated,
  BackendPayment,
  BackendTracking,
  BackendTripFull,
  JobDetailData,
  TripDetail,
} from '@/types/jobDetail';
import { adaptJobDetail, adaptRoute, adaptTripDetail } from './detail-adapt';

// Runs on the Next.js server. The job page calls this once; the browser never talks to the backend for it.

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const JOB_NUMBER = /^(?:JOB|TK|TRK)-/i;

/** Every page of a list endpoint (the backend caps a page at 100) */
async function fetchAll<T>(path: string, query: Record<string, string>, key: string): Promise<ApiResult<T[]>> {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await apiFetch<BackendPaginated & Record<string, unknown>>(path, { query: { ...query, page, limit: PAGE_SIZE } });
    if (!result.ok) return result;
    const list = result.data[key];
    if (!Array.isArray(list)) return { ok: false, error: { status: 502, message: `The ${key} list came back in an unexpected shape.` } };
    rows.push(...(list as T[]));
    const totalPages = result.data.pagination?.totalPages ?? 1;
    if (page >= totalPages) break;
  }
  return { ok: true, data: rows };
}

/** Accepts the job's id or its number (TK-2026-000042) */
async function resolveJobId(idOrNumber: string): Promise<ApiResult<string>> {
  if (!JOB_NUMBER.test(idOrNumber)) return { ok: true, data: idOrNumber };
  const result = await apiFetch<BackendJobsList>('/admin/jobs', { query: { search: idOrNumber, page: 1, limit: PAGE_SIZE } });
  if (!result.ok) return result;
  const matches = result.data.jobs.filter((job) => job.jobNumber === idOrNumber);
  if (matches.length !== 1) return { ok: false, error: { status: 404, message: 'Job not found.' } };
  return { ok: true, data: matches[0].id };
}

export async function getJobDetail(idOrNumber: string): Promise<ApiResult<JobDetailData>> {
  const resolved = await resolveJobId(idOrNumber.trim());
  if (!resolved.ok) return resolved;
  const id = resolved.data;

  const detail = await apiFetch<BackendJobDetailDto>(`/admin/jobs/${encodeURIComponent(id)}`);
  if (!detail.ok) return detail;
  const dto = detail.data;
  if (dto.id !== id) return { ok: false, error: { status: 502, message: 'The job response does not match the requested job.' } };
  const jobNumber = dto.jobNumber ?? '';

  // Everything else is extra: if a part fails the page still opens and says what is missing.
  const [review, bids, trips, payments] = await Promise.all([
    getDocReviewJob(id),
    fetchAll<BackendBid>('/admin/bids', { jobId: id }, 'bids'),
    jobNumber ? fetchAll<BackendTripFull>('/admin/trips', { search: jobNumber }, 'trips') : Promise.resolve(null),
    jobNumber ? fetchAll<BackendPayment>('/admin/payments/transactions', { search: jobNumber }, 'rows') : Promise.resolve(null),
  ]);

  const warnings: string[] = [];
  // a job without documents (a draft, for example) answers 404: that is "nothing to show", not a failure
  if (!review.ok && review.error.status !== 404) warnings.push('documents');
  if (!bids.ok) warnings.push('bids');
  if (trips && !trips.ok) warnings.push('trips');
  if (payments && !payments.ok) warnings.push('transactions');

  return {
    ok: true,
    data: adaptJobDetail({
      dto,
      review: review.ok ? review.data : null,
      rejectedDocuments: review.ok ? review.data.counts.rejected : 0,
      bids: bids.ok ? bids.data : null,
      trips: trips?.ok ? trips.data : null,
      payments: payments?.ok ? payments.data : null,
      warnings,
    }),
  };
}

export async function getTripDetail(tripId: string, jobId: string): Promise<ApiResult<TripDetail>> {
  const result = await apiFetch<BackendTripFull>(`/admin/trips/${encodeURIComponent(tripId)}`);
  if (!result.ok) return result;
  if (result.data.tripId !== tripId || result.data.jobId !== jobId) {
    return { ok: false, error: { status: 404, message: 'This trip does not belong to this job.' } };
  }
  // the recorded GPS trail is an extra: without it the map falls back to driving directions
  const trail = result.data.jobNumber
    ? await apiFetch<BackendTracking>('/admin/tracking', { query: { search: result.data.jobNumber } })
    : null;
  return { ok: true, data: adaptTripDetail(result.data, trail?.ok ? adaptRoute(trail.data, jobId) : null) };
}
