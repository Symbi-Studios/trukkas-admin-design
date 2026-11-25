'use server';

import { callBackend, toApiError, unwrapData, UNREACHABLE_MESSAGE } from '@/lib/auth/backend';
import { clearSessionCookies, getAccessToken, saveSession } from '@/lib/auth/session';
import type { AdminUser, AuthActionResult, TwoFactorChallenge } from '@/types/auth';

// These run on the Next.js server. The screen sends the form; the tokens that come back
// from the backend go straight into httpOnly cookies and are never sent to the browser.
// Everything that arrives here comes from the browser, so it is checked again.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const fail = (status: number, message: string, code?: string): AuthActionResult => ({
  ok: false,
  error: { status, message, code },
});

// Same checks the old admin did before it trusted a challenge.
function readChallenge(data: Record<string, unknown>): TwoFactorChallenge | 'invalid' {
  const challengeId = text(data.challengeId);
  const expiresAt = text(data.expiresAt);
  const backup = data.backupCodesRemaining;
  if (
    !challengeId ||
    data.method !== 'TOTP' ||
    !expiresAt ||
    !/^\d{4}-\d{2}-\d{2}T/.test(expiresAt) ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    data.accessToken ||
    data.refreshToken
  ) {
    return 'invalid';
  }
  return {
    challengeId,
    method: 'TOTP',
    expiresAt,
    backupCodesRemaining: typeof backup === 'number' && Number.isSafeInteger(backup) && backup >= 0 ? backup : null,
  };
}

async function finishLogin(data: unknown): Promise<AuthActionResult> {
  if (
    !isRecord(data) ||
    data.twoFactorRequired === true ||
    !text(data.accessToken) ||
    !text(data.refreshToken) ||
    !isRecord(data.admin) ||
    !text(data.admin.id)
  ) {
    return fail(502, 'The login response is missing session details.');
  }
  const admin = data.admin as AdminUser;
  await saveSession({ accessToken: data.accessToken as string, refreshToken: data.refreshToken as string }, admin);
  return { ok: true, admin };
}

export async function loginAction(input: { email: string; password: string }): Promise<AuthActionResult> {
  const email = text(input?.email);
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!email || !password) return fail(400, 'Enter your email and password.');

  const reply = await callBackend('/admin/auth/login', { body: { email, password } });
  if (reply.status === 0) return fail(0, UNREACHABLE_MESSAGE);
  if (!reply.ok) return { ok: false, error: toApiError(reply.status, reply.json) };

  const data = unwrapData(reply.json);
  if (isRecord(data) && data.twoFactorRequired === true) {
    const challenge = readChallenge(data);
    if (challenge === 'invalid') return fail(502, 'The verification request could not be completed. Sign in again.');
    return { ok: true, twoFactorRequired: true, challenge };
  }
  return finishLogin(data);
}

export async function verifyTwoFactorAction(input: {
  challengeId: string;
  code?: string;
  backupCode?: string;
}): Promise<AuthActionResult> {
  const challengeId = text(input?.challengeId);
  if (!challengeId) return fail(400, 'Start sign-in again to get a two-factor challenge.');

  // exactly one proof: the authenticator code OR one backup code
  const code = text(input?.code);
  const backupCode = text(input?.backupCode);
  if (Boolean(code) === Boolean(backupCode)) return fail(400, 'Enter an authenticator code or one backup code.');
  if (code && !/^\d{6}$/.test(code)) return fail(400, 'Enter the six-digit code from your authenticator app.');

  const reply = await callBackend('/admin/auth/2fa/verify', {
    body: { challengeId, ...(backupCode ? { backupCode } : { code }) },
  });
  if (reply.status === 0) return fail(0, UNREACHABLE_MESSAGE);
  if (!reply.ok) return { ok: false, error: toApiError(reply.status, reply.json) };
  return finishLogin(unwrapData(reply.json));
}

// The cookies are always cleared on this device, even when the backend cannot confirm the logout.
export async function logoutAction(): Promise<{ serverConfirmed: boolean }> {
  const token = await getAccessToken();
  let serverConfirmed = false;
  if (token) {
    const reply = await callBackend('/admin/auth/logout', { token });
    serverConfirmed = reply.ok;
  }
  await clearSessionCookies();
  return { serverConfirmed };
}