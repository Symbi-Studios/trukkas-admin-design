import { adaptManagedUser } from '../users/usersApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const date = (value) => { const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && new Date(value); return parsed && Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('en-NG') : '—'; };

export function adaptAdminSelfProfile(admin, account, profile, security, session, summary) {
  const identity = adaptManagedUser(profile || {}, 'admin');
  const ownAccount = account?.source === 'admin' && account.backendId === admin?.id ? account : null;
  const user = ownAccount || identity;
  return {
    ...user,
    id: text(admin?.id) || '—',
    name: text(profile?.name) || user.name, email: text(profile?.email) || user.email,
    phone: text(profile?.phone), location: text(profile?.location), department: text(profile?.department) || '—', entity: text(profile?.entity) || '—', permissionsCaption: text(profile?.permissionsCaption) || '—',
    online: typeof profile?.online?.isOnline === 'boolean' ? profile.online.isOnline : null, twoFactor: null, loginNotifications: null,
    passwordLastChanged: date(security?.passwordChangedAt), passwordStrengthPct: null, passwordStrength: '—',
    emailVerified: typeof security?.emailVerified === 'boolean' ? security.emailVerified : null, phoneVerified: typeof security?.phoneVerified === 'boolean' ? security.phoneVerified : null,
    failedLogins: Number.isSafeInteger(summary?.failedSignInAttempts) && summary.failedSignInAttempts >= 0 ? summary.failedSignInAttempts : null,
    totalLogins: Number.isSafeInteger(summary?.totalSignInsAllTime) && summary.totalSignInsAllTime >= 0 ? summary.totalSignInsAllTime : null,
    activeSessions: Number.isSafeInteger(summary?.activeSessions) && summary.activeSessions >= 0 ? summary.activeSessions : null,
    status: typeof profile?.isActive === 'boolean' ? profile.isActive ? 'Active' : 'Inactive' : '—',
    joinedOn: date(profile?.createdAt), lastActive: date(profile?.lastActiveAt), lastSignIn: date(profile?.lastLoginAt), version: text(profile?.version),
    session: { device: text(session?.device) || '—', location: text(session?.location) || '—', ip: text(session?.ipAddress) || '—', status: text(session?.status) || '—' },
  };
}

export function profileActivity(rows, adminId) {
  if (!Array.isArray(rows) || !text(adminId)) return null;
  return rows.filter((row) => row.actorId === adminId)
    .sort((a, b) => (b.occurredAt ?? -Infinity) - (a.occurredAt ?? -Infinity))
    .slice(0, 5).map((row) => ({
      title: row.action,
      description: `${row.description} · ${row.location} · ${row.ip}`,
      time: row.occurredAt == null ? '—' : `${row.date} at ${row.time}`,
      icon: row.icon,
      state: row.status === 'Success' ? 'done' : row.status === 'Failed' ? 'danger' : 'pending',
    }));
}

export const profileUnavailable = (action) => window.alert(`${action} is not available for this profile.`);
