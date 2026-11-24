// Pure rules for per-container document review.
// Each container (or rack, on bulk break jobs) carries its own TDO, Customs
// Gate Pass and Exit Note. Every document is approved or rejected on its own;
// the job is validated only when every document on every unit is approved.

export const UNIT_DOCUMENTS = [
  { type: 'TDO', label: 'TDO', description: 'Terminal Delivery Order' },
  { type: 'CUSTOMS_GATE_PASS', label: 'Gate Pass', description: 'Customs Gate Pass' },
  { type: 'EXIT_NOTE', label: 'Exit Note', description: 'Terminal Exit Note' },
];

export const DOC_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

export const JOB_REVIEW_STATUS = {
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  AWAITING_FORWARDER: 'AWAITING_FORWARDER',
  VALIDATED: 'VALIDATED',
};

export const REJECTION_PRESETS = [
  'Illegible or blurry scan',
  'Wrong container number',
  'Date doesn’t match the TDO date',
  'Wrong document uploaded',
  'Document has expired',
  'Missing stamp or signature',
];

export function docLabel(type) {
  return UNIT_DOCUMENTS.find((doc) => doc.type === type)?.label || type;
}

export function docDescription(type) {
  return UNIT_DOCUMENTS.find((doc) => doc.type === type)?.description || type;
}

export function docStatusLabel(status) {
  if (status === DOC_STATUS.APPROVED) return 'Approved';
  if (status === DOC_STATUS.REJECTED) return 'Rejected';
  return 'Pending';
}

export function docStatusTone(status) {
  if (status === DOC_STATUS.APPROVED) return 'success';
  if (status === DOC_STATUS.REJECTED) return 'danger';
  return 'warning';
}

export function unitNoun(kind, count = 1) {
  const word = kind === 'rack' ? 'rack' : 'container';
  return count === 1 ? word : word + 's';
}

/** Every document on a job, flattened in reading order (unit by unit). */
export function flattenDocuments(units = []) {
  return units.flatMap((unit) => unit.documents.map((doc) => ({ ...doc, unitId: unit.id, unitLabel: unit.label, unitKind: unit.kind })));
}

export function countDocuments(units = []) {
  const docs = flattenDocuments(units);
  return {
    total: docs.length,
    approved: docs.filter((doc) => doc.status === DOC_STATUS.APPROVED).length,
    pending: docs.filter((doc) => doc.status === DOC_STATUS.PENDING).length,
    rejected: docs.filter((doc) => doc.status === DOC_STATUS.REJECTED).length,
    resubmitted: docs.filter((doc) => doc.status === DOC_STATUS.PENDING && doc.version > 1).length,
  };
}

export function reviewStatusFor(counts) {
  if (counts.total > 0 && counts.approved === counts.total) return JOB_REVIEW_STATUS.VALIDATED;
  if (counts.pending > 0) return JOB_REVIEW_STATUS.NEEDS_REVIEW;
  return JOB_REVIEW_STATUS.AWAITING_FORWARDER;
}

export const REVIEW_STATUS_META = {
  [JOB_REVIEW_STATUS.NEEDS_REVIEW]: { label: 'Needs review', tone: 'warning', icon: 'clock' },
  [JOB_REVIEW_STATUS.AWAITING_FORWARDER]: { label: 'Waiting on forwarder', tone: 'danger', icon: 'hourglass' },
  [JOB_REVIEW_STATUS.VALIDATED]: { label: 'Validated', tone: 'success', icon: 'lock' },
};

/**
 * The next document the admin should look at after `currentId`: the next
 * pending one in reading order, wrapping to the start. Null when none are left.
 */
export function nextPendingAfter(units, currentId) {
  const docs = flattenDocuments(units);
  const start = Math.max(0, docs.findIndex((doc) => doc.id === currentId));
  for (let step = 1; step <= docs.length; step += 1) {
    const doc = docs[(start + step) % docs.length];
    if (doc.status === DOC_STATUS.PENDING && doc.id !== currentId) return doc;
  }
  return null;
}

/** "MSCU1234567 · TDO" — the context every rejection reason starts with. */
export function rejectionPrefix(doc) {
  return `${doc.unitLabel} · ${docLabel(doc.type)}`;
}
