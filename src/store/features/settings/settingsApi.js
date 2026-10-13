import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { clearSession } from '../auth/authSlice.js';
import { adaptSection, adaptPreferences, adaptStatus, adaptSessions, adaptEvents, adaptProcessors, adaptVersion, adaptChannels, canEditSettings, findSettingsField, preferenceFields, encodeSetting, encodePreference, record, text, timestamp } from './settingsContracts.js';
export { findSettingsField, preferenceFields } from './settingsContracts.js';
const failure = (message, status = 'CUSTOM_ERROR') => ({ error: { status, error: message, data: { message } } });
const sections = ['general', 'operations', 'finance', 'fleet', 'security', 'passwords', 'security-alerts', 'data-protection'];
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
const settingsTags = ['AdminSettings', 'AdminSettingsStatus', 'AdminAuditLogs', 'AdminPricingConfig', 'AdminFeeRules', 'AdminFeeHistory', 'AdminFeeSummary', 'AdminFeeRevenue'];
export const settingsApi = baseApi.enhanceEndpoints({ addTagTypes: [...settingsTags, 'AdminSettingsSessions', 'AdminSettingsEvents', 'AdminSettingsChannels'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminSystemSettings: builder.query({
      queryFn: readQuery(({ page }) => '/admin/settings/' + encodeURIComponent(page), (data, { page }) => adaptSection(data, page)),
      providesTags: ['AdminSettings'],
    }),
    getAdminSettingsPreferences: builder.query({ queryFn: readQuery('/admin/notifications/settings', adaptPreferences), providesTags: ['AdminNotificationSettings'] }),
    getAdminSettingsStatus: builder.query({ queryFn: readQuery(({ page }) => ({ url: '/admin/settings/status', params: { section: page } }), adaptStatus), providesTags: ['AdminSettingsStatus'] }),
    getAdminSettingsVersion: builder.query({ queryFn: readQuery('/admin/platform/version', adaptVersion) }),
    getAdminSettingsChannels: builder.query({ queryFn: readQuery('/admin/settings/notifications/channels', adaptChannels), providesTags: ['AdminSettingsChannels'] }),
    getAdminSettingsProcessors: builder.query({ queryFn: readQuery('/admin/data-protection/processors', adaptProcessors) }),
    getAdminSettingsSessions: builder.query({
      queryFn: readQuery(({ page = 1, limit = 5 }) => ({ url: '/admin/sessions', params: { page, limit, status: 'active' } }), adaptSessions), providesTags: ['AdminSettingsSessions'],
    }),
    getAdminSettingsEvents: builder.query({
      queryFn: readQuery(({ page = 1, limit = 5, type }) => ({ url: '/admin/security/events', params: { page, limit, scope: 'me', ...(type ? { type } : {}) } }), adaptEvents), providesTags: ['AdminSettingsEvents'],
    }),
    saveAdminSettingsSection: builder.mutation({
      async queryFn({ page, changes, owner, expectedVersion }, api, _options, baseQuery) {
        try {
          const check = sessionGuard(api, owner), role = api.getState().auth.admin.role, personal = page === 'notifications';
          if (!canEditSettings(page, role)) return failure('Your admin access level cannot change this settings section.', 403);
          if (!Array.isArray(changes) || !changes.length) return failure('There are no supported settings to save.');
          const url = personal ? '/admin/notifications/settings' : '/admin/settings/' + encodeURIComponent(page);
          const read = await baseQuery({ url }); check(); if (read.error) return read;
          const before = personal ? adaptPreferences(read.data) : adaptSection(read.data, page);
          if (!personal && (!timestamp(expectedVersion) || before.version !== expectedVersion)) return failure('These settings changed or their version is unavailable. Reload before saving.', 409);
          const body = {}, submitted = [];
          for (const change of changes) {
            const control = findSettingsField(page, change.group, change.field), contract = before.contracts[change.group + '.' + change.field];
            if (!control || !contract?.editable) return failure('This setting is fixed or unsupported by the backend.');
            const value = personal ? encodePreference(contract, change.value) : encodeSetting(control, contract, change.value);
            if (Object.hasOwn(body, contract.key) && body[contract.key] !== value) return failure('Conflicting values were entered for the same setting.');
            body[contract.key] = value; submitted.push({ control, contract, value });
          }
          if (!personal) body.expectedVersion = expectedVersion;
          check();
          const result = await baseQuery({ url, method: 'PATCH', body }); check(); if (result.error) return result;
          // A successful HTTP response alone is not proof that every submitted
          // field was saved. Read back once; never replay the write.
          const afterRead = await baseQuery({ url }); check();
          if (afterRead.error) return failure('The save was sent, but its result could not be confirmed. Reload before trying again.');
          const after = personal ? adaptPreferences(afterRead.data) : adaptSection(afterRead.data, page);
          const matches = submitted.every(({ control, contract, value }) => {
            const savedContract = after.contracts[control.group + '.' + control.field];
            if (!savedContract || savedContract.key !== contract.key) return false;
            try { return (personal ? encodePreference(savedContract, after.values[control.group]?.[control.field]) : encodeSetting(control, savedContract, after.values[control.group]?.[control.field])) === value; } catch { return false; }
          });
          if (!matches || (!personal && !after.version)) return failure('The save was sent, but the saved values could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData(personal ? 'getAdminSettingsPreferences' : 'getAdminSystemSettings', personal ? { owner } : { page, owner }, () => after));
          return { data: { section: after, savedOnly: submitted.some(({ contract }) => !contract.enforced) } };
        } catch (error) { return failure(error.message); }
      },
      invalidatesTags: (_result, _error, args) => args.page === 'notifications' ? ['AdminNotificationSettings', 'AdminSettingsEvents'] : settingsTags,
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
          if (!timestamp(expectedVersion) || before.version !== expectedVersion) return failure('The reset requires a confirmed current section version. Reload before continuing.', 409);
          const rawBefore = record(unwrapApiResponseData(preflight.data));
          const defaults = Array.isArray(rawBefore.fields) ? rawBefore.fields.filter((field) => field?.editable === true && Object.hasOwn(field, 'default')) : [];
          if (!personal && !defaults.length) return failure('This section has no confirmed editable defaults to reset.');
          const result = await baseQuery({ url: '/admin/settings/' + page + '/reset', method: 'POST', body: { expectedVersion, idempotencyKey: key() } }); check(); if (result.error) return result;
          const reread = await baseQuery({ url: readUrl }); check();
          if (reread.error) return failure('The reset was sent, but its result could not be confirmed. Reload before trying again.');
          const after = personal ? adaptPreferences(reread.data) : adaptSection(reread.data, page);
          const rawAfter = record(unwrapApiResponseData(reread.data));
          const confirmed = defaults.every((field) => Object.hasOwn(record(rawAfter.values), field.key) && rawAfter.values[field.key] === field.default);
          if (!after.version || (!personal && !confirmed)) return failure('The reset was sent, but the defaults could not be confirmed. Reload before trying again.');
          api.dispatch(settingsApi.util.updateQueryData(personal ? 'getAdminSettingsPreferences' : 'getAdminSystemSettings', personal ? { owner } : { page, owner }, () => after));
          return { data: { section: after } };
        } catch (error) { return failure(error.message); }
      }, invalidatesTags: [...settingsTags, 'AdminNotificationSettings', 'AdminSettingsEvents'],
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
export const { useGetAdminSystemSettingsQuery, useGetAdminSettingsPreferencesQuery, useGetAdminSettingsStatusQuery, useGetAdminSettingsVersionQuery, useGetAdminSettingsChannelsQuery, useGetAdminSettingsProcessorsQuery, useGetAdminSettingsSessionsQuery, useGetAdminSettingsEventsQuery, useSaveAdminSettingsSectionMutation, useResetAdminSettingsSectionMutation, useTestAdminSettingsNotificationMutation, useTerminateAdminSettingsSessionMutation, useChangeAdminSettingsPasswordMutation } = settingsApi;
