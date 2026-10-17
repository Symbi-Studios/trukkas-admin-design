import { ROLE_MODULE_MATRIX } from './rolesConfig.js';

export const roleText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
export const roleInteger = (value) => {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
export const roleCount = (value) => { const n = roleInteger(value); return n == null ? '—' : n.toLocaleString('en-NG'); };
export const roleFailure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
export function roleDate(value, withTime = false) {
  if (!roleText(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '—';
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return '—';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(parsed)) : '—';
}
export const ROLE_ICON_VALUES = { Shield: 'shield', 'Shield Check': 'shield-check', Users: 'users-round', Key: 'key-round', Eye: 'eye', Wallet: 'wallet', User: 'user' };
const icons = new Set([...Object.values(ROLE_ICON_VALUES), ...ROLE_MODULE_MATRIX.map((m) => m.icon), 'truck', 'radio-tower']);
const icon = (value) => icons.has(value) ? value : 'shield';
const display = (value) => roleText(value) || '—';
// The permission catalogue is authoritative when role detail carries older
// grouping metadata. Backend module keys remain separate in write payloads.
export function roleGroupKey(module, catalog) {
  const key = catalog?.modules.find(item => item.key === module.key)?.uiGroupKey || roleText(module.uiGroupKey) || module.key;
  return key === 'trips' ? 'jobs' : key;
}
export const emptyRoleDetail = {
  id: '—', name: '—', description: '—', type: '—', users: '—', status: '—', statusCode: null,
  lastUpdated: '—', createdOn: '—', createdBy: '—', updatedBy: '—', color: '#0241E8', icon: 'shield',
  permissionsCount: '—', permissionSummary: '—', modules: [],
};
export function adaptPermissionCatalog(dto) {
  if (!Array.isArray(dto?.modules)) return null;
  const seenModules = new Set(), seenKeys = new Set(), modules = [];
  for (const item of dto.modules) {
    if (!roleText(item?.key) || seenModules.has(item.key) || !Array.isArray(item.actions)) return null;
    seenModules.add(item.key);
    const actions = [];
    for (const action of item.actions) {
      if (!roleText(action?.key) || seenKeys.has(action.key)) return null;
      seenKeys.add(action.key);
      actions.push({ key: action.key, action: roleText(action.action), name: display(action.name), description: display(action.description) });
    }
    if (!ROLE_MODULE_MATRIX.some(row => row.key === item.uiGroupKey)) return null;
    modules.push({ key: item.key, uiGroupKey: item.uiGroupKey, name: display(item.name), icon: icon(item.icon), actions });
  }
  const totalModules = roleInteger(dto.totalModules), totalPermissions = roleInteger(dto.totalPermissions);
  if (totalModules !== modules.length || totalPermissions !== seenKeys.size || !Array.isArray(dto.uiGroups) || dto.uiGroups.length !== ROLE_MODULE_MATRIX.length) return null;
  const seenGroups = new Set(), uiGroups = [];
  for (const group of dto.uiGroups) {
    if (!ROLE_MODULE_MATRIX.some(row => row.key === group?.key) || seenGroups.has(group.key) || typeof group.supported !== 'boolean'
      || !Array.isArray(group.moduleKeys) || new Set(group.moduleKeys).size !== group.moduleKeys.length) return null;
    const sources = modules.filter(module => module.uiGroupKey === group.key);
    if (group.supported !== (sources.length > 0) || sources.length !== group.moduleKeys.length || group.moduleKeys.some(key => !sources.some(module => module.key === key))) return null;
    seenGroups.add(group.key); uiGroups.push({ key: group.key, supported: group.supported, moduleKeys: [...group.moduleKeys] });
  }
  return { modules, uiGroups, totalModules, totalPermissions };
}
export function catalogForRow(catalog, key) {
  return (catalog?.modules || []).filter((m) => roleGroupKey(m) === key);
}
function editorFromRoleDto(dto) {
  return {
    name: typeof dto?.name === 'string' ? dto.name : '',
    description: typeof dto?.description === 'string' ? dto.description : '',
    color: typeof dto?.color === 'string' && /^#[0-9a-f]{6}$/i.test(dto.color) ? dto.color : '',
    icon: Object.keys(ROLE_ICON_VALUES).find((label) => ROLE_ICON_VALUES[label] === dto?.icon) || '',
  };
}
export const roleEditorValues = (role) => role?.editor || editorFromRoleDto(role?.source);
export function adaptRole(dto, detail = false, catalog) {
  if (!roleText(dto?.id)) return null;
  const ownership = ['SYSTEM', 'SHARED', 'COMPANY'].includes(dto.ownership) ? dto.ownership : null;
  const isSystem = ownership ? ownership === 'SYSTEM' : typeof dto.isSystem === 'boolean' ? dto.isSystem : null;
  const statusCode = ['ACTIVE', 'INACTIVE'].includes(dto.status) ? dto.status : typeof dto.isActive === 'boolean' ? dto.isActive ? 'ACTIVE' : 'INACTIVE' : null;
  const sourceModules = Array.isArray(dto.modules) ? dto.modules : null;
  const seen = new Set();
  const rawModules = sourceModules?.flatMap((module) => {
    if (!roleText(module?.key) || seen.has(module.key)) return [];
    seen.add(module.key);
    const actions = Array.isArray(module.actions) ? module.actions.flatMap((action) => !roleText(action?.key) ? [] : [{
      key: action.key, name: display(action.name), description: display(action.description), granted: typeof action.granted === 'boolean' ? action.granted : null,
    }]) : null;
    return [{ key: module.key, uiGroupKey: roleText(module.uiGroupKey), name: display(module.name), icon: icon(module.icon), granted: roleCount(module.granted), total: roleCount(module.total),
      fullAccess: typeof module.fullAccess === 'boolean' ? module.fullAccess : null, level: ['full', 'custom', 'none'].includes(module.level) ? module.level : null, actions }];
  }) || [];
  const keys = Array.isArray(dto.permissions) && dto.permissions.every((key) => roleText(key)) && new Set(dto.permissions).size === dto.permissions.length ? dto.permissions : null;
  const detailCountKnown = sourceModules && rawModules.length === sourceModules.length && rawModules.every((m) => m.granted !== '—');
  const summaryGranted = roleInteger(dto.permissionSummary?.granted), summaryTotal = roleInteger(dto.permissionSummary?.total);
  const permissionCount = summaryGranted ?? (detailCountKnown ? rawModules.reduce((sum, m) => sum + roleInteger(m.granted.replaceAll(',', '')), 0) : keys?.length);
  const groups = new Map();
  for (const module of rawModules) {
    const row = ROLE_MODULE_MATRIX.find((m) => m.key === roleGroupKey(module, catalog));
    const groupKey = row?.key || module.key;
    const previous = groups.get(groupKey);
    if (!previous) groups.set(groupKey, { ...module, key: groupKey, name: row?.label || module.name, icon: row?.icon || module.icon });
    else {
      const sum = (a, b) => a === '—' || b === '—' ? '—' : roleCount(Number(a.replaceAll(',', '')) + Number(b.replaceAll(',', '')));
      previous.granted = sum(previous.granted, module.granted); previous.total = sum(previous.total, module.total);
      previous.fullAccess = previous.fullAccess == null || module.fullAccess == null ? null : previous.fullAccess && module.fullAccess;
      previous.actions = previous.actions && module.actions ? [...previous.actions, ...module.actions] : null;
    }
  }
  const modules = [...groups.values()];
  return {
    id: dto.id, name: display(dto.name), description: display(dto.description), isSystem, ownership,
    companyId: roleText(dto.company?.id),
    type: isSystem === true ? 'System' : isSystem === false ? 'Custom' : '—',
    users: roleCount(dto.memberCount), memberCount: roleInteger(dto.memberCount), pendingInvites: roleInteger(dto.pendingInvites),
    permissionsCount: roleCount(permissionCount), statusCode, status: statusCode === 'ACTIVE' ? 'Active' : statusCode === 'INACTIVE' ? 'Inactive' : '—',
    createdOn: roleDate(dto.createdAt), lastUpdated: roleDate(dto.updatedAt, true),
    createdBy: display(dto.createdBy?.name), updatedBy: display(dto.updatedBy?.name),
    permissionSummary: summaryGranted != null && summaryTotal != null && summaryGranted <= summaryTotal
      ? roleCount(summaryGranted) + ' of ' + roleCount(summaryTotal) + ' permissions granted.' : '—',
    color: typeof dto.color === 'string' && /^#[0-9a-f]{6}$/i.test(dto.color) ? dto.color : '#0241E8', icon: icon(dto.icon), modules,
    // expectedVersion is the returned updatedAt string, compared opaquely.
    version: roleText(dto.version) ? dto.version : null,
    editor: editorFromRoleDto(dto),
    source: detail ? dto : undefined,
  };
}
export function roleSummary(rows, catalog) {
  const classified = rows?.every((role) => typeof role.isSystem === 'boolean');
  return {
    totalRoles: roleCount(rows?.length), totalCaption: 'Across all modules',
    systemRoles: classified ? roleCount(rows.filter((role) => role.isSystem).length) : '—', systemCaption: 'Predefined roles',
    customRoles: classified ? roleCount(rows.filter((role) => !role.isSystem).length) : '—', customCaption: 'Organization specific',
    permissions: roleCount(catalog?.totalPermissions), permissionsCaption: 'Across ' + roleCount(catalog?.totalModules) + ' modules',
  };
}
export function buildRoleConfiguration(values, catalog) {
  if (!catalog?.modules) throw new Error('The permission catalogue must finish loading before saving.');
  if (!roleText(values.name)) throw new Error('Enter a role name.');
  if (values.roleType !== 'Custom') throw new Error('New system roles are not supported by the backend. Select Custom.');
  if (!['Active', 'Inactive'].includes(values.status)) throw new Error('Select a valid status.');
  if (values.scope !== 'org') throw new Error('Only organization-wide scope is supported by the backend.');
  if (values.manageUsers || values.require2fa) throw new Error('Team management is owner-only and 2FA is not supported. Turn off those settings before saving.');
  if (!/^#[0-9a-f]{6}$/i.test(values.color) || !ROLE_ICON_VALUES[values.icon]) throw new Error('Select a valid role color and icon.');
  const moduleAccess = buildRoleAccess(values, catalog);
  return { name: values.name.trim(), description: values.description.trim(), isActive: values.status === 'Active', color: values.color, icon: ROLE_ICON_VALUES[values.icon], scope: 'organization-wide', companyId: null, moduleAccess };
}
export function permissionsForConfiguration(configuration, catalog) {
  return catalog.modules.map((module) => {
    const selection = configuration.moduleAccess.find((m) => m.moduleKey === module.key);
    const keys = selection?.level === 'full' ? module.actions.map((a) => a.key) : selection?.level === 'custom' ? selection.permissionKeys : [];
    return { ...module, actions: module.actions.map((a) => ({ ...a, granted: keys.includes(a.key) })), granted: keys.length, total: module.actions.length };
  });
}

export function buildRoleAccess(values, catalog) {
  if (!catalog?.modules) throw new Error('The permission catalogue must finish loading.');
  const unmapped = catalog.modules.filter((module) => !ROLE_MODULE_MATRIX.some((row) => row.key === roleGroupKey(module)));
  if (unmapped.length) throw new Error('This form cannot configure these permission groups: ' + unmapped.map((module) => module.key).join(', ') + '. Role creation and preview are unavailable until their mapping is confirmed.');
  const moduleAccess = catalog.modules.map((m) => ({ moduleKey: m.key, level: 'none' }));
  for (const row of ROLE_MODULE_MATRIX) {
    const level = values.levels[row.key];
    const sources = catalogForRow(catalog, row.key);
    if (!sources.length) {
      if (level != null && level !== 'none') throw new Error(row.label + ' has no backend permissions and cannot be configured.');
      continue;
    }
    if (!['full', 'custom', 'none'].includes(level)) throw new Error('Select an access level for ' + row.label + '.');
    const selected = values.permissionKeys?.[row.key];
    if (level === 'custom' && (!Array.isArray(selected) || !selected.length)) throw new Error('Select custom actions for ' + row.label + '.');
    const valid = new Set(sources.flatMap((m) => m.actions.map((a) => a.key)));
    if (level === 'custom' && (new Set(selected).size !== selected.length || selected.some((key) => !valid.has(key)))) throw new Error('The custom permissions for ' + row.label + ' do not match the current catalogue.');
    for (const source of sources) {
      const entry = moduleAccess.find((m) => m.moduleKey === source.key); entry.level = level;
      if (level === 'custom') {
        const permissionKeys = selected.filter((key) => source.actions.some((a) => a.key === key));
        entry.level = permissionKeys.length ? 'custom' : 'none';
        if (permissionKeys.length) entry.permissionKeys = permissionKeys;
      }
    }
  }
  return moduleAccess;
}
