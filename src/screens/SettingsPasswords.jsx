'use client';

import { useState } from 'react';
import {
  PageHeader, Button, SectionCard, TextField, Switch, Checkbox, Avatar, DataTable, Pagination,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import { activeSessionsTotal } from '../mock/fixtures/settings.js';
import {
  updatePasswordRequirements, updateSessionSettings, updateLoginNotifications, terminateSession,
  savePasswordSettings, resetPasswordSettings, resetAllUserSessions,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsDangerZone, SettingsMetaFooter } from './settingsShared.jsx';

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsPasswords() {
  const req = useCollection('settingsPasswordRequirements')?.[0];
  const sessionSettings = useCollection('settingsSessionSettings')?.[0];
  const loginNotif = useCollection('settingsLoginNotifications')?.[0];
  const sessions = useCollection('settingsActiveSessions') || [];
  const meta = useCollection('settingsMeta')?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!req || !sessionSettings || !loginNotif) return null;

  async function handleSave() {
    setSaving(true);
    await savePasswordSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Passwords']} title="Password & Sessions"
        description="Manage password requirements, user sessions, and login behavior for a secure platform."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetPasswordSettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
      <SettingsTabStrip active="passwords" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Password Requirements" icon="lock">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set password rules and complexity requirements for all users.</span>
            <Field><TextField label="Minimum password length" type="number" value={req.minPasswordLength}
              suffix={<span className="tk-meta">characters</span>}
              onChange={(e) => updatePasswordRequirements({ minPasswordLength: Number(e.target.value) })} /></Field>
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              <Checkbox checked={req.requireUppercase} label="Require at least one uppercase letter (A–Z)"
                onChange={(v) => updatePasswordRequirements({ requireUppercase: v })} />
              <Checkbox checked={req.requireLowercase} label="Require at least one lowercase letter (a–z)"
                onChange={(v) => updatePasswordRequirements({ requireLowercase: v })} />
              <Checkbox checked={req.requireNumber} label="Require at least one number (0–9)"
                onChange={(v) => updatePasswordRequirements({ requireNumber: v })} />
              <Checkbox checked={req.requireSpecialChar} label="Require at least one special character (!@#$…)"
                onChange={(v) => updatePasswordRequirements({ requireSpecialChar: v })} />
              <Checkbox checked={req.preventCommonPasswords} label="Prevent use of common passwords (e.g. password123, Trukkas2024)"
                onChange={(v) => updatePasswordRequirements({ preventCommonPasswords: v })} />
              <Checkbox checked={req.preventPreviousPasswords} label="Prevent use of previous passwords"
                onChange={(v) => updatePasswordRequirements({ preventPreviousPasswords: v })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <TextField label="Password history" type="number" value={req.passwordHistory}
                hint="Number of previous passwords to remember and prevent reuse."
                onChange={(e) => updatePasswordRequirements({ passwordHistory: Number(e.target.value) })} />
              <TextField label="Password expiry (days)" type="number" value={req.passwordExpiryDays}
                hint="Require users to change their password after this period."
                onChange={(e) => updatePasswordRequirements({ passwordExpiryDays: Number(e.target.value) })} />
            </div>
            <Switch checked={req.notifyBeforePasswordExpiry} label="Notify users before password expiry"
              hint="Send reminder emails 7 days before expiry."
              onChange={(v) => updatePasswordRequirements({ notifyBeforePasswordExpiry: v })} />
          </SectionCard>

          <SectionCard title="Active Sessions" icon="users-round" pad="none">
            <div style={{ padding: '16px var(--tk-card-pad) 0' }}>
              <span className="tk-meta">View and manage all active user sessions across the platform.</span>
            </div>
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
            <Pagination page={1} pageSize={5} total={activeSessionsTotal} pageCount={3} onPage={() => {}} />
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Session Settings" icon="monitor-smartphone">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure user session behavior and inactivity rules.</span>
            <Field><TextField label="Session timeout (minutes)" type="number" value={sessionSettings.sessionTimeoutMinutes}
              hint="Automatically log out users after this period of inactivity."
              onChange={(e) => updateSessionSettings({ sessionTimeoutMinutes: Number(e.target.value) })} /></Field>
            <Field><TextField label="Maximum concurrent sessions" type="number" value={sessionSettings.maxConcurrentSessions}
              hint="Limit the number of active sessions per user."
              onChange={(e) => updateSessionSettings({ maxConcurrentSessions: Number(e.target.value) })} /></Field>
            <Field><Switch checked={sessionSettings.showActiveSessionsToUsers} label="Show active sessions to users"
              hint="Allow users to view and manage their active sessions."
              onChange={(v) => updateSessionSettings({ showActiveSessionsToUsers: v })} /></Field>
            <Field><Switch checked={sessionSettings.allowUsersTerminateOtherSessions} label="Allow users to terminate other sessions"
              hint="Users can log out of other devices remotely."
              onChange={(v) => updateSessionSettings({ allowUsersTerminateOtherSessions: v })} /></Field>
            <Field><Switch checked={sessionSettings.rememberMePersistentLogin} label="Remember me (persistent login)"
              hint="Allow users to stay signed in for 30 days (on trusted devices)."
              onChange={(v) => updateSessionSettings({ rememberMePersistentLogin: v })} /></Field>
            <TextField label="Persistent login duration (days)" type="number" value={sessionSettings.persistentLoginDurationDays}
              hint="How long to keep users signed in when 'Remember me' is enabled."
              onChange={(e) => updateSessionSettings({ persistentLoginDurationDays: Number(e.target.value) })} />
          </SectionCard>

          <SectionCard title="Login Notifications" icon="bell">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Get notified of new logins and suspicious activity.</span>
            <Field><Switch checked={loginNotif.emailNotificationNewDeviceLogin} label="Email notification for new device login"
              hint="Notify when a user logs in from a new device or location."
              onChange={(v) => updateLoginNotifications({ emailNotificationNewDeviceLogin: v })} /></Field>
            <Field><Switch checked={loginNotif.emailNotificationMultipleFailedAttempts} label="Email notification for multiple failed attempts"
              hint="Notify after 5 failed login attempts."
              onChange={(v) => updateLoginNotifications({ emailNotificationMultipleFailedAttempts: v })} /></Field>
            <Switch checked={loginNotif.notifyAccountOwnerOnSessionTermination} label="Notify account owner on session termination"
              hint="Send an email when a session is terminated remotely."
              onChange={(v) => updateLoginNotifications({ notifyAccountOwnerOnSessionTermination: v })} />
          </SectionCard>

          <SettingsDangerZone title="Reset All User Sessions" hint="Log out all users from all devices immediately."
            onConfirm={() => resetAllUserSessions()} />
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
