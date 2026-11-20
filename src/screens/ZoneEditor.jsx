"use client";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Banner, Button, IconButton, Modal, Select, TextField } from "../ds.js";
import { pricingError, useGetAdminPricingServiceFormOptionsQuery } from "../store/features/pricing/pricingApi.js";
import { useGetAdminPricingZoneQuery, useSaveAdminPricingZoneMutation } from "../store/features/pricing/zonePricingApi.js";
import { usePublishPricing } from "../store/features/pricing/usePublishPricing.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import "../components/finance/finance.css";

// Create or edit a pricing zone: a name, an optional origin, and a price per destination state.
const blankRate = () => ({ key: Math.random().toString(36).slice(2), destinationState: "", cargoType: "", containerSizeId: "", truckTypeId: "", unit: "PER_TRUCK", price: "", minimumCharge: "" });
const ANY = { value: "", label: "Any" };

export function ZoneEditor({ id, onClose, onDone }) {
  const owner = useSelector((state) => state.auth.admin?.id), role = useSelector((state) => state.auth.admin?.role);
  const editing = Boolean(id);
  const zoneQuery = useGetAdminPricingZoneQuery(id, { skip: !editing, refetchOnMountOrArgChange: true });
  const optionsQuery = useGetAdminPricingServiceFormOptionsQuery({ owner, role }, { skip: !owner });
  const [saveZone, saveState] = useSaveAdminPricingZoneMutation();
  const publisher = usePublishPricing();
  const zone = zoneQuery.error ? null : zoneQuery.currentData;
  const options = optionsQuery.currentData;
  const [header, setHeader] = useState({ name: "", region: "", originPortId: "", originState: "" });
  const [rates, setRates] = useState(() => [blankRate()]);
  const [error, setError] = useState(null);
  const loaded = useRef(false);
  useEffect(() => {
    if (!zone || loaded.current) return;
    loaded.current = true;
    setHeader({ name: zone.name === "—" ? "" : zone.name, region: zone.region === "—" ? "" : zone.region, originPortId: zone.originPortId, originState: zone.originState });
    setRates(zone.rates.length ? zone.rates.map((rate) => ({ ...rate, key: rate.id, price: rate.price == null ? "" : String(rate.price), minimumCharge: rate.minimumCharge == null ? "" : String(rate.minimumCharge) })) : [blankRate()]);
  }, [zone]);

  const busy = saveState.isLoading || publisher.busy;
  const loading = !options || (editing && !zone);
  const rowValid = (rate) => rate.destinationState && rate.price !== "" && Number(rate.price) >= 0 && (rate.minimumCharge === "" || Number(rate.minimumCharge) >= 0);
  const valid = header.name.trim() && header.region.trim() && rates.length > 0 && rates.every(rowValid);
  const states = options?.states || [];
  const used = (rate) => rates.filter((other) => other.key !== rate.key && other.destinationState === rate.destinationState && other.cargoType === rate.cargoType && other.containerSizeId === rate.containerSizeId && other.truckTypeId === rate.truckTypeId).length > 0;
  const update = (key, patch) => setRates((current) => current.map((rate) => (rate.key === key ? { ...rate, ...patch } : rate)));

  async function save() {
    if (!valid || busy) return;
    setError(null);
    try {
      const saved = await saveZone({ zone, header, rates }).unwrap();
      const published = await publisher.publish(saved);
      onDone(published);
    } catch (failure) { setError(pricingError(failure)); }
  }

  return (
    <Modal open width={980} title={editing ? "Edit zone" : "New zone"}
      description="Price trips by destination state. Zone prices apply to any truck that no rate card covers."
      onClose={() => { if (!busy) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={!valid || busy || loading} onClick={save}>{busy ? "Saving…" : publisher.canActivate ? "Save & publish" : "Save & submit"}</Button>
      </>}>
      {error && <Banner tone="danger" title="Couldn't save this zone" style={{ marginBottom: 14 }}>{error}</Banner>}
      {(zoneQuery.error || optionsQuery.error) && <Banner tone="danger" title="Couldn't load the zone">{pricingError(zoneQuery.error || optionsQuery.error)}</Banner>}
      {editing && zone && zone.statusCode === "ACTIVE" && <Banner tone="info" style={{ marginBottom: 14 }}>Saving replaces the live zone from now on.</Banner>}
      {loading ? <DriverTableLoading columns={4} label="Loading zone" /> : (
        <div style={{ display: "grid", gap: 18 }}>
          <div className="fin-zone-header">
            <TextField label="Zone name" required placeholder="e.g. South West" value={header.name} disabled={busy} onChange={(e) => setHeader({ ...header, name: e.target.value })} />
            <TextField label="Region" required placeholder="e.g. Lagos & Ogun" value={header.region} disabled={busy} onChange={(e) => setHeader({ ...header, region: e.target.value })} />
            <Select label="From port" value={header.originPortId} options={[{ value: "", label: "Any port" }, ...options.ports]} disabled={busy} onChange={(e) => setHeader({ ...header, originPortId: e.target.value })} />
            <Select label="From state" value={header.originState} options={[{ value: "", label: "Any state" }, ...states]} disabled={busy} onChange={(e) => setHeader({ ...header, originState: e.target.value })} />
          </div>

          <div className="fin-zone-rates">
            <div className="fin-zone-row fin-zone-head">
              <span>Destination state</span><span>Cargo</span><span>Equipment</span><span>Charged</span><span>Price (₦)</span><span>Minimum (₦)</span><span />
            </div>
            {rates.map((rate) => (
              <div key={rate.key} className={"fin-zone-row" + (used(rate) ? " duplicate" : "")}>
                <Select aria-label="Destination state" value={rate.destinationState} placeholder="Choose state" options={states} disabled={busy} onChange={(e) => update(rate.key, { destinationState: e.target.value })} />
                <Select aria-label="Cargo" value={rate.cargoType} options={[ANY, ...options.cargoTypes]} disabled={busy} onChange={(e) => update(rate.key, { cargoType: e.target.value, containerSizeId: "", truckTypeId: "" })} />
                {rate.cargoType === "BULK_BREAK"
                  ? <Select aria-label="Truck type" value={rate.truckTypeId} options={[{ value: "", label: "Any truck" }, ...options.truckTypes]} disabled={busy} onChange={(e) => update(rate.key, { truckTypeId: e.target.value })} />
                  : <Select aria-label="Container size" value={rate.containerSizeId} options={[{ value: "", label: rate.cargoType ? "Any size" : "Any" }, ...options.containerSizes]} disabled={busy || !rate.cargoType} onChange={(e) => update(rate.key, { containerSizeId: e.target.value })} />}
                <Select aria-label="Charged" value={rate.unit} options={options.units} disabled={busy} onChange={(e) => update(rate.key, { unit: e.target.value })} />
                <TextField aria-label="Price" type="number" min={0} step="any" money placeholder="0.00" value={rate.price} disabled={busy} onChange={(e) => update(rate.key, { price: e.target.value })} />
                <TextField aria-label="Minimum charge" type="number" min={0} step="any" money placeholder="None" value={rate.minimumCharge} disabled={busy} onChange={(e) => update(rate.key, { minimumCharge: e.target.value })} />
                <IconButton icon="trash-2" label="Remove row" disabled={busy || rates.length === 1} onClick={() => setRates((current) => current.filter((other) => other.key !== rate.key))} />
              </div>
            ))}
            <Button variant="outline" icon="plus" size="sm" disabled={busy} onClick={() => setRates((current) => [...current, blankRate()])} style={{ justifySelf: "start" }}>Add state rate</Button>
            {rates.some(used) && <p className="fin-note" style={{ color: "var(--tk-warning)" }}>Two rows price the same state and equipment; the most specific one wins.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
