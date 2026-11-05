"use client";

;
import { Button, Badge, Icon } from '../ds.js';
import { SettingsCheckbox as Checkbox, SettingsSwitch as Switch, SettingsTextField as TextField, SettingsSelect as Select, SettingsReadNotice } from './settingsValues.jsx';
import { useSettingsEditor } from './useSettingsEditor.js';
import { SettingsSectionHeader, SettingsPanelLoading, SettingsGrid, SettingsCard, SettingsCardSave } from './settingsShared.jsx';

import { NOTIFICATION_FREQUENCIES, eventNotificationGroups as notificationEventControls, notificationChannelsStatus as notificationChannelControls } from '../mock/fixtures/settings.js';



const TIMEZONES = [
  "(GMT+01:00) Lagos, Nigeria",
  "(GMT+00:00) Accra, Ghana",
  "(GMT+03:00) Nairobi, Kenya",
  "(GMT+02:00) Johannesburg, South Africa",
];

function EventRow({ event, onToggle, onFrequency }) {
  return (
    <div
      className="tk-notification-event-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 70px 70px 70px 140px",
        alignItems: "center",
        padding: "12px 4px",
        borderBottom: "1px solid var(--tk-line)",
        gap: 8,
      }}
    >
      <div style={{ display: "grid", gap: 1 }}>
        <span
          style={{
            font: "600 13px/18px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
          }}
        >
          {event.label}
        </span>
        <span className="tk-meta">{event.hint}</span>
      </div>
      <span style={{ display: "grid", justifyItems: "center" }}>
        <Switch checked={event.inApp} onChange={(v) => onToggle("inApp", v)} />
      </span>
      <span style={{ display: "grid", justifyItems: "center" }}>
        <Switch checked={event.email} onChange={(v) => onToggle("email", v)} />
      </span>
      <span style={{ display: "grid", justifyItems: "center" }}>
        <Switch checked={event.sms} onChange={(v) => onToggle("sms", v)} />
      </span>
      <Select
        options={NOTIFICATION_FREQUENCIES}
        value={event.frequency}
        onChange={(e) => onFrequency(e.target.value)}
      />
    </div>
  );
}

export function SettingsNotifications() {
  const editor = useSettingsEditor('notifications');
  const updateNotificationChannels = editor.change('settingsNotificationChannels');
  const updateQuietHours = editor.change('settingsQuietHours');
  const eventControl = key => notificationEventControls.flatMap(group => group.events).find(event => event.key === key);
  const toggleEventNotification = (key, channel, value) => editor.changeEvent(eventControl(key), channel, value);
  const setEventNotificationFrequency = (key, value) => editor.changeEvent(eventControl(key), 'frequency', value);
  const resetNotificationPreferences = () => editor.reset();
  const notificationChannelsStatus = notificationChannelControls.map(({ label, icon }) => ({ label, icon, ...(editor.channels?.[({ 'Email Notifications': 'email', 'SMS Notifications': 'sms', 'In-App Notifications': 'inApp' })[label]] || { detail: '—', status: '—' }) }));
  const channels = editor.group('settingsNotificationChannels');
  const quiet = editor.group('settingsQuietHours');
  const groups = notificationEventControls.map(({ group, icon, events }) => ({ group, icon, events: events.map(({ key, label, hint }) => ({ key, label, hint, ...editor.event({ key, label }) })) }));

  if (editor.loading) return <SettingsPanelLoading />;
  if (!channels || !quiet) return null;


  return (
    <>
      <SettingsSectionHeader
        title="Notifications"
        description="Configure how and when you and your team receive notifications across the platform."
        actions={
          <>
            <Button
              variant="outline"
              icon="rotate-ccw"
              onClick={() => resetNotificationPreferences()}
            >
              Reset to Default
            </Button>
          </>
        }
      />

      <SettingsReadNotice error={editor.error} />
      <SettingsGrid>
        <SettingsCard description="Set your overall notification preferences and quiet hours." title="General Notification Settings" save={<SettingsCardSave editor={editor} />}>
          <div
            className="tk-notification-event-grid tk-notification-event-header"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 24,
            }}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <span
                style={{
                  font: "500 13px/18px var(--tk-font-sans)",
                  color: "var(--tk-ink-500)",
                }}
              >
                Default Notification Channels
              </span>
              <Checkbox
                checked={channels.inApp}
                label="In-App Notifications"
                hint="Receive notifications within the platform"
                onChange={(v) => updateNotificationChannels({ inApp: v })}
              />
              <Checkbox
                checked={channels.email}
                label="Email Notifications"
                hint="Receive notifications via email"
                onChange={(v) => updateNotificationChannels({ email: v })}
              />
              <Checkbox
                checked={channels.sms}
                label="SMS Notifications"
                hint="Receive important alerts via SMS"
                onChange={(v) => updateNotificationChannels({ sms: v })}
              />
            </div>
            <div
              style={{ display: "grid", gap: 14, alignContent: "start" }}
            >
              <Switch
                checked={quiet.enabled}
                label="Enable quiet hours"
                hint="Pause non-critical notifications during specific hours."
                onChange={(v) => updateQuietHours({ enabled: v })}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 12,
                }}
              >
                <TextField
                  label="From"
                  value={quiet.from}
                  suffix={
                    <Icon
                      name="clock"
                      size={15}
                      color="var(--tk-ink-300)"
                    />
                  }
                  onChange={(e) =>
                    updateQuietHours({ from: e.target.value })
                  }
                />
                <TextField
                  label="To"
                  value={quiet.to}
                  suffix={
                    <Icon
                      name="clock"
                      size={15}
                      color="var(--tk-ink-300)"
                    />
                  }
                  onChange={(e) => updateQuietHours({ to: e.target.value })}
                />
              </div>
              <Select
                label="Time Zone"
                options={TIMEZONES}
                value={quiet.timeZone}
                onChange={(e) =>
                  updateQuietHours({ timeZone: e.target.value })
                }
              />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard description="Choose which events trigger notifications and how you want to be notified." title="Event Notification Settings" className="tk-settings-wide" save={<SettingsCardSave editor={editor} />}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 70px 70px 70px 140px",
              gap: 8,
              padding: "10px 4px",
              borderBottom: "1px solid var(--tk-line)",
            }}
          >
            <span
              style={{
                font: "600 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
              }}
            >
              Event Type
            </span>
            <span
              style={{
                font: "600 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
                textAlign: "center",
              }}
            >
              In-App
            </span>
            <span
              style={{
                font: "600 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
                textAlign: "center",
              }}
            >
              Email
            </span>
            <span
              style={{
                font: "600 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
                textAlign: "center",
              }}
            >
              SMS
            </span>
            <span
              style={{
                font: "600 12px/16px var(--tk-font-sans)",
                color: "var(--tk-ink-400)",
              }}
            >
              Frequency
            </span>
          </div>
          {groups.map((g) => (
            <div key={g.group}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 4px",
                  background: "var(--tk-surface-sunk)",
                }}
              >
                <Icon name={g.icon} size={15} color="var(--tk-ink-500)" />
                <span
                  style={{
                    font: "600 13px/18px var(--tk-font-sans)",
                    color: "var(--tk-ink-900)",
                  }}
                >
                  {g.group}
                </span>
              </div>
              {g.events.map((ev) => (
                <EventRow
                  key={ev.key}
                  event={ev}
                  onToggle={(channel, v) =>
                    toggleEventNotification(ev.key, channel, v)
                  }
                  onFrequency={(f) =>
                    setEventNotificationFrequency(ev.key, f)
                  }
                />
              ))}
            </div>
          ))}
        </SettingsCard>
        
        <SettingsCard title="Notification Channels">
          <div style={{ display: "grid" }}>
            {notificationChannelsStatus.map((c, i) => (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 2px",
                  border: 0,
                  borderTop: i ? "1px solid var(--tk-line)" : "none",
                  background: "transparent",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--tk-r-sm)",
                    background: "var(--tk-blue-soft)",
                    color: "var(--tk-blue)",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                >
                  <Icon name={c.icon} size={16} />
                </span>
                <span style={{ flex: 1, display: "grid", gap: 1 }}>
                  <span
                    style={{
                      font: "600 13px/18px var(--tk-font-sans)",
                      color: "var(--tk-ink-900)",
                    }}
                  >
                    {c.label}
                  </span>
                  <span className="tk-meta">{c.detail}</span>
                </span>
                <Badge tone="success">{c.status}</Badge>
              </div>
            ))}
          </div>
        </SettingsCard>
      </SettingsGrid>
    </>
  );
}
