'use client';

import { useState } from 'react';
import { Button, Icon } from '../ds.js';
import { SettingsTextField as TextField, SettingsSelect as Select, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { SettingsEventsDialog, SettingsPasswordDialog } from './SettingsActionDialogs.jsx';
import { SettingsTwoFactorDialog } from './SettingsTwoFactorDialog.jsx';

import { DIGEST_FREQUENCIES, securityAlertEvents as securityAlertControls } from '../mock/fixtures/settings.js';

import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

function AlertEventRow({ event, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1.1fr) 56px 56px 56px minmax(180px, 1.3fr)',
                 alignItems: 'center', gap: 10, padding: '11px 4px', borderBottom: '1px solid var(--tk-line)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                      color: 'var(--tk-blue)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
          <Icon name={event.icon} size={13} />
        </span>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{event.label}</span>
      </span>
      <span style={{ display: 'grid', justifyItems: 'center' }}>
        <Switch checked={event.inApp} onChange={(v) => onToggle('inApp', v)} />
      </span>
      <span style={{ display: 'grid', justifyItems: 'center' }}>
        <Switch checked={event.email} onChange={(v) => onToggle('email', v)} />
      </span>
      <span style={{ display: 'grid', justifyItems: 'center' }}>
        <Switch checked={event.sms} onChange={(v) => onToggle('sms', v)} />
      </span>
      <span className="tk-meta">{event.description}</span>
    </div>
  );
}

export function SettingsSecurityAlerts() {
  const editor = useSettingsEditor('security-alerts');
  const [dialog, setDialog] = useState(null);
  const toggleSecurityAlertChannel = (key, channel, value) => editor.changeEvent(securityAlertControls.find(event => event.key === key), channel, value);
  const updateAlertDelivery = editor.change('settingsAlertDelivery');
  const updateSecurityAlertsQuietHours = editor.change('settingsSecurityAlertsQuietHours');
  const resetSecurityAlertsSettings = () => editor.reset();
  const events = securityAlertControls.filter(({ key }) => editor.eventAvailable(key)).map(({ key, icon, label, description }) => ({ key, icon, label, description, ...editor.event({ key, label }) }));
  const delivery = editor.group('settingsAlertDelivery');
  const quiet = editor.group('settingsSecurityAlertsQuietHours');
  const meta = editor.group('settingsMeta');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!delivery || !quiet) return null;


  return (
    <>
      <SettingsSectionHeader title="Security Alerts"
        description="Get notified about important security events to keep your account and data safe."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetSecurityAlertsSettings()}>Reset to Default</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        <SettingsCard description="Choose which security events you want to be notified about and how." title="Security Alert Preferences" save={<SettingsCardSave editor={editor} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1.1fr) 56px 56px 56px minmax(180px, 1.3fr)',
                       gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--tk-line)' }}>
            <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>Security Event</span>
            <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)', textAlign: 'center' }}>In-App</span>
            <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)', textAlign: 'center' }}>Email</span>
            <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)', textAlign: 'center' }}>SMS</span>
            <span style={{ font: '600 12px/16px var(--tk-font-sans)', color: 'var(--tk-ink-400)' }}>Description</span>
          </div>
          {events.map((ev) => (
            <AlertEventRow key={ev.key} event={ev}
              onToggle={(channel, v) => toggleSecurityAlertChannel(ev.key, channel, v)} />
          ))}
        </SettingsCard>

        {editor.groupVisible('settingsAlertDelivery') && (<SettingsCard description="Configure how and when you receive security alerts." title="Alert Delivery Settings" save={<SettingsCardSave editor={editor} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {editor.visible('settingsAlertDelivery', 'emailForSecurityAlerts') && (<TextField label="Email for security alerts" type="email" value={delivery.emailForSecurityAlerts}
                onChange={(e) => updateAlertDelivery({ emailForSecurityAlerts: e.target.value })} />) }
              <span className="tk-meta">Security alerts will be sent to this email address.</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {editor.visible('settingsAlertDelivery', 'phoneForSmsAlerts') && (<TextField label="Phone number for SMS alerts" value={delivery.phoneForSmsAlerts}
                onChange={(e) => updateAlertDelivery({ phoneForSmsAlerts: e.target.value })} />) }
              <span className="tk-meta">Receive security alerts via SMS.</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {editor.visible('settingsAlertDelivery', 'digestFrequency') && (<Select label="Digest frequency (optional)" options={DIGEST_FREQUENCIES} value={delivery.digestFrequency}
                onChange={(e) => updateAlertDelivery({ digestFrequency: e.target.value })} />) }
              <span className="tk-meta">Choose how often to receive non-critical alerts.</span>
            </div>
          </div>
        </SettingsCard>) }

        {editor.groupVisible('settingsSecurityAlertsQuietHours') && (<SettingsCard description="Pause non-critical security alerts during specific hours." title="Quiet Hours" save={<SettingsCardSave editor={editor} />}>
          <div style={{ marginBottom: 14 }}>
            {editor.visible('settingsSecurityAlertsQuietHours', 'enabled') && (<Switch checked={quiet.enabled} label="Enable quiet hours"
              hint="You will still receive critical alerts (e.g. failed logins, suspicious activity)."
              onChange={(v) => updateSecurityAlertsQuietHours({ enabled: v })} />) }
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
            {editor.visible('settingsSecurityAlertsQuietHours', 'from') && (<TextField label="From" value={quiet.from} suffix={<Icon name="clock" size={15} color="var(--tk-ink-300)" />}
              onChange={(e) => updateSecurityAlertsQuietHours({ from: e.target.value })} />) }
            {editor.visible('settingsSecurityAlertsQuietHours', 'to') && (<TextField label="To" value={quiet.to} suffix={<Icon name="clock" size={15} color="var(--tk-ink-300)" />}
              onChange={(e) => updateSecurityAlertsQuietHours({ to: e.target.value })} />) }
          </div>
        </SettingsCard>) }
      </SettingsGrid>
      {dialog && dialog.admin === editor.admin && dialog.kind === 'events' && <SettingsEventsDialog admin={editor.admin} type={dialog.type} onClose={() => setDialog(null)} />}
      {dialog && dialog.admin === editor.admin && dialog.kind === 'password' && <SettingsPasswordDialog admin={editor.admin} onClose={() => setDialog(null)} />}
      {dialog && dialog.admin === editor.admin && dialog.kind === 'two-factor' && <SettingsTwoFactorDialog admin={editor.admin} onClose={() => setDialog(null)} />}
    </>
  );
}
