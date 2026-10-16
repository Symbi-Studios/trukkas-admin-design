import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { adaptRole, adaptPermissionCatalog, roleInteger, roleText, roleFailure, buildRoleConfiguration, permissionsForConfiguration } from './roleContracts.js';
export { roleSummary, emptyRoleDetail, roleCount } from './roleContracts.js';

export const ROLE_CAPABILITIES = Object.freeze({ create: true, edit: true, duplicate: true, delete: true, matrix: true, preview: true });
const admins = ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'];
const owned = (api, owner, account) => Boolean(owner && api.getState().auth.admin?.id === owner && api.getState().auth.accessToken && admins.includes(api.getState().auth.admin?.role) && !api.signal.aborted && api.getState().auth.admin === account);
const sessionError = () => roleFailure('An active admin session is required. Sign in again.');
const path = (id) => '/admin/roles/' + encodeURIComponent(id);
const signature = (catalog) => JSON.stringify(catalog.modules.map((m) => [m.key, m.uiGroupKey, m.actions.map((a) => a.key)]));
async function readCatalog(baseQuery) {
  const result = await baseQuery({ url: '/admin/permissions' });
  if (result.error) return result;
  const catalog = adaptPermissionCatalog(unwrapApiResponseData(result.data));
  return catalog ? { data: catalog } : roleFailure('The permission catalogue response is missing valid modules or actions.');
}
async function readRole(id, baseQuery) {
  if (!roleText(id) || id === '—') return roleFailure('Select a valid role.');
  const result = await baseQuery({ url: path(id) });
  if (result.error) return result;
  const role = adaptRole(unwrapApiResponseData(result.data), true);
  return role?.id === id ? { data: role } : roleFailure('The role detail response is missing the requested role.');
}
export function grantedRoleKeys(role, catalog) {
  const modules = role?.source?.modules;
  if (!Array.isArray(modules) || modules.length !== catalog.modules.length) return null;
  const keys = [], seen = new Set();
  for (const module of catalog.modules) {
    const actual = modules.filter((m) => m.key === module.key);
    if (actual.length !== 1 || !Array.isArray(actual[0].actions) || actual[0].actions.length !== module.actions.length) return null;
    for (const action of module.actions) {
      const entries = actual[0].actions.filter((a) => a.key === action.key);
      if (entries.length !== 1 || typeof entries[0].granted !== 'boolean' || seen.has(action.key)) return null;
      seen.add(action.key); if (entries[0].granted) keys.push(action.key);
    }
  }
  return keys;
}
function confirmsFields(role, body) {
  const source = role?.source;
  return Object.entries(body).every(([key, value]) => {
    if (['expectedVersion', 'permissionKeys', 'moduleAccess'].includes(key)) return true;
    // The API only supports organization-wide scope; SHARED ownership means companyId null.
    if (key === 'scope') return value === 'organization-wide' && source?.scope === 'ORGANIZATION' && source?.settings?.scope === 'ORGANIZATION';
    if (key === 'companyId' && value === null) return role?.ownership === 'SHARED' && source?.company === null;
    if (key === 'description' && value === '' && Object.hasOwn(source, key) && source[key] === null) return true;
    if (key === 'color') return typeof source?.color === 'string' && source.color.toLowerCase() === value.toLowerCase();
    if (key === 'isActive') return role?.statusCode === (value ? 'ACTIVE' : 'INACTIVE');
    return source?.[key] === value;
  });
}
function confirmsDuplicate(role, original) {
  const source = role.source, previous = original.source;
  const fields = ['description', 'color', 'icon', 'isActive', 'scope'];
  return role.memberCount === 0 && role.pendingInvites === 0 && role.version != null
    && fields.every((key) => Object.hasOwn(previous, key) && Object.hasOwn(source, key) && previous[key] === source[key])
    && ['scope', 'manageUsers', 'require2fa'].every((key) => previous.settings && source.settings
      && Object.hasOwn(previous.settings, key) && Object.hasOwn(source.settings, key) && previous.settings[key] === source.settings[key]);
}
const taggedApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminRoles', 'AdminPermissions'] });
export const rolesApi = taggedApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getAdminRolesDirectory: builder.query({
      async queryFn({ owner }, api, _options, baseQuery) {
        const account = api.getState().auth.admin;
        if (!owned(api, owner, account)) return sessionError();
        const rows = [], seen = new Set(); let page = 1, totalPages = 1, total = null;
        do {
          if (!owned(api, owner, account)) return sessionError();
          const result = await baseQuery({ url: '/admin/roles', params: { page, limit: 100 } });
          if (!owned(api, owner, account)) return sessionError();
          if (result.error) return result;
          const dto = unwrapApiResponseData(result.data), pagination = dto?.pagination;
          const currentTotal = roleInteger(pagination?.total), pages = roleInteger(pagination?.totalPages);
          if (!Array.isArray(dto?.roles) || roleInteger(pagination?.page) !== page || currentTotal == null || pages == null || pages > 500
            || (currentTotal > 0 && pages === 0) || page > Math.max(1, pages)) return roleFailure('The roles response is missing valid records or pagination.');
          if (total != null && (total !== currentTotal || totalPages !== Math.max(1, pages))) return roleFailure('The role directory changed while loading. Refresh to load all roles.');
          total = currentTotal; totalPages = Math.max(1, pages);
          if (page < totalPages && dto.roles.length === 0) return roleFailure('The roles response returned an incomplete collection.');
          for (const dtoRole of dto.roles) {
            const role = adaptRole(dtoRole);
            if (!role || seen.has(role.id)) return roleFailure('The roles response returned missing or duplicate role IDs.');
            seen.add(role.id); rows.push(role);
          }
          page += 1;
        } while (page <= totalPages);
        return rows.length === total ? { data: rows } : roleFailure('The roles response did not return the complete directory.');
      }, providesTags: ['AdminRoles'],
    }),
    getAdminPermissions: builder.query({
      async queryFn({ owner }, api, _options, baseQuery) {
        const account = api.getState().auth.admin;
        if (!owned(api, owner, account)) return sessionError();
        const result = await readCatalog(baseQuery);
        return owned(api, owner, account) ? result : sessionError();
      }, providesTags: ['AdminPermissions'],
    }),
    getAdminRole: builder.query({
      async queryFn({ owner, id }, api, _options, baseQuery) {
        const account = api.getState().auth.admin;
        if (!owned(api, owner, account)) return sessionError();
        const result = await readRole(id, baseQuery);
        return owned(api, owner, account) ? result : sessionError();
      }, providesTags: ['AdminRoles'],
    }),
    changeAdminRole: builder.mutation({
      async queryFn(args, api, _options, baseQuery) {
        const { action, owner, id } = args;
        const account = api.getState().auth.admin;
        if (!owned(api, owner, account)) return sessionError();
        if (!['create', 'edit', 'duplicate', 'delete'].includes(action)) return roleFailure('This role operation is not supported.');
        if (action === 'delete' && !['SUPER_ADMIN', 'OPS_ADMIN'].includes(account.role)) return roleFailure('Only Super Admin and Operations Admin can delete roles.');
        let request, body, current, catalog, expectedKeys;
        if (action === 'create' || action === 'edit' || action === 'duplicate') {
          const result = await readCatalog(baseQuery);
          if (!owned(api, owner, account)) return sessionError();
          if (result.error) return result;
          catalog = result.data;
          if (action !== 'duplicate' && (!args.catalog || signature(catalog) !== signature(args.catalog))) return roleFailure('The permission catalogue changed. Refresh and review permissions before saving.');
        }
        if (action !== 'create') {
          const result = await readRole(id, baseQuery);
          if (!owned(api, owner, account)) return sessionError();
          if (result.error) return result;
          current = result.data;
        }
        if (action === 'create') {
          try { body = buildRoleConfiguration(args.values, catalog); } catch (error) { return roleFailure(error.message); }
          expectedKeys = permissionsForConfiguration(body, catalog).flatMap((m) => m.actions.filter((a) => a.granted).map((a) => a.key));
          request = { url: '/admin/roles', method: 'POST', body };
        } else if (action === 'edit') {
          if (!current.version || current.version !== args.expectedVersion) return roleFailure('The role version is unavailable or changed. Refresh the role before saving.');
          const allowed = ['name', 'description', 'isActive', 'color', 'icon', 'permissionKeys'];
          body = { expectedVersion: current.version };
          for (const [key, value] of Object.entries(args.changes || {})) {
            if (!allowed.includes(key)) return roleFailure('This role field is not supported.');
            if (key === 'name' && (!roleText(value) || current.isSystem !== false)) return roleFailure('System roles cannot be renamed.');
            if (key === 'description' && typeof value !== 'string' || key === 'isActive' && typeof value !== 'boolean'
              || key === 'color' && (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) || key === 'icon' && !roleText(value)) return roleFailure('The role contains an invalid field.');
            if (key === 'isActive' && !value && current.memberCount == null) return roleFailure('The current member count is unavailable. Refresh before deactivating this role.');
            if (key === 'isActive' && !value && current.memberCount > 0) return roleFailure('Roles with members cannot be deactivated.');
            if (key === 'permissionKeys') {
              const valid = new Set(catalog.modules.flatMap((m) => m.actions.map((a) => a.key)));
              if (!Array.isArray(value) || new Set(value).size !== value.length || value.some((key) => !valid.has(key))) return roleFailure('The selected permissions do not match the catalogue.');
              if (!grantedRoleKeys(current, catalog)) return roleFailure('The current permission matrix is incomplete. Refresh before changing permissions.');
              expectedKeys = value;
            }
            body[key] = value;
          }
          if (Object.keys(body).length === 1) return roleFailure('There are no changes to save.');
          request = { url: path(id), method: 'PATCH', body };
        } else if (action === 'duplicate') {
          if (!roleText(current.source?.name)) return roleFailure('The role name is unavailable.');
          if (!current.ownership || current.ownership === 'COMPANY' && !current.companyId) return roleFailure('The current role ownership is unavailable. Refresh before duplicating.');
          if (!['description', 'color', 'icon', 'isActive', 'scope', 'settings'].every((key) => Object.hasOwn(current.source, key))
            || !current.source.settings || !['scope', 'manageUsers', 'require2fa'].every((key) => Object.hasOwn(current.source.settings, key))) return roleFailure('The current role settings are unavailable. Refresh before duplicating.');
          expectedKeys = grantedRoleKeys(current, catalog);
          if (!expectedKeys) return roleFailure('The full permission matrix is required before duplicating the role.');
          body = { name: current.source.name + ' (copy)' };
          request = { url: path(id) + '/duplicate', method: 'POST', body };
        } else {
          if (current.isSystem !== false || current.memberCount !== 0 || current.pendingInvites !== 0) return roleFailure('Only non-system roles without members or pending invites can be deleted.');
          request = { url: path(id), method: 'DELETE' };
        }
        if (!owned(api, owner, account)) return sessionError();
        const result = await baseQuery(request);
        if (!owned(api, owner, account)) return sessionError();
        if (result.error) return result;
        if (action === 'delete') {
          const confirmation = unwrapApiResponseData(result.data);
          if (confirmation?.deleted !== true || confirmation.id !== id) return roleFailure('The delete request completed, but its response could not be confirmed. Refresh before trying again.');
          const check = await baseQuery({ url: path(id) });
          if (!owned(api, owner, account)) return sessionError();
          return check.error?.status === 404 ? { data: { deleted: true, id } } : roleFailure('The delete request completed, but removal could not be confirmed. Refresh before trying again.');
        }
        const saved = adaptRole(unwrapApiResponseData(result.data), true);
        if (!saved || action === 'edit' && saved.id !== id || action !== 'edit' && saved.id === id) return roleFailure('The save request completed, but the returned role could not be confirmed. Refresh before trying again.');
        const check = await readRole(saved.id, baseQuery);
        if (!owned(api, owner, account)) return sessionError();
        if (check.error) return roleFailure('The save request completed, but the role could not be reloaded. Refresh before trying again.');
        const updated = check.data;
        if (!confirmsFields(updated, body) || action !== 'edit' && updated.isSystem !== false) return roleFailure('The save request completed, but its fields could not be confirmed. Refresh before trying again.');
        if (action === 'create' && (updated.source.settings?.manageUsers !== false || updated.source.settings?.require2fa !== false)) return roleFailure('The role was created, but its settings could not be confirmed. Refresh before trying again.');
        if (action === 'duplicate' && (updated.ownership !== (current.ownership === 'COMPANY' ? 'COMPANY' : 'SHARED')
          || current.ownership === 'COMPANY' && updated.companyId !== current.companyId
          || current.ownership !== 'COMPANY' && updated.source.company !== null)) return roleFailure('The duplicate was created, but its ownership could not be confirmed. Refresh before trying again.');
        if (action === 'duplicate' && !confirmsDuplicate(updated, current)) return roleFailure('The duplicate was created, but its copied settings could not be confirmed. Refresh before trying again.');
        if (expectedKeys) {
          const actualKeys = grantedRoleKeys(updated, catalog);
          if (!actualKeys || actualKeys.length !== expectedKeys.length || expectedKeys.some((key) => !actualKeys.includes(key))) return roleFailure('The save request completed, but its permissions could not be confirmed. Refresh before trying again.');
        }
        return { data: updated };
      }, invalidatesTags: ['AdminRoles'],
    }),
  }),
});
export const { useGetAdminRolesDirectoryQuery, useGetAdminPermissionsQuery, useGetAdminRoleQuery, useChangeAdminRoleMutation } = rolesApi;
