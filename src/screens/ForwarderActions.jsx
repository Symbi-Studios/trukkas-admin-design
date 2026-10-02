"use client";
import { useState } from 'react';
import { Banner, Button, Modal, TextField, Textarea } from '../ds.js';
import { forwarderError, useReviewAdminForwarderExporterLicenseMutation, useSuspendAdminForwarderMutation, useActivateAdminForwarderMutation, useSendAdminForwarderAnnouncementMutation } from '../store/features/forwarders/forwardersApi.js';

export function ForwarderActionModal({ action, onClose, onDone }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  const [review, reviewState] = useReviewAdminForwarderExporterLicenseMutation();
  const [suspend, suspendState] = useSuspendAdminForwarderMutation();
  const [activate, activateState] = useActivateAdminForwarderMutation();
  const busy = reviewState.isLoading || suspendState.isLoading || activateState.isLoading;
  const isReview = action.kind === 'review', row = action.forwarder;
  async function submit(decision) {
    setError(null);
    try {
      if (isReview) await review({ id: row.id, decision, reason }).unwrap();
      else if (action.kind === 'suspend') await suspend({ id: row.id, reason }).unwrap();
      else await activate(row.id).unwrap();
      onDone?.(isReview ? `Exporter license ${decision === 'approve' ? 'approved' : 'rejected'}.` : `Forwarder ${action.kind === 'suspend' ? 'suspended' : 'reactivated'}.`);
      onClose();
    } catch (requestError) { setError(forwarderError(requestError)); }
  }
  return <Modal open title={isReview ? 'Review exporter license' : action.kind === 'suspend' ? 'Suspend forwarder' : 'Reactivate forwarder'} description={row.name} onClose={() => { if (!busy) onClose(); }} footer={<>
    <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    {isReview ? <><Button variant="outline" disabled={busy || !row.url} onClick={() => submit('reject')}>Reject</Button><Button disabled={busy || !row.url} onClick={() => submit('approve')}>{busy ? 'Saving…' : 'Approve'}</Button></> : <Button disabled={busy || (action.kind === 'suspend' && !reason.trim())} onClick={() => submit()}>{busy ? 'Saving…' : action.kind === 'suspend' ? 'Suspend' : 'Reactivate'}</Button>}
  </>}>
    {error && <Banner tone="danger" title="Unable to save">{error}</Banner>}
    {isReview && <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}><span className="tk-meta">Submitted: {row.submitted || '—'}</span>{row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer">Open exporter license ↗</a> : <Banner tone="warning">The license document is unavailable. Review is disabled until it can be opened.</Banner>}</div>}
    {action.kind !== 'activate' && <Textarea label={isReview ? 'Reason for rejection (optional)' : 'Reason for suspension'} value={reason} onChange={(event) => setReason(event.target.value)} rows={4} disabled={busy} />}
  </Modal>;
}
export function ForwarderAnnouncementModal({ forwarder, onClose, onDone }) {
  const [title, setTitle] = useState(''), [message, setMessage] = useState(''), [channels, setChannels] = useState(['in-app']), [error, setError] = useState(null);
  const [send, state] = useSendAdminForwarderAnnouncementMutation();
  async function submit() {
    setError(null);
    try { await send({ id: forwarder?.id, title, message, channels }).unwrap(); onDone?.('Announcement sent.'); onClose(); }
    catch (requestError) { setError(forwarderError(requestError)); }
  }
  return <Modal open title="Send Announcement" description={forwarder ? `Recipient: ${forwarder.name}` : 'Recipients: all forwarders and exporters'} onClose={() => { if (!state.isLoading) onClose(); }} footer={<><Button variant="outline" disabled={state.isLoading} onClick={onClose}>Cancel</Button><Button disabled={state.isLoading || !title.trim() || !message.trim() || !channels.length} onClick={submit}>{state.isLoading ? 'Sending…' : 'Send Announcement'}</Button></>}>
    <div style={{ display: 'grid', gap: 16 }}>{error && <Banner tone="danger" title="Unable to send">{error}</Banner>}<TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={state.isLoading} /><Textarea label="Message" value={message} onChange={(event) => setMessage(event.target.value)} rows={5} disabled={state.isLoading} /><fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="tk-meta">Channels</legend><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>{['in-app', 'email', 'push'].map((channel) => <label key={channel}><input type="checkbox" checked={channels.includes(channel)} disabled={state.isLoading} onChange={(event) => setChannels((current) => event.target.checked ? [...current, channel] : current.filter((item) => item !== channel))} /> {channel}</label>)}</div></fieldset></div>
  </Modal>;
}
export function downloadForwarderCsv(filename, rows) {
  const cell = (value) => { const text = value == null ? '' : String(value); const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
