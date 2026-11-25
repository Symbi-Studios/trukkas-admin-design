import { NextRequest, NextResponse } from 'next/server';
import { backendBaseUrl, refreshTokens, type RefreshOutcome } from '@/lib/auth/backend';
import { ACCESS_COOKIE, REFRESH_COOKIE, dropSessionCookies, writeSessionCookies } from '@/lib/auth/cookies';

// The old screens call the backend through this route instead of straight from the browser.
// The browser sends only its cookie; THIS Next.js server adds the token and forwards the call,
// so the browser never holds a token. When the token is stale it is refreshed here, then the call is repeated once.

export const dynamic = 'force-dynamic';

// These answers contain tokens, so the browser must not reach them through here.
// Sign-in, 2FA and sign-out go through the server actions in lib/auth/actions.ts.
const BLOCKED = new Set(['admin/auth/login', 'admin/auth/2fa/verify', 'admin/auth/refresh', 'admin/auth/logout']);

const jsonError = (status: number, message: string) => NextResponse.json({ message }, { status });

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  if (!path?.length || path.some((part) => part === '' || part === '.' || part === '..')) {
    return jsonError(400, 'Invalid request path.');
  }

  const joined = path.join('/');
  if (BLOCKED.has(joined.toLowerCase())) return jsonError(404, 'Not found.');

  // A form on another website must not be able to make this admin's browser change data.
  const method = request.method.toUpperCase();
  const origin = request.headers.get('origin');
  if (method !== 'GET' && method !== 'HEAD' && origin && new URL(origin).host !== request.nextUrl.host) {
    return jsonError(403, 'Cross-site requests are not allowed.');
  }

  const target = `${backendBaseUrl()}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  // the body is read once and kept, so the call can be repeated after a token refresh
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  // forgot / reset password are public. They never use the session.
  const usesSession = !joined.startsWith('admin/auth/');
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: RefreshOutcome | undefined;

  const send = async (token?: string): Promise<Response | null> => {
    try {
      return await fetch(target, {
        method,
        cache: 'no-store',
        redirect: 'manual',
        headers: {
          ...(contentType ? { 'Content-Type': contentType } : {}),
          ...(accept ? { Accept: accept } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body && body.byteLength > 0 ? body : undefined,
      });
    } catch {
      return null;
    }
  };

  // the access cookie is already gone but the refresh cookie is still good
  if (usesSession && !access && refresh) {
    refreshed = await refreshTokens(refresh);
    if (refreshed.ok) access = refreshed.tokens.accessToken;
  }

  let upstream = await send(usesSession ? access : undefined);

  // the token was refused: refresh once and repeat. A 401 means nothing was done, so repeating is safe.
  if (usesSession && upstream?.status === 401 && refresh && !refreshed) {
    refreshed = await refreshTokens(refresh);
    if (refreshed.ok) upstream = await send(refreshed.tokens.accessToken);
  }

  if (!upstream) return jsonError(502, 'Could not reach the Trukkas backend. Check your connection and try again.');

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const name of ['content-type', 'content-disposition']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const noBody = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  const response = new NextResponse(noBody ? null : upstream.body, { status: upstream.status, headers });

  if (refreshed?.ok) writeSessionCookies(response.cookies, refreshed.tokens, refreshed.admin);
  if (refreshed && !refreshed.ok && refreshed.terminal) dropSessionCookies(response.cookies);
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;