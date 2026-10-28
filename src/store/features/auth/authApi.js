import { baseApi, refreshSession, unwrapApiResponseData } from '../../api/baseApi.js';
import { setCredentials } from './authSlice.js';
import { adaptTwoFactorChallenge, twoFactorProof } from './twoFactorContracts.js';

const failure = (message) => ({ error: { status: 'CUSTOM_ERROR', error: message } });
function loginOwner(api) {
  const { admin, accessToken } = api.getState().auth;
  return () => {
    if (api.signal.aborted || api.getState().auth.admin !== admin || api.getState().auth.accessToken !== accessToken) throw new Error('The sign-in session changed. Start again.');
  };
}
function completeLogin(data, api) {
  if (typeof data?.accessToken !== 'string' || !data.accessToken || typeof data?.refreshToken !== 'string' || !data.refreshToken || typeof data?.admin?.id !== 'string' || !data.admin.id || data.twoFactorRequired === true) return failure('The login response is missing session details.');
  api.dispatch(setCredentials({ admin: data.admin, accessToken: data.accessToken, refreshToken: data.refreshToken }));
  return { data: { admin: data.admin, message: data.message } };
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    loginAdmin: builder.mutation({
      async queryFn(body, api, _options, baseQuery) {
        try {
          const check = loginOwner(api);
          const result = await baseQuery({ url: '/admin/auth/login', method: 'POST', body });
          check(); if (result.error) return result;
          const data = unwrapApiResponseData(result.data), challenge = adaptTwoFactorChallenge(data);
          if (challenge) return { data: { twoFactorRequired: true, challenge } };
          return completeLogin(data, api);
        } catch (error) { return failure(error.message); }
      },
    }),
    verifyAdminTwoFactor: builder.mutation({
      async queryFn({ challengeId, code, backupCode }, api, _options, baseQuery) {
        try {
          const check = loginOwner(api);
          if (typeof challengeId !== 'string' || !challengeId.trim()) return failure('Start sign-in again to get a two-factor challenge.');
          const proof = twoFactorProof({ code, backupCode });
          const result = await baseQuery({ url: '/admin/auth/2fa/verify', method: 'POST', body: { challengeId, ...proof } });
          check(); if (result.error) return result;
          return completeLogin(unwrapApiResponseData(result.data), api);
        } catch (error) { return failure(error.message); }
      },
    }),
    refreshAdmin: builder.mutation({
      async queryFn(_arg, api, extraOptions) {
        const result = await refreshSession(api, extraOptions);
        if (result.status === 'success') return { data: { message: 'Session refreshed.' } };
        return { error: result.error || { status: 401, data: { message: 'Please sign in again.' } } };
      },
    }),
    logoutAdmin: builder.mutation({
      query: () => ({ url: '/admin/auth/logout', method: 'POST' }),
    }),
    forgotAdminPassword: builder.mutation({
      query: ({ email }) => ({ url: '/admin/auth/forgot-password', method: 'POST', body: { email } }),
    }),
    resetAdminPassword: builder.mutation({
      query: (body) => ({ url: '/admin/auth/reset-password', method: 'POST', body }),
    }),
  }),
});

export const {
  useLoginAdminMutation,
  useVerifyAdminTwoFactorMutation,
  useRefreshAdminMutation,
  useLogoutAdminMutation,
  useForgotAdminPasswordMutation,
  useResetAdminPasswordMutation,
} = authApi;
