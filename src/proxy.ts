import { NextResponse, type NextRequest } from 'next/server';
import { refreshTokens } from '@/lib/auth/backend';
import { ACCESS_COOKIE, REFRESH_COOKIE, dropSessionCookies, writeSessionCookies } from '@/lib/auth/cookies';

// Runs on the Next.js server before every page. It does two things:
// 1. sends signed-out visitors to /login (the old admin only did this in the browser);
// 2. renews the access token before the page renders, because a page cannot write cookies.

const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/reset-password', '/signed-out']);

function toLogin(request: NextRequest, expired: boolean) {
  const url = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  if (expired) url.searchParams.set('expired', '1');
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  // The access cookie is dropped 30 seconds before the token expires, so if it is here it is good.
  if (request.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return toLogin(request, false);

  const result = await refreshTokens(refresh);
  if (result.ok) {
    // set on the request too, so the page that renders right now already sees the new token
    request.cookies.set(ACCESS_COOKIE, result.tokens.accessToken);
    request.cookies.set(REFRESH_COOKIE, result.tokens.refreshToken);
    const response = NextResponse.next({ request });
    writeSessionCookies(response.cookies, result.tokens, result.admin);
    return response;
  }

  const redirect = toLogin(request, result.terminal);
  if (result.terminal) dropSessionCookies(redirect.cookies);
  return redirect;
}

// Not the route handler (it checks the session itself), Next.js files, or anything with a file extension.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};