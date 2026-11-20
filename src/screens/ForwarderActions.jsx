"use client";
import { useRef, useState } from 'react';
import { Avatar, Banner, Button, Icon, Modal, TextField, Textarea } from '../ds.js';
import { forwarderError, useReviewAdminForwarderExporterLicenseMutation, useSuspendAdminForwarderMutation, useActivateAdminForwarderMutation, useSendAdminForwarderAnnouncementMutation } from '../store/features/forwarders/forwardersApi.js';

export function ForwarderActionModal({ action, onClose, onDone }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  const [review, reviewState] = useReviewAdminForwarderExporterLicenseMutation();
  const [suspend, suspendState] = useSuspendAdminForwarderMutation();
  const [activate, activateState] = useActivateAdminForwarderMutation();
  const busy = reviewState.isLoading || suspendState.isLoading || activateState.isLoading;
  const isReview = action.kind === 'review', row = action.forwarder;
  const submitting = useRef(false);
  async function submit(decision) {
    if (submitting.current || busy) return;
    submitting.current = true; setError(null);
    try {
      if (isReview) await review({ id: row.id, decision, reason }).unwrap();
      else if (action.kind === 'suspend') await suspend({ id: row.id, reason }).unwrap();
      else await activate(row.id).unwrap();
      onDone?.(isReview ? `Exporter license ${decision === 'approve' ? 'approved' : 'rejected'}.` : `Forwarder ${action.kind === 'suspend' ? 'suspended' : 'reactivated'}.`);
      onClose();
    } catch (requestError) { setError(forwarderError(requestError)); }
    finally { submitting.current = false; }
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
const CHANNELS = [
  { value: 'in-app', icon: 'bell', label: 'In-app', hint: 'Notification centre' },
  { value: 'email', icon: 'mail', label: 'Email', hint: 'To their inbox' },
  { value: 'push', icon: 'smartphone', label: 'Push', hint: 'Phone alert' },
];
const TITLE_MAX = 80, MESSAGE_MAX = 1000;

export function ForwarderAnnouncementModal({ forwarder, onClose, onDone }) {
  const [title, setTitle] = useState(''), [message, setMessage] = useState(''), [channels, setChannels] = useState(['in-app']), [error, setError] = useState(null);
  const [send, state] = useSendAdminForwarderAnnouncementMutation();
  const submitting = useRef(false);
  const busy = state.isLoading;
  async function submit() {
    if (submitting.current || busy) return;
    submitting.current = true; setError(null);
    try { const result = await send({ id: forwarder?.id, title, message, channels }).unwrap(); onDone?.(forwarder ? `Message sent to ${forwarder.name}.` : 'Announcement sent to ' + result.sentCount + ' forwarder(s).'); onClose(); }
    catch (requestError) { setError(forwarderError(requestError)); }
    finally { submitting.current = false; }
  }
  const toggle = (value) => setChannels((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  return <Modal open width={560} title={forwarder ? 'Send message' : 'Send announcement'} description={forwarder ? 'Send a direct notice to this forwarder.' : 'Send a notice to every forwarder on Trukkas.'} onClose={() => { if (!busy) onClose(); }} footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button icon="send" disabled={busy || !title.trim() || !message.trim() || !channels.length} onClick={submit}>{busy ? 'Sending…' : 'Send'}</Button></>}>
    <div style={{ display: 'grid', gap: 18 }}>
      {error && <Banner tone="danger" title="Unable to send">{error}</Banner>}
      <div className="fa-recipient">
        {forwarder ? <Avatar name={forwarder.name} size={36} /> : <span className="fa-recipient-icon"><Icon name="users" size={18} /></span>}
        <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
          <span className="tk-meta">To</span>
          <strong>{forwarder ? forwarder.name : 'All forwarders'}</strong>
        </span>
        {forwarder?.email && forwarder.email !== '—' && <span className="tk-meta fa-recipient-email">{forwarder.email}</span>}
      </div>
      <TextField label="Subject" placeholder="e.g. Your documents need attention" value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} disabled={busy} />
      <Textarea label="Message" placeholder="Write your message…" value={message} maxLength={MESSAGE_MAX} onChange={(event) => setMessage(event.target.value)} rows={5} disabled={busy} />
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ font: '600 13px/18px var(--tk-font-sans)', color: 'var(--tk-ink-700)' }}>Send via</span>
        <div className="fa-channels" role="group" aria-label="Channels">
          {CHANNELS.map((channel) => {
            const on = channels.includes(channel.value);
            return <button key={channel.value} type="button" role="checkbox" aria-checked={on} disabled={busy} className={'fa-channel' + (on ? ' active' : '')} onClick={() => toggle(channel.value)}>
              <span className="fa-channel-check" aria-hidden="true">{on && <Icon name="check" size={11} color="#fff" />}</span>
              <Icon name={channel.icon} size={18} />
              <strong>{channel.label}</strong>
              <small>{channel.hint}</small>
            </button>;
          })}
        </div>
        {!channels.length && <span className="tk-meta" style={{ color: 'var(--tk-danger)' }}>Choose at least one channel.</span>}
      </div>
    </div>
  </Modal>;
}
export function downloadForwarderCsv(filename, rows) {
  const cell = (value) => { const text = value == null ? '' : String(value); const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
