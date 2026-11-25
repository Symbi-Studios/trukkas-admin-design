import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { clearSession } from '../features/auth/authSlice.js';

// Every call goes to this Next.js route (src/app/api/backend), NOT straight to the Trukkas backend.
// The Next.js server adds the token from the httpOnly cookie, refreshes it when needed and forwards the call,
// so no token exists in the browser. The backend address is set on the server (API_BASE_URL).
const baseUrl = '/api/backend';
const apiLoggingDisabled = String(process.env.NEXT_PUBLIC_API_LOGGING ?? '').trim().toLowerCase() === 'false';
const apiLoggingEnabled = process.env.NODE_ENV !== 'production' && !apiLoggingDisabled;
// Public calls: a 401 here is a wrong answer, not an ended session.
const publicPaths = new Set(['/admin/auth/forgot-password', '/admin/auth/reset-password']);

const rawBaseQuery = fetchBaseQuery({ baseUrl });

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

function endSession(api) {
  api.dispatch(clearSession());
  api.dispatch(baseApi.util.resetApiState());
}

// The forwarding route has already tried to refresh the session. A 401 that still reaches us means it is over.
async function baseQueryWithSession(args, api, extraOptions) {
  const result = await runLoggedBaseQuery(rawBaseQuery, args, api, extraOptions);
  const path = (typeof args === 'string' ? args : args.url).split('?')[0];
  if (result.error?.status === 401 && !publicPaths.has(path)) endSession(api);
  return result;
}

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithSession,
  tagTypes: ['AdminNotifications', 'AdminNotificationSettings', 'AdminJobs', 'AdminBids', 'AdminBidAnalytics', 'AdminTrips', 'AdminDocReviewStats', 'AdminDocReviewQueue', 'AdminDocReviewDetail', 'ContainerReviewQueue', 'ContainerReviewJob', 'AdminTriangulation', 'AdminFleet', 'AdminDrivers', 'AdminDriverStats', 'AdminCompanies', 'AdminForwarders', 'AdminPricingConfig', 'AdminTerminalRates'],
  endpoints: () => ({}),
});