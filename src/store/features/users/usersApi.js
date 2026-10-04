import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { setCredentials } from '../auth/authSlice.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const failure = (message, status = 'CUSTOM_ERROR') => ({ error: { status, error: message, data: { message } } });
const label = (value) => text(value)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (part) => part.toUpperCase()) || '—';
const roles = { SUPER_ADMIN: 'Super Admin', OPS_ADMIN: 'Operations Admin', FINANCE_ADMIN: 'Finance Admin', FORWARDER: 'Forwarder', TRUCKER: 'Trucker', DRIVER: 'Driver' };
function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value, withTime = false) {
  const parsed = timestamp(value);
  if (parsed == null) return '—';
  return new Date(parsed).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
export function adaptManagedUser(dto, source = 'user', profile = false) {
  const details = record(dto.details), company = record(details.company), account = record(details.account);
  const id = text(dto.id), joinedAt = text(profile ? dto.joinedAt : dto.createdAt) || (profile ? text(account.dateJoined) : null);
  const statusCode = source === 'admin' ? (dto.isActive === true ? 'ACTIVE' : dto.isActive === false ? 'INACTIVE' : null) : text(dto.status);
  return {
    id: `${source}:${id}`, backendId: id, source, roleCode: text(dto.role), statusCode,
    name: text(dto.name) || [text(dto.firstName), text(dto.lastName)].filter(Boolean).join(' ') || text(dto.businessName) || '—',
    email: text(dto.email) || '—', phone: text(dto.phone) || '—',
    role: roles[dto.role] || label(dto.role), roleTone: { SUPER_ADMIN: 'purple', OPS_ADMIN: 'info', FINANCE_ADMIN: 'orange', DRIVER: 'teal' }[dto.role] || 'neutral',
    status: label(statusCode), entity: text(dto.businessName) || text(company.businessName) || '—',
    location: text(company.businessAddress) || '—', joinedAt, joinedOn: date(joinedAt), accountCreated: date(joinedAt, true),
    lastActive: date(dto.lastLoginAt || account.lastLogin, true),
    // Login time does not establish online presence or security/session state.
    online: null, passwordLastChanged: '—', department: '—', permissionsCaption: '—',
    totalLogins: null, failedLogins: null, activeSessions: null, lastLoginDetail: '—',
    emailNotifications: null, loginNotifications: null, emailVerified: null, phoneVerified: null,
    twoFactor: null, passwordStrengthPct: null, passwordStrength: '—', passwordExpires: '—',
  };
}
async function readDirectory(baseQuery, source) {
  const key = source === 'admin' ? 'admins' : 'users', url = source === 'admin' ? '/admin/admins' : '/admin/users';
  const rows = [], seen = new Set();
  let page = 1, total = null, totalPages = 1;
  do {
    const result = await baseQuery({ url, params: { page, limit: 100 } });
    if (result.error) return result;
    const dto = record(unwrapApiResponseData(result.data)), meta = record(dto.pagination);
    if (!Array.isArray(dto[key]) || meta.page !== page || count(meta.total) == null || count(meta.totalPages) == null
      || (meta.total > 0 && meta.totalPages === 0) || (meta.total === 0 && meta.totalPages > 1) || page > Math.max(1, meta.totalPages)) {
      return failure('The user directory returned incomplete pagination. Refresh before filtering or exporting.');
    }
    if (total != null && (total !== meta.total || totalPages !== Math.max(1, meta.totalPages))) return failure('The user directory changed while loading. Refresh to load all records.');
    total = meta.total; totalPages = Math.max(1, meta.totalPages);
    if (page < totalPages && !dto[key].length) return failure('The user directory returned an incomplete collection.');
    for (const item of dto[key]) {
      if (!text(item?.id) || seen.has(item.id)) return failure('The user directory returned missing or duplicate IDs.');
      seen.add(item.id); rows.push(adaptManagedUser(item, source));
    }
    page += 1;
  } while (page <= totalPages);
  if (rows.length !== total) return failure('The user directory did not return all records.');
  return { data: rows };
}
async function readProfile(baseQuery, id) {
  const result = await baseQuery({ url: `/admin/users/${encodeURIComponent(id)}/profile` });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  if (dto.id !== id) return failure('The profile response does not match the requested user.');
  return { data: adaptManagedUser(dto, 'user', true) };
}
export function managedUserSummary(rows, stats) {
  const total = rows ? rows.length : null;
  const knownStatuses = rows?.every((row) => row.statusCode != null);
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const datesKnown = rows?.every((row) => timestamp(row.joinedAt) != null);
  const scoped = !rows?.some((row) => row.source === 'admin');
  return {
    total, active: knownStatuses ? rows.filter((row) => row.statusCode === 'ACTIVE').length : null,
    inactive: knownStatuses ? rows.filter((row) => row.statusCode === 'INACTIVE').length : null,
    locked: null,
    newThisMonth: rows && scoped && count(stats?.newThisMonth) != null ? stats.newThisMonth
      : datesKnown ? rows.filter((row) => timestamp(row.joinedAt) >= monthStart && timestamp(row.joinedAt) <= now.getTime()).length : null,
    totalCaption: '— vs last month', activeCaption: '— vs last month', inactiveCaption: '— vs last month',
    lockedCaption: '— vs last month', newThisMonthCaption: '— vs last month',
    totalDirection: null, activeDirection: null, inactiveDirection: null, lockedDirection: null, newThisMonthDirection: null,
  };
}
export function managedUserRoleChart(rows, adminsIncluded = false) {
  const labels = ['Super Admin', 'Admin', 'Operations Manager', 'Dispatcher', 'Verifier', 'Driver', 'Viewer'];
  const colors = ['var(--tk-viz-1)', 'var(--tk-blue-hover)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-viz-6)', 'var(--tk-viz-2)', 'var(--tk-ink-300)'];
  return labels.map((name, index) => {
    const supported = rows && (name === 'Driver' || (name === 'Super Admin' && adminsIncluded));
    const value = supported ? rows.filter((row) => row.role === name).length : null;
    const share = value == null || !rows.length ? null : value / rows.length * 100;
    return { label: name, color: colors[index], value, display: value == null ? '—' : `${value} (${share == null ? '—' : `${Math.round(share * 10) / 10}%`})` };
  });
}
export function managedUserStatusChart(rows, summary) {
  return ['Active', 'Inactive', 'Locked', 'Pending Invitation'].map((name) => {
    const value = name === 'Active' ? summary.active : name === 'Inactive' ? summary.inactive : null;
    return { label: name, value: value ?? '—', share: value == null || !rows?.length ? '—' : `${Math.round(value / rows.length * 1000) / 10}%` };
  });
}
export function managedUsersCsv(rows) {
  return [['User ID', 'Name', 'Email', 'Phone', 'Role', 'Entity / Company', 'Status', 'Last Active', 'Joined On'],
    ...rows.map((row) => [row.backendId, row.name, row.email, row.phone, row.role, row.entity, row.status, row.lastActive, row.joinedOn])]
    .map((row) => row.map((value) => {
      let cell = String(value ?? '—');
      if (/^[\t\r\n]|^\s*[=+\-@]/.test(cell)) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    }).join(',')).join('\n');
}
const invalidates = ['AdminManagedUsers', 'AdminDrivers', 'AdminDriverStats', 'AdminCompanies', 'AdminForwarders', 'AdminAuditLogs'];
export const usersApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminManagedUsers', 'AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getUserManagementDirectory: builder.query({
      async queryFn({ includeAdmins = false } = {}, api, _options, baseQuery) {
        if (includeAdmins && api.getState().auth.admin?.role !== 'SUPER_ADMIN') return failure('Only Super Admins can view admin accounts.', 403);
        const users = await readDirectory(baseQuery, 'user');
        if (users.error) return users;
        if (!includeAdmins) return { data: { rows: users.data, adminsIncluded: false } };
        const admins = await readDirectory(baseQuery, 'admin');
        if (admins.error) return admins;
        return { data: { rows: [...users.data, ...admins.data], adminsIncluded: true } };
      }, providesTags: ['AdminManagedUsers'],
    }),
    getUserManagementStats: builder.query({
      query: () => '/admin/users/stats', transformResponse: (response) => record(unwrapApiResponseData(response)), providesTags: ['AdminManagedUsers'],
    }),
    getManagedUserProfile: builder.query({
      async queryFn({ id, source = 'user' }, api, _options, baseQuery) {
        if (!text(id)) return failure('A user ID is required.');
        if (source === 'user') return readProfile(baseQuery, id);
        if (source !== 'admin') return failure('The user source is invalid.');
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return failure('Only Super Admins can view admin accounts.', 403);
        const result = await readDirectory(baseQuery, 'admin');
        if (result.error) return result;
        const user = result.data.find((row) => row.backendId === id);
        return user ? { data: user } : failure('Admin account not found.', 404);
      }, providesTags: ['AdminManagedUsers'],
    }),
    updateManagedAdmin: builder.mutation({
      async queryFn({ id, name, role }, api, _options, baseQuery) {
        if (api.getState().auth.admin?.role !== 'SUPER_ADMIN') return failure('Only Super Admins can edit admin accounts.', 403);
        if (!text(id) || (name !== undefined && !text(name)) || (role !== undefined && !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role))
          || (name === undefined && role === undefined)) return failure('Enter a valid admin name or role.');
        const body = { ...(name !== undefined ? { name: name.trim() } : {}), ...(role !== undefined ? { role } : {}) };
        const result = await baseQuery({ url: `/admin/admins/${encodeURIComponent(id)}`, method: 'PATCH', body });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)), admin = record(dto.admin);
        if (admin.id !== id || !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(admin.role) || (name !== undefined && admin.name !== body.name) || (role !== undefined && admin.role !== role)) return failure('The admin update could not be confirmed. Refresh before trying again.');
        const current = api.getState().auth.admin;
        if (current?.id === id) api.dispatch(setCredentials({ admin: { ...current, name: admin.name, role: admin.role } }));
        return { data: { message: text(dto.message) || 'Admin updated.' } };
      }, invalidatesTags: ['AdminManagedUsers', 'AdminAuditLogs'],
    }),
    changeManagedUserAccess: builder.mutation({
      async queryFn({ id, source, operation, reason }, api, _options, baseQuery) {
        if (!['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(api.getState().auth.admin?.role)) return failure('Admin access is required.', 403);
        if (source !== 'user' || !text(id) || !['suspend', 'activate'].includes(operation)) return failure('This account action is not supported.');
        if (operation === 'suspend' && !text(reason)) return failure('A suspension reason is required.');
        const profile = await readProfile(baseQuery, id);
        if (profile.error) return profile;
        if (!['DRIVER', 'TRUCKER', 'FORWARDER'].includes(profile.data.roleCode)
          || profile.data.statusCode !== (operation === 'suspend' ? 'ACTIVE' : 'SUSPENDED')) return failure('The account status changed or this transition is unavailable. Refresh the user.');
        const result = await baseQuery({ url: `/admin/users/${encodeURIComponent(id)}/${operation}`, method: 'POST', ...(operation === 'suspend' ? { body: { reason: reason.trim() } } : {}) });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (dto.user?.id !== id || (operation === 'suspend' && dto.user.status !== 'SUSPENDED')) return failure('The account update response could not be confirmed. Refresh the user before trying again.');
        return { data: { message: text(dto.message) || 'Account updated.' } };
      }, invalidatesTags: invalidates,
    }),
  }),
});
export const { useGetUserManagementDirectoryQuery, useGetUserManagementStatsQuery, useGetManagedUserProfileQuery, useChangeManagedUserAccessMutation, useUpdateManagedAdminMutation } = usersApi;
