import { unwrapApiResponseData } from '../../api/baseApi.js';
import { settingsControls } from './settingsFields.js';

export const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
export const numeric = (value) => (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) && Number.isFinite(Number(value)) ? Number(value) : null;
const safeKey = (key) => typeof key === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && !['constructor', 'prototype', '__proto__'].includes(key);
const labelKey = (value) => text(value)?.toLowerCase().replace(/\s+/g, ' ');
export function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : null; }
export const sectionVersion = (value) => value === 'initial' ? value : timestamp(value);
export function dateLabel(value) { return timestamp(value) ? new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
const aliases = { defaultLanguage: 'platformLanguage', commissionRate: 'commissionPercent', vatRate: 'vatPercent', autoCompleteTrips: 'autoCompleteTripsOnPod', terminateAllSessionsOnPasswordChange: 'terminateSessionsOnPasswordChange' };
const displayCodes = {
  defaultLanguage: { en: 'English (EN)', fr: 'French (FR)', pt: 'Portuguese (PT)' },
  defaultCurrency: { NGN: 'Nigerian Naira (NGN)', USD: 'US Dollar (USD)' },
  timezone: { 'Africa/Lagos': '(GMT+01:00) Lagos, Nigeria' },
  distanceUnit: { km: 'Kilometers (km)' },
};
export const editableRoles = (section) => section === 'finance' ? ['SUPER_ADMIN', 'FINANCE_ADMIN'] : ['general', 'operations', 'fleet'].includes(section) ? ['SUPER_ADMIN', 'OPS_ADMIN'] : section === 'data-protection' ? ['SUPER_ADMIN'] : [];
export const canEditSettings = (section, role) => section === 'notifications' ? ['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role) : editableRoles(section).includes(role);
export function findSettingsField(page, group, field) { return settingsControls.find((control) => control.page === page && control.group === group && control.field === field); }
function enumChoices(control, descriptor) {
  const options = Array.isArray(descriptor.options) ? descriptor.options : [];
  return options.flatMap((option) => {
    const item = record(option), value = typeof option === 'string' || typeof option === 'number' ? option : item.value;
    if (!['string', 'number'].includes(typeof value)) return [];
    const label = text(item.label) || displayCodes[control.field]?.[value] || String(value);
    return control.options?.includes(label) ? [{ value, label }] : [];
  });
}
function decode(control, descriptor, value) {
  if (control.type === 'boolean') return typeof value === 'boolean' ? value : null;
  if (control.type === 'number') return numeric(value);
  if (control.type === 'enum') return enumChoices(control, descriptor).find((item) => item.value === value)?.label ?? (control.options?.includes(value) ? value : control.options?.includes(displayCodes[control.field]?.[value]) ? displayCodes[control.field][value] : null);
  return typeof value === 'string' ? value : null;
}
function matchDescriptor(control, descriptors) {
  const keys = [control.field, aliases[control.field], control.page === 'finance' && control.field === 'defaultCurrency' ? 'currency' : null].filter(Boolean);
  const byKey = descriptors.filter((field) => keys.includes(field.key));
  if (byKey.length === 1) return byKey[0];
  const byLabel = descriptors.filter((field) => labelKey(field.label) === labelKey(control.label));
  // Never choose arbitrarily between identically labelled fields.
  return byLabel.length === 1 ? byLabel[0] : null;
}
export function adaptSection(response, page) {
  const dto = record(unwrapApiResponseData(response));
  const descriptors = Array.isArray(dto.fields) ? dto.fields.filter((field) => safeKey(field?.key) && ['number', 'boolean', 'enum', 'string'].includes(field.type)) : [];
  const flat = record(dto.values), values = {}, contracts = {};
  for (const control of settingsControls.filter((field) => field.page === page)) {
    values[control.group] ||= {};
    const descriptor = matchDescriptor(control, descriptors);
    // String facts may fit an existing select. Editing still requires explicit
    // backend options so the control cannot invent wire values.
    const compatible = descriptor && (descriptor.type === control.type || (control.type === 'enum' && descriptor.type === 'string'));
    const raw = descriptor && Object.hasOwn(flat, descriptor.key) ? flat[descriptor.key] : descriptor?.value;
    values[control.group][control.field] = compatible ? decode(control, descriptor, raw) : null;
    if (compatible) contracts[control.group + '.' + control.field] = {
      key: descriptor.key, type: descriptor.type, editable: descriptor.editable === true && (control.type !== 'enum' || enumChoices(control, descriptor).length > 0),
      enforced: descriptor.enforced === true, description: text(descriptor.description),
      min: numeric(descriptor.min), max: numeric(descriptor.max), choices: enumChoices(control, descriptor),
      defaultValue: decode(control, descriptor, descriptor.default),
    };
  }
  return { page, values, contracts, version: sectionVersion(dto.version), meta: { lastUpdated: dateLabel(dto.updatedAt), updatedBy: text(record(dto.updatedBy).name) || '—' }, hasDescriptors: Array.isArray(dto.fields) };
}
export function encodeSetting(control, contract, value) {
  if (!contract?.editable || !safeKey(contract.key)) throw new Error('This setting is fixed or has no documented editable field.');
  if (control.type === 'boolean' && typeof value === 'boolean') return value;
  if (control.type === 'number') {
    const parsed = numeric(value);
    if (parsed != null && (contract.min == null || parsed >= contract.min) && (contract.max == null || parsed <= contract.max)) return parsed;
  }
  if (control.type === 'enum') {
    const choice = contract.choices.find((option) => option.label === value);
    if (choice) return choice.value;
  }
  if (control.type === 'string' && typeof value === 'string') return value;
  throw new Error('Enter a supported value for ' + control.label + '.');
}
export const preferenceFields = [
  { group: 'settingsNotificationChannels', field: 'inApp', key: 'inAppEnabled', fixed: true },
  { group: 'settingsNotificationChannels', field: 'email', key: 'emailEnabled' },
  { group: 'settingsNotificationChannels', field: 'sms', key: 'smsEnabled' },
  { group: 'settingsQuietHours', field: 'enabled', key: 'quietHoursEnabled' },
  { group: 'settingsQuietHours', field: 'from', key: 'quietHoursStart', time: true },
  { group: 'settingsQuietHours', field: 'to', key: 'quietHoursEnd', time: true },
];
function timeLabel(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':'); return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) >= 12 ? ' PM' : ' AM');
}
export function encodePreference(field, value) {
  if (field.fixed) throw new Error('The admin in-app feed is always on and cannot be changed.');
  if (!field.time) { if (typeof value === 'boolean') return value; }
  else {
    if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
    const match = typeof value === 'string' && /^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim());
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0') + ':' + match[2];
  }
  throw new Error('Enter a valid notification preference.');
}
export function adaptPreferences(response) {
  const dto = record(unwrapApiResponseData(response)), values = {}, contracts = {};
  for (const field of preferenceFields) {
    values[field.group] ||= {};
    values[field.group][field.field] = field.time ? timeLabel(dto[field.key]) : typeof dto[field.key] === 'boolean' ? dto[field.key] : null;
    contracts[field.group + '.' + field.field] = { ...field, editable: !field.fixed, enforced: field.fixed };
  }
  values.settingsQuietHours ||= {};
  values.settingsQuietHours.timeZone = dto.timeZone === 'Africa/Lagos' ? '(GMT+01:00) Lagos, Nigeria' : null;
  return { page: 'notifications', values, contracts, version: timestamp(dto.version), events: settingsEventRows(dto.eventPreferences), eventVersion: sectionVersion(dto.eventPreferencesVersion), meta: { lastUpdated: dateLabel(dto.updatedAt), updatedBy: '—' } };
}
export const eventFrequencies = { INSTANT: 'Instant', HOURLY: 'Hourly Digest', DAILY: 'Daily Digest', OFF: 'Off' };
function settingsEventRows(raw) {
  if (!Array.isArray(raw) || raw.some(row => !safeKey(row?.key)) || new Set(raw.map(row => row.key)).size !== raw.length) return null;
  return raw.map(row => ({ key: row.key, label: text(row.label), ...Object.fromEntries(['inApp', 'email', 'sms'].map(channel => [channel, typeof row[channel] === 'boolean' ? row[channel] : null])), frequency: Object.hasOwn(eventFrequencies, row.frequency) ? row.frequency : null }));
}
export function adaptSecurityAlertEvents(response) {
  const dto = record(unwrapApiResponseData(response));
  return { events: settingsEventRows(dto.events), eventVersion: sectionVersion(dto.version),
    editable: Array.isArray(dto.editableBy) && dto.editableBy.includes('SUPER_ADMIN'), enforced: dto.enforced === true };
}
export function settingsEventForTemplate(rows, key, label) {
  const matches = rows?.filter(row => row.key === key || labelKey(row.label) === labelKey(label)) || [];
  return matches.length === 1 ? matches[0] : null;
}
export function settingsEventChanges(rows, changes, security = false) {
  if (!Array.isArray(changes) || changes.length === 0 || new Set(changes.map(row => row?.key)).size !== changes.length) throw new Error('Choose valid event preference changes.');
  return changes.map(change => {
    if (!rows?.some(row => row.key === change.key)) throw new Error('This event has no matching backend setting.');
    const fields = record(change.changes), keys = Object.keys(fields);
    if (!keys.length || keys.some(key => !(security ? ['inApp', 'email', 'sms'] : ['email', 'sms', 'frequency']).includes(key))) throw new Error('This event control is fixed or unsupported.');
    for (const key of keys) if (key === 'frequency' ? !Object.hasOwn(eventFrequencies, fields[key]) : typeof fields[key] !== 'boolean') throw new Error('Choose a supported event preference.');
    return { key: change.key, ...fields };
  });
}
export function settingsEventsMatch(rows, submitted) {
  return submitted.every(({ key, ...fields }) => rows?.filter(row => row.key === key).length === 1 && Object.entries(fields).every(([field, value]) => rows.find(row => row.key === key)[field] === value));
}
export function adaptStatus(response, { page } = {}) {
  const dto = record(unwrapApiResponseData(response));
  if (dto.section && dto.section !== page) throw new Error('The status response belongs to a different settings section.');
  return { page, headline: text(dto.headline) || '—', caption: text(dto.caption) || '—', lastChecked: dateLabel(dto.checkedAt), items: Array.isArray(dto.items) ? dto.items.map((item) => ({
    key: text(item?.key), label: text(item?.label), kind: text(item?.kind), group: text(item?.group),
    value: ['string', 'boolean'].includes(typeof item?.value) || typeof item?.value === 'number' && Number.isFinite(item.value) ? item.value : null,
    status: ['ACTIVE', 'FIXED', 'NOT_ENFORCED', 'OPERATIONAL', 'NOT_CONFIGURED'].includes(item?.status) ? item.status : '—',
  })) : [] };
}
// These are the documented processor IDs and purposes. A settings group's
// active/fixed counts cannot stand in for one of the screen's grouped statuses.
const serviceStatusKeys = { Database: 'neon', 'Payment Services': 'embedly', 'SMS Gateway': 'termii', 'Email Service': 'sender' };
export function statusForTemplate(status, template) {
  const items = (template.items || []).map(({ label }) => {
    const serviceKey = status?.page === 'general' ? serviceStatusKeys[label] : null;
    const exact = status?.items?.filter(item => labelKey(item.label) === labelKey(label)) || [];
    const matches = exact.length ? exact : status?.items?.filter(item => serviceKey && item.kind === 'SERVICE' && item.key === serviceKey) || [];
    return { label, status: matches.length === 1 ? matches[0].status : '—' };
  });
  const applicable = items.length === 0 || items.some(item => item.status !== '—');
  // The general endpoint's headline counts settings; it does not report overall
  // service health. Keep that unrelated headline out of the System Status card.
  return { headline: applicable && status?.page !== 'general' ? status?.headline || '—' : '—', caption: applicable ? status?.caption || '—' : '—', lastChecked: applicable ? status?.lastChecked || '—' : '—', items };
}
export function adaptIntegrations(response) {
  const dto = record(unwrapApiResponseData(response)), rows = dto.integrations;
  if (!Array.isArray(rows) || rows.some(row => !text(row?.id)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('The integrations response is missing a valid integrations collection.');
  return rows.map(row => ({ id: row.id, name: text(row.name) || '—', category: text(row.category), purpose: text(row.purpose) || '—',
    status: ['CONNECTED', 'NOT_CONFIGURED'].includes(row.status) ? row.status : null,
    statusLabel: row.status === 'CONNECTED' ? 'Connected' : row.status === 'NOT_CONFIGURED' ? 'Not configured' : '—',
    statusTone: row.status === 'CONNECTED' ? 'success' : 'neutral',
    configured: typeof row.configured === 'boolean' ? row.configured : null,
  }));
}
export function collection(response, key) {
  const dto = record(unwrapApiResponseData(response));
  return { rows: Array.isArray(dto[key]) ? dto[key] : [], pagination: record(dto.pagination) };
}
export function adaptSessions(response, { page = 1, limit = 5 } = {}) {
  const dto = collection(response, 'sessions'), seen = new Set();
  const rows = dto.rows.filter((item) => text(item?.id) && !seen.has(item.id) && seen.add(item.id)).map((item) => ({
    id: item.id, name: text(item.user?.name) || '—', role: text(item.user?.role) || '—', device: text(item.device) || '—',
    client: [text(item.browser), text(item.os)].filter(Boolean).join(' · ') || '—',
    location: text(item.location) || '—', ip: text(item.ipAddress) || '—', lastActive: dateLabel(item.lastActiveAt),
    version: timestamp(item.version), status: ['ACTIVE', 'ENDED', 'EXPIRED'].includes(item.status) ? item.status : null,
  }));
  const total = numeric(dto.pagination.total), count = numeric(dto.pagination.totalPages);
  return { rows, page, total: Number.isSafeInteger(total) && total >= rows.length ? total : null, pageCount: Number.isSafeInteger(count) && count >= 0 ? count : Number.isSafeInteger(total) && total >= rows.length ? Math.ceil(total / limit) : null };
}
export function adaptEvents(response, { page = 1 } = {}) {
  const dto = collection(response, 'events');
  const rows = dto.rows.filter((item) => text(item?.id)).map((item) => ({ id: item.id,
    label: text(item.label) || text(item.title) || text(item.type) || '—', detail: text(item.description) || text(item.detail) || '—',
    time: dateLabel(item.timestamp), location: text(item.location) || '—',
    ip: text(item.ipAddress) || '—', device: text(item.device) || '—', icon: 'shield', tone: 'var(--tk-blue)',
  }));
  const total = numeric(dto.pagination.total), pages = numeric(dto.pagination.totalPages);
  return { rows, page, total: Number.isSafeInteger(total) && total >= 0 ? total : null, pageCount: Number.isSafeInteger(pages) && pages >= 0 ? pages : null };
}
export function adaptProcessors(response) {
  return collection(response, 'processors').rows.filter((item) => text(item?.id)).map((item) => ({ id: item.id, label: text(item.name) || '—', detail: text(item.purpose) || '—', icon: 'server' }));
}
export function adaptVersion(response) {
  const dto = record(unwrapApiResponseData(response));
  return { currentVersion: text(dto.currentVersion) || '—', lastUpdated: dateLabel(dto.lastUpdated), environment: text(dto.environment) || '—', buildNumber: text(dto.buildNumber) || '—' };
}
export function adaptChannels(response) {
  const dto = record(unwrapApiResponseData(response));
  return Object.fromEntries(['inApp', 'email', 'sms', 'push'].map((key) => {
    const matches = Array.isArray(dto.channels) ? dto.channels.filter((item) => item?.channel === key) : [];
    const channel = matches.length === 1 ? record(matches[0]) : {};
    return [key, { detail: [text(channel.provider), text(channel.sender), text(channel.recipient)].filter(Boolean).join(' · ') || '—', status: ['ACTIVE', 'CONFIGURED', 'NOT_CONFIGURED'].includes(channel.status) ? channel.status : '—' }];
  }));
}
