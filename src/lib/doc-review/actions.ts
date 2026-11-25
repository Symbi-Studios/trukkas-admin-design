'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api/server';
import type { ApiResult } from '@/types/api';
import type { ReviewJob } from '@/types/docReview';
import { getDocReviewJob } from './data';

// Approve or reject ONE document. They run on the Next.js server, so the token stays in the cookie.
// The backend moves the job to DOCUMENTS_VALIDATED by itself when the last required document is approved,
// so the screen always re-reads the job afterwards instead of guessing the new status.

const MAX_REASON = 500; // our own limit. Hamid has not documented one yet.

interface Target {
  jobId: string;
  documentId: string;
}

function invalid(message: string): ApiResult<null> {
  return { ok: false, error: { status: 400, message } };
}

function refresh(jobId: string) {
  revalidatePath('/documents');
  revalidatePath('/documents/review');
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
}

function path({ jobId, documentId }: Target, action: 'approve' | 'reject') {
  return `/admin/doc-review/queue/${encodeURIComponent(jobId)}/documents/${encodeURIComponent(documentId)}/${action}`;
}

export async function approveDocumentAction(target: Target): Promise<ApiResult<null>> {
  if (!target?.jobId || !target?.documentId || target.documentId.startsWith('missing:')) {
    return invalid('This document has not been uploaded yet.');
  }
  const result = await apiFetch<unknown>(path(target, 'approve'), { method: 'POST' });
  if (!result.ok) return result;
  refresh(target.jobId);
  return { ok: true, data: null };
}

export async function rejectDocumentAction(target: Target & { reason: string }): Promise<ApiResult<null>> {
  const reason = String(target?.reason ?? '').trim();
  if (!target?.jobId || !target?.documentId || target.documentId.startsWith('missing:')) {
    return invalid('This document has not been uploaded yet.');
  }
  if (!reason) return invalid('Enter a reason for the forwarder.');
  if (reason.length > MAX_REASON) return invalid(`Keep the reason under ${MAX_REASON} characters.`);
  const result = await apiFetch<unknown>(path(target, 'reject'), { method: 'POST', body: { reason } });
  if (!result.ok) return result;
  refresh(target.jobId);
  return { ok: true, data: null };
}

// For client screens that cannot load on the server themselves (the Documents tab of the job page).
// It still runs on the Next.js server, so the token never reaches the browser.
export async function getJobDocumentsAction(jobId: string): Promise<ApiResult<ReviewJob>> {
  if (!jobId || typeof jobId !== 'string') return invalid('A job is required.') as ApiResult<ReviewJob>;
  return getDocReviewJob(jobId);
}