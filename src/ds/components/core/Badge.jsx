import React from "react";

const TONES = {
  success: ["var(--tk-success-soft)", "var(--tk-success)"],
  info: ["var(--tk-info-soft)", "var(--tk-blue)"],
  warning: ["var(--tk-warning-soft)", "var(--tk-warning)"],
  danger: ["var(--tk-danger-soft)", "var(--tk-danger)"],
  neutral: ["var(--tk-neutral-soft)", "var(--tk-neutral)"],
  purple: ["var(--tk-purple-soft)", "var(--tk-purple)"],
  orange: ["var(--tk-orange-soft)", "var(--tk-orange-ink)"],
  teal: ["var(--tk-teal-soft)", "var(--tk-teal)"],
};

/** Controlled status vocabulary → tone. Extend here, never inline a colour. */
export const TK_STATUS = {
  Active: "success",
  Available: "success",
  Completed: "success",
  Delivered: "success",
  Valid: "success",
  Verified: "success",
  Approved: "success",
  Compliant: "success",
  Paid: "success",
  "In Transit": "info",
  Assigned: "info",
  Open: "info",
  Published: "info",
  "In Progress": "info",
  "On Trip": "info",
  Scheduled: "info",
  Unread: "info",
  Loading: "warning",
  Pending: "warning",
  "In Maintenance": "warning",
  "Expiring Soon": "warning",
  "In Review": "warning",
  "At Pickup": "warning",
  "At Risk": "warning",
  Restricted: "warning",
  Expired: "danger",
  Cancelled: "danger",
  Blocked: "danger",
  Locked: "danger",
  Overdue: "danger",
  "Non-Compliant": "danger",
  Unpaid: "danger",
  High: "danger",
  Idle: "neutral",
  Inactive: "neutral",
  Draft: "neutral",
  Archived: "neutral",
  "Suggested": "info",
  "Awaiting Parties": "orange",
  "Under Review": "purple",
  "—": "neutral",
};

export function Badge({ children, tone, dot = false, style }) {
  const key =
    tone ||
    TK_STATUS[typeof children === "string" ? children : ""] ||
    "neutral";
  const [bg, fg] = TONES[key] || TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: "var(--tk-h-badge)",
        padding: "0 8px",
        borderRadius: "var(--tk-r-xs)",
        background: bg,
        color: fg,
        font: "600 12px/1 var(--tk-font-sans)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{ width: 6, height: 6, borderRadius: 999, background: fg }}
        />
      )}
      {children}
    </span>
  );
}
