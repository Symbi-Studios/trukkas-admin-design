import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
};
export const feedbackCount = (value) => count(value) == null ? '—' : count(value).toLocaleString('en-NG');
const labels = (value, options) => options.find((label) => label.toUpperCase().replaceAll(' ', '_') === text(value)?.toUpperCase().replaceAll(' ', '_')) || '—';
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value, withTime = false) {
  const time = timestamp(value);
  return time == null ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }) }).format(new Date(time));
}
export const emptyFeedback = {
  id: '—', title: '—', excerpt: '—', body: '—', user: '—', email: '—', phone: '—', type: '—', topic: '—', channel: '—', status: '—',
  date: '—', time: '—', location: '—', timezone: '—', device: '—', resolution: '—', memberSince: '—', totalFeedback: '—', assignee: '—', resolvedOn: '—',
  tags: null, unread: null, note: null, noteAuthor: '—', noteAt: '—', reply: null, raterId: null, userType: '—', statusEvent: { title: '—', detail: '—' }, acknowledgementEvent: { title: '—', detail: '—' },
};
function adaptRating(dto) {
  const rater = object(dto.rater), comment = text(dto.comment);
  return {
    ...emptyFeedback, id: dto.id, title: text(dto.title) || '—', excerpt: text(dto.excerpt) || comment || '—', body: comment || '—',
    raterId: text(dto.raterId) || text(rater.id), user: [text(rater.firstName), text(rater.lastName)].filter(Boolean).join(' ') || '—', email: text(rater.email) || '—',
    userType: { FORWARDER: 'Forwarder', TRUCKER: 'Trucker', DRIVER: 'Driver' }[rater.role] || '—',
    date: date(dto.createdAt), time: date(dto.createdAt, true),
    // Ratings and archive/read flags do not establish support-workflow states
    // or turn a numerical score into Praise / Suggestion / Issue.
    type: labels(dto.type, ['Praise', 'Suggestion', 'Issue', 'Other']), status: labels(dto.status, ['Open', 'In Progress', 'Resolved', 'Spam']),
    channel: labels(dto.channel, ['Web', 'Mobile App', 'Email']), topic: text(dto.topic) || '—',
    unread: typeof dto.adminRead === 'boolean' ? !dto.adminRead : null,
  };
}
export const feedbackDetailUrl = (id, { page, search }) => `/feedback/detail?${new URLSearchParams({ feedbackId: id, page: String(page), ...(search ? { search } : {}) })}`;
export const feedbackUnavailable = (action) => window.alert(`${action} is not supported by the documented feedback API.`);
export function selectCachedFeedback(state, id, owner) {
  for (const entry of Object.values(state[baseApi.reducerPath]?.queries || {})) {
    if (entry.endpointName !== 'getAdminFeedbackPage' || entry.originalArgs?.owner !== owner || entry.error) continue;
    const row = entry.data?.rows.find((item) => item.id === id);
    if (row) return row;
  }
  return null;
}
export const feedbackApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminFeedback'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminFeedbackPage: builder.query({
      async queryFn({ page = 1, search = '' }, _api, _options, baseQuery) {
        if (!Number.isSafeInteger(page) || page < 1) return { error: { status: 'CUSTOM_ERROR', error: 'Select a valid feedback page.' } };
        // This GET marks returned rows as read. Fetch only the requested page,
        // without directory prefetching or automatic polling/refetch on mount.
        const result = await baseQuery({ url: '/admin/feedback', params: { tab: 'feedback', page: String(page), limit: '8', ...(text(search) ? { search: search.trim() } : {}) } });
        if (result.error) return result;
        const dto = object(unwrapApiResponseData(result.data)), pagination = object(dto.pagination), seen = new Set();
        const valid = Array.isArray(dto.ratings) && dto.ratings.length <= 8 && count(pagination.limit) === 8 && count(pagination.page) === page && count(pagination.total) != null && count(pagination.totalPages) != null
          && (count(pagination.total) === 0 || count(pagination.totalPages) > 0);
        if (!valid) return { error: { status: 'CUSTOM_ERROR', error: 'The feedback API returned invalid records or pagination.' } };
        for (const row of dto.ratings) {
          if (!text(row?.id) || seen.has(row.id)) return { error: { status: 'CUSTOM_ERROR', error: 'The feedback API returned missing or duplicate IDs.' } };
          seen.add(row.id);
        }
        return { data: { rows: dto.ratings.map(adaptRating), total: count(pagination.total), pages: Math.max(1, count(pagination.totalPages)), stats: { total: count(dto.stats?.totalResponses) } } };
      }, providesTags: ['AdminFeedback'],
    }),
  }),
});
export const { useGetAdminFeedbackPageQuery } = feedbackApi;
