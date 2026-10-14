'use client';
import { useState } from 'react';
import { Modal, Button, TextField, Banner } from '../ds.js';
import { defaultSettlementDates, settlementDateParams } from '../store/features/settlements/settlementDates.js';

export function SettlementDateRangeDialog({ range,onApply,onClose }) {
  const [draft,setDraft] = useState(() => ({ ...range }));
  const valid = Boolean(settlementDateParams(draft));
  const change = key => event => setDraft(current => ({ ...current,[key]:event.target.value }));
  return <Modal open title="Settlement Date Range" description="Choose inclusive dates in Lagos time for the list, summary and PDF report." onClose={onClose}
    footer={<><Button variant="outline" onClick={() => setDraft(defaultSettlementDates())}>Last 30 Days</Button><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => { if (valid) onApply(draft); }}>Apply</Button></>}>
    <div style={{display:'grid',gap:16}}>
      <TextField type="date" label="From" required value={draft.from} max={draft.to || undefined} onChange={change('from')} />
      <TextField type="date" label="To" required value={draft.to} min={draft.from || undefined} onChange={change('to')} />
      {!valid && <Banner tone="warning" title="Choose a valid date range">Both dates are required. The end date must be on or after the start date.</Banner>}
    </div>
  </Modal>;
}
