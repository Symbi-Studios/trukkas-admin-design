import 'server-only';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type {
  BackendPorts,
  BackendDocSummary,
  BackendJobsList,
  BackendJobStats,
  BackendTripsList,
  JobDrawerData,
  JobsPage,
  JobsQuery,
  JobStats,
  PendingUploads,
  PortOption,
} from '@/types/jobs';
import { adaptDocCounts, adaptDrawerTrips, adaptJobsPage, adaptJobStats, adaptPorts } from './adapt';

export type { JobsQuery };

// Runs on the Next.js server. The Jobs page calls these; the browser never talks to the backend for the list.

export async function getJobs(query: JobsQuery = {}): Promise<ApiResult<JobsPage>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const { status, ...rest } = query;
  const result = await apiFetch<BackendJobsList>('/admin/jobs', {
    query: { ...rest, statusFilter: status, page, limit },
  });
  return result.ok ? { ok: true, data: adaptJobsPage(result.data, { page, limit }) } : result;
}

export async function getJobStats(range: { dateFrom?: string; dateTo?: string } = {}): Promise<ApiResult<JobStats>> {
  const result = await apiFetch<BackendJobStats>('/admin/jobs/stats', { query: { ...range } });
  return result.ok ? { ok: true, data: adaptJobStats(result.data) } : result;
}

// The ports for the Pickup port filter (the same ports the app offers when a forwarder creates a job)
export async function getPorts(): Promise<ApiResult<PortOption[]>> {
  const result = await apiFetch<BackendPorts>('/admin/reference/ports');
  return result.ok ? { ok: true, data: adaptPorts(result.data) } : result;
}

// Jobs waiting for the forwarder to upload documents (shown as a note on the Pending Approval tab)
export async function getPendingUploads(search?: string): Promise<ApiResult<PendingUploads>> {
  const result = await apiFetch<BackendJobsList>('/admin/jobs/pending-docs', { query: { search, page: 1, limit: 3 } });
  if (!result.ok) return result;
  const page = adaptJobsPage(result.data, { page: 1, limit: 3 });
  return { ok: true, data: { total: page.pagination.total, jobs: page.jobs.map((job) => ({ id: job.id, jobNumber: job.jobNumber })) } };
}

// What the side drawer needs beyond the list row: who drives which truck, and how the documents stand.
// Two small calls on the Next.js server (the old screen made five from the browser).
export async function getJobDrawer(job: { id: string; jobNumber: string }): Promise<ApiResult<JobDrawerData>> {
  const [trips, documents] = await Promise.all([
    apiFetch<BackendTripsList>('/admin/trips', { query: { search: job.jobNumber, limit: 100 } }),
    apiFetch<{ documentSummary?: BackendDocSummary | null }>(`/admin/doc-review/queue/${encodeURIComponent(job.id)}`),
  ]);
  // a job without documents (for example a draft) answers 404 here: that is "nothing to show", not a failure
  if (!trips.ok && !documents.ok && documents.error.status !== 404) return trips;
  return {
    ok: true,
    data: {
      trips: trips.ok ? adaptDrawerTrips(trips.data, job.id) : null,
      documents: documents.ok ? adaptDocCounts(documents.data.documentSummary) : null,
    },
  };
}
