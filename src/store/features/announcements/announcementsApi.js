import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const count = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
export const announcementCount = (value) => count(value) == null ? '—' : count(value).toLocaleString('en-NG');
export const ANNOUNCEMENT_STATUSES = { Published: 'PUBLISHED', Scheduled: 'SCHEDULED', Draft: 'DRAFT', Expired: 'EXPIRED' };
const STATUS_LABELS = Object.fromEntries(Object.entries(ANNOUNCEMENT_STATUSES).map(([label, code]) => [code, label]));
const AUDIENCES = { ALL: 'All Users', FORWARDERS: 'Freight Forwarders', TRUCKERS: 'Truck Companies', DRIVERS: 'Drivers', ACTIVE_JOBS: 'Users with Active Jobs' };
const TYPE_ICONS = { System: 'megaphone', Feature: 'sparkles', Update: 'info', Notice: 'calendar-days', Reminder: 'clock-3', Campaign: 'send' };
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function dateParts(value) {
  const time = timestamp(value);
  if (time == null) return { d: '—', tm: '—', inputDate: '', inputTime: '' };
  const instant = new Date(time);
  const local = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return {
    d: new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }).format(instant),
    tm: new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit' }).format(instant),
    inputDate: `${local.year}-${local.month}-${local.day}`, inputTime: `${local.hour}:${local.minute}`,
  };
}
function adaptBroadcast(dto) {
  const statusCode = text(dto.status)?.toUpperCase(), type = Object.keys(TYPE_ICONS).find((label) => label.toUpperCase() === text(dto.type)?.toUpperCase()) || null;
  const priority = ['Low', 'Normal', 'High', 'Urgent'].find((label) => label.toUpperCase() === text(dto.priority)?.toUpperCase()) || null;
  const custom = Array.isArray(dto.userIds) && dto.userIds.length > 0 && dto.userIds.every((id) => text(id));
  const audience = custom ? 'Custom Users' : AUDIENCES[text(dto.audience)] || null;
  // createdAt is a record creation timestamp, not publication or scheduling.
  const schedule = dateParts(dto.scheduledFor), published = dateParts(dto.publishedAt), expiry = dateParts(dto.expiresAt);
  const displayDate = statusCode === 'SCHEDULED' ? schedule : published;
  const pinned = typeof dto.pinned === 'boolean' ? dto.pinned : null;
  const acknowledgement = typeof dto.acknowledgement === 'boolean' ? dto.acknowledgement : null;
  return {
    id: dto.id, t: text(dto.title) || '—', p: text(dto.message) || '—', searchKnown: Boolean(text(dto.title) && text(dto.message)),
    type: type || '—', typeKnown: Boolean(type), icon: TYPE_ICONS[type] || 'megaphone', aud: audience || '—', audienceKnown: Boolean(audience),
    statusCode: STATUS_LABELS[statusCode] ? statusCode : null, st: STATUS_LABELS[statusCode] || '—',
    d: displayDate.d, tm: displayDate.tm, v: count(dto.seenCount), createdAt: timestamp(dto.createdAt), priority: priority || '—', pinned, acknowledgement,
    channels: Array.isArray(dto.channels) && dto.channels.length && dto.channels.every((channel) => ['in-app', 'email', 'push'].includes(channel)) ? dto.channels : null,
    form: { title: text(dto.title) || '', message: text(dto.message) || '', type, audience: ['All Users', 'Users with Access', 'User Roles', 'Custom Users'].includes(audience) ? audience : null,
      schedule: statusCode === 'SCHEDULED' ? 'Schedule for Later' : STATUS_LABELS[statusCode] ? 'Publish Now' : null,
      scheduleDate: schedule.inputDate, scheduleTime: schedule.inputTime, priority, pinned, acknowledgement, expiry: expiry.inputDate },
  };
}
async function readPage(baseQuery, params) {
  const result = await baseQuery({ url: '/admin/support/broadcasts', params });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data)), pagination = record(dto.pagination);
  if (!Array.isArray(dto.broadcasts) || count(pagination.page) !== params.page || count(pagination.total) == null || count(pagination.totalPages) == null
    || (count(pagination.total) > 0 && count(pagination.totalPages) === 0) || params.page > Math.max(1, count(pagination.totalPages))) return failure('The broadcasts response is missing valid records or pagination.');
  return { data: { rows: dto.broadcasts, total: count(pagination.total), pages: Math.max(1, count(pagination.totalPages)) } };
}
async function readDirectory(baseQuery, status) {
  const rows = [], seen = new Set();
  let page = 1, pages = 1, total = null;
  do {
    const result = await readPage(baseQuery, { page, limit: 100, ...(status ? { status } : {}) });
    if (result.error) return result;
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
export const announcementDetailUrl = (id) => `/announcements/detail?announcementId=${encodeURIComponent(id)}`;
export const announcementEditUrl = (id) => `/announcements/edit?announcementId=${encodeURIComponent(id)}`;
export const announcementCopyUrl = (id) => `/announcements/new?copy=${encodeURIComponent(id)}`;
export const announcementUnavailable = (action) => window.alert(`${action} is not supported by the documented broadcast API for this announcement screen.`);
export const announcementsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminAnnouncements'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminAnnouncementDirectory: builder.query({
      async queryFn({ status } = {}, _api, _options, baseQuery) {
        if (status && !Object.values(ANNOUNCEMENT_STATUSES).includes(status)) return failure('Select a supported announcement status.');
        return readDirectory(baseQuery, status);
      }, providesTags: ['AdminAnnouncements'],
    }),
    getAdminAnnouncementStatusCounts: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = {};
        for (const status of ['PUBLISHED', 'SCHEDULED']) {
          const response = await readPage(baseQuery, { page: 1, limit: 1, status });
          if (response.error) return response;
          result[status] = response.data.total;
        }
        return { data: result };
      }, providesTags: ['AdminAnnouncements'],
    }),
    publishAdminAnnouncement: builder.mutation({
      async queryFn({ id, owner }, api, _options, baseQuery) {
        const actor = api.getState().auth.admin;
        if (!text(actor?.id) || actor.id !== owner || !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(actor.role)) return failure('Admin access is required. Reload after changing accounts.');
        if (!text(id)) return failure('An announcement ID is required.');
        // Re-read the authoritative status before the non-idempotent publication.
        let announcement;
        for (const status of ['DRAFT', 'SCHEDULED']) {
          const directory = await readDirectory(baseQuery, status);
          if (directory.error) return directory;
          announcement = directory.data.find((row) => row.id === id);
          if (announcement) {
            if (announcement.statusCode && announcement.statusCode !== status) return failure('The broadcast status does not match the requested directory. Reload before publishing.');
            break;
          }
        }
        if (!announcement) return failure('Only a confirmed draft or scheduled broadcast can be published.');
        if (api.getState().auth.admin?.id !== actor.id) return failure('The admin account changed before publication. Reload before continuing.');
        const result = await baseQuery({ url: `/admin/support/broadcasts/${encodeURIComponent(id)}/publish`, method: 'POST' });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (count(dto.sentCount) == null || !text(dto.message)) return failure('The publish request was sent, but its delivery outcome could not be confirmed. Reload before trying again.');
        return { data: { message: text(dto.message), sentCount: count(dto.sentCount) } };
      }, invalidatesTags: ['AdminAnnouncements', 'AdminNotifications'],
    }),
  }),
});
export const { useGetAdminAnnouncementDirectoryQuery, useGetAdminAnnouncementStatusCountsQuery, usePublishAdminAnnouncementMutation } = announcementsApi;
