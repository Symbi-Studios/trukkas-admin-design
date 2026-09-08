'use client';

import { useState } from 'react';
import {
  PageHeader, Button, SectionCard, TextField, Select, Switch, QuickActionsCard, Logo,
} from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  systemStatus, platformVersion, generalQuickActions,
} from '../mock/fixtures/settings.js';
import { updatePlatformInfo, updateOperationalGeneral, updateNotificationGeneral, resetPlatformSettings } from '../mock/api.js';
import { SettingsTabStrip, SettingsStatusCard, SettingsDangerZone } from './settingsShared.jsx';

const TIMEZONES = ['(GMT+01:00) Lagos, Nigeria', '(GMT+00:00) Accra, Ghana', '(GMT+03:00) Nairobi, Kenya', '(GMT+02:00) Johannesburg, South Africa'];
const LANGUAGES = ['English (EN)', 'French (FR)', 'Portuguese (PT)'];
const CURRENCIES = ['Nigerian Naira (NGN)', 'US Dollar (USD)', 'Ghanaian Cedi (GHS)', 'Kenyan Shilling (KES)'];
const DISTANCE_UNITS = ['Kilometers (km)', 'Miles (mi)'];

function ToggleGrid({ items, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px 20px' }}>
      {items.map((it) => (
        <Switch key={it.key} checked={it.value} onChange={(v) => onToggle(it.key, v)}
          label={it.label} hint={it.hint} />
      ))}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ font: '500 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-500)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 'var(--tk-h-input)',
                   padding: '0 12px', border: '1px solid var(--tk-line-strong)', borderRadius: 'var(--tk-r-md)' }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: value, flex: '0 0 auto',
                       border: '1px solid var(--tk-line-strong)' }} />
        <input value={value} onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, border: 0, outline: 'none', font: '400 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }} />
      </div>
    </div>
  );
}

export function SystemSettings() {
  const platformInfo = useCollection('settingsPlatformInfo')?.[0];
  const operational = useCollection('settingsOperationalGeneral')?.[0];
  const notif = useCollection('settingsNotificationGeneral')?.[0];
  const [saved, setSaved] = useState(null);

  if (!platformInfo || !operational || !notif) return null;

  function flash(key) { setSaved(key); setTimeout(() => setSaved(null), 1500); }

  return (
    <>
      <PageHeader title="System Settings"
        description="Configure and manage your Trukkas platform settings, integrations, and preferences." />
      <SettingsTabStrip active="general" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Platform Information" icon="building-2"
            action={<Button size="sm" onClick={() => { updatePlatformInfo(platformInfo); flash('platform'); }}>
              {saved === 'platform' ? 'Saved ✓' : 'Save Changes'}</Button>}>
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 12 }}>Basic information about your Trukkas platform.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              <TextField label="Platform Name" value={platformInfo.platformName}
                onChange={(e) => updatePlatformInfo({ platformName: e.target.value })} />
              <TextField label="Company Email" value={platformInfo.companyEmail}
                onChange={(e) => updatePlatformInfo({ companyEmail: e.target.value })} />
              <Select label="Timezone" options={TIMEZONES} value={platformInfo.timezone}
                onChange={(e) => updatePlatformInfo({ timezone: e.target.value })} />
              <TextField label="Website" value={platformInfo.website}
                onChange={(e) => updatePlatformInfo({ website: e.target.value })} />
              <TextField label="Phone Number" value={platformInfo.phoneNumber}
                onChange={(e) => updatePlatformInfo({ phoneNumber: e.target.value })} />
              <Select label="Default Language" options={LANGUAGES} value={platformInfo.defaultLanguage}
                onChange={(e) => updatePlatformInfo({ defaultLanguage: e.target.value })} />
            </div>
          </SectionCard>

          <SectionCard title="Operational Settings" icon="settings"
            action={<Button size="sm" onClick={() => { updateOperationalGeneral(operational); flash('operational'); }}>
              {saved === 'operational' ? 'Saved ✓' : 'Save Changes'}</Button>}>
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 12 }}>Configure core operational preferences.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
              <TextField label="Default Job Expiry (Hours)" type="number" value={operational.defaultJobExpiryHours}
                hint="How long a job stays open for bids."
                onChange={(e) => updateOperationalGeneral({ defaultJobExpiryHours: Number(e.target.value) })} />
              <Select label="Default Currency" options={CURRENCIES} value={operational.defaultCurrency}
                onChange={(e) => updateOperationalGeneral({ defaultCurrency: e.target.value })} />
              <Select label="Distance Unit" options={DISTANCE_UNITS} value={operational.distanceUnit}
                onChange={(e) => updateOperationalGeneral({ distanceUnit: e.target.value })} />
            </div>
            <ToggleGrid onToggle={(key, v) => updateOperationalGeneral({ [key]: v })} items={[
              { key: 'autoAssignJobs', value: operational.autoAssignJobs, label: 'Auto-assign jobs', hint: 'Automatically assign jobs to preferred partners.' },
              { key: 'allowPartialBids', value: operational.allowPartialBids, label: 'Allow partial bids', hint: 'Allow bidders to submit partial bids.' },
              { key: 'autoCompleteTrips', value: operational.autoCompleteTrips, label: 'Auto-complete trips', hint: 'Mark trip as completed after POD upload.' },
              { key: 'requireDocumentVerification', value: operational.requireDocumentVerification, label: 'Require document verification', hint: 'Require verified documents before a job can start.' },
              { key: 'enableDriverRatings', value: operational.enableDriverRatings, label: 'Enable driver ratings', hint: 'Allow shippers to rate drivers after delivery.' },
              { key: 'enableGeofencing', value: operational.enableGeofencing, label: 'Enable geofencing', hint: 'Use location-based checks for trip updates.' },
            ]} />
          </SectionCard>

          <SectionCard title="Notification Settings" icon="bell"
            action={<Button size="sm" onClick={() => { updateNotificationGeneral(notif); flash('notif'); }}>
              {saved === 'notif' ? 'Saved ✓' : 'Save Changes'}</Button>}>
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 12 }}>Manage system notifications and alerts.</span>
            <ToggleGrid onToggle={(key, v) => updateNotificationGeneral({ [key]: v })} items={[
              { key: 'emailNotifications', value: notif.emailNotifications, label: 'Email Notifications', hint: 'Send system emails to users.' },
              { key: 'smsNotifications', value: notif.smsNotifications, label: 'SMS Notifications', hint: 'Send SMS alerts for key events.' },
              { key: 'inAppNotifications', value: notif.inAppNotifications, label: 'In-App Notifications', hint: 'Show in-app notifications.' },
              { key: 'jobAlerts', value: notif.jobAlerts, label: 'Job Alerts', hint: 'Notify relevant parties about new jobs.' },
              { key: 'payoutNotifications', value: notif.payoutNotifications, label: 'Payout Notifications', hint: 'Notify users about payout status.' },
              { key: 'incidentAlerts', value: notif.incidentAlerts, label: 'Incident Alerts', hint: 'Notify about incidents and exceptions.' },
            ]} />
          </SectionCard>

       
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SettingsStatusCard title="System Status" headline={systemStatus.headline} caption={systemStatus.lastChecked}
            items={systemStatus.items.map((i) => ({ label: i.label, status: i.status }))} />

          <SectionCard title="Platform Version" icon="package">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px 12px', marginBottom: 14 }}>
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="tk-meta">Current Version</span>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{platformVersion.currentVersion}</span>
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="tk-meta">Last Updated</span>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{platformVersion.lastUpdated}</span>
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="tk-meta">Environment</span>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{platformVersion.environment}</span>
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                <span className="tk-meta">Build Number</span>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{platformVersion.buildNumber}</span>
              </div>
            </div>
            <Button variant="outline" fullWidth icon="refresh-cw">Check for Updates</Button>
          </SectionCard>

          <QuickActionsCard items={generalQuickActions} />

          <SettingsDangerZone onConfirm={() => resetPlatformSettings()} />
        </div>
      </div>
    </>
  );
}
