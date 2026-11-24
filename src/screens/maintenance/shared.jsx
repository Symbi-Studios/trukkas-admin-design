"use client";
import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, Icon, Modal, Textarea } from "../../ds.js";
import { complianceLabel, complianceTone } from "../../domain/maintenanceRules.js";
import { isPendingBackend, maintenanceError } from "../../store/features/maintenance/maintenanceApi.js";

export const VIEWS = [
  { value: "overview", label: "Overview" },
  { value: "fleet", label: "Fleet Compliance" },
  { value: "records", label: "Service Records" },
  { value: "reviews", label: "Reviews" },
  { value: "rules", label: "Rules" },
  { value: "exceptions", label: "Exceptions" },
];

/** Keeps the active Fleet Maintenance view in `?view=` so it survives reloads and links. */
export function useMaintenanceView() {
  const [view, setView] = useState("overview");
  useEffect(() => {
    const read = () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("schedule") === "1") {
        // Old "Schedule maintenance" links: companies schedule servicing, so open the truck's records instead.
        url.searchParams.delete("schedule");
        url.searchParams.set("view", "records");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
      const next = url.searchParams.get("view");
      setView(VIEWS.some((item) => item.value === next) ? next : "overview");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  function change(next, extra = {}) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    for (const key of ["truckId", "status"]) url.searchParams.delete(key);
    for (const [key, value] of Object.entries(extra)) if (value != null) url.searchParams.set(key, value);
    window.history.pushState(window.history.state, "", url.pathname + url.search + url.hash);
    setView(next);
    document.querySelector(".tk-app-scroll")?.scrollTo({ top: 0 });
  }
  return [view, change];
}

export function urlParam(name) {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get(name);
}

export const RECORD_TONE = {
  Requested: "info",
  Scheduled: "info",
  "In Progress": "warning",
  "Awaiting Verification": "orange",
  Verified: "success",
  Completed: "success",
  Overdue: "danger",
  Cancelled: "neutral",
  Rejected: "danger",
};

export function ComplianceBadge({ status }) {
  return <Badge tone={complianceTone(status)} dot>{complianceLabel(status)}</Badge>;
}

export function RestrictedBadge({ title }) {
  return (
    <span title={title} style={{ display: "inline-flex" }}>
      <Badge tone="danger"><Icon name="lock-keyhole" size={11} style={{ marginRight: 4 }} />Blocked</Badge>
    </span>
  );
}

/** A read that failed. Proposed endpoints that are not live yet get a calm "pending" state, not an error. */
export function ReadState({ error, icon = "wrench", title, retry }) {
  if (isPendingBackend(error)) {
    return (
      <EmptyState
        icon="hourglass"
        title={title || "Coming with the next backend release"}
        description="This view is built against a proposed endpoint in the Fleet Maintenance backend brief. It fills in automatically once that endpoint ships."
      />
    );
  }
  return <EmptyState icon={icon} title={maintenanceError(error)} action={retry ? <Button variant="outline" onClick={retry}>Retry</Button> : undefined} />;
}

/** Confirm an audited action that needs a written reason. */
export function ReasonModal({ open, title, description, label = "Reason", confirmLabel, tone = "primary", busy, confirmDisabled, error, onConfirm, onClose, children }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={title}
      description={description}
      width={520}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : undefined} disabled={busy || confirmDisabled || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="maint-form">
        {children}
        <Textarea label={label} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the audit log and shown to the truck company." />
        {error && <span role="alert" className="tk-meta" style={{ color: "var(--tk-danger)" }}>{error}</span>}
      </div>
    </Modal>
  );
}

export function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  return [toast, setToast];
}

export const km = (value) => (value == null ? "—" : `${Math.round(value).toLocaleString("en-NG")} km`);
export const count = (value) => (value == null ? "—" : value.toLocaleString("en-NG"));
export const naira = (value) => (value == null ? "—" : `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`);

/** "4,200 km left" / "3 days overdue" — the most urgent of distance and time. */
export function remainingLabel(req) {
  if (!req) return "—";
  const parts = [];
  if (req.remainingKm != null) parts.push(req.remainingKm < 0 ? `${km(-req.remainingKm)} over` : `${km(req.remainingKm)} left`);
  if (req.remainingDays != null) parts.push(req.remainingDays < 0 ? `${-req.remainingDays} days overdue` : req.remainingDays === 0 ? "due today" : `${req.remainingDays} days left`);
  return parts.join(" · ") || "—";
}
