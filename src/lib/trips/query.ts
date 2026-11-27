import { toDateRange } from '@/lib/dateRange';
import type { TripsFilters, TripsQuery } from '@/types/trips';

// Turns the filters in the page URL into what the backend list and export endpoints accept.
// Used by the Trips page and by the export action, so the two can never disagree.

export function toTripsQuery(filters: TripsFilters): TripsQuery {
  return {
    statusFilter: filters.tab === 'all' ? undefined : filters.tab,
    search: filters.search || undefined,
    tripType: filters.type || undefined,
    cargoType: filters.cargoKind || undefined,
    pickupPortId: filters.port || undefined,
    ...toDateRange(filters),
  };
}
