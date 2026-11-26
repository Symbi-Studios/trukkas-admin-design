import { cargoKindLabel } from '@/domain/cargo';
import { movementLabel } from '@/domain/movement';
import { safeHttpsUrl } from './detail-adapt';
import type {
  BackendPorts,
  BackendDocSummary,
  BackendTripsList,
  DocCounts,
  DrawerTrip,
  BackendJobRow,
  BackendJobsList,
  BackendJobStats,
  JobRow,
  JobsPage,
  JobStatCard,
  JobStatCardKey,
  JobStats,
  JobTab,
  PortOption,
} from '@/types/jobs';

// Pure functions: backend shape in, screen shape out. No fetching here, so they are easy to test.

const DELIVERABLE = new Set(['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'PICKUP_COMPLETED', 'IN_TRANSIT', 'CONTAINER_RETURNED']);
const CARD_KEYS: JobStatCardKey[] = ['totalJobs', 'pendingApproval', 'inTransit', 'delivered', 'cancelled'];
const TAB_KEYS: ('all' | JobTab)[] = ['all', 'pendingApproval', 'bidding', 'assigned', 'inTransit', 'delivered', 'cancelled', 'flagged', 'rejected'];

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

export function adaptJobRow(row: BackendJobRow): JobRow {
  const statusCode = row.status ?? '';
  const status = text(row.stageLabel) ?? text(row.statusLabel) ?? (statusCode ? titleCase(statusCode) : '—');
  const health = text(row.statusLabel);
  const movement = row.movementType ?? null;
  const cargo = row.cargo ?? null;
  const assignment = row.assignment ?? null;
  const itemCount = num(row.itemCount);
  const containerCount = num(cargo?.containerCount);
  const reviewFlag = row.reviewFlag ?? null;

  return {
    id: String(row.id),
    jobNumber: text(row.jobNumber) ?? String(row.id),
    statusCode,
    stage: text(row.stage) ?? '',
    status,
    health: health && health !== status ? health : null,
    forwarder: text(row.company?.name) ?? text(row.forwarderName) ?? '—',
    forwarderId: text(row.company?.id),
    contactName: text(row.requester?.name),
    contactEmail: text(row.requester?.email),
    contactPhone: text(row.requester?.phone),
    contactAvatarUrl: text(row.requester?.avatarUrl),
    movement: movementLabel(text(movement?.code), movement?.label),
    movementCode: text(movement?.code),
    origin: text(row.origin),
    destination: text(row.destination),
    cargo: text(cargo?.label) ?? text(cargo?.description) ?? text(cargo?.containerSummary) ?? '—',
    cargoKind: cargoKindLabel(text(row.cargoType?.code), text(row.cargoType?.label)),
    cargoDescription: text(cargo?.description) ?? text(cargo?.label),
    requiredTrucks: num(row.requiredTrucks),
    unitKind: row.itemKind ? (row.itemKind === 'RACK' ? 'rack' : 'container') : null,
    unitCount: itemCount ?? (containerCount ? containerCount : null),
    jobValue: num(row.pricing?.totalPrice),
    agreedPrice: num(row.pricing?.agreedPrice),
    assignedTrips: num(assignment?.assignedTrips),
    totalTrips: num(assignment?.totalTrips),
    truckingCompany: text(assignment?.assignee?.name) ?? text(row.truckerName),
    truckingCompanyAvatarUrl: safeHttpsUrl(assignment?.assignee?.avatarUrl),
    createdAt: text(row.createdAt),
    expectedDelivery: text(row.estimatedDeliveryAt),
    deadline: text(row.deadline),
    freeDays: num(row.freeDays),
    timeline: (row.timeline ?? []).map((event) => ({
      title: text(event.label) ?? 'Update',
      at: text(event.at),
      done: event.completed === true,
    })),
    flagged: reviewFlag != null,
    flagReason: text(reviewFlag?.reason),
    canReviewDocs: statusCode === 'DOC_REVIEW',
    canMarkDelivered: DELIVERABLE.has(statusCode),
    canCancel: Boolean(statusCode) && !['COMPLETED', 'CANCELLED'].includes(statusCode),
  };
}

export function adaptJobsPage(dto: BackendJobsList, asked: { page: number; limit: number }): JobsPage {
  const jobs = (Array.isArray(dto?.jobs) ? dto.jobs : []).filter((row) => row && row.id != null).map(adaptJobRow);
  const pagination = dto?.pagination ?? {};
  const limit = num(pagination.limit) ?? asked.limit;
  const total = num(pagination.total) ?? jobs.length;
  return {
    jobs,
    pagination: {
      page: num(pagination.page) ?? asked.page,
      limit,
      total,
      totalPages: num(pagination.totalPages) ?? (limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1),
    },
  };
}

function adaptCard(card: { value?: number | null; changePercent?: number | null; trend?: string | null } | undefined): JobStatCard {
  const trend = card?.trend;
  return {
    value: num(card?.value),
    changePercent: num(card?.changePercent),
    trend: trend === 'UP' || trend === 'DOWN' || trend === 'FLAT' ? trend : null,
  };
}

export function adaptJobStats(dto: BackendJobStats): JobStats {
  const cards = Object.fromEntries(CARD_KEYS.map((key) => [key, adaptCard(dto?.cards?.[key])])) as Record<JobStatCardKey, JobStatCard>;
  const tabs = Object.fromEntries(TAB_KEYS.map((key) => [key, num(dto?.tabs?.[key])])) as JobStats['tabs'];
  return { cards, tabs };
}

/** The active ports, the same ones the app offers (the backend list also has inactive ones) */
export function adaptPorts(dto: BackendPorts): PortOption[] {
  return (Array.isArray(dto?.ports) ? dto.ports : [])
    .filter((port) => port && port.isActive === true)
    .flatMap((port) => {
      const id = text(port.id);
      const name = text(port.name);
      return id && name ? [{ id, name }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function adaptDrawerTrips(dto: BackendTripsList, jobId: string): DrawerTrip[] {
  return (Array.isArray(dto?.trips) ? dto.trips : [])
    .filter((trip) => trip && trip.jobId === jobId)
    .map((trip) => ({
      id: String(trip.tripId),
      status: trip.isDelayed === true ? 'Delayed' : text(trip.segmentLabel) ?? (text(trip.status) ? titleCase(trip.status as string) : '—'),
      driverName: text(trip.driver?.name) ?? text(trip.driverName),
      driverPhone: text(trip.driver?.phone),
      driverAvatarUrl: safeHttpsUrl(trip.driver?.avatarUrl),
      isOwnerDriver: trip.driver?.isOwnerDriver === true,
      truckPlate: text(trip.truck?.plateNumber),
    }));
}

export function adaptDocCounts(summary: BackendDocSummary | null | undefined): DocCounts | null {
  const total = num(summary?.total);
  if (total == null) return null;
  return { total, approved: num(summary?.approved), pending: num(summary?.pending), rejected: num(summary?.rejected) };
}
