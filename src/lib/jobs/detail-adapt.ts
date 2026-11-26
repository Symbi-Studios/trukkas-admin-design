import { cargoKindLabel } from '@/domain/cargo';
import { movementLabel } from '@/domain/movement';
import { ACTIVE_TRIP_STATUSES, ARRIVAL_TRIP_STATUSES, STATUS_LABELS, TERMINAL_JOB_STATUSES } from '@/domain/jobStatus';
import type { ReviewJob } from '@/types/docReview';
import type {
  ActivityEntry,
  BackendBid,
  BackendPayment,
  BackendTracking,
  BackendTripFull,
  JobBid,
  MapPoint,
  TripPosition,
  JobDetailData,
  JobTransaction,
  JobTrip,
  TrackingUpdate,
  TripDetail,
  TripPhoto,
  BackendDetailContainer,
  BackendDetailRack,
  BackendItemAssignment,
  DetailAssignment,
  BackendJobDetailDto,
  DetailCancellation,
  DetailContainer,
  DetailDriver,
  DetailRack,
  DetailVehicle,
  JobDetailExtras,
} from '@/types/jobDetail';

// Pure functions: the job detail response (plus the job's row in the list) in, display values out.
// A missing text becomes "—" and a missing number becomes null, so the screen never shows a made-up value.

const DASH = '—';

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function shown(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value) ?? DASH;
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function money(value: unknown): number | null {
  const n = num(value);
  return n !== null && n >= 0 ? n : null;
}

/** "12.5 t" for a weight the backend sends in tonnes; text it sends is shown as it is */
function tonnes(value: unknown): string {
  const n = num(value);
  return typeof value === 'number' && n !== null && n >= 0 ? `${n} t` : shown(value);
}

/** 150 -> "2 h 30 min" */
function durationLabel(minutes: unknown): string {
  const n = num(minutes);
  if (n === null || n <= 0) return DASH;
  const hours = Math.floor(n / 60);
  const rest = Math.round(n % 60);
  return hours ? (rest ? `${hours} h ${rest} min` : `${hours} h`) : `${rest} min`;
}

function count(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** "30 Dec 2027, 23:59" in Lagos time, or "—" */
export function formatDateTime(value: unknown): string {
  const iso = text(value);
  if (!iso || !ISO.test(iso) || !Number.isFinite(Date.parse(iso))) return DASH;
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Only https links are ever opened from the admin */
export function safeHttpsUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function adaptAssignment(a: BackendItemAssignment | null | undefined): DetailAssignment | null {
  const driverName = text(a?.driverName);
  return a && driverName ? { driverName, plate: shown(a.plateNumber) } : null;
}

function adaptContainer(c: BackendDetailContainer, index: number): DetailContainer {
  return {
    id: text(c.id) ?? `c${index}`,
    number: shown(c.number ?? c.containerNumber),
    size: shown(c.size),
    type: shown(c.type),
    weight: c.weightTonnes != null ? tonnes(c.weightTonnes) : shown(c.cargoWeight ?? c.goodsTonnage),
    assignment: adaptAssignment(c.assignment),
  };
}

function adaptRack(r: BackendDetailRack, index: number): DetailRack {
  const truckType = typeof r.truckType === 'string' ? r.truckType : r.truckType?.name;
  return {
    id: text(r.id) ?? `r${index}`,
    number: shown(r.rackNumber ?? r.number),
    truckType: shown(truckType),
    weight: r.weightTonnes != null ? tonnes(r.weightTonnes) : shown(r.weight),
    assignment: adaptAssignment(r.assignment),
    photoUrl: safeHttpsUrl(r.cargoPhotoUrl),
  };
}

/** The cancel reason and time are the job's own fields; who cancelled is only in the activity log. */
function adaptCancellation(dto: BackendJobDetailDto): DetailCancellation | null {
  if (dto.status !== 'CANCELLED') return null;
  const entry = (dto.activityLog ?? []).find((item) => item?.action === 'CANCELLED_JOB');
  return {
    reason: text(dto.cancellation?.reason) ?? text(dto.cancellationReason),
    by: text(entry?.actor?.name),
    at: formatDateTime(dto.cancellation?.at ?? entry?.at),
  };
}

/** The job's cargo photos that do not belong to a rack, https only, without repeats */
function adaptCargoPhotos(dto: BackendJobDetailDto): string[] {
  const owned = new Set((dto.racks ?? []).flatMap((item) => safeHttpsUrl(item?.cargoPhotoUrl) ?? []));
  const urls = [dto.cargoPhotoUrl, ...(dto.cargoPhotoUrls ?? [])].flatMap((url) => safeHttpsUrl(url) ?? []);
  return [...new Set(urls)].filter((url) => !owned.has(url));
}

export function adaptJobDetailExtras(dto: BackendJobDetailDto): JobDetailExtras {
  const movement = dto.movementType ?? null;
  const cargoType = dto.cargoType ?? null;
  const code = text(movement?.code);
  const pricing = dto.pricing ?? {};
  const forwarder = dto.forwarder ?? {};
  const trucker = dto.trucker ?? {};
  const driver = dto.driver ?? null;
  const vehicle = dto.vehicle ?? null;

  const adaptedDriver: DetailDriver | null = driver && text(driver.id) ? {
    id: String(driver.id),
    name: shown(driver.name),
    avatarUrl: safeHttpsUrl(driver.avatarUrl),
    phone: shown(driver.phone),
    email: shown(driver.email),
    trustScore: num(driver.trustScore),
    licenseNumber: shown(driver.license?.number),
    licenseExpiry: formatDateTime(driver.license?.expiresAt),
  } : null;

  const adaptedVehicle: DetailVehicle | null = vehicle && text(vehicle.id) ? {
    id: String(vehicle.id),
    plate: shown(vehicle.plateNumber),
    make: shown(vehicle.make),
    model: shown(vehicle.model),
    year: shown(vehicle.year),
    color: shown(vehicle.color),
  } : null;

  return {
    requestType: movementLabel(code, movement?.label),
    movementCode: code,
    cargoKind: cargoKindLabel(text(cargoType?.code), text(cargoType?.label)) ?? DASH,
    containers: (dto.containers ?? []).filter(Boolean).map(adaptContainer),
    racks: (dto.racks ?? []).filter(Boolean).map(adaptRack),
    cargoPhotoUrls: adaptCargoPhotos(dto),
    returnAddress: shown(dto.containerReturnAddress),
    specialInstructions: shown(dto.specialInstructions),
    totalWeight: tonnes(dto.totalWeight),
    requiredTrucks: count(dto.requiredTrucks),
    pickupDate: formatDateTime(dto.pickupDate),
    deliveryDate: formatDateTime(dto.deliveryDate),
    durationLabel: durationLabel(dto.estimatedDurationMinutes),
    estimatedDistanceKm: money(dto.distanceKm),
    tdoDate: formatDateTime(dto.tdoDate),
    freeDays: count(dto.freeDays),
    deadline: formatDateTime(dto.deadline),
    expectedDelivery: formatDateTime(dto.estimatedDeliveryAt ?? dto.deliveryDate),
    forwarderEmail: shown(forwarder.email),
    forwarderBusiness: shown(forwarder.businessName),
    truckerEmail: shown(trucker.email),
    truckerPhone: shown(trucker.phone),
    truckerAvatarUrl: safeHttpsUrl(trucker.avatarUrl),
    truckerType: titleCase(trucker.truckerType),
    truckerIsOwnerDriver: trucker.isOwnerDriver === true,
    driver: adaptedDriver,
    vehicle: adaptedVehicle,
    baseDelivery: money(pricing.baseDelivery),
    demurrage: money(pricing.demurrage),
    terminalHandling: money(pricing.terminalHandling),
    vat: money(pricing.vat),
    vatLabel: text(pricing.vatLabel),
    forwarderTotal: money(pricing.forwarderTotal),
    mobilizationAmount: money(pricing.mobilizationAmount),
    mobilizationPercent: money(pricing.mobilizationPercent),
    mobilizationPaid: text(pricing.mobilizationPaid),
    escrowStatus: text(pricing.escrowStatus),
    paymentReference: text(pricing.paymentReference),
    paidAt: formatDateTime(pricing.paidAt),
    cancellation: adaptCancellation(dto),
  };
}


// ---------- the whole screen ----------

/** "OFFLOAD_COMPLETED" -> "Offload Completed" */
function titleCase(value: unknown): string {
  const raw = text(value);
  if (!raw) return DASH;
  return raw.toLowerCase().split(/[_\s]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export function adaptBid(bid: BackendBid): JobBid {
  return {
    id: bid.id,
    company: shown(bid.truckerName),
    amount: num(bid.amount),
    status: titleCase(bid.status),
    statusCode: text(bid.status),
    isCounterOffer: typeof bid.isCounterOffer === 'boolean' ? bid.isCounterOffer : null,
    accepted: bid.status === 'ACCEPTED',
    submittedAt: formatDateTime(bid.createdAt),
  };
}

function coordinate(value: unknown, limit: number): number | null {
  const n = num(value);
  return n !== null && Math.abs(n) <= limit ? n : null;
}

/** The truck's position: the trip's current location, else the last position saved on the truck */
function adaptPosition(trip: BackendTripFull): TripPosition | null {
  const lat = coordinate(trip.currentLocation?.latitude, 90) ?? coordinate(trip.truck?.lastLatitude, 90);
  const lng = coordinate(trip.currentLocation?.longitude, 180) ?? coordinate(trip.truck?.lastLongitude, 180);
  if (lat === null || lng === null) return null;
  const heading = num(trip.heading);
  return {
    lat,
    lng,
    heading: heading !== null && heading >= 0 && heading <= 360 ? heading : null,
    updatedAt: formatDateTime(trip.currentLocation?.updatedAt ?? trip.truck?.lastLocationUpdate),
    description: shown(trip.currentLocation?.description),
  };
}

/** The recorded GPS trail of one job, oldest point first. Null when there are fewer than two points. */
export function adaptRoute(dto: BackendTracking, jobId: string): MapPoint[] | null {
  const points = (dto?.routes ?? [])
    .filter((route) => route?.jobId === jobId)
    .flatMap((route) => route.points ?? [])
    .sort((a, b) => String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? '')))
    .flatMap((p) => {
      const lat = coordinate(p.latitude, 90);
      const lng = coordinate(p.longitude, 180);
      return lat !== null && lng !== null ? [{ lat, lng }] : [];
    });
  return points.length >= 2 ? points : null;
}

export function adaptTrip(trip: BackendTripFull): JobTrip {
  const status = text(trip.status);
  const progress = num(trip.progressPercent);
  const live = trip.telemetryLive === true && trip.currentLocation?.source === 'LIVE_GPS';
  return {
    id: trip.tripId,
    statusCode: status,
    status: trip.isDelayed === true ? 'Delayed' : text(trip.segmentLabel) ?? titleCase(status),
    containerNumber: shown(trip.container?.number ?? trip.containerNumber),
    route: shown(trip.route),
    truckPlate: shown(trip.truck?.plateNumber),
    truckId: text(trip.truck?.id),
    driverName: text(trip.driver?.name) ?? text(trip.driverName),
    driverPhone: shown(trip.driver?.phone),
    driverAvatarUrl: safeHttpsUrl(trip.driver?.avatarUrl),
    truckingCompany: shown(trip.truckingCompany?.name),
    progress: progress !== null && progress >= 0 && progress <= 100 ? progress : null,
    eta: formatDateTime(trip.eta),
    deliveryDate: formatDateTime(trip.dates?.deliveredAt),
    distanceKm: money(trip.distance?.totalKm),
    coveredKm: money(trip.distance?.coveredKm),
    speedKmH: live ? money(trip.speedKmH) : null,
    live,
    currentLocation: shown(trip.currentLocation?.description),
    locationUpdatedAt: formatDateTime(trip.currentLocation?.updatedAt),
    position: adaptPosition(trip),
    canMarkAtDelivery: status !== null && ARRIVAL_TRIP_STATUSES.has(status),
    canMarkDelayed: status !== null && !TERMINAL_JOB_STATUSES.has(status),
  };
}

/** One trip with its recorded steps (newest first) and the photos drivers attached to issues */
export function adaptTripDetail(dto: BackendTripFull, route: MapPoint[] | null): TripDetail {
  const updates: TrackingUpdate[] = (dto.milestones ?? [])
    .filter((m) => m && formatDateTime(m.at) !== DASH)
    .map((m) => ({ time: formatDateTime(m.at), status: shown(m.label) }))
    .reverse();
  const photos: TripPhoto[] = (dto.issues ?? []).flatMap((issue) =>
    (issue?.photoUrls ?? []).flatMap((url) => {
      const safe = safeHttpsUrl(url);
      return safe ? [{ url: safe, label: shown(issue.description) }] : [];
    }));
  return { trip: adaptTrip(dto), updates, photos, route };
}

export function adaptTransaction(payment: BackendPayment): JobTransaction {
  const amount = num(payment.amount);
  return {
    id: payment.id,
    date: formatDateTime(payment.createdAt),
    description: shown(payment.description),
    status: titleCase(payment.status),
    reference: shown(payment.reference),
    amount: amount === null ? null : payment.direction === 'inflow' ? amount : payment.direction === 'outflow' ? -amount : null,
    type: text(payment.type),
    statusCode: text(payment.status),
  };
}

function adaptActivity(dto: BackendJobDetailDto): ActivityEntry[] {
  return (dto.activityLog ?? []).filter(Boolean).map((entry, index) => ({
    id: `${dto.id}:activity:${index}`,
    time: formatDateTime(entry.at),
    user: shown(entry.actor?.name),
    actorId: text(entry.actor?.id),
    role: titleCase(entry.actor?.type),
    action: titleCase(entry.action),
    details: shown(entry.description),
  }));
}

interface DetailSources {
  dto: BackendJobDetailDto;
  review: ReviewJob | null;
  /** how many documents the review says were rejected (a draft with rejected documents is "Rejected") */
  rejectedDocuments: number;
  bids: BackendBid[] | null;
  trips: BackendTripFull[] | null;
  payments: BackendPayment[] | null;
  warnings: string[];
}

export function adaptJobDetail({ dto, review, rejectedDocuments, bids, trips, payments, warnings }: DetailSources): JobDetailData {
  const statusCode = text(dto.status) ?? '';
  const rejected = statusCode === 'DRAFT' && (rejectedDocuments > 0 || dto.documents?.approvalStatus === 'Rejected');
  const pricing = dto.pricing ?? {};
  const extras = adaptJobDetailExtras(dto);

  const myTrips = trips ? trips.filter((t) => t.jobId === dto.id).map(adaptTrip) : null;
  const myBids = bids ? bids.filter((b) => b.jobId === dto.id).map(adaptBid) : null;
  const myPayments = payments
    ? payments.filter((p) => p.jobId === dto.id || p.jobId === dto.jobNumber || (p.relatedKind === 'JOB' && p.relatedTo?.id === dto.id)).map(adaptTransaction)
    : null;

  // Distinct trucks that are on this job. "Unknown" when a trip has no truck yet.
  const assignedTrucks = myTrips === null ? null : myTrips.length === 0 ? 0
    : myTrips.every((t) => t.truckId) ? new Set(myTrips.map((t) => t.truckId)).size : null;
  const distances = (trips ?? []).filter((t) => t.jobId === dto.id).map((t) => money(t.distance?.totalKm));
  const distanceKm = distances.length && distances.every((d) => d !== null && d === distances[0]) ? distances[0] : null;

  const stageTimeline = dto.timeline ?? [];
  const milestone = (key: string): string | null => {
    const at = stageTimeline.find((t) => t.key === key && t.completed === true)?.at;
    const shownAt = formatDateTime(at);
    return shownAt === DASH ? null : shownAt;
  };

  const activity = adaptActivity(dto);
  const everyoneKnown = activity.every((a) => a.actorId || a.role === 'System');
  const peopleCount = new Set(activity.filter((a) => a.actorId).map((a) => `${a.role}:${a.actorId}`)).size;
  const frequency = new Map<string, { count: number; user: string }>();
  for (const a of activity) {
    if (!a.actorId) continue;
    const key = `${a.role}:${a.actorId}`;
    const current = frequency.get(key) ?? { count: 0, user: a.user };
    frequency.set(key, { count: current.count + 1, user: current.user });
  }
  const busiest = [...frequency.values()].sort((a, b) => b.count - a.count)[0];

  return {
    id: dto.id,
    jobNumber: shown(dto.jobNumber ?? dto.id),
    statusCode,
    status: rejected ? 'Rejected' : STATUS_LABELS[statusCode] ?? (statusCode === 'DRAFT' ? 'Draft' : DASH),
    version: text(dto.version),
    adminActions: {
      canEdit: dto.adminActions?.canEdit === true,
      canMarkInTransit: dto.adminActions?.canMarkInTransit === true,
      canMarkDelivered: dto.adminActions?.canMarkDelivered === true,
      canDuplicate: dto.adminActions?.canDuplicate === true,
    },
    reviewFlag: dto.reviewFlag ? { reason: text(dto.reviewFlag.reason), version: text(dto.reviewFlag.version) } : null,
    createdAt: formatDateTime(dto.createdAt ?? review?.submittedAt ?? stageTimeline.find((t) => t.key === 'created')?.at),
    updatedAt: formatDateTime(dto.updatedAt ?? dto.updatedAt),
    forwarderId: text(dto.forwarder?.id),
    forwarder: shown(dto.forwarder?.name),
    contactPerson: text(dto.requester?.name) ?? shown(dto.forwarder?.name),
    contactPhone: shown(dto.requester?.phone),
    truckingCompany: text(dto.trucker?.name),
    cargo: text(dto.cargo?.label) ?? text(dto.cargoContents) ?? DASH,
    cargoDetails: text(dto.cargoContents) ?? text(dto.cargo?.description) ?? DASH,
    origin: text(dto.origin) ?? shown(dto.pickup?.address),
    destination: text(dto.destination) ?? shown(dto.delivery?.address),
    jobValue: money(pricing.totalPrice),
    agreedPrice: money(pricing.agreedPrice),
    platformFeePct: num(pricing.commissionPercent),
    platformFee: num(pricing.platformFee),
    finalPayoutStatus: text(pricing.finalPayoutStatus),
    assignedTrips: count(dto.assignment?.assignedTrips),
    tripCounts: {
      required: extras.requiredTrucks,
      assigned: assignedTrucks,
      total: count(dto.assignment?.totalTrips),
      active: myTrips ? myTrips.filter((t) => t.statusCode !== null && ACTIVE_TRIP_STATUSES.has(t.statusCode)).length : null,
      completed: myTrips ? myTrips.filter((t) => t.statusCode === 'COMPLETED').length : null,
    },
    distanceKm,
    stageDates: [milestone('created'), null, milestone('docsApproved'), milestone('assigned'), milestone('inTransit'), milestone('delivery')],
    bids: myBids,
    trips: myTrips,
    transactions: myPayments,
    activity,
    uniqueActivityUsers: everyoneKnown ? peopleCount : null,
    mostActiveUser: everyoneKnown ? busiest?.user ?? DASH : DASH,
    milestones: (dto.timeline ?? []).filter(Boolean).map((item) => ({ time: formatDateTime(item.at ?? item.timestamp), status: shown(item.label ?? item.event) })),
    review,
    warnings,
    extras,
  };
}
