'use client';

import { useState } from 'react';
import { Button, Modal, TextField } from '../ds.js';
import { REPORT_CAPABILITIES } from '../store/features/reports/reportsApi.js';
import { reportRangeQuery } from '../store/features/reports/reportDraft.js';

export function ReportTemplateDialog({ operations, onClose, name, onNameChange }) {
  const [localName, setLocalName] = useState('');
  const templateName = name ?? localName, setTemplateName = onNameChange || setLocalName;
  async function save() { if (await operations.save(templateName)) onClose(); }
  return <Modal open onClose={() => { if (!operations.busy) onClose(); }} title="Save Report Template"
    description="Save your current selections so you can reuse them later."
    footer={<>
      <Button variant="outline" disabled={operations.busy} onClick={onClose}>Cancel</Button>
      <Button disabled={!REPORT_CAPABILITIES.templates || operations.busy || !templateName.trim()} onClick={save}>{operations.busy ? 'Saving…' : 'Save Template'}</Button>
    </>}>
    <TextField label="Template Name" required placeholder="e.g. Weekly Verification Snapshot" value={templateName} disabled={operations.busy} onChange={(e) => setTemplateName(e.target.value)} />
  </Modal>;
}
export function ReportDateDialog({ range, onChange, onClose }) {
  const [dates, setDates] = useState(range);
  return <Modal open title="Date Range" onClose={onClose} footer={<>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button disabled={!reportRangeQuery(dates)} onClick={() => { onChange(dates); onClose(); }}>Apply</Button>
  </>}>
    <div style={{ display: 'grid', gap: 14 }}>
      <TextField label="From" type="date" value={dates.dateFrom} onChange={(e) => setDates((v) => ({ ...v, dateFrom: e.target.value }))} />
      <TextField label="To" type="date" value={dates.dateTo} onChange={(e) => setDates((v) => ({ ...v, dateTo: e.target.value }))} />
    </div>
  </Modal>;
}
