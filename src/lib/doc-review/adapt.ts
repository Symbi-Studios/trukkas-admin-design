// Turns the backend's document-review responses into the shape the screens use.
// Pure functions, no network: easy to test.
import { UNIT_DOCUMENTS, countDocuments, reviewStatusFor } from '@/domain/containerReview';
import { movementLabel } from '@/domain/movement';
import type {
  BackendDocument,
  BackendItemGroup,
  BackendItemRef,
  BackendMovement,
  BackendPreviousVersion,
  BackendJobDetail,
  BackendQueue,
  BackendQueueRow,
  ReviewDocStatus,
  ReviewDocument,
  ReviewJob,
  ReviewJobSummary,
  ReviewQueue,
  ReviewStatus,
  ReviewUnit,
  PreviousVersion,
} from '@/types/docReview';

const IN_REVIEW = 'DOC_REVIEW';
const STATUSES: ReviewDocStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'MISSING'];

function docType(raw: string): string {
  const type = String(raw ?? '').toUpperCase();
  return type === 'GATE_PASS' ? 'CUSTOMS_GATE_PASS' : type;
}

function docStatus(raw: string): ReviewDocStatus {
  const status = String(raw ?? '').toUpperCase() as ReviewDocStatus;
  if (STATUSES.includes(status)) return status;
  console.warn('[doc-review] unknown document status from the backend:', raw);
  return 'PENDING';
}

function unitLabel(item: BackendItemRef | null | undefined, fallback: string): string {
  return item?.containerNumber || item?.rackNumber || item?.label || fallback;
}

function movementOf(dto: { movementType?: BackendMovement | null; jobType?: { code?: string; label: string } | null }): string {
  const movement = dto.movementType ?? dto.jobType ?? null;
  return movement ? movementLabel(movement.code, movement.label) : '';
}

// The backend sends earlier versions newest first. The screens want oldest first.
function adaptHistory(list: BackendPreviousVersion[] | undefined): PreviousVersion[] {
  return [...(list ?? [])].reverse().map((entry) => ({
    version: entry.version,
    fileName: entry.fileName ?? null,
    mimeType: entry.mimeType ?? null,
    fileSize: null,
    sizeBytes: null,
    url: entry.url ?? null,
    uploadedBy: null,
    uploadedAt: entry.uploadedAt ?? null,
    reviewedBy: null,
    reviewedAt: entry.reviewedAt ?? null,
    rejectionReason: entry.rejectionReason ?? null,
  }));
}

function adaptDocument(doc: BackendDocument, unitId: string, jobOpen: boolean): ReviewDocument {
  const status = docStatus(doc.status);
  const type = docType(doc.type);
  const hasId = typeof doc.id === 'string' && doc.id.length > 0;
  return {
    id: hasId ? (doc.id as string) : `missing:${unitId}:${type}`,
    type,
    required: doc.required ?? type !== 'CUSTOMS_GATE_PASS',
    status,
    canReview: hasId && status !== 'MISSING' && jobOpen,
    version: doc.version ?? 1,
    fileName: doc.fileName ?? null,
    mimeType: doc.mimeType ?? null,
    fileSize: doc.fileSize ?? null,
    sizeBytes: doc.sizeBytes ?? null,
    url: doc.url ?? null,
    uploadedBy: doc.uploadedBy?.name ?? null,
    uploadedAt: doc.uploadedAt ?? null,
    reviewedBy: doc.reviewedBy?.name ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    rejectionReason: doc.rejectionReason ?? null,
    history: adaptHistory(doc.previousVersions),
  };
}

function inReadingOrder(documents: ReviewDocument[]): ReviewDocument[] {
  const rank = (type: string) => {
    const index = UNIT_DOCUMENTS.findIndex((entry) => entry.type === type);
    return index === -1 ? UNIT_DOCUMENTS.length : index;
  };
  return [...documents].sort((a, b) => rank(a.type) - rank(b.type));
}

function buildUnits(dto: BackendJobDetail, jobOpen: boolean): ReviewUnit[] {
  const list = dto.documentList ?? [];
  const groups: BackendItemGroup[] = dto.items ?? [];

  // Older jobs: one set of documents for the whole job.
  if (groups.length === 0 && !list.some((row) => row.item)) {
    const id = 'job';
    return [{
      id,
      label: dto.containerNumber || dto.jobNumber,
      kind: 'container',
      documents: inReadingOrder(list.map((row) => adaptDocument(row, id, jobOpen))),
    }];
  }

  // Newer jobs: one unit per container or rack.
  const units = new Map<string, ReviewUnit>();
  for (const group of groups) {
    units.set(group.id, {
      id: group.id,
      label: unitLabel(group, group.id),
      kind: group.kind === 'RACK' ? 'rack' : 'container',
      documents: (group.documents ?? []).map((row) => adaptDocument(row, group.id, jobOpen)),
    });
  }
  // Fill from documentList when items[] came without their documents (or without items[]).
  for (const row of list) {
    const item = row.item;
    if (!item) continue;
    let unit = units.get(item.id);
    if (!unit) {
      unit = { id: item.id, label: unitLabel(item, item.id), kind: item.kind === 'RACK' ? 'rack' : 'container', documents: [] };
      units.set(item.id, unit);
    }
    const adapted = adaptDocument(row, item.id, jobOpen);
    if (!unit.documents.some((existing) => existing.id === adapted.id)) unit.documents.push(adapted);
  }
  return [...units.values()].map((unit) => ({ ...unit, documents: inReadingOrder(unit.documents) }));
}

function tdoDay(value: string | null | undefined): string | null {
  return value ? String(value).slice(0, 10) : null;
}

export function adaptJob(dto: BackendJobDetail): ReviewJob {
  const jobOpen = dto.jobStatus === IN_REVIEW;
  const units = buildUnits(dto, jobOpen);
  const counts = countDocuments(units);
  return {
    id: dto.id,
    jobNumber: dto.jobNumber,
    forwarder: dto.forwarderName || dto.company?.name || '—',
    company: dto.company ?? null,
    movement: movementOf(dto),
    movementCode: dto.movementType?.code ?? dto.jobType?.code ?? null,
    jobStatus: dto.jobStatus,
    route: { pickup: dto.route?.pickup ?? '—', delivery: dto.route?.delivery ?? '—' },
    containerNumber: dto.containerNumber ?? null,
    reviewStatus: reviewStatusFor(counts),
    unitKind: units[0]?.kind ?? 'container',
    unitCount: units.length,
    tdoDate: tdoDay(dto.tdoDate),
    counts,
    locked: !jobOpen,
    validatedAt: dto.validatedAt ?? null,
    validatedBy: dto.validatedBy?.name ?? null,
    units,
    submittedAt: dto.submittedAt ?? null,
    updatedAt: dto.updatedAt ?? null,
  };
}

function summaryStatus(row: BackendQueueRow): ReviewStatus {
  const s = row.documentSummary;
  if (row.jobStatus !== IN_REVIEW && s && s.total > 0 && s.approved === s.total) return 'VALIDATED';
  if (s && s.pending > 0) return 'NEEDS_REVIEW';
  return 'AWAITING_FORWARDER';
}

export function adaptQueueRow(row: BackendQueueRow): ReviewJobSummary {
  const s = row.documentSummary;
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    forwarder: row.forwarderName || row.company?.name || '—',
    company: row.company ?? null,
    movement: movementOf(row),
    movementCode: row.movementType?.code ?? row.jobType?.code ?? null,
    jobStatus: row.jobStatus,
    route: { pickup: row.origin ?? '—', delivery: row.destination ?? '—' },
    containerNumber: row.containerNumber || null,
    unitKind: row.itemKind ? (row.itemKind === 'RACK' ? 'rack' : 'container') : null,
    unitCount: row.itemCount ?? null,
    reviewStatus: summaryStatus(row),
    counts: {
      total: s?.total ?? 0,
      approved: s?.approved ?? 0,
      pending: s?.pending ?? 0,
      rejected: s?.rejected ?? 0,
      missing: s?.missing ?? 0,
    },
    submittedAt: row.submittedAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export function adaptQueue(dto: BackendQueue): ReviewQueue {
  return { jobs: (dto.jobs ?? []).map(adaptQueueRow), pagination: dto.pagination };
}