import type { Metadata } from 'next';
import { getDocReviewJob, getDocReviewQueue } from '@/lib/doc-review/data';
import DocumentReview from '@/screens/DocumentReview';

export const metadata: Metadata = {
  title: 'Review Documents',
  description: 'Review a job’s documents container by container.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

// Runs on the Next.js server: the job and the next job to review are fetched here, not in the browser.
export default async function DocumentReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const jobId = first(params.jobId);
  const requestedDoc = first(params.doc) || null;
  if (!jobId) return <DocumentReview job={null} error={null} jobId="" requestedDoc={null} nextJob={null} />;

  const [jobResult, queueResult] = await Promise.all([
    getDocReviewJob(jobId),
    getDocReviewQueue({ status: 'awaiting', limit: 5 }),
  ]);
  const next = queueResult.ok ? queueResult.data.jobs.find((entry) => entry.id !== jobId) : null;

  return (
    <DocumentReview
      jobId={jobId}
      requestedDoc={requestedDoc}
      job={jobResult.ok ? jobResult.data : null}
      error={jobResult.ok ? null : jobResult.error}
      nextJob={next ? { id: next.id, jobNumber: next.jobNumber } : null}
    />
  );
}