import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JobDetail } from '@/screens/JobDetail';
import { isJobDetailTab } from '@/domain/jobDetailTabs';
import { getAdmin } from '@/lib/auth/session';
import { getJobDetail } from '@/lib/jobs/detail-data';

export const metadata: Metadata = {
  title: 'Job details',
  description: 'Everything about one job: cargo, people, bids, trips, documents and money.',
};

type Params = Promise<{ jobId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

// The Next.js server loads the job (detail, documents, bids, trips, payments) in one go and hands it to the screen.
// ?tab=documents and ?tripId=... open a tab or a trip directly.
export default async function JobDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { jobId } = await params;
  const raw = await searchParams;
  const [result, admin] = await Promise.all([getJobDetail(decodeURIComponent(jobId)), getAdmin()]);
  if (!result.ok && result.error.status === 404) notFound();

  const tab = first(raw.tab);
  const tripId = first(raw.tripId);
  return (
    <JobDetail
      detail={result.ok ? result.data : null}
      error={result.ok ? null : result.error.message}
      role={admin?.role ?? null}
      initialTab={isJobDetailTab(tab) ? tab : tripId ? 'tracking' : 'overview'}
      initialTripId={tripId || null}
    />
  );
}