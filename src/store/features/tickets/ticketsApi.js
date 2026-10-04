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
export const TICKET_STATUS_CODES = { Open: 'OPEN', Resolved: 'RESOLVED', Closed: 'CLOSED' };
export const TICKET_PRIORITY_CODES = { High: 'HIGH', Medium: 'MEDIUM', Low: 'LOW' };
const STATUS_LABELS = { OPEN: 'Open', ESCALATED: 'Escalated', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const PRIORITY_LABELS = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const titleCase = (value) => text(value)?.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';
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
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function attachment(value) {
  const url = ticketFileUrl(value);
  if (!url) return null;
  let name = '—';
  try { name = decodeURIComponent(new URL(url).pathname.split('/').pop()) || '—'; } catch { /* Keep unavailable filename. */ }
  return { url, name, size: '—', icon: /\.(png|jpe?g|webp)$/i.test(name) ? 'image' : 'file-text' };
}
const personName = (user) => text(user.name) || [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || '—';
export const emptyTicket = {
  id: '—', subject: '—', customer: '—', email: '—', company: '—', category: '—', categoryKnown: false,
  subcategory: '—', priority: '—', priorityCode: null, status: '—', statusCode: null, assignee: '—', assignedTo: null,
  source: '—', created: '—', createdAge: '—', updated: '—', description: '—', attachments: [], attachmentsKnown: false,
  messages: [], messagesKnown: false,
};
function adaptTicket(dto, currentAdmin) {
  const user = record(dto.user), statusCode = text(dto.status)?.toUpperCase(), priorityCode = text(dto.priority)?.toUpperCase();
  const customer = personName(user), assignedTo = text(dto.assignedTo);
  const messagesKnown = Array.isArray(dto.messages);
  const messages = messagesKnown ? dto.messages.map((item) => {
    const message = record(item), senderType = text(message.senderType), senderId = text(message.senderId);
    return {
      id: text(message.id), senderId, senderType,
      author: senderType === 'USER' && senderId === (text(user.id) || text(dto.userId)) ? customer
        : senderType === 'ADMIN' && senderId === currentAdmin?.id ? personName(record(currentAdmin)) : '—',
      role: senderType === 'USER' ? 'Ticket Creator' : senderType === 'ADMIN' ? 'Support Agent' : '—',
      internal: false, body: text(message.content) || '—', time: date(message.createdAt),
    };
  }) : [];
  // The attachment section shows the real files attached to this conversation.
  const attachmentsKnown = messagesKnown && dto.messages.every((message) => Array.isArray(message?.attachmentUrls) && message.attachmentUrls.every((url) => ticketFileUrl(url)));
  const urls = messagesKnown ? [...new Set(dto.messages.flatMap((message) => Array.isArray(message?.attachmentUrls) ? message.attachmentUrls : []))] : [];
  return {
    ...emptyTicket, id: dto.id, subject: text(dto.subject) || '—', customer,
    email: text(user.email) || '—', company: text(user.businessName) || '—',
    category: titleCase(dto.category), categoryKnown: Boolean(text(dto.category)), subcategory: text(dto.subcategory) || '—',
    priority: PRIORITY_LABELS[priorityCode] || '—', priorityCode: PRIORITY_LABELS[priorityCode] ? priorityCode : null,
    status: STATUS_LABELS[statusCode] || '—', statusCode: STATUS_LABELS[statusCode] ? statusCode : null,
    assignedTo, assignee: assignedTo && assignedTo === currentAdmin?.id ? personName(record(currentAdmin)) : '—',
    source: text(dto.source) || '—', created: date(dto.createdAt), createdAge: age(dto.createdAt), updated: date(dto.updatedAt),
    description: text(dto.description) || '—', messages, messagesKnown,
    attachments: urls.map(attachment).filter(Boolean), attachmentsKnown,
  };
}
export function ticketWithAgents(ticket, agents = []) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return {
    ...ticket, assignee: names.get(ticket.assignedTo) || ticket.assignee,
    messages: ticket.messages.map((message) => ({ ...message, author: message.senderType === 'ADMIN' ? names.get(message.senderId) || message.author : message.author })),
  };
}
export function ticketSummary(rows, stats) {
  const statusesKnown = Array.isArray(rows) && rows.every((ticket) => ticket.statusCode);
  return {
    total: ticketCount(rows?.length),
    open: ticketCount(count(stats?.openThreads) ?? (statusesKnown ? rows.filter((ticket) => ticket.statusCode === 'OPEN').length : null)),
    // ESCALATED is not documented as either In Progress or Pending.
    progress: '—', pending: '—',
    resolved: ticketCount(statusesKnown ? rows.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.statusCode)).length : null),
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
const ticketTags = (id) => [{ type: 'AdminSupportTickets', id: 'LIST' }, { type: 'AdminSupportTickets', id }];
export const ticketsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminSupportTickets', 'AdminTicketAgents'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminSupportTicketDirectory: builder.query({
      async queryFn({ search, priority } = {}, api, _options, baseQuery) {
        if (priority && !Object.values(TICKET_PRIORITY_CODES).includes(priority)) return failure('Select a supported priority.');
        // The spec requires a string with no All sentinel or minimum length. Keep the unfiltered value empty.
        const result = await readAll(baseQuery, '/admin/support/threads', 'threads', { tab: 'all', priority: priority || '', ...(text(search) ? { search: search.trim() } : {}) });
        return result.error ? result : { data: result.data.map((row) => adaptTicket(row, api.getState().auth.admin)) };
      }, providesTags: [{ type: 'AdminSupportTickets', id: 'LIST' }],
    }),
    getAdminSupportTicketStats: builder.query({
      query: () => '/admin/support/stats', transformResponse: (response) => record(record(unwrapApiResponseData(response)).stats),
      providesTags: [{ type: 'AdminSupportTickets', id: 'LIST' }],
    }),
    getAdminSupportTicketDetail: builder.query({
      async queryFn(id, api, _options, baseQuery) {
        if (!text(id)) return failure('A ticket ID is required.');
        const result = await baseQuery(`/admin/support/threads/${encodeURIComponent(id)}`);
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (dto.id !== id) return failure('The support response did not identify this ticket.');
        return { data: adaptTicket(dto, api.getState().auth.admin) };
      }, providesTags: (_result, _error, id) => [{ type: 'AdminSupportTickets', id }],
    }),
    getAdminTicketAgents: builder.query({
      async queryFn(_args, api, _options, baseQuery) {
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return failure('Only Super Admins can view the admin account directory.', 403);
        const result = await readAll(baseQuery, '/admin/admins', 'admins');
        return result.error ? result : { data: result.data.filter((agent) => text(agent.name)).map((agent) => ({ id: agent.id, name: agent.name.trim(), isActive: typeof agent.isActive === 'boolean' ? agent.isActive : null })) };
      }, providesTags: ['AdminTicketAgents'],
    }),
    updateAdminSupportTicket: builder.mutation({
      async queryFn({ id, changes }, _api, _options, baseQuery) {
        const body = record(changes), keys = Object.keys(body);
        if (!text(id) || !keys.length || keys.some((key) => !['status', 'priority', 'assignedTo'].includes(key))
          || (body.status !== undefined && !['OPEN', 'RESOLVED', 'ESCALATED', 'CLOSED'].includes(body.status))
          || (body.priority !== undefined && !['HIGH', 'MEDIUM', 'LOW'].includes(body.priority))
          || (body.assignedTo !== undefined && !text(body.assignedTo))) return failure('This ticket change is not supported by the API.');
        const result = await baseQuery({ url: `/admin/support/threads/${encodeURIComponent(id)}`, method: 'PATCH', body });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)), thread = record(dto.thread);
        if (thread.id !== id || keys.some((key) => thread[key] !== body[key] && !(key === 'status' && body.status === 'CLOSED' && thread.status === 'RESOLVED'))) return failure('The ticket update could not be confirmed. Refresh before trying again.');
        return { data: { id: thread.id } };
      }, invalidatesTags: (_result, _error, { id }) => ticketTags(id),
    }),
    uploadAdminTicketReplyAttachments: builder.mutation({
      async queryFn({ id, files }, _api, _options, baseQuery) {
        if (!text(id) || !Array.isArray(files) || files.length < 1 || files.length > 5 || files.some((file) => !(file instanceof File)
          || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0)) return failure('Choose 1–5 JPEG, PNG, WebP or PDF files, up to 10 MB each.');
        const body = new FormData(); files.forEach((file) => body.append('files', file));
        const result = await baseQuery({ url: `/admin/support/threads/${encodeURIComponent(id)}/attachments`, method: 'POST', body });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (!Array.isArray(dto.urls) || dto.urls.length !== files.length || !dto.urls.every((url) => ticketFileUrl(url))) return failure('The uploaded attachment URLs could not be confirmed.');
        return { data: dto.urls };
      },
    }),
    sendAdminTicketReply: builder.mutation({
      async queryFn({ id, content, attachmentUrls = [] }, _api, _options, baseQuery) {
        if (!text(id) || !text(content) || !Array.isArray(attachmentUrls) || !attachmentUrls.every((url) => ticketFileUrl(url))) return failure('Enter a reply and valid attachments.');
        const body = { content: content.trim(), attachmentUrls };
        const result = await baseQuery({ url: `/admin/support/threads/${encodeURIComponent(id)}/messages`, method: 'POST', body });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (!text(dto.id) || dto.threadId !== id || dto.senderType !== 'ADMIN' || dto.content !== body.content) return failure('The reply could not be confirmed. Refresh before sending it again.');
        return { data: { id: dto.id } };
      }, invalidatesTags: (_result, _error, { id }) => ticketTags(id),
    }),
  }),
});
export const {
  useGetAdminSupportTicketDirectoryQuery, useGetAdminSupportTicketStatsQuery, useGetAdminSupportTicketDetailQuery,
  useGetAdminTicketAgentsQuery, useUpdateAdminSupportTicketMutation, useUploadAdminTicketReplyAttachmentsMutation, useSendAdminTicketReplyMutation,
} = ticketsApi;
