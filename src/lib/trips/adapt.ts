import { ARRIVAL_TRIP_STATUSES } from '@/domain/jobStatus';
import { movementLabel } from '@/domain/movement';
import { safeHttpsUrl } from '@/lib/jobs/detail-adapt';
import { adaptCard } from '@/lib/jobs/adapt';
import type { TripStatCardKey, BackendTrip, BackendTripsList, BackendTripStats, TripIssue, TripRow, TripsPage, TripStats } from '@/types/trips';

// Pure functions: backend shape in, screen shape out. No fetching here, so they are easy to test.

const CARD_KEYS: TripStatCardKey[] = ['allTrips', 'assigned', 'inTransit', 'atPickup', 'atDelivery', 'returningContainer', 'delayed'];
const PAYOUT_STATUS: Record<string, string> = { PENDING: 'Pending', PARTIALLY_PAID: 'Partially Paid', COMPLETED: 'Completed', ON_HOLD: 'On Hold', CANCELLED: 'Cancelled' };

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function titleCase(code: string): string {
  return code
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function coordinates(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = num(lat);
  const b = num(lng);
  return a != null && b != null && a >= -90 && a <= 90 && b >= -180 && b <= 180 ? { lat: a, lng: b } : null;
}

function adaptIssue(issue: NonNullable<BackendTrip['issues']>[number], index: number): TripIssue {
  return {
    id: text(issue.id) ?? String(index),
    type: text(issue.type) ? titleCase(text(issue.type) as string) : '—',
    status: text(issue.status) ? titleCase(text(issue.status) as string) : '—',
    description: text(issue.description),
    photoUrls: (issue.photoUrls ?? []).map(safeHttpsUrl).filter((url): url is string => url !== null),
    reportedBy: [text(issue.reportedBy?.name), text(issue.reportedBy?.role) ? titleCase(text(issue.reportedBy?.role) as string) : null].filter(Boolean).join(' · ') || null,
    createdAt: text(issue.createdAt),
    resolvedAt: text(issue.resolvedAt),
  };
}

// The payout is shown only when it really settles this trip's job for this trucking company.
function adaptPayout(dto: BackendTrip): TripRow['payout'] {
  const payout = dto.companyPayout;
  const id = text(payout?.id);
  if (!payout || !id || payout.kind !== 'JOB_SETTLEMENT') return null;
  if (!dto.truckingCompany?.id || payout.payeeId !== dto.truckingCompany.id || !(payout.tripIds ?? []).includes(dto.tripId)) return null;
  return { id, status: PAYOUT_STATUS[payout.status ?? ''] ?? '—', url: `/settlements/detail?id=${encodeURIComponent(id)}` };
}

export function adaptTrip(dto: BackendTrip): TripRow {
  const statusCode = text(dto.status) ?? '';
  const isDelayed = dto.isDelayed === true;
  const segment = text(dto.segmentLabel) ?? (statusCode ? titleCase(statusCode) : '—');
  const status = isDelayed ? 'Delayed' : statusCode === 'COMPLETED' ? 'Delivered' : segment;
  const index = num(dto.currentSegment?.index);
  const total = num(dto.currentSegment?.total);
  const container = text(dto.container?.number) ?? text(dto.containerNumber);
  const containerKind = [text(dto.container?.size), text(dto.container?.type)].filter(Boolean).join(' ');
  const location = dto.currentLocation ?? null;
  // the truck's own GPS first; the trip's location only when it is a GPS fix too
  const truckPosition = coordinates(dto.truck?.lastLatitude, dto.truck?.lastLongitude);
  const position = truckPosition ?? (location?.source === 'LIVE_GPS' || location?.source === 'GPS' ? coordinates(location.latitude, location.longitude) : null);
  const positionUpdatedAt = position ? (truckPosition ? text(dto.truck?.lastLocationUpdate) : text(location?.updatedAt)) : null;
  const progress = num(dto.progressPercent);
  const terminal = statusCode === 'COMPLETED' || statusCode === 'CANCELLED';
  const driver = dto.driver ?? null;

  return {
    id: String(dto.tripId),
    jobId: text(dto.jobId),
    jobNumber: text(dto.jobNumber) ?? text(dto.jobId) ?? '—',
    container: container ? `${container}${containerKind ? ` (${containerKind})` : ''}` : 'No container',
    origin: text(dto.origin),
    destination: text(dto.destination),
    movement: text(dto.tripType?.code) || text(dto.tripType?.label) ? movementLabel(text(dto.tripType?.code), dto.tripType?.label) : null,
    driverId: text(driver?.id),
    driverName: text(driver?.name),
    driverPhone: text(driver?.phone),
    driverAvatarUrl: safeHttpsUrl(driver?.avatarUrl),
    isOwnerDriver: driver?.isOwnerDriver === true,
    truckingCompany: text(dto.truckingCompany?.name),
    truckPlate: text(dto.truck?.plateNumber),
    statusCode,
    status,
    stage: index != null && total != null && index > 0 && total >= index ? `${text(dto.currentSegment?.label) ?? segment} (${index} of ${total})` : segment,
    progress: progress != null && progress >= 0 && progress <= 100 ? progress : null,
    eta: text(dto.eta),
    distanceLeftKm: num(dto.distance?.remainingKm),
    isDelayed,
    delayReason: text(dto.delayReason),
    canMarkDelayed: Boolean(statusCode) && !terminal,
    canMarkAtDelivery: ARRIVAL_TRIP_STATUSES.has(statusCode),
    position,
    positionUpdatedAt,
    locationDescription: text(location?.description),
    live: dto.telemetryLive === true && position !== null && !terminal,
    payout: adaptPayout(dto),
    issues: (dto.issues ?? []).map(adaptIssue),
  };
}

export function adaptTripsPage(dto: BackendTripsList, asked: { page: number; limit: number }): TripsPage {
  const trips = (Array.isArray(dto?.trips) ? dto.trips : []).filter((row) => row && row.tripId != null).map(adaptTrip);
  const pagination = dto?.pagination ?? {};
  const limit = num(pagination.limit) ?? asked.limit;
  const total = num(pagination.total) ?? trips.length;
  return {
    trips,
    pagination: {
      page: num(pagination.page) ?? asked.page,
      limit,
      total,
      totalPages: num(pagination.totalPages) ?? (limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1),
    },
  };
}

export function adaptTripStats(dto: BackendTripStats): TripStats {
  const cards = Object.fromEntries(CARD_KEYS.map((key) => [key, adaptCard(dto?.cards?.[key])])) as TripStats['cards'];
  return { cards };
}
