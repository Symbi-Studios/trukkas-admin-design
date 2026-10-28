import { unwrapApiResponseData } from '../../api/baseApi.js';

const record = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function twoFactorProof({ code, backupCode } = {}) {
  const currentCode = text(code), backup = text(backupCode);
  if (Boolean(currentCode) === Boolean(backup)) throw new Error('Enter an authenticator code or one backup code.');
  if (backup) return { backupCode: backup };
  if (!/^\d{6}$/.test(currentCode)) throw new Error('Enter the six-digit code from your authenticator app.');
  return { code: currentCode };
}

export function adaptTwoFactorChallenge(response) {
  const dto = record(unwrapApiResponseData(response));
  if (dto.twoFactorRequired !== true) return null;
  if (!text(dto.challengeId) || dto.method !== 'TOTP' || !timestamp(dto.expiresAt) || dto.accessToken || dto.refreshToken) throw new Error('The backend did not return a complete two-factor challenge. Sign in again.');
  return { challengeId: dto.challengeId, method: dto.method, expiresAt: dto.expiresAt, backupCodesRemaining: count(dto.backupCodesRemaining) };
}

export function adaptTwoFactorStatus(response) {
  const dto = record(unwrapApiResponseData(response));
  if (typeof dto.available !== 'boolean' || typeof dto.enabled !== 'boolean' || dto.enabled && dto.method !== 'TOTP') throw new Error('The backend did not return a confirmed two-factor status.');
  return { available: dto.available, enabled: dto.enabled, method: dto.method === 'TOTP' ? dto.method : null,
    enabledAt: timestamp(dto.enabledAt), backupCodesRemaining: count(dto.backupCodesRemaining), setupPending: typeof dto.setupPending === 'boolean' ? dto.setupPending : null };
}

export function adaptTwoFactorSetup(response, email) {
  const dto = record(unwrapApiResponseData(response));
  const secret = text(dto.secret), issuer = text(dto.issuer), account = text(dto.account);
  if (dto.method !== 'TOTP' || dto.enabled !== false || !secret || !/^[A-Z2-7]+=*$/i.test(secret) || !issuer || !account || !text(email) || account.toLowerCase() !== email.trim().toLowerCase()) throw new Error('The backend did not confirm an authenticator key for your admin account.');
  const url = new URL(dto.otpauthUrl);
  if (url.protocol !== 'otpauth:' || url.hostname !== 'totp' || url.searchParams.get('secret') !== secret) throw new Error('The backend returned inconsistent authenticator setup details.');
  return { secret, issuer, account };
}

export function adaptTwoFactorResult(response, operation) {
  const dto = record(unwrapApiResponseData(response)), status = record(dto.twoFactor);
  if (operation === 'disable') {
    if (status.enabled !== false || status.method !== null || status.backupCodesRemaining !== 0) throw new Error('The backend did not confirm that two-factor authentication is off.');
    return { enabled: false };
  }
  if (operation === 'enable' && (status.enabled !== true || status.method !== 'TOTP' || !timestamp(status.enabledAt) || status.backupCodesRemaining !== 10)) throw new Error('The backend did not confirm that two-factor authentication is on.');
  const codes = dto.backupCodes;
  if (!Array.isArray(codes) || codes.length !== 10 || codes.some((code) => !text(code)) || new Set(codes).size !== codes.length || operation === 'backup-codes' && dto.backupCodesRemaining !== 10) throw new Error('The backend did not return the ten single-use backup codes. Reload two-factor settings before continuing.');
  return { enabled: true, backupCodes: codes };
}
