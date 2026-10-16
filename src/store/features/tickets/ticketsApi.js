import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const failure = (error, status = 'CUSTOM_ERROR') => ({ error: { status, error } });
const count = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
export const ticketCount = (value) => count(value) == null ? '—' : count(value).toLocaleString('en-NG');
export const TICKET_STATUS_CODES = { Open: 'OPEN', 'In Progress': 'IN_PROGRESS', Pending: 'PENDING', Resolved: 'RESOLVED', Closed: 'CLOSED' };
export const TICKET_PRIORITY_CODES = { High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW' };
export const TICKET_CATEGORY_CODES = { 'Delivery Delay': 'DELIVERY_DELAY', 'Payment Issue': 'PAYMENT_ISSUE', Dispute: 'DISPUTE', 'Driver Issue': 'DRIVER_ISSUE', 'Document Query': 'DOCUMENT_QUERY', General: 'GENERAL' };
const STATUS_LABELS = { OPEN: 'Open', IN_PROGRESS: 'In Progress', PENDING: 'Pending', ESCALATED: 'Escalated', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const PRIORITY_LABELS = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const CATEGORY_LABELS = Object.fromEntries(Object.entries(TICKET_CATEGORY_CODES).map(([label, code]) => [code, label]));
const SOURCE_LABELS = { APP: 'App', ADMIN_TICKET: 'Admin Ticket', ADMIN_MESSAGE: 'Admin Message' };
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value) {
  const time = timestamp(value);
  return time == null ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(time));
}
function age(value) {
  const time = timestamp(value);
  if (time == null || time > Date.now()) return '—';
  const days = Math.floor((Date.now() - time) / 86400000);
  return days === 0 ? 'Created today' : `Created ${days} ${days === 1 ? 'day' : 'days'} ago`;
}
export function ticketFileUrl(value) {
  if (!text(value)) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function attachment(value) {
  const file = record(value), url = ticketFileUrl(typeof value === 'string' ? value : file.url);
  if (!url) return null;
  let name = text(file.name);
  if (!name) { try { name = decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch { /* Unavailable filename. */ } }
  const bytes = count(file.sizeBytes);
  const size = bytes == null ? '—' : bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  return { url, name: name || '—', size, icon: /^image\//.test(text(file.mimeType) || '') || /\.(png|jpe?g|webp)$/i.test(name || '') ? 'image' : 'file-text' };
}
const personName = (user) => text(user.name) || [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || '—';
const ticketActorName = (actor) => text(record(actor).name) || '—';
const mergedTicketId = (value) => text(record(value).id) || text(value);
const isMergedTicket = (ticket) => ticket.mergedInto != null;
const matchesTicketField = (ticket, key, value) => ticket[key] === value || key === 'status' && value === 'CLOSED' && ticket.status === 'RESOLVED';
function ticketEntryIds(ticket) {
  if (!Array.isArray(ticket.messages) || !Array.isArray(ticket.notes)) return null;
  const entries = [...ticket.messages, ...ticket.notes], ids = entries.map((entry) => text(entry?.id));
  return ids.every(Boolean) && new Set(ids).size === ids.length ? ids : null;
}
function containsMovedEntries(source, target) {
  return ['messages', 'notes'].every((section) => source[section].every((entry) => target[section].some((saved) => (
    saved.id === entry.id && saved.content === entry.content && saved.threadId === target.id
  ))));
}
export const emptyTicket = {
  id: '—', subject: '—', subjectValue: null, userId: null, customer: '—', email: '—', company: '—', category: '—', categoryKnown: false, categoryCode: null,
  subcategory: '—', priority: '—', priorityCode: null, status: '—', statusCode: null, assignee: '—', assignedTo: null,
  source: '—', created: '—', createdBy: '—', createdAge: '—', updated: '—', description: '—', attachments: [], attachmentsKnown: false,
  messages: [], messagesKnown: false, history: [], mergedInto: null, sourceData: {},
};
function adaptTicket(dto, currentAdmin) {
  const user = record(dto.user), assignedAdmin = record(dto.assignedAdmin);
  const statusCode = text(dto.status), priorityCode = text(dto.priority), categoryCode = text(dto.category);
  const customer = personName(user), assignedTo = text(dto.assignedTo);
  const publicKnown = Array.isArray(dto.messages), notesKnown = Array.isArray(dto.notes);
  const allEntries = [...(publicKnown ? dto.messages.map((item) => ({ item, internal: false })) : []), ...(notesKnown ? dto.notes.map((item) => ({ item, internal: true })) : [])];
  const entries = allEntries.filter(({ item }) => text(item?.id));
  const entriesKnown = entries.length === allEntries.length;
  const messages = entries.map(({ item, internal }) => {
    const message = record(item), sender = record(message.sender);
    const senderType = text(sender.type) || text(message.senderType), senderId = text(sender.id) || text(message.senderId);
    return {
      id: text(message.id), senderId, senderType,
      author: text(sender.name) || (senderType === 'USER' && senderId === (text(user.id) || text(dto.userId)) ? customer
        : senderType === 'ADMIN' && senderId === currentAdmin?.id ? personName(record(currentAdmin)) : '—'),
      role: internal ? 'Internal Note' : senderType === 'USER' ? 'Ticket Creator' : senderType === 'ADMIN' ? 'Support Agent' : '—',
      internal, body: text(message.content) || '—', time: date(message.createdAt), timestamp: timestamp(message.createdAt),
    };
  }).sort((a, b) => a.timestamp != null && b.timestamp != null ? a.timestamp - b.timestamp : 0);
  const fileLists = entries.map(({ item }) => Array.isArray(item?.attachments) ? item.attachments : Array.isArray(item?.attachmentUrls) ? item.attachmentUrls : null);
  const attachmentsKnown = publicKnown && notesKnown && entriesKnown && fileLists.every((list) => list && list.every((item) => attachment(item)));
  const files = new Map();
  fileLists.forEach((list) => (list || []).forEach((item) => { const file = attachment(item); if (file) files.set(file.url, file); }));
  // Only the two existing update slots follow the creation slot; no timeline rows are added.
  const history = Array.isArray(dto.statusHistory) ? dto.statusHistory.map((item) => ({
    time: date(item?.createdAt), timestamp: timestamp(item?.createdAt), description: text(item?.description) || '—',
    actor: ticketActorName(item?.actor),
  })).filter((item) => item.timestamp != null && item.timestamp !== timestamp(dto.createdAt)).sort((a, b) => a.timestamp - b.timestamp).slice(-2) : [];
  return {
    ...emptyTicket, id: dto.id, subject: text(dto.subject) || '—', subjectValue: text(dto.subject), userId: text(user.id) || text(dto.userId), customer,
    email: text(user.email) || '—', company: text(user.businessName) || '—',
    category: CATEGORY_LABELS[categoryCode] || '—', categoryKnown: Boolean(CATEGORY_LABELS[categoryCode]), categoryCode: CATEGORY_LABELS[categoryCode] ? categoryCode : null,
    subcategory: text(dto.subcategory) || '—', priority: PRIORITY_LABELS[priorityCode] || '—', priorityCode: PRIORITY_LABELS[priorityCode] ? priorityCode : null,
    status: STATUS_LABELS[statusCode] || '—', statusCode: STATUS_LABELS[statusCode] ? statusCode : null,
    assignedTo, assignee: assignedAdmin.id === assignedTo && text(assignedAdmin.name) ? text(assignedAdmin.name)
      : assignedTo && assignedTo === currentAdmin?.id ? personName(record(currentAdmin)) : '—',
    source: SOURCE_LABELS[dto.source] || '—', created: date(dto.createdAt), createdBy: ticketActorName(dto.createdBy), createdAge: age(dto.createdAt), updated: date(dto.updatedAt),
    description: text(dto.description) || '—', messages, messagesKnown: publicKnown && notesKnown && entriesKnown,
    attachments: [...files.values()], attachmentsKnown, history, mergedInto: mergedTicketId(dto.mergedInto), sourceData: dto,
  };
}
export function ticketWithAgents(ticket, agents = []) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return {
    ...ticket, assignee: names.get(ticket.assignedTo) || ticket.assignee,
    messages: ticket.messages.map((message) => ({ ...message, author: message.author === '—' && message.senderType === 'ADMIN' ? names.get(message.senderId) || message.author : message.author })),
  };
}
function change(value) {
  const number = typeof value === 'number' ? value : NaN;
  return { delta: Number.isFinite(number) ? `${Math.abs(number).toLocaleString('en-NG', { maximumFractionDigits: 2 })}%` : '—', direction: Number.isFinite(number) && number !== 0 ? number > 0 ? 'up' : 'down' : null };
}
export function ticketSummary(_rows, stats) {
  return {
    total: ticketCount(stats?.totalThreads), open: ticketCount(stats?.openThreads), progress: ticketCount(stats?.inProgressThreads),
    pending: ticketCount(stats?.pendingThreads), resolved: ticketCount(stats?.resolvedThreads),
    changes: Object.fromEntries(['total', 'open', 'progress', 'pending', 'resolved'].map((key) => [key, change(stats?.changes?.period === '7d' ? stats.changes[key === 'progress' ? 'inProgress' : key] : null)])),
  };
}
export const ticketDetailUrl = (id) => `/tickets/detail?ticketId=${encodeURIComponent(id)}`;
export function downloadTicketAttachment(file) {
  const url = ticketFileUrl(file?.url);
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = file.name; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
}
async function readAll(baseQuery, url, collection, params = {}) {
  const rows = [], seen = new Set();
  let page = 1, totalPages = 1, total = null;
  do {
    if (page > 500) return failure('The support directory exceeds the supported page count.');
    const result = await baseQuery({ url, params: { ...params, page, limit: 100 } });
    if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
    if (!Array.isArray(dto[collection]) || count(pagination.page) !== page || count(pagination.total) == null || count(pagination.totalPages) == null
      || (count(pagination.total) > 0 && count(pagination.totalPages) === 0) || page > Math.max(1, count(pagination.totalPages))) return failure('The support response is missing valid records or pagination.');
    if (total != null && (total !== count(pagination.total) || totalPages !== Math.max(1, count(pagination.totalPages)))) return failure('The support directory changed while loading. Refresh to load it again.');
    total = count(pagination.total); totalPages = Math.max(1, count(pagination.totalPages));
    if (page < totalPages && dto[collection].length === 0) return failure('The support response returned an incomplete collection.');
    for (const row of dto[collection]) {
      if (!text(row?.id) || seen.has(row.id)) return failure('The support response returned missing or duplicate IDs.');
      seen.add(row.id); rows.push(row);
    }
    page += 1;
  } while (page <= totalPages);
  return rows.length === total ? { data: rows } : failure('The support response did not return the complete directory.');
}
const path = (id) => `/admin/support/threads/${encodeURIComponent(id)}`;
const account = (api) => api.getState().auth.admin;
const owns = (api, owner) => !api.signal.aborted && Boolean(api.getState().auth.accessToken && owner?.id && account(api)?.id === owner.id && account(api)?.role === owner.role);
const sessionError = () => failure('The admin session changed. Sign in and review the ticket again.', 401);
async function readTicket(id, baseQuery) {
  if (!text(id)) return failure('A ticket ID is required.');
  const result = await baseQuery(path(id));
  if (result.error) return result;
  const data = record(unwrapApiResponseData(result.data)), dto = data.thread && typeof data.thread === 'object' ? record(data.thread) : data;
  return dto.id === id ? { data: dto } : failure('The support response did not identify this ticket.');
}
const ticketTags = (id) => [{ type: 'AdminSupportTickets', id: 'LIST' }, { type: 'AdminSupportTickets', id }];
export const ticketsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminSupportTickets', 'AdminTicketAgents'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminSupportTicketDirectory: builder.query({
      async queryFn({ search, priority, status, category } = {}, api, _options, baseQuery) {
        if (priority && !Object.values(TICKET_PRIORITY_CODES).includes(priority) || status && ![...Object.values(TICKET_STATUS_CODES), 'ESCALATED'].includes(status)
          || category && !Object.values(TICKET_CATEGORY_CODES).includes(category)) return failure('Select supported ticket filters.');
        const owner = account(api), params = { tab: 'all' };
        if (text(search)) params.search = search.trim();
        if (priority) params.priority = priority;
        if (status) params.status = status;
        if (category) params.category = category;
        const result = await readAll(baseQuery, '/admin/support/threads', 'threads', params);
        if (!owns(api, owner)) return sessionError();
        return result.error ? result : { data: result.data.map((row) => adaptTicket(row, owner)) };
      }, providesTags: [{ type: 'AdminSupportTickets', id: 'LIST' }],
    }),
    getAdminSupportTicketStats: builder.query({
      query: () => '/admin/support/stats', transformResponse: (response) => record(record(unwrapApiResponseData(response)).stats),
      providesTags: [{ type: 'AdminSupportTickets', id: 'LIST' }],
    }),
    getAdminSupportTicketDetail: builder.query({
      async queryFn(id, api, _options, baseQuery) {
        const owner = account(api), result = await readTicket(id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        return result.error ? result : { data: adaptTicket(result.data, owner) };
      }, providesTags: (_result, _error, id) => [{ type: 'AdminSupportTickets', id }],
    }),
    getAdminTicketAgents: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        const owner = account(api), result = await readAll(baseQuery, '/admin/support/agents', 'agents', { includeInactive: 'false' });
        if (!owns(api, owner)) return sessionError();
        return result.error ? result : { data: result.data.filter((agent) => text(agent.name)).map((agent) => ({ id: agent.id, name: agent.name.trim(), isActive: typeof agent.isActive === 'boolean' ? agent.isActive : null })) };
      }, providesTags: ['AdminTicketAgents'],
    }),
    createAdminSupportTicket: builder.mutation({
      async queryFn({ values }, api, _options, baseQuery) {
        const owner = account(api);
        if (!owns(api, owner)) return sessionError();
        const form = record(values), category = TICKET_CATEGORY_CODES[form.category], priority = TICKET_PRIORITY_CODES[form.priority];
        if (!text(form.subject) || !text(form.description) || !text(form.email) || !category || !priority) return failure('Enter the subject, existing customer email, category, priority and description.');
        const body = { subject: form.subject.trim(), email: form.email.trim(), category, priority, description: form.description.trim(), ...(text(form.customer) ? { customerName: form.customer.trim() } : {}) };
        const result = await baseQuery({ url: '/admin/support/tickets', method: 'POST', body });
        if (!owns(api, owner)) return sessionError();
        if (result.error) return result;
        const dto = record(record(unwrapApiResponseData(result.data)).thread);
        if (!text(dto.id)) return failure('Creation was accepted but the ticket ID was not returned. Refresh the list before creating it again.');
        if (['subject', 'category', 'priority', 'description'].some((key) => dto[key] !== body[key])
          || text(record(dto.user).email)?.toLowerCase() !== body.email.toLowerCase()) return failure('Creation was accepted but the returned ticket could not be confirmed. Refresh the list before creating it again.');
        const check = await readTicket(dto.id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (check.error || ['subject', 'category', 'priority', 'description'].some((key) => check.data[key] !== body[key])
          || text(record(check.data.user).email)?.toLowerCase() !== body.email.toLowerCase()) return failure('Creation was accepted but the saved ticket could not be confirmed. Refresh the list before creating it again.');
        return { data: adaptTicket(check.data, owner) };
      }, invalidatesTags: [{ type: 'AdminSupportTickets', id: 'LIST' }],
    }),
    updateAdminSupportTicket: builder.mutation({
      async queryFn({ id, changes, expectedUpdatedAt }, api, _options, baseQuery) {
        const owner = account(api), body = record(changes), keys = Object.keys(body);
        if (!owns(api, owner)) return sessionError();
        if (!text(id) || !keys.length || keys.some((key) => !['status', 'priority', 'assignedTo', 'subject', 'category'].includes(key))
          || body.status !== undefined && ![...Object.values(TICKET_STATUS_CODES), 'ESCALATED'].includes(body.status)
          || body.priority !== undefined && !Object.values(TICKET_PRIORITY_CODES).includes(body.priority)
          || body.category !== undefined && !Object.values(TICKET_CATEGORY_CODES).includes(body.category)
          || body.subject !== undefined && (!text(body.subject) || body.subject.length > 200)
          || body.assignedTo !== undefined && body.assignedTo !== null && !text(body.assignedTo)) return failure('This ticket change is not supported by the API.');
        const current = await readTicket(id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (current.error) return current;
        if (isMergedTicket(current.data)) return failure('Merged tickets cannot be edited.', 409);
        if (expectedUpdatedAt && current.data.updatedAt !== expectedUpdatedAt) return failure('The ticket changed. Refresh and review it before saving.', 409);
        const result = await baseQuery({ url: path(id), method: 'PATCH', body });
        if (!owns(api, owner)) return sessionError();
        if (result.error) return result;
        const response = record(unwrapApiResponseData(result.data)), returned = record(response.thread);
        const changed = keys.filter((key) => !matchesTicketField(current.data, key, body[key]));
        if (returned.id !== id || keys.some((key) => !matchesTicketField(returned, key, body[key]))
          || !Array.isArray(response.changedFields) || !response.changedFields.every((field) => text(field))
          || changed.some((key) => !response.changedFields.includes(key))) return failure('The update was accepted but its returned ticket or changed fields could not be confirmed. Refresh before trying again.');
        const check = await readTicket(id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (check.error || keys.some((key) => !matchesTicketField(check.data, key, body[key]))) return failure('The update was accepted but could not be confirmed. Refresh before trying again.');
        return { data: adaptTicket(check.data, owner) };
      }, invalidatesTags: (_result, _error, { id }) => [...ticketTags(id), 'AdminTicketAgents'],
    }),
    uploadAdminTicketReplyAttachments: builder.mutation({
      async queryFn({ id, files }, api, _options, baseQuery) {
        const owner = account(api);
        if (!owns(api, owner)) return sessionError();
        if (!text(id) || !Array.isArray(files) || files.length < 1 || files.length > 5 || files.some((file) => !(file instanceof File)
          || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)) return failure('Choose 1-5 JPEG, PNG, WebP or PDF files, up to 10 MB each.');
        const body = new FormData(); files.forEach((file) => body.append('files', file));
        const result = await baseQuery({ url: path(id) + '/attachments', method: 'POST', body });
        if (!owns(api, owner)) return sessionError();
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (!Array.isArray(dto.urls) || dto.urls.length !== files.length || !dto.urls.every((url) => ticketFileUrl(url))) return failure('The uploaded attachment URLs could not be confirmed.');
        return { data: dto.urls };
      },
    }),
    sendAdminTicketReply: builder.mutation({
      async queryFn(args, api, _options, baseQuery) { return sendEntry(args, false, api, baseQuery); },
      invalidatesTags: (_result, _error, { id }) => ticketTags(id),
    }),
    addAdminTicketNote: builder.mutation({
      async queryFn(args, api, _options, baseQuery) { return sendEntry(args, true, api, baseQuery); },
      invalidatesTags: (_result, _error, { id }) => ticketTags(id),
    }),
    mergeAdminSupportTicket: builder.mutation({
      async queryFn({ id, targetThreadId }, api, _options, baseQuery) {
        const owner = account(api);
        if (!owns(api, owner)) return sessionError();
        if (!text(id) || !text(targetThreadId) || id === targetThreadId) return failure('Choose another ticket belonging to the same customer.');
        const source = await readTicket(id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (source.error) return source;
        const target = await readTicket(targetThreadId, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (target.error) return target;
        const userId = text(source.data.userId) || text(record(source.data.user).id), targetUser = text(target.data.userId) || text(record(target.data.user).id);
        if (!userId || userId !== targetUser || isMergedTicket(source.data) || isMergedTicket(target.data)) return failure('Both tickets must belong to the same customer and must not already be merged.');
        const sourceEntries = ticketEntryIds(source.data);
        if (!sourceEntries) return failure('The source ticket conversation is incomplete. Refresh before merging.');
        const result = await baseQuery({ url: path(id) + '/merge', method: 'POST', body: { targetThreadId } });
        if (!owns(api, owner)) return sessionError();
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        const returned = record(dto.thread), movedMessages = count(dto.movedMessages), returnedEntries = ticketEntryIds(returned);
        if (dto.survivingThreadId !== targetThreadId || dto.mergedThreadId !== id || returned.id !== targetThreadId
          || movedMessages == null || movedMessages < sourceEntries.length || isMergedTicket(returned)
          || !returnedEntries || !containsMovedEntries(source.data, returned)) return failure('The merge was accepted but its result could not be confirmed. Refresh before trying again.');
        const check = await readTicket(targetThreadId, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (check.error || isMergedTicket(check.data) || (text(check.data.userId) || text(record(check.data.user).id)) !== userId) return failure('The merge was accepted but the surviving ticket could not be loaded. Refresh the list before trying again.');
        const savedEntries = ticketEntryIds(check.data);
        if (!savedEntries || !containsMovedEntries(source.data, check.data)) return failure('The merge was accepted but the moved messages and notes could not be confirmed. Refresh the list before trying again.');
        const sourceCheck = await readTicket(id, baseQuery);
        if (!owns(api, owner)) return sessionError();
        if (sourceCheck.error || mergedTicketId(sourceCheck.data.mergedInto) !== targetThreadId || sourceCheck.data.status !== 'RESOLVED') return failure('The merge was accepted but the source ticket closure could not be confirmed. Refresh the list before trying again.');
        return { data: adaptTicket(check.data, owner) };
      }, invalidatesTags: (_result, _error, { id, targetThreadId }) => [...ticketTags(id), ...ticketTags(targetThreadId), 'AdminTicketAgents'],
    }),
  }),
});
async function sendEntry({ id, content, attachmentUrls = [] }, internal, api, baseQuery) {
  const owner = account(api);
  if (!owns(api, owner)) return sessionError();
  if (!text(id) || !text(content) || !Array.isArray(attachmentUrls) || !attachmentUrls.every((url) => ticketFileUrl(url))) return failure('Enter a message and valid attachments.');
  const body = { content: content.trim(), attachmentUrls }, section = internal ? 'notes' : 'messages';
  const result = await baseQuery({ url: path(id) + '/' + section, method: 'POST', body });
  if (!owns(api, owner)) return sessionError();
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  if (!text(dto.id) || dto.threadId !== id || dto.content !== body.content || internal && dto.isInternal !== true) return failure('The message was accepted but could not be confirmed. Refresh before sending it again.');
  const check = await readTicket(id, baseQuery);
  if (!owns(api, owner)) return sessionError();
  if (check.error || !Array.isArray(check.data[section]) || !check.data[section].some((entry) => entry?.id === dto.id && entry.content === body.content)) return failure('The message was accepted but could not be read back. Refresh before sending it again.');
  return { data: { id: dto.id, ticket: adaptTicket(check.data, owner) } };
}
export const {
  useGetAdminSupportTicketDirectoryQuery, useGetAdminSupportTicketStatsQuery, useGetAdminSupportTicketDetailQuery,
  useGetAdminTicketAgentsQuery, useCreateAdminSupportTicketMutation, useUpdateAdminSupportTicketMutation,
  useUploadAdminTicketReplyAttachmentsMutation, useSendAdminTicketReplyMutation, useAddAdminTicketNoteMutation, useMergeAdminSupportTicketMutation,
} = ticketsApi;
