import type { ApiError } from '@/types/api';

// Only `id` is certain. Tighten this once we have seen the real login response.
export interface AdminUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// The second step of a login when the admin has two-factor on.
export interface TwoFactorChallenge {
  challengeId: string;
  method: 'TOTP';
  expiresAt: string;
  backupCodesRemaining: number | null;
}

// What the login and verify server actions give back to the screen.
// It never contains a token: the tokens only live in httpOnly cookies.
export type AuthActionResult =
  | { ok: true; admin: AdminUser }
  | { ok: true; twoFactorRequired: true; challenge: TwoFactorChallenge }
  | { ok: false; error: ApiError };