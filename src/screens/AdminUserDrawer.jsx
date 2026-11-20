'use client';
import { SideDrawer, DrawerSection, DrawerFacts, Avatar, Badge, Tag, Button, IconButton, Skeleton, Banner, ActivityFeed } from '../ds.js';
import { useGetManagedUserProfileQuery, useGetManagedUserActivityQuery } from '../store/features/users/usersApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

const STATUS_TONE = { Active: 'success', Inactive: 'neutral', Locked: 'danger', Revoked: 'warning' };
const yesNo = (value) => value == null ? '—' : value ? 'Enabled' : 'Off';
const num = (value) => value ?? '—';

/** Quick-look drawer for an admin dashboard account, opened from a User Management row. */
export function AdminUserDrawer({ user: row, owner, isSelf, onClose, onOpen, onEdit, onResetPassword, onAccess }) {
  const profileQuery = useGetManagedUserProfileQuery({ id: row.backendId, source: 'admin', owner }, { refetchOnMountOrArgChange: true });
  const activityQuery = useGetManagedUserActivityQuery({ id: row.backendId, source: 'admin', owner }, { refetchOnMountOrArgChange: true });
  // The list row is enough to render the header straight away; the profile fills in security details.
  const u = profileQuery.error ? row : profileQuery.currentData || row;
  const loadingProfile = profileQuery.isFetching && !profileQuery.currentData;
  const revoked = u.statusCode === 'REVOKED';
  const security = (value) => loadingProfile ? <Skeleton as="span" width={72} height={14} /> : value;
  const activity = activityQuery.error ? [] : (activityQuery.currentData || []).map((item) => ({ ...item, actor: null }));

  return (
    <SideDrawer
      label="Admin user details"
      eyebrow="Admin user"
      onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Avatar name={u.name} src={u.profileImageUrl} size={40} />
        <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <h2 className="tk-title" style={{ fontSize: 20, overflowWrap: 'anywhere' }}>{u.name}</h2>
          <span className="tk-meta" style={{ overflowWrap: 'anywhere' }}>{u.email}</span>
        </span>
      </span>}
      meta={<>
        <Badge tone={u.roleTone}>{u.role}</Badge>
        <Badge tone={STATUS_TONE[u.status] || 'neutral'} dot>{u.status}</Badge>
        {isSelf && <Tag tone="blue">You</Tag>}
      </>}
      headerActions={<IconButton icon="maximize-2" label="Open full profile" onClick={onOpen} />}
      footer={<>
        <div className="tk-drawer-footer-row">
          <Button variant="outline" icon="pencil" onClick={() => onEdit(u)}>Edit</Button>
          <Button variant="outline" icon="rotate-ccw" onClick={() => onResetPassword(u)}>Reset Password</Button>
          {!isSelf && (revoked
            ? <Button variant="outline" icon="lock-open" onClick={() => onAccess(u, 'unlock')}>Restore Access</Button>
            : <Button variant="danger" icon="lock" onClick={() => onAccess(u, 'lock')}>Revoke Access</Button>)}
        </div>
      </>}
    >
      {profileQuery.error && <Banner tone="warning" title={getApiErrorMessage(profileQuery.error)}
        action={<Button size="sm" variant="outline" onClick={profileQuery.refetch}>Retry</Button>} />}

      <DrawerSection title="Account">
        <DrawerFacts items={[
          { label: 'Email', value: u.email, wide: true },
          { label: 'Role', value: u.role },
          { label: 'Status', value: u.status },
          { label: 'Joined', value: u.joinedOn },
          { label: 'Last active', value: u.lastActive },
        ]} />
      </DrawerSection>

      <DrawerSection title="Security">
        <DrawerFacts items={[
          { label: 'Two-factor auth', value: security(yesNo(u.twoFactor)) },
          { label: 'Active sessions', value: security(num(u.activeSessions)) },
          { label: 'Last login', value: security(u.lastLogin ?? '—'), sub: !loadingProfile && u.lastLoginDetail !== '—' ? u.lastLoginDetail : undefined, wide: true },
          { label: 'Password changed', value: security(u.passwordLastChanged ?? '—') },
          { label: 'Failed logins', value: security(num(u.failedLogins)) },
        ]} />
      </DrawerSection>

      <DrawerSection title="Recent activity">
        {activityQuery.isFetching && !activityQuery.currentData ? <Skeleton height={120} />
          : activityQuery.error ? <Banner tone="warning" title="Unable to load recent activity." action={<Button size="sm" variant="outline" onClick={activityQuery.refetch}>Retry</Button>} />
          : activity.length ? <ActivityFeed items={activity} />
          : <span className="tk-meta">No activity recorded yet.</span>}
        <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={onOpen} style={{ justifySelf: 'start', marginTop: 8 }}>View full profile</Button>
      </DrawerSection>
    </SideDrawer>
  );
}
