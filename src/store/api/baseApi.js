import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearSession, setCredentials } from '../features/auth/authSlice.js';

const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://trukkas-backend.onrender.com/api/v1';
const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
const apiLoggingDisabled = String(process.env.NEXT_PUBLIC_API_LOGGING ?? '').trim().toLowerCase() === 'false';
const apiLoggingEnabled = process.env.NODE_ENV !== 'production' && !apiLoggingDisabled;
const publicEndpoints = new Set(['loginAdmin', 'verifyAdminTwoFactor', 'refreshAdmin', 'forgotAdminPassword', 'resetAdminPassword']);
const reauthExcludedPaths = new Set([
  '/admin/auth/login',
  '/admin/auth/2fa/verify',
  '/admin/auth/refresh',
  '/admin/auth/forgot-password',
  '/admin/auth/reset-password',
]);
// Report preview uses POST for read-only configuration evaluation.
const retryableAfterRefresh = new Set(['markAdminNotificationsRead', 'markAllAdminNotificationsRead', 'previewAdminReport']);

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

async function runLoggedBaseQuery(query, args, api, extraOptions, label = api.endpoint) {
  const startedAt = Date.now();
  const result = await query(args, api, extraOptions);
  if (!apiLoggingEnabled) return result;

  const request = result.meta?.request;
  const response = result.meta?.response;
  const method = (request?.method || (typeof args === 'string' ? 'GET' : args.method || 'GET')).toUpperCase();
  const url = request?.url || (typeof args === 'string' ? args : args.url);
  const requestBody = typeof args === 'string' ? undefined : args.body;
  const responseBody = result.error
    ? (result.error.data ?? { error: result.error.error ?? result.error.status })
    : result.data;

  console.groupCollapsed(`[API] ${method} ${url} → ${response?.status ?? result.error?.status ?? 'complete'} (${Date.now() - startedAt}ms)`);
  console.info('Endpoint:', label);
  console.info('Request:', {
    method,
    url,
    headers: request?.headers ? Object.fromEntries(request.headers.entries()) : undefined,
    body: requestBody,
  });
  console.info('Response body:', responseBody);
  console.groupEnd();
  return result;
}
function isTerminalRefreshError(error) {
  const status = error?.status === 'PARSING_ERROR' ? error.originalStatus : error?.status;
  return [400, 401, 403, 422].includes(status);
}

function clearExpiredSession(api, expectedRefreshToken) {
  if (expectedRefreshToken && api.getState().auth.refreshToken !== expectedRefreshToken) return;
  api.dispatch(clearSession());
  api.dispatch(baseApi.util.resetApiState());
}

export function unwrapApiResponseData(response) {
  let data = response;
  while (
    data && typeof data === 'object' && !Array.isArray(data)
    && data.data && typeof data.data === 'object' && !Array.isArray(data.data)
  ) {
    data = data.data;
  }
  return data;
}

async function performRefresh(refreshToken, api, extraOptions) {
  const result = await runLoggedBaseQuery(refreshBaseQuery, {
    url: '/admin/auth/refresh',
    method: 'POST',
    body: { refreshToken },
  }, api, extraOptions, 'refreshAdmin');

  // A logout or newer login may have happened while the request was in flight.
  if (api.getState().auth.refreshToken !== refreshToken) return { status: 'stale' };
  if (result.error) {
    if (isTerminalRefreshError(result.error)) clearExpiredSession(api, refreshToken);
    return { status: 'failed', error: result.error };
  }
  const data = unwrapApiResponseData(result.data);
  if (!data?.accessToken) {
    clearExpiredSession(api, refreshToken);
    return { status: 'failed', error: { status: 'CUSTOM_ERROR', error: 'The refresh response is missing session details.' } };
  }

  api.dispatch(setCredentials({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || refreshToken,
    admin: data.admin,
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
  let result = await runLoggedBaseQuery(rawBaseQuery, args, api, extraOptions);
  const path = (typeof args === 'string' ? args : args.url).split('?')[0];
  const method = (typeof args === 'string' ? 'GET' : args.method || 'GET').toUpperCase();
  const safeToRetry = ['GET', 'HEAD', 'OPTIONS'].includes(method) || retryableAfterRefresh.has(api.endpoint);

  if (result.error?.status !== 401 || reauthExcludedPaths.has(path)) return result;

  const currentToken = api.getState().auth.accessToken;
  if (safeToRetry && currentToken && currentToken !== requestToken) {
    return runLoggedBaseQuery(rawBaseQuery, args, api, extraOptions, `${api.endpoint} (retry)`);
  }
  if (!api.getState().auth.refreshToken) {
    clearExpiredSession(api);
    return result;
  }

  const refresh = await refreshSession(api, extraOptions);
  if (refresh.status === 'success' && safeToRetry) {
    result = await runLoggedBaseQuery(rawBaseQuery, args, api, extraOptions, `${api.endpoint} (retry)`);
    if (result.error?.status === 401) clearExpiredSession(api);
  }
  return result;
}

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['AdminNotifications', 'AdminNotificationSettings', 'AdminJobs', 'AdminBids', 'AdminBidAnalytics', 'AdminTrips', 'AdminDocReviewStats', 'AdminDocReviewQueue', 'AdminDocReviewDetail', 'AdminTriangulation', 'AdminFleet', 'AdminDrivers', 'AdminDriverStats', 'AdminCompanies', 'AdminForwarders', 'AdminPricingConfig', 'AdminTerminalRates'],
  endpoints: () => ({}),
});
