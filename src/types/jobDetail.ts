// What the job detail screen shows beyond its core fields.
// The Backend* types are the parts of GET /admin/jobs/{id} (and the job's row in the list) that this screen reads.
// Every field is optional on purpose: the backend adds them over time and the screen shows "—" until it does.
import type { BackendJobRow, BackendPricing } from './jobs';
import type { ReviewJob } from './docReview';

/** Who carries one container or rack: null when nobody has been assigned to it yet */
export interface BackendItemAssignment {
  driverId?: string | null;
  driverName?: string | null;
  truckId?: string | null;
  plateNumber?: string | null;
  assignedAt?: string | null;
  tripStatus?: string | null;
}

export interface BackendDetailContainer {
  id?: string | null;
  number?: string | null;
  containerNumber?: string | null;
  size?: string | null;
  type?: string | null;
  weightTonnes?: number | null;
  cargoWeight?: string | number | null;
  goodsTonnage?: string | number | null;
  assignment?: BackendItemAssignment | null;
}

export interface BackendDetailRack {
  id?: string | null;
  rackNumber?: string | null;
  number?: string | null;
  truckType?: { name?: string | null } | string | null;
  weightTonnes?: number | null;
  weight?: string | number | null;
  assignment?: BackendItemAssignment | null;
  /** the photo of this rack's cargo */
  cargoPhotoUrl?: string | null;
}

export interface BackendDetailPerson {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  avatarUrl?: string | null;
  /** how the trucker is registered (a company or an individual) */
  truckerType?: string | null;
  /** the trucker drives their own truck */
  isOwnerDriver?: boolean | null;
  trustScore?: number | null;
  license?: { number?: string | null; expiresAt?: string | null } | null;
}

export interface BackendDetailVehicle {
  id?: string | null;
  plateNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  color?: string | null;
}

export interface BackendDetailPricing extends BackendPricing {
  commissionPercent?: number | null;
  mobilizationAmount?: number | null;
  mobilizationPercent?: number | null;
  mobilizationPaid?: string | null;
  finalPayoutStatus?: string | null;
  vatLabel?: string | null;
  demurrage?: number | null;
  escrowStatus?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
}

export type EditPhase = 'BEFORE_ACCEPTANCE' | 'AFTER_ACCEPTANCE';

/** One field an admin changed: what it was and what it became */
export interface BackendLogChange {
  field?: string | null;
  from?: unknown;
  to?: unknown;
}

export interface BackendDetailLogEntry {
  at?: string | null;
  category?: string | null;
  action?: string | null;
  description?: string | null;
  changes?: BackendLogChange[] | null;
  actor?: { type?: string | null; id?: string | null; name?: string | null } | null;
}

export interface BackendMovementRef {
  code?: string | null;
  label?: string | null;
}

/** One step of the job's timeline. `event` and `timestamp` are the old names, still sent as aliases. */
export interface BackendTimelineItem {
  key?: string | null;
  label?: string | null;
  at?: string | null;
  completed?: boolean | null;
  event?: string | null;
  timestamp?: string | null;
}

/** What GET /admin/jobs/{id} now carries from the job's row in the list (and what the list row carries) */
export type BackendDetailSummary = Pick<BackendJobRow,
  'requester' | 'company' | 'createdAt' | 'updatedAt' | 'origin' | 'destination' | 'cargo' | 'assignment' | 'movementType' | 'cargoType' | 'itemKind' | 'itemCount'
  | 'requiredTrucks' | 'deadline' | 'estimatedDeliveryAt' | 'deliveredAt'> & {
  timeline?: BackendTimelineItem[] | null;
};

export interface BackendJobDetailDto extends BackendDetailSummary {
  id: string;
  jobNumber?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  version?: string | null;
  updatedAt?: string | null;
  adminActions?: {
    canEdit?: boolean;
    /** which fields the Edit form may offer: all six before an offer is accepted, two after, none once the job is finished */
    editPhase?: EditPhase | null;
    editableFields?: string[] | null;
    canDuplicate?: boolean;
    canMarkInTransit?: boolean;
    canMarkDelivered?: boolean;
  } | null;
  cargoContents?: string | null;
  documents?: { approvalStatus?: string | null } | null;
  reviewFlag?: { reason?: string | null; version?: string | null } | null;
  /** the TDO date, which is when the pickup is due */
  pickupDate?: string | null;
  /** the current ETA */
  deliveryDate?: string | null;
  biddingStartedAt?: string | null;
  distanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  pickup?: { address?: string | null; port?: string | null; terminal?: string | null } | null;
  delivery?: { address?: string | null; port?: string | null; terminal?: string | null } | null;
  containerReturnAddress?: string | null;
  containers?: BackendDetailContainer[] | null;
  racks?: BackendDetailRack[] | null;
  /** the first photo; cargoPhotoUrls holds all of them */
  cargoPhotoUrl?: string | null;
  cargoPhotoUrls?: string[] | null;
  specialInstructions?: string | null;
  /** in tonnes */
  totalWeight?: number | null;
  tdoDate?: string | null;
  freeDays?: number | null;
  forwarder?: BackendDetailPerson | null;
  trucker?: BackendDetailPerson | null;
  driver?: BackendDetailPerson | null;
  vehicle?: BackendDetailVehicle | null;
  pricing?: BackendDetailPricing | null;
  cancellationReason?: string | null;
  cancellation?: { at?: string | null; reason?: string | null } | null;
  activityLog?: BackendDetailLogEntry[] | null;
}

/** Who carries one container or rack */
export interface DetailAssignment { driverName: string; plate: string }
export interface DetailContainer { id: string; number: string; size: string; type: string; weight: string; assignment: DetailAssignment | null }
export interface DetailRack { id: string; number: string; truckType: string; weight: string; assignment: DetailAssignment | null; photoUrl: string | null }
export interface DetailDriver { id: string; name: string; avatarUrl: string | null; phone: string; email: string; trustScore: number | null; licenseNumber: string; licenseExpiry: string }
export interface DetailVehicle { id: string; plate: string; make: string; model: string; year: string; color: string }
export interface DetailCancellation { reason: string | null; by: string | null; at: string }

/** Everything the extra sections need, in display form. Text is "—" when missing, numbers are null. */
export interface JobDetailExtras {
  requestType: string;
  movementCode: string | null;
  cargoKind: string;
  containers: DetailContainer[];
  racks: DetailRack[];
  /** every cargo photo, https only, without repeats */
  cargoPhotoUrls: string[];
  returnAddress: string;
  specialInstructions: string;
  totalWeight: string;
  requiredTrucks: number | null;
  pickupDate: string;
  deliveryDate: string;
  durationLabel: string;
  estimatedDistanceKm: number | null;
  tdoDate: string;
  freeDays: number | null;
  deadline: string;
  expectedDelivery: string;
  forwarderEmail: string;
  forwarderBusiness: string;
  truckerEmail: string;
  truckerPhone: string;
  truckerAvatarUrl: string | null;
  truckerType: string;
  /** the trucker drives their own truck, so there is no separate driver */
  truckerIsOwnerDriver: boolean;
  driver: DetailDriver | null;
  vehicle: DetailVehicle | null;
  /** the offer before fees */
  baseDelivery: number | null;
  demurrage: number | null;
  terminalHandling: number | null;
  vat: number | null;
  vatLabel: string | null;
  forwarderTotal: number | null;
  mobilizationAmount: number | null;
  mobilizationPercent: number | null;
  mobilizationPaid: string | null;
  escrowStatus: string | null;
  paymentReference: string | null;
  paidAt: string;
  cancellation: DetailCancellation | null;
}

// ---------- the other lists the screen loads (bids, trips, payments) ----------

export interface BackendPaginated {
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number } | null;
}

export interface BackendBid {
  id: string;
  jobId?: string | null;
  truckerName?: string | null;
  amount?: number | string | null;
  status?: string | null;
  isCounterOffer?: boolean | null;
  createdAt?: string | null;
}

export interface BackendTripFull {
  tripId: string;
  jobId?: string | null;
  jobNumber?: string | null;
  status?: string | null;
  isDelayed?: boolean | null;
  segmentLabel?: string | null;
  containerNumber?: string | null;
  container?: { number?: string | null } | null;
  driver?: { id?: string | null; name?: string | null; phone?: string | null; avatarUrl?: string | null } | null;
  driverName?: string | null;
  truck?: { id?: string | null; plateNumber?: string | null; lastLatitude?: number | null; lastLongitude?: number | null; lastLocationUpdate?: string | null } | null;
  truckingCompany?: { id?: string | null; name?: string | null } | null;
  origin?: string | null;
  destination?: string | null;
  route?: string | null;
  progressPercent?: number | null;
  eta?: string | null;
  dates?: { deliveredAt?: string | null } | null;
  distance?: { totalKm?: number | null; coveredKm?: number | null } | null;
  telemetryLive?: boolean | null;
  currentLocation?: { source?: string | null; description?: string | null; updatedAt?: string | null; latitude?: number | null; longitude?: number | null } | null;
  heading?: number | null;
  speedKmH?: number | null;
  delayReason?: string | null;
  milestones?: { at?: string | null; label?: string | null; completed?: boolean | null }[] | null;
  issues?: { description?: string | null; photoUrls?: string[] | null }[] | null;
}

export interface BackendPayment {
  id: string;
  createdAt?: string | null;
  description?: string | null;
  status?: string | null;
  reference?: string | null;
  amount?: number | string | null;
  direction?: 'inflow' | 'outflow' | string | null;
  type?: string | null;
  jobId?: string | null;
  relatedKind?: string | null;
  relatedTo?: { id?: string | null } | null;
}

export interface BackendBidAction {
  id?: string;
  version?: string | null;
  status?: string | null;
  jobId?: string | null;
  job?: { id?: string | null } | null;
  adminActions?: { canAccept?: boolean; canDecline?: boolean } | null;
}

export interface JobBid {
  id: string;
  company: string;
  amount: number | null;
  status: string;
  statusCode: string | null;
  isCounterOffer: boolean | null;
  accepted: boolean;
  submittedAt: string;
}

export interface JobTrip {
  id: string;
  statusCode: string | null;
  status: string;
  containerNumber: string;
  route: string;
  truckPlate: string;
  truckId: string | null;
  driverName: string | null;
  driverAvatarUrl: string | null;
  driverPhone: string;
  truckingCompany: string;
  progress: number | null;
  eta: string;
  deliveryDate: string;
  distanceKm: number | null;
  coveredKm: number | null;
  speedKmH: number | null;
  live: boolean;
  currentLocation: string;
  locationUpdatedAt: string;
  /** null when the driver app never sent a position */
  position: TripPosition | null;
  canMarkAtDelivery: boolean;
  canMarkDelayed: boolean;
}

/** One point on the map */
export interface MapPoint { lat: number; lng: number }

/** Where the truck was last seen: live when the driver app sent GPS in the last few minutes */
export interface TripPosition extends MapPoint {
  heading: number | null;
  /** "26 Nov 2026, 14:02" */
  updatedAt: string;
  description: string;
}

/** GET /admin/tracking: the recorded GPS history of the active trips */
export interface BackendTracking {
  routes?: { jobId?: string | null; points?: { latitude?: number | null; longitude?: number | null; recordedAt?: string | null }[] | null }[] | null;
}

export interface TrackingUpdate { time: string; status: string }
export interface TripPhoto { url: string; label: string }
/** `route` is the recorded GPS trail of the job, null when there is none */
export interface TripDetail { trip: JobTrip; updates: TrackingUpdate[]; photos: TripPhoto[]; route: MapPoint[] | null }

export interface JobTransaction {
  id: string;
  date: string;
  description: string;
  status: string;
  reference: string;
  amount: number | null;
  type: string | null;
  statusCode: string | null;
}

export interface ActivityEntry {
  id: string;
  time: string;
  user: string;
  actorId: string | null;
  role: string;
  action: string;
  details: string;
}

export interface TripCounts {
  required: number | null;
  assigned: number | null;
  total: number | null;
  active: number | null;
  completed: number | null;
}

export interface AdminActionFlags {
  canEdit: boolean;
  editPhase: EditPhase | null;
  /** the PATCH body keys the Edit form may offer (tdoDate, cargoDescription, specialInstructions, pickupAddress, deliveryAddress, containerReturnAddress) */
  editableFields: string[];
  canMarkInTransit: boolean;
  canMarkDelivered: boolean;
  canDuplicate: boolean;
}

/** The whole job detail screen, in display form. A list that could not be loaded is null (the screen says so), never an empty list. */
export interface JobDetailData {
  id: string;
  jobNumber: string;
  statusCode: string;
  status: string;
  version: string | null;
  adminActions: AdminActionFlags;
  reviewFlag: { reason: string | null; version: string | null } | null;
  createdAt: string;
  updatedAt: string;
  forwarderId: string | null;
  forwarder: string;
  contactPerson: string;
  contactPhone: string;
  truckingCompany: string | null;
  cargo: string;
  cargoDetails: string;
  origin: string;
  destination: string;
  /** what the forwarder pays in total: offer + service fee + platform fee + VAT */
  jobValue: number | null;
  /** the offer agreed with the trucker (what the trucker is paid), null until an offer is accepted */
  agreedPrice: number | null;
  platformFeePct: number | null;
  platformFee: number | null;
  finalPayoutStatus: string | null;
  assignedTrips: number | null;
  tripCounts: TripCounts;
  distanceKm: number | null;
  /** index 0..5: created, document review, bidding, assigned, in transit, delivered */
  stageDates: (string | null)[];
  bids: JobBid[] | null;
  trips: JobTrip[] | null;
  transactions: JobTransaction[] | null;
  activity: ActivityEntry[];
  uniqueActivityUsers: number | null;
  mostActiveUser: string;
  /** job milestones, shown on the Tracking tab when no trip is selected */
  milestones: TrackingUpdate[];
  /** the documents of every container or rack (null: not loaded, or the job has none) */
  review: ReviewJob | null;
  /** things that could not be loaded, in words */
  warnings: string[];
  extras: JobDetailExtras;
}
