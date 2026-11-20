"use client";

import { useRef, useState } from 'react';
import { userFacingMessage } from '../store/api/getApiErrorMessage.js';
import { Badge, Banner, Button, Checkbox, EmptyState, Icon, LabelValue, Modal, SearchField, Select, Textarea, TextField } from '../ds.js';
import { forwarderError, useCreateAdminForwarderMutation, useUpdateAdminForwarderMutation, useAddAdminForwarderNoteMutation, useVerifyAdminForwardersMutation, useRequestAdminForwarderVerificationMutation } from '../store/features/forwarders/forwardersApi.js';
function useSave(onClose, onDone) {
  const lock = useRef(false);
  const [error, setError] = useState(null),
    [unconfirmed, setUnconfirmed] = useState(false);
  async function run(operation, message) {
    if (lock.current || unconfirmed) return;
    lock.current = true;
    setError(null);
    try {
      const result = await operation();
      const feedback = message(result);
      onDone?.(feedback.text || feedback, feedback.tone || 'success');
      onClose();
    } catch (failure) {
      setError(failure);
      setUnconfirmed(failure?.saveUnconfirmed === true);
    } finally {
      lock.current = false;
    }
  }
  return {
    run,
    unconfirmed,
    error,
    close: () => {
      if (!lock.current) onClose();
    }
  };
}
function SaveError({
  state
}) {
  return state.error ? <Banner tone="danger" title="Unable to confirm the update">{forwarderError(state.error)}</Banner> : null;
}
const PROFILE_FIELDS = [['Personal Information', [['firstName', 'First Name'], ['middleName', 'Middle Name'], ['lastName', 'Last Name'], ['dateOfBirth', 'Date of Birth', 'date'], ['nationality', 'Nationality'], ['languages', 'Languages', 'list']]], ['Forwarding License (optional)', [['forwardingLicenseNumber', 'Forwarding License No.']]]];
const CREATE_FIELDS = [['firstName', 'First Name'], ['lastName', 'Last Name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['dateOfBirth', 'Date of Birth', 'date'], ['businessName', 'Business Name']];
const LIST_FIELDS = new Set(PROFILE_FIELDS.flatMap(([, fields]) => fields.filter(([,, type]) => type === 'list').map(([key]) => key)));
function formValues(profile) {
  return Object.fromEntries(PROFILE_FIELDS.flatMap(([, fields]) => fields).map(([key]) => [key, LIST_FIELDS.has(key) ? (profile?.editable?.[key] || []).join('\n') : profile?.editable?.[key] ?? '']));
}
export function ForwarderProfileModal({
  forwarder,
  onClose,
  onDone
}) {
  const editing = Boolean(forwarder),
    [values, setValues] = useState(() => editing ? formValues(forwarder) : Object.fromEntries(CREATE_FIELDS.map(([key]) => [key, ''])));
  const [create, createState] = useCreateAdminForwarderMutation(),
    [update, updateState] = useUpdateAdminForwarderMutation();
  const save = useSave(onClose, onDone),
    busy = createState.isLoading || updateState.isLoading;
  const blocked = busy || save.unconfirmed || editing && !forwarder.version;
  const edit = key => event => setValues(current => ({
    ...current,
    [key]: event.target.value
  }));
  function changes() {
    const result = {};
    for (const [key, raw] of Object.entries(values)) {
      const value = LIST_FIELDS.has(key) ? raw.split('\n').map(item => item.trim()).filter(Boolean) : String(raw).trim() === '' ? null : key === 'yearsExperience' ? Number(raw) : String(raw).trim();
      const original = forwarder.editable[key] ?? (LIST_FIELDS.has(key) ? [] : null);
      if (JSON.stringify(value) !== JSON.stringify(original)) result[key] = value;
    }
    return result;
  }
  function submit(event) {
    event.preventDefault();
    if (blocked) return;
    if (editing) void save.run(() => update({
      id: forwarder.id,
      changes: changes(),
      expectedVersion: forwarder.version
    }).unwrap(), () => 'Forwarder updated.');else void save.run(() => create(values).unwrap(), result => ({
      text: result.invitation.sent ? 'Forwarder created and invitation sent.' : 'Forwarder created, but its invitation was not sent.',
      tone: result.invitation.sent ? 'success' : 'warning'
    }));
  }
  function field([key, label, type = 'text']) {
    const props = {
      label,
      value: values[key],
      disabled: blocked,
      onChange: edit(key)
    };
    return type === 'list' || type === 'textarea' ? <Textarea key={key} {...props} rows={3} hint={type === 'list' ? 'One item per line' : undefined} /> : <TextField key={key} {...props} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 1 : undefined} required={!editing && key !== 'businessName'} />;
  }
  return <Modal open title={editing ? 'Edit Forwarder' : 'Add Forwarder'} description={forwarder?.name} width={editing ? 760 : 600} onClose={save.close} footer={<><Button variant="outline" disabled={busy} onClick={save.close}>Cancel</Button><Button type="submit" form="forwarder-profile-form" disabled={blocked || editing && !Object.keys(changes()).length}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Forwarder'}</Button></>}>
    <form id="forwarder-profile-form" onSubmit={submit} style={{
      display: 'grid',
      gap: 20
    }}>
      <SaveError state={save} />
      {editing && !forwarder.version && <Banner tone="warning">The profile version is unavailable. Close this form and refresh the profile before editing.</Banner>}
      {editing ? <><div className="fd-info-grid"><LabelValue label="Email" value={forwarder.email} /><LabelValue label="Phone" value={forwarder.phone} /></div>{PROFILE_FIELDS.map(([title, fields]) => <section key={title}><h3 className="tk-title" style={{
            marginBottom: 12
          }}>{title}</h3><div className="fd-info-grid">{fields.map(field)}</div></section>)}</> : <div className="fd-info-grid">{CREATE_FIELDS.map(field)}</div>}
    </form>
  </Modal>;
}
export function ForwarderNoteModal({
  forwarder,
  onClose,
  onDone
}) {
  const [body, setBody] = useState(''),
    [add, state] = useAddAdminForwarderNoteMutation(),
    save = useSave(onClose, onDone);
  return <Modal open title="Add Note" description={forwarder.name} onClose={save.close} footer={<><Button variant="outline" disabled={state.isLoading} onClick={save.close}>Cancel</Button><Button disabled={state.isLoading || save.unconfirmed || !body.trim()} onClick={() => void save.run(() => add({
      id: forwarder.id,
      body
    }).unwrap(), () => 'Note added.')}>{state.isLoading ? 'Saving…' : 'Add Note'}</Button></>}>
    <div style={{
      display: 'grid',
      gap: 12
    }}><SaveError state={save} /><Textarea label="Note" value={body} maxLength={2000} rows={6} disabled={state.isLoading || save.unconfirmed} onChange={event => setBody(event.target.value)} /></div>
  </Modal>;
}
/** KYC items an admin can ask a forwarder to resubmit. `checkType` is the API value; items without one aren't supported by the API yet. */
export const KYC_REQUEST_OPTIONS = [
  { key: 'nin', checkType: 'NATIONAL_ID', icon: 'id-card', label: 'National ID (NIN)', hint: 'Re-check the NIN against their details' },
  { key: 'address', checkType: 'ADDRESS', icon: 'map-pin', label: 'Proof of Address', hint: 'Ask for a new utility bill or bank statement' },
  { key: 'license', checkType: 'EXPORT_LICENSE', icon: 'file-badge', label: 'Forwarding License', hint: 'Ask for a current license document' },
  { key: 'passport', icon: 'image', label: 'Passport Photograph', hint: 'Not available from the API yet' },
  { key: 'bank', icon: 'landmark', label: 'Bank Account', hint: 'Not available from the API yet' },
];
const REASON_PRESETS = ['Document is unclear or unreadable', 'Document has expired', 'Details don’t match the profile', 'Document appears altered'];
const STATUS_TONE = { Verified: 'success', Pending: 'warning', Rejected: 'danger' };

export function ForwarderVerificationRequestModal({
  forwarder,
  statuses = {},
  initialKey,
  onClose,
  onDone
}) {
  const initial = KYC_REQUEST_OPTIONS.find(option => option.key === initialKey && option.checkType);
  const [selected, setSelected] = useState(initial?.key || ''),
    [reason, setReason] = useState(''),
    [request, state] = useRequestAdminForwarderVerificationMutation(),
    save = useSave(onClose, onDone);
  const disabled = state.isLoading || save.unconfirmed;
  const option = KYC_REQUEST_OPTIONS.find(item => item.key === selected);
  return <Modal open width={560} title="Request re-verification" description={`Ask ${forwarder.name} to resubmit a KYC item. They’ll be notified with your reason.`} onClose={save.close} footer={<><Button variant="outline" disabled={state.isLoading} onClick={save.close}>Cancel</Button><Button icon="send" disabled={disabled || !option?.checkType || !reason.trim()} onClick={() => void save.run(() => request({
      id: forwarder.id,
      checkType: option.checkType,
      reason
    }).unwrap(), () => `Re-verification of ${option.label} requested.`)}>{state.isLoading ? 'Sending…' : 'Send Request'}</Button></>}>
    <div style={{ display: 'grid', gap: 18 }}>
      <SaveError state={save} />
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="tk-field-label" style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>What needs re-verifying?</span>
        <div className="fv-options" role="radiogroup" aria-label="KYC item">
          {KYC_REQUEST_OPTIONS.map(item => {
            const unsupported = !item.checkType, active = selected === item.key, status = statuses[item.key];
            return <button key={item.key} type="button" role="radio" aria-checked={active} disabled={disabled || unsupported} className={'fv-option' + (active ? ' active' : '')} onClick={() => setSelected(item.key)}>
              <span className="fv-option-icon"><Icon name={item.icon} size={16} /></span>
              <span className="fv-option-text"><strong>{item.label}</strong><small>{item.hint}</small></span>
              {unsupported ? <Badge tone="neutral">Unavailable</Badge> : status && status !== '—' ? <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge> : null}
              <span className="fv-option-radio" aria-hidden="true" />
            </button>;
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Textarea label="Reason" hint="Shared with the forwarder." rows={3} maxLength={500} value={reason} disabled={disabled} placeholder="Explain what’s wrong and what they should upload" onChange={event => setReason(event.target.value)} />
        <div className="fv-chips" aria-label="Suggested reasons">
          {REASON_PRESETS.map(text => <button key={text} type="button" className={'fv-chip' + (reason === text ? ' active' : '')} aria-pressed={reason === text} disabled={disabled} onClick={() => setReason(text)}>{text}</button>)}
        </div>
      </div>
    </div>
  </Modal>;
}
export function ForwarderBulkVerifyModal({
  forwarders,
  onClose,
  onDone
}) {
  const [selected, setSelected] = useState([]),
    [search, setSearch] = useState(''),
    [reason, setReason] = useState(''),
    [result, setResult] = useState(null);
  const [verify, state] = useVerifyAdminForwardersMutation(),
    save = useSave(() => {}, onDone),
    request = useRef(null);
  const busy = state.isLoading,
    locked = busy || Boolean(result);
  const rows = forwarders.filter(row => !search || [row.name, row.id].some(value => value.toLowerCase().includes(search.toLowerCase())));
  async function submit() {
    if (busy || result || !selected.length) return;
    const signature = JSON.stringify({
      userIds: [...selected].sort(),
      reason: reason.trim()
    });
    if (request.current?.signature !== signature) request.current = {
      signature,
      key: crypto.randomUUID()
    };
    await save.run(async () => {
      const response = await verify({
        userIds: selected,
        reason,
        idempotencyKey: request.current.key
      }).unwrap();
      setResult(response.results);
      return response;
    }, response => {
      const verified = response.results.filter(row => row.outcome === 'VERIFIED').length,
        failed = response.results.filter(row => row.outcome === 'FAILED').length;
      return {
        text: verified + ' verified; ' + failed + ' failed; ' + (response.results.length - verified - failed) + ' had nothing to verify.',
        tone: failed ? 'warning' : 'success'
      };
    });
  }
  return <Modal open title="Bulk Verify Forwarders" width={680} onClose={() => {
    if (!busy) onClose();
  }} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button disabled={locked || save.unconfirmed || !selected.length} onClick={() => void submit()}>{busy ? 'Verifying…' : 'Verify Selected'}</Button></>}>
    <div style={{
      display: 'grid',
      gap: 12
    }}><SaveError state={save} />
      <p className="tk-meta">Approves submitted exporter licenses and address documents waiting for human review. National ID and BVN results remain with the verification provider.</p>
      {result ? result.map(row => <div key={row.userId} className="fd-row"><span style={{
          flex: 1
        }}>{forwarders.find(item => item.id === row.userId)?.name || row.userId}</span><span>{row.outcome.replaceAll('_', ' ')}{row.error ? ' · ' + userFacingMessage(row.error, 'Verification failed') : ''}</span></div>) : <><SearchField placeholder="Search forwarders..." value={search} disabled={locked} onChange={event => setSearch(event.target.value)} /><span className="tk-meta">{selected.length} / 100 selected</span><div style={{
          maxHeight: 280,
          overflowY: 'auto'
        }}>{!rows.length ? <EmptyState title="No forwarders found" /> : rows.map(row => <div key={row.id} className="fd-row"><Checkbox label={row.name + ' · ' + row.id} checked={selected.includes(row.id)} disabled={busy || save.unconfirmed || selected.length >= 100 && !selected.includes(row.id)} onChange={checked => setSelected(current => checked ? [...current, row.id] : current.filter(id => id !== row.id))} /></div>)}</div><Textarea label="Reason (optional)" value={reason} disabled={locked || save.unconfirmed} onChange={event => setReason(event.target.value)} /></>}
    </div>
  </Modal>;
}
