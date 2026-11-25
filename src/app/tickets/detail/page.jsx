import { Suspense } from 'react';
import { TicketPage } from '../../../screens/support/TicketPage.jsx';

export const metadata = { title: 'Ticket' };

export default function TicketDetailPage() {
  return <Suspense fallback={null}><TicketPage /></Suspense>;
}
