import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const categories = {
  SUPPORT: { category: 'System', icon: 'headphones', tone: 'blue' },
  JOB: { category: 'Jobs & Trips', icon: 'package', tone: 'blue' },
  TRIP: { category: 'Jobs & Trips', icon: 'route', tone: 'blue' },
  BID: { category: 'Jobs & Trips', icon: 'radio', tone: 'blue' },
  PAYMENT: { category: 'Finance', icon: 'badge-dollar-sign', tone: 'green' },
  PAYOUT: { category: 'Finance', icon: 'banknote', tone: 'green' },
  ESCROW: { category: 'Finance', icon: 'wallet', tone: 'green' },
  FLEET: { category: 'Fleet', icon: 'truck', tone: 'blue' },
  TRUCK: { category: 'Fleet', icon: 'truck', tone: 'blue' },
  DRIVER: { category: 'Fleet', icon: 'user', tone: 'blue' },
  MAINTENANCE: { category: 'Maintenance', icon: 'wrench', tone: 'orange' },
  RATING: { category: 'Ratings', icon: 'star', tone: 'orange' },
};

function dateGroup(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Older';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) return 'Today';
  if (date >= new Date(startOfToday.getTime() - 6 * 86400000)) return 'This Week';
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return 'This Month';
  return 'Older';
}

function mapNotification(item) {
  const type = String(item?.type || '').toUpperCase();
  const match = Object.entries(categories).find(([prefix]) => type.includes(prefix));
  const style = match?.[1] || { category: 'System', icon: 'bell', tone: 'blue' };
  const created = new Date(item?.createdAt);
  const validDate = !Number.isNaN(created.getTime());
  return {
    id: String(item.id),
    title: item.title || 'Notification',
    message: item.body || '',
    type: item.type || '',
    read: item.isRead === true,
    createdAt: item.createdAt || '',
    dateGroup: dateGroup(item.createdAt),
    time: validDate ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(created) : '—',
    category: style.category,
    icon: style.icon,
    tone: style.tone,
  };
}

function mapResponse(response) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.notifications)) throw new Error('The notifications response is missing its list.');
  const pagination = data.pagination || {};
  return {
    rows: data.notifications.filter((item) => item && item.id != null).map(mapNotification),
    unreadCount: Number.isFinite(data.unreadCount) ? data.unreadCount : null,
    pagination: {
      page: Number.isFinite(pagination.page) ? pagination.page : 1,
      limit: Number.isFinite(pagination.limit) ? pagination.limit : data.notifications.length,
      total: Number.isFinite(pagination.total) ? pagination.total : data.notifications.length,
      totalPages: Number.isFinite(pagination.totalPages) ? pagination.totalPages : 1,
    },
  };
}

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminNotifications: builder.query({
      query: ({ page = 1, limit = 20, tab = 'all' } = {}) => ({
        url: '/admin/notifications',
        params: { page, limit, tab },
      }),
      transformResponse: mapResponse,
      providesTags: ['AdminNotifications'],
    }),
    markAdminNotificationsRead: builder.mutation({
      query: (ids) => ({ url: '/admin/notifications/mark-read', method: 'POST', body: { ids } }),
      invalidatesTags: ['AdminNotifications'],
    }),
    markAllAdminNotificationsRead: builder.mutation({
      query: () => ({ url: '/admin/notifications/mark-all-read', method: 'POST' }),
      invalidatesTags: ['AdminNotifications'],
    }),
  }),
});

export const {
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationsReadMutation,
  useMarkAllAdminNotificationsReadMutation,
} = notificationsApi;
