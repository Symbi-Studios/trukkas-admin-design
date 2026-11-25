'use client';
import { useState } from 'react';
import { Banner, Button, Modal, Textarea } from '../ds.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function AnnouncementReasonDialog({ action, announcement, operations, onClose, onSaved }) {
  const [reason, setReason] = useState(''), [error, setError] = useState(null);
  async function submit() {
    if (!reason.trim() || operations.saving) return;
    setError(null);
    try { const result = await operations.perform({ action, id: announcement.id, reason }); if (result) { onSaved(result); onClose(); } }
    catch (failure) { setError(getApiErrorMessage(failure)); }
  }
  return <Modal open title={action === 'archive' ? 'Archive announcement' : 'Unpublish announcement'} width={520} onClose={() => { if (!operations.saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={operations.saving} onClick={onClose}>Cancel</Button>
    <Button variant="danger" disabled={!reason.trim() || operations.saving} onClick={submit}>{operations.saving ? 'Saving…' : action === 'archive' ? 'Archive' : 'Unpublish'}</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <Banner tone="danger">{error}</Banner>}
      <strong>{announcement.t}</strong>
      <Textarea label="Reason" value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
    </div>
  </Modal>;
}
