'use client';

import { useState } from 'react';
import { Button, Icon } from '../ds.js';
import { SettingsSelect as Select, SettingsTextarea as Textarea, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { SettingsEventsDialog } from './SettingsActionDialogs.jsx';

import { ACCESS_CONTROL_OPTIONS } from '../mock/fixtures/settings.js';

import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

function Field({ children }) { return <div style={{ marginBottom: 14 }}>{children}</div>; }

export function SettingsSecurity() {
  const editor = useSettingsEditor('security');
  const [dialog, setDialog] = useState(null);
  const openEvents = (type) => setDialog({ admin: editor.admin, kind: 'events', type });
  const updateAuthSettings = editor.change('settingsAuth');
  const updateIpDeviceRestrictionsOverview = editor.change('settingsIpDeviceRestrictionsOverview');
  const resetSecuritySettings = () => editor.reset();
  const recentSecurityEvents = editor.events;
  const auth = editor.group('settingsAuth');
  const ipRestrictions = editor.group('settingsIpDeviceRestrictionsOverview');
  const meta = editor.group('settingsMeta');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!auth || !ipRestrictions) return null;


  return (
    <>
      <SettingsSectionHeader title="Access & Authentication"
        description="Manage access, authentication, and system security to keep your operations safe and compliant."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetSecuritySettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsAuth') && (<SettingsCard description="Configure how users authenticate and access the platform." title="Authentication Settings" save={<SettingsCardSave editor={editor} group="settingsAuth" />}>
          {editor.visible('settingsAuth', 'requireTwoFactorAuth') && (<Field><Switch checked={auth.requireTwoFactorAuth} label="Require Two-Factor Authentication (2FA)"
            hint="Require 2FA for all users, especially admins."
            onChange={(v) => updateAuthSettings({ requireTwoFactorAuth: v })} /></Field>) }
          {editor.visible('settingsAuth', 'allowSingleSignOn') && (<Field><Switch checked={auth.allowSingleSignOn} label="Allow Single Sign-On (SSO)"
            hint="Enable SAML/SSO for enterprise users."
            onChange={(v) => updateAuthSettings({ allowSingleSignOn: v })} /></Field>) }
          {editor.visible('settingsAuth', 'enableBiometricLogin') && (<Field><Switch checked={auth.enableBiometricLogin} label="Enable biometric login (if available)"
            hint="Allow fingerprint/face ID for supported devices."
            onChange={(v) => updateAuthSettings({ enableBiometricLogin: v })} /></Field>) }
          {editor.visible('settingsAuth', 'requireEmailVerification') && (<Field><Switch checked={auth.requireEmailVerification} label="Require email verification"
            hint="New users must verify their email before accessing the platform."
            onChange={(v) => updateAuthSettings({ requireEmailVerification: v })} /></Field>) }
          {editor.visible('settingsAuth', 'allowRememberDevice') && (<Field><Switch checked={auth.allowRememberDevice} label="Allow remember device"
            hint="Let users stay signed in on trusted devices."
            onChange={(v) => updateAuthSettings({ allowRememberDevice: v })} /></Field>) }
          {editor.visible('settingsAuth', 'emailAlertsNewUserRegistrations') && (<Switch checked={auth.emailAlertsNewUserRegistrations} label="Email alerts for new user registrations"
            hint="Notify admins when new accounts are created."
            onChange={(v) => updateAuthSettings({ emailAlertsNewUserRegistrations: v })} />) }
        </SettingsCard>) }

        {editor.groupVisible('settingsIpDeviceRestrictionsOverview') && (<SettingsCard description="Restrict access from specific IP addresses or devices." title="IP & Device Restrictions" save={<SettingsCardSave editor={editor} group="settingsIpDeviceRestrictionsOverview" />}>
          {editor.visible('settingsIpDeviceRestrictionsOverview', 'accessControl') && (<Field><Select label="Access control" options={ACCESS_CONTROL_OPTIONS} value={ipRestrictions.accessControl}
            onChange={(e) => updateIpDeviceRestrictionsOverview({ accessControl: e.target.value })} /></Field>) }
          {editor.visible('settingsIpDeviceRestrictionsOverview', 'trustedIpAddresses') && (<Field><Textarea label="Trusted IP addresses (optional)" rows={2} placeholder="e.g. 192.168.1.0/24, 203.0.113.5"
            hint="Enter one IP address or range per line."
            value={ipRestrictions.trustedIpAddresses}
            onChange={(e) => updateIpDeviceRestrictionsOverview({ trustedIpAddresses: e.target.value })} /></Field>) }
          {editor.visible('settingsIpDeviceRestrictionsOverview', 'requireTrustedDevicesForAdmins') && (<Field><Switch checked={ipRestrictions.requireTrustedDevicesForAdmins} label="Require trusted devices for admin users"
            hint="Only allow admin access from recognized devices."
            onChange={(v) => updateIpDeviceRestrictionsOverview({ requireTrustedDevicesForAdmins: v })} /></Field>) }
          {editor.visible('settingsIpDeviceRestrictionsOverview', 'blockSuspiciousIpAddresses') && (<Switch checked={ipRestrictions.blockSuspiciousIpAddresses} label="Block suspicious IP addresses automatically"
            hint="Automatically block IPs with repeated failed login attempts."
            onChange={(v) => updateIpDeviceRestrictionsOverview({ blockSuspiciousIpAddresses: v })} />) }
        </SettingsCard>) }
        

        <SettingsCard title="Recent Security Events" action={<a href="#" onClick={(event) => { event.preventDefault(); openEvents(); }}>View All</a>}>
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
            {recentSecurityEvents.length ? null : '—'}
          </div>
        </SettingsCard>
      </SettingsGrid>
      {dialog && dialog.admin === editor.admin && dialog.kind === 'events' && <SettingsEventsDialog admin={editor.admin} type={dialog.type} onClose={() => setDialog(null)} />}
    </>
  );
}
