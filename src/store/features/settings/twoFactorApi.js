import { baseApi } from '../../api/baseApi.js';
import { adaptTwoFactorStatus, adaptTwoFactorSetup, adaptTwoFactorResult, twoFactorProof } from '../auth/twoFactorContracts.js';

const path = '/admin/security/2fa';
const failure = (message, uncertain = false) => ({ error: { status: 'CUSTOM_ERROR', error: message, data: { message, saveUnconfirmed: uncertain } } });
function guard(api, owner) {
  const actor = api.getState().auth.admin;
  if (!actor?.id || actor.id !== owner || !api.getState().auth.accessToken) throw new Error('Please sign in again before configuring two-factor authentication.');
  return () => {
    if (api.signal.aborted || api.getState().auth.admin !== actor || !api.getState().auth.accessToken) throw new Error('The admin session changed. Reopen two-factor settings before continuing.');
  };
}
export const twoFactorApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminTwoFactor', 'AdminSettingsEvents', 'AdminAuditLogs'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminTwoFactor: builder.query({
      async queryFn({ owner }, api, _options, baseQuery) {
        try {
          const check = guard(api, owner), result = await baseQuery(path);
          check();
          return result.error ? result : { data: adaptTwoFactorStatus(result.data) };
        } catch (error) { return failure(error.message); }
      }, keepUnusedDataFor: 0, providesTags: ['AdminTwoFactor'],
    }),
    changeAdminTwoFactor: builder.mutation({
      async queryFn({ owner, operation, code, backupCode, currentPassword }, api, _options, baseQuery) {
        let sent = false;
        try {
          const check = guard(api, owner);
          if (!['setup', 'enable', 'disable', 'backup-codes'].includes(operation)) return failure('Choose a supported two-factor action.');
          let body = {};
          if (operation === 'enable') body = twoFactorProof({ code });
          if (['disable', 'backup-codes'].includes(operation)) {
            if (typeof currentPassword !== 'string' || !currentPassword) return failure('Enter your current admin password.');
            body = { currentPassword, ...twoFactorProof({ code, backupCode }) };
          }
          const read = await baseQuery(path); check(); if (read.error) return read;
          const before = adaptTwoFactorStatus(read.data);
          if (!before.available || (['setup', 'enable'].includes(operation) ? before.enabled : !before.enabled)) return failure('Two-factor status changed or this action is unavailable. Reload before continuing.');
          check(); sent = true;
          // These writes have no documented idempotency key. Never replay them.
          const result = await baseQuery({ url: path + '/' + operation, method: 'POST', body });
          check();
          if (result.error) {
            const status = result.error.status === 'PARSING_ERROR' ? result.error.originalStatus : result.error.status;
            if ([400, 401, 403, 404, 409, 422, 429].includes(status)) return result;
            return failure('The request was sent, but its result is unconfirmed. Reload two-factor settings before continuing.', true);
          }
          return { data: operation === 'setup' ? adaptTwoFactorSetup(result.data, api.getState().auth.admin.email) : adaptTwoFactorResult(result.data, operation) };
        } catch (error) { return failure(sent ? 'The request was sent, but its result is unconfirmed. Reload two-factor settings before continuing.' : error.message, sent); }
      },
      invalidatesTags: ['AdminTwoFactor', 'AdminSettingsEvents', 'AdminAuditLogs'],
    }),
  }),
});
export const { useGetAdminTwoFactorQuery, useChangeAdminTwoFactorMutation } = twoFactorApi;
