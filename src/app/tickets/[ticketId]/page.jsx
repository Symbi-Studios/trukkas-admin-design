import { Suspense } from 'react';
import { TicketDetail } from '../../../screens/TicketDetail.jsx';
import { staticParamsFor } from '../../../staticParams.js';
export function generateStaticParams(){ return staticParamsFor('ticketId'); }
export default function TicketDetailPage(){ return <Suspense fallback={null}><TicketDetail/></Suspense>; }
