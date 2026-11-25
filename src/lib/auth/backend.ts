import type { ApiError } from '@/types/api';
import type { AdminUser, AuthTokens } from '@/types/auth';

// Plain calls to the Trukkas backend with NO cookie handling, so the server
// actions, the route handler and proxy.ts can all share them.

export const UNREACHABLE_MESSAGE = 'Could not reach the Trukkas backend. Check your connection and try again.';

export function backendBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error('API_BASE_URL is not set. Add it to .env.local.');
  return url.replace(/\/+$/, '');
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Same rule the old admin used: step into nested `data` objects until the real payload. */
export function unwrapData(body: unknown): unknown {
  let data = body;
  while (isRecord(data) && isRecord(data.data)) data = data.data;
  return data;
}

export function toApiError(status: number, json: unknown): ApiError {
  const body = isRecord(json) ? json : {};
  const nested = isRecord(body.error) ? body.error : {};
  const raw = body.message ?? nested.message;
  const message = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : '';
  const code = [body.code, body.errorCode, nested.code].find((value): value is string => typeof value === 'string');
  return { status, code, message: message || 'Something went wrong. Please try again.' };
}

export interface BackendReply {
  ok: boolean;
  /** 0 means the backend could not be reached. */
  status: number;
  json: unknown;
}

export async function callBackend(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<BackendReply> {
  try {
    const res = await fetch(`${backendBaseUrl()}${path}`, {
      method: options.method ?? 'POST',
      cache: 'no-store',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

// ---- refreshing the session -------------------------------------------------

export type RefreshOutcome =
  | { ok: true; tokens: AuthTokens; admin?: AdminUser }
  | { ok: false; /** true = the session is really over; false = a temporary problem, keep the cookies */ terminal: boolean };

const TERMINAL_STATUSES = [400, 401, 403, 422];

async function requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
  const reply = await callBackend('/admin/auth/refresh', { body: { refreshToken } });
  if (reply.status === 0) return { ok: false, terminal: false };
  if (!reply.ok) return { ok: false, terminal: TERMINAL_STATUSES.includes(reply.status) };

  const data = unwrapData(reply.json);
  if (!isRecord(data) || typeof data.accessToken !== 'string' || !data.accessToken) {
    return { ok: false, terminal: true };
  }
  const admin = isRecord(data.admin) && typeof data.admin.id === 'string' ? (data.admin as AdminUser) : undefined;
  return {
    ok: true,
    tokens: {
      accessToken: data.accessToken,
      refreshToken: typeof data.refreshToken === 'string' && data.refreshToken ? data.refreshToken : refreshToken,
    },
    admin,
  };
}

// Several requests can arrive together with the same old refresh token (a page and its data calls).
// If the backend replaces the refresh token on each refresh, only the FIRST would work and the admin
// would be signed out. So the same refresh token is only used once, and the answer is kept for a few
// seconds for the others. This only works inside one running Next.js server process.
const REUSE_MS = 15_000;
const recent = new Map<string, { promise: Promise<RefreshOutcome>; doneAt: number | null }>();

export function refreshTokens(refreshToken: string): Promise<RefreshOutcome> {
  const now = Date.now();
  for (const [key, entry] of recent) {
    if (entry.doneAt !== null && now - entry.doneAt > REUSE_MS) recent.delete(key);
  }

  const existing = recent.get(refreshToken);
  if (existing) return existing.promise;

  const entry: { promise: Promise<RefreshOutcome>; doneAt: number | null } = {
    promise: requestRefresh(refreshToken),
    doneAt: null,
  };
  recent.set(refreshToken, entry);
  void entry.promise.then((outcome) => {
    if (outcome.ok) entry.doneAt = Date.now();
    else recent.delete(refreshToken); // a failure is never reused
  });
  return entry.promise;
}