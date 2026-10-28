import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { clearSession } from '../auth/authSlice.js';
import { adaptSettingsSaveFeedback, securityEventKeys, adaptSystemLogs } from './settingsContracts.js';
import { adaptSection, relatedSettingsSections, adaptPreferences, adaptSecurityAlertEvents, settingsEventChanges, settingsEventsMatch, adaptStatus, adaptIntegrations, adaptSessions, adaptEvents, adaptProcessors, adaptVersion, adaptChannels, canEditSettings, findSettingsField, preferenceFields, encodeSetting, encodePreference, record, text, timestamp, sectionVersion } from './settingsContracts.js';
export { findSettingsField, preferenceFields } from './settingsContracts.js';
const failure = (message, status = 'CUSTOM_ERROR') => ({ error: { status, error: message, data: { message } } });
const sections = ['general', 'operations', 'finance', 'fleet', 'security', 'passwords', 'security-alerts', 'data-protection'];
// Defaults explicitly documented by GET admin/notifications/settings.
const notificationDefaults = { emailEnabled: true, pushEnabled: true, smsEnabled: false, quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00' };
function editableDefaults(dto) {
  if (!Array.isArray(dto.fields)) throw new Error('The backend did not return the fields needed to confirm reset defaults.');
  const fields = dto.fields.filter((field) => field?.editable === true);
  if (fields.some((field) => typeof field.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key) || ['constructor', 'prototype', '__proto__'].includes(field.key) || !Object.hasOwn(field, 'default') || !(field.default === null || ['string', 'boolean'].includes(typeof field.default) || (typeof field.default === 'number' && Number.isFinite(field.default))))) throw new Error('The backend did not return complete editable defaults.');
  if (new Set(fields.map((field) => field.key)).size !== fields.length) throw new Error('The backend returned ambiguous editable defaults.');
  return Object.fromEntries(fields.map((field) => [field.key, field.default]));
}
const valuesMatch = (values, expected) => Object.entries(expected).every(([field, value]) => Object.hasOwn(record(values), field) && values[field] === value);
function settingsError(result) {
  const dto = record(result.error?.data), errors = Array.isArray(dto.errors) ? dto.errors.map(text).filter(Boolean) : [];
  if (!errors.length) return result;
  return { error: { ...result.error, data: { ...dto, message: [text(dto.message), ...errors].filter(Boolean).join(' ') } } };
}
function sessionGuard(api, owner) {
  const actor = api.getState().auth.admin;
  if (!actor?.id || actor.id !== owner || !api.getState().auth.accessToken) throw new Error('Please sign in again before using Settings.');
  return () => {
    if (api.signal.aborted || api.getState().auth.admin !== actor || !api.getState().auth.accessToken) throw new Error('The admin session changed. Reload before continuing.');
  };
}
function key() {
  if (!globalThis.crypto?.randomUUID) throw new Error('An idempotency key could not be created.');
  return globalThis.crypto.randomUUID();
}
const readQuery = (url, adapter) => async (args, api, _options, baseQuery) => {
  try {
    const check = sessionGuard(api, args.owner);
    const result = await baseQuery(typeof url === 'function' ? url(args) : url);
    check(); if (result.error) return result;
    return { data: adapter(result.data, args) };
  } catch (error) { return failure(error.message); }
};
async function readSettingsPage(page, baseQuery, check, primaryResponse) {
  const pages = [page, ...(relatedSettingsSections[page] || [])];
  const results = await Promise.all(pages.map((section, index) => index === 0 && primaryResponse !== undefined ? Promise.resolve({ data: primaryResponse }) : baseQuery({ url: '/admin/settings/' + encodeURIComponent(section) })));
  check();
  const failed = results.find((result) => result.error);
  if (failed) return failed;
  return { data: adaptSection(results[0].data, page, Object.fromEntries(pages.slice(1).map((section, index) => [section, results[index + 1].data]))) };
}
const settingsTags = ['AdminSettings', 'AdminSettingsStatus', 'AdminSettingsSecurityEvents', 'AdminAuditLogs', 'AdminPricingConfig', 'AdminPricing', 'AdminFeeRules', 'AdminFeeHistory', 'AdminFeeSummary', 'AdminFeeRevenue'];
export const settingsApi = baseApi.enhanceEndpoints({ addTagTypes: [...settingsTags, 'AdminSettingsSessions', 'AdminSettingsEvents', 'AdminSettingsChannels'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminSystemSettings: builder.query({
      async queryFn({ page, owner }, api, _options, baseQuery) {
        try { return await readSettingsPage(page, baseQuery, sessionGuard(api, owner)); }
        catch (error) { return failure(error.message); }
      },
      providesTags: ['AdminSettings'],
    }),
    getAdminSettingsPreferences: builder.query({ queryFn: readQuery('/admin/notifications/settings', adaptPreferences), providesTags: ['AdminNotificationSettings'] }),
    getAdminSettingsSecurityEvents: builder.query({ queryFn: readQuery('/admin/settings/security-alerts/events', adaptSecurityAlertEvents), providesTags: ['AdminSettingsSecurityEvents'] }),
    getAdminSettingsStatus: builder.query({ queryFn: readQuery(({ page }) => ({ url: '/admin/settings/status', params: { section: page } }), adaptStatus), providesTags: ['AdminSettingsStatus'] }),
    getAdminSettingsVersion: builder.query({ queryFn: readQuery('/admin/platform/version', adaptVersion) }),
    getAdminSettingsChannels: builder.query({ queryFn: readQuery('/admin/settings/notifications/channels', adaptChannels), providesTags: ['AdminSettingsChannels'] }),
    getAdminSettingsIntegrations: builder.query({ queryFn: readQuery('/admin/settings/integrations', adaptIntegrations) }),
    getAdminSettingsProcessors: builder.query({ queryFn: readQuery('/admin/data-protection/processors', adaptProcessors) }),
    getAdminSettingsSessions: builder.query({
      queryFn: readQuery(({ page = 1, limit = 5 }) => ({ url: '/admin/sessions', params: { page, limit, status: 'active' } }), adaptSessions), providesTags: ['AdminSettingsSessions'],
    }),
    getAdminSettingsEvents: builder.query({
      queryFn: readQuery(({ page = 1, limit = 5, type }) => ({ url: '/admin/security/events', params: { page, limit, scope: 'me', ...(type ? { type } : {}) } }), adaptEvents), providesTags: ['AdminSettingsEvents'],
    }),
    getAdminSettingsSystemLogs: builder.query({
      queryFn: readQuery(({ page = 1, limit = 20 }) => ({ url: '/admin/system/logs', params: { page, limit } }), adaptSystemLogs),
    }),
    saveAdminSettingsSection: builder.mutation({
      async queryFn({ page, changes, eventChanges = [], owner, expectedVersion, expectedVersions, expectedEventVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), role = api.getState().auth.admin.role, personal = page === 'notifications';
          if (!canEditSettings(page, role)) return failure('Your admin access level cannot change this settings section.', 403);
          if (!Array.isArray(changes) || !Array.isArray(eventChanges) || !changes.length && !eventChanges.length) return failure('There are no supported settings to save.');
          if (eventChanges.length && !personal) return failure('Use the security-alert event operation for these preferences.');
          const url = personal ? '/admin/notifications/settings' : '/admin/settings/' + encodeURIComponent(page);
          const read = personal ? await baseQuery({ url }) : await readSettingsPage(page, baseQuery, check);
          check(); if (read.error) return read;
          const before = personal ? adaptPreferences(read.data) : read.data;
          const plans = new Map(), submitted = [];
          for (const change of changes) {
            const control = findSettingsField(page, change.group, change.field), contract = before.contracts[change.group + '.' + change.field];
            if (!control || !contract?.editable) return failure('This setting is fixed or unsupported by the backend.');
            const section = personal ? page : contract.section;
            if (!canEditSettings(section, role)) return failure('Your admin access level cannot change this settings section.', 403);
            const value = personal ? encodePreference(contract, change.value) : encodeSetting(control, contract, change.value);
            if (!plans.has(section)) plans.set(section, { section, body: {}, version: personal ? null : record(expectedVersions)[section] ?? (section === page ? expectedVersion : null) });
            const plan = plans.get(section);
            if (Object.hasOwn(plan.body, contract.key) && plan.body[contract.key] !== value) return failure('Conflicting values were entered for the same setting.');
            plan.body[contract.key] = value; submitted.push({ control, contract, value });
          }
          const submittedEvents = eventChanges.length ? settingsEventChanges(before.events, eventChanges) : [];
          if (submittedEvents.length) {
            if (!sectionVersion(expectedEventVersion) || before.eventVersion !== expectedEventVersion) return failure('Event preferences changed. Reload before saving.', 409);
            if (!plans.has(page)) plans.set(page, { section: page, body: {} });
            Object.assign(plans.get(page).body, { eventPreferences: submittedEvents, expectedEventPreferencesVersion: expectedEventVersion });
          }
          // Validate every section version before sending the first write. The
          // backend checks each section atomically; separate sections can still
          // save independently, so report partial results without replaying them.
          for (const plan of plans.values()) {
            if (!personal && (!sectionVersion(plan.version) || before.versions[plan.section] !== plan.version)) return failure('These settings changed or their version is unavailable. Reload before saving.', 409);
          }
          let savedSections = 0;
          const feedback = [];
          for (const plan of plans.values()) {
            check();
            const body = personal ? plan.body : { ...plan.body, expectedVersion: plan.version };
            const result = await baseQuery({ url: personal ? url : '/admin/settings/' + encodeURIComponent(plan.section), method: 'PATCH', body });
            check();
            if (result.error) return savedSections ? failure('Some settings were saved, but another section failed. Reload before continuing.') : settingsError(result);
            savedSections += 1;
            feedback.push(adaptSettingsSaveFeedback(result.data, submittedEvents.length > 0 || submitted.some(({ contract }) => (personal || contract.section === plan.section) && !contract.enforced)));
            if (!personal) {
              const saved = record(unwrapApiResponseData(result.data));
              const changedKeys = submitted.filter(({ control, contract, value }) => {
                if (contract.section !== plan.section) return false;
                try { return encodeSetting(control, contract, before.values[control.group]?.[control.field]) !== value; } catch { return true; }
              }).map(({ contract }) => contract.key);
              if (saved.section !== plan.section || !sectionVersion(saved.version) || changedKeys.length > 0 && (!timestamp(saved.version) || saved.version === plan.version) || !valuesMatch(saved.values, plan.body) || !Array.isArray(saved.changedFields) || !changedKeys.every((field) => saved.changedFields.includes(field))) return failure('The save was sent, but the saved section could not be confirmed. Reload before trying again.');
              plan.savedVersion = saved.version;
            }
          }
          // Read back once; a successful HTTP response alone does not confirm
          // that the displayed values match every submitted field.
          const afterRead = personal ? await baseQuery({ url }) : await readSettingsPage(page, baseQuery, check);
          check();
          if (afterRead.error) return failure('The save was sent, but its result could not be confirmed. Reload before trying again.');
          const after = personal ? adaptPreferences(afterRead.data) : afterRead.data;
          const matches = submitted.every(({ control, contract, value }) => {
            const savedContract = after.contracts[control.group + '.' + control.field];
            if (!savedContract || savedContract.key !== contract.key || !personal && savedContract.section !== contract.section) return false;
            try { return (personal ? encodePreference(savedContract, after.values[control.group]?.[control.field]) : encodeSetting(control, savedContract, after.values[control.group]?.[control.field])) === value; } catch { return false; }
          });
          if (!matches || !personal && [...plans.values()].some((plan) => after.versions[plan.section] !== plan.savedVersion) || submittedEvents.length && (!after.eventVersion || after.eventVersion === expectedEventVersion || !settingsEventsMatch(after.events, submittedEvents))) return failure('The save was sent, but the saved values could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData(personal ? 'getAdminSettingsPreferences' : 'getAdminSystemSettings', personal ? { owner } : { page, owner }, () => after));
          return { data: { section: after, savedOnly: feedback.some(item => item.savedOnly),
            savedOnlyFields: [...new Set(feedback.flatMap(item => item.savedOnlyFields))],
            warning: [...new Set(feedback.map(item => item.warning).filter(Boolean))].join('\n') || null } };
        } catch (error) { return failure(error.message); }
      },
      invalidatesTags: (_result, _error, args) => args.page === 'notifications' ? ['AdminNotificationSettings', 'AdminSettingsEvents'] : settingsTags,
    }),
    saveAdminSettingsSecurityEvents: builder.mutation({
      async queryFn({ owner, changes, expectedVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), url = '/admin/settings/security-alerts/events';
          if (api.getState().auth.admin.role !== 'SUPER_ADMIN') return failure('Only Super Admins can change security-alert event preferences.', 403);
          const read = await baseQuery({ url }); check(); if (read.error) return read;
          const before = adaptSecurityAlertEvents(read.data);
          if (!before.editable || !sectionVersion(expectedVersion) || before.eventVersion !== expectedVersion) return failure('Security-alert preferences changed or cannot be edited. Reload before saving.', 409);
          const events = settingsEventChanges(before.events, changes, true);
          const result = await baseQuery({ url, method: 'PATCH', body: { events, expectedVersion } }); check(); if (result.error) return settingsError(result);
          const reread = await baseQuery({ url }); check();
          if (reread.error) return failure('The save was sent, but its result could not be confirmed. Reload before trying again.');
          const after = adaptSecurityAlertEvents(reread.data);
          if (!after.eventVersion || after.eventVersion === expectedVersion || !settingsEventsMatch(after.events, events)) return failure('The saved security-alert values could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData('getAdminSettingsSecurityEvents', { owner }, () => after));
          return { data: adaptSettingsSaveFeedback(result.data, !after.enforced) };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: ['AdminSettingsSecurityEvents', 'AdminSettingsStatus'],
    }),
    resetAdminSettingsSecurityEvents: builder.mutation({
      async queryFn({ owner, expectedVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), url = '/admin/settings/security-alerts/events';
          if (api.getState().auth.admin.role !== 'SUPER_ADMIN') return failure('Only Super Admins can reset security-alert event preferences.', 403);
          const read = await baseQuery({ url }); check(); if (read.error) return read;
          const before = adaptSecurityAlertEvents(read.data);
          if (!before.editable || !sectionVersion(expectedVersion) || before.eventVersion !== expectedVersion) return failure('Security-alert preferences changed or cannot be edited. Reload before resetting.', 409);
          const complete = model => model.events?.length === securityEventKeys.length && securityEventKeys.every(key => model.events.some(event => event.key === key));
          if (!complete(before)) return failure('The backend did not return all security-alert events. Reload before resetting.');
          const result = await baseQuery({ url: url + '/reset', method: 'POST', body: { expectedVersion } }); check(); if (result.error) return settingsError(result);
          const saved = adaptSecurityAlertEvents(result.data), dto = record(unwrapApiResponseData(result.data));
          const defaultsMatch = model => complete(model) && model.events.every(event => ['inApp', 'email', 'sms'].every(channel => event[channel] === false));
          const reread = await baseQuery({ url }); check();
          if (reread.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
          const after = adaptSecurityAlertEvents(reread.data);
          if (dto.reset !== true || !sectionVersion(saved.eventVersion) || !defaultsMatch(saved) || after.eventVersion !== saved.eventVersion || !defaultsMatch(after)) return failure('The reset was sent, but the saved defaults could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData('getAdminSettingsSecurityEvents', { owner }, () => after));
          return { data: adaptSettingsSaveFeedback(result.data, !after.enforced) };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: ['AdminSettingsSecurityEvents', 'AdminSettingsStatus', 'AdminSettingsEvents', 'AdminAuditLogs'],
    }),
    resetAdminSettingsSection: builder.mutation({
      async queryFn({ page, owner, expectedVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), personal = page === 'notifications';
          if (!personal && api.getState().auth.admin.role !== 'SUPER_ADMIN') return failure('Only Super Admins can reset platform settings.', 403);
          if (!personal && !sections.includes(page)) return failure('This settings section has no documented reset operation.');
          const readUrl = personal ? '/admin/notifications/settings' : '/admin/settings/' + page;
          const preflight = await baseQuery({ url: readUrl }); check(); if (preflight.error) return preflight;
          const before = personal ? adaptPreferences(preflight.data) : adaptSection(preflight.data, page);
          if (!(personal ? timestamp(expectedVersion) : sectionVersion(expectedVersion)) || before.version !== expectedVersion) return failure('The reset requires a confirmed current section version. Reload before continuing.', 409);
          const rawBefore = record(unwrapApiResponseData(preflight.data));
          const defaults = personal ? notificationDefaults : editableDefaults(rawBefore);
          if (!Object.keys(defaults).length) return failure('This section has no confirmed editable defaults to reset.');
          const result = await baseQuery({ url: '/admin/settings/' + page + '/reset', method: 'POST', body: { expectedVersion, idempotencyKey: key() } }); check(); if (result.error) return result;
          const saved = record(unwrapApiResponseData(result.data));
          const responseConfirmed = personal ? saved.scope === 'PERSONAL' && saved.adminId === owner && timestamp(saved.version) && valuesMatch(saved, defaults) : saved.section === page && sectionVersion(saved.version) && valuesMatch(saved.values, defaults) && Array.isArray(saved.changedFields);
          const reread = await baseQuery({ url: readUrl }); check();
          if (reread.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
          const pageRead = personal ? { data: adaptPreferences(reread.data) } : await readSettingsPage(page, baseQuery, check, reread.data);
          if (pageRead.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
          const after = pageRead.data;
          const rawAfter = record(unwrapApiResponseData(reread.data));
          const confirmed = valuesMatch(personal ? rawAfter : rawAfter.values, defaults);
          if (!responseConfirmed || !after.version || !confirmed) return failure('The reset was sent, but the defaults could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData(personal ? 'getAdminSettingsPreferences' : 'getAdminSystemSettings', personal ? { owner } : { page, owner }, () => after));
          return { data: { section: after } };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: [...settingsTags, 'AdminNotificationSettings', 'AdminSettingsEvents'],
    }),
    resetAllAdminSettings: builder.mutation({
      async queryFn({ owner }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner);
          if (api.getState().auth.admin.role !== 'SUPER_ADMIN') return failure('Only Super Admins can reset platform settings.', 403);
          const expectedVersions = {}, defaults = {};
          // Read every section first: no reset is sent with missing defaults or
          // versions, and the backend checks all versions atomically.
          for (const page of sections) {
            const read = await baseQuery({ url: '/admin/settings/' + page }); check(); if (read.error) return read;
            const dto = record(unwrapApiResponseData(read.data)), fields = editableDefaults(dto);
            if (!Object.keys(fields).length) continue;
            const version = sectionVersion(dto.version);
            if (!version) return failure('A settings section has no confirmed version. Reload before resetting.');
            expectedVersions[page] = version; defaults[page] = fields;
          }
          const pages = Object.keys(expectedVersions);
          if (!pages.length) return failure('There are no confirmed editable settings to reset.');
          check();
          const result = await baseQuery({ url: '/admin/settings/reset', method: 'POST', body: { expectedVersions, idempotencyKey: key() } }); check(); if (result.error) return settingsError(result);
          const dto = record(unwrapApiResponseData(result.data));
          const resetSections = Array.isArray(dto.resetSections) ? dto.resetSections : [];
          if (!timestamp(dto.resetAt) || resetSections.length !== pages.length || new Set(resetSections).size !== pages.length || !pages.every((page) => resetSections.includes(page)) || !Array.isArray(dto.sections)) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
          for (const page of pages) {
            const matches = dto.sections.filter((section) => section?.section === page);
            const saved = matches.length === 1 ? matches[0] : {};
            if (!sectionVersion(saved.version) || !Array.isArray(saved.changedFields) || !valuesMatch(saved.values, defaults[page]) || !valuesMatch(saved.defaults, defaults[page])) return failure('The reset was sent, but the defaults could not be confirmed. Reload before trying again.');
            const reread = await baseQuery({ url: '/admin/settings/' + page }); check();
            if (reread.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
            const pageRead = await readSettingsPage(page, baseQuery, check, reread.data);
            if (pageRead.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
            const raw = record(unwrapApiResponseData(reread.data)), after = pageRead.data;
            if (!after.version || !valuesMatch(raw.values, defaults[page])) return failure('The reset was sent, but the defaults could not be confirmed. Reload before trying again.');
            api.dispatch(settingsApi.util.updateQueryData('getAdminSystemSettings', { page, owner }, () => after));
          }
          return { data: { resetSections } };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: [...settingsTags, 'AdminSettingsEvents'],
    }),
    testAdminSettingsNotification: builder.mutation({
      async queryFn({ owner }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), email = text(api.getState().auth.admin.email);
          if (!email) return failure('Your current admin email is unavailable.');
          const result = await baseQuery({ url: '/admin/settings/notifications/test', method: 'POST', body: { channels: ['email'], idempotencyKey: key() } }); check(); if (result.error) return result;
          const dto = record(unwrapApiResponseData(result.data));
          const delivered = Array.isArray(dto.results) && dto.results.length === 1 && dto.results[0].channel === 'email' && dto.results[0].outcome === 'SENT' && text(dto.results[0].recipient)?.toLowerCase() === email.toLowerCase();
          if (!delivered || !timestamp(dto.sentAt)) return failure('The backend did not confirm a test email sent to your admin email.');
          return { data: { sentAt: dto.sentAt, recipient: dto.results[0].recipient } };
        } catch (error) { return failure(error.message); }
      },
    }),
    terminateAdminSettingsSession: builder.mutation({
      async queryFn({ owner, id, all, reason, expectedVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner);
          if (all && api.getState().auth.admin.role !== 'SUPER_ADMIN') return failure('Only Super Admins can terminate all app-user sessions.', 403);
          if (!text(reason) || (!all && !text(id))) return failure('A reason and a real session ID are required.');
          const result = await baseQuery({ url: all ? '/admin/sessions/terminate-all' : '/admin/sessions/' + encodeURIComponent(id) + '/terminate', method: 'POST', body: { reason: reason.trim(), idempotencyKey: key(), ...(!all && timestamp(expectedVersion) ? { expectedVersion } : {}) } });
          check(); if (result.error) return result;
          const dto = record(unwrapApiResponseData(result.data));
          if (all ? !(Number.isSafeInteger(dto.affected) && dto.affected >= 0 && dto.usersSignedOut === dto.affected && Array.isArray(dto.failures) && dto.failures.length === 0 && timestamp(dto.completedAt)) : !(dto.id === id && dto.status === 'ENDED' && timestamp(dto.terminatedAt))) return failure('The request was sent, but session termination was not fully confirmed. Reload before trying again.');
          return { data: { affected: all ? dto.affected : 1 } };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: ['AdminSettingsSessions', 'AdminSettingsEvents'],
    }),
    changeAdminSettingsPassword: builder.mutation({
      async queryFn({ owner, currentPassword, newPassword }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner);
          if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || newPassword.length < 8 || currentPassword === newPassword) return failure('Enter your current password and a different new password of at least 8 characters.');
          const result = await baseQuery({ url: '/admin/auth/password', method: 'PATCH', body: { currentPassword, newPassword } }); check(); if (result.error) return result;
          const dto = record(unwrapApiResponseData(result.data));
          const confirmed = timestamp(dto.changedAt) && dto.sessionsRevoked === true && dto.reloginRequired === true;
          // A successful password change revokes this session. Clear it even if
          // the response is incomplete; do not continue using revoked tokens.
          api.dispatch(clearSession()); api.dispatch(baseApi.util.resetApiState());
          if (!confirmed) return failure('The password request completed, but confirmation was incomplete. Sign in again before continuing.');
          return { data: { reloginRequired: true } };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: ['AdminSettingsEvents'],
    }),
  }),
});
export const { useGetAdminSystemSettingsQuery, useGetAdminSettingsPreferencesQuery, useGetAdminSettingsSecurityEventsQuery, useSaveAdminSettingsSecurityEventsMutation, useResetAdminSettingsSecurityEventsMutation, useGetAdminSettingsStatusQuery, useGetAdminSettingsVersionQuery, useGetAdminSettingsChannelsQuery, useGetAdminSettingsIntegrationsQuery, useGetAdminSettingsProcessorsQuery, useGetAdminSettingsSessionsQuery, useGetAdminSettingsEventsQuery, useGetAdminSettingsSystemLogsQuery, useSaveAdminSettingsSectionMutation, useResetAdminSettingsSectionMutation, useResetAllAdminSettingsMutation, useTestAdminSettingsNotificationMutation, useTerminateAdminSettingsSessionMutation, useChangeAdminSettingsPasswordMutation } = settingsApi;
