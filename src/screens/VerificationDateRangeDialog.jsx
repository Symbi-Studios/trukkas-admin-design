'use client';

import { useState } from 'react';
import { Modal, Button, TextField, Banner } from '../ds.js';
import { verificationDateParams } from '../store/features/verification/verificationDates.js';

export function VerificationDateRangeDialog({ range, onApply, onClose }) {
  const [draft, setDraft] = useState(() => range ? { ...range } : { from: '', to: '' });
  const valid = Boolean(verificationDateParams(draft));
  const change = key => event => setDraft(current => ({ ...current, [key]: event.target.value }));
  return <Modal open title="Verification Date Range" description="Choose inclusive submission dates in Lagos time for the table and report export." onClose={onClose}
    footer={<><Button variant="outline" onClick={() => onApply(null)}>All Dates</Button><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => { if (valid) onApply(draft); }}>Apply</Button></>}>
    <div style={{ display: 'grid', gap: 16 }}>
      <TextField type="date" label="From" required value={draft.from} max={draft.to || undefined} onChange={change('from')} />
      <TextField type="date" label="To" required value={draft.to} min={draft.from || undefined} onChange={change('to')} />
      {!valid && <Banner tone="warning" title="Choose a valid date range">Both dates are required. The end date must be on or after the start date.</Banner>}
    </div>
  </Modal>;
}
