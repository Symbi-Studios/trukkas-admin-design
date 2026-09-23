import { baseApi, refreshSession } from '../../api/baseApi.js';
import { setCredentials } from './authSlice.js';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    loginAdmin: builder.mutation({
      async queryFn(body, api, extraOptions, baseQuery) {
        const result = await baseQuery({ url: '/admin/auth/login', method: 'POST', body });
        if (result.error) return { error: result.error };
        const data = result.data;
        if (!data?.accessToken || !data?.refreshToken || !data?.admin) {
          return { error: { status: 'CUSTOM_ERROR', error: 'The login response is missing session details.' } };
        }
        api.dispatch(setCredentials({
          admin: data.admin,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }));
        return { data: { admin: data.admin, message: data.message } };
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
  useRefreshAdminMutation,
  useLogoutAdminMutation,
  useForgotAdminPasswordMutation,
  useResetAdminPasswordMutation,
} = authApi;
