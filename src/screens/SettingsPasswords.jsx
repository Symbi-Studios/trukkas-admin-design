'use client';

import { useState } from 'react';
import { Button, Avatar, DataTable, Pagination } from '../ds.js';
import { SettingsTextField as TextField, SettingsSwitch as Switch, SettingsCheckbox as Checkbox, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { useGetAdminSettingsSessionsQuery } from '../store/features/settings/settingsApi.js';
import { SettingsSessionReasonDialog } from './SettingsActionDialogs.jsx';
import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsPasswords() {
  const editor = useSettingsEditor('passwords');
  const updatePasswordRequirements = editor.change('settingsPasswordRequirements');
  const updateSessionSettings = editor.change('settingsSessionSettings');
  const updateLoginNotifications = editor.change('settingsLoginNotifications');
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionDialog, setSessionDialog] = useState(null);
  const sessionsQuery = useGetAdminSettingsSessionsQuery({ owner: editor.owner, page: sessionPage, limit: 5 }, { skip: !editor.authenticated, refetchOnMountOrArgChange: true });
  const sessionData = sessionsQuery.error ? null : sessionsQuery.currentData;
  const terminateSession = (id) => {
    const session = sessionData?.rows.find((row) => row.id === id);
    if (session?.status !== 'ACTIVE') { editor.unavailable('Terminating this unconfirmed active session'); return; }
    setSessionDialog({ admin: editor.admin, session });
  };
  const resetPasswordSettings = () => editor.reset();
  const resetAllUserSessions = () => {
    if (editor.admin?.role !== 'SUPER_ADMIN') { window.alert('Only Super Admins can terminate all app-user sessions.'); return; }
    setSessionDialog({ admin: editor.admin, all: true });
  };
  const activeSessionsTotal = sessionData?.total ?? null;
  const req = editor.group('settingsPasswordRequirements');
  const sessionSettings = editor.group('settingsSessionSettings');
  const loginNotif = editor.group('settingsLoginNotifications');
  const sessions = sessionData?.rows || [];
  const meta = editor.group('settingsMeta');

  if (editor.loading || sessionsQuery.isLoading || (sessionsQuery.isFetching && !sessionsQuery.currentData)) return <SettingsPanelLoading />;
  if (!req || !sessionSettings || !loginNotif) return null;


  return (
    <>
      <SettingsSectionHeader title="Passwords & Sessions"
        description="Manage password requirements, user sessions, and login behavior for a secure platform."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetPasswordSettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error || sessionsQuery.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsPasswordRequirements') && (<SettingsCard description="Set password rules and complexity requirements for all users." title="Password Requirements" save={<SettingsCardSave editor={editor} group="settingsPasswordRequirements" />}>
          {editor.visible('settingsPasswordRequirements', 'minPasswordLength') && (<Field><TextField label="Minimum password length" type="number" value={req.minPasswordLength}
            suffix={<span className="tk-meta">characters</span>}
            onChange={(e) => updatePasswordRequirements({ minPasswordLength: e.target.value })} /></Field>) }
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            {editor.visible('settingsPasswordRequirements', 'requireUppercase') && (<Checkbox checked={req.requireUppercase} label="Require at least one uppercase letter (A–Z)"
              onChange={(v) => updatePasswordRequirements({ requireUppercase: v })} />) }
            {editor.visible('settingsPasswordRequirements', 'requireLowercase') && (<Checkbox checked={req.requireLowercase} label="Require at least one lowercase letter (a–z)"
              onChange={(v) => updatePasswordRequirements({ requireLowercase: v })} />) }
            {editor.visible('settingsPasswordRequirements', 'requireNumber') && (<Checkbox checked={req.requireNumber} label="Require at least one number (0–9)"
              onChange={(v) => updatePasswordRequirements({ requireNumber: v })} />) }
            {editor.visible('settingsPasswordRequirements', 'requireSpecialChar') && (<Checkbox checked={req.requireSpecialChar} label="Require at least one special character (!@#$…)"
              onChange={(v) => updatePasswordRequirements({ requireSpecialChar: v })} />) }
            {editor.visible('settingsPasswordRequirements', 'preventCommonPasswords') && (<Checkbox checked={req.preventCommonPasswords} label="Prevent use of common passwords (e.g. password123, Trukkas2024)"
              onChange={(v) => updatePasswordRequirements({ preventCommonPasswords: v })} />) }
            {editor.visible('settingsPasswordRequirements', 'preventPreviousPasswords') && (<Checkbox checked={req.preventPreviousPasswords} label="Prevent use of previous passwords"
              onChange={(v) => updatePasswordRequirements({ preventPreviousPasswords: v })} />) }
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
            {editor.visible('settingsPasswordRequirements', 'passwordHistory') && (<TextField label="Password history" type="number" value={req.passwordHistory}
              hint="Number of previous passwords to remember and prevent reuse."
              onChange={(e) => updatePasswordRequirements({ passwordHistory: e.target.value })} />) }
            {editor.visible('settingsPasswordRequirements', 'passwordExpiryDays') && (<TextField label="Password expiry (days)" type="number" value={req.passwordExpiryDays}
              hint="Require users to change their password after this period."
              onChange={(e) => updatePasswordRequirements({ passwordExpiryDays: e.target.value })} />) }
          </div>
          {editor.visible('settingsPasswordRequirements', 'notifyBeforePasswordExpiry') && (<Switch checked={req.notifyBeforePasswordExpiry} label="Notify users before password expiry"
            hint="Send reminder emails 7 days before expiry."
            onChange={(v) => updatePasswordRequirements({ notifyBeforePasswordExpiry: v })} />) }
        </SettingsCard>) }

        <SettingsCard title="Active Sessions" pad="none" className="tk-settings-wide"
          description="View and manage all active user sessions across the platform."
          action={<Button size="sm" variant="outline" icon="log-out" onClick={resetAllUserSessions}>Sign Out All Users</Button>}>
          <DataTable rows={sessions} rowKey={(r) => r.id}
            columns={[
              { key: 'user', header: 'User', render: (r) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.name} size={32} />
                  <span style={{ display: 'grid', gap: 1 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{r.name}</span>
                    <span className="tk-meta">{r.role}</span>
                  </span>
                </span>) },
              { key: 'device', header: 'Device', render: (r) => (
                <span style={{ display: 'grid', gap: 1 }}>
                  <span>{r.device}</span>
                  <span className="tk-meta">{r.client}</span>
                </span>) },
              { key: 'location', header: 'Location' },
              { key: 'ip', header: 'IP Address', render: (r) => <span className="tk-mono">{r.ip}</span> },
              { key: 'lastActive', header: 'Last Active' },
              { key: 'actions', header: 'Actions', render: (r) => (
                <Button variant="danger" size="sm" onClick={() => terminateSession(r.id)}>Terminate</Button>) },
            ]} />
          {activeSessionsTotal ?? '—'}
          <Pagination page={sessionPage} pageSize={5} total={activeSessionsTotal} pageCount={sessionData?.pageCount ?? null} onPage={setSessionPage} />
        </SettingsCard>
        
        {editor.groupVisible('settingsSessionSettings') && (<SettingsCard description="Configure user session behavior and inactivity rules." title="Session Settings" save={<SettingsCardSave editor={editor} group="settingsSessionSettings" />}>
          {editor.visible('settingsSessionSettings', 'sessionTimeoutMinutes') && (<Field><TextField label="Session timeout (minutes)" type="number" value={sessionSettings.sessionTimeoutMinutes}
            hint="Automatically log out users after this period of inactivity."
            onChange={(e) => updateSessionSettings({ sessionTimeoutMinutes: e.target.value })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'maxConcurrentSessions') && (<Field><TextField label="Maximum concurrent sessions" type="number" value={sessionSettings.maxConcurrentSessions}
            hint="Limit the number of active sessions per user."
            onChange={(e) => updateSessionSettings({ maxConcurrentSessions: e.target.value })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'showActiveSessionsToUsers') && (<Field><Switch checked={sessionSettings.showActiveSessionsToUsers} label="Show active sessions to users"
            hint="Allow users to view and manage their active sessions."
            onChange={(v) => updateSessionSettings({ showActiveSessionsToUsers: v })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'allowUsersTerminateOtherSessions') && (<Field><Switch checked={sessionSettings.allowUsersTerminateOtherSessions} label="Allow users to terminate other sessions"
            hint="Users can log out of other devices remotely."
            onChange={(v) => updateSessionSettings({ allowUsersTerminateOtherSessions: v })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'rememberMePersistentLogin') && (<Field><Switch checked={sessionSettings.rememberMePersistentLogin} label="Remember me (persistent login)"
            hint="Allow users to stay signed in for 30 days (on trusted devices)."
            onChange={(v) => updateSessionSettings({ rememberMePersistentLogin: v })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'persistentLoginDurationDays') && (<Field><TextField label="Persistent login duration (days)" type="number" value={sessionSettings.persistentLoginDurationDays}
            hint="How long to keep users signed in when 'Remember me' is enabled."
            onChange={(e) => updateSessionSettings({ persistentLoginDurationDays: e.target.value })} /></Field>) }
          {editor.visible('settingsSessionSettings', 'terminateAllSessionsOnPasswordChange') && (<Switch checked={sessionSettings.terminateAllSessionsOnPasswordChange} label="Terminate all sessions on password change"
            hint="Automatically log out all devices when password is changed."
            onChange={(v) => updateSessionSettings({ terminateAllSessionsOnPasswordChange: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsLoginNotifications') && (<SettingsCard description="Get notified of new logins and suspicious activity." title="Login Notifications" save={<SettingsCardSave editor={editor} group="settingsLoginNotifications" />}>
          {editor.visible('settingsLoginNotifications', 'emailNotificationNewDeviceLogin') && (<Field><Switch checked={loginNotif.emailNotificationNewDeviceLogin} label="Email notification for new device login"
            hint="Notify when a user logs in from a new device or location."
            onChange={(v) => updateLoginNotifications({ emailNotificationNewDeviceLogin: v })} /></Field>) }
          {editor.visible('settingsLoginNotifications', 'emailNotificationMultipleFailedAttempts') && (<Field><Switch checked={loginNotif.emailNotificationMultipleFailedAttempts} label="Email notification for multiple failed attempts"
            hint="Notify after 5 failed login attempts."
            onChange={(v) => updateLoginNotifications({ emailNotificationMultipleFailedAttempts: v })} /></Field>) }
          {editor.visible('settingsLoginNotifications', 'notifyAccountOwnerOnSessionTermination') && (<Switch checked={loginNotif.notifyAccountOwnerOnSessionTermination} label="Notify account owner on session termination"
            hint="Send an email when a session is terminated remotely."
            onChange={(v) => updateLoginNotifications({ notifyAccountOwnerOnSessionTermination: v })} />) }
        </SettingsCard>) }
      </SettingsGrid>
      {sessionDialog && sessionDialog.admin === editor.admin && <SettingsSessionReasonDialog admin={editor.admin} session={sessionDialog.session} all={sessionDialog.all} onClose={() => setSessionDialog(null)} onSaved={() => { void sessionsQuery.refetch(); }} />}
    </>
  );
}
