import { baseApi, unwrapApiResponseData } from '../../api/baseApi.js';
import { setCredentials } from '../auth/authSlice.js';

const failure = (error) => ({ error: { status: 'CUSTOM_ERROR', error } });
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const profilePath = '/admin/profile';
const guard = (api, owner) => {
  const admin = api.getState().auth.admin;
  if (!owner || admin?.id !== owner || !api.getState().auth.accessToken) return null;
  return () => !api.signal.aborted && api.getState().auth.admin === admin && Boolean(api.getState().auth.accessToken);
};
const personalQuery = (suffix) => ({
  async queryFn({ owner }, api, _options, baseQuery) {
    const current = guard(api, owner);
    if (!current) return failure('Please sign in again.');
    const result = await baseQuery(profilePath + suffix);
    if (!current()) return failure('Your session changed. Please reload.');
    if (result.error) return result;
    const data = unwrapApiResponseData(result.data);
    return data && typeof data === 'object' && !Array.isArray(data) ? { data } : failure('Your account details could not be loaded.');
  },
  keepUnusedDataFor: 0,
  providesTags: ['AdminSelfProfile'],
});

export const profileApi = baseApi.enhanceEndpoints({ addTagTypes: ['AdminSelfProfile'] }).injectEndpoints({
  endpoints: (builder) => ({
    getAdminSelfSecurity: builder.query(personalQuery('/security')),
    getAdminSelfSession: builder.query(personalQuery('/session')),
    getAdminSelfActivitySummary: builder.query(personalQuery('/activity/summary')),
    getAdminSelfProfile: builder.query({
      async queryFn({ owner }, api, _options, baseQuery) {
        const current = guard(api, owner);
        if (!current) return failure('Please sign in again.');
        const result = await baseQuery(profilePath);
        if (!current()) return failure('Your session changed. Please reload.');
        if (result.error) return result;
        const profile = unwrapApiResponseData(result.data);
        return profile?.id === owner ? { data: profile } : failure('Your profile could not be confirmed. Please reload.');
      },
      keepUnusedDataFor: 0,
      providesTags: ['AdminSelfProfile'],
    }),
    updateAdminSelfProfile: builder.mutation({
      async queryFn({ owner, version, changes, currentPassword }, api, _options, baseQuery) {
        const current = guard(api, owner);
        if (!current) return failure('Please sign in again.');
        if (!text(version) || !changes || !Object.keys(changes).length || Object.keys(changes).some((key) => !['name', 'email', 'phone', 'location'].includes(key))) return failure('Reload your profile before saving.');
        if ('email' in changes && (typeof currentPassword !== 'string' || !currentPassword)) return failure('Enter your current password to change your email.');
        const result = await baseQuery({ url: profilePath, method: 'PATCH', body: { ...changes, expectedVersion: version, ...('email' in changes ? { currentPassword } : {}) } });
        if (!current()) return failure('Your session changed. The update may have been saved; reload and check before trying again.');
        if (result.error) return result;
        const saved = unwrapApiResponseData(result.data)?.profile;
        if (saved?.id !== owner || !Object.entries(changes).every(([key, value]) => key === 'email' ? text(saved.email)?.toLowerCase() === text(value)?.toLowerCase() : (saved[key] ?? null) === value)) return failure('The changes were sent but could not be confirmed. Reload before trying again.');
        if ('email' in changes) api.dispatch(setCredentials({ admin: { ...api.getState().auth.admin, email: saved.email } }));
        return { data: saved };
      },
      invalidatesTags: ['AdminSelfProfile'],
    }),
  }),
});

export const { useGetAdminSelfProfileQuery, useGetAdminSelfSecurityQuery, useGetAdminSelfSessionQuery, useGetAdminSelfActivitySummaryQuery, useUpdateAdminSelfProfileMutation } = profileApi;
