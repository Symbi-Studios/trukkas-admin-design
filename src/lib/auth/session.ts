import 'server-only';
import { cookies } from 'next/headers';
import type { AdminUser, AuthTokens } from '@/types/auth';
import { ACCESS_COOKIE, ADMIN_COOKIE, dropSessionCookies, writeSessionCookies } from './cookies';

// Runs on the Next.js server only. Reading is fine anywhere on the server.
// saveSession / clearSessionCookies WRITE cookies, so call them only from a
// server action or a route handler (never while a page is rendering).

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function getAdmin(): Promise<AdminUser | null> {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  try {
    const admin = JSON.parse(raw);
    return admin && typeof admin.id === 'string' ? (admin as AdminUser) : null;
  } catch {
    return null;
  }
}

export async function saveSession(tokens: AuthTokens, admin?: AdminUser): Promise<void> {
  writeSessionCookies(await cookies(), tokens, admin);
}

export async function clearSessionCookies(): Promise<void> {
  dropSessionCookies(await cookies());
}