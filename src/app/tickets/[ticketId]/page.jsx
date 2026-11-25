import { Suspense } from 'react';
import { TicketPage } from '../../../screens/support/TicketPage.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('ticketId'); }
export default function TicketDetailPage(){ return <Suspense fallback={null}><TicketPage /></Suspense>; }
