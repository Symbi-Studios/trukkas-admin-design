import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { ROOT, record, text, count, timestamp, adaptBroadcast, unwrapBroadcast, adaptStats, adaptOptions, prepareForm, matchesFields, ANNOUNCEMENT_STATUSES } from './announcementContracts.js';
export { ANNOUNCEMENT_STATUSES } from './announcementContracts.js';
export const announcementCount = (value) => count(value) == null ? '—' : count(value).toLocaleString('en-NG');
export const announcementDetailUrl = (id) => '/announcements/detail?announcementId=' + encodeURIComponent(id);
export const announcementEditUrl = (id) => '/announcements/edit?announcementId=' + encodeURIComponent(id);
export const announcementCopyUrl = (id) => '/announcements/new?draftId=' + encodeURIComponent(id);
export const announcementUnavailable = (action) => window.alert(action + ' is not supported by the documented broadcast API for this announcement screen.');
const failure = (message, status = 'CUSTOM_ERROR', writeSent = false) => ({ error: { status, error: message, data: { message, writeSent } } });
function guard(api, owner) {
  const actor = api.getState().auth.admin;
  if (!actor?.id || actor.id !== owner || !api.getState().auth.accessToken || !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(actor.role)) throw new Error('Admin access is required. Reload after changing accounts.');
  return () => { if (api.signal.aborted || api.getState().auth.admin !== actor || !api.getState().auth.accessToken) throw new Error('The admin session changed. Reload before continuing.'); };
}
async function readDetail(baseQuery, id, check) {
  const result = await baseQuery({ url: ROOT + '/' + encodeURIComponent(id) }); check();
  if (result.error) return result;
  try { return { data: unwrapBroadcast(result.data, id) }; } catch (error) { return failure(error.message); }
}
async function readPage(baseQuery, params, check) {
  const result = await baseQuery({ url: ROOT, params }); check(); if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.broadcasts) || count(pagination.page) !== params.page || count(pagination.total) == null || count(pagination.totalPages) == null) return failure('The broadcasts response is missing valid records or pagination.');
  const total = count(pagination.total), pages = Math.max(1, count(pagination.totalPages));
  if (pages > 500 || total > 0 && count(pagination.totalPages) === 0 || params.page > pages) return failure('The broadcasts pagination could not be safely resolved.');
  return { data: { rows: dto.broadcasts, total, pages } };
}
async function readDirectory(baseQuery, status, check) {
  const rows = [], seen = new Set(); let page = 1, pages = 1, total = null;
  do {
    const result = await readPage(baseQuery, { page, limit: 100, ...(status ? { status } : {}) }, check); if (result.error) return result;
    if (total != null && (total !== result.data.total || pages !== result.data.pages)) return failure('The announcement directory changed while loading. Refresh before continuing.');
    total = result.data.total; pages = result.data.pages;
    if (page < pages && !result.data.rows.length) return failure('The broadcasts response returned an incomplete collection.');
    for (const dto of result.data.rows) {
      if (!text(dto?.id) || seen.has(dto.id)) return failure('The broadcasts response returned missing or duplicate IDs.');
      seen.add(dto.id); rows.push(adaptBroadcast(dto));
    }
    page += 1;
  } while (page <= pages);
  return rows.length === total ? { data: rows } : failure('The broadcasts response did not return the complete directory.');
}
function requestKey() { if (!globalThis.crypto?.randomUUID) throw new Error('A secure request key could not be created.'); return globalThis.crypto.randomUUID(); }
function publishedResponse(response, id) {
  const dto = record(unwrapApiResponseData(response)), broadcast = unwrapBroadcast(response, id), sentCount = count(dto.sentCount);
  if (sentCount == null || broadcast.sentCount !== sentCount || broadcast.statusCode !== 'PUBLISHED'
    || !broadcast.version || timestamp(broadcast.state.publishedAt) == null) throw new Error('The returned publication details could not be confirmed.');
  return broadcast;
}
function confirmsPublication(saved, published) {
  return saved.statusCode === 'PUBLISHED' && saved.version && saved.sentCount === published.sentCount
    && timestamp(saved.state.publishedAt) === timestamp(published.state.publishedAt);
}
async function runAction(args, api, baseQuery) {
  let writeAttempted = false;
  const transport = baseQuery;
  baseQuery = async (request) => { if (typeof request !== 'string' && ['POST', 'PATCH'].includes(request.method)) writeAttempted = true; return transport(request); };
  try {
    const { action, id, owner } = args, check = guard(api, owner);
    let before;
    if (id) { const read = await readDetail(baseQuery, id, check); if (read.error) return read; before = read.data; }
    if (action === 'save') {
      if (id && (!args.expectedVersion || before.version !== args.expectedVersion)) return failure('This announcement changed or its version is unavailable. Reload before saving.', 409);
      if (id && !['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(before.statusCode)) return failure('This announcement cannot be edited. Duplicate it instead.');
      const optionsRead = await baseQuery({ url: ROOT + '/options' }); check(); if (optionsRead.error) return optionsRead;
      const fields = prepareForm(args.form, before, args.mode, adaptOptions(optionsRead.data), !id);
      let saved = before;
      if (!id || Object.keys(fields).length) {
        const result = await baseQuery({ url: id ? ROOT + '/' + encodeURIComponent(id) : ROOT, method: id ? 'PATCH' : 'POST', body: id ? { ...fields, expectedVersion: before.version } : fields }); check(); if (result.error) return result;
        const candidate = unwrapBroadcast(result.data, id);
        const response = record(unwrapApiResponseData(result.data));
        if (!candidate.version || !matchesFields(candidate, fields) || id && candidate.version === before.version
          || !id && (count(response.sentCount) == null || candidate.sentCount !== count(response.sentCount))
          || id && (!Array.isArray(response.changedFields) || !response.changedFields.every((field) => text(field)))) return failure('The save was sent, but the returned announcement could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
        const publication = candidate.statusCode === 'PUBLISHED' && !id ? publishedResponse(result.data, candidate.id) : null;
        const read = await readDetail(baseQuery, candidate.id, check);
        if (read.error) return failure('The save was sent, but its result could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
        saved = read.data;
        if (!saved.version || !matchesFields(saved, fields) || publication && !confirmsPublication(saved, publication)) return failure('The save was sent, but its fields could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      }
      if (args.mode === 'Draft' && saved.statusCode !== 'DRAFT') return failure('The save was sent, but draft status was not confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      if (args.mode !== 'Draft' && args.form.schedule === 'Schedule for Later' && saved.statusCode !== 'SCHEDULED') return failure('The save was sent, but scheduled status was not confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      if (args.mode !== 'Draft' && args.form.schedule === 'Publish Now' && ['DRAFT', 'SCHEDULED'].includes(saved.statusCode)) {
        const published = await baseQuery({ url: ROOT + '/' + encodeURIComponent(saved.id) + '/publish', method: 'POST' }); check();
        if (published.error) return failure('Changes were saved, but publication was not confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
        const publication = publishedResponse(published.data, saved.id);
        const read = await readDetail(baseQuery, saved.id, check);
        if (read.error || !confirmsPublication(read.data, publication)) return failure('Publication was sent, but its result could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
        saved = read.data;
      }
      if (args.mode !== 'Draft' && args.form.schedule === 'Publish Now' && saved.statusCode !== 'PUBLISHED') return failure('Publication was not confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      return { data: { announcement: saved } };
    }
    if (!before) return failure('A real announcement ID is required.');
    if (action === 'publish') {
      if (!['DRAFT', 'SCHEDULED'].includes(before.statusCode)) return failure('Only draft or scheduled announcements can be published.');
      const result = await baseQuery({ url: ROOT + '/' + encodeURIComponent(id) + '/publish', method: 'POST' }); check(); if (result.error) return result;
      const publication = publishedResponse(result.data, id);
      const read = await readDetail(baseQuery, id, check);
      if (read.error || !confirmsPublication(read.data, publication)) return failure('Publication was sent, but its result could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      return { data: { announcement: read.data, message: 'Announcement published.' } };
    }
    if (action === 'duplicate') {
      if (!before.searchKnown || !before.typeKnown || !before.state.audienceMode || before.pinned == null || before.acknowledgement == null || before.priority === '—' || !before.channels) return failure('The source announcement is missing fields needed to confirm a duplicate.');
      const copiedFields = { title: before.state.title, message: before.state.message, type: before.state.type, priority: before.state.priority, pinned: before.pinned, acknowledgement: before.acknowledgement, channels: before.channels, audienceMode: before.state.audienceMode };
      const targetKey = { ROLES: 'roleIds', ACCESS: 'moduleIds', CUSTOM: 'userIds' }[before.state.audienceMode];
      if (targetKey) {
        if (!Array.isArray(before.state.targeting[targetKey])) return failure('The source announcement is missing targeting needed to confirm a duplicate.');
        copiedFields[targetKey] = before.state.targeting[targetKey];
      }
      const result = await baseQuery({ url: ROOT + '/' + encodeURIComponent(id) + '/duplicate', method: 'POST' }); check(); if (result.error) return result;
      const copied = unwrapBroadcast(result.data);
      if (copied.id === id) return failure('The duplicate response did not return a new ID. Reload before trying again.', 'CUSTOM_ERROR', true);
      const read = await readDetail(baseQuery, copied.id, check);
      const freshDraft = (draft) => draft.statusCode === 'DRAFT' && draft.version && draft.state.scheduledFor === null && draft.state.expiresAt === null
        && draft.state.publishedAt === null && draft.sentCount === 0 && draft.v === 0 && draft.acknowledgedCount === 0;
      if (read.error || !freshDraft(copied) || !freshDraft(read.data)) return failure('Duplication was sent, but the new draft could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      if (!matchesFields(copied, copiedFields) || !matchesFields(read.data, copiedFields)) return failure('The new draft was created, but its copied fields could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      return { data: { announcement: read.data } };
    }
    if (action === 'acknowledge') {
      if (before.statusCode !== 'PUBLISHED') return failure('Only published announcements can be acknowledged.');
      const result = await baseQuery({ url: ROOT + '/' + encodeURIComponent(id) + '/acknowledge', method: 'POST', body: before.version ? { expectedVersion: before.version } : {} }); check(); if (result.error) return result;
      const dto = record(unwrapApiResponseData(result.data));
      if (dto.broadcastId !== id || dto.acknowledgedBy !== owner || dto.acknowledged !== true || timestamp(dto.acknowledgedAt) == null
        || typeof dto.alreadyAcknowledged !== 'boolean' || typeof dto.requiresAcknowledgement !== 'boolean'
        || before.acknowledgement != null && dto.requiresAcknowledgement !== before.acknowledgement) return failure('Acknowledgement was sent, but could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      return { data: { message: 'Announcement acknowledged.', alreadyAcknowledged: dto.alreadyAcknowledged } };
    }
    if (['unpublish', 'archive'].includes(action)) {
      if (!text(args.reason)) return failure('Enter a reason.');
      if (action === 'archive' && args.reason.trim().length > 500) return failure('The archive reason must be no more than 500 characters.');
      if (action === 'unpublish' ? before.statusCode !== 'PUBLISHED' : !['DRAFT', 'PUBLISHED', 'EXPIRED', 'UNPUBLISHED'].includes(before.statusCode)) return failure(action === 'archive' && before.statusCode === 'SCHEDULED' ? 'Cancel the schedule by saving as a draft before archiving.' : 'This action is not allowed for the current announcement status.');
      const result = await baseQuery({ url: ROOT + '/' + encodeURIComponent(id) + '/' + action, method: 'POST', body: { reason: args.reason.trim(), idempotencyKey: requestKey(), ...(before.version ? { expectedVersion: before.version } : {}) } }); check(); if (result.error) return result;
      const response = record(unwrapApiResponseData(result.data)), returned = unwrapBroadcast(result.data, id);
      const status = action === 'archive' ? 'ARCHIVED' : 'UNPUBLISHED', actionField = action === 'archive' ? 'archivedAt' : 'unpublishedAt';
      const actionAt = timestamp(response.actionAt);
      if (actionAt == null || returned.statusCode !== status || !returned.version || before.version && returned.version === before.version
        || timestamp(returned.state[actionField]) !== actionAt) return failure('The action was sent, but its returned status and timestamp could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      const read = await readDetail(baseQuery, id, check);
      if (read.error || read.data.statusCode !== status || !read.data.version || timestamp(read.data.state[actionField]) !== actionAt) return failure('The action was sent, but its result could not be confirmed. Reload before trying again.', 'CUSTOM_ERROR', true);
      return { data: { announcement: read.data, message: action === 'archive' ? 'Announcement archived.' : 'Announcement unpublished.' } };
    }
    return failure('This announcement operation is not documented.');
  } catch (error) { return failure(writeAttempted ? 'The request was sent, but confirmation failed. Reload before trying again. ' + error.message : error.message, 'CUSTOM_ERROR', writeAttempted); }
}
export const announcementsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminAnnouncements', 'AdminAnnouncementStats', 'AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminAnnouncementDirectory: builder.query({ async queryFn({ status, owner }, api, _options, baseQuery) { try { const check = guard(api, owner); if (status && !Object.values(ANNOUNCEMENT_STATUSES).includes(status)) return failure('Choose a supported status.'); return await readDirectory(baseQuery, status, check); } catch (error) { return failure(error.message); } }, providesTags: ['AdminAnnouncements'] }),
    getAdminAnnouncement: builder.query({ async queryFn({ id, owner }, api, _options, baseQuery) { try { const check = guard(api, owner); if (!text(id)) return failure('An announcement ID is required.'); return await readDetail(baseQuery, id, check); } catch (error) { return failure(error.message); } }, providesTags: ['AdminAnnouncements'] }),
    getAdminAnnouncementStats: builder.query({ async queryFn({ owner, dateFrom, dateTo }, api, _options, baseQuery) { try { const check = guard(api, owner), result = await baseQuery({ url: ROOT + '/stats', params: { dateFrom, dateTo } }); check(); return result.error ? result : { data: adaptStats(result.data) }; } catch (error) { return failure(error.message); } }, providesTags: ['AdminAnnouncementStats'] }),
    getAdminAnnouncementOptions: builder.query({ async queryFn({ owner }, api, _options, baseQuery) { try { const check = guard(api, owner), result = await baseQuery({ url: ROOT + '/options' }); check(); return result.error ? result : { data: adaptOptions(result.data) }; } catch (error) { return failure(error.message); } } }),
    getAdminAnnouncementUsers: builder.query({ async queryFn({ owner, search, page = 1 }, api, _options, baseQuery) { try { const check = guard(api, owner), result = await baseQuery({ url: '/admin/users', params: { search, page, limit: 20 } }); check(); if (result.error) return result;
      const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
      if (!Array.isArray(dto.users) || count(pagination.page) !== page) return failure('The user choices could not be confirmed.', 'CUSTOM_ERROR', true);
      return { data: { users: dto.users.filter((user) => text(user?.id) && ['FORWARDER', 'TRUCKER', 'DRIVER'].includes(user.role)).map((user) => ({ id: user.id, label: [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || text(user.businessName) || user.id })), total: count(pagination.total), pageCount: count(pagination.totalPages) } };
    } catch (error) { return failure(error.message); } } }),
    changeAdminAnnouncement: builder.mutation({ queryFn: (args, api, _options, baseQuery) => runAction(args, api, baseQuery), invalidatesTags: ['AdminAnnouncements', 'AdminAnnouncementStats', 'AdminNotifications', 'AdminAuditLogs'] }),
  }),
});
export const { useGetAdminAnnouncementDirectoryQuery, useGetAdminAnnouncementQuery, useGetAdminAnnouncementStatsQuery, useGetAdminAnnouncementOptionsQuery, useGetAdminAnnouncementUsersQuery, useChangeAdminAnnouncementMutation } = announcementsApi;
