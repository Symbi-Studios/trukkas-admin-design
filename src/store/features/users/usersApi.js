import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { setCredentials } from '../auth/authSlice.js';
const text = v => typeof v === 'string' && v.trim() ? v.trim() : null;
const record = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const count = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const number = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const boolean = v => typeof v === 'boolean' ? v : null;
const label = v => text(v)?.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
const failure = (message, status = 'CUSTOM_ERROR') => ({
  error: {
    status,
    error: message,
    data: {
      message
    }
  }
});
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN']);
const STATUSES = new Set(['ACTIVE', 'PENDING_PROFILE', 'PENDING_REVIEW', 'INACTIVE', 'SUSPENDED', 'BANNED', 'LOCKED', 'PENDING_INVITATION', 'REVOKED', 'DELETED']);
const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  OPS_ADMIN: 'Operations Admin',
  FINANCE_ADMIN: 'Finance Admin',
  FORWARDER: 'Forwarder',
  EXPORTER: 'Exporter',
  TRUCKER: 'Trucker',
  TRUCKING_COMPANY: 'Trucking company',
  DRIVER: 'Driver'
};
const ROOT = '/admin/user-management';
const allTags = ['AdminManagedUsers', 'AdminAuditLogs', 'AdminRoles', 'AdminPermissions', 'AdminDrivers', 'AdminDriverStats', 'AdminCompanies', 'AdminForwarders'];
function access(api, source) {
  const role = api.getState().auth.admin?.role;
  if (!ADMIN_ROLES.has(role)) return failure('Admin access is required.', 403);
  if (source && !['user', 'admin'].includes(source)) return failure('The user source is invalid.');
  if (source === 'admin' && role !== 'SUPER_ADMIN') return failure('Only Super Admins can manage admin accounts.', 403);
  return null;
}
function timestamp(v) {
  const parts = text(v)?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts || +parts[4] > 23 || +parts[5] > 59 || +parts[6] > 59) return null;
  const calendar = new Date(`${parts[1]}-${parts[2]}-${parts[3]}T00:00:00Z`),
    at = Date.parse(v);
  return Number.isFinite(at) && calendar.getUTCFullYear() === +parts[1] && calendar.getUTCMonth() + 1 === +parts[2] && calendar.getUTCDate() === +parts[3] ? at : null;
}
export function managedUserDate(v, withTime = true) {
  const at = timestamp(v);
  return at == null ? '—' : new Date(at).toLocaleString('en-US', {
    timeZone: 'Africa/Lagos',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? {
      hour: '2-digit',
      minute: '2-digit'
    } : {})
  });
}
export function managedUserKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('A secure request key could not be created.');
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2, '0')).join('');
}
const validKey = v => typeof v === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(v);
function roleData(raw, source) {
  const r = record(raw),
    bare = text(raw),
    code = text(r.code) || (bare && source === 'admin' && ADMIN_ROLES.has(bare) ? `ADMIN:${bare}` : bare);
  const core = source === 'admin' && code?.startsWith('ADMIN:') ? code.slice(6) : text(r.platformRole) || code;
  return {
    code,
    core,
    kind: text(r.kind) || (source === 'admin' ? 'ADMIN_ACCESS' : bare ? 'PLATFORM_ROLE' : null),
    label: text(r.label) || (code?.startsWith('TEAM:') ? code.slice(5) : ROLE_LABELS[core]) || '—',
    id: text(r.id) || text(r.roleId)
  };
}
export function adaptManagedUser(raw, source = 'user', _profile = false, extras = {}) {
  const dto = record(raw),
    identity = record(dto.identity),
    contact = record(dto.contact),
    company = record(dto.company),
    security = record(dto.security),
    login = record(security.lastLogin);
  const id = text(dto.id) || text(identity.id),
    r = roleData(dto.role, source),
    prefs = record(extras.preferences ?? dto.notifications),
    permission = record(extras.permissions);
  const permissionKeys = Array.isArray(permission.permissionKeys) && permission.permissionKeys.every(v => text(v)) ? permission.permissionKeys : null;
  const joinedAt = text(dto.joinedAt),
    lastActiveAt = text(dto.lastActiveAt),
    statusCode = STATUSES.has(dto.status) ? dto.status : null;
  return {
    id: `${source}:${id}`,
    backendId: id,
    source,
    accountType: source,
    isAccount: statusCode !== 'PENDING_INVITATION' && !id?.startsWith('invite_'),
    version: text(dto.version),
    name: text(dto.name) || text(identity.name) || '—',
    email: text(dto.email) || text(contact.email) || '—',
    phone: text(dto.phone) || text(contact.phone) || '—',
    role: r.label,
    roleCode: r.core,
    roleKind: r.kind,
    roleId: r.id || text(dto.roleId) || text(permission.roleId) || text(permission.role?.id) || text(permission.primaryRole?.id),
    roleFilterCode: r.code,
    roleTone: {
      SUPER_ADMIN: 'purple',
      OPS_ADMIN: 'info',
      FINANCE_ADMIN: 'orange',
      DRIVER: 'teal'
    }[r.core] || 'neutral',
    entityId: text(dto.entityId) || text(company.id),
    entity: text(dto.entityName) || text(company.name) || '—',
    department: text(dto.department) || '—',
    location: text(dto.location) || '—',
    statusCode,
    status: label(statusCode),
    joinedAt,
    joinedOn: managedUserDate(joinedAt, false),
    accountCreated: managedUserDate(joinedAt),
    lastActive: managedUserDate(lastActiveAt),
    online: boolean(dto.online),
    lastLogin: managedUserDate(login.at),
    lastLoginDetail: [text(login.ipAddress), text(login.device)].filter(Boolean).join(' · ') || '—',
    passwordLastChanged: managedUserDate(security.passwordLastChangedAt),
    lockedUntil: managedUserDate(security.lockedUntil),
    lockedBy: text(security.lockedBy) || text(security.lockedBy?.name) || text(security.lockedBy?.id) || '—',
    totalLogins: count(security.totalLogins),
    failedLogins: count(security.failedLogins),
    activeSessions: count(security.activeSessions),
    emailVerified: boolean(dto.emailVerified),
    phoneVerified: boolean(dto.phoneVerified),
    twoFactor: boolean(security.twoFactorEnabled),
    passwordStrengthPct: null,
    passwordStrength: text(security.passwordStrength) || '—',
    passwordExpires: managedUserDate(security.passwordExpiresAt),
    emailNotifications: boolean(prefs.emailEnabled),
    loginNotifications: boolean(prefs.loginAlertsEnabled),
    permissionsCaption: permissionKeys ? `${permissionKeys.length} permissions` : '—',
    permissions: extras.permissions ?? null,
    notificationPreferences: extras.preferences ?? null
  };
}
export function managedUserRoleAvailable(value, rows) {
  return ['All Roles', 'Super Admin', 'Admin', 'Operations Manager', 'Dispatcher', 'Verifier', 'Finance Manager', 'Viewer', 'Driver'].includes(value) || Boolean(rows?.some(r => r.role === value));
}
export function managedUserMatchesRole(user, value) {
  if (value === 'All Roles') return true;
  if (value === 'Super Admin' || value === 'Admin') return user.source === 'admin' && user.roleCode === 'SUPER_ADMIN';
  if (value === 'Driver') return user.roleFilterCode === 'DRIVER';
  return user.roleKind === 'TEAM_ROLE' && user.role.toLowerCase() === value.toLowerCase();
}
function collection(dto, names) {
  if (Array.isArray(dto)) return dto;
  for (const name of names) if (Array.isArray(dto?.[name])) return dto[name];
  return null;
}
async function readPages(baseQuery, api, url, names, params = {}, all = true) {
  const rows = [],
    seen = new Set();
  let page = 1,
    total = null,
    totalPages = 1;
  do {
    if (api.signal.aborted) return failure('The user request was cancelled.');
    const result = await baseQuery({
      url,
      params: {
        ...params,
        page,
        limit: all ? 100 : 5
      }
    });
    if (result.error) return result;
    const dto = unwrapApiResponseData(result.data),
      list = collection(dto, names),
      meta = record(dto?.pagination);
    if (!list) return failure('The response is missing a confirmed collection contract.');
    const ids = list.map(r => text(r?.id));
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return failure('The collection contains missing or duplicate record IDs.');
    if (meta.page !== page || count(meta.total) == null || count(meta.totalPages) == null || !count(meta.limit) || meta.limit > 100 || meta.totalPages > 500
      || list.length > meta.limit || list.length > meta.total || meta.total > 0 && !list.length
      || meta.totalPages !== Math.ceil(meta.total / meta.limit) && !(meta.total === 0 && meta.totalPages === 1)
      || page > Math.max(1, meta.totalPages)) return failure('The response needs complete pagination before filtering or exporting.');
    if (!all) return { data: list.slice(0, 5) };
    if (total != null && (total !== meta.total || totalPages !== Math.max(1, meta.totalPages))) return failure('The collection changed while loading. Refresh to load every record.');
    total = meta.total;
    totalPages = Math.max(1, meta.totalPages);
    if (page < totalPages && !list.length) return failure('The collection ended before its final page.');
    for (const row of list) {
      if (seen.has(row.id)) return failure('A record was repeated across pages.');
      seen.add(row.id);
      rows.push(row);
    }
    page++;
  } while (page <= totalPages);
  return rows.length === total ? {
    data: rows
  } : failure('The complete collection could not be confirmed.');
}
async function readProfile(baseQuery, id, source, extras = true) {
  const result = await baseQuery({
    url: `${ROOT}/${encodeURIComponent(id)}`,
    params: {
      accountType: source
    }
  });
  if (result.error) return result;
  const dto = record(unwrapApiResponseData(result.data));
  if (dto.id !== id || dto.accountType !== source) return failure('The profile response does not match the requested account.');
  let permissions = null,
    preferences = null;
  if (extras) {
    const results = await Promise.all(['permissions', 'notification-preferences'].map(section => baseQuery({
      url: `${ROOT}/${encodeURIComponent(id)}/${section}`,
      params: {
        accountType: source
      }
    })));
    permissions = results[0].error ? null : unwrapApiResponseData(results[0].data);
    preferences = results[1].error ? null : unwrapApiResponseData(results[1].data);
  }
  return {
    data: adaptManagedUser(dto, source, true, {
      permissions,
      preferences
    })
  };
}
export function managedUserSummary(_rows, stats) {
  const cards = record(stats), out = {};
  for (const [view, key] of [['total', 'total'], ['active', 'active'], ['inactive', 'inactive'], ['locked', 'locked'], ['newThisMonth', 'newThisPeriod']]) {
    const metric = record(cards[key]);
    out[view] = count(metric.value);
    const previous = count(metric.previous);
    // State-card comparisons are unknown until a previous snapshot exists.
    // Use the supplied percentage and direction; do not estimate either one.
    const percent = out[view] != null && previous != null ? number(metric.changePercent) : null;
    const direction = percent != null && ['UP', 'DOWN', 'FLAT'].includes(metric.direction) ? metric.direction : null;
    out[view + 'Caption'] = percent == null ? '— vs last month' : Math.abs(percent) + '% vs last month';
    out[view + 'Direction'] = direction && direction !== 'FLAT' ? direction.toLowerCase() : null;
  }
  return out;
}

function breakdown(raw) {
  if (Array.isArray(raw)) return raw.filter(v => v && typeof v === 'object' && !Array.isArray(v));
  return Object.entries(record(raw)).map(([code, value]) => typeof value === 'number' ? {
    code,
    count: value
  } : {
    ...record(value),
    code: text(value?.code) || code
  });
}
function share(v) {
  const n = number(v);
  return n != null && n >= 0 && n <= 100 ? n : null;
}
export function managedUserRoleChart(_rows, _adminsIncluded, stats) {
  const labels = ['Super Admin', 'Admin', 'Operations Manager', 'Dispatcher', 'Verifier', 'Driver', 'Viewer'];
  const colors = ['var(--tk-viz-1)', 'var(--tk-blue-hover)', 'var(--tk-viz-3)', 'var(--tk-viz-5)', 'var(--tk-viz-6)', 'var(--tk-viz-2)', 'var(--tk-ink-300)'];
  const entries = breakdown(stats?.byRole);
  return labels.map((name, i) => {
    const codes = name === 'Admin' ? ['ADMIN:SUPER_ADMIN'] : name === 'Driver' ? ['DRIVER'] : [`TEAM:${name}`];
    const item = entries.find(e => codes.includes(text(e.code) || text(e.role?.code) || text(e.role)) || (text(e.label) || text(e.role?.label)) === name);
    const value = item ? count(item.count) : null,
      percent = item ? share(item.sharePercent ?? item.share) : null;
    return {
      label: name,
      color: colors[i],
      value,
      display: value == null ? '—' : `${value} (${percent == null ? '—' : `${percent}%`})`
    };
  });
}
export function managedUserStatusChart(_rows, _summary, stats) {
  const entries = breakdown(stats?.byStatus);
  return ['Active', 'Inactive', 'Locked', 'Pending Invitation'].map(name => {
    const code = name.toUpperCase().replaceAll(' ', '_'),
      item = entries.find(e => (text(e.code) || text(e.status)) === code || (text(e.label)?.toUpperCase().replaceAll(' ', '_')) === code),
      value = item ? count(item.count) : null,
      percent = item ? share(item.sharePercent ?? item.share) : null;
    return {
      label: name,
      value: value ?? '—',
      share: percent == null ? '—' : `${percent}%`
    };
  });
}
export function managedUsersCsv(rows) {
  return [['User ID', 'Name', 'Email', 'Phone', 'Role', 'Entity / Company', 'Status', 'Last Active', 'Joined On'], ...rows.map(r => [r.backendId, r.name, r.email, r.phone, r.role, r.entity, r.status, r.lastActive, r.joinedOn])].map(row => row.map(v => {
    let cell = String(v ?? '—');
    if (/^[\t\r\n]|^\s*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(',')).join('\n');
}
export const canReadManagedUserActivity = (user, role) => Boolean(user?.isAccount && ADMIN_ROLES.has(role) && (user.source !== 'admin' || role === 'SUPER_ADMIN'));
function activity(raw) {
  const event = record(raw), outcome = text(event.outcome);
  return {
    id: text(event.id), actor: text(event.userName) || '—',
    text: label(event.action), description: text(event.description) || '—',
    ip: text(event.ipAddress) || '—', location: text(event.location) || '—',
    time: managedUserDate(event.timestamp),
    icon: outcome === 'SUCCESS' ? 'circle-check' : outcome === 'FAILED' ? 'circle-x' : 'history',
    tone: outcome === 'SUCCESS' ? 'var(--tk-success)' : outcome === 'FAILED' ? 'var(--tk-danger)' : 'var(--tk-ink-400)'
  };
}

function safeDocumentUrl(v) {
  try {
    const u = new URL(v);
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export function adaptManagedUserSection(section, raw) {
  const dto = record(raw);
  if (section === 'notification-preferences') return {
    values: [['Email Notifications', boolean(dto.emailEnabled)], ['Push Notifications', boolean(dto.pushEnabled)], ['SMS Notifications', boolean(dto.smsEnabled)], ['Login Notifications', boolean(dto.loginAlertsEnabled)]].map(([label, value]) => ({
      label,
      value: value == null ? '—' : value ? 'Enabled' : 'Disabled'
    }))
  };
  if (section === 'permissions') {
    const keys = Array.isArray(dto.permissionKeys) && dto.permissionKeys.every(v => text(v)) ? dto.permissionKeys : null;
    const routes = Array.isArray(dto.allowedRoutes) && dto.allowedRoutes.every(v => text(v)) ? dto.allowedRoutes : null;
    return {
      values: [{
        label: 'Access Level',
        value: text(dto.accessLevel) || (dto.primaryRole?.kind === 'ADMIN_ACCESS' ? text(dto.primaryRole.code) : null) || '—'
      }],
      rows: keys ? keys.map(key => ({
        id: key,
        permission: key
      })) : routes ? routes.map(key => ({
        id: key,
        permission: key
      })) : null
    };
  }
  const list = collection(raw, [section, 'items']);
  if (!list || list.some(v => !v || typeof v !== 'object' || Array.isArray(v))) return {
    rows: null
  };
  return {
    rows: list.map((raw, i) => {
      const r = record(raw);
      return section === 'sessions' ? {
        id: text(r.sessionId) || text(r.id) || String(i),
        device: text(r.device) || text(r.userAgent) || '—',
        ip: text(r.ipAddress) || '—',
        status: ['ACTIVE', 'REVOKED', 'EXPIRED', 'ENDED'].includes(r.status) ? label(r.status) : '—',
        reason: text(r.revokedReason) || '—',
        created: managedUserDate(r.createdAt),
        lastActive: managedUserDate(r.lastSeenAt ?? r.lastActiveAt),
        expires: managedUserDate(r.expiresAt)
      } : {
        id: text(r.id) || String(i),
        name: text(r.name) || text(r.type) || '—',
        status: label(r.status),
        uploaded: managedUserDate(r.uploadedAt),
        expires: managedUserDate(r.expiresAt),
        url: safeDocumentUrl(r.url ?? r.fileURL)
      };
    })
  };
}
function accountDownloadFilename(headers, kind) {
  const extension = kind === 'report' ? 'pdf' : 'json';
  const disposition = headers?.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*\s*=\s*UTF-8'[^']*'([^;]+)/i)?.[1];
  const plain = disposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  let filename = plain?.[1] || plain?.[2] || '';
  if (encoded) { try { filename = decodeURIComponent(encoded.trim()); } catch { /* Use the plain filename. */ } }
  filename = filename.split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f\x7f]/g, '').trim();
  return filename && filename.length <= 180 && !filename.startsWith('.') && filename.toLowerCase().endsWith('.' + extension) ? filename : kind === 'report' ? 'trukkas-user-report.pdf' : 'trukkas-user-data.json';
}
async function stateAfter(baseQuery, id, source) {
  return readProfile(baseQuery, id, source, false);
}
function secureEndpoints(definitions) {
  for (const definition of Object.values(definitions)) {
    const handler = definition.queryFn;
    if (!handler) continue;
    definition.queryFn = async (args, api, options, baseQuery) => {
      const account = api.getState().auth.admin;
      const current = () => !api.signal.aborted && Boolean(api.getState().auth.accessToken) && api.getState().auth.admin?.id === account?.id && api.getState().auth.admin?.role === account?.role && (!args?.owner || args.owner === account?.id);
      if (!current()) return failure('The admin session changed. Sign in again.', 403);
      const guarded = async request => {
        if (!current()) return failure('The admin session changed.', 403);
        const result = await baseQuery(request);
        return current() ? result : failure('The admin session changed.', 403);
      };
      const result = await handler(args, api, options, guarded);
      return current() || result.data?.authUpdated === true && api.getState().auth.accessToken && api.getState().auth.admin?.id === account?.id ? result : failure('The admin session changed.', 403);
    };
  }
  return definitions;
}
const apiWithTags = baseApi.enhanceEndpoints({
  addTagTypes: ['AdminManagedUsers', 'AdminAuditLogs', 'AdminRoles', 'AdminPermissions']
});
export const usersApi = apiWithTags.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: builder => secureEndpoints({
    getUserManagementDirectory: builder.query({
      async queryFn({
        includeAdmins = false
      } = {}, api, _opts, baseQuery) {
        const blocked = access(api, includeAdmins ? 'admin' : 'user');
        if (blocked) return blocked;
        const sources = includeAdmins ? ['user', 'admin'] : ['user'],
          rows = [];
        for (const source of sources) {
          const result = await readPages(baseQuery, api, ROOT, ['users'], {
            accountType: source,
            sort: '-joinedAt'
          });
          if (result.error) return result;
          if (result.data.some(r => text(r.accountType) && r.accountType !== source)) return failure('The directory mixed account namespaces.');
          rows.push(...result.data.map(r => adaptManagedUser(r, source)));
        }
        return {
          data: {
            rows,
            adminsIncluded: includeAdmins
          }
        };
      },
      providesTags: ['AdminManagedUsers']
    }),
    getUserManagementStats: builder.query({
      async queryFn({
        includeAdmins = false
      } = {}, api, _opts, baseQuery) {
        const blocked = access(api, includeAdmins ? 'admin' : 'user');
        if (blocked) return blocked;
        const result = await baseQuery({
          url: `${ROOT}/summary`,
          params: {
            scope: includeAdmins ? 'all' : 'users'
          }
        });
        if (result.error) return result;
        const data = record(unwrapApiResponseData(result.data));
        if (data.scope !== (includeAdmins ? 'all' : 'users')) return failure('The summary response does not match the requested account scope.');
        return { data };
      },
      providesTags: ['AdminManagedUsers']
    }),
    getUserManagementRecentActivity: builder.query({
      async queryFn({
        all = false
      } = {}, api, _opts, baseQuery) {
        const blocked = access(api);
        if (blocked) return blocked;
        const result = await readPages(baseQuery, api, `${ROOT}/activity`, ['events'], {}, all);
        return result.error ? result : {
          data: result.data.map(activity)
        };
      },
      providesTags: ['AdminManagedUsers', 'AdminAuditLogs']
    }),
    getManagedUserProfile: builder.query({
      async queryFn({
        id,
        source = 'user'
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id)) return failure('A user ID is required.');
        return readProfile(baseQuery, id, source);
      },
      providesTags: ['AdminManagedUsers', 'AdminPermissions', 'AdminRoles']
    }),
    getManagedUserActivity: builder.query({
      async queryFn({
        id,
        source,
        all = false
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id) || id.startsWith('invite_')) return failure('This record is an invitation, not an account.');
        const result = await readPages(baseQuery, api, `${ROOT}/${encodeURIComponent(id)}/activity`, ['events'], {
          accountType: source
        }, all);
        return result.error ? result : {
          data: result.data.map(activity)
        };
      },
      providesTags: ['AdminManagedUsers', 'AdminAuditLogs']
    }),
    getManagedUserSections: builder.query({
      async queryFn({
        id,
        source,
        section
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id) || !['permissions', 'sessions', 'documents', 'notification-preferences'].includes(section)) return failure('This account section is not supported.');
        if (id.startsWith('invite_')) return failure('This record is an invitation, not an account.');
        if (section === 'documents') {
          const result = await readPages(baseQuery, api, `${ROOT}/${encodeURIComponent(id)}/documents`, ['documents', 'items'], {
            accountType: source
          });
          return result.error ? result : {
            data: adaptManagedUserSection(section, {
              documents: result.data
            })
          };
        }
        const result = await baseQuery({
          url: `${ROOT}/${encodeURIComponent(id)}/${section}`,
          params: {
            accountType: source
          }
        });
        return result.error ? result : {
          data: adaptManagedUserSection(section, unwrapApiResponseData(result.data))
        };
      },
      providesTags: ['AdminManagedUsers', 'AdminPermissions', 'AdminRoles']
    }),
    getManagedUserRoleChoices: builder.query({
      async queryFn({
        source,
        entityId
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (source === 'admin') return {
          data: [...ADMIN_ROLES].map(id => ({
            value: id,
            label: id === 'SUPER_ADMIN' ? 'Super Admin' : ROLE_LABELS[id]
          }))
        };
        if (!text(entityId)) return failure('The company ID is needed to load assignable team roles.');
        const result = await readPages(baseQuery, api, '/admin/roles', ['roles'], {
          companyId: entityId,
          status: 'ACTIVE'
        });
        if (result.error) return result;
        return {
          data: result.data.filter(r => text(r.id) && text(r.name) && r.status === 'ACTIVE' && (['SYSTEM', 'SHARED'].includes(r.ownership) || r.ownership === 'COMPANY' && r.companyId === entityId)).map(r => ({
            value: r.id,
            label: r.name
          }))
        };
      },
      providesTags: ['AdminRoles']
    }),
    createManagedAdmin: builder.mutation({
      async queryFn({
        name,
        email,
        role,
        password
      }, api, _opts, baseQuery) {
        const blocked = access(api, 'admin');
        if (blocked) return blocked;
        if (!text(name) || !text(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !ADMIN_ROLES.has(role) || typeof password !== 'string' || Array.from(password).length < 8) return failure('Enter a name, valid email, admin role and a password of at least 8 characters.');
        const body = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          password
        };
        const result = await baseQuery({
          url: '/admin/admins',
          method: 'POST',
          body
        });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)),
          r = record(dto.admin);
        if (!text(r.id) || text(r.email)?.toLowerCase() !== body.email || r.name !== body.name || r.role !== role || r.isActive !== true) return failure('The creation response could not be confirmed. Refresh before trying again.');
        return {
          data: {
            id: r.id,
            message: text(dto.message) || 'Admin created.'
          }
        };
      },
      invalidatesTags: allTags
    }),
    updateManagedAdmin: builder.mutation({
      async queryFn({
        id,
        name,
        role
      }, api, _opts, baseQuery) {
        const blocked = access(api, 'admin');
        if (blocked) return blocked;
        if (!text(id) || name !== undefined && !text(name) || role !== undefined && !ADMIN_ROLES.has(role) || name === undefined && role === undefined) return failure('Enter a valid admin name or role.');
        const body = {
            ...(name !== undefined ? {
              name: name.trim()
            } : {}),
            ...(role !== undefined ? {
              role
            } : {})
          },
          result = await baseQuery({
            url: `/admin/admins/${encodeURIComponent(id)}`,
            method: 'PATCH',
            body
          });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)),
          r = record(dto.admin);
        if (r.id !== id || !ADMIN_ROLES.has(r.role) || name !== undefined && r.name !== body.name || role !== undefined && r.role !== role) return failure('The account update could not be confirmed. Refresh before trying again.');
        const current = api.getState().auth.admin;
        if (current?.id === id) api.dispatch(setCredentials({
          admin: {
            ...current,
            name: r.name,
            role: r.role
          }
        }));
        return {
          data: {
            message: text(dto.message) || 'Admin updated.',
            authUpdated: current?.id === id
          }
        };
      },
      invalidatesTags: allTags
    }),
    renameManagedUser: builder.mutation({
      async queryFn({ id, source, name, expectedVersion }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        const nextName = text(name);
        if (!['user', 'admin'].includes(source) || !text(id) || id.startsWith('invite_') || !nextName || nextName.length < 2 || nextName.length > 100 || !text(expectedVersion)) return failure('Enter a name of 2–100 characters and refresh the account version before saving.');
        const result = await baseQuery({
          url: ROOT + '/' + encodeURIComponent(id),
          method: 'PATCH',
          body: { accountType: source, name: nextName, expectedVersion }
        });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (dto.id !== id || dto.accountType !== source || dto.name !== nextName || !text(dto.version) || dto.version === expectedVersion) return failure('The name update could not be confirmed. Refresh before trying again.');
        const current = api.getState().auth.admin;
        if (source === 'admin' && current?.id === id) api.dispatch(setCredentials({ admin: { ...current, name: dto.name } }));
        return { data: { message: 'User updated.', authUpdated: source === 'admin' && current?.id === id } };
      },
      invalidatesTags: allTags
    }),
    changeManagedUserAccess: builder.mutation({
      async queryFn({
        id,
        source,
        operation,
        reason,
        expectedVersion
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (source !== 'user' || !text(id) || id.startsWith('invite_') || !['suspend', 'activate'].includes(operation)) return failure('This access transition needs the account lock/unlock control.');
        if (operation === 'suspend' && !text(reason)) return failure('A suspension reason is required.');
        const before = await readProfile(baseQuery, id, source, false);
        if (before.error) return before;
        const account = before.data;
        if (account.backendId !== id || (operation === 'suspend' ? account.statusCode !== 'ACTIVE' : !['SUSPENDED', 'INACTIVE'].includes(account.statusCode))) return failure('The account status changed or this transition is unavailable. Refresh the user.');
        if (operation === 'activate' && (!text(expectedVersion) || account.version !== expectedVersion)) return failure('The account version changed. Refresh the user before activating.', 409);
        if (operation === 'activate' && account.statusCode === 'INACTIVE' && !text(reason)) return failure('An activation reason is required.');
        const result = await baseQuery({
          url: '/admin/users/' + encodeURIComponent(id) + '/' + operation,
          method: 'POST',
          body: operation === 'suspend' ? { reason: reason.trim() } : { expectedVersion, ...(text(reason) ? { reason: reason.trim() } : {}) }
        });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (operation === 'suspend') {
          if (dto.user?.id !== id || dto.user.status !== 'SUSPENDED') return failure('The updated access could not be confirmed. Refresh before trying again.');
        } else if (dto.id !== id || dto.status !== 'ACTIVE' || !text(dto.version) || dto.version === expectedVersion || dto.user?.id !== id) {
          return failure('The updated access could not be confirmed. Refresh before trying again.');
        }
        return {
          data: {
            message: text(dto.message) || 'Account updated.'
          }
        };
      },
      invalidatesTags: allTags
    }),
    runManagedUserAction: builder.mutation({
      async queryFn({
        id,
        source,
        action,
        reason,
        expectedVersion,
        key
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id) || id.startsWith('invite_') || !['lock', 'unlock', 'force-logout', 'password-reset', 'delete'].includes(action)) return failure('This account action is not supported.');
        const role = api.getState().auth.admin?.role;
        if (action === 'delete' && (source === 'admin' || role !== 'SUPER_ADMIN')) return failure('Only Super Admins can delete platform users; admin accounts cannot be deleted.', 403);
        if (source === 'admin' && ['lock', 'force-logout'].includes(action) && api.getState().auth.admin?.id === id) return failure('You cannot revoke your own access.');
        const reset = action === 'password-reset';
        if (!reset && (!text(reason) || !text(expectedVersion))) return failure('A reason and the current account version are required.');
        if (['delete', 'password-reset'].includes(action) && !validKey(key)) return failure('A valid idempotency key is required.');
        if (!reset) {
          const before = await readProfile(baseQuery, id, source, false);
          if (before.error) return before;
          if (!before.data.isAccount || before.data.version !== expectedVersion) return failure('The account changed. Refresh it and review this action again.');
          if (action === 'unlock' && before.data.statusCode !== (source === 'admin' ? 'REVOKED' : 'LOCKED')) return failure('This account is not locked. Refresh its status.');
          if (['lock', 'delete'].includes(action) && before.data.statusCode === 'DELETED') return failure('This user has already been deleted.');
        }
        const body = {
            accountType: source,
            ...(!reset ? {
              reason: reason.trim(),
              expectedVersion
            } : {})
          },
          result = await baseQuery({
            url: action === 'delete' ? `${ROOT}/${encodeURIComponent(id)}` : `${ROOT}/${encodeURIComponent(id)}/${action}`,
            method: action === 'delete' ? 'DELETE' : 'POST',
            body,
            ...(['delete', 'password-reset'].includes(action) ? {
              headers: {
                'x-idempotency-key': key
              }
            } : {})
          });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (reset) {
          if (dto.deliveryStatus !== 'SENT') return failure(text(dto.error) || 'The password reset was not delivered.');
          return {
            data: {
              message: text(dto.message) || 'Password reset sent.'
            }
          };
        }
        if (action === 'force-logout') {
          if (count(dto.revokedSessions) == null) return failure('The session revocation response could not be confirmed. Refresh the account.');
          return {
            data: {
              message: `${dto.revokedSessions} session${dto.revokedSessions === 1 ? '' : 's'} signed out.`
            }
          };
        }
        const updated = await stateAfter(baseQuery, id, source);
        const status = updated.data?.statusCode;
        const confirmed = action === 'delete' ? status === 'DELETED' || updated.error?.status === 404 : action === 'lock' ? status === (source === 'admin' ? 'REVOKED' : 'LOCKED') : source === 'admin' ? status === 'ACTIVE' : status != null && !['LOCKED', 'REVOKED'].includes(status);
        if (!confirmed) return failure('The action was submitted but its updated state could not be confirmed. Refresh before retrying.');
        return {
          data: {
            message: text(dto.message) || (action === 'delete' ? 'User data anonymised.' : action === 'lock' ? 'Account locked.' : 'Account unlocked.')
          }
        };
      },
      invalidatesTags: allTags
    }),
    updateManagedUserPermissions: builder.mutation({
      async queryFn({
        id,
        source,
        roleId,
        expectedVersion
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id) || !text(roleId) || !text(expectedVersion) || source === 'admin' && !ADMIN_ROLES.has(roleId)) return failure('Select a role and refresh the account version before saving.');
        if (id.startsWith('invite_')) return failure('Invitations do not have account permissions.');
        const before = await readProfile(baseQuery, id, source, false);
        if (before.error) return before;
        if (before.data.version !== expectedVersion || source === 'user' && before.data.roleKind !== 'TEAM_ROLE') return failure('Only current company team seats can be reassigned. Refresh the account.');
        const result = await baseQuery({
          url: `${ROOT}/${encodeURIComponent(id)}/permissions`,
          method: 'PATCH',
          body: {
            accountType: source,
            roleId,
            expectedVersion
          }
        });
        if (result.error) return result;
        const updated = await readProfile(baseQuery, id, source);
        if (updated.error || (source === 'admin' ? updated.data.roleCode !== roleId : updated.data.roleId !== roleId)) return failure('The role update was submitted but its saved role could not be confirmed. Refresh the account.');
        const current = api.getState().auth.admin;
        if (source === 'admin' && current?.id === id) api.dispatch(setCredentials({
          admin: {
            ...current,
            role: updated.data.roleCode
          }
        }));
        return {
          data: {
            message: 'Role updated.',
            authUpdated: source === 'admin' && current?.id === id
          }
        };
      },
      invalidatesTags: allTags
    }),
    sendManagedUserMessage: builder.mutation({
      async queryFn({
        id,
        source,
        channel,
        subject,
        message,
        key
      }, api, _opts, baseQuery) {
        const blocked = access(api, source);
        if (blocked) return blocked;
        if (!text(id) || id.startsWith('invite_') || !['EMAIL', 'SMS'].includes(channel) || !text(message) || channel === 'EMAIL' && !text(subject) || !validKey(key)) return failure('Enter the message, email subject where applicable, and a valid request key.');
        if (source === 'admin' && channel === 'SMS') return failure('Admin accounts have no SMS phone number.');
        const result = await baseQuery({
          url: `${ROOT}/${encodeURIComponent(id)}/messages`,
          method: 'POST',
          headers: {
            'x-idempotency-key': key
          },
          body: {
            accountType: source,
            channel,
            ...(channel === 'EMAIL' ? {
              subject: subject.trim()
            } : {}),
            message: message.trim()
          }
        });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (!text(dto.messageId) || dto.channel !== channel || dto.deliveryStatus !== 'SENT' || timestamp(dto.sentAt) == null) return failure(text(dto.error) || 'The message delivery could not be confirmed.');
        return {
          data: {
            message: `${channel === 'EMAIL' ? 'Email' : 'SMS'} sent.`
          }
        };
      },
      invalidatesTags: ['AdminManagedUsers', 'AdminAuditLogs']
    }),
    importManagedUsers: builder.mutation({
      async queryFn({
        file
      }, api, _opts, baseQuery) {
        const blocked = access(api);
        if (blocked) return blocked;
        if (!(file instanceof File) || !file.size) return failure('Select a CSV file.');
        const body = new FormData();
        body.append('file', file);
        const result = await baseQuery({
          url: `${ROOT}/import`,
          method: 'POST',
          body
        });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data));
        if (count(dto.processed) == null || count(dto.created) == null || count(dto.failed) == null || dto.created + dto.failed !== dto.processed || !Array.isArray(dto.rows) || dto.rows.length !== dto.processed || dto.rows.some(r => !r || typeof r !== 'object' || !Number.isSafeInteger(r.row) || r.row < 2 || !['CREATED', 'FAILED'].includes(r.status) || r.status === 'CREATED' && !text(r.id)) || dto.rows.filter(r => r.status === 'CREATED').length !== dto.created || dto.rows.filter(r => r.status === 'FAILED').length !== dto.failed) return failure('The import results could not be confirmed. Refresh before retrying.');
        return {
          data: {
            processed: dto.processed,
            created: dto.created,
            failed: dto.failed,
            rows: dto.rows.map(r => ({
              row: r.row,
              email: text(r.email) || '—',
              status: r.status,
              error: text(r.error) || '—'
            }))
          }
        };
      },
      invalidatesTags: allTags
    }),
    getManagedUserDownload: builder.query({
      async queryFn({
        id,
        source,
        kind
      }, api, _opts, baseQuery) {
        const blocked = access(api, 'admin');
        if (blocked) return blocked;
        if (!text(id) || !['user', 'admin'].includes(source) || !['report', 'export'].includes(kind)) return failure('This account download is not supported.');
        const result = await baseQuery({
          url: `${ROOT}/${encodeURIComponent(id)}/${kind}`,
          params: {
            accountType: source,
            format: kind === 'report' ? 'pdf' : 'json'
          },
          responseHandler: async response => {
            if (response.ok) return response.blob();
            const body = await response.text();
            try { return JSON.parse(body); } catch { return { message: 'The account download failed.' }; }
          }
        });
        if (result.error) {
          if (result.error.data instanceof Blob) return {
            error: {
              status: result.error.status,
              data: {
                message: 'The account download failed.'
              }
            }
          };
          return result;
        }
        const blob = result.data;
        if (!(blob instanceof Blob) || !blob.size) return failure('The account download was empty.');
        if (kind === 'report') {
          if ((await blob.slice(0, 5).text()) !== '%PDF-') return failure('The report response was not a valid PDF.');
        } else {
          try {
            const dto = JSON.parse(await blob.text()),
              data = unwrapApiResponseData(dto);
            if (!data || typeof data !== 'object' || Array.isArray(data) || data.error || data.statusCode >= 400) return failure('The export response was not account data.');
            const profile = record(data.profile);
            if (profile.id !== id || profile.accountType !== source) return failure('The export response could not be matched to this account.');
            const permissions = data.permissions;
            if (timestamp(data.exportedAt) == null || !permissions || typeof permissions !== 'object' || Array.isArray(permissions)
              || ['sessions', 'activity', 'documents', 'jobs'].some(section => !Array.isArray(data[section]))
              || !Object.hasOwn(data, 'wallet') || data.wallet !== null && (!data.wallet || typeof data.wallet !== 'object' || Array.isArray(data.wallet) || !Array.isArray(data.wallet.transactions))) return failure('The export response was missing documented account sections.');
            if (text(permissions.accountType) && permissions.accountType !== source) return failure('The export permissions did not match this account type.');
          } catch {
            return failure('The export response was not valid JSON.');
          }
        }
        return {
          data: {
            url: URL.createObjectURL(blob),
            filename: accountDownloadFilename(result.meta?.response?.headers, kind)
          }
        };
      },
      keepUnusedDataFor: 0
    })
  })
});
export const {
  useGetUserManagementDirectoryQuery,
  useGetUserManagementStatsQuery,
  useGetUserManagementRecentActivityQuery,
  useGetManagedUserProfileQuery,
  useLazyGetManagedUserProfileQuery,
  useGetManagedUserActivityQuery,
  useGetManagedUserSectionsQuery,
  useGetManagedUserRoleChoicesQuery,
  useCreateManagedAdminMutation,
  useChangeManagedUserAccessMutation,
  useUpdateManagedAdminMutation,
  useRenameManagedUserMutation,
  useRunManagedUserActionMutation,
  useUpdateManagedUserPermissionsMutation,
  useSendManagedUserMessageMutation,
  useImportManagedUsersMutation,
  useLazyGetManagedUserDownloadQuery
} = usersApi;
