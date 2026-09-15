"use client";

import { useState } from "react";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  SectionCard,
  Card,
  Checkbox,
  Switch,
  TextField,
  Select,
  Tabs,
  Badge,
  QuickActionsCard,
  Banner,
  Icon,
  EmptyState,
} from "../ds.js";
import { useCollection } from "../mock/useCollection.js";
import {
  NOTIFICATION_FREQUENCIES,
  notificationPreview,
  notificationChannelsStatus,
  notificationQuickActions,
  NOTIFICATION_TABS,
} from "../mock/fixtures/settings.js";
import {
  updateNotificationChannels,
  updateQuietHours,
  toggleEventNotification,
  setEventNotificationFrequency,
  saveNotificationPreferences,
  resetNotificationPreferences,
} from "../mock/api.js";

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

function NotificationPreviewCard({ channel }) {
  if (channel === "Email") {
    return (
      <div
        style={{
          border: "1px solid var(--tk-line)",
          borderRadius: "var(--tk-r-lg)",
          padding: 14,
          display: "grid",
          gap: 6,
        }}
      >
        <span className="tk-meta">
          From: Trukkas &lt;notifications@trukkas.com&gt;
        </span>
        <span
          style={{
            font: "600 14px/20px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
          }}
        >
          {notificationPreview.title}
        </span>
        <span
          style={{
            font: "400 13px/19px var(--tk-font-sans)",
            color: "var(--tk-ink-500)",
          }}
        >
          {notificationPreview.body}
        </span>
      </div>
    );
  }
  if (channel === "SMS") {
    return (
      <div
        style={{
          border: "1px solid var(--tk-line)",
          borderRadius: "var(--tk-r-lg)",
          padding: 14,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "var(--tk-blue-soft)",
            color: "var(--tk-blue-ink)",
            borderRadius: "var(--tk-r-lg)",
            padding: "10px 12px",
            font: "400 13px/19px var(--tk-font-sans)",
            maxWidth: "90%",
          }}
        >
          Trukkas: {notificationPreview.title} — {notificationPreview.body}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        border: "1px solid var(--tk-line)",
        borderRadius: "var(--tk-r-lg)",
        padding: 14,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--tk-r-sm)",
          background: "var(--tk-blue-soft)",
          color: "var(--tk-blue)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={notificationPreview.icon} size={17} />
      </span>
      <div style={{ flex: 1, display: "grid", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: 1,
              font: "600 13px/18px var(--tk-font-sans)",
              color: "var(--tk-ink-900)",
            }}
          >
            {notificationPreview.title}
          </span>
          <span className="tk-meta">{notificationPreview.time}</span>
        </div>
        <span
          style={{
            font: "400 13px/19px var(--tk-font-sans)",
            color: "var(--tk-ink-500)",
          }}
        >
          {notificationPreview.body}
        </span>
      </div>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "var(--tk-blue)",
          flex: "0 0 auto",
          marginTop: 3,
        }}
      />
    </div>
  );
}

export function SettingsNotifications() {
  const navigate = useNavigate();
  const channels = useCollection("settingsNotificationChannels")?.[0];
  const quiet = useCollection("settingsQuietHours")?.[0];
  const groups = useCollection("settingsEventNotifications") || [];
  const [subTab, setSubTab] = useState("Notification Preferences");
  const [previewChannel, setPreviewChannel] = useState("In-App");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!channels || !quiet) return null;

  async function handleSave() {
    setSaving(true);
    await saveNotificationPreferences();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "System Settings", onClick: () => navigate("/settings") },
          "Notifications",
        ]}
        title="Notification Settings"
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
            <Button icon="save" disabled={saving} onClick={handleSave}>
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save Changes"}
            </Button>
          </>
        }
      />

      <Card pad="none">
        <Tabs
          value={subTab}
          onChange={setSubTab}
          style={{ padding: "0 var(--tk-card-pad)" }}
          items={NOTIFICATION_TABS}
        />
      </Card>

      {subTab !== "Notification Preferences" ? (
        <Card>
          <EmptyState
            icon="hammer"
            title={`${subTab} isn't built yet`}
            description="This tab is wired into navigation, but its screen hasn't been transcribed from the source screenshots yet."
          />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: "var(--tk-grid-gap)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
            <SectionCard title="General Notification Settings" icon="settings">
              <span
                className="tk-meta"
                style={{ display: "block", marginTop: -10, marginBottom: 14 }}
              >
                Set your overall notification preferences and quiet hours.
              </span>
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
            </SectionCard>

            <SectionCard title="Event Notification Settings" icon="bell">
              <span
                className="tk-meta"
                style={{ display: "block", marginTop: -10, marginBottom: 6 }}
              >
                Choose which events trigger notifications and how you want to be
                notified.
              </span>
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
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
            <SectionCard title="Notification Preview" icon="eye">
              <span
                className="tk-meta"
                style={{ display: "block", marginTop: -10, marginBottom: 10 }}
              >
                See how your notifications will look across different channels.
              </span>
              <Tabs
                value={previewChannel}
                onChange={setPreviewChannel}
                items={["In-App", "Email", "SMS"]}
                style={{ marginBottom: 12 }}
              />
              <NotificationPreviewCard channel={previewChannel} />
            </SectionCard>

            <SectionCard title="Notification Channels" icon="send">
              <div style={{ display: "grid" }}>
                {notificationChannelsStatus.map((c, i) => (
                  <button
                    key={c.label}
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 2px",
                      border: 0,
                      borderTop: i ? "1px solid var(--tk-line)" : "none",
                      background: "transparent",
                      cursor: "pointer",
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
                  </button>
                ))}
              </div>
            </SectionCard>

            <QuickActionsCard items={notificationQuickActions} />

            <Banner tone="info">
              Tip: Use notification groups to set different preferences for
              dispatchers, drivers, customers, and other team members.
            </Banner>
          </div>
        </div>
      )}
    </>
  );
}
