import { toDateRange } from '@/lib/dateRange';
import type { JobsFilters, JobsQuery } from '@/types/jobs';

// Turns the filters in the page URL into what the backend list and export endpoints accept.
// Used by the Jobs page and by the export action, so the two can never disagree.

export function toJobsQuery(filters: JobsFilters): JobsQuery {
  return {
    status: filters.tab === 'all' ? undefined : filters.tab,
    search: filters.search || undefined,
    movementType: filters.type || undefined,
    cargoType: filters.cargoKind || undefined,
    pickupPortId: filters.port || undefined,
    ...toDateRange(filters),
  };
}
