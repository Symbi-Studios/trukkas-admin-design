import 'server-only';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type { BackendDocStats, BackendJobDetail, BackendQueue, QueueTab, ReviewJob, ReviewQueue, ReviewStats } from '@/types/docReview';
import { adaptJob, adaptQueue } from './adapt';

// Runs on the Next.js server. Pages call these; the browser never talks to the backend for this screen.

export type { QueueTab };

export interface QueueParams {
  status?: QueueTab;
  /** awaiting defaults to oldest first, the other tabs to newest first */
  sort?: 'oldest' | 'newest';
  search?: string;
  page?: number;
  limit?: number;
  documentType?: 'TDO' | 'EXIT_NOTE' | 'CUSTOMS_GATE_PASS';
  documentStatus?: 'approved' | 'pending' | 'rejected';
  companyId?: string;
  missing?: boolean;
}

export async function getDocReviewQueue(params: QueueParams = {}): Promise<ApiResult<ReviewQueue>> {
  const result = await apiFetch<BackendQueue>('/admin/doc-review/queue', { query: { ...params } });
  return result.ok ? { ok: true, data: adaptQueue(result.data) } : result;
}

export async function getDocReviewJob(jobId: string): Promise<ApiResult<ReviewJob>> {
  const result = await apiFetch<BackendJobDetail>(`/admin/doc-review/queue/${encodeURIComponent(jobId)}`);
  return result.ok ? { ok: true, data: adaptJob(result.data) } : result;
}

export async function getDocReviewStats(): Promise<ApiResult<ReviewStats>> {
  return apiFetch<BackendDocStats>('/admin/doc-review/stats');
}