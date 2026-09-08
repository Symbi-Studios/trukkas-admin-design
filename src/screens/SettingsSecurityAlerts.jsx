'use client';

import { useState } from 'react';
import { PageHeader, Button, SectionCard, TextField, Select, Switch, Icon, QuickActionsCard, Banner } from '../ds.js';
import { useCollection } from '../mock/useCollection.js';
import {
  DIGEST_FREQUENCIES, securityAlertsStatus, recentSecurityAlerts, securityAlertsQuickActions, securityTip,
} from '../mock/fixtures/settings.js';
import {
  toggleSecurityAlertChannel, updateAlertDelivery, updateSecurityAlertsQuietHours,
  saveSecurityAlertsSettings, resetSecurityAlertsSettings,
} from '../mock/api.js';
import { SettingsTabStrip, SettingsMetaFooter } from './settingsShared.jsx';

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
  const events = useCollection('settingsSecurityAlertEvents') || [];
  const delivery = useCollection('settingsAlertDelivery')?.[0];
  const quiet = useCollection('settingsSecurityAlertsQuietHours')?.[0];
  const meta = useCollection('settingsMeta')?.[0];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!delivery || !quiet) return null;

  async function handleSave() {
    setSaving(true);
    await saveSecurityAlertsSettings();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader crumbs={['System Settings', 'Security Alerts']} title="Security Alerts"
        description="Get notified about important security events to keep your account and data safe."
        actions={<>
          <Button variant="outline" icon="rotate-ccw" onClick={() => resetSecurityAlertsSettings()}>Reset to Default</Button>
          <Button icon="save" disabled={saving} onClick={handleSave}>{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save Changes'}</Button>
        </>} />
      <SettingsTabStrip active="security-alerts" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 'var(--tk-grid-gap)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Security Alert Preferences" icon="bell">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 6 }}>Choose which security events you want to be notified about and how.</span>
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
          </SectionCard>

          <SectionCard title="Alert Delivery Settings" icon="settings">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Configure how and when you receive security alerts.</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <TextField label="Email for security alerts" type="email" value={delivery.emailForSecurityAlerts}
                  onChange={(e) => updateAlertDelivery({ emailForSecurityAlerts: e.target.value })} />
                <span className="tk-meta">Security alerts will be sent to this email address.</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <TextField label="Phone number for SMS alerts" value={delivery.phoneForSmsAlerts}
                  onChange={(e) => updateAlertDelivery({ phoneForSmsAlerts: e.target.value })} />
                <span className="tk-meta">Receive security alerts via SMS.</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <Select label="Digest frequency (optional)" options={DIGEST_FREQUENCIES} value={delivery.digestFrequency}
                  onChange={(e) => updateAlertDelivery({ digestFrequency: e.target.value })} />
                <span className="tk-meta">Choose how often to receive non-critical alerts.</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Quiet Hours" icon="clock">
            <span className="tk-meta" style={{ display: 'block', marginTop: -10, marginBottom: 14 }}>Pause non-critical security alerts during specific hours.</span>
            <div style={{ marginBottom: 14 }}>
              <Switch checked={quiet.enabled} label="Enable quiet hours"
                hint="You will still receive critical alerts (e.g. failed logins, suspicious activity)."
                onChange={(v) => updateSecurityAlertsQuietHours({ enabled: v })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
              <TextField label="From" value={quiet.from} suffix={<Icon name="clock" size={15} color="var(--tk-ink-300)" />}
                onChange={(e) => updateSecurityAlertsQuietHours({ from: e.target.value })} />
              <TextField label="To" value={quiet.to} suffix={<Icon name="clock" size={15} color="var(--tk-ink-300)" />}
                onChange={(e) => updateSecurityAlertsQuietHours({ to: e.target.value })} />
            </div>
          </SectionCard>
        </div>

        <div style={{ display: 'grid', gap: 'var(--tk-grid-gap)' }}>
          <SectionCard title="Security Alerts Status" icon="shield-check">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 14,
                         borderRadius: 'var(--tk-r-lg)', background: 'var(--tk-success-soft)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--tk-success)', flex: '0 0 auto',
                             display: 'grid', placeItems: 'center', marginTop: 1 }}>
                <Icon name="check" size={13} color="#fff" />
              </span>
              <div style={{ display: 'grid', gap: 2 }}>
                <span style={{ font: '600 14px/20px var(--tk-font-sans)', color: 'var(--tk-success)' }}>{securityAlertsStatus.headline}</span>
                <span className="tk-meta">{securityAlertsStatus.caption}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Recent Security Alerts" action={<a href="#">View All</a>}>
            <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
              {recentSecurityAlerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 'var(--tk-r-sm)', background: 'var(--tk-blue-soft)',
                                color: a.tone, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                    <Icon name={a.icon} size={15} />
                  </span>
                  <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                    <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-900)' }}>{a.label}</span>
                    <span className="tk-meta">{a.detail}</span>
                    <span className="tk-meta">{a.time} · {a.location}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" fullWidth iconRight="chevron-right">View All Security Events</Button>
          </SectionCard>

          <QuickActionsCard items={securityAlertsQuickActions} />

          <Banner tone="info" title="Security Tip">{securityTip}</Banner>
          <SettingsMetaFooter meta={meta} />
        </div>
      </div>
    </>
  );
}
