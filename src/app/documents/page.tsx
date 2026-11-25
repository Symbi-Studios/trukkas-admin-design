import type { Metadata } from 'next';
import { Documents } from '@/screens/Documents';
import { getDocReviewQueue, getDocReviewStats, type QueueTab } from '@/lib/doc-review/data';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Review each container’s TDO, Gate Pass and Exit Note before a job opens to bids.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS: QueueTab[] = ['awaiting', 'rejected', 'missing', 'approved', 'all'];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function whole(value: string | string[] | undefined, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(first(value), 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

// Runs on the Next.js server: filters, search and paging live in the URL and the backend does the work.
export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = first(params.status) as QueueTab;
  const tab: QueueTab = TABS.includes(status) ? status : 'awaiting';
  const search = first(params.search).trim().slice(0, 100);
  const page = whole(params.page, 1, 1, 100000);
  const limit = whole(params.limit, 10, 1, 100);

  const [queue, stats] = await Promise.all([
    getDocReviewQueue({ status: tab, search, page, limit }),
    getDocReviewStats(),
  ]);

  return (
    <Documents
      query={{ tab, search, page, limit }}
      queue={queue.ok ? queue.data : null}
      stats={stats.ok ? stats.data : null}
      error={queue.ok ? null : queue.error.message}
    />
  );
}