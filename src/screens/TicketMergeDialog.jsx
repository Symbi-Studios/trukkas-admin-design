'use client';

import { useState } from 'react';
import { Button, Modal, Select, Skeleton } from '../ds.js';
import { useGetAdminSupportTicketDirectoryQuery } from '../store/features/tickets/ticketsApi.js';
import { getApiErrorMessage } from '../store/api/getApiErrorMessage.js';

export function TicketMergeDialog({ ticket, authenticated, saving, onMerge, onClose }) {
  const [target, setTarget] = useState('');
  const query = useGetAdminSupportTicketDirectoryQuery(undefined, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const candidates = authenticated && !query.error && ticket.userId ? (query.currentData || []).filter((row) => row.id !== ticket.id && row.userId === ticket.userId && !row.mergedInto) : [];
  const valid = !query.isFetching && candidates.some((row) => row.id === target);
  return <Modal open title="Merge Ticket" description="Move this ticket’s messages, internal notes and attachments into another ticket for the same customer. The selected ticket will remain in the directory." width={560} onClose={() => { if (!saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
    <Button disabled={!authenticated || saving || !valid} onClick={() => onMerge(target)}>Merge Ticket</Button>
  </>}>
    {query.isFetching ? <Skeleton height={60} /> : query.error ? <p>{getApiErrorMessage(query.error)}</p>
      : !ticket.userId ? <p>—</p> : <Select label="Target Ticket" placeholder={candidates.length ? 'Select a ticket' : 'No other tickets belong to this customer.'} value={target} options={candidates.map((row) => ({ value: row.id, label: `${row.id} · ${row.subject}` }))} disabled={saving || !candidates.length} onChange={(event) => setTarget(event.target.value)} />}
  </Modal>;
}
