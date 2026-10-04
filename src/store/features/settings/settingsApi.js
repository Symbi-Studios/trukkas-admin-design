import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const boolean = (value) => typeof value === 'boolean' ? value : null;
const number = (value) => (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()))) && Number.isFinite(Number(value)) ? Number(value) : null;
const failure = (message, status = 'CUSTOM_ERROR') => ({ error: { status, error: message, data: { message } } });
const currencies = { NGN: 'Nigerian Naira (NGN)', USD: 'US Dollar (USD)' };
const languages = { en: 'English (EN)', fr: 'French (FR)', pt: 'Portuguese (PT)' };
const reverse = (values, value) => Object.keys(values).find((key) => values[key] === value);

// Only exact semantic matches to the existing controls belong here. A job
// fee is not a per-payment fee, and push preferences do not control in-app alerts.
export const settingsFields = [
  { group: 'settingsPlatformInfo', field: 'defaultLanguage', key: 'platformLanguage', path: ['platform', 'platformLanguage'], options: languages },
  { group: 'settingsOperationalGeneral', field: 'defaultCurrency', key: 'defaultCurrency', path: ['platform', 'defaultCurrency'], options: currencies },
  { group: 'settingsFinancialPolicies', field: 'defaultCurrency', key: 'defaultCurrency', path: ['platform', 'defaultCurrency'], options: currencies },
  { group: 'settingsPlatformFees', field: 'commissionRate', key: 'commissionPercent', path: ['pricing', 'commissionPercent'], min: 0, max: 100 },
  { group: 'settingsPlatformFees', field: 'vatRate', key: 'vatPercent', path: ['pricing', 'vatPercent'], min: 0, max: 100 },
  // These writes are documented, but their GET response paths are not. Keep
  // the initial values unknown rather than guessing a response namespace.
  { group: 'settingsOperationalGeneral', field: 'autoAssignJobs', key: 'autoAssignJobs', boolean: true },
  { group: 'settingsOperationalGeneral', field: 'allowPartialBids', key: 'allowPartialBids', boolean: true },
  { group: 'settingsOperationalGeneral', field: 'autoCompleteTrips', key: 'autoCompleteTripsOnPod', boolean: true },
  { group: 'settingsOperationalGeneral', field: 'enableGeofencing', key: 'enableGeofencing', boolean: true },
];
export const preferenceFields = [
  { group: 'settingsNotificationChannels', field: 'email', key: 'emailEnabled', boolean: true },
  { group: 'settingsNotificationChannels', field: 'sms', key: 'smsEnabled', boolean: true },
  { group: 'settingsQuietHours', field: 'enabled', key: 'quietHoursEnabled', boolean: true },
  { group: 'settingsQuietHours', field: 'from', key: 'quietHoursStart', time: true },
  { group: 'settingsQuietHours', field: 'to', key: 'quietHoursEnd', time: true },
];
export const findSettingsField = (page, group, field) => (page === 'notifications' ? preferenceFields : settingsFields).find((item) => item.group === group && item.field === field);

function time24(value) {
  const input = text(value);
  if (!input) return null;
  const plain = /^(\d{1,2}):(\d{2})$/.exec(input);
  if (plain && Number(plain[1]) < 24 && Number(plain[2]) < 60) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
  const clock = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(input);
  if (!clock || Number(clock[1]) < 1 || Number(clock[1]) > 12 || Number(clock[2]) > 59) return null;
  const hour = Number(clock[1]) % 12 + (clock[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${clock[2]}`;
}
function timeLabel(value) {
  // GET specifies 24h HH:mm. Do not accept an undocumented display format.
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':');
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'PM' : 'AM'}`;
}
function decode(field, value) {
  if (field.options) return field.options[text(value)] || null;
  if (field.boolean) return boolean(value);
  if (field.time) return timeLabel(value);
  const parsed = number(value);
  return parsed != null && parsed >= field.min && parsed <= field.max ? parsed : null;
}
function encode(field, value) {
  if (field.options) { const code = reverse(field.options, value); if (code) return code; }
  else if (field.boolean) { if (typeof value === 'boolean') return value; }
  else if (field.time) { const clock = time24(value); if (clock) return clock; }
  else { const parsed = number(value); if (parsed != null && parsed >= field.min && parsed <= field.max) return parsed; }
  throw new Error(`Enter a valid value for ${field.field}.`);
}
function adaptConfig(response) {
  const dto = record(unwrapApiResponseData(response));
  if (!dto.config || typeof dto.config !== 'object' || Array.isArray(dto.config)) throw new Error('The settings API did not return its config object.');
  const values = {};
  for (const field of settingsFields) {
    const raw = field.path ? field.path.reduce((value, key) => value?.[key], dto.config) : null;
    values[field.group] ||= {}; values[field.group][field.field] = decode(field, raw);
  }
  return { values, meta: { lastUpdated: '—', updatedBy: '—' } };
}
function adaptPreferences(response) {
  const dto = record(unwrapApiResponseData(response)), values = {};
  for (const field of preferenceFields) { values[field.group] ||= {}; values[field.group][field.field] = decode(field, dto[field.key]); }
  return { values };
}
const configTags = ['AdminPricingConfig', 'AdminAuditLogs'];
export const settingsApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminSystemSettings: builder.query({
      async queryFn(_args, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/admin/config' });
        if (result.error) return result;
        try { return { data: adaptConfig(result.data) }; }
        catch (error) { return failure(error.message); }
      }, providesTags: ['AdminPricingConfig'],
    }),
    getAdminSettingsPreferences: builder.query({ query: () => '/admin/notifications/settings', transformResponse: adaptPreferences, providesTags: ['AdminNotificationSettings'] }),
    saveAdminSettingsSection: builder.mutation({
      async queryFn({ page, changes }, api, _options, baseQuery) {
        const actor = api.getState().auth.admin, role = actor?.role, personal = page === 'notifications';
        if (personal ? !['SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN'].includes(role) : role !== 'SUPER_ADMIN') return failure(personal ? 'Admin access is required.' : 'Only Super Admins can change platform configuration.', 403);
        if (!Array.isArray(changes) || !changes.length) return failure('There are no supported settings to save.');
        const body = {}, submitted = [];
        try {
          for (const change of changes) {
            const field = findSettingsField(page, change.group, change.field);
            if (!field) return failure('This setting has no documented save contract.');
            const value = encode(field, change.value);
            if (Object.hasOwn(body, field.key) && body[field.key] !== value) return failure('Conflicting values were entered for the same setting.');
            body[field.key] = value; submitted.push(field);
          }
        } catch (error) { return failure(error.message); }
        const url = personal ? '/admin/notifications/settings' : '/admin/config';
        const result = await baseQuery({ url, method: personal ? 'PATCH' : 'POST', body });
        if (result.error) return result;
        const dto = record(unwrapApiResponseData(result.data)), confirmed = personal ? dto : record(dto.updates);
        const matches = (saved) => submitted.every((field) => saved[field.key] === body[field.key]);
        if (!matches(confirmed)) {
          const read = await baseQuery({ url });
          if (read.error) return failure('The save was sent, but the saved values could not be confirmed. Reload before trying again.');
          const reread = record(unwrapApiResponseData(read.data));
          const values = personal ? reread : Object.fromEntries(submitted.map((field) => [field.key, field.path ? field.path.reduce((value, key) => value?.[key], reread.config) : undefined]));
          if (!matches(values)) return failure('The save was sent, but the saved values could not be confirmed. Reload before trying again.');
        }
        // Patch the form's read cache only after acknowledgment or read-back.
        // This prevents a Saved indicator appearing beside the previous value.
        api.dispatch(settingsApi.util.updateQueryData(personal ? 'getAdminSettingsPreferences' : 'getAdminSystemSettings', personal ? actor.id : undefined, (cached) => {
          for (const field of personal ? preferenceFields : settingsFields) {
            if (!Object.hasOwn(body, field.key)) continue;
            cached.values[field.group] ||= {};
            cached.values[field.group][field.field] = decode(field, body[field.key]);
          }
        }));
        return { data: { message: text(dto.message) || 'Settings saved.' } };
      }, invalidatesTags: (_result, _error, args) => args.page === 'notifications' ? ['AdminNotificationSettings'] : configTags,
    }),
  }),
});
export const { useGetAdminSystemSettingsQuery, useGetAdminSettingsPreferencesQuery, useSaveAdminSettingsSectionMutation } = settingsApi;
