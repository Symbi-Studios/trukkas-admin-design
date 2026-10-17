export const feedbackText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
export const feedbackObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
// Settings can use an opaque value such as "initial"; feedback records use ISO timestamps.
export const feedbackVersion = (value) => typeof value === 'string' && value.trim() ? value : null;
export const feedbackFailure = (error, status = 'CUSTOM_ERROR') => ({ error: { status, error } });
export function feedbackNumber(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
export function feedbackInteger(value) { const number = feedbackNumber(value); return Number.isSafeInteger(number) && number >= 0 ? number : null; }
export const feedbackCount = (value) => feedbackInteger(value) == null ? '—' : feedbackInteger(value).toLocaleString('en-NG');
export const FEEDBACK_STATUSES = { Open: 'OPEN', 'In Progress': 'IN_PROGRESS', Resolved: 'RESOLVED', Spam: 'SPAM' };
export const FEEDBACK_TYPES = { Praise: 'PRAISE', Suggestion: 'SUGGESTION', Issue: 'ISSUE', Other: 'OTHER' };
export const FEEDBACK_CHANNELS = { Web: 'WEB', 'Mobile App': 'MOBILE_APP', Email: 'EMAIL' };
export const FEEDBACK_PERIODS = { 'Last 7 days': '7d', 'Last 30 days': '30d', 'Last 90 days': '90d' };
const label = (value, values) => Object.keys(values).find((key) => values[key] === value) || '—';
export function feedbackTimestamp(value) {
  if (!feedbackText(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null;
}
export const feedbackRecordVersion = (value) => feedbackTimestamp(value) == null ? null : value;
export function feedbackDate(value, time = false) {
  const parsed = feedbackTimestamp(value);
  return parsed == null ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', ...(time ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(new Date(parsed));
}
export const emptyFeedback = {
  id: '—', title: '—', excerpt: '—', body: '—', user: '—', email: '—', phone: '—', type: '—', topic: '—', channel: '—', status: '—',
  date: '—', time: '—', location: '—', timezone: '—', device: '—', resolution: '—', memberSince: '—', totalFeedback: '—', assignee: '—', assignedToId: null, resolvedOn: '—',
  tags: null, unread: null, note: null, noteKnown: false, noteAuthor: '—', noteAt: '—', reply: null, raterId: null, userType: '—', submitterType: null, version: null,
  statusEvent: { title: '—', detail: '—' }, acknowledgementEvent: { title: '—', detail: '—' }, sourceData: {},
};
export function adaptFeedback(dto) {
  const user = feedbackObject(dto.user), device = feedbackObject(dto.device), note = feedbackObject(dto.note), assignee = feedbackObject(dto.assignee);
  const submitterType = ['USER', 'ADMIN'].includes(dto.submitterType) ? dto.submitterType : ['USER', 'ADMIN'].includes(user.type) ? user.type : null;
  const role = feedbackText(user.role);
  return {
    ...emptyFeedback, id: dto.id, title: feedbackText(dto.title) || '—', excerpt: feedbackText(dto.excerpt) || '—', body: feedbackText(dto.body) || '—',
    raterId: feedbackText(dto.userId) || feedbackText(user.id), user: feedbackText(dto.userName) || feedbackText(user.name) || '—', email: feedbackText(dto.email) || feedbackText(user.email) || '—',
    submitterType, userType: role ? role.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) : submitterType === 'ADMIN' ? 'Admin' : '—',
    type: label(dto.type, FEEDBACK_TYPES), status: label(dto.status, FEEDBACK_STATUSES), channel: label(dto.channel, FEEDBACK_CHANNELS), topic: feedbackText(dto.topic) || '—',
    date: feedbackDate(dto.submittedAt), time: feedbackDate(dto.submittedAt, true), version: feedbackRecordVersion(dto.version),
    unread: typeof dto.isRead === 'boolean' ? !dto.isRead : null, assignedToId: feedbackText(dto.assignedToId), assignee: feedbackText(assignee.name) || '—',
    location: feedbackText(user.location) || '—', timezone: feedbackText(user.timezone) || '—', totalFeedback: feedbackCount(user.totalFeedback),
    device: feedbackText(device.label) || [feedbackText(device.browser), feedbackText(device.os)].filter(Boolean).join(' · ') || '—',
    // The feedback's resolution text is not a device screen resolution.
    resolution: feedbackText(device.screenResolution) || '—', resolvedOn: feedbackDate(dto.resolvedAt),
    tags: Array.isArray(dto.tags) && dto.tags.every((tag) => feedbackText(tag)) && new Set(dto.tags).size === dto.tags.length ? dto.tags : null,
    note: typeof note.text === 'string' ? note.text : null, noteKnown: dto.note === null || typeof note.text === 'string',
    noteAuthor: feedbackText(feedbackObject(note.author).name) || '—', noteAt: feedbackDate(note.updatedAt), sourceData: dto,
  };
}
// Collection keys and numeric pagination are defined by the deployed response examples.
export function feedbackCollection(dto, kind = 'feedback') {
  const key = { feedback: 'feedback', agents: 'assignees', history: 'events', related: 'related' }[kind];
  const rows = key ? feedbackObject(dto)[key] : null;
  if (!Array.isArray(rows)) return null;
  const seen = new Set();
  for (const row of rows) {
    if (!feedbackText(row?.id) || seen.has(row.id)) return null;
    const fields = kind === 'agents' ? ['name', 'role', 'isActive'] : kind === 'history' ? ['type', 'timestamp', 'title'] : ['title', 'submittedAt', 'status'];
    if (!fields.every(key => Object.hasOwn(feedbackObject(row), key))) return null;
    seen.add(row.id);
  }
  return rows;
}
export function feedbackPagination(dto, page, limit, length) {
  const meta = feedbackObject(feedbackObject(dto).pagination), total = feedbackInteger(meta.total), pages = feedbackInteger(meta.totalPages);
  if (!['page', 'limit', 'total', 'totalPages'].every(key => typeof meta[key] === 'number')) return null;
  if (feedbackInteger(meta.page) !== page || feedbackInteger(meta.limit) !== limit || total == null || pages == null
    || (total === 0 ? ![0, 1].includes(pages) : pages !== Math.ceil(total / limit)) || length > limit || length !== Math.min(limit, Math.max(0, total - (page - 1) * limit))) return null;
  return { total, pages: Math.max(1, pages) };
}
function percentage(value) { const number = feedbackNumber(value); return number != null && number >= 0 && number <= 100 ? number : null; }
export const feedbackPercentage = (value) => percentage(value) == null ? '—' : `${percentage(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%`;
export function adaptFeedbackSummary(dto) {
  const allTime = feedbackObject(dto.allTime), period = feedbackObject(dto.period);
  const summary = { total: feedbackCount(allTime.total), topics: null, totalInPeriod: feedbackInteger(period.total) };
  for (const [name, code] of Object.entries(FEEDBACK_STATUSES)) {
    const metric = feedbackObject(allTime[{ OPEN: 'open', IN_PROGRESS: 'inProgress', RESOLVED: 'resolved' }[code]]);
    if (code === 'SPAM') { summary[name] = { count: feedbackCount(allTime.spam), percentage: '—' }; continue; }
    summary[name] = { count: feedbackCount(metric.count), percentage: feedbackPercentage(metric.percentage) };
  }
  summary.types = Object.entries(FEEDBACK_TYPES).map(([name, code]) => {
    const metric = feedbackObject(feedbackObject(period.byType)[code]);
    return { name, count: feedbackInteger(metric.count), percentage: percentage(metric.percentage) };
  });
  if (Array.isArray(period.topTopics) && period.topTopics.every((item) => feedbackText(item?.topic)) && new Set(period.topTopics.map((item) => item.topic)).size === period.topTopics.length)
    summary.topics = period.topTopics.map((item) => [item.topic, feedbackCount(item.count)]);
  const colors = ['#12ad69', '#287bed', '#f14b75', '#afb6ca'], total = summary.totalInPeriod;
  let start = 0;
  summary.ringBackground = total > 0 && summary.types.every((entry) => entry.count != null) && summary.types.reduce((sum, entry) => sum + entry.count, 0) === total
    ? `conic-gradient(${summary.types.map((entry, index) => { const end = start + entry.count / total * 100; const segment = `${colors[index]} ${start}% ${end}%`; start = end; return segment; }).join(', ')})` : '#afb6ca';
  summary.ringLabel = `"${feedbackCount(total)}\\A Total"`;
  return summary;
}
export function adaptFeedbackHistory(dto) {
  const actor = feedbackObject(dto.actor), time = feedbackTimestamp(dto.timestamp);
  return { id: dto.id, type: feedbackText(dto.type), title: feedbackText(dto.title) || '—', description: feedbackText(dto.description) || '—', actor: feedbackText(actor.name) || '—',
    date: feedbackDate(dto.timestamp), time: feedbackDate(dto.timestamp, true), timestamp: time,
    detail: [feedbackText(dto.description), feedbackText(actor.name), time == null ? null : `${feedbackDate(dto.timestamp)} at ${feedbackDate(dto.timestamp, true)}`].filter(Boolean).join('\n') || '—', reply: { message: feedbackText(feedbackObject(dto.reply).message), delivery: feedbackObject(feedbackObject(dto.reply).delivery) } };
}
export function feedbackReplyDelivery(raw) {
  const dto = feedbackObject(raw);
  return dto.inApp === 'DELIVERED' && ['QUEUED', 'FAILED'].includes(dto.push) && ['SENT', 'FAILED', 'NOT_CONFIGURED'].includes(dto.email)
    ? { inApp: dto.inApp, push: dto.push, email: dto.email } : null;
}
export function feedbackReplyMessage(raw) {
  const delivery = feedbackReplyDelivery(raw);
  if (!delivery) return 'Reply recorded; delivery details are unavailable.';
  return ['Reply delivered in-app', delivery.push === 'QUEUED' ? 'push queued' : 'push delivery failed',
    delivery.email === 'SENT' ? 'email sent' : delivery.email === 'FAILED' ? 'email delivery failed' : 'email not configured'].join('; ') + '.';
}
export function feedbackHistoryPreview(rows = []) {
  const status = rows.find((row) => ['STATUS', 'SPAM', 'REPLY'].includes(row.type)), acknowledged = rows.find((row) => row.type === 'ACKNOWLEDGED'), reply = rows.find((row) => row.type === 'REPLY');
  return { statusEvent: status || emptyFeedback.statusEvent, acknowledgementEvent: acknowledged || emptyFeedback.acknowledgementEvent, reply: feedbackText(reply?.reply?.message) };
}
export function feedbackFilters({ search = '', status, type, channel, date = '', tab } = {}) {
  const result = {};
  for (const [key, value, choices] of [['status', status, FEEDBACK_STATUSES], ['type', type, FEEDBACK_TYPES], ['channel', channel, FEEDBACK_CHANNELS]]) {
    if (value && value !== 'All') { const code = choices[value]; if (!code) throw new Error('Choose supported feedback filters.'); result[key] = code; }
  }
  if (tab && tab !== 'All Feedback') {
    if (!FEEDBACK_STATUSES[tab]) throw new Error('Choose a supported feedback tab.');
    if (result.status && result.status !== FEEDBACK_STATUSES[tab]) return { params: result, incompatible: true };
    result.status = FEEDBACK_STATUSES[tab];
  }
  if (feedbackText(search)) result.search = search.trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || feedbackTimestamp(`${date}T00:00:00+01:00`) == null) throw new Error('Choose a valid Lagos calendar date.');
    result.dateFrom = date; result.dateTo = date;
  }
  return { params: result, incompatible: false };
}
export const feedbackDetailUrl = (id, { page, search } = {}) => `/feedback/detail?${new URLSearchParams({ feedbackId: id, ...(Number.isSafeInteger(page) && page > 0 ? { page: String(page) } : {}), ...(feedbackText(search) ? { search } : {}) })}`;
export const feedbackUnavailable = (action) => window.alert(`${action} is not supported by the documented feedback API.`);
