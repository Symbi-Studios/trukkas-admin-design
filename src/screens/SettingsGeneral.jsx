'use client';

import { useState } from 'react';
import { Button } from '../ds.js';
import { SettingsTextField as TextField, SettingsSelect as Select, SettingsSwitch as Switch, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { SettingsSystemLogsDialog } from './SettingsActionDialogs.jsx';

import { systemStatus as systemStatusTemplate } from '../mock/fixtures/settings.js';

import { SettingsSectionHeader, SettingsPanelLoading, SettingsStatusCard, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

const TIMEZONES = ['(GMT+01:00) Lagos, Nigeria', '(GMT+00:00) Accra, Ghana', '(GMT+03:00) Nairobi, Kenya', '(GMT+02:00) Johannesburg, South Africa'];
const LANGUAGES = ['English (EN)', 'French (FR)', 'Portuguese (PT)'];

function ToggleGrid({ items, onToggle, visible }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px 20px' }}>
      {items.filter((it) => visible(it.key)).map((it) => (
        <Switch key={it.key} checked={it.value} onChange={(v) => onToggle(it.key, v)}
          label={it.label} hint={it.hint} />
      ))}
    </div>
  );
}

export function SettingsGeneral() {
  const editor = useSettingsEditor('general');
  const [logsAdmin, setLogsAdmin] = useState(null);
  const updatePlatformInfo = editor.change('settingsPlatformInfo');
  const updateNotificationGeneral = editor.change('settingsNotificationGeneral');
  const systemStatus = editor.status(systemStatusTemplate);
  const platformInfo = editor.group('settingsPlatformInfo');
  const notif = editor.group('settingsNotificationGeneral');

  if (editor.loading) return <SettingsPanelLoading />;
  if (!platformInfo || !notif) return null;

  function resetAll() {
    if (window.confirm('Reset every settings tab to its default values? This cannot be undone.')) editor.resetAll();
  }

  return (
    <>
      <SettingsSectionHeader title="Platform"
        description="Platform details, system notifications and system status."
        actions={<>
          <Button variant="outline" icon="file-text" onClick={() => setLogsAdmin(editor.admin)}>System Logs</Button>
          <Button variant="outline" icon="rotate-ccw" onClick={resetAll}>Reset All Settings</Button>
        </>} />
      <SettingsReadNotice error={editor.error} />

      <SettingsGrid>
        {editor.groupVisible('settingsPlatformInfo') && (<SettingsCard title="Platform Information"
          description="Basic information about your Trukkas platform." save={<SettingsCardSave editor={editor} group="settingsPlatformInfo" />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {editor.visible('settingsPlatformInfo', 'platformName') && (<TextField label="Platform Name" value={platformInfo.platformName}
              onChange={(e) => updatePlatformInfo({ platformName: e.target.value })} />) }
            {editor.visible('settingsPlatformInfo', 'companyEmail') && (<TextField label="Company Email" value={platformInfo.companyEmail}
              onChange={(e) => updatePlatformInfo({ companyEmail: e.target.value })} />) }
            {editor.visible('settingsPlatformInfo', 'timezone') && (<Select label="Timezone" options={TIMEZONES} value={platformInfo.timezone}
              onChange={(e) => updatePlatformInfo({ timezone: e.target.value })} />) }
            {editor.visible('settingsPlatformInfo', 'website') && (<TextField label="Website" value={platformInfo.website}
              onChange={(e) => updatePlatformInfo({ website: e.target.value })} />) }
            {editor.visible('settingsPlatformInfo', 'phoneNumber') && (<TextField label="Phone Number" value={platformInfo.phoneNumber}
              onChange={(e) => updatePlatformInfo({ phoneNumber: e.target.value })} />) }
            {editor.visible('settingsPlatformInfo', 'defaultLanguage') && (<Select label="Default Language" options={LANGUAGES} value={platformInfo.defaultLanguage}
              onChange={(e) => updatePlatformInfo({ defaultLanguage: e.target.value })} />) }
          </div>
        </SettingsCard>) }

        {editor.groupVisible('settingsNotificationGeneral') && (<SettingsCard title="System Notifications"
          description="Platform-wide notifications sent to users." save={<SettingsCardSave editor={editor} group="settingsNotificationGeneral" />}>
          <ToggleGrid visible={(key) => editor.visible('settingsNotificationGeneral', key)} onToggle={(key, v) => updateNotificationGeneral({ [key]: v })} items={[
            { key: 'emailNotifications', value: notif.emailNotifications, label: 'Email Notifications', hint: 'Send system emails to users.' },
            { key: 'smsNotifications', value: notif.smsNotifications, label: 'SMS Notifications', hint: 'Send SMS alerts for key events.' },
            { key: 'inAppNotifications', value: notif.inAppNotifications, label: 'In-App Notifications', hint: 'Show in-app notifications.' },
            { key: 'jobAlerts', value: notif.jobAlerts, label: 'Job Alerts', hint: 'Notify relevant parties about new jobs.' },
            { key: 'payoutNotifications', value: notif.payoutNotifications, label: 'Payout Notifications', hint: 'Notify users about payout status.' },
            { key: 'incidentAlerts', value: notif.incidentAlerts, label: 'Incident Alerts', hint: 'Notify about incidents and exceptions.' },
            { key: 'pushNotificationsEnabled', value: notif.pushNotificationsEnabled, label: 'Push Notifications', hint: 'Send mobile push notifications. Turning this off does not affect in-app notifications or email.' },
          ]} />
        </SettingsCard>) }

        <SettingsStatusCard title="System Status" headline={systemStatus.headline} caption={systemStatus.lastChecked}
          items={systemStatus.items.map((i) => ({ label: i.label, status: i.status }))} />
      </SettingsGrid>
      {logsAdmin && logsAdmin === editor.admin && editor.authenticated && <SettingsSystemLogsDialog admin={logsAdmin} onClose={() => setLogsAdmin(null)} />}
    </>
  );
}
