'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, Modal, Select, TextField } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { pricingError, useGetAdminPricingServiceQuery, useGetAdminPricingServiceFormOptionsQuery, useSaveAdminPricingServiceMutation } from '../store/features/pricing/pricingApi.js';
import { SERVICE_MOVEMENTS, SERVICE_CRITERIA, serviceFormFields, pricingServiceRoles } from '../store/features/pricing/pricingServiceContracts.js';

export function PricingServiceForm({ id, onClose, onDone }) {
  const admin = useSelector(state => state.auth.admin), authenticated = useSelector(state => Boolean(state.auth.accessToken));
  return <PricingServiceEditor key={[id, admin?.id, admin?.role, authenticated].join(':')} id={id} admin={admin} authenticated={authenticated} onClose={onClose} onDone={onDone} />;
}

function PricingServiceEditor({ id, admin, authenticated, onClose, onDone }) {
  const editing = Boolean(id), owner = admin?.id, role = admin?.role;
  const detail = useGetAdminPricingServiceQuery(id, { skip: !editing || !authenticated, refetchOnMountOrArgChange: true });
  const catalogue = useGetAdminPricingServiceFormOptionsQuery({ owner, role }, { skip: !authenticated || !owner, refetchOnMountOrArgChange: true });
  const [saveService, saving] = useSaveAdminPricingServiceMutation();
  const [draft, setDraft] = useState({ name: '', unit: '', basePrice: '', ...Object.fromEntries(SERVICE_CRITERIA.map(key => [key, key === 'cargoType' && !editing ? 'CONTAINER' : ''])) });
  const [error, setError] = useState(null), initialized = useRef(false), baseline = useRef(null), pending = useRef(false), active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const model = detail.error ? null : detail.currentData;
  useEffect(() => {
    if (editing && model && !initialized.current) {
      baseline.current = model;
      setDraft({ name: model.core.name ?? '', unit: model.core.unit ?? '', basePrice: model.core.basePrice == null ? '' : String(model.core.basePrice), ...Object.fromEntries(SERVICE_CRITERIA.map(key => [key, model.core[key] ?? ''])) });
      initialized.current = true;
    }
  }, [editing, model]);
  const loading = catalogue.isFetching || editing && (detail.isFetching || model && !initialized.current);
  const readError = catalogue.error || editing && detail.error;
  const ready = authenticated && pricingServiceRoles.has(role) && Boolean(catalogue.currentData) && !readError && !loading && (!editing || initialized.current && model?.statusCode === 'DRAFT');
  const busy = saving.isLoading;
  const valid = ready && draft.name.trim() && draft.name.trim().length <= 120 && catalogue.currentData.units.some(option => option.value === draft.unit) && catalogue.currentData.cargoTypes.some(option => option.value === draft.cargoType) && draft.basePrice.trim() !== '' && Number.isFinite(Number(draft.basePrice)) && Number(draft.basePrice) >= 0;
  const fields = () => serviceFormFields(draft, editing ? baseline.current?.core : null);
  const changed = !editing || Object.keys(fields()).length > 0;
  const change = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));
  function selector(key, label, options = [], required = false) {
    const value = draft[key];
    const current = value && !options.some(option => option.value === value) ? [{ value, label: '—' }] : [];
    const optional = !required && value ? [{ value: '', label: 'Any' }] : [];
    const unknown = editing && baseline.current?.core[key] === undefined && !value;
    return <Select label={label} value={value} options={[...optional, ...current, ...options]} placeholder={required ? key === 'unit' ? 'Select unit' : 'Select cargo type' : unknown ? '—' : 'Any'} disabled={!ready || busy} onChange={change(key)} />;
  }
  async function save() {
    if (!valid || !changed || pending.current) return;
    pending.current = true; setError(null);
    try {
      const saved = await saveService({ id, fields: fields(), owner, role, expectedUpdatedAt: baseline.current?.updatedAt }).unwrap();
      if (active.current) onDone(saved);
    } catch (requestError) { if (active.current) setError(pricingError(requestError)); }
    finally { pending.current = false; }
  }
  const options = catalogue.currentData || {};
  return <Modal open width={680} title={editing ? 'Edit Pricing' : 'Add Pricing'}
    description={editing ? 'Update this draft. Choose Any to clear an optional criterion. Changing cargo type clears incompatible equipment criteria.' : 'Create a draft service rate. Any optional criterion left blank matches all values.'}
    onClose={() => { if (!pending.current) onClose(); }}
    footer={<><Button variant="outline" disabled={busy} onClick={() => { if (!pending.current) onClose(); }}>Cancel</Button><Button disabled={!valid || !changed || busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Draft'}</Button></>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {(readError || error) && <Banner tone="danger" title="Unable to save pricing">{error || pricingError(readError)}</Banner>}
      {editing && model && model.statusCode !== 'DRAFT' && <Banner tone="warning">Only drafts can be edited. Duplicate a live rate to create a new draft.</Banner>}
      {loading ? <><DriverLoadingNotice>Loading pricing fields…</DriverLoadingNotice><DriverTableLoading columns={2} label="Loading pricing fields" /></> : <>
        <TextField label="Service" required maxLength={120} placeholder={editing && model?.core.name == null ? '—' : 'e.g. Apapa to Ogun 40ft'} value={draft.name} disabled={!ready || busy} onChange={change('name')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {selector('cargoType', 'Cargo Type', options.cargoTypes, true)}
          {selector('movementType', 'Movement Type', SERVICE_MOVEMENTS)}
          {selector('originPortId', 'Origin Port', options.ports)}
          {selector('originState', 'Origin State', options.states)}
          {selector('destinationPortId', 'Destination Port', options.ports)}
          {selector('destinationState', 'Destination State', options.states)}
          {draft.cargoType !== 'BULK_BREAK' && selector('containerSizeId', 'Container Size', options.containerSizes)}
          {draft.cargoType !== 'BULK_BREAK' && selector('containerTypeId', 'Container Type', options.containerTypes)}
          {draft.cargoType !== 'CONTAINER' && selector('truckTypeId', 'Truck Type', options.truckTypes)}
          {selector('unit', 'Unit', options.units, true)}
          <TextField label="Base Price (₦)" type="number" min={0} step="any" required placeholder={editing && model?.core.basePrice == null ? '—' : '350000'} value={draft.basePrice} disabled={!ready || busy} onChange={change('basePrice')} />
        </div>
      </>}
    </div>
  </Modal>;
}
