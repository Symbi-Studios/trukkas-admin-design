'use client';

import React from 'react';
import { Avatar, Banner, Button, Icon, Modal, Select, TextField, Textarea } from '../../ds.js';
import {
  useCreateAdminSupportTicketMutation, useSearchSupportCustomersQuery, TICKET_CATEGORY_CODES, TICKET_PRIORITY_CODES,
} from '../../store/features/tickets/ticketsApi.js';
import { getApiErrorMessage } from '../../store/api/getApiErrorMessage.js';
import { showToast } from '../../components/ActionToast.jsx';
import { customerRoleLabel } from './supportInbox.js';
import styles from './SupportInbox.module.css';

const EMPTY = { subject: '', category: 'General', priority: 'Medium', assignedTo: '', description: '' };

/** Find an existing customer by name or email; the API only opens tickets for existing accounts. */
export function CustomerPicker({ value, onChange, disabled }) {
  const [term, setTerm] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => { const timer = setTimeout(() => setDebounced(term.trim()), 250); return () => clearTimeout(timer); }, [term]);
  const query = useSearchSupportCustomersQuery(debounced, { skip: debounced.length < 2 || Boolean(value) });
  const results = debounced.length >= 2 ? query.currentData || [] : [];
  const showList = debounced.length >= 2 && !dismissed;
  React.useEffect(() => setActive(0), [debounced]);

  if (value) {
    return (
      <div className={styles.pickedCustomer}>
        <Avatar name={value.name} size={28} />
        <span><strong>{value.name}</strong><small>{[customerRoleLabel(value.role), value.email].filter(Boolean).join(' · ')}</small></span>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>Change</Button>
      </div>
    );
  }
  const listId = 'new-ticket-customers';
  return (
    <div className={styles.customerSearch}>
      <TextField label="Customer" placeholder="Search by name or email" value={term} disabled={disabled} autoFocus
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && results.length ? `${listId}-${active}` : undefined}
        onChange={(event) => { setTerm(event.target.value); setDismissed(false); }}
        onKeyDown={(event) => {
          // First Escape closes the results; the next one reaches the dialog and closes it.
          if (event.key === 'Escape' && showList) { setDismissed(true); return; }
          if (!results.length || !showList) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (event.key === 'Enter') { event.preventDefault(); onChange(results[active]); }
        }} />
      {showList && (
        <ul id={listId} role="listbox" className={styles.customerResults}>
          {query.isFetching && !results.length ? <li className={styles.customerHint}>Searching…</li>
            : query.error ? <li className={styles.customerHint}>{getApiErrorMessage(query.error)}</li>
            : !results.length ? <li className={styles.customerHint}>No customer matches “{debounced}”. Tickets can only be opened for existing accounts.</li>
            : results.map((customer, index) => (
              <li key={customer.id} id={`${listId}-${index}`} role="option" aria-selected={index === active} data-active={index === active || undefined}
                onMouseEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); onChange(customer); }}>
                <Avatar name={customer.name} size={24} />
                <span><strong>{customer.name}</strong><small>{[customerRoleLabel(customer.role), customer.business, customer.email].filter(Boolean).join(' · ')}</small></span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export function NewTicketDialog({ agents = [], me, onClose, onCreated }) {
  const [customer, setCustomer] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY);
  const [error, setError] = React.useState('');
  const [createTicket, state] = useCreateAdminSupportTicketMutation();
  const saving = state.isLoading;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const paymentOnly = form.category === 'Payment Issue';
  const assignable = agents.filter((agent) => agent.isActive === true && (!paymentOnly || ['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(agent.role)));
  React.useEffect(() => {
    if (form.assignedTo && !assignable.some((agent) => agent.id === form.assignedTo)) setForm((current) => ({ ...current, assignedTo: '' }));
  }, [form.assignedTo, assignable]);
  const ready = customer && form.subject.trim() && form.description.trim() && TICKET_CATEGORY_CODES[form.category] && TICKET_PRIORITY_CODES[form.priority];

  async function submit(event) {
    event?.preventDefault();
    if (!ready || saving) return;
    setError('');
    try {
      const saved = await createTicket({ values: { ...form, customer: customer.name, email: customer.email, userId: customer.id } }).unwrap();
      showToast(saved.reference ? `Ticket ${saved.reference} created` : 'Ticket created');
      onCreated(saved);
    } catch (failure) { setError(getApiErrorMessage(failure)); }
  }

  return (
    <Modal open title="New ticket" description="Opens a ticket on the customer’s account. It appears in their support list in the app." width={560}
      onClose={() => { if (!saving) onClose(); }}
      footer={<>
        <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button loading={saving} disabled={!ready} onClick={submit}>Create ticket</Button>
      </>}>
      <form className={styles.newTicket} onSubmit={submit}>
        {error && <Banner tone="danger" title="Couldn’t create the ticket">{error}</Banner>}
        <CustomerPicker value={customer} onChange={setCustomer} disabled={saving} />
        <TextField label="Subject" value={form.subject} maxLength={200} disabled={saving} onChange={set('subject')} />
        <div className={styles.formRow}>
          <Select label="Category" value={form.category} options={Object.keys(TICKET_CATEGORY_CODES)} disabled={saving} onChange={set('category')} />
          <Select label="Priority" value={form.priority} options={Object.keys(TICKET_PRIORITY_CODES)} disabled={saving} onChange={set('priority')} />
        </div>
        <Select label="Assign to" value={form.assignedTo} disabled={saving || !assignable.length}
          options={[{ value: '', label: 'Unassigned' }, ...assignable.map((agent) => ({ value: agent.id, label: agent.id === me ? `${agent.name} (you)` : agent.name }))]}
          onChange={set('assignedTo')} />
        {paymentOnly && <p className={styles.formHint}><Icon name="lock" size={13} aria-hidden="true" /> Payment tickets can only be handled by Finance and Technical admins.</p>}
        <Textarea label="Description" rows={5} value={form.description} disabled={saving} onChange={set('description')}
          placeholder="What does the customer need? This is stored on the ticket, not sent as a message." />
      </form>
    </Modal>
  );
}
