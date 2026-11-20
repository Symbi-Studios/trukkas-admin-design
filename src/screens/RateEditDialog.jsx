"use client";
import { useState } from "react";
import { Banner, Button, Icon, Modal, TextField } from "../ds.js";
import { pricingError, useUpdateAdminPricingConfigMutation, useUpdateAdminPricingTerminalRateMutation } from "../store/features/pricing/pricingApi.js";
import "../components/finance/finance.css";

// One editor for a single platform rate (config) or terminal rate (per-km fare, handling fee):
// shows the current value, the new value with its unit, and the size of the change before saving.

const naira = (value) => `₦${Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function display(value, unit) {
  if (value == null || !Number.isFinite(Number(value))) return "Not set";
  if (unit === "NGN") return naira(value);
  if (unit === "NGN/day") return `${naira(value)} / day`;
  if (unit === "NGN/km") return `${naira(value)} / km`;
  if (unit === "%") return `${Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`;
  if (unit === "minutes") {
    const minutes = Number(value), days = minutes / 1440, hours = minutes / 60;
    return `${minutes.toLocaleString("en-NG")} min${Number.isInteger(days) && days > 0 ? ` · ${days} day${days === 1 ? "" : "s"}` : Number.isInteger(hours) && hours > 0 ? ` · ${hours} hr${hours === 1 ? "" : "s"}` : ""}`;
  }
  return `${Number(value).toLocaleString("en-NG")} ${unit}`;
}
const suffixFor = (unit) => ({ "%": "%", "NGN/day": "per day", "NGN/km": "per km", minutes: "minutes", hours: "hours" })[unit];

export function RateEditDialog({ row, onClose, onDone, readOnly = false }) {
  const [value, setValue] = useState(row.value == null ? "" : String(row.value));
  const [error, setError] = useState(null);
  const [updateConfig, configState] = useUpdateAdminPricingConfigMutation();
  const [updateTerminal, terminalState] = useUpdateAdminPricingTerminalRateMutation();
  const busy = configState.isLoading || terminalState.isLoading;
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= (row.min ?? 0) && (row.max == null || parsed <= row.max);
  const changed = valid && parsed !== row.value;
  const delta = changed && row.value > 0 ? ((parsed - row.value) / row.value) * 100 : null;
  const money = typeof row.unit === "string" && row.unit.startsWith("NGN");

  async function save() {
    if (!changed || busy || readOnly) return;
    setError(null);
    try {
      if (row.source === "terminal") await updateTerminal({ id: row.terminalId, portId: row.portId, key: row.key, value: parsed, expectedValue: row.value }).unwrap();
      else await updateConfig({ key: row.key, value: parsed, expectedValue: row.value }).unwrap();
      onDone?.(`${row.name} updated to ${display(parsed, row.unit)}.`);
      onClose();
    } catch (failure) { setError(pricingError(failure)); }
  }

  return (
    <Modal open width={520} title={`Edit ${row.name}`} description={row.description} onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={readOnly || !changed || busy} onClick={save}>{busy ? "Saving…" : "Save rate"}</Button>
      </>}>
      <div style={{ display: "grid", gap: 16 }}>
        {error && <Banner tone="danger" title="Couldn't save this rate">{error}</Banner>}
        {readOnly && <Banner tone="info">Only Super Admins can change platform rates.</Banner>}
        <div className="fin-rate-compare">
          <div>
            <span>Current</span>
            <strong>{display(row.value, row.unit)}</strong>
            {row.effectiveFrom && row.effectiveFrom !== "—" && <small>Since {row.effectiveFrom}</small>}
          </div>
          <Icon name="arrow-right" size={18} />
          <div className={changed ? "next" : undefined}>
            <span>New</span>
            <strong>{valid ? display(parsed, row.unit) : "—"}</strong>
            {delta != null && <small className={delta > 0 ? "up" : "down"}>{delta > 0 ? "+" : ""}{delta.toLocaleString("en-NG", { maximumFractionDigits: 1 })}%</small>}
          </div>
        </div>
        <TextField label="New value" autoFocus type="number" step="any" min={row.min} max={row.max} money={money} value={value} disabled={busy || readOnly}
          icon={money ? "banknote" : undefined} suffix={suffixFor(row.unit) && <span className="tk-meta">{suffixFor(row.unit)}</span>}
          error={value.trim() !== "" && !valid ? `Enter a value${row.min != null ? ` of at least ${row.min}` : ""}${row.max != null ? ` and at most ${row.max}` : ""}.` : undefined}
          hint={row.appliesTo ? `Applies to: ${row.appliesTo}` : undefined}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") save(); }} />
        <p className="fin-note">{row.source === "terminal" ? "Used for new quotes from this terminal straight away." : "Takes effect for new jobs and charges straight away. Existing ones keep the rate they started with."}</p>
      </div>
    </Modal>
  );
}
