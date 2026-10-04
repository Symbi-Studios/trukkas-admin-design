import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { ROLE_MODULE_MATRIX } from './rolesConfig.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const count = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
export const roleCount = (value) => { const number = count(value); return number == null ? '—' : number.toLocaleString('en-NG'); };
const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
function date(value, withTime = false) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '—';
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return '—';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(parsed)) : '—';
}
export const ROLE_CAPABILITIES = Object.freeze({ create: false, edit: false, duplicate: false, delete: false, matrix: false, preview: false });
export const emptyRoleDetail = {
  id: '—', name: '—', description: '—', type: '—', users: '—', status: '—', statusCode: null,
  lastUpdated: '—', createdOn: '—', createdBy: '—', updatedBy: '—', color: '#0241E8', icon: 'shield',
  permissionsCount: '—', permissionSummary: '—', modules: [],
};
// Presentation for the action keys explicitly illustrated in the current docs.
const ACTIONS = {
  'jobs.view': { name: 'View Jobs', description: 'Allows viewing all jobs' },
  'jobs.create': { name: 'Create Jobs', description: 'Allows creating new jobs' },
  'trips.view': { name: 'View Trips', description: 'Allows viewing trips' },
};
function modulesFromPermissions(keys) {
  if (!keys) return [];
  const groups = new Map();
  keys.forEach((key) => {
    const prefix = key.split('.')[0], moduleKey = prefix === 'trips' ? 'jobs' : prefix;
    const presentation = ROLE_MODULE_MATRIX.find((module) => module.key === moduleKey);
    if (!presentation) return;
    if (!groups.has(moduleKey)) groups.set(moduleKey, { icon: presentation.icon, name: presentation.label, granted: 0, total: '—', fullAccess: null, actions: [] });
    const group = groups.get(moduleKey); group.granted += 1;
    if (ACTIONS[key]) group.actions.push({ ...ACTIONS[key], granted: true });
  });
  return [...groups.values()].map((module) => ({ ...module, actions: module.actions.length ? module.actions : null }));
}
function adaptRole(dto) {
  const permissions = Array.isArray(dto.permissions) && dto.permissions.every((key) => text(key) && key.includes('.') && key === key.trim()) && new Set(dto.permissions).size === dto.permissions.length ? dto.permissions : null;
  const statusCode = ['ACTIVE', 'INACTIVE'].includes(text(dto.status)?.toUpperCase()) ? text(dto.status).toUpperCase()
    : typeof dto.isActive === 'boolean' ? (dto.isActive ? 'ACTIVE' : 'INACTIVE') : null;
  return {
    id: dto.id, name: text(dto.name) || '—', description: text(dto.description) || '—',
    isSystem: typeof dto.isSystem === 'boolean' ? dto.isSystem : null,
    type: dto.isSystem === true ? 'System' : dto.isSystem === false ? 'Custom' : '—',
    users: roleCount(dto.memberCount), permissionsCount: roleCount(permissions?.length),
    statusCode, status: statusCode === 'ACTIVE' ? 'Active' : statusCode === 'INACTIVE' ? 'Inactive' : '—',
    createdOn: date(dto.createdAt), lastUpdated: date(dto.updatedAt, true),
    createdBy: text(dto.createdBy?.name) || text(dto.createdBy) || '—',
    updatedBy: text(dto.updatedBy?.name) || text(dto.updatedBy) || '—',
    permissionSummary: text(dto.permissionSummary) || '—',
    color: typeof dto.color === 'string' && /^#[0-9a-f]{6}$/i.test(dto.color) ? dto.color : '#0241E8',
    icon: ['shield', 'shield-check', 'users-round', 'key-round', 'eye', 'wallet', 'user', 'radio-tower'].includes(dto.icon) ? dto.icon : 'shield',
    modules: modulesFromPermissions(permissions),
  };
}
export function roleSummary(rows) {
  const classificationsKnown = rows?.every((role) => typeof role.isSystem === 'boolean');
  return {
    totalRoles: roleCount(rows?.length), totalCaption: 'Across all modules',
    systemRoles: classificationsKnown ? roleCount(rows.filter((role) => role.isSystem).length) : '—', systemCaption: 'Predefined roles',
    customRoles: classificationsKnown ? roleCount(rows.filter((role) => !role.isSystem).length) : '—', customCaption: 'Organization specific',
    // The union of permissions granted to roles is not the full permission catalog.
    permissions: '—', permissionsCaption: 'Across — modules',
  };
}
export const rolesApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminRolesDirectory: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const rows = [], seen = new Set();
        let page = 1, totalPages = 1, total = null;
        do {
          const result = await baseQuery({ url: '/admin/roles', params: { page, limit: 100 } });
          if (result.error) return result;
          const dto = unwrapApiResponseData(result.data), pagination = dto?.pagination;
          if (!Array.isArray(dto?.roles) || pagination?.page !== page || count(pagination.total) == null || count(pagination.totalPages) == null
            || (pagination.total > 0 && pagination.totalPages === 0) || page > Math.max(1, pagination.totalPages)) return failure('The roles response is missing valid records or pagination.');
          if (total != null && (total !== pagination.total || totalPages !== Math.max(1, pagination.totalPages))) return failure('The role directory changed while loading. Refresh to load all roles.');
          total = pagination.total; totalPages = Math.max(1, pagination.totalPages);
          if (page < totalPages && dto.roles.length === 0) return failure('The roles response returned an incomplete collection.');
          for (const role of dto.roles) {
            if (!text(role?.id) || seen.has(role.id)) return failure('The roles response returned missing or duplicate role IDs.');
            seen.add(role.id); rows.push(adaptRole(role));
          }
          page += 1;
        } while (page <= totalPages);
        return rows.length === total ? { data: rows } : failure('The roles response did not return the complete directory.');
      },
    }),
  }),
});
export const { useGetAdminRolesDirectoryQuery } = rolesApi;
