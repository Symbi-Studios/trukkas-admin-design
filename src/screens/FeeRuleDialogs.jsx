'use client';

import { useRef, useState } from 'react';
import { Banner, Button, Modal, TextField } from '../ds.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { editableFeeRule, feeNumber, validFeeValue, useUpdateAdminFeeRuleMutation, useBulkUpdateAdminFeeRulesMutation } from '../store/features/fees/feesApi.js';

export function FeeRuleEditDialog({ rule, canManage, onClose }) {
  const [value, setValue] = useState(rule.numericValue == null ? '' : String(rule.numericValue));
  const [error, setError] = useState(null);
  const [update, state] = useUpdateAdminFeeRuleMutation();
  const pending = useRef(false);
  const valid = editableFeeRule(rule) && validFeeValue(rule, value) && feeNumber(value) !== rule.numericValue;
  async function save() {
    if (pending.current || state.isLoading || !canManage || !valid) return;
    pending.current = true; setError(null);
    try { await update({ rule, value }).unwrap(); onClose(); }
    catch (requestError) { setError(getApiErrorMessage(requestError)); }
    finally { pending.current = false; }
  }
  return <Modal open title="Edit Fee Rule" description={rule.name} onClose={() => { if (!pending.current) onClose(); }} footer={<>
    <Button variant="outline" disabled={state.isLoading} onClick={() => { if (!pending.current) onClose(); }}>Cancel</Button>
    <Button disabled={state.isLoading || !canManage || !valid} onClick={save}>Save</Button>
  </>}>
    {error && <Banner tone="danger" title="Unable to save">{error}</Banner>}
    <TextField label={rule.calculationType === 'FLAT' ? 'Amount (₦)' : 'Rate (%)'} type="number" min="0" max={rule.calculationType === 'FLAT' ? 10000000 : 100} step="0.01" required value={value} disabled={state.isLoading} onChange={(event) => setValue(event.target.value)} />
  </Modal>;
}

export function FeeRulesBulkDialog({ rules, canManage, onClose }) {
  const [editable] = useState(() => rules.filter(editableFeeRule));
  const baseline = useRef(new Map(editable.map((rule) => [rule.id, rule])));
  const [values, setValues] = useState(() => Object.fromEntries(editable.map((rule) => [rule.id, String(rule.numericValue)])));
  const [error, setError] = useState(null);
  const [update, state] = useBulkUpdateAdminFeeRulesMutation();
  const pending = useRef(false);
  const invalid = editable.some((rule) => !validFeeValue(rule, values[rule.id]));
  const updates = editable.filter((rule) => feeNumber(values[rule.id]) !== baseline.current.get(rule.id)?.numericValue).map((rule) => ({ rule: baseline.current.get(rule.id), value: values[rule.id] }));
  async function save() {
    if (pending.current || state.isLoading || !canManage || invalid || !updates.length) return;
    pending.current = true; setError(null);
    try {
      const result = await update({ updates }).unwrap();
      for (const rule of result.verified) baseline.current.set(rule.id, rule);
      if (result.failures.length || result.reportedFailureCount > 0) {
        setError(result.verified.length + ' of ' + updates.length + ' requested values confirmed. ' + (result.failures.length ? 'Review: ' + result.failures.map((item) => item.id + ': ' + item.message).join('; ') + '.' : 'The backend reported failures; review the updated values.'));
      } else onClose();
    } catch (requestError) { setError(getApiErrorMessage(requestError) + ' Some changes may have applied. Refresh and review their values before retrying.'); }
    finally { pending.current = false; }
  }
  return <Modal open title="Bulk Update Fees" onClose={() => { if (!pending.current) onClose(); }} footer={<>
    <Button variant="outline" disabled={state.isLoading} onClick={() => { if (!pending.current) onClose(); }}>Cancel</Button>
    <Button disabled={state.isLoading || !canManage || invalid || !updates.length} onClick={save}>Save</Button>
  </>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger" title="Review fee changes">{error}</Banner>}
      {editable.map((rule) => <TextField key={rule.id} label={rule.name + (rule.calculationType === 'FLAT' ? ' — Amount (₦)' : ' — Rate (%)')} type="number" min="0" max={rule.calculationType === 'FLAT' ? 10000000 : 100} step="0.01" required value={values[rule.id]} disabled={state.isLoading} onChange={(event) => setValues((current) => ({ ...current, [rule.id]: event.target.value }))} />)}
    </div>
  </Modal>;
}
