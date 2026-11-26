import { redirect } from 'next/navigation';

// The old address was /jobs/detail?id=<job>. Links in screens that have not been converted yet still use it.
// Delete this file once `grep -rn "jobs/detail" src` finds nothing else.
export default async function OldJobDetailRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const id = Array.isArray(raw.id) ? raw.id[0] : raw.id;
  const tripId = Array.isArray(raw.tripId) ? raw.tripId[0] : raw.tripId;
  redirect(id ? `/jobs/${encodeURIComponent(id)}${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ''}` : '/jobs');
}
