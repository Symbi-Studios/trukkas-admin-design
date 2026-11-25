import { COLUMN_GROUPS } from './reportsConfig.js';

const DAY = 86400000;
export function validReportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function currentReportRange(preset = 'Last 7 days') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name) => parts.find((item) => item.type === name).value;
  const dateTo = part('year') + '-' + part('month') + '-' + part('day');
  const end = new Date(dateTo + 'T00:00:00Z');
  const dateFrom = preset === 'This Month' ? dateTo.slice(0, 8) + '01'
    : new Date(end.getTime() - (preset === 'Last 30 days' ? 29 : 6) * DAY).toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}
export function reportRangeQuery(range) {
  if (!validReportDate(range?.dateFrom) || !validReportDate(range?.dateTo) || range.dateFrom > range.dateTo) return null;
  return { dateFrom: range.dateFrom + 'T00:00:00.000+01:00', dateTo: range.dateTo + 'T23:59:59.999+01:00' };
}
export function reportComparisonRange(range, comparison) {
  if (!reportRangeQuery(range)) return null;
  const start = new Date(range.dateFrom + 'T00:00:00Z'), end = new Date(range.dateTo + 'T00:00:00Z');
  const shift = (date) => {
    const year = date.getUTCFullYear() - (comparison === 'Previous Year' ? 1 : 0);
    const month = date.getUTCMonth() - (comparison === 'Previous Month' ? 1 : 0);
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))).toISOString().slice(0, 10);
  };
  if (comparison === 'Previous Month' || comparison === 'Previous Year') return { dateFrom: shift(start), dateTo: shift(end) };
  const days = comparison === 'Previous 7 days' ? 7 : Math.round((end - start) / DAY) + 1;
  return { dateFrom: new Date(start.getTime() - days * DAY).toISOString().slice(0, 10), dateTo: new Date(start.getTime() - DAY).toISOString().slice(0, 10) };
}
export function reportDateLabel(range) {
  if (!reportRangeQuery(range)) return '—';
  const format = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
  return format(range.dateFrom) + ' – ' + format(range.dateTo);
}
export function initialReportDraft() {
  return {
    reportType: 'verification', dateRangePreset: 'Last 7 days', ...currentReportRange(),
    filters: { entityType: 'All Types', entity: 'All Entities', status: 'All Statuses', location: 'All Locations', minAmount: '', maxAmount: '' },
    showMoreFilters: false,
    columnGroups: COLUMN_GROUPS.map((group) => ({ ...group, columns: group.columns.map((column) => ({ ...column })) })),
    columnSearch: '', format: 'xlsx', delivery: 'download', scheduleFrequency: 'Daily',
    fileSettings: { includeCharts: true, includeSummary: true, compressFile: true },
  };
}

const PRESET_FROM_API = { last_7_days: 'Last 7 days', last_30_days: 'Last 30 days', this_month: 'This Month' };
const ENTITY_TYPE_FROM_API = { FORWARDER: 'Forwarder', TRUCKING_COMPANY: 'Truck Company' };
const STATUS_FROM_API = { VERIFIED: 'Verified', PENDING: 'Pending', REJECTED: 'Rejected' };

/**
 * A builder draft from a saved template's configuration. Values the builder can't represent fall
 * back to its defaults; `unsupported` lists what was dropped so the screen can say so.
 */
export function draftFromConfiguration(configuration = {}, base = initialReportDraft()) {
  const config = configuration && typeof configuration === 'object' ? configuration : {};
  const filters = config.filters && typeof config.filters === 'object' ? config.filters : {};
  const unsupported = [];
  const draft = { ...base, filters: { ...base.filters } };
  if (typeof config.reportType === 'string') draft.reportType = config.reportType;
  const preset = PRESET_FROM_API[config.dateRangePreset];
  if (preset) Object.assign(draft, { dateRangePreset: preset }, currentReportRange(preset));
  else if (config.dateRangePreset === 'custom' && validReportDate(config.dateFrom) && validReportDate(config.dateTo)) Object.assign(draft, { dateRangePreset: 'Custom Range', dateFrom: config.dateFrom, dateTo: config.dateTo });
  else if (config.dateRangePreset) unsupported.push('date range "' + String(config.dateRangePreset).replaceAll('_', ' ') + '"');
  if (filters.entityType) { if (ENTITY_TYPE_FROM_API[filters.entityType]) draft.filters.entityType = ENTITY_TYPE_FROM_API[filters.entityType]; else unsupported.push('entity type filter'); }
  if (typeof filters.entityId === 'string' && filters.entityId) draft.filters.entity = filters.entityId;
  if (filters.status) { if (STATUS_FROM_API[filters.status]) draft.filters.status = STATUS_FROM_API[filters.status]; else unsupported.push('status filter'); }
  if (typeof filters.location === 'string' && filters.location.trim()) draft.filters.location = filters.location.trim();
  for (const key of ['minAmount', 'maxAmount']) if (typeof filters[key] === 'number' && Number.isFinite(filters[key])) draft.filters[key] = String(filters[key]);
  // No saved columns: leave none checked so the builder picks the report type's own defaults.
  const keys = new Set(Array.isArray(config.columns) ? config.columns : []);
  draft.columnGroups = base.columnGroups.map((group) => ({ ...group, columns: group.columns.map((column) => ({ ...column, checked: keys.has(column.key) })) }));
  if (typeof config.format === 'string' && ['xlsx', 'csv', 'pdf', 'json'].includes(config.format.toLowerCase())) draft.format = config.format.toLowerCase();
  if (config.delivery?.method === 'EMAIL') draft.delivery = 'email';
  if (config.schedule?.frequency) { draft.delivery = 'schedule'; draft.scheduleFrequency = config.schedule.frequency[0] + config.schedule.frequency.slice(1).toLowerCase(); }
  const settings = config.fileSettings && typeof config.fileSettings === 'object' ? config.fileSettings : {};
  draft.fileSettings = { ...base.fileSettings, ...Object.fromEntries(['includeCharts', 'includeSummary', 'compressFile'].filter((k) => typeof settings[k] === 'boolean').map((k) => [k, settings[k]])) };
  return { draft, unsupported };
}
