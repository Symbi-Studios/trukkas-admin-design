// Shared rules for the support inbox: queues, ordering, labels and time formatting.
// Everything here works on adapted tickets from store/features/tickets/ticketsApi.js.

export const RESOLVED = new Set(['Resolved', 'Closed']);
export const isOpenTicket = (ticket) => !RESOLVED.has(ticket.status) && !ticket.mergedInto;
/** The customer spoke last, so the ball is in our court (matches the API's needResponseCount). */
export const needsReply = (ticket) => isOpenTicket(ticket) && ticket.lastMessage?.senderType === 'USER';

/** Left-rail queues. `match(ticket, adminId)` decides membership; counts come from the same rule. */
export const QUEUES = [
  { id: 'needs-reply', label: 'Needs reply', icon: 'message-circle-reply', match: (t) => needsReply(t) },
  { id: 'mine', label: 'Assigned to me', icon: 'user-round', match: (t, me) => isOpenTicket(t) && Boolean(me) && t.assignedTo === me },
  { id: 'unassigned', label: 'Unassigned', icon: 'user-round-x', match: (t) => isOpenTicket(t) && !t.assignedTo },
  { id: 'unread', label: 'Unread', icon: 'mail', match: (t) => t.unread },
  { divider: true },
  { id: 'open', label: 'All open', icon: 'inbox', match: (t) => isOpenTicket(t) },
  { id: 'pending', label: 'Waiting on customer', icon: 'clock-3', match: (t) => t.status === 'Pending' && !t.mergedInto },
  { id: 'resolved', label: 'Resolved', icon: 'circle-check', match: (t) => RESOLVED.has(t.status) && !t.mergedInto },
  { id: 'all', label: 'All tickets', icon: 'layers', match: (t) => !t.mergedInto },
];
export const QUEUE_IDS = QUEUES.filter((q) => q.id).map((q) => q.id);
export const DEFAULT_QUEUE = 'open';

const PRIORITY_RANK = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
export const SORTS = [
  { id: 'recent', label: 'Latest activity' },
  { id: 'oldest', label: 'Oldest waiting' },
  { id: 'priority', label: 'Priority' },
];
export function sortTickets(list, sort) {
  const time = (t) => t.activityAt ?? 0;
  const copy = [...list];
  if (sort === 'oldest') return copy.sort((a, b) => time(a) - time(b));
  if (sort === 'priority') return copy.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || time(b) - time(a));
  return copy.sort((a, b) => time(b) - time(a));
}

export function matchesSearch(ticket, term) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [ticket.reference, ticket.id, ticket.subjectValue, ticket.customer, ticket.email, ticket.company]
    .some((field) => typeof field === 'string' && field.toLowerCase().includes(needle));
}

/** "SUP-00019" when the API sends one; otherwise the last six characters of the record ID. */
export const ticketLabel = (ticket) => ticket.reference || (typeof ticket.id === 'string' && ticket.id !== '—' ? '#' + ticket.id.slice(-6) : '—');

const LAGOS = 'Africa/Lagos';
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
/** Compact age for list rows: "now", "12m", "3h", "Yesterday", "Mon", "12 Nov". */
export function shortTime(ts, now = Date.now()) {
  if (ts == null) return '—';
  const diff = Math.max(0, now - ts);
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 2 * 86_400_000) return 'Yesterday';
  if (diff < 7 * 86_400_000) return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: LAGOS }).format(ts);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: LAGOS }).format(ts);
}
/** Sentence form for the ticket pane: "3 hours ago", "yesterday". */
export function timeAgo(ts, now = Date.now()) {
  if (ts == null) return '—';
  const minutes = Math.round((ts - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}
export const fullTime = (ts) => ts == null ? '—'
  : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: LAGOS }).format(ts);

export function duration(fromTs, toTs) {
  if (fromTs == null || toTs == null || toTs < fromTs) return '—';
  const hours = (toTs - fromTs) / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
export const hoursLabel = (hours) => typeof hours !== 'number' || !Number.isFinite(hours) ? '—'
  : hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;

export const STATUS_TONE = { Open: 'info', 'In Progress': 'purple', Pending: 'warning', Escalated: 'danger', Resolved: 'success', Closed: 'neutral' };
export const PRIORITY_ICON = { Urgent: 'chevrons-up', High: 'chevron-up', Medium: 'equal', Low: 'chevron-down' };

const ROLE_LABEL = { DRIVER: 'Driver', TRUCKER: 'Trucker', FORWARDER: 'Forwarder', EXPORTER: 'Exporter' };
export const customerRoleLabel = (role) => ROLE_LABEL[role] || null;
export function customerProfileUrl(ticket) {
  if (!ticket.userId) return null;
  const id = encodeURIComponent(ticket.userId);
  if (ticket.customerRole === 'DRIVER') return `/drivers/detail?id=${id}`;
  if (ticket.customerRole === 'TRUCKER') return `/companies/detail?id=${id}`;
  if (ticket.customerRole === 'FORWARDER') return `/forwarders/detail?id=${id}`;
  return null;
}
const RELATED = {
  JOB: { label: 'Job', icon: 'package', url: (id) => `/jobs/detail?id=${encodeURIComponent(id)}` },
  TRIP: { label: 'Trip', icon: 'route', url: (id) => `/trips?tripId=${encodeURIComponent(id)}` },
  TRUCK: { label: 'Truck', icon: 'truck', url: (id) => `/fleet/detail?id=${encodeURIComponent(id)}` },
  DRIVER: { label: 'Driver', icon: 'user-round', url: (id) => `/drivers/detail?id=${encodeURIComponent(id)}` },
};
export const relatedLink = (item) => {
  const kind = RELATED[String(item.kind).toUpperCase()];
  return kind ? { ...kind, href: kind.url(item.id) } : { label: item.kind, icon: 'link', href: null };
};
