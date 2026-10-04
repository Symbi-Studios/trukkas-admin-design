import { adaptManagedUser } from '../users/usersApi.js';

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

// The admin login identity is available to every admin role. The admin
// directory can supply additional account fields only to Super Admins.
export function adaptAdminSelfProfile(admin, account) {
  const identity = adaptManagedUser(admin || {}, 'admin');
  const ownAccount = account?.source === 'admin' && account.backendId === admin?.id ? account : null;
  const user = ownAccount || identity;
  return {
    ...user,
    id: text(admin?.id) || '—',
    name: user.name, email: user.email,
    // These fields have no documented admin read contract. A general user
    // profile, permission inferred from a role, or browser data is not a substitute.
    phone: null, location: null, department: '—', entity: '—', permissionsCaption: '—',
    online: null, twoFactor: null, loginNotifications: null,
    passwordLastChanged: '—', passwordStrengthPct: null, passwordStrength: '—',
    emailVerified: null, phoneVerified: null, failedLogins: null, totalLogins: null, activeSessions: null,
    lastSignIn: ownAccount?.lastActive || '—',
    session: { device: '—', location: '—', ip: '—', status: '—' },
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

export const profileUnavailable = (action) => window.alert(`${action} is not supported by the documented admin profile API.`);
