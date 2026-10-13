import { unwrapApiResponseData } from '../../api/baseApi.js';
export const ROOT = '/admin/support/broadcasts';
export const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
export const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export const count = (value) => (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value.trim())) && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export const ANNOUNCEMENT_STATUSES = { Published: 'PUBLISHED', Scheduled: 'SCHEDULED', Draft: 'DRAFT', Expired: 'EXPIRED' };
const labels = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', PUBLISHED: 'Published', EXPIRED: 'Expired', UNPUBLISHED: 'Expired', ARCHIVED: 'Expired' };
export const types = { System: 'SYSTEM', Feature: 'FEATURE', Update: 'UPDATE', Notice: 'NOTICE', Reminder: 'REMINDER', Campaign: 'CAMPAIGN' };
export const priorities = { Low: 'LOW', Normal: 'NORMAL', High: 'HIGH', Urgent: 'URGENT' };
export const audiences = { 'All Users': 'ALL', 'User Roles': 'ROLES', 'Users with Access': 'ACCESS', 'Custom Users': 'CUSTOM' };
const audienceNames = Object.fromEntries(Object.entries(audiences).map(([name, key]) => [key, name]));
const audienceKeys = { ALL: null, ROLES: 'roleIds', ACCESS: 'moduleIds', CUSTOM: 'userIds' };
const legacy = { ALL: 'All Users', FORWARDERS: 'Freight Forwarders', TRUCKERS: 'Truck Companies', DRIVERS: 'Drivers', ACTIVE_JOBS: 'Users with Active Jobs' };
const icons = { System: 'megaphone', Feature: 'sparkles', Update: 'info', Notice: 'calendar-days', Reminder: 'clock-3', Campaign: 'send' };
export function timestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.slice(0, 19).split(/[-T:]/).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const at = Date.parse(value); return Number.isFinite(at) ? at : null;
}
export function dateParts(value) {
  const at = timestamp(value);
  if (at == null) return { d: '—', tm: '—', inputDate: '', inputTime: '' };
  const date = new Date(at), local = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(({ type, value }) => [type, value]));
  return { d: date.toLocaleDateString('en-US', { timeZone: 'Africa/Lagos', month: 'short', day: 'numeric', year: 'numeric' }), tm: date.toLocaleTimeString('en-US', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit' }), inputDate: local.year + '-' + local.month + '-' + local.day, inputTime: local.hour + ':' + local.minute };
}
const ids = (value) => Array.isArray(value) && value.every((id) => text(id)) && new Set(value).size === value.length ? value : null;
export function adaptBroadcast(value) {
  const dto = record(value), type = Object.keys(types).find((label) => types[label] === dto.type), priority = Object.keys(priorities).find((label) => priorities[label] === dto.priority);
  const status = Object.hasOwn(labels, dto.status) ? dto.status : null;
  const mode = Object.hasOwn(audienceNames, dto.audienceMode) ? dto.audienceMode : null;
  const target = record(dto.targeting), targeting = Object.fromEntries(['roleIds', 'moduleIds', 'userIds'].map((key) => [key, ids(target[key])]));
  const audience = audienceNames[mode] || legacy[dto.audience] || null;
  const schedule = dateParts(dto.scheduledFor), published = dateParts(dto.publishedAt), expiry = dateParts(dto.expiresAt), display = status === 'SCHEDULED' ? schedule : published;
  const title = typeof dto.title === 'string' ? dto.title : '', message = typeof dto.message === 'string' ? dto.message : '';
  const pinned = typeof dto.pinned === 'boolean' ? dto.pinned : null, acknowledgement = typeof dto.acknowledgement === 'boolean' ? dto.acknowledgement : null;
  const channels = Array.isArray(dto.channels) && dto.channels.every((channel) => typeof channel === 'string') ? dto.channels : null;
  return { id: text(dto.id), t: text(title) ? title : '—', p: text(message) ? message : '—', searchKnown: typeof dto.title === 'string' && typeof dto.message === 'string',
    type: type || '—', typeKnown: Boolean(type), icon: icons[type] || 'megaphone', aud: audience || '—', audienceKnown: Boolean(audience), statusCode: status, st: labels[status] || '—',
    d: display.d, tm: display.tm, v: count(dto.seenCount ?? dto.viewCount), createdAt: timestamp(dto.createdAt), priority: priority || '—', pinned, acknowledgement, channels,
    version: timestamp(dto.version) == null ? null : dto.version,
    form: { title, message, type: type || null, audience: mode ? audienceNames[mode] : null, targeting,
      schedule: status === 'SCHEDULED' ? 'Schedule for Later' : status ? 'Publish Now' : null,
      scheduleDate: schedule.inputDate, scheduleTime: schedule.inputTime, priority: priority || null, pinned, acknowledgement, expiry: expiry.inputDate },
    state: { title, message, type: dto.type, priority: dto.priority, pinned, acknowledgement, audienceMode: mode, targeting, channels,
      scheduledFor: Object.hasOwn(dto, 'scheduledFor') ? dto.scheduledFor : undefined, expiresAt: Object.hasOwn(dto, 'expiresAt') ? dto.expiresAt : undefined },
  };
}
export function unwrapBroadcast(response, expectedId) {
  const dto = record(unwrapApiResponseData(response)), raw = dto.id ? dto : record(dto.broadcast), adapted = adaptBroadcast(raw);
  if (!adapted.id || expectedId && adapted.id !== expectedId) throw new Error('The announcement response could not be matched to its ID.');
  return adapted;
}
function option(value) {
  if (typeof value === 'string' && text(value)) return { id: value, label: value };
  const dto = record(value), id = text(dto.id) || text(dto.value) || text(dto.key), label = text(dto.label) || text(dto.name);
  return id && label ? { id, label } : null;
}
export function adaptOptions(response) {
  const dto = record(unwrapApiResponseData(response));
  return { modes: Array.isArray(dto.audienceModes) ? dto.audienceModes.filter((mode) => Object.hasOwn(audienceNames, mode?.mode)).map((mode) => ({ mode: mode.mode, name: audienceNames[mode.mode], requires: mode.requires, options: Array.isArray(mode.options) ? mode.options.map(option).filter(Boolean) : [] })) : [] };
}
export function adaptStats(response) {
  const dto = record(unwrapApiResponseData(response));
  const cards = Object.fromEntries(['totalAnnouncements', 'publishedCount', 'scheduledCount', 'totalViews'].map((key) => {
    const card = record(dto[key]), percent = typeof card.changePercent === 'number' && Number.isFinite(card.changePercent) ? card.changePercent : null;
    return [key, { value: count(card.value), delta: percent == null ? '—' : (percent > 0 ? '+' : '') + percent.toLocaleString('en-NG', { maximumFractionDigits: 2 }) + '%', direction: ['up', 'down'].includes(text(card.direction)?.toLowerCase()) ? card.direction.toLowerCase() : null }];
  }));
  return { ...cards, countsByType: record(dto.countsByType) };
}
function localISO(date, time = '23:59:59.999') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(time || '')) throw new Error('Choose a valid Lagos date and time.');
  const value = date + 'T' + time + (time.length === 5 ? ':00' : '') + '+01:00';
  if (timestamp(value) == null) throw new Error('Choose a valid calendar date.'); return value;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function prepareForm(form, original, mode, options, creating = false) {
  if (!text(form.title) || form.title.length > 150 || !text(form.message) || form.message.length > 5000) throw new Error('Enter a title and message within their allowed lengths.');
  if (!Object.hasOwn(types, form.type) || !Object.hasOwn(priorities, form.priority) || typeof form.pinned !== 'boolean' || typeof form.acknowledgement !== 'boolean') throw new Error('Choose supported announcement settings.');
  const body = { title: form.title.trim(), message: form.message, type: types[form.type], priority: priorities[form.priority], pinned: form.pinned, acknowledgement: form.acknowledgement };
  const audienceChanged = creating || form.audience !== original?.form.audience || !same(form.targeting, original?.form.targeting);
  if (audienceChanged) {
    const audienceMode = audiences[form.audience];
    if (!audienceMode) throw new Error('Choose a supported audience.');
    body.audienceMode = audienceMode;
    const key = audienceKeys[audienceMode];
    if (key) {
      const selected = ids(form.targeting?.[key]);
      if (!selected?.length) throw new Error('Select real audience IDs before saving.');
      if (audienceMode !== 'CUSTOM') {
        const allowed = options.modes.find((item) => item.mode === audienceMode)?.options;
        if (!allowed?.length || selected.some((id) => !allowed.some((item) => item.id === id))) throw new Error('The backend has not confirmed these audience choices.');
      }
      body[key] = selected;
    }
  }
  const schedulingChanged = creating || form.schedule !== original?.form.schedule || form.scheduleDate !== original?.form.scheduleDate || form.scheduleTime !== original?.form.scheduleTime;
  if (mode === 'Draft') body.saveAsDraft = true;
  else if (form.schedule === 'Schedule for Later' && schedulingChanged) {
    const scheduledFor = localISO(form.scheduleDate, form.scheduleTime);
    if (timestamp(scheduledFor) <= Date.now()) throw new Error('The scheduled date and time must be in the future.');
    body.scheduledFor = scheduledFor;
  } else if (!['Publish Now', 'Schedule for Later'].includes(form.schedule)) throw new Error('Choose when to publish the announcement.');
  if (creating) { if (form.expiry) body.expiresAt = localISO(form.expiry); }
  else if (form.expiry !== original?.form.expiry) {
    if (!form.expiry) throw new Error('Clearing expiry is not documented by the backend. Choose an expiry date instead.');
    body.expiresAt = localISO(form.expiry);
  }
  const expiry = Object.hasOwn(body, 'expiresAt') ? body.expiresAt : original?.state.expiresAt;
  const publishAt = mode === 'Draft' ? Date.now() : body.scheduledFor ? timestamp(body.scheduledFor) : form.schedule === 'Schedule for Later' ? timestamp(original?.state.scheduledFor) : Date.now();
  if (expiry && timestamp(expiry) <= publishAt) throw new Error('Expiry must be after the planned publication time.');
  if (!creating) {
    for (const key of ['title', 'message', 'type', 'priority', 'pinned', 'acknowledgement']) if (same(body[key], original.state[key])) delete body[key];
    if (mode === 'Draft' && original.statusCode === 'DRAFT') delete body.saveAsDraft;
    if (original.statusCode === 'PUBLISHED' && (body.saveAsDraft || body.audienceMode || body.scheduledFor)) throw new Error('Published announcements cannot change audience, channels or scheduling, or become drafts. Duplicate instead.');
    if (original.statusCode === 'SCHEDULED' && mode !== 'Draft' && form.schedule === 'Publish Now') body.scheduledFor = null;
  }
  return body;
}
export function matchesFields(saved, fields) {
  const state = saved.state;
  return Object.entries(fields).every(([key, value]) => key === 'expectedVersion' || key === 'saveAsDraft' ? true : ['scheduledFor', 'expiresAt'].includes(key) ? value === null ? state[key] === null : timestamp(value) != null && timestamp(state[key]) === timestamp(value) : ['roleIds', 'moduleIds', 'userIds'].includes(key) ? Array.isArray(state.targeting[key]) && state.targeting[key].length === value.length && value.every((id) => state.targeting[key].includes(id)) : same(state[key], value));
}
