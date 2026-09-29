import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const categories = {
  SUPPORT: { category: 'System', icon: 'headphones', tone: 'blue' },
  JOB_AT_RISK: { category: 'Jobs & Trips', icon: 'triangle-alert', tone: 'red' },
  PAYMENT_FAILED: { category: 'Finance', icon: 'triangle-alert', tone: 'red' },
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
  DISPUTE: { category: 'Jobs & Trips', icon: 'triangle-alert', tone: 'red' },
};
const categoryLabels = {
  JOBS_TRIPS: 'Jobs & Trips',
  FINANCE: 'Finance',
  FLEET: 'Fleet',
  SYSTEM: 'System',
  RATINGS: 'Ratings',
  MAINTENANCE: 'Maintenance',
};
const priorityLabels = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const defaultSettings = {
  email: true,
  push: true,
  sms: false,
  quiet: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  updatedAt: null,
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
  const priorityCode = String(item?.priority || '').toUpperCase();
  const priority = priorityLabels[priorityCode] || null;
  const created = new Date(item?.createdAt);
  const validDate = !Number.isNaN(created.getTime());
  return {
    id: String(item.id),
    title: item.title || 'Notification',
    message: item.body || '',
    type: item.type || '',
    read: item.isRead === true,
    priority,
    createdAt: item.createdAt || '',
    readAt: item.readAt || null,
    actorName: item.actorName || null,
    actorId: item.actorId == null ? null : String(item.actorId),
    entityId: item.entityId == null ? null : String(item.entityId),
    entityType: item.entityType || null,
    targetRole: item.targetRole || null,
    dateGroup: dateGroup(item.createdAt),
    time: validDate ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(created) : '—',
    category: categoryLabels[String(item?.category || '').toUpperCase()] || style.category,
    icon: style.icon,
    tone: priority === 'High' ? 'red' : style.tone,
  };
}

function mapNotificationSettings(response) {
  const data = unwrapApiResponseData(response);
  if (!data || typeof data !== 'object') {
    throw new Error('The notification settings response is missing its settings.');
  }
  return {
    email: typeof data.emailEnabled === 'boolean' ? data.emailEnabled : defaultSettings.email,
    push: typeof data.pushEnabled === 'boolean' ? data.pushEnabled : defaultSettings.push,
    sms: typeof data.smsEnabled === 'boolean' ? data.smsEnabled : defaultSettings.sms,
    quiet: typeof data.quietHoursEnabled === 'boolean' ? data.quietHoursEnabled : defaultSettings.quiet,
    quietHoursStart: data.quietHoursStart || defaultSettings.quietHoursStart,
    quietHoursEnd: data.quietHoursEnd || defaultSettings.quietHoursEnd,
    updatedAt: data.updatedAt || null,
  };
}

function mapResponse(response) {
  const data = unwrapApiResponseData(response);
  if (!Array.isArray(data?.notifications)) throw new Error('The notifications response is missing its list.');
  const pagination = data.pagination || {};
  const summary = data.summary || {};
  return {
    rows: data.notifications.filter((item) => item && item.id != null).map(mapNotification),
    unreadCount: Number.isFinite(data.unreadCount) ? data.unreadCount : null,
    summary: {
      allUnread: Number.isFinite(summary.allUnread) ? summary.allUnread : null,
      highPriority: Number.isFinite(summary.highPriority) ? summary.highPriority : null,
      dueToday: Number.isFinite(summary.dueToday) ? summary.dueToday : null,
      thisWeek: Number.isFinite(summary.thisWeek) ? summary.thisWeek : null,
    },
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
    getAdminNotificationSettings: builder.query({
      query: () => ({ url: '/admin/notifications/settings' }),
      transformResponse: mapNotificationSettings,
      providesTags: ['AdminNotificationSettings'],
    }),
    updateAdminNotificationSettings: builder.mutation({
      query: (patch) => ({ url: '/admin/notifications/settings', method: 'PATCH', body: patch }),
      transformResponse: mapNotificationSettings,
      invalidatesTags: ['AdminNotificationSettings'],
    }),
  }),
});

export const {
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationsReadMutation,
  useMarkAllAdminNotificationsReadMutation,
  useGetAdminNotificationSettingsQuery,
  useUpdateAdminNotificationSettingsMutation,
} = notificationsApi;
