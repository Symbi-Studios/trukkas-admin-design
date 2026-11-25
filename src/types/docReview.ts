// Document review: what the Trukkas backend sends, and what the screens use.
// Backend names are the source of truth (GET /admin/doc-review/queue and /queue/{jobId}).

/* ---------- What the backend sends ---------- */

export interface BackendPerson {
  id: string;
  name: string;
  type?: string;
}

export interface BackendItemRef {
  kind: 'CONTAINER' | 'RACK';
  id: string;
  label?: string | null;
  containerNumber?: string | null;
  rackNumber?: string | null;
}

export interface BackendMovement {
  code: string; // PORT_TO_PORT | PORT_TO_DESTINATION | BREAK_BULK | EXPORT
  label: string; // "Port to Port", "Port to Destination", "Break Bulk", "Export"
}

export interface BackendPreviousVersion {
  version: number;
  fileName?: string | null;
  url?: string | null;
  mimeType?: string | null;
  status?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  uploadedAt?: string | null;
}

export interface BackendDocument {
  /** null while the document is MISSING */
  id: string | null;
  type: string; // TDO | EXIT_NOTE | CUSTOMS_GATE_PASS
  label?: string;
  required?: boolean;
  status: string; // PENDING | APPROVED | REJECTED | MISSING
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: string | null;
  sizeBytes?: number | null;
  version?: number | null;
  uploadedAt?: string | null;
  uploadedBy?: BackendPerson | null;
  reviewedAt?: string | null;
  reviewedBy?: BackendPerson | null;
  rejectionReason?: string | null;
  item?: BackendItemRef | null;
  /** newest first. Starts from the 25 Nov deploy. */
  previousVersions?: BackendPreviousVersion[];
}

export interface BackendItemGroup extends BackendItemRef {
  documents?: BackendDocument[];
}

export interface BackendDocumentSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  missing: number;
  missingTypes: string[];
}

export interface BackendCompany {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface BackendJobType {
  code: string;
  label: string;
}

export interface BackendJobDetail {
  id: string;
  jobNumber: string;
  forwarderName?: string | null;
  company?: BackendCompany | null;
  status?: string;
  statusLabel?: string;
  jobStatus: string; // DOC_REVIEW | DOCUMENTS_VALIDATED | ...
  jobType?: BackendJobType | null;
  movementType?: BackendMovement | null;
  validatedAt?: string | null;
  validatedBy?: { id: string; name: string } | null;
  route?: { pickup?: string | null; delivery?: string | null } | null;
  container?: string | null;
  containerNumber?: string | null;
  tdoDate?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  documentSummary?: BackendDocumentSummary;
  documentList?: BackendDocument[];
  items?: BackendItemGroup[];
}

export interface BackendQueueRow {
  id: string;
  jobNumber: string;
  forwarderName?: string | null;
  company?: BackendCompany | null;
  status?: string;
  statusLabel?: string;
  jobStatus: string;
  jobType?: BackendJobType | null;
  movementType?: BackendMovement | null;
  itemKind?: 'CONTAINER' | 'RACK' | null;
  itemCount?: number | null;
  route?: string | null;
  origin?: string | null;
  originPort?: string | null;
  destination?: string | null;
  container?: string | null;
  containerNumber?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  documentSummary?: BackendDocumentSummary;
}

export interface BackendPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BackendQueue {
  jobs: BackendQueueRow[];
  pagination: BackendPagination;
}

export interface BackendDocStats {
  documents: { total: number; approved: number; pending: number; rejected: number; missing: number; approvedToday: number; rejectedToday: number };
  jobs: { awaiting: number; approved: number; rejected: number; approvedToday: number; rejectedToday: number; withMissingDocuments: number };
}

/* ---------- What the screens use ---------- */

export type ReviewDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MISSING';
export type ReviewStatus = 'NEEDS_REVIEW' | 'AWAITING_FORWARDER' | 'VALIDATED';

/** An earlier, rejected file of the same document. The backend does not send these yet. */
export interface PreviousVersion {
  version: number;
  fileName: string | null;
  mimeType: string | null;
  fileSize: string | null;
  sizeBytes: number | null;
  url: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface ReviewDocument {
  /** Real backend id, or `missing:<unit>:<type>` while the document has not been uploaded. */
  id: string;
  type: string;
  required: boolean;
  status: ReviewDocStatus;
  /** true only when the backend has a real document id and the job is still in review */
  canReview: boolean;
  version: number;
  fileName: string | null;
  mimeType: string | null;
  fileSize: string | null;
  sizeBytes: number | null;
  url: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  /** The backend does not send earlier versions yet, so this is empty for now. */
  history: PreviousVersion[];
}

export interface ReviewUnit {
  id: string;
  label: string;
  kind: 'container' | 'rack';
  documents: ReviewDocument[];
}

export interface ReviewCounts {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  resubmitted: number;
  missing: number;
}

export interface ReviewJobSummary {
  id: string;
  jobNumber: string;
  forwarder: string;
  company: BackendCompany | null;
  /** The kind of movement: "Port to Port", "Port to Destination", "Break Bulk", "Export". */
  movement: string;
  movementCode: string | null;
  jobStatus: string;
  route: { pickup: string; delivery: string };
  containerNumber: string | null;
  /** from the queue rows; null on older backends */
  unitKind: 'container' | 'rack' | null;
  unitCount: number | null;
  reviewStatus: ReviewStatus;
  counts: Omit<ReviewCounts, 'resubmitted'>;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface ReviewJob extends Omit<ReviewJobSummary, 'counts' | 'unitKind' | 'unitCount'> {
  unitKind: 'container' | 'rack';
  unitCount: number;
  /** when and by whom the job was validated (null until it is) */
  validatedAt: string | null;
  validatedBy: string | null;
  /** YYYY-MM-DD */
  tdoDate: string | null;
  counts: ReviewCounts;
  /** true once the job has left DOC_REVIEW: documents can no longer be changed */
  locked: boolean;
  units: ReviewUnit[];
}

export interface ReviewQueue {
  jobs: ReviewJobSummary[];
  pagination: BackendPagination;
}

export type ReviewStats = BackendDocStats;

/** The backend's queue tabs. */
export type QueueTab = 'awaiting' | 'approved' | 'rejected' | 'missing' | 'all';