// View rules for the feedback inbox. Feedback is what app users tell us about Trukkas itself
// (sent from the apps via POST /feedback). Trip ratings are a different feature.

export const QUEUES = [
  { id: 'open', label: 'Open', icon: 'inbox' },
  { id: 'unread', label: 'Unread', icon: 'mail' },
  { id: 'mine', label: 'Assigned to me', icon: 'user-round' },
  { id: 'unassigned', label: 'Unassigned', icon: 'user-round-x' },
  { divider: true },
  { id: 'in-progress', label: 'In progress', icon: 'loader' },
  { id: 'resolved', label: 'Resolved', icon: 'circle-check' },
  { id: 'spam', label: 'Spam', icon: 'ban' },
  { id: 'all', label: 'All', icon: 'layers' },
];
export const DEFAULT_QUEUE = 'open';

const active = (row) => row.status === 'Open' || row.status === 'In Progress';

export function inQueue(row, queue, me) {
  switch (queue) {
    case 'open': return row.status === 'Open';
    case 'unread': return row.unread === true && row.status !== 'Spam';
    case 'mine': return active(row) && Boolean(me) && row.assignedToId === me;
    case 'unassigned': return active(row) && !row.assignedToId;
    case 'in-progress': return row.status === 'In Progress';
    case 'resolved': return row.status === 'Resolved';
    case 'spam': return row.status === 'Spam';
    default: return true;
  }
}

export const TYPES = ['Praise', 'Suggestion', 'Issue', 'Other'];
export const TYPE_ICON = { Praise: 'heart', Suggestion: 'lightbulb', Issue: 'bug', Other: 'message-circle' };
export const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open', dot: 'var(--tk-blue)' },
  { value: 'In Progress', label: 'In progress', dot: 'var(--tk-warning)' },
  { value: 'Resolved', label: 'Resolved', dot: 'var(--tk-success)' },
];
export const STATUS_DOT = { Open: 'var(--tk-blue)', 'In Progress': 'var(--tk-warning)', Resolved: 'var(--tk-success)', Spam: 'var(--tk-ink-300)' };
export const ROLE_LABEL = { TRUCKER: 'Trucker', DRIVER: 'Driver', FORWARDER: 'Forwarder', EXPORTER: 'Exporter' };

export function matchesSearch(row, term) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [row.title, row.body, row.user, row.email, row.topic, ...(row.tags || [])]
    .some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

export const sortNewest = (rows) => [...rows].sort((a, b) => (b.submittedAtTs ?? 0) - (a.submittedAtTs ?? 0));

export function profileUrl(row) {
  if (!row.raterId || row.submitterType !== 'USER') return null;
  const id = encodeURIComponent(row.raterId);
  if (row.roleCode === 'DRIVER') return `/drivers/detail?id=${id}`;
  if (row.roleCode === 'TRUCKER') return `/companies/detail?id=${id}`;
  if (row.roleCode === 'FORWARDER') return `/forwarders/detail?id=${id}`;
  return null;
}

export const feedbackPageUrl = (id) => `/feedback/detail?feedbackId=${encodeURIComponent(id)}`;
