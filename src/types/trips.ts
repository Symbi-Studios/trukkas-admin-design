import type { BackendPagination, JobStatCard } from './jobs';
import type { TripTab } from '@/domain/tripStatus';

// What the backend sends for GET /admin/trips, /admin/trips/{id} and /admin/trips/stats,
// and what the Trips screen receives after the adapter (lib/trips/adapt.ts).

export interface BackendTrip {
  tripId: string;
  jobId?: string | null;
  jobNumber?: string | null;
  containerNumber?: string | null;
  container?: { number?: string | null; size?: string | null; type?: string | null } | null;
  origin?: string | null;
  destination?: string | null;
  /** the movement of the job: { code: PORT_TO_DESTINATION | PORT_TO_PORT, label } */
  tripType?: { code?: string | null; label?: string | null } | null;
  driver?: { id?: string | null; name?: string | null; phone?: string | null; avatarUrl?: string | null; isOwnerDriver?: boolean | null } | null;
  truckingCompany?: { id?: string | null; name?: string | null } | null;
  truck?: { plateNumber?: string | null; lastLatitude?: number | null; lastLongitude?: number | null; lastLocationUpdate?: string | null } | null;
  status?: string | null;
  segmentLabel?: string | null;
  currentSegment?: { index?: number | null; total?: number | null; label?: string | null } | null;
  isDelayed?: boolean | null;
  delayReason?: string | null;
  progressPercent?: number | null;
  eta?: string | null;
  distance?: { remainingKm?: number | null } | null;
  telemetryLive?: boolean | null;
  currentLocation?: { source?: string | null; description?: string | null; latitude?: number | null; longitude?: number | null; updatedAt?: string | null } | null;
  issues?: {
    id?: string | null;
    type?: string | null;
    status?: string | null;
    description?: string | null;
    photoUrls?: string[] | null;
    reportedBy?: { name?: string | null; role?: string | null } | null;
    createdAt?: string | null;
    resolvedAt?: string | null;
  }[] | null;
  companyPayout?: { id?: string | null; kind?: string | null; status?: string | null; payeeId?: string | null; tripIds?: string[] | null } | null;
}

export interface BackendTripsList {
  trips: BackendTrip[];
  pagination?: Partial<BackendPagination> | null;
}

export interface BackendTripStats {
  period?: { from?: string; to?: string; comparedToFrom?: string; comparedToTo?: string } | null;
  cards?: Record<string, { value?: number | null; changePercent?: number | null; trend?: string | null } | undefined> | null;
}

// ---------- what the screen gets ----------

export interface TripIssue {
  id: string;
  type: string;
  status: string;
  description: string | null;
  photoUrls: string[];
  reportedBy: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export interface TripRow {
  id: string;
  jobId: string | null;
  jobNumber: string;
  /** "MSKU1234567 (40ft High Cube)" or "No container" */
  container: string;
  origin: string | null;
  destination: string | null;
  /** "Port-to-Destination", "Port-to-Port" */
  movement: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverAvatarUrl: string | null;
  /** the trucker drives their own truck, so there is no separate driver */
  isOwnerDriver: boolean;
  truckingCompany: string | null;
  truckPlate: string | null;
  statusCode: string;
  /** "Assigned", "In Transit", "Delayed", "Delivered" ... */
  status: string;
  /** "In Transit (2 of 4)" */
  stage: string;
  progress: number | null;
  eta: string | null;
  distanceLeftKm: number | null;
  isDelayed: boolean;
  delayReason: string | null;
  canMarkDelayed: boolean;
  canMarkAtDelivery: boolean;
  /** the truck's last known position */
  position: { lat: number; lng: number } | null;
  positionUpdatedAt: string | null;
  locationDescription: string | null;
  /** the driver app is sending GPS right now */
  live: boolean;
  payout: { id: string; status: string; url: string } | null;
  issues: TripIssue[];
}

export interface TripsPage {
  trips: TripRow[];
  pagination: BackendPagination;
}

export type TripStatCardKey = 'allTrips' | 'assigned' | 'inTransit' | 'atPickup' | 'atDelivery' | 'returningContainer' | 'delayed';

export interface TripStats {
  cards: Record<TripStatCardKey, JobStatCard>;
}

/** The filters as they live in the page URL. They are the same as on Jobs, with the trip statuses as the Status filter. */
export interface TripsFilters {
  tab: TripTab | 'all';
  /** a movement code (PORT_TO_DESTINATION | PORT_TO_PORT), or "" for all */
  type: string;
  /** CONTAINER | BULK_BREAK, or "" for all */
  cargoKind: string;
  /** a pickup port id, or "" for all */
  port: string;
  /** Lagos calendar days, YYYY-MM-DD, or "" */
  from: string;
  to: string;
  period: string;
  search: string;
}

/** What GET /admin/trips accepts */
export interface TripsQuery {
  statusFilter?: TripTab;
  search?: string;
  tripType?: string;
  cargoType?: string;
  pickupPortId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
