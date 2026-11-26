import 'server-only';
import { redirect } from 'next/navigation';
import type { ApiResult } from '@/types/api';
import { backendBaseUrl, toApiError, UNREACHABLE_MESSAGE } from '@/lib/auth/backend';
import { getAccessToken } from '@/lib/auth/session';

// The ONLY place the pages call the Trukkas backend from. It runs on the Next.js server:
// the token comes from the httpOnly cookie and never reaches the browser.
// Server-only variable (no NEXT_PUBLIC_): API_BASE_URL=https://trukkas-backend.onrender.com/api/v1

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** "text" for CSV exports: the data is the raw text, not JSON */
  as?: 'json' | 'text';
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const token = await getAccessToken();
  if (!token) redirect('/login');

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const url = `${backendBaseUrl()}${path}${params.size ? `?${params}` : ''}`;
  const method = options.method ?? 'GET';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: 'no-store', // admin data is per person and must always be fresh
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.as === 'text' ? { Accept: 'text/csv' } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return { ok: false, error: { status: 0, message: UNREACHABLE_MESSAGE } };
  }

  // proxy.ts refreshes the token before a page renders, so a 401 here means the session is really over.
  if (res.status === 401) redirect('/login');

  const raw = await res.text().catch(() => '');
  if (res.ok && options.as === 'text') {
    if (process.env.API_LOGGING === 'true') console.info(`[API] ${method} ${url} -> ${res.status} (${raw.length} characters of text)`);
    return { ok: true, data: raw as T };
  }
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  if (process.env.API_LOGGING === 'true') {
    console.info(`[API] ${method} ${url} -> ${res.status}`, json);
  }

  if (!res.ok) return { ok: false, error: toApiError(res.status, json) };

  // same rule as the mobile app: use data.data, or the body itself when there is no wrapper
  return { ok: true, data: ((json as { data?: unknown } | null)?.data ?? json) as T };
}