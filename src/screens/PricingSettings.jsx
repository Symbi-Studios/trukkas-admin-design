"use client";
import { useState } from 'react';
import { Banner, Button, Card, Modal, Select, Skeleton, StatCard, TextField } from '../ds.js';
import { DriverLoadingNotice, DriverTableLoading } from './DriversLoading.jsx';
import { pricingError, useUpdateAdminPricingConfigMutation, useUpdateAdminPricingTerminalRateMutation } from '../store/features/pricing/pricingApi.js';
import './PricingManagement.css';

export function PricingSettingModal({ row, onClose, onDone }) {
  const [value, setValue] = useState(String(row.value ?? '')), [error, setError] = useState(null);
  const [updateConfig, configState] = useUpdateAdminPricingConfigMutation();
  const [updateTerminal, terminalState] = useUpdateAdminPricingTerminalRateMutation();
  const busy = configState.isLoading || terminalState.isLoading;
  const parsed = Number(value);
  const valid = row.options ? row.options.includes(value) : value.trim() !== '' && Number.isFinite(parsed) && parsed >= row.min && (row.max == null || parsed <= row.max);
  async function save() {
    if (!valid || busy) return;
    setError(null);
    try {
      if (row.source === 'config') await updateConfig({ key: row.key, value: row.options ? value : parsed }).unwrap();
      else await updateTerminal({ id: row.terminalId, key: row.key, value: parsed }).unwrap();
      onDone?.(`${row.name} updated.`); onClose();
    } catch (requestError) { setError(pricingError(requestError)); }
  }
  return <Modal open title={`Edit ${row.name}`} description={row.source === 'config' ? 'This change applies to the platform configuration.' : `This change applies to ${row.appliesTo}.`} onClose={() => { if (!busy) onClose(); }} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={!valid || busy || value === String(row.value)} onClick={save}>{busy ? 'Saving…' : 'Save Changes'}</Button></>}>
    <div style={{ display: 'grid', gap: 16 }}>{error && <Banner tone="danger" title="Unable to update pricing">{error}</Banner>}<p className="tk-meta" style={{ margin: 0 }}>{row.description}</p>{row.options ? <Select label={row.name} options={row.options} value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} /> : <TextField label={`${row.name} (${row.unit})`} type="number" min={row.min} max={row.max} step="any" value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} hint={`Minimum: ${row.min}${row.max == null ? '' : ` · Maximum: ${row.max}`}`} />}</div>
  </Modal>;
}
export function PricingLoading() {
  return <div className="pricing-loading" aria-busy="true"><Skeleton width={260} height={28} /><Skeleton width="60%" height={14} /><DriverLoadingNotice>Loading pricing settings…</DriverLoadingNotice><div className="pricing-stats">{['Active Price Lists', 'Total Services', 'Avg. Price Change', 'Price Exceptions', 'Surcharges Active', 'Currency'].map((label) => <StatCard key={label} icon="coins" label={label} value={<Skeleton as="span" width={65} height={23} />} caption={<Skeleton as="span" width={100} height={11} />} />)}</div><div className="pricing-layout"><Card pad="none"><DriverTableLoading columns={6} label="Loading pricing settings" /></Card><div style={{ display: 'grid', gap: 20 }}>{[0, 1, 2].map((item) => <Card key={item}><Skeleton width="60%" height={18} /><Skeleton height={140} style={{ marginTop: 20 }} /></Card>)}</div></div></div>;
}
