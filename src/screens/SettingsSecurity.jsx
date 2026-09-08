'use client';

import { useState } from 'react';
import { PageHeader, Button, SectionCard, TextField, Select, Textarea, Switch, Icon, QuickActionsCard } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  ACCESS_CONTROL_OPTIONS, securityStatus, recentSecurityEvents, securityQuickActions,
} from '../mock/fixtures/settings.js';
import {
  updateAuthSettings, updatePasswordPolicyOverview, updateSessionManagementOverview,
  updateIpDeviceRestrictionsOverview, updateDataProtectionOverview, updateSecurityAlertsOverview,
  saveSecuritySettings, resetSecuritySettings,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsDangerZone, SettingsMetaFooter } from './settingsShared.jsx';

const PASSWORD_RULES = [
  'Require at least one uppercase letter (A–Z)',
  'Require at least one lowercase letter (a–z)',
  'Require at least one number (0-9)',
  'Require at least one special character (!@#$…)',
];

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsSecurity() {
  const auth = useCollection('settingsAuth')?.[0];
  const passwordPolicy = useCollection('settingsPasswordPolicyOverview')?.[0];
  const sessionMgmt = useCollection('settingsSessionManagementOverview')?.[0];
  const ipRestrictions = useCollection('settingsIpDeviceRestrictionsOverview')?.[0];
  const dataProtection = useCollection('settingsDataProtectionOverview')?.[0];
  const securityAlerts = useCollection('settingsSecurityAlertsOverview')?.[0];
  const meta = useCollection('settingsMeta')?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!auth || !passwordPolicy || !sessionMgmt || !ipRestrictions || !dataProtection || !securityAlerts) return null;

  async function handleSave() {
    setSaving(true);
    await saveSecuritySettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Security']} title="Security Settings"
        description="Manage access, authentication, and system security to keep your operations safe and compliant."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetSecuritySettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
      <SettingsTabStrip active="security" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Authentication Settings" icon="lock">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure how users authenticate and access the platform.</span>
            <Field><Switch checked={auth.requireTwoFactorAuth} label="Require Two-Factor Authentication (2FA)"
              hint="Require 2FA for all users, especially admins."
              onChange={(v) => updateAuthSettings({ requireTwoFactorAuth: v })} /></Field>
            <Field><Switch checked={auth.allowSingleSignOn} label="Allow Single Sign-On (SSO)"
              hint="Enable SAML/SSO for enterprise users."
              onChange={(v) => updateAuthSettings({ allowSingleSignOn: v })} /></Field>
            <Field><Switch checked={auth.enableBiometricLogin} label="Enable biometric login (if available)"
              hint="Allow fingerprint/face ID for supported devices."
              onChange={(v) => updateAuthSettings({ enableBiometricLogin: v })} /></Field>
            <Field><Switch checked={auth.requireEmailVerification} label="Require email verification"
              hint="New users must verify their email before accessing the platform."
              onChange={(v) => updateAuthSettings({ requireEmailVerification: v })} /></Field>
            <Switch checked={auth.allowRememberDevice} label="Allow remember device"
              hint="Let users stay signed in on trusted devices."
              onChange={(v) => updateAuthSettings({ allowRememberDevice: v })} />
          </SectionCard>

          <SectionCard title="Password Policy" icon="key-round">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Set password requirements for all users.</span>
            <Field><TextField label="Minimum password length" type="number" value={passwordPolicy.minPasswordLength}
              suffix={<span className="tk-meta">characters</span>}
              onChange={(e) => updatePasswordPolicyOverview({ minPasswordLength: Number(e.target.value) })} /></Field>
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {PASSWORD_RULES.map((rule) => (
                <div key={rule} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="check" size={14} color="var(--tk-success)" />
                  <span style={{ font: '400 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{rule}</span>
                </div>
              ))}
            </div>
            <Field><TextField label="Password expiry (days)" type="number" value={passwordPolicy.passwordExpiryDays}
              hint="Users will be prompted to change their password after this period."
              onChange={(e) => updatePasswordPolicyOverview({ passwordExpiryDays: Number(e.target.value) })} /></Field>
            <Switch checked={passwordPolicy.preventReuseOfPreviousPasswords} label="Prevent reuse of previous passwords"
              hint="Block users from reusing last 5 passwords."
              onChange={(v) => updatePasswordPolicyOverview({ preventReuseOfPreviousPasswords: v })} />
          </SectionCard>

          <SectionCard title="Session Management" icon="monitor-smartphone">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Control user sessions and inactivity settings.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 14 }}>
              <TextField label="Session timeout (minutes)" type="number" value={sessionMgmt.sessionTimeoutMinutes}
                hint="Automatically log out inactive users."
                onChange={(e) => updateSessionManagementOverview({ sessionTimeoutMinutes: Number(e.target.value) })} />
              <TextField label="Maximum concurrent sessions" type="number" value={sessionMgmt.maxConcurrentSessions}
                hint="Limit the number of active sessions per user."
                onChange={(e) => updateSessionManagementOverview({ maxConcurrentSessions: Number(e.target.value) })} />
            </div>
            <Field><Switch checked={sessionMgmt.showActiveSessionsToUsers} label="Show active sessions to users"
              hint="Allow users to view and manage their active sessions."
              onChange={(v) => updateSessionManagementOverview({ showActiveSessionsToUsers: v })} /></Field>
            <Switch checked={sessionMgmt.terminateAllSessionsOnPasswordChange} label="Terminate all sessions on password change"
              hint="Automatically log out all devices when password is changed."
              onChange={(v) => updateSessionManagementOverview({ terminateAllSessionsOnPasswordChange: v })} />
          </SectionCard>

          <SectionCard title="IP & Device Restrictions" icon="map-pin">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Restrict access from specific IP addresses or devices.</span>
            <Field><Select label="Access control" options={ACCESS_CONTROL_OPTIONS} value={ipRestrictions.accessControl}
              onChange={(e) => updateIpDeviceRestrictionsOverview({ accessControl: e.target.value })} /></Field>
            <Field><Textarea label="Trusted IP addresses (optional)" rows={2} placeholder="e.g. 192.168.1.0/24, 203.0.113.5"
              hint="Enter one IP address or range per line."
              value={ipRestrictions.trustedIpAddresses}
              onChange={(e) => updateIpDeviceRestrictionsOverview({ trustedIpAddresses: e.target.value })} /></Field>
            <Field><Switch checked={ipRestrictions.requireTrustedDevicesForAdmins} label="Require trusted devices for admin users"
              hint="Only allow admin access from recognized devices."
              onChange={(v) => updateIpDeviceRestrictionsOverview({ requireTrustedDevicesForAdmins: v })} /></Field>
            <Switch checked={ipRestrictions.blockSuspiciousIpAddresses} label="Block suspicious IP addresses automatically"
              hint="Automatically block IPs with repeated failed login attempts."
              onChange={(v) => updateIpDeviceRestrictionsOverview({ blockSuspiciousIpAddresses: v })} />
          </SectionCard>

          <SectionCard title="Data Protection" icon="database">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Manage data security and encryption settings.</span>
            <Field><Switch checked={dataProtection.encryptSensitiveData} label="Encrypt sensitive data"
              hint="Encrypt all sensitive data at rest and in transit."
              onChange={(v) => updateDataProtectionOverview({ encryptSensitiveData: v })} /></Field>
            <Field><Switch checked={dataProtection.enableDataMasking} label="Enable data masking"
              hint="Mask personal data in non-production environments."
              onChange={(v) => updateDataProtectionOverview({ enableDataMasking: v })} /></Field>
            <Switch checked={dataProtection.allowDataExport} label="Allow data export"
              hint="Restrict or disable data export for non-admin users."
              onChange={(v) => updateDataProtectionOverview({ allowDataExport: v })} />
          </SectionCard>

          <SectionCard title="Security Alerts" icon="bell">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Get notified about important security events.</span>
            <Field><Switch checked={securityAlerts.emailAlertsFailedLogin} label="Email alerts for failed login attempts"
              hint="Notify admins when there are repeated failed logins."
              onChange={(v) => updateSecurityAlertsOverview({ emailAlertsFailedLogin: v })} /></Field>
            <Field><Switch checked={securityAlerts.emailAlertsNewUserRegistrations} label="Email alerts for new user registrations"
              hint="Notify admins when new accounts are created."
              onChange={(v) => updateSecurityAlertsOverview({ emailAlertsNewUserRegistrations: v })} /></Field>
            <Field><Switch checked={securityAlerts.emailAlertsRoleChanges} label="Email alerts for role changes"
              hint="Notify admins when user roles or permissions change."
              onChange={(v) => updateSecurityAlertsOverview({ emailAlertsRoleChanges: v })} /></Field>
            <Switch checked={securityAlerts.emailAlertsSuspiciousActivity} label="Email alerts for suspicious activity"
              hint="Get notified about unusual or high-risk activity."
              onChange={(v) => updateSecurityAlertsOverview({ emailAlertsSuspiciousActivity: v })} />
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Security Status" icon="shield-check">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14,
                         borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-success-soft)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--tk-success)', flex: '0 0 auto',
                             display: 'grid', placeItems: 'center', marginTop: 1 }}>
                <Icon name="check" size={13} color="#fff" />
              </span>
              <div style={{ display: 'grid', gap: 2 }}>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{securityStatus.headline}</span>
                <span className="tk-meta">{securityStatus.caption}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent Security Events" action={<a href="#">View All</a>}>
            <div style={{ display: 'grid', gap: 14 }}>
              {recentSecurityEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                                color: e.tone, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                    <Icon name={e.icon} size={15} />
                  </span>
                  <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{e.label}</span>
                    <span className="tk-meta">{e.detail}</span>
                    <span className="tk-meta">{e.time} · {e.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <QuickActionsCard items={securityQuickActions} />
          <SettingsDangerZone title="Reset Security Settings" hint="Restore all security settings to system defaults. Use with caution."
            onConfirm={() => resetSecuritySettings()} />
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
