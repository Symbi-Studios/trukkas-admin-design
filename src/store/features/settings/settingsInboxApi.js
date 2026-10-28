import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { record, text, dateLabel } from './settingsContracts.js';

const root = '/admin/notifications';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const failure = message => ({ error: { status: 'CUSTOM_ERROR', error: message } });
function guard(api, { owner, role }) {
  const current = () => !api.signal.aborted && owner && api.getState().auth.accessToken
    && api.getState().auth.admin?.id === owner && api.getState().auth.admin?.role === role;
  if (!current()) throw new Error('Please sign in again before opening notifications.');
  return () => { if (!current()) throw new Error('The admin session changed. Reopen notifications before continuing.'); };
}
function inboxPage(response, { page = 1, limit = 20 } = {}) {
  const dto = record(unwrapApiResponseData(response)), pagination = record(dto.pagination), rows = dto.notifications;
  const total = count(pagination.total), pages = count(pagination.totalPages);
  if (!Array.isArray(rows) || rows.some(row => !text(row?.id)) || new Set(rows.map(row => row.id)).size !== rows.length
    || pagination.page !== page || pagination.limit !== limit || total == null || pages == null
    || pages !== Math.ceil(total / limit) && !(total === 0 && pages === 1)
    || rows.length > limit || rows.length > total || page > Math.max(1, pages)) {
    throw new Error('The notifications response did not include a valid list and pagination.');
  }
  return { rows: rows.map(row => ({ id: row.id, title: text(row.title) || '—', body: text(row.body) || '—',
    created: dateLabel(row.createdAt), read: typeof row.isRead === 'boolean' ? row.isRead : null,
    status: row.isRead === true ? 'Read' : row.isRead === false ? 'Unread' : '—',
  })), total, pages, unreadCount: count(dto.unreadCount) };
}
const request = ({ page = 1, limit = 20, tab = 'all' }) => ({ url: root, params: { page, limit, tab } });
export const settingsInboxApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminSettingsInbox', 'AdminNotifications'] }).injectEndpoints({
  endpoints: builder => ({
    getAdminSettingsInbox: builder.query({
      async queryFn(args, api, _options, baseQuery) {
        try {
          const check = guard(api, args);
          const result = await baseQuery(request(args)); check();
          return result.error ? result : { data: inboxPage(result.data, args) };
        } catch (error) { return failure(error.message); }
      }, providesTags: ['AdminSettingsInbox', 'AdminNotifications'],
    }),
    markAdminSettingsInboxRead: builder.mutation({
      async queryFn(args, api, _options, baseQuery) {
        let sent = false;
        try {
          const check = guard(api, args), all = args.all === true;
          if (!all && !text(args.id)) throw new Error('Choose a notification from the current page.');
          if (!all) {
            const before = await baseQuery(request(args)); check(); if (before.error) return before;
            const selected = inboxPage(before.data, args).rows.find(row => row.id === args.id);
            if (!selected || selected.read == null) throw new Error('The notification changed or its read status is unavailable. Refresh before continuing.');
            if (selected.read) return { data: { message: 'Notification is already read.' } };
          }
          sent = true;
          const result = await baseQuery({ url: root + (all ? '/mark-all-read' : '/mark-read'), method: 'POST',
            ...(!all ? { body: { ids: [args.id] } } : {}) });
          check(); if (result.error) return result;
          const message = text(record(unwrapApiResponseData(result.data)).message);
          const query = all ? { page: 1, limit: 20, tab: 'unread' } : args;
          const confirmation = await baseQuery(request(query)); check();
          if (confirmation.error) throw new Error('The read status could not be confirmed.');
          const after = inboxPage(confirmation.data, query);
          if (!message || (all ? after.total !== 0 || after.unreadCount !== 0 : after.rows.find(row => row.id === args.id)?.read !== true)) throw new Error('The read status could not be confirmed.');
          return { data: { message } };
        } catch (error) { return failure(sent ? 'The request was sent, but the saved read status could not be confirmed. Refresh before trying again.' : error.message); }
      }, invalidatesTags: ['AdminSettingsInbox', 'AdminNotifications'],
    }),
  }),
});
export const { useGetAdminSettingsInboxQuery, useMarkAdminSettingsInboxReadMutation } = settingsInboxApi;
