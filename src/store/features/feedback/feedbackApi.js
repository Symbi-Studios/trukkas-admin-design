import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import {
  feedbackText as text, feedbackObject as object, feedbackVersion as version, feedbackFailure as failure,
  feedbackCollection, feedbackPagination, feedbackFilters, feedbackTimestamp,
  adaptFeedback, adaptFeedbackSummary, adaptFeedbackHistory, FEEDBACK_STATUSES, FEEDBACK_TYPES,
} from './feedbackContracts.js';
export { emptyFeedback, feedbackCount, feedbackPercentage, feedbackDetailUrl, feedbackUnavailable, feedbackHistoryPreview, FEEDBACK_PERIODS } from './feedbackContracts.js';
const ROOT = '/admin/support/feedback';
const ADMIN_ROLES = ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'];
const path = (id) => ROOT + '/' + encodeURIComponent(id);
const sessionError = () => failure('The admin session changed. Sign in and review the feedback again.', 401);
function guarded(handler) {
  return async (args, api, _options, baseQuery) => {
    const role = api.getState().auth.admin?.role;
    const active = () => !api.signal.aborted && Boolean(api.getState().auth.accessToken && args.owner && api.getState().auth.admin?.id === args.owner && api.getState().auth.admin?.role === role && ADMIN_ROLES.includes(role));
    if (!active()) return sessionError();
    const result = await handler(args, baseQuery, active, role);
    return active() ? result : sessionError();
  };
}
async function readDetail(id, baseQuery) {
  if (!text(id)) return failure('A feedback ID is required.');
  const result = await baseQuery(path(id));
  if (result.error) return result;
  const dto = object(unwrapApiResponseData(result.data));
  return dto.id === id ? { data: dto } : failure('The response did not identify the requested feedback.');
}
async function readSettings(baseQuery) {
  const result = await baseQuery(ROOT + '/settings');
  if (result.error) return result;
  const dto = object(unwrapApiResponseData(result.data)), settings = object(dto.settings);
  if (!version(dto.version) || typeof settings.allowAppSubmissions !== 'boolean' || typeof settings.autoAcknowledge !== 'boolean'
    || !Array.isArray(settings.topics) || !settings.topics.every((topic) => text(topic))) return failure('The settings response is missing valid settings or a version.');
  return { data: { settings: { allowAppSubmissions: settings.allowAppSubmissions, autoAcknowledge: settings.autoAcknowledge, topics: settings.topics }, version: dto.version } };
}
async function readPage(url, params, kind, baseQuery) {
  const result = await baseQuery({ url, params });
  if (result.error) return result;
  const dto = unwrapApiResponseData(result.data), rows = feedbackCollection(dto, kind);
  if (!rows || rows.length > params.limit) return failure('The response does not contain an unambiguous valid feedback collection.');
  const meta = feedbackPagination(dto, params.page, params.limit, rows.length);
  return { data: { rows, total: meta?.total ?? null, pages: meta?.pages ?? null } };
}
async function readDirectory(url, kind, baseQuery, active, allowPartial = false) {
  const rows = [], seen = new Set();
  let page = 1, total = null, pages = 1;
  do {
    if (!active()) return sessionError();
    if (page > 500) return failure('The feedback collection exceeds the supported page count.');
    const result = await readPage(url, { page, limit: 100 }, kind, baseQuery);
    if (!active()) return sessionError();
    if (result.error) return result;
    const data = result.data;
    if (data.total == null || data.pages == null) return allowPartial && page === 1 ? { data: { rows: data.rows, complete: false } } : failure('The directory pagination is unavailable. Its response schema needs confirmation.');
    if (total != null && (total !== data.total || pages !== data.pages)) return failure('The feedback collection changed while loading. Refresh it again.');
    total = data.total; pages = data.pages;
    for (const row of data.rows) { if (seen.has(row.id)) return failure('The collection contains duplicate IDs.'); seen.add(row.id); rows.push(row); }
    page += 1;
  } while (page <= pages);
  return rows.length === total ? { data: { rows, complete: true } } : failure('The feedback collection is incomplete.');
}
export const feedbackApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminFeedback', 'AdminFeedbackAssignees', 'AdminFeedbackSettings'] }).injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminFeedbackPage: builder.query({
      queryFn: guarded(async ({ page = 1, ...filters }, baseQuery) => {
        if (!Number.isSafeInteger(page) || page < 1) return failure('Select a valid feedback page.');
        let parsed; try { parsed = feedbackFilters(filters); } catch (error) { return failure(error.message); }
        if (parsed.incompatible) return { data: { rows: [], total: 0, pages: 1 } };
        const result = await readPage(ROOT, { ...parsed.params, page, limit: 8 }, 'feedback', baseQuery);
        return result.error ? result : { data: { ...result.data, rows: result.data.rows.map(adaptFeedback) } };
      }), providesTags: ['AdminFeedback'],
    }),
    getAdminFeedbackSummary: builder.query({
      queryFn: guarded(async ({ period = '30d' }, baseQuery) => {
        if (!['7d', '30d', '90d'].includes(period)) return failure('Select a supported summary period.');
        const result = await baseQuery({ url: ROOT + '/summary', params: { period } });
        return result.error ? result : { data: adaptFeedbackSummary(object(unwrapApiResponseData(result.data))) };
      }), providesTags: ['AdminFeedback'],
    }),
    getAdminFeedbackDetail: builder.query({
      queryFn: guarded(async ({ id }, baseQuery) => { const result = await readDetail(id, baseQuery); return result.error ? result : { data: adaptFeedback(result.data) }; }),
      providesTags: ['AdminFeedback'],
    }),
    getAdminFeedbackAssignees: builder.query({
      queryFn: guarded(async (_args, baseQuery, active) => {
        const result = await readDirectory(ROOT + '/assignees', 'agents', baseQuery, active);
        return result.error ? result : { data: result.data.rows.filter((row) => row.isActive === true && text(row.name)).map((row) => ({ id: row.id, name: row.name.trim() })) };
      }), providesTags: ['AdminFeedbackAssignees'],
    }),
    getAdminFeedbackHistory: builder.query({
      queryFn: guarded(async ({ id, page = 1, all = false }, baseQuery, active) => {
        if (!text(id) || !Number.isSafeInteger(page) || page < 1) return failure('Choose valid feedback history.');
        const result = all ? await readDirectory(path(id) + '/history', 'history', baseQuery, active, true) : await readPage(path(id) + '/history', { page, limit: 20 }, 'history', baseQuery);
        return result.error ? result : { data: { ...result.data, rows: result.data.rows.map(adaptFeedbackHistory) } };
      }), providesTags: ['AdminFeedback'],
    }),
    getAdminRelatedFeedback: builder.query({
      queryFn: guarded(async ({ id }, baseQuery) => {
        if (!text(id)) return failure('A feedback ID is required.');
        const result = await baseQuery({ url: path(id) + '/related', params: { limit: 3 } });
        if (result.error) return result;
        const rows = feedbackCollection(unwrapApiResponseData(result.data));
        return !rows || rows.length > 3 || rows.some((row) => row.id === id) ? failure('The related feedback collection could not be confirmed.') : { data: rows.map(adaptFeedback) };
      }), providesTags: ['AdminFeedback'],
    }),
    getAdminFeedbackSettings: builder.query({
      queryFn: guarded((_args, baseQuery) => readSettings(baseQuery)), providesTags: ['AdminFeedbackSettings'],
    }),
    downloadAdminFeedback: builder.query({
      queryFn: guarded(async (filters, baseQuery) => {
        let parsed; try { parsed = feedbackFilters(filters); } catch (error) { return failure(error.message); }
        if (parsed.incompatible) return failure('The selected tab and status filters do not overlap.');
        const result = await baseQuery({ url: ROOT + '/export', params: { ...parsed.params, format: 'csv' }, headers: { Accept: 'text/csv' }, responseHandler: async (response) => {
          if (response.ok) return response.blob();
          const body = await response.text(); try { return JSON.parse(body); } catch { return { message: 'Unable to download feedback.' }; }
        } });
        if (result.error) return result;
        const blob = result.data;
        if (!(blob instanceof Blob) || !blob.size || !['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(blob.type.split(';')[0].toLowerCase())
          || /^\s*[<{\[]/.test(await blob.slice(0, 200).text())) return failure('The backend did not return a valid CSV download.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
        return { data: { content: btoa(binary), format: 'csv' } };
      }), keepUnusedDataFor: 0,
    }),
    changeAdminFeedback: builder.mutation({
      queryFn: guarded(changeFeedback),
      invalidatesTags: (_result, _error, args) => args.action === 'settings' ? ['AdminFeedbackSettings'] : ['AdminFeedback'],
    }),
  }),
});
async function changeFeedback({ owner, action, id, expectedVersion, values = {}, idempotencyKey }, baseQuery, active, role) {
  if (!['create', 'update', 'read', 'spam', 'tags', 'note', 'reply', 'settings'].includes(action)) return failure('This feedback operation is unavailable.');
  if (['create', 'spam', 'reply'].includes(action) && !text(idempotencyKey)) return failure('An idempotency key is required.');
  let body, request, before;
  if (action === 'create') {
    if (!text(values.title) || values.title.trim().length > 150 || !text(values.body) || values.body.trim().length > 5000 || !FEEDBACK_TYPES[values.type]) return failure('Enter a title up to 150 characters and feedback up to 5,000 characters, with a supported type.');
    body = { title: values.title.trim(), body: values.body.trim(), type: FEEDBACK_TYPES[values.type], idempotencyKey };
    request = { url: ROOT, method: 'POST', body };
  } else if (action === 'settings') {
    if (!['SUPER_ADMIN', 'OPS_ADMIN'].includes(role)) return failure('Only Super Admins and Ops Admins can change feedback settings.', 403);
    const current = await readSettings(baseQuery);
    if (!active()) return sessionError();
    if (current.error) return current;
    if (!version(expectedVersion) || current.data.version !== expectedVersion) return failure('The settings changed. Refresh and review them before saving.', 409);
    body = { expectedVersion };
    for (const [key, value] of Object.entries(values)) {
      if (!['allowAppSubmissions', 'autoAcknowledge', 'topics'].includes(key) || key !== 'topics' && typeof value !== 'boolean'
        || key === 'topics' && (!Array.isArray(value) || value.some((topic) => !text(topic)) || new Set(value).size !== value.length)) return failure('Enter valid feedback settings.');
      if (JSON.stringify(value) !== JSON.stringify(current.data.settings[key])) body[key] = value;
    }
    if (Object.keys(body).length === 1) return failure('There are no settings changes to save.');
    request = { url: ROOT + '/settings', method: 'PATCH', body };
  } else {
    if (!version(expectedVersion)) return failure('The feedback version is unavailable. Refresh before saving.');
    const current = await readDetail(id, baseQuery);
    if (!active()) return sessionError();
    if (current.error) return current;
    before = current.data;
    if (before.version !== expectedVersion) return failure('The feedback changed. Refresh and review it before saving.', 409);
    body = { expectedVersion };
    if (action === 'update') {
      if (values.status !== undefined) { if (!FEEDBACK_STATUSES[values.status]) return failure('Select a supported status.'); body.status = FEEDBACK_STATUSES[values.status]; }
      if (Object.hasOwn(values, 'assignedToId')) { if (values.assignedToId !== null && !text(values.assignedToId)) return failure('Select a valid assignee.'); body.assignedToId = values.assignedToId; }
      if (Object.keys(body).length === 1) return failure('There are no feedback changes to save.');
      request = { url: path(id), method: 'PATCH', body };
    } else if (action === 'read') {
      if (typeof values.isRead !== 'boolean') return failure('A read state is required.');
      body.isRead = values.isRead; request = { url: path(id) + '/read', method: 'POST', body };
    } else if (action === 'spam') {
      body.idempotencyKey = idempotencyKey; request = { url: path(id) + '/spam', method: 'POST', body };
    } else if (action === 'tags') {
      if (!Array.isArray(before.tags) || before.tags.some((tag) => !text(tag))) return failure('The current tags are unavailable. Refresh before adding a tag.');
      const tag = text(values.tag)?.toLowerCase();
      if (!tag || tag.length > 40 || before.tags.length >= 20 || before.tags.some((item) => item.toLowerCase() === tag)) return failure('Enter a new tag up to 40 characters; at most 20 tags are allowed.');
      body.tags = [...before.tags, tag]; request = { url: path(id) + '/tags', method: 'PATCH', body };
    } else if (action === 'note') {
      if (typeof values.text !== 'string' || values.text.length > 5000) return failure('Enter a note up to 5,000 characters.');
      body.text = values.text; request = { url: path(id) + '/note', method: 'PATCH', body };
    } else if (action === 'reply') {
      if (before.submitterType !== 'USER') return failure('Replies are available only for feedback submitted by app users.');
      if (!text(values.message) || values.message.trim().length > 5000) return failure('Enter a reply up to 5,000 characters.');
      body.message = values.message.trim(); body.idempotencyKey = idempotencyKey; request = { url: path(id) + '/replies', method: 'POST', body };
    }
  }
  if (!active()) return sessionError();
  const result = await baseQuery(request);
  if (!active()) return sessionError();
  if (result.error) return result;
  const dto = object(unwrapApiResponseData(result.data));
  if (action === 'settings') {
    const check = await readSettings(baseQuery);
    if (!active()) return sessionError();
    return check.error || Object.keys(body).filter((key) => key !== 'expectedVersion').some((key) => JSON.stringify(check.data.settings[key]) !== JSON.stringify(body[key]))
      ? failure('The settings update was accepted but could not be confirmed. Refresh before trying again.') : check;
  }
  const savedId = action === 'create' ? text(dto.id) : id;
  if (!savedId) return failure('The submission was accepted but its ID was not returned. Refresh before submitting again.');
  const check = await readDetail(savedId, baseQuery);
  if (!active()) return sessionError();
  if (check.error) return failure('The change was accepted but the saved feedback could not be read back. Refresh before trying again.');
  const saved = check.data;
  const confirmed = action === 'create' ? saved.title === body.title && saved.body === body.body && saved.type === body.type && saved.submitterType === 'ADMIN' && saved.userId === owner
    : action === 'update' ? Object.keys(body).filter((key) => key !== 'expectedVersion').every((key) => saved[key] === body[key])
    : action === 'read' ? saved.isRead === body.isRead : action === 'spam' ? saved.status === 'SPAM'
    : action === 'tags' ? Array.isArray(saved.tags) && saved.tags.length === body.tags.length && body.tags.every((tag) => saved.tags.includes(tag))
    : action === 'note' ? body.text === '' ? saved.note === null || object(saved.note).text === '' || object(saved.note).text === null : object(saved.note).text === body.text
    : action === 'reply' ? text(dto.replyId) && dto.message === body.message && feedbackTimestamp(dto.sentAt) != null && version(dto.version) && saved.version === dto.version && (before.status !== 'OPEN' || saved.status === 'IN_PROGRESS') && saved.isRead === true : false;
  if (!confirmed) return failure('The change was accepted but its saved values could not be confirmed. Refresh before trying again.');
  return { data: { feedback: adaptFeedback(saved), ...(action === 'reply' ? { delivery: object(dto.delivery) } : {}) } };
}
export function saveFeedbackCsv(download) {
  const bytes = Uint8Array.from(atob(download.content), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv;charset=utf-8' })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'feedback.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export const {
  useGetAdminFeedbackPageQuery, useGetAdminFeedbackSummaryQuery, useGetAdminFeedbackDetailQuery,
  useGetAdminFeedbackAssigneesQuery, useGetAdminFeedbackHistoryQuery, useGetAdminRelatedFeedbackQuery,
  useGetAdminFeedbackSettingsQuery, useLazyDownloadAdminFeedbackQuery, useChangeAdminFeedbackMutation,
} = feedbackApi;
