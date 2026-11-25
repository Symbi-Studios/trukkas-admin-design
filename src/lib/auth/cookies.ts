import type { AdminUser, AuthTokens } from '@/types/auth';

// Cookie names and settings. Pure code with no Next.js imports, so the server
// actions, the route handler and proxy.ts can all use it.

export const ACCESS_COOKIE = 'trk_access';
export const REFRESH_COOKIE = 'trk_refresh';
export const ADMIN_COOKIE = 'trk_admin';

// The access cookie is dropped this many seconds BEFORE the token really expires,
// so the token is refreshed in time and a page never gets a dead token.
const EARLY_SECONDS = 30;
const DEFAULT_ACCESS_SECONDS = 15 * 60;
const DEFAULT_REFRESH_SECONDS = 7 * 24 * 60 * 60;

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true, // the browser's JavaScript can never read these
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** When a JWT expires, in ms since 1970. null if it cannot be read. The backend still checks every token. */
export function jwtExpiresAt(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function secondsLeft(token: string, fallback: number): number {
  const expiresAt = jwtExpiresAt(token);
  if (!expiresAt) return fallback;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export function accessMaxAge(accessToken: string): number {
  return Math.max(0, secondsLeft(accessToken, DEFAULT_ACCESS_SECONDS) - EARLY_SECONDS);
}

export function refreshMaxAge(refreshToken: string): number {
  return secondsLeft(refreshToken, DEFAULT_REFRESH_SECONDS);
}

// Anything that can set and delete cookies: cookies() in a server action,
// NextResponse.cookies in a route handler or in proxy.ts.
export interface CookieJar {
  set(name: string, value: string, options: ReturnType<typeof cookieOptions>): unknown;
  delete(name: string): unknown;
}

// A cookie holds about 4 KB. If the admin object is big, keep only the basics.
function adminForCookie(admin: AdminUser): AdminUser {
  if (JSON.stringify(admin).length < 3500) return admin;
  const { id, email, firstName, lastName, role } = admin;
  return { id, email, firstName, lastName, role };
}

export function writeSessionCookies(jar: CookieJar, tokens: AuthTokens, admin?: AdminUser): void {
  jar.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(accessMaxAge(tokens.accessToken)));
  jar.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(refreshMaxAge(tokens.refreshToken)));
  if (admin) {
    jar.set(ADMIN_COOKIE, JSON.stringify(adminForCookie(admin)), cookieOptions(refreshMaxAge(tokens.refreshToken)));
  }
}

export function dropSessionCookies(jar: CookieJar): void {
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ADMIN_COOKIE);
}