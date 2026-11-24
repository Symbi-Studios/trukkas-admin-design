"use client";
import { useEffect, useState } from "react";
import { Badge, Banner, Button, Checkbox, ChoiceCard, DataTable, Icon, Modal, SectionCard, Select, Switch, TextField, Textarea } from "../../ds.js";
import { DriverTableLoading } from "../DriversLoading.jsx";
import { MAINTENANCE_CATEGORIES, RULE_TRIGGERS, VEHICLE_CLASSES, categoryLabel, triggerLabel } from "../../domain/maintenanceRules.js";
import {
  isPendingBackend, maintenanceError, useArchiveAdminMaintenanceRuleMutation, useGetAdminMaintenancePoliciesQuery, useGetAdminMaintenanceRulesQuery,
  usePreviewAdminMaintenanceRuleMutation, useSaveAdminMaintenanceRuleMutation, useUpdateAdminMaintenancePoliciesMutation,
} from "../../store/features/maintenance/maintenanceApi.js";
import { ReadState, ReasonModal, count } from "./shared.jsx";

const TRIGGER_ICON = { KM: "gauge", DAYS: "calendar-clock", ENGINE_HOURS: "timer" };

/** Super Admin owns the rules. Companies cannot switch off a mandatory rule. */
export function Rules({ owner, authenticated, role, notify, openNew, onOpenedNew }) {
  const isSuper = role === "SUPER_ADMIN";
  const rules = useGetAdminMaintenanceRulesQuery({ owner }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [editing, setEditing] = useState(null);
  useEffect(() => { if (openNew) { setEditing("new"); onOpenedNew?.(); } }, [openNew]);
  const rows = rules.error ? [] : rules.currentData || [];
  const active = rows.filter((rule) => rule.status !== "ARCHIVED");
  const archived = rows.filter((rule) => rule.status === "ARCHIVED");

  return (
    <div className="maint-main">
      {!isSuper && <Banner tone="info" title="Only a Super Admin can create or change maintenance rules.">You can view every rule and its history.</Banner>}
      <PlatformDefaults owner={owner} authenticated={authenticated} canWrite={isSuper} notify={notify} />
      <SectionCard
        title="Maintenance Rules"
        description="Each rule sets an interval for one category of work. Trukkas tracks every eligible truck against it."
        count={rules.error ? undefined : active.length}
        action={isSuper && !isPendingBackend(rules.error) ? <Button size="sm" icon="plus" onClick={() => setEditing("new")}>New rule</Button> : null}
        pad="none"
      >
        {rules.isFetching ? <DriverTableLoading columns={6} label="Loading rules" /> : rules.error ? (
          <div style={{ display: "grid", gap: 12, padding: 16 }}>
            <ReadState error={rules.error} retry={rules.refetch} title="Per-category rules are coming" />
            {isSuper && isPendingBackend(rules.error) && <div style={{ display: "flex", justifyContent: "center" }}><Button variant="outline" icon="eye" onClick={() => setEditing("new")}>Preview the rule editor</Button></div>}
          </div>
        ) : !active.length ? (
          <div className="maint-clear" style={{ padding: 20 }}>No rules yet. Only the platform defaults above apply.</div>
        ) : (
          <RuleTable rows={active} onOpen={setEditing} />
        )}
      </SectionCard>
      {archived.length > 0 && (
        <SectionCard title="Archived Rules" description="Kept for history. Archived rules no longer create requirements." count={archived.length} pad="none">
          <RuleTable rows={archived} onOpen={setEditing} />
        </SectionCard>
      )}
      {editing && <RuleEditor rule={editing === "new" ? null : editing} canWrite={isSuper} notify={notify} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RuleTable({ rows, onOpen }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(rule) => rule.id}
      onRowClick={onOpen}
      columns={[
        { key: "name", header: "Rule", render: (rule) => <span className="maint-cell"><strong>{rule.name}</strong><small>{categoryLabel(rule.category)}</small></span> },
        { key: "trigger", header: "Interval", render: (rule) => <span className="maint-cell"><strong>{triggerLabel(rule.trigger)}</strong><small>{rule.graceDays != null ? `${rule.graceDays}-day grace period` : "—"}</small></span> },
        { key: "enforce", header: "Enforcement", render: (rule) => rule.mandatory ? (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Badge tone="danger">Mandatory</Badge>{rule.blocksAssignment && <Badge tone="neutral"><Icon name="lock-keyhole" size={11} style={{ marginRight: 4 }} />Blocks jobs</Badge>}</span>
        ) : <Badge tone="info">Advisory</Badge> },
        { key: "scope", header: "Applies to", render: (rule) => rule.vehicleClasses.length ? rule.vehicleClasses.map((v) => VEHICLE_CLASSES.find((c) => c.value === v)?.label || v).join(", ") : "All trucks" },
        { key: "trucks", header: "Trucks", render: (rule) => count(rule.trucksAffected) },
        { key: "updated", header: "Last change", render: (rule) => <span className="maint-cell"><strong>v{rule.version ?? "—"} · {rule.updatedAt}</strong><small>{rule.updatedBy}</small></span> },
      ]}
    />
  );
}

/** The three platform-wide numbers that exist today (`/admin/maintenance/policies`). */
function PlatformDefaults({ owner, authenticated, canWrite, notify }) {
  const query = useGetAdminMaintenancePoliciesQuery({ owner }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const [save, state] = useUpdateAdminMaintenancePoliciesMutation();
  const [values, setValues] = useState({ overdueGraceDays: "", dueSoonDays: "", mileageLimitKm: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.currentData && !query.error) setValues(Object.fromEntries(Object.entries(query.currentData).map(([key, value]) => [key, value ?? ""])));
  }, [query.currentData, query.error]);
  const dirty = query.currentData && Object.entries(values).some(([key, value]) => String(query.currentData[key] ?? "") !== String(value));
  const edit = (key) => (e) => setValues((current) => ({ ...current, [key]: e.target.value }));
  async function submit() {
    setError("");
    try { await save(values).unwrap(); notify("Platform defaults saved."); }
    catch (err) { setError(maintenanceError(err)); }
  }
  return (
    <SectionCard
      title="Platform Defaults"
      description="Apply to every truck. A truck overdue past the grace period is blocked from new jobs."
      action={canWrite ? <Button size="sm" disabled={!dirty || state.isLoading || Object.values(values).some((v) => v === "")} onClick={submit}>{state.isLoading ? "Saving…" : "Save defaults"}</Button> : null}
    >
      {query.isFetching ? <DriverTableLoading columns={3} label="Loading defaults" /> : query.error ? <ReadState error={query.error} retry={query.refetch} /> : (
        <div className="maint-defaults">
          <TextField label="Due-soon warning" suffix="days" hint="Companies are warned this many days ahead (1–90)." type="number" min={1} max={90} value={values.dueSoonDays} disabled={!canWrite} onChange={edit("dueSoonDays")} />
          <TextField label="Overdue grace period" suffix="days" hint="Days overdue before the truck is blocked (0–60)." type="number" min={0} max={60} value={values.overdueGraceDays} disabled={!canWrite} onChange={edit("overdueGraceDays")} />
          <TextField label="Service mileage alert" suffix="km" hint="Distance since the last preventive service (500–100,000)." type="number" min={500} max={100000} value={values.mileageLimitKm} disabled={!canWrite} onChange={edit("mileageLimitKm")} />
        </div>
      )}
      {error && <span role="alert" className="tk-meta" style={{ color: "var(--tk-danger)" }}>{error}</span>}
    </SectionCard>
  );
}

function blank() {
  return { name: "", category: "ENGINE_SERVICE", triggerType: "KM", interval: "10000", dueSoon: "1000", graceDays: "3", mandatory: true, blocksAssignment: true, vehicleClasses: [], reason: "" };
}
function fromRule(rule) {
  return {
    name: rule.name === "—" ? "" : rule.name, category: rule.category || "OTHER", triggerType: rule.trigger?.type || "KM",
    interval: rule.trigger?.interval != null ? String(rule.trigger.interval) : "",
    dueSoon: String((rule.trigger?.type === "DAYS" ? rule.dueSoonDays : rule.dueSoonKm) ?? ""),
    graceDays: rule.graceDays != null ? String(rule.graceDays) : "", mandatory: Boolean(rule.mandatory), blocksAssignment: Boolean(rule.blocksAssignment),
    vehicleClasses: rule.vehicleClasses, reason: "",
  };
}

function RuleEditor({ rule, canWrite, notify, onClose }) {
  const [form, setForm] = useState(() => (rule ? fromRule(rule) : blank()));
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [save, saveState] = useSaveAdminMaintenanceRuleMutation();
  const [archive, archiveState] = useArchiveAdminMaintenanceRuleMutation();
  const [preview, previewState] = usePreviewAdminMaintenanceRuleMutation();
  const [impact, setImpact] = useState(null);
  const readOnly = !canWrite || rule?.status === "ARCHIVED";
  const set = (patch) => { setForm((current) => ({ ...current, ...patch })); setImpact(null); };
  const unit = RULE_TRIGGERS.find((t) => t.value === form.triggerType)?.unit || "";
  const busy = saveState.isLoading || archiveState.isLoading;

  async function runPreview() {
    setError("");
    try { setImpact(await preview(form).unwrap()); }
    catch (err) { setImpact({ error: err }); }
  }
  async function submit() {
    setError("");
    try { await save({ id: rule?.id, ...form }).unwrap(); notify(rule ? "Rule updated. A new version was recorded." : "Rule created. Trukkas is applying it to eligible trucks."); onClose(); }
    catch (err) { setError(maintenanceError(err)); }
  }
  async function doArchive(reason) {
    setError("");
    try { await archive({ id: rule.id, reason }).unwrap(); notify("Rule archived."); setArchiving(false); onClose(); }
    catch (err) { setError(maintenanceError(err)); setArchiving(false); }
  }

  return (
    <>
      <Modal
        open
        onClose={() => { if (!busy) onClose(); }}
        title={rule ? (readOnly ? rule.name : `Edit ${rule.name}`) : "New maintenance rule"}
        description={rule ? `Version ${rule.version ?? "—"} · last changed ${rule.updatedAt} by ${rule.updatedBy}` : "Trukkas will track every truck in scope against this rule."}
        width={680}
        footer={readOnly ? <Button variant="outline" onClick={onClose}>Close</Button> : <>
          {rule && <Button variant="danger" disabled={busy} onClick={() => setArchiving(true)}>Archive</Button>}
          <span style={{ flex: 1 }} />
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || (rule && !form.reason.trim())} onClick={submit}>{saveState.isLoading ? "Saving…" : rule ? "Save new version" : "Create rule"}</Button>
        </>}
      >
        <div className="maint-form">
          <div className="maint-form-grid">
            <TextField label="Rule name" required maxLength={120} placeholder="e.g. Engine service every 10,000 km" value={form.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} />
            <Select label="Category" options={MAINTENANCE_CATEGORIES} value={form.category} disabled={readOnly} onChange={(e) => set({ category: e.target.value })} />
          </div>

          <div className="maint-fieldset">
            <span className="maint-legend-label">Triggered by</span>
            <div className="maint-choice-grid">
              {RULE_TRIGGERS.map((t) => (
                <ChoiceCard key={t.value} selected={form.triggerType === t.value} icon={TRIGGER_ICON[t.value]} title={t.label} description={t.hint}
                  onSelect={() => !readOnly && set({ triggerType: t.value, dueSoon: t.value === "DAYS" ? "14" : t.value === "KM" ? "1000" : "50", interval: t.value === "DAYS" ? "180" : t.value === "KM" ? "10000" : "500" })} />
              ))}
            </div>
          </div>

          <div className="maint-form-grid three">
            <TextField label="Interval" suffix={unit} type="number" min={1} value={form.interval} disabled={readOnly} onChange={(e) => set({ interval: e.target.value })} />
            <TextField label="Warn when within" suffix={unit} hint="Truck shows as Due Soon" type="number" min={0} value={form.dueSoon} disabled={readOnly} onChange={(e) => set({ dueSoon: e.target.value })} />
            <TextField label="Grace period" suffix="days" hint="After due, before Overdue" type="number" min={0} max={60} value={form.graceDays} disabled={readOnly} onChange={(e) => set({ graceDays: e.target.value })} />
          </div>

          <div className="maint-enforce">
            <Switch checked={form.mandatory} disabled={readOnly} label="Mandatory" hint="Companies cannot turn off alerts for this rule." onChange={(v) => set({ mandatory: v, blocksAssignment: v ? form.blocksAssignment : false })} />
            <Switch checked={form.blocksAssignment} disabled={readOnly || !form.mandatory} label="Block new job assignments when overdue" hint="Enforced by the backend on bids, awards and reassignment. Active trips finish normally." onChange={(v) => set({ blocksAssignment: v })} />
          </div>

          <div className="maint-fieldset">
            <span className="maint-legend-label">Applies to</span>
            <div className="maint-check-row">
              <Checkbox checked={!form.vehicleClasses.length} disabled={readOnly} label="All trucks" onChange={() => set({ vehicleClasses: [] })} />
              {VEHICLE_CLASSES.map((c) => (
                <Checkbox key={c.value} checked={form.vehicleClasses.includes(c.value)} disabled={readOnly} label={c.label}
                  onChange={(on) => set({ vehicleClasses: on ? [...form.vehicleClasses, c.value] : form.vehicleClasses.filter((v) => v !== c.value) })} />
              ))}
            </div>
          </div>

          {!readOnly && (
            <div className="maint-impact">
              <div>
                <strong>Impact before you save</strong>
                {impact?.error ? <span className="tk-meta">{isPendingBackend(impact.error) ? "Impact preview is coming with the rules endpoint." : maintenanceError(impact.error)}</span>
                  : impact ? <span className="tk-meta">{count(impact.trucksInScope)} trucks in scope · <b style={{ color: "var(--tk-warning)" }}>{count(impact.wouldBeDue)} immediately due</b> · <b style={{ color: "var(--tk-danger)" }}>{count(impact.wouldBeRestricted)} would be blocked</b></span>
                  : <span className="tk-meta">See how many trucks become due or blocked the moment this rule goes live.</span>}
              </div>
              <Button size="sm" variant="outline" icon="scan-search" disabled={previewState.isLoading} onClick={runPreview}>{previewState.isLoading ? "Checking…" : "Check impact"}</Button>
            </div>
          )}

          {rule && !readOnly && <Textarea label="Reason for this change" required rows={2} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Recorded in the rule's version history and the audit log." />}
          {rule?.versions?.length ? (
            <div className="maint-versions">
              <span className="maint-legend-label">History</span>
              {rule.versions.map((v) => <div key={v.version}><b>v{v.version}</b> {v.changedAt} · {v.changedBy} — {v.reason}</div>)}
            </div>
          ) : null}
          {error && <span role="alert" className="tk-meta" style={{ color: "var(--tk-danger)" }}>{error}</span>}
        </div>
      </Modal>
      <ReasonModal
        open={archiving}
        title="Archive rule"
        description="The rule stops creating requirements. Its history is kept."
        confirmLabel="Archive rule"
        tone="danger"
        busy={archiveState.isLoading}
        onClose={() => setArchiving(false)}
        onConfirm={doArchive}
      />
    </>
  );
}
