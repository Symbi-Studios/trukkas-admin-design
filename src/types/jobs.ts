// What the backend sends for GET /admin/jobs, /admin/jobs/stats and /admin/reference/container-types,
// and what the Jobs screen receives after the adapter (lib/jobs/adapt.ts).
// Fields marked "?" may be missing on older backends: the adapter never lets that reach the screen.

export interface BackendMovement {
  code: string; // PORT_TO_PORT | PORT_TO_DESTINATION | BULK_BREAK | EXPORT
  label: string;
}

/** The job's money: Offer + Service fee + Platform fee + VAT = Total, exactly as the app shows it */
export interface BackendPricing {
  /** what the forwarder pays in total (offer + service fee + platform fee + VAT): the "Job value" */
  totalPrice?: number | null;
  /** the offer the forwarder accepted: what the trucker is paid in full. Null until an offer is accepted. */
  agreedPrice?: number | null;
  /** the offer before fees (the app's "Original offer") */
  baseDelivery?: number | null;
  /** shown as "Service fee" */
  terminalHandling?: number | null;
  platformFee?: number | null;
  vat?: number | null;
  forwarderTotal?: number | null;
  currency?: string | null;
}

export interface BackendJobRow {
  id: string;
  jobNumber: string;
  status: string; // DOC_REVIEW, DOCUMENTS_VALIDATED, IN_TRANSIT, CANCELLED ...
  stage?: string | null; // pendingApproval | bidding | assigned | inTransit | delivered | cancelled | flagged | rejected
  stageLabel?: string | null;
  statusLabel?: string | null; // "On track", "Delayed" ...
  company?: { id: string; name: string; location?: string | null; isExporter?: boolean } | null;
  requester?: { name?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null } | null;
  /** PORT_TO_DESTINATION | PORT_TO_PORT | BULK_BREAK | EXPORT */
  movementType?: BackendMovement | null;
  /** CONTAINER | BULK_BREAK, separate from the movement */
  cargoType?: BackendMovement | null;
  /** how many trucks the job needs */
  requiredTrucks?: number | null;
  itemKind?: 'CONTAINER' | 'RACK' | null;
  itemCount?: number | null;
  origin?: string | null;
  destination?: string | null;
  route?: string | null;
  cargo?: {
    containerCount?: number | null;
    containerSummary?: string | null;
    containerTypes?: string[] | null;
    description?: string | null;
    label?: string | null;
  } | null;
  /** All the money of the job, in the same terms as the mobile app (see BackendPricing) */
  pricing?: BackendPricing | null;
  assignment?: {
    assignedTrips?: number | null;
    totalTrips?: number | null;
    assignee?: { id: string; name: string; avatarUrl?: string | null } | null;
    driverName?: string | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  timeline?: { key?: string | null; label?: string | null; at?: string | null; completed?: boolean }[] | null;
  truckerName?: string | null;
  forwarderName?: string | null;
  deadline?: string | null;
  freeDays?: number | null;
  reviewFlag?: { reason?: string | null; version?: string | null } | null;
}

export interface BackendPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BackendJobsList {
  jobs: BackendJobRow[];
  pagination?: Partial<BackendPagination> | null;
}

export type StatTrend = 'UP' | 'DOWN' | 'FLAT';

export interface BackendJobStats {
  period?: { from?: string; to?: string; comparedToFrom?: string; comparedToTo?: string } | null;
  cards?: Record<string, { value?: number | null; changePercent?: number | null; trend?: StatTrend | null } | undefined> | null;
  tabs?: Record<string, number | null | undefined> | null;
}

export interface BackendPorts {
  ports: { id: string; name?: string | null; isActive?: boolean }[];
}

/** One entry of the Pickup port filter */
export interface PortOption {
  id: string;
  name: string;
}

// ---------- what the screen gets ----------

/** The tabs the backend counts (statusFilter) */
export type JobTab = 'pendingApproval' | 'bidding' | 'assigned' | 'inTransit' | 'delivered' | 'cancelled' | 'flagged' | 'rejected';

export interface JobTimelineEvent {
  title: string;
  at: string | null;
  done: boolean;
}

export interface JobRow {
  id: string;
  jobNumber: string;
  statusCode: string;
  stage: string;
  /** "Bidding", "In Transit", "Cancelled" ... */
  status: string;
  /** "On track", "Delayed" ... only when it adds something to `status` */
  health: string | null;
  forwarder: string;
  forwarderId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAvatarUrl: string | null;
  /** "Import (Container)", "Transfer", "Export", "Break-Bulk" ... */
  movement: string;
  movementCode: string | null;
  origin: string | null;
  destination: string | null;
  cargo: string;
  /** "Container" | "Break bulk", or null when it cannot be told */
  cargoKind: string | null;
  /** what is in the cargo, in words ("Treat") */
  cargoDescription: string | null;
  /** how many trucks the job needs */
  requiredTrucks: number | null;
  unitKind: 'container' | 'rack' | null;
  unitCount: number | null;
  /** What the forwarder pays in total (offer + service fee + platform fee + VAT) */
  jobValue: number | null;
  /** The offer agreed with the trucker, what the trucker is paid. Null until an offer is accepted. */
  agreedPrice: number | null;
  assignedTrips: number | null;
  totalTrips: number | null;
  truckingCompany: string | null;
  truckingCompanyAvatarUrl: string | null;
  createdAt: string | null;
  expectedDelivery: string | null;
  deadline: string | null;
  freeDays: number | null;
  timeline: JobTimelineEvent[];
  flagged: boolean;
  flagReason: string | null;
  canReviewDocs: boolean;
  canMarkDelivered: boolean;
  canCancel: boolean;
}

export interface JobsPage {
  jobs: JobRow[];
  pagination: BackendPagination;
}

export interface JobStatCard {
  value: number | null;
  changePercent: number | null;
  trend: StatTrend | null;
}

export type JobStatCardKey = 'totalJobs' | 'pendingApproval' | 'inTransit' | 'delivered' | 'cancelled';

export interface JobStats {
  cards: Record<JobStatCardKey, JobStatCard>;
  /** counts for the tabs; "all" is the total */
  tabs: Record<'all' | JobTab, number | null>;
}

export interface PendingUploads {
  total: number;
  /** a few job numbers to link to */
  jobs: { id: string; jobNumber: string }[];
}

/** What the backend list endpoint accepts (statusFilter is `status` here) */
export interface JobsQuery {
  /** a tab, or "active": jobs where bidding has started and that are not finished (Bidding, Assigned, In Transit) */
  status?: JobTab | 'active';
  search?: string;
  /** PORT_TO_DESTINATION | PORT_TO_PORT | BULK_BREAK | EXPORT */
  movementType?: string;
  /** CONTAINER | BULK_BREAK */
  cargoType?: string;
  /** the id of a port from GET /admin/reference/ports (export jobs are left out, their port is the destination) */
  pickupPortId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/** The filters as they live in the page URL */
export interface JobsFilters {
  tab: JobTab | 'all';
  /** a movement code (PORT_TO_DESTINATION | PORT_TO_PORT), or "" for all */
  type: string;
  /** CONTAINER | BULK_BREAK, or "" for all */
  cargoKind: string;
  /** a pickup port id, or "" for all */
  port: string;
  /** Lagos calendar days, YYYY-MM-DD, or "" */
  from: string;
  to: string;
  /** Last day | 7 days | month | quarter | all time. Narrows the table and the 5 cards together; a chosen from/to range wins over it. */
  period: string;
  search: string;
}

// ---------- the side drawer ----------

export interface BackendTripRow {
  tripId: string;
  jobId?: string | null;
  status?: string | null;
  isDelayed?: boolean | null;
  segmentLabel?: string | null;
  driverName?: string | null;
  driver?: { id?: string | null; name?: string | null; phone?: string | null; avatarUrl?: string | null; isOwnerDriver?: boolean | null } | null;
  truck?: { plateNumber?: string | null } | null;
}

export interface BackendTripsList {
  trips: BackendTripRow[];
}

export interface BackendDocSummary {
  total?: number | null;
  approved?: number | null;
  pending?: number | null;
  rejected?: number | null;
}

export interface DrawerTrip {
  id: string;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  driverAvatarUrl: string | null;
  /** the trucker drives their own truck */
  isOwnerDriver: boolean;
  truckPlate: string | null;
}

export interface DocCounts {
  total: number;
  approved: number | null;
  pending: number | null;
  rejected: number | null;
}

/** null means that part could not be loaded (the drawer says so instead of showing zero) */
export interface JobDrawerData {
  trips: DrawerTrip[] | null;
  documents: DocCounts | null;
}
