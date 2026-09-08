"use client";

import { usePathname } from "next/navigation.js";
import { useNavigate } from "../router.js";
import { Tabs, Card, Badge, Icon } from "../ds.js";

export const SETTINGS_TABS = [
  { key: "general", label: "General", path: "/settings" },
  // { key: 'company', label: 'Company', path: '/settings/company' },
  { key: "operations", label: "Operations", path: "/settings/operations" },
  { key: "finance", label: "Finance", path: "/settings/finance" },
  { key: "fleet", label: "Fleet", path: "/settings/fleet" },
  {
    key: "notifications",
    label: "Notifications",
    path: "/settings/notifications",
  },
  {
    key: "integrations",
    label: "Integrations",
    path: "/settings/integrations",
  },
  { key: "security", label: "Security", path: "/settings/security" },
  { key: "passwords", label: "Passwords", path: "/settings/passwords" },
  {
    key: "security-alerts",
    label: "Security Alerts",
    path: "/settings/security-alerts",
  },
  {
    key: "data-protection",
    label: "Data Protection",
    path: "/settings/data-protection",
  },
];

export function SettingsTabStrip({ active, style }) {
  const navigate = useNavigate();
  return (
    <Card pad="none" style={style}>
      <Tabs
        value={active}
        onChange={(key) =>
          navigate(
            SETTINGS_TABS.find((t) => t.key === key)?.path || "/settings",
          )
        }
        style={{ padding: "0 var(--tk-card-pad)" }}
        items={SETTINGS_TABS.map((t) => ({ value: t.key, label: t.label }))}
      />
    </Card>
  );
}

export function useSettingsActiveTab() {
  const pathname = usePathname();
  const seg = pathname.split("/")[2];
  return seg || "general";
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
