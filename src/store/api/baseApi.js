import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearSession, setCredentials } from '../features/auth/authSlice.js';

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://trukkas-backend.onrender.com/api/v1';
const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
const publicEndpoints = new Set(['loginAdmin', 'refreshAdmin', 'forgotAdminPassword', 'resetAdminPassword']);
const reauthExcludedPaths = new Set([
  '/admin/auth/login',
  '/admin/auth/refresh',
  '/admin/auth/forgot-password',
  '/admin/auth/reset-password',
]);

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  prepareHeaders(headers, { endpoint, getState }) {
    const token = getState().auth.accessToken;
    if (token && !publicEndpoints.has(endpoint)) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

// A refresh request must not carry an expired access token.
const refreshBaseQuery = fetchBaseQuery({ baseUrl });
let activeRefresh = null;

function isTerminalRefreshError(error) {
  const status = error?.status === 'PARSING_ERROR' ? error.originalStatus : error?.status;
  return [400, 401, 403, 422].includes(status);
}

function clearExpiredSession(api, expectedRefreshToken) {
  if (expectedRefreshToken && api.getState().auth.refreshToken !== expectedRefreshToken) return;
  api.dispatch(clearSession());
  api.dispatch(baseApi.util.resetApiState());
}

async function performRefresh(refreshToken, api, extraOptions) {
  const result = await refreshBaseQuery({
    url: '/admin/auth/refresh',
    method: 'POST',
    body: { refreshToken },
  }, api, extraOptions);

  // A logout or newer login may have happened while the request was in flight.
  if (api.getState().auth.refreshToken !== refreshToken) return { status: 'stale' };
  if (result.error) {
    if (isTerminalRefreshError(result.error)) clearExpiredSession(api, refreshToken);
    return { status: 'failed', error: result.error };
  }
  if (!result.data?.accessToken || !result.data?.refreshToken) {
    clearExpiredSession(api, refreshToken);
    return { status: 'failed', error: { status: 'CUSTOM_ERROR', error: 'The refresh response is missing session details.' } };
  }

  api.dispatch(setCredentials({
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
  }));
  return { status: 'success' };
}

export function refreshSession(api, extraOptions) {
  const refreshToken = api.getState().auth.refreshToken;
  if (!refreshToken) return Promise.resolve({ status: 'failed', error: { status: 401, data: { message: 'Please sign in again.' } } });

  if (!activeRefresh || activeRefresh.refreshToken !== refreshToken) {
    const entry = { refreshToken, promise: performRefresh(refreshToken, api, extraOptions) };
    activeRefresh = entry;
    void entry.promise.finally(() => {
      if (activeRefresh === entry) activeRefresh = null;
    });
  }
  return activeRefresh.promise;
}

async function baseQueryWithReauth(args, api, extraOptions) {
  const requestToken = api.getState().auth.accessToken;
  let result = await rawBaseQuery(args, api, extraOptions);
  const path = (typeof args === 'string' ? args : args.url).split('?')[0];
  const method = (typeof args === 'string' ? 'GET' : args.method || 'GET').toUpperCase();
  const safeToRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  if (result.error?.status !== 401 || reauthExcludedPaths.has(path)) return result;

  const currentToken = api.getState().auth.accessToken;
  if (safeToRetry && currentToken && currentToken !== requestToken) {
    return rawBaseQuery(args, api, extraOptions);
  }
  if (!api.getState().auth.refreshToken) {
    clearExpiredSession(api);
    return result;
  }

  const refresh = await refreshSession(api, extraOptions);
  if (refresh.status === 'success' && safeToRetry) {
    result = await rawBaseQuery(args, api, extraOptions);
    if (result.error?.status === 401) clearExpiredSession(api);
  }
  return result;
}

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
