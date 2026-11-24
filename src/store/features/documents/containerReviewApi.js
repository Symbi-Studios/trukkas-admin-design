import { baseApi } from '../../api/baseApi.js';
import {
  approveReviewDocument,
  getReviewJob,
  listReviewJobs,
  rejectReviewDocument,
  simulateForwarderReplacement,
} from '../../../mock/containerReview.js';

/*
 * Per-container document review.
 *
 * ── PROPOSED CONTRACT (not built yet) ──────────────────────────────────────
 * Every endpoint below reads from src/mock/containerReview.js until the
 * backend exists. To go live, replace each queryFn with a baseQuery call to
 * the path in its comment and keep the response shape.
 *
 * GET  /admin/doc-review/jobs?status=NEEDS_REVIEW|AWAITING_FORWARDER|VALIDATED&search=&page=&limit=
 *   → { jobs: JobSummary[], pagination }
 *   JobSummary = { id, jobNumber, forwarder, jobType, unitKind: 'container'|'rack', unitCount,
 *                  route: { pickup, delivery }, tdoDate: 'YYYY-MM-DD',
 *                  reviewStatus, counts: { total, approved, pending, rejected, resubmitted },
 *                  oldestPendingAt, submittedAt, updatedAt, validatedAt }
 *
 * GET  /admin/doc-review/jobs/:jobId
 *   → JobSummary & { contact, validatedBy, locked, units: Unit[] }
 *   Unit     = { id, label /* container number or rack *\/, kind, documents: Document[] }
 *   Document = { id, type: 'TDO'|'CUSTOMS_GATE_PASS'|'EXIT_NOTE', status: 'PENDING'|'APPROVED'|'REJECTED',
 *                version, fileName, mimeType, sizeBytes, url, uploadedBy, uploadedAt,
 *                reviewedBy, reviewedAt, rejectionReason,
 *                history: PreviousVersion[] /* earlier rejected files, oldest first *\/ }
 *
 * POST /admin/doc-review/jobs/:jobId/documents/:documentId/approve
 * POST /admin/doc-review/jobs/:jobId/documents/:documentId/reject   body { reason }
 *   → { document: Document, job: JobSummary }
 *   409 { code: 'DOCUMENTS_LOCKED' } once the job is validated.
 *   The backend validates the job (and locks its documents) when the last
 *   pending document is approved, and returns reviewStatus: 'VALIDATED'.
 * ───────────────────────────────────────────────────────────────────────────
 */

async function run(task) {
  try {
    return { data: await task() };
  } catch (error) {
    return { error: { status: error.status || 'CUSTOM_ERROR', data: { message: error.message, code: error.code } } };
  }
}

const jobTag = (jobId) => ({ type: 'ContainerReviewJob', id: jobId });

export const containerReviewApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getContainerReviewJobs: builder.query({
      queryFn: () => run(listReviewJobs),
      providesTags: ['ContainerReviewQueue'],
    }),
    // `hint` only feeds the mock for jobs that aren't seeded; the real
    // endpoint takes the job ID alone.
    getContainerReviewJob: builder.query({
      queryFn: ({ jobId, hint }) => run(() => getReviewJob(jobId, hint)),
      serializeQueryArgs: ({ queryArgs }) => queryArgs.jobId,
      providesTags: (_result, _error, { jobId }) => [jobTag(jobId)],
    }),
    approveContainerDocument: builder.mutation({
      queryFn: ({ jobId, documentId }) => run(() => approveReviewDocument(jobId, documentId)),
      invalidatesTags: (_result, _error, { jobId }) => ['ContainerReviewQueue', jobTag(jobId)],
    }),
    rejectContainerDocument: builder.mutation({
      queryFn: ({ jobId, documentId, reason }) => run(() => rejectReviewDocument(jobId, documentId, reason)),
      invalidatesTags: (_result, _error, { jobId }) => ['ContainerReviewQueue', jobTag(jobId)],
    }),
    // Prototype only — stands in for the forwarder's Replace in the mobile app.
    simulateForwarderReplacement: builder.mutation({
      queryFn: ({ jobId, documentId }) => run(() => simulateForwarderReplacement(jobId, documentId)),
      invalidatesTags: (_result, _error, { jobId }) => ['ContainerReviewQueue', jobTag(jobId)],
    }),
  }),
});

export const {
  useGetContainerReviewJobsQuery,
  useGetContainerReviewJobQuery,
  useApproveContainerDocumentMutation,
  useRejectContainerDocumentMutation,
  useSimulateForwarderReplacementMutation,
} = containerReviewApi;
