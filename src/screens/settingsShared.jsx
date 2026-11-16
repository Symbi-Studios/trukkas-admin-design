"use client";

import { useState } from "react";
;
import { Card, Badge, Icon, Skeleton, Button } from "../ds.js";
import "./Settings.css";

export const SETTINGS_TABS = [
  { key: "general", label: "General" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
  { key: "notifications", label: "Notifications" },
  { key: "onboarding", label: "Onboarding" },
  { key: "integrations", label: "Integrations" },
  { key: "security", label: "Security & Privacy" },
];

// Tabs that were merged into another; old links and bookmarks still resolve.
const MERGED_TABS = {
  fleet: "operations",
  "fields-registration": "onboarding",
  passwords: "security",
  "security-alerts": "security",
  "data-protection": "security",
};

export function resolveSettingsTab(key) {
  const tab = MERGED_TABS[key] || key;
  return SETTINGS_TABS.some((t) => t.key === tab) ? tab : "general";
}

export function settingsTabPath(key) {
  const tab = resolveSettingsTab(key);
  return tab === "general" ? "/settings" : `/settings?tab=${tab}`;
}

/** Vertical list of settings tabs, shown beside the content (a scrolling row on narrow screens). */
export function SettingsNav({ active, onChange }) {
  return (
    <nav className="tk-settings-nav" aria-label="Settings">
      {SETTINGS_TABS.map((t) => (
        <button key={t.key} type="button" aria-current={t.key === active ? "page" : undefined}
          onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** Heading for one settings area inside a tab. */
export function SettingsSectionHeader({ title, description, actions }) {
  return (
    <div className="tk-settings-area-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="tk-settings-area-actions">{actions}</div>}
    </div>
  );
}

/** Saves one card. `group` limits the save to that card's settings; without it the whole area is saved. */
export function SettingsCardSave({ editor, group, label = "Save" }) {
  const [state, setState] = useState("idle");
  const dirty = editor.dirty(group);
  async function save() {
    setState("saving");
    const ok = await editor.save(group);
    setState(ok ? "saved" : "idle");
    if (ok) setTimeout(() => setState("idle"), 1500);
  }
  return (
    <Button size="sm" variant={dirty ? "primary" : "outline"} disabled={!dirty || state === "saving" || editor.saving} onClick={save}>
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : label}
    </Button>
  );
}

/** Settings card: title and description, controls, then a footer bar with a note and the card's own action. */
export function SettingsCard({ title, description, action, count, note, save, pad = "md", className, children }) {
  return (
    <Card pad="none" className={"tk-settings-card" + (className ? " " + className : "")}>
      <div className="tk-settings-card-head">
        <div style={{ minWidth: 0 }}>
          <h3>{title}{count != null && <span className="tk-settings-card-count">{count}</span>}</h3>
          {description && <p>{description}</p>}
        </div>
        {action && <div className="tk-settings-card-action">{action}</div>}
      </div>
      <div className="tk-settings-card-body" data-pad={pad}>{children}</div>
      {(note || save) && (
        <div className="tk-settings-card-foot">
          <span className="tk-meta">{note}</span>
          {save}
        </div>
      )}
    </Card>
  );
}

/** Single column of settings cards. */
export function SettingsGrid({ children }) {
  return <div className="tk-settings-stack">{children}</div>;
}

export function SettingsPanelLoading() {
  return (
    <Card aria-busy="true" style={{ display: "grid", gap: 14 }}>
      <Skeleton width={180} height={20} />
      <Skeleton width="60%" height={14} />
      <Skeleton width="45%" height={14} />
      <span className="tk-meta">Loading settings…</span>
    </Card>
  );
}

/** The green "All Systems Operational" style status card used across settings screens. */
export function SettingsStatusCard({ title, headline, caption, items }) {
  return (
    <Card style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="activity" size={17} color="var(--tk-ink-900)" />
        <h3 className="tk-section">{title}</h3>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: 14,
          borderRadius: "var(--tk-r-lg)",
          background: "var(--tk-success-soft)",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "var(--tk-success)",
            flex: "0 0 auto",
            display: "grid",
            placeItems: "center",
            marginTop: 1,
          }}
        >
          <Icon name="check" size={13} color="#fff" />
        </span>
        <div style={{ display: "grid", gap: 2 }}>
          <span
            style={{
              font: "600 14px/20px var(--tk-font-sans)",
              color: "var(--tk-success)",
            }}
          >
            {headline}
          </span>
          {caption && <span className="tk-meta">{caption}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--tk-success)",
                flex: "0 0 auto",
              }}
            />
            <span
              style={{
                flex: 1,
                font: "400 13px/18px var(--tk-font-sans)",
                color: "var(--tk-ink-500)",
              }}
            >
              {it.label}
            </span>
            <Badge tone="success">{it.status}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The red "Danger Zone" card: a single destructive action, confirmed before firing. */
export function SettingsDangerZone({
  title = "Reset Platform Settings",
  hint = "Restore all settings to default values.",
  onConfirm,
}) {
  function handleClick() {
    if (window.confirm(`${title}? This cannot be undone.`)) onConfirm?.();
  }
  return (
    <Card
      style={{
        background: "var(--tk-danger-soft)",
        border: "1px solid rgba(203,6,17,0.18)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="triangle-alert" size={16} color="var(--tk-danger)" />
        <h3 className="tk-section" style={{ color: "var(--tk-danger)" }}>
          Danger Zone
        </h3>
      </div>
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px",
          border: 0,
          borderRadius: "var(--tk-r-lg)",
          background: "#fff",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon name="rotate-ccw" size={16} color="var(--tk-danger)" />
        <span style={{ flex: 1, display: "grid", gap: 1 }}>
          <span
            style={{
              font: "600 13px/18px var(--tk-font-sans)",
              color: "var(--tk-danger)",
            }}
          >
            {title}
          </span>
          <span className="tk-meta">{hint}</span>
        </span>
        <Icon name="chevron-right" size={15} color="var(--tk-danger)" />
      </button>
    </Card>
  );
}

export function SettingsMetaFooter({ meta }) {
  if (!meta) return null;
  return (
    <div style={{ display: "grid", gap: 2, padding: "0 4px" }}>
      <span className="tk-meta">
        Last updated{" "}
        <strong style={{ color: "var(--tk-ink-500)", fontWeight: 500 }}>
          {meta.lastUpdated}
        </strong>
      </span>
      <span className="tk-meta">
        Updated by{" "}
        <strong style={{ color: "var(--tk-ink-500)", fontWeight: 500 }}>
          {meta.updatedBy}
        </strong>
      </span>
    </div>
  );
}
