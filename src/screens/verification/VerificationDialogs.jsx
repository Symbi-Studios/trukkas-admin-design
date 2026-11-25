'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { Banner, Button, Modal, Select, TextField, Textarea } from '../../ds.js';
import { useNavigate } from '../../router.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { useChangeAdminVerificationMutation, useDecideAdminVerificationMutation, verificationDetailUrl } from '../../store/features/verification/verificationApi.js';
import { useGetAdminTicketAgentsQuery } from '../../store/features/tickets/ticketsApi.js';
import { showToast } from '../../components/ActionToast.jsx';
import { CustomerPicker } from '../support/NewTicketDialog.jsx';
import { CASE_TYPES, PRIORITY_OPTIONS } from './verificationQueue.js';
import styles from './Verification.module.css';

const split = (value) => [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))];
const toLocalInput = (raw) => {
  const t = Date.parse(raw || ''); if (Number.isNaN(t)) return '';
  const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function useAdmins() {
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  const me = useSelector((state) => state.auth.admin?.id);
  const query = useGetAdminTicketAgentsQuery(undefined, { skip: !authenticated });
  const admins = (query.currentData || []).filter((agent) => agent.isActive !== false);
  return { me, loading: query.isLoading, options: admins.map((agent) => ({ value: agent.id, label: agent.id === me ? `${agent.name} (you)` : agent.name })) };
}

function useSession() {
  return { owner: useSelector((state) => state.auth.admin?.id), role: useSelector((state) => state.auth.admin?.role) };
}

/** Shared modal shell: inline error, a lock while saving, and Escape only when idle. */
function ActionModal({ title, description, submitLabel, tone = 'primary', ready, saving, error, onSubmit, onClose, children, width = 520 }) {
  return (
    <Modal open title={title} description={description} width={width} onClose={() => { if (!saving) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={saving} disabled={!ready} onClick={onSubmit}>{submitLabel}</Button>
      </>}>
      <form className={styles.formGrid} onSubmit={(event) => { event.preventDefault(); if (ready && !saving) onSubmit(); }}>
        {error && <Banner tone="danger" title="That didn’t go through">{error}</Banner>}
        {children}
      </form>
    </Modal>
  );
}

export function NewVerificationDialog({ onClose }) {
  const navigate = useNavigate();
  const { owner, role } = useSession();
  const admins = useAdmins();
  const [customer, setCustomer] = React.useState(null);
  const [values, setValues] = React.useState({ verificationType: '', priority: 'NORMAL', assignedAdminId: '', dueDate: '' });
  const [error, setError] = React.useState('');
  const [change, state] = useChangeAdminVerificationMutation();
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const ready = Boolean(customer && values.verificationType) && !state.isLoading;

  async function submit() {
    setError('');
    const body = { entityId: customer.id, verificationType: values.verificationType, priority: values.priority };
    if (values.assignedAdminId) body.assignedAdminId = values.assignedAdminId;
    if (values.dueDate) body.dueDate = new Date(values.dueDate).toISOString();
    try {
      const saved = await change({ action: 'create', body, owner, role }).unwrap();
      showToast('Verification case opened');
      onClose();
      navigate(verificationDetailUrl({ reviewId: saved.verificationId }));
    } catch (failure) { setError(getApiErrorMessage(failure)); }
  }

  return (
    <ActionModal title="Open a verification case" description="Use this to review an account outside the normal sign-up flow." submitLabel="Open case"
      ready={ready} saving={state.isLoading} error={error} onSubmit={submit} onClose={onClose} width={560}>
      <CustomerPicker value={customer} onChange={setCustomer} disabled={state.isLoading} />
      <Select label="What to verify" placeholder="Choose a check" value={values.verificationType} options={CASE_TYPES} disabled={state.isLoading} onChange={set('verificationType')} />
      <div className={styles.formRow}>
        <Select label="Priority" value={values.priority} options={PRIORITY_OPTIONS} disabled={state.isLoading} onChange={set('priority')} />
        <TextField label="Due" type="datetime-local" value={values.dueDate} disabled={state.isLoading} onChange={set('dueDate')} />
      </div>
      <Select label="Assign to" value={values.assignedAdminId} disabled={state.isLoading || admins.loading}
        options={[{ value: '', label: 'Unassigned' }, ...admins.options]} onChange={set('assignedAdminId')} />
    </ActionModal>
  );
}

const COPY = {
  approve: { title: 'Approve verification', submit: 'Approve' },
  reject: { title: 'Reject verification', submit: 'Reject', tone: 'danger', reasonLabel: 'Reason', reasonHint: 'The customer sees this reason in the app.' },
  noncompliant: { title: 'Mark as non-compliant', submit: 'Mark non-compliant', tone: 'danger', reasonLabel: 'Reason', reasonHint: 'Recorded on the verification case.' },
  cancel: { title: 'Cancel verification case', submit: 'Cancel case', tone: 'danger', reasonLabel: 'Reason', reasonHint: 'Closes the case without a decision.' },
  information: { title: 'Request more information', submit: 'Send request' },
  reassign: { title: 'Assign verification', submit: 'Save' },
  edit: { title: 'Priority and due date', submit: 'Save' },
};

function ApproveSummary({ model }) {
  const p = model.progress;
  const open = p ? p.total - p.completed : 0;
  return <>
    <p className="tk-body" style={{ margin: 0 }}>This approves <strong>{model.entityName}</strong>’s {(model.documentType || model.type).toLowerCase()} and notifies them in the app.</p>
    {open > 0 && <Banner tone="warning" title={`${open} of ${p.total} requirements aren’t verified yet`}>Approving now accepts the item as it is.</Banner>}
    {model.riskSignals.length > 0 && <Banner tone="warning" title="Risk signals">{model.riskSignals.join('; ')}</Banner>}
  </>;
}

export function VerificationActionDialog({ action, model, onClose }) {
  const { owner, role } = useSession();
  const admins = useAdmins();
  const copy = COPY[action];
  const [values, setValues] = React.useState({
    reason: '', message: '', requestedFields: '', documentTypes: '',
    assignedAdminId: model.assignedAdminId || '', priority: model.priorityCode || 'NORMAL', dueDate: toLocalInput(model.dueDateRaw),
  });
  const [error, setError] = React.useState('');
  const [change, changeState] = useChangeAdminVerificationMutation();
  const [decide, decideState] = useDecideAdminVerificationMutation();
  const saving = changeState.isLoading || decideState.isLoading;
  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const needsVersion = !['reject', 'approve'].includes(action);
  const hasVersion = Number.isInteger(model.version);
  const reasonOk = values.reason.trim().length > 0 && values.reason.trim().length <= 500;
  const ready = !saving && (!needsVersion || hasVersion) && (
    action === 'approve' ? true
      : ['reject', 'noncompliant', 'cancel'].includes(action) ? reasonOk
      : action === 'information' ? values.message.trim().length > 0
        : action === 'reassign' ? Boolean(values.assignedAdminId) && values.assignedAdminId !== model.assignedAdminId
          : action === 'edit' ? Boolean(values.priority) : false);

  async function submit() {
    setError('');
    try {
      if (action === 'approve' || action === 'reject') {
        const result = await decide({ id: model.id, decision: action, reason: values.reason, owner, role }).unwrap();
        showToast(result.message);
      } else {
        const body = { expectedVersion: model.version };
        if (['noncompliant', 'cancel'].includes(action)) body.reason = values.reason.trim();
        if (action === 'information') {
          body.message = values.message.trim();
          if (values.requestedFields.trim()) body.requestedFields = split(values.requestedFields);
          if (values.documentTypes.trim()) body.documentTypes = split(values.documentTypes);
        }
        if (action === 'reassign') { body.assignedAdminId = values.assignedAdminId; if (values.reason.trim()) body.reason = values.reason.trim(); }
        if (action === 'edit') {
          body.priority = values.priority;
          const before = toLocalInput(model.dueDateRaw);
          if (values.dueDate !== before) body.dueDate = values.dueDate ? new Date(values.dueDate).toISOString() : null;
        }
        await change({ action, id: model.id, body, owner, role }).unwrap();
        showToast({ noncompliant: 'Marked non-compliant', cancel: 'Verification case cancelled', information: 'Information requested', reassign: 'Verification assigned', edit: 'Verification updated' }[action]);
      }
      onClose();
    } catch (failure) { setError(getApiErrorMessage(failure)); }
  }

  return (
    <ActionModal title={copy.title} description={model.entityName} submitLabel={copy.submit} tone={copy.tone}
      ready={ready} saving={saving} error={error} onSubmit={submit} onClose={onClose}>
      {needsVersion && !hasVersion && <Banner tone="warning" title="Refresh needed">This verification has no version number yet. Reload the page and try again.</Banner>}
      {action === 'approve' && <ApproveSummary model={model} />}
      {copy.reasonLabel && <>
        <Textarea label={copy.reasonLabel} rows={4} maxLength={500} value={values.reason} disabled={saving} onChange={set('reason')} autoFocus />
        <p className={styles.hint}>{copy.reasonHint}</p>
      </>}
      {action === 'information' && <>
        <Textarea label="Message to the customer" rows={4} value={values.message} disabled={saving} onChange={set('message')} autoFocus
          placeholder="What do they need to send or correct?" />
        <TextField label="Fields to update (optional)" placeholder="e.g. address, rcNumber" value={values.requestedFields} disabled={saving} onChange={set('requestedFields')} />
        <TextField label="Documents to upload (optional)" placeholder="e.g. PROOF_OF_ADDRESS" value={values.documentTypes} disabled={saving} onChange={set('documentTypes')} />
        <p className={styles.hint}>Separate several with commas.</p>
      </>}
      {action === 'reassign' && <>
        <Select label="Assign to" placeholder={admins.loading ? 'Loading admins…' : 'Choose an admin'} value={values.assignedAdminId}
          options={admins.options} disabled={saving || admins.loading} onChange={set('assignedAdminId')} />
        <TextField label="Note (optional)" value={values.reason} disabled={saving} onChange={set('reason')} />
      </>}
      {action === 'edit' && <div className={styles.formRow}>
        <Select label="Priority" value={values.priority} options={PRIORITY_OPTIONS} disabled={saving} onChange={set('priority')} />
        <TextField label="Due" type="datetime-local" value={values.dueDate} disabled={saving} onChange={set('dueDate')}
          hint={values.dueDate ? undefined : 'No due date'} />
      </div>}
    </ActionModal>
  );
}
