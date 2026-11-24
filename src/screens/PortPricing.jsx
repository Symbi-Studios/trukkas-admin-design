"use client";
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Badge, Banner, Button, DataTable, EmptyState, Icon, Modal, Select, Switch, TextField } from "../ds.js";
import { Money } from "../components/finance/FinanceCells.jsx";
import { pricingError, useGetAdminPricingServiceFormOptionsQuery, useGetAdminPricingTerminalRatesQuery } from "../store/features/pricing/pricingApi.js";
import {
  fareForTruck, pricedEquipment, useGetAdminPortPricingQuery, useGetAdminPricingPortListQuery, useUpdateAdminPortPricingMutation,
} from "../store/features/pricing/portPricingApi.js";
import { RateEditDialog } from "./RateEditDialog.jsx";
import { DriverTableLoading } from "./DriversLoading.jsx";
import styles from "./PortPricing.module.css";
import "../components/finance/finance.css";

// Finance › Pricing › Port Rates: what one truck costs from each port (Agent Brain, section 07).
// Pick a port, then set a ₦/km rate and a minimum fee per piece of equipment, the fuel surcharge,
// peak pricing and the terminal handling fees. "Check a fare" works a trip through those rates.

const EDITORS = new Set(["SUPER_ADMIN", "FINANCE_ADMIN"]);
const naira = (value, digits = 0) => (Number.isFinite(value) ? `₦${value.toLocaleString("en-NG", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}` : "—");
const times = (value) => (Number.isFinite(value) ? `×${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : "—");
const isMoney = (value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
const sum = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a + b : null);

/** Edits one or more port values, showing each current value beside the new one. */
function PortValueDialog({ title, description, fields, onSave, onClose, children, valid = true }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.key, field.value == null ? "" : String(field.value)])));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldOk = (field) => (field.check ? field.check(values[field.key]) : isMoney(values[field.key]));
  const changed = fields.some((field) => fieldOk(field) && Number(values[field.key]) !== field.value);
  const ready = valid && fields.every(fieldOk) && (changed || children);

  async function save() {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try { await onSave(Object.fromEntries(fields.map((field) => [field.key, Number(values[field.key])]))); onClose(); }
    catch (failure) { setError(pricingError(failure)); setBusy(false); }
  }
  return (
    <Modal open width={520} title={title} description={description} onClose={() => { if (!busy) onClose(); }}
      footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!ready || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div style={{ display: "grid", gap: 16 }}>
        {error && <Banner tone="danger" title="Couldn't save">{error}</Banner>}
        {children}
        {fields.map((field) => {
          const ok = fieldOk(field), next = Number(values[field.key]);
          return (
            <div key={field.key} className={styles.field}>
              <TextField label={field.label} type="number" step="any" min={field.min ?? 0} money={field.money !== false} autoFocus={field === fields[0]}
                icon={field.money !== false ? "banknote" : undefined} suffix={field.suffix && <span className="tk-meta">{field.suffix}</span>}
                value={values[field.key]} disabled={busy || field.disabled}
                error={values[field.key].trim() !== "" && !ok ? field.error || "Enter ₦0 or more." : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                onKeyDown={(event) => { if (event.key === "Enter") save(); }} />
              <span className={styles.was}>
                Now <strong>{field.format(field.value)}</strong>
                {ok && next !== field.value && <> <Icon name="arrow-right" size={12} /> <strong className={styles.next}>{field.format(next)}</strong></>}
              </span>
            </div>
          );
        })}
        <p className="fin-note">Used for new quotes from this port straight away. Jobs already priced keep their price.</p>
      </div>
    </Modal>
  );
}

function EquipmentName({ row }) {
  const bulk = row.type === "TRUCK_TYPE";
  return (
    <span className={styles.equipment}>
      <span className={styles.equipmentIcon} data-bulk={bulk}><Icon name={bulk ? "truck" : "container"} size={16} /></span>
      <span className={styles.stack}><strong>{row.name}</strong><small>{bulk ? "Bulk break" : "Container"}</small></span>
    </span>
  );
}

function Lever({ icon, tone, label, value, hint, action }) {
  return (
    <div className={styles.lever}>
      <span className={styles.leverIcon} data-tone={tone}><Icon name={icon} size={18} /></span>
      <div className={styles.stack}>
        <span className={styles.leverLabel}>{label}</span>
        <strong className={styles.leverValue}>{value}</strong>
        <small>{hint}</small>
      </div>
      {action}
    </div>
  );
}

/** Works one trip through this port's rates so admins can sanity-check a change. */
function FareCheck({ equipment, fuel, peakOn, multiplier, terminals }) {
  const priced = equipment.filter((row) => Number.isFinite(row.ratePerKm) && Number.isFinite(row.minimumFee));
  const [pick, setPick] = useState(priced[0]?.key || "");
  const [km, setKm] = useState("40");
  const [trucks, setTrucks] = useState("1");
  const [terminalId, setTerminalId] = useState(terminals[0]?.terminalId || "");
  const row = priced.find((item) => item.key === pick) || priced[0];
  const terminal = terminals.find((item) => item.terminalId === terminalId) || terminals[0];
  const distance = Number(km), count = Math.floor(Number(trucks));
  const fare = row && Number.isFinite(fuel) && distance >= 0 && km.trim() !== ""
    ? fareForTruck({ km: distance, ratePerKm: row.ratePerKm, fuelPerKm: fuel, minimumFee: row.minimumFee, peakMultiplier: peakOn ? multiplier : null })
    : null;
  const validTrucks = count >= 1 && count <= 50;
  const handling = terminal?.value;

  if (!priced.length) return <p className="fin-note">Set a rate for at least one piece of equipment to check a fare.</p>;
  return (
    <div className={styles.check}>
      <div className={styles.checkInputs}>
        <Select label="Equipment" value={row?.key} options={priced.map((item) => ({ value: item.key, label: item.name }))} onChange={(event) => setPick(event.target.value)} />
        <TextField label="Road distance" type="number" min={0} step="any" value={km} suffix={<span className="tk-meta">km</span>} onChange={(event) => setKm(event.target.value)}
          hint="Terminal → delivery → container return, or terminal → drop-off terminal." error={km.trim() !== "" && !(distance >= 0) ? "Enter a distance." : undefined} />
        <div className={styles.checkPair}>
          <TextField label="Trucks" type="number" min={1} max={50} step={1} value={trucks} onChange={(event) => setTrucks(event.target.value)} error={trucks.trim() !== "" && !validTrucks ? "1 to 50" : undefined} />
          {terminals.length > 0 && <Select label="Pickup terminal" value={terminal?.terminalId} options={terminals.map((item) => ({ value: item.terminalId, label: item.terminalName }))} onChange={(event) => setTerminalId(event.target.value)} />}
        </div>
      </div>
      {fare && validTrucks ? (
        <ul className={`fin-breakdown ${styles.steps}`}>
          <li><span><strong>Distance fee</strong><small>{distance.toLocaleString("en-NG")} km × ({naira(row.ratePerKm)} + {naira(fuel)} fuel)</small></span><Money value={fare.distanceFee} strong={false} /></li>
          <li className={fare.usedMinimum ? undefined : styles.muted}><span><strong>Minimum fee</strong><small>{fare.usedMinimum ? "Applies: the distance fee is below the minimum" : "Not needed: the distance fee is higher"}</small></span><Money value={row.minimumFee} strong={false} /></li>
          {peakOn && Number.isFinite(multiplier) && <li><span><strong>Peak pricing</strong><small>{times(multiplier)} while peak is on</small></span><Money value={fare.peaked} strong={false} /></li>}
          <li><span><strong>Per truck</strong><small>Rounded to the nearest ₦10,000</small></span><Money value={fare.fare} /></li>
          {count > 1 && <li><span><strong>× {count} trucks</strong></span><Money value={fare.fare * count} strong={false} /></li>}
          <li><span><strong>Terminal handling fee</strong><small>{terminal ? `${terminal.terminalName}, once per job` : "No terminal at this port"}</small></span><Money value={handling} strong={false} /></li>
          <li className="total"><span><strong>Trip total</strong><small>Before surcharges, platform fee and VAT</small></span><Money value={sum(fare.fare * count, Number.isFinite(handling) ? handling : 0)} /></li>
        </ul>
      ) : <div className={styles.checkEmpty}><Icon name="calculator" size={20} /><span>Enter a distance and number of trucks to see the fare.</span></div>}
    </div>
  );
}

function PortPanel({ port, canEdit, notify }) {
  const admin = useSelector((state) => state.auth.admin);
  const pricingQuery = useGetAdminPortPricingQuery(port.id);
  const optionsQuery = useGetAdminPricingServiceFormOptionsQuery({ owner: admin?.id, role: admin?.role }, { skip: !admin?.id });
  const terminalQuery = useGetAdminPricingTerminalRatesQuery();
  const [save] = useUpdateAdminPortPricingMutation();
  const [dialog, setDialog] = useState(null);
  const [terminalEdit, setTerminalEdit] = useState(null);

  const pricing = pricingQuery.error ? null : pricingQuery.currentData;
  const unavailable = pricingQuery.error?.status === 404;
  const loading = pricingQuery.isFetching && !pricingQuery.currentData && !pricingQuery.error;
  const options = optionsQuery.error ? null : optionsQuery.currentData;
  const equipment = useMemo(() => pricedEquipment(options, pricing?.rates || []), [options, pricing]);
  const terminals = (terminalQuery.error ? [] : terminalQuery.currentData?.rows || [])
    .filter((row) => row.portId === port.id && row.key === "handlingFee")
    .map((row) => ({ ...row, terminalName: row.description.split(" / ").slice(1).join(" / ") || row.description }));
  const fuel = pricing?.fuelSurchargePerKm ?? null;
  const editable = canEdit && Boolean(pricing);
  const patch = (changes) => save({ portId: port.id, ...changes }).unwrap();

  const editRates = (row) => setDialog({
    title: `${row.name} rates`, description: `What one ${row.name} truck costs from ${port.name}.`,
    fields: [
      { key: "ratePerKm", label: "Rate per km", suffix: "per km", value: row.ratePerKm, format: (value) => naira(value, 2) },
      { key: "minimumFee", label: "Minimum fee", suffix: "per truck", value: row.minimumFee, format: (value) => naira(value) },
    ],
    // PROPOSED contract: equipmentRates updates only the rows it lists.
    onSave: (values) => patch({ equipmentRates: [{ type: row.type, id: row.id, ...values }] }).then(() => notify(`${row.name} rates updated for ${port.name}.`)),
  });
  const editFuel = () => setDialog({
    title: "Fuel surcharge", description: `Added to every km's rate for trips from ${port.name}.`,
    fields: [{ key: "fuelSurchargePerKm", label: "Fuel surcharge", suffix: "per km", value: fuel, format: (value) => naira(value, 2) }],
    onSave: (values) => patch(values).then(() => notify(`Fuel surcharge updated for ${port.name}.`)),
  });

  const columns = [
    { key: "equipment", header: "Equipment", render: (row) => <EquipmentName row={row} /> },
    { key: "rate", header: "Rate per km", align: "right", render: (row) => <Money value={row.ratePerKm} strong={false} /> },
    { key: "allIn", header: "With fuel", align: "right", render: (row) => sum(row.ratePerKm, fuel) == null ? <Money value={null} /> : <span className={styles.stackRight}><Money value={sum(row.ratePerKm, fuel)} /><small>per km</small></span> },
    { key: "minimum", header: "Minimum fee", align: "right", render: (row) => <Money value={row.minimumFee} strong={false} /> },
    { key: "edit", header: "", width: 80, render: (row) => <Button size="sm" variant="outline" icon="pencil" disabled={!editable} onClick={(event) => { event.stopPropagation(); editRates(row); }}>Edit</Button> },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.portIcon}><Icon name="anchor" size={20} /></span>
        <div className={styles.stack}>
          <h3>{port.name}</h3>
          <small>{[port.state, pricing?.updated && `Updated ${pricing.updated}${pricing.updatedBy ? ` by ${pricing.updatedBy}` : ""}`].filter(Boolean).join(" · ") || "—"}</small>
        </div>
        {port.isActive != null && <Badge tone={port.isActive ? "success" : "neutral"} dot>{port.isActive ? "Active" : "Paused"}</Badge>}
      </div>

      {port.isActive === false && <Banner inline tone="warning" title="This port is paused">Its rates are kept but no new jobs can be booked from it. Resume it in Settings › Ports & Terminals.</Banner>}
      {pricingQuery.error && (unavailable
        ? <Banner inline tone="warning" title="Port rates aren't available yet">The server doesn't support per-port pricing yet, so these rates can't be shown or changed. Terminal handling fees below are live.</Banner>
        : <Banner tone="danger" title="Unable to load this port's rates" action={<Button variant="outline" size="sm" onClick={pricingQuery.refetch}>Retry</Button>}>{pricingError(pricingQuery.error)}</Banner>)}
      {!canEdit && <Banner tone="info">Only Super Admins and Finance Admins can change prices.</Banner>}

      <div className={styles.levers}>
        <Lever icon="fuel" tone="amber" label="Fuel surcharge" value={Number.isFinite(fuel) ? `${naira(fuel, 2)} / km` : "—"} hint="Added to every equipment rate"
          action={<Button size="sm" variant="outline" icon="pencil" disabled={!editable} onClick={editFuel}>Edit</Button>} />
        <Lever icon="trending-up" tone={pricing?.peakEnabled ? "blue" : "neutral"} label="Peak pricing"
          value={pricing?.peakEnabled == null ? "—" : pricing.peakEnabled ? `On · ${times(pricing.peakMultiplier)}` : "Off"}
          hint={pricing?.peakEnabled ? "Every fare from this port is multiplied" : `Multiplier when on: ${times(pricing?.peakMultiplier)}`}
          action={<Switch checked={Boolean(pricing?.peakEnabled)} unknown={pricing?.peakEnabled == null} disabled={!editable} onChange={() => setDialog({ peak: true })} />} />
      </div>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div><h4>Equipment rates</h4><p>Distance × (rate + fuel), never less than the minimum fee. Prices are per truck.</p></div>
        </div>
        {loading || (optionsQuery.isFetching && !options) ? <DriverTableLoading columns={5} label="Loading port rates" />
          : optionsQuery.error && !equipment.length ? <Banner tone="danger" title="Unable to load equipment" action={<Button variant="outline" size="sm" onClick={optionsQuery.refetch}>Retry</Button>}>{pricingError(optionsQuery.error)}</Banner>
          : equipment.length ? <div className="fin-table"><DataTable rows={equipment} rowKey={(row) => row.key} columns={columns} onRowClick={editable ? editRates : undefined} /></div>
          : <EmptyState icon="truck" title="No equipment to price" description="Container sizes and the Flatbed and Lowbed truck types appear here once they're set up." />}
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div><h4>Terminal handling fees</h4><p>Charged once per job for the pickup terminal, as its own line on the quote.</p></div>
        </div>
        {terminalQuery.isFetching && !terminalQuery.currentData ? <DriverTableLoading columns={3} label="Loading terminals" />
          : terminalQuery.error ? <Banner tone="danger" title="Unable to load terminals" action={<Button variant="outline" size="sm" onClick={terminalQuery.refetch}>Retry</Button>}>{pricingError(terminalQuery.error)}</Banner>
          : terminals.length ? <ul className={styles.terminals}>
            {terminals.map((row) => (
              <li key={row.id} data-inactive={row.status !== "Active Terminal"}>
                <Icon name="warehouse" size={16} />
                <span className={styles.stack}><strong>{row.terminalName}</strong><small>{row.status === "Active Terminal" ? `Since ${row.effectiveFrom}` : "Inactive"}</small></span>
                <Money value={row.value} />
                <Button size="sm" variant="outline" icon="pencil" disabled={!canEdit || !row.editable} onClick={() => setTerminalEdit(row)}>Edit</Button>
              </li>
            ))}
          </ul>
          : <p className="fin-note">This port has no terminals. Add one in Settings › Ports & Terminals.</p>}
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div><h4>Check a fare</h4><p>Works a trip through this port's current rates, the same steps a quote follows.</p></div>
        </div>
        {pricing ? <FareCheck key={port.id} equipment={equipment} fuel={fuel} peakOn={pricing.peakEnabled} multiplier={pricing.peakMultiplier} terminals={terminals.filter((row) => row.status === "Active Terminal")} />
          : <p className="fin-note">Available once this port's rates load.</p>}
      </section>

      {dialog?.peak && <PeakDialog port={port} pricing={pricing} onClose={() => setDialog(null)} onSave={(changes) => patch(changes).then(() => notify(changes.peakEnabled ? `Peak pricing is on for ${port.name}.` : `Peak pricing is off for ${port.name}.`))} />}
      {dialog && !dialog.peak && <PortValueDialog {...dialog} onClose={() => setDialog(null)} />}
      {terminalEdit && <RateEditDialog key={terminalEdit.id} row={{ ...terminalEdit, name: `${terminalEdit.terminalName} handling fee`, description: "Charged once per job for this pickup terminal." }} onClose={() => setTerminalEdit(null)} onDone={notify} />}
    </div>
  );
}

function PeakDialog({ port, pricing, onSave, onClose }) {
  const [on, setOn] = useState(!pricing.peakEnabled);
  const field = { key: "peakMultiplier", label: "Multiplier", money: false, suffix: "×", min: 1, value: pricing.peakMultiplier, format: times,
    check: (value) => value.trim() !== "" && Number(value) >= 1 && Number(value) <= 5, error: "Enter a multiplier from 1 to 5." };
  return (
    <PortValueDialog title="Peak pricing" description={`Multiplies every fare from ${port.name} while it's on. Use it for congestion or high demand.`}
      fields={[field]} onClose={onClose} onSave={(values) => onSave({ peakEnabled: on, peakMultiplier: values.peakMultiplier })}>
      <Switch checked={on} onChange={setOn} label={on ? "Peak pricing on" : "Peak pricing off"} hint={on ? "New quotes from this port use the multiplier." : "New quotes use the normal rates. The multiplier is kept for next time."} />
    </PortValueDialog>
  );
}

export function PortPricing({ notify }) {
  const role = useSelector((state) => state.auth.admin?.role);
  const portsQuery = useGetAdminPricingPortListQuery();
  const ports = portsQuery.error ? [] : portsQuery.currentData || [];
  const [selected, setSelected] = useState(null);
  const port = ports.find((item) => item.id === selected) || ports[0];

  if (portsQuery.isFetching && !portsQuery.currentData) return <DriverTableLoading columns={4} label="Loading ports" />;
  if (portsQuery.error) return <Banner tone="danger" title="Unable to load ports" action={<Button variant="outline" size="sm" onClick={portsQuery.refetch}>Retry</Button>}>{pricingError(portsQuery.error)}</Banner>;
  if (!ports.length) return <EmptyState icon="anchor" title="No ports yet" description="Add a port in Settings › Ports & Terminals, then set its rates here." />;
  return (
    <div className={styles.layout}>
      <nav className={`fin-rates-nav ${styles.nav}`} aria-label="Ports">
        {ports.map((item) => (
          <button key={item.id} type="button" className={item.id === port.id ? "active" : undefined} aria-current={item.id === port.id ? "true" : undefined} onClick={() => setSelected(item.id)}>
            <Icon name="anchor" size={15} />
            <span>{item.name}</span>
            {item.isActive === false && <small>Paused</small>}
          </button>
        ))}
      </nav>
      <PortPanel key={port.id} port={port} canEdit={EDITORS.has(role)} notify={notify} />
    </div>
  );
}
