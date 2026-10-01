'use client';
import { useEffect, useState } from 'react';
import { Banner, Button, Modal, TextField } from '../ds.js';
import { fleetError, useReviewAdminFleetTruckMutation } from '../store/features/fleet/fleetApi.js';

export function fleetReviewItems(truck, onReview) {
  const items = [];
  for (const [kind, available] of [['registration', truck.canReviewRegistration], ['inspection', truck.canReviewInspection]]) {
    if (!available) continue;
    items.push({ label: `Approve ${kind}`, icon: 'check', onClick: () => onReview({ truck, kind, decision: 'approve' }) });
    items.push({ label: `Reject ${kind}`, icon: 'circle-x', tone: 'danger', onClick: () => onReview({ truck, kind, decision: 'reject' }) });
  }
  return items;
}

export function FleetReviewModal({ review, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [submit, { isLoading, error, reset }] = useReviewAdminFleetTruckMutation();
  useEffect(() => { setReason(''); reset(); }, [review, reset]);
  const reject = review?.decision === 'reject';
  async function save() {
    if (!review || isLoading) return;
    try {
      const result = await submit({ id: review.truck.id, kind: review.kind, decision: review.decision, reason }).unwrap();
      onSuccess?.(result.message || `Truck ${reject ? 'rejected' : 'approved'} successfully.`);
      onClose();
    } catch { /* The modal keeps the server error and the entered reason. */ }
  }
  return <Modal open={Boolean(review)} onClose={() => { if (!isLoading) onClose(); }}
    title={`${reject ? 'Reject' : 'Approve'} truck ${review?.kind || ''}`}
    description={`${review?.truck.plate || ''} · ${review?.truck.company || 'Company unavailable'}`}
    footer={<><Button variant="outline" disabled={isLoading} onClick={onClose}>Cancel</Button><Button disabled={isLoading} onClick={save}>{isLoading ? 'Saving…' : reject ? 'Reject Truck' : 'Approve Truck'}</Button></>}>
    <p className="tk-body">{reject ? 'The truck will be rejected and its owner notified.' : 'The truck will be approved and its owner notified.'}</p>
    {reject && <TextField label="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} />}
    {error && <Banner tone="danger" title="Unable to save review">{fleetError(error)}</Banner>}
  </Modal>;
}
