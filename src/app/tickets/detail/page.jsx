import { Suspense } from 'react';
import { TicketDetail } from '../../../screens/TicketDetail.jsx';

export const metadata = { title: 'Ticket Details', description: 'View and manage the details of this support ticket.' };

export default function TicketDetailPage() {
  return <Suspense fallback={null}><TicketDetail /></Suspense>;
}
