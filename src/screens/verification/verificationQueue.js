// View rules for the verification review queue. The backend merges several source queues
// (accounts, KYB, company documents, trucks, exporter licences) into one list; these helpers
// turn that into queues an admin can work through.

const DAY = 24 * 60 * 60 * 1000;
const time = (raw) => { const t = Date.parse(raw || ''); return Number.isNaN(t) ? null : t; };

export const QUEUES = [
  { id: 'review', label: 'Needs review', icon: 'inbox' },
  { id: 'expiring', label: 'Expiring or expired', icon: 'calendar-clock' },
  { id: 'decided', label: 'Recently decided', icon: 'circle-check' },
  { id: 'all', label: 'All', icon: 'layers' },
];
export const DEFAULT_QUEUE = 'review';

export const KINDS = ['Account', 'Business (KYB)', 'Document', 'Truck', 'Exporter licence'];

export const isExpiryFlagged = (row) => row.expired === true || row.expiringSoon === true;

export function inQueue(row, queue) {
  if (queue === 'review') return row.open;
  if (queue === 'expiring') return isExpiryFlagged(row);
  if (queue === 'decided') return !row.open && row.statusCode != null;
  return true;
}

/** Oldest first for work queues; newest decisions first for the decided list. */
export function sortForQueue(rows, queue) {
  const by = (pick, dir = 1) => (a, b) => ((pick(a) ?? Infinity) - (pick(b) ?? Infinity)) * dir;
  const list = [...rows];
  if (queue === 'review') return list.sort(by((r) => time(r.submittedAtRaw)));
  if (queue === 'expiring') return list.sort(by((r) => time(r.expiresAtRaw) ?? soonestRequirementExpiry(r)));
  if (queue === 'decided') return list.sort((a, b) => (time(b.reviewedAtRaw) ?? 0) - (time(a.reviewedAtRaw) ?? 0));
  return list.sort((a, b) => (time(b.submittedAtRaw) ?? 0) - (time(a.submittedAtRaw) ?? 0));
}

function soonestRequirementExpiry(row) {
  const times = (row.requirements || []).map((r) => time(r.expiresAtRaw)).filter((t) => t != null);
  return times.length ? Math.min(...times) : null;
}

export function matchesSearch(row, term) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [row.entityName, row.regNo, row.id, row.documentType, row.type, row.email]
    .some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

/** What is being checked, in plain words: the document type for document rows, the check otherwise. */
export const subjectLabel = (row) => row.documentType || (row.type !== '—' ? row.type : row.kind);

export function ago(raw, now = Date.now()) {
  const t = time(raw);
  if (t == null) return '—';
  const days = Math.floor((now - t) / DAY);
  if (days < 1) { const hours = Math.floor((now - t) / 3600000); return hours < 1 ? 'just now' : `${hours}h`; }
  if (days < 60) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function waitingLabel(raw, now = Date.now()) {
  const t = time(raw);
  if (t == null) return null;
  const days = Math.floor((now - t) / DAY);
  return days < 1 ? 'Waiting since today' : `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function expiryLabel(row, now = Date.now()) {
  if (row.expired) return { tone: 'danger', text: 'Expired' };
  if (row.expiringSoon) {
    const t = time(row.expiresAtRaw);
    const days = t == null ? null : Math.max(0, Math.ceil((t - now) / DAY));
    return { tone: 'warning', text: days == null ? 'Expiring soon' : days === 0 ? 'Expires today' : `Expires in ${days}d` };
  }
  return null;
}

export const STATUS_TONE = { Pending: 'warning', 'In Review': 'info', Verified: 'success', Rejected: 'danger', 'Non-Compliant': 'danger', Cancelled: 'neutral' };
export const REQUIREMENT_TONE = { Verified: 'success', Approved: 'success', Pending: 'warning', 'In Review': 'info', Rejected: 'danger', Expired: 'danger', 'Not Submitted': 'neutral' };

/** Counts for the header strip, worked out from the same rows as the list so they always agree. */
export function queueStats(rows, now = Date.now()) {
  const open = rows.filter((r) => r.open);
  const waits = open.map((r) => time(r.submittedAtRaw)).filter((t) => t != null).map((t) => now - t).sort((a, b) => a - b);
  const median = waits.length ? waits[Math.floor((waits.length - 1) / 2)] : null;
  return {
    review: open.length,
    expiring: rows.filter(isExpiryFlagged).length,
    decidedWeek: rows.filter((r) => !r.open && time(r.reviewedAtRaw) != null && now - time(r.reviewedAtRaw) <= 7 * DAY).length,
    medianWait: median == null ? null : Math.max(0, Math.round(median / DAY)),
  };
}

export function profileUrl(row) {
  const id = row.entityId && encodeURIComponent(row.entityId);
  if (!id) return null;
  if (row.source === 'TRUCK') return row.sourceId ? { label: 'Truck', url: `/fleet/detail?id=${encodeURIComponent(row.sourceId)}` } : null;
  if (row.entityTypeCode === 'DRIVER') return { label: 'Driver profile', url: `/drivers/detail?id=${id}` };
  if (row.entityTypeCode === 'TRUCKING_COMPANY' || row.entityTypeCode === 'TRUCKER') return { label: 'Company profile', url: `/companies/detail?id=${id}` };
  if (row.entityTypeCode === 'EXPORTER' || row.entityTypeCode === 'FORWARDER') return { label: 'Forwarder profile', url: `/forwarders/detail?id=${id}` };
  return null;
}

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' },
];
export const CASE_TYPES = [
  { value: 'ACCOUNT_REVIEW', label: 'Account verification' },
  { value: 'BUSINESS_VERIFICATION', label: 'Business verification (KYB)' },
  { value: 'EXPORTER_LICENCE', label: 'Exporter licence' },
  { value: 'TRUCK_REGISTRATION', label: 'Truck registration' },
  { value: 'COMPANY_DOCUMENT', label: 'Company document' },
];
