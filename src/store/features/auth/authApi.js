import { baseApi } from '../../api/baseApi.js';

// Sign in, two-factor, refresh and sign out are NOT here any more: they are server actions in
// src/lib/auth/actions.ts, because their answers contain tokens and must never reach the browser.
// Forgot and reset password stay: they are public and carry no tokens.
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    forgotAdminPassword: builder.mutation({
      query: ({ email }) => ({ url: '/admin/auth/forgot-password', method: 'POST', body: { email } }),
    }),
    resetAdminPassword: builder.mutation({
      query: (body) => ({ url: '/admin/auth/reset-password', method: 'POST', body }),
    }),
  }),
});

export const {
  useForgotAdminPasswordMutation,
  useResetAdminPasswordMutation,
} = authApi;