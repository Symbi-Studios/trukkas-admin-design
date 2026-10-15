'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, Modal, TextField, Select } from '../ds.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';
import { useChangeAdminVerificationMutation } from '../store/features/verification/verificationApi.js';

const TITLES = { create: 'New Verification', edit: 'Edit Verification Details', reassign: 'Reassign Verification', information: 'Request More Information', noncompliant: 'Mark as Non-Compliant', cancel: 'Cancel Verification', comment: 'Add Comment', note: 'Add Internal Note' };
const TYPES = ['ACCOUNT_REVIEW', 'BUSINESS_VERIFICATION', 'EXPORTER_LICENCE', 'TRUCK_REGISTRATION', 'COMPANY_DOCUMENT'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const split = (value) => [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))];

export function VerificationActionDialog({ action, model, canManage, onClose }) {
  const owner = useSelector((state) => state.auth.admin?.id);
  const role = useSelector((state) => state.auth.admin?.role);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [values, setValues] = useState({ entityId: '', verificationType: '', priority: model?.priorityCode || '', dueDate: '', clearDueDate: 'keep', assignedAdminId: model?.assignedAdminId || '', reason: '', message: '', requestedFields: '', documentTypes: '', documentIds: '', body: '' });
  const [error, setError] = useState(null);
  const [change, state] = useChangeAdminVerificationMutation();
  const pending = useRef(false);
  const versionRequired = !['create', 'comment', 'note'].includes(action);
  const hasVersion = Number.isInteger(model?.version) && model.version >= 0;
  const required = { create: ['entityId', 'verificationType'], edit: ['priority'], reassign: ['assignedAdminId'], information: ['message'], noncompliant: ['reason'], cancel: ['reason'], comment: ['body'], note: ['body'] }[action] || [];
  const valid = required.every((key) => values[key].trim()) && (!versionRequired || hasVersion) && (action !== 'create' || TYPES.includes(values.verificationType)) && (!['create', 'edit'].includes(action) || !values.priority || PRIORITIES.includes(values.priority)) && (action !== 'create' || !values.dueDate || !Number.isNaN(new Date(values.dueDate).getTime()));
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const input = (key, label, props = {}) => <TextField key={key} label={label} value={values[key]} onChange={set(key)} disabled={state.isLoading} {...props} />;
  async function save() {
    if (pending.current || !canManage || !valid) return;
    const body = versionRequired ? { expectedVersion: model.version } : {};
    if (action === 'create') {
      body.entityId = values.entityId.trim(); body.verificationType = values.verificationType;
      if (values.priority) body.priority = values.priority;
      if (values.dueDate) body.dueDate = new Date(values.dueDate).toISOString();
      if (values.assignedAdminId.trim()) body.assignedAdminId = values.assignedAdminId.trim();
      if (values.documentIds.trim()) body.documentIds = split(values.documentIds);
    } else if (action === 'edit') {
      body.priority = values.priority;
      if (values.clearDueDate === 'clear') body.dueDate = null;
      if (values.documentIds.trim()) {
        if (!Array.isArray(model.documentIds)) { setError('Current linked document IDs are unavailable. Refresh before attaching documents.'); return; }
        body.documentIds = [...new Set([...model.documentIds, ...split(values.documentIds)])];
      }
    } else if (action === 'reassign') {
      body.assignedAdminId = values.assignedAdminId.trim(); if (values.reason.trim()) body.reason = values.reason.trim();
    } else if (action === 'information') {
      body.message = values.message.trim();
      if (values.requestedFields.trim()) body.requestedFields = split(values.requestedFields);
      if (values.documentTypes.trim()) body.documentTypes = split(values.documentTypes);
    } else if (['cancel', 'noncompliant'].includes(action)) body.reason = values.reason.trim();
    else body.body = values.body.trim();
    pending.current = true; setError(null);
    try { await change({ action, id: model?.id, body, owner, role }).unwrap(); if (active.current) onClose(); }
    catch (requestError) { if (active.current) setError(getApiErrorMessage(requestError)); }
    finally { pending.current = false; }
  }
  return <Modal open title={TITLES[action]} description={model?.entityName} onClose={() => { if (!pending.current) onClose(); }} footer={<>
    <Button variant="outline" disabled={state.isLoading} onClick={() => { if (!pending.current) onClose(); }}>Cancel</Button>
    <Button disabled={state.isLoading || !canManage || !valid} onClick={save}>Save</Button>
  </>}>
    <div style={{ display: 'grid', gap: 16 }}>
      {error && <Banner tone="danger" title="Unable to save">{error}</Banner>}
      {versionRequired && !hasVersion && <Banner tone="warning" title="Version unavailable">Refresh the verification before saving.</Banner>}
      {action === 'create' && <>{input('entityId', 'Submitted entity ID', { required: true })}<Select label="Verification Type" placeholder="Select type" value={values.verificationType} onChange={set('verificationType')} disabled={state.isLoading} options={TYPES.map((v) => ({ value: v, label: v }))} /></>}
      {['create', 'edit'].includes(action) && <><Select label="Priority" placeholder="Select priority" value={values.priority} onChange={set('priority')} disabled={state.isLoading} options={PRIORITIES.map((v) => ({ value: v, label: v }))} />
        {action === 'create' ? input('dueDate', 'Due Date', { type: 'datetime-local' }) : <Select label="Due Date" value={values.clearDueDate} onChange={set('clearDueDate')} disabled={state.isLoading} options={[{ value: 'keep', label: 'Keep current date' }, { value: 'clear', label: 'Clear date' }]} />}
        {input('documentIds', 'Company document IDs to attach (comma-separated)', { disabled: state.isLoading || action === 'edit' && !Array.isArray(model.documentIds), hint: action === 'edit' && !Array.isArray(model.documentIds) ? 'Current linked document IDs are unavailable.' : undefined })}
      </>}
      {['create', 'reassign'].includes(action) && input('assignedAdminId', 'Assigned admin ID', { required: action === 'reassign' })}
      {['reassign', 'noncompliant', 'cancel'].includes(action) && input('reason', 'Reason', { required: action !== 'reassign' })}
      {action === 'information' && <>{input('message', 'Message', { required: true })}{input('requestedFields', 'Requested fields (comma-separated)')}{input('documentTypes', 'Document types (comma-separated)')}</>}
      {['comment', 'note'].includes(action) && input('body', action === 'comment' ? 'Comment' : 'Internal note', { required: true })}
    </div>
  </Modal>;
}
