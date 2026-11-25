'use client';

import { useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from '../../router.js';
import { Button, PageHeader } from '../../ds.js';
import { useGetAdminSupportTicketDirectoryQuery, useGetAdminSupportTicketDetailQuery } from '../../store/features/tickets/ticketsApi.js';
import { TicketPane } from './TicketPane.jsx';
import { ticketLabel } from './supportInbox.js';

/** Full-page ticket (/tickets/detail?ticketId=…): the inbox pane on its own, for links and printing. */
export function TicketPage() {
  const params = useParams(), search = useSearchParams(), navigate = useNavigate();
  const ticketId = params.ticketId || search.get('ticketId') || '';
  const authenticated = useSelector((state) => Boolean(state.auth.signedIn));
  const detail = useGetAdminSupportTicketDetailQuery(ticketId, { skip: !authenticated || !ticketId });
  const directory = useGetAdminSupportTicketDirectoryQuery(undefined, { skip: !authenticated });
  const label = detail.currentData ? ticketLabel(detail.currentData) : 'Ticket';
  const subject = detail.currentData?.subjectValue || label;
  return (
    <>
      <PageHeader crumbs={['Support System', { label: 'Support Tickets', to: '/tickets' }, label]} title={subject}
        actions={<Button variant="outline" icon="inbox" onClick={() => navigate(`/tickets?ticket=${encodeURIComponent(ticketId)}`)}>Open in inbox</Button>} />
      <TicketPane ticketId={ticketId} layout="page" siblings={directory.currentData || []} />
    </>
  );
}
